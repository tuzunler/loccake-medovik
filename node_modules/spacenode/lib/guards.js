// ─────────────────────────────────────────────
// SpaceNode — Guards & Auth (v2)
// ─────────────────────────────────────────────
// v2 changes:
//   - Auth verifier is per-app (with global fallback for backward compat)
//   - Guard registry supports per-app namespacing
//   - Rate limiter: sliding window counter, pluggable store, no setInterval
//   - Compression: async (non-blocking), using promisified zlib
//   - All guards receive request context (which has _app reference)

import { HttpError } from './errors.js'
import { brotliCompress, gzip, deflate } from 'node:zlib'
import { promisify } from 'node:util'
import { randomBytes, timingSafeEqual } from 'node:crypto'

const brotliCompressAsync = promisify(brotliCompress)
const gzipAsync = promisify(gzip)
const deflateAsync = promisify(deflate)

// ── Auth definition ──
// Global fallback — used when app-level auth is not set

let _globalAuthVerifier = null

/**
 * Define YOUR auth verification logic (global).
 * For per-app auth, use app.setAuth() instead.
 *
 *   defineAuth(async (token) => {
 *     const session = await Session.findOne({ token, active: true })
 *     if (!session) return null
 *     return await User.findById(session.userId)
 *   })
 *
 * @param {Function} verifier — (token: string, request?) => user | null
 */
export function defineAuth(verifier) {
  if (typeof verifier !== 'function') {
    throw new Error('defineAuth() requires a function: (token) => user | null')
  }
  _globalAuthVerifier = verifier
}

export function getAuthVerifier() {
  return _globalAuthVerifier
}

// ── Guard Registry ──
// Global custom guards — per-app guards take precedence

const _globalCustomGuards = new Map()

/**
 * Register a custom named guard (global).
 * For per-app guards, use app.addGuard() instead.
 *
 *   defineGuard('premium', ({ user }) => {
 *     if (!user?.isPremium) throw new HttpError(403, 'Premium required')
 *   })
 */
export function defineGuard(name, factory) {
  _globalCustomGuards.set(name, factory)
}

export function getCustomGuard(name) {
  return _globalCustomGuards.get(name)
}

// ── Built-in Guards ──

/**
 * auth — Extracts Bearer token, calls auth verifier, merges { user } into request.
 * Checks app-level verifier first, then global fallback.
 */
function authGuard() {
  return async (request) => {
    // Per-app verifier takes precedence over global
    const verifier = request._app?._authVerifier || _globalAuthVerifier
    if (!verifier) {
      throw new HttpError(500, 'Auth not configured. Call defineAuth() or app.setAuth()')
    }

    const header = request.headers.authorization || request.headers.Authorization || ''
    const token = header.replace(/^Bearer\s+/i, '')
    if (!token) {
      throw new HttpError(401, 'Authorization required')
    }

    const user = await verifier(token, request)
    if (!user) {
      throw new HttpError(401, 'Invalid or expired token')
    }

    return { user }
  }
}

/**
 * role:admin — Checks request.user.role against allowed roles.
 * Requires auth guard to run first.
 */
function roleGuard(roles) {
  const allowed = roles.split(',').map(r => r.trim())
  return (request) => {
    if (!request.user) {
      throw new HttpError(401, 'Authentication required before role check')
    }
    if (!allowed.includes(request.user.role)) {
      throw new HttpError(403, `Access denied. Required role: ${allowed.join(' or ')}`)
    }
  }
}

/**
 * rateLimit:100 — Sliding window rate limiter.
 * No setInterval — uses lazy cleanup on access.
 * Supports pluggable store via app.setRateLimitStore(store).
 *
 * Sliding window counter algorithm:
 *   rate ≈ prevCount × (1 - elapsed/window) + currCount
 *   Much more accurate than fixed-window counters.
 *
 * @param {string} max — max requests per window (e.g. '100')
 */
function rateLimitGuard(max) {
  const limit = Number(max) || 100
  const windowMs = 60_000

  // Per-guard store (in-memory default, can be overridden at app level)
  let defaultStore = new Map()
  let accessCount = 0
  const CLEANUP_EVERY = 500 // lazy cleanup every N requests

  return (request) => {
    // Use app-level store if available, otherwise local default
    const store = request._app?._rateLimitStore || defaultStore
    const ip = request.ip || 'unknown'
    const now = Date.now()

    // Lazy cleanup — no setInterval needed
    if (++accessCount >= CLEANUP_EVERY) {
      accessCount = 0
      if (store instanceof Map) {
        for (const [key, entry] of store) {
          if (now - entry.currStart > windowMs * 2) store.delete(key)
        }
      }
    }

    let entry = store instanceof Map ? store.get(ip) : null

    if (!entry) {
      const newEntry = { prevCount: 0, currCount: 1, currStart: now }
      if (store instanceof Map) store.set(ip, newEntry)
      _setRateLimitHeaders(request, limit, limit - 1)
      return
    }

    // Sliding window calculation (compute elapsed BEFORE potential reset)
    const elapsed = now - entry.currStart
    const weight = Math.max(0, 1 - elapsed / windowMs)

    // Check if current window has expired → shift
    if (elapsed >= windowMs) {
      entry.prevCount = entry.currCount
      entry.currCount = 0
      entry.currStart = now
    }
    const estimatedRate = Math.floor(entry.prevCount * weight) + entry.currCount

    if (estimatedRate >= limit) {
      const retryAfter = Math.ceil((entry.currStart + windowMs - now) / 1000)
      request.setHeader('Retry-After', String(retryAfter))
      _setRateLimitHeaders(request, limit, 0)
      throw new HttpError(429, 'Too many requests. Try again later.')
    }

    entry.currCount++
    _setRateLimitHeaders(request, limit, Math.max(0, limit - estimatedRate - 1))
  }
}

function _setRateLimitHeaders(request, limit, remaining) {
  request.setHeader('X-RateLimit-Limit', String(limit))
  request.setHeader('X-RateLimit-Remaining', String(remaining))
}

/**
 * cors — Sets CORS headers. Supports origin parameter.
 * Usage: pipe: ['cors'] or pipe: ['cors:https://mysite.com']
 */
function corsGuard(origin) {
  const allowedOrigin = origin || null
  return (request) => {
    let effectiveOrigin
    if (allowedOrigin) {
      effectiveOrigin = allowedOrigin
    } else {
      const reqOrigin = request.headers.origin
      if (reqOrigin) {
        effectiveOrigin = reqOrigin
        request.setHeader('Vary', 'Origin')
      } else {
        effectiveOrigin = '*'
      }
    }
    request.setHeader('Access-Control-Allow-Origin', effectiveOrigin)
    request.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
    const requestedHeaders = request.headers['access-control-request-headers']
    request.setHeader('Access-Control-Allow-Headers',
      requestedHeaders || 'Content-Type,Authorization'
    )
    // Only send credentials header when origin is not wildcard (per spec)
    if (effectiveOrigin !== '*') {
      request.setHeader('Access-Control-Allow-Credentials', 'true')
    }
    request.setHeader('Access-Control-Max-Age', '86400')

    if (request.method === 'OPTIONS') {
      request.send(204, '')
    }
  }
}

/**
 * logger — Request logging with timing (uses after hook).
 */
function loggerGuard() {
  return (request) => {
    const start = Date.now()
    const ts = new Date().toISOString().slice(11, 19)
    return {
      after: (statusCode) => {
        const ms = Date.now() - start
        const logger = request._app?._logger
        const msg = `${ts} ${request.method} ${request.path} → ${statusCode} (${ms}ms)`
        if (logger) {
          logger.info(msg)
        } else {
          console.log(`  ${msg}`)
        }
      }
    }
  }
}

/**
 * compress — Async Gzip/Brotli/Deflate response compression.
 * Sets a flag on request — actual compression happens in send().
 * Non-blocking — uses async zlib functions.
 */
function compressGuard(forceEncoding) {
  return (request) => {
    const accept = request.headers['accept-encoding'] || ''
    let encoding = null

    if (forceEncoding) {
      encoding = forceEncoding
    } else if (accept.includes('br')) {
      encoding = 'br'
    } else if (accept.includes('gzip')) {
      encoding = 'gzip'
    } else if (accept.includes('deflate')) {
      encoding = 'deflate'
    }

    if (!encoding) return

    // Store compression intent — actual compression is async in send()
    request._compressEncoding = encoding
  }
}

/**
 * Internal: perform async compression of a buffer.
 * Called by send() in context.js when _compressEncoding is set.
 *
 * @param {Buffer} buf
 * @param {string} encoding — 'br', 'gzip', or 'deflate'
 * @returns {Promise<Buffer>}
 */
export async function compressBuffer(buf, encoding) {
  if (encoding === 'br') return brotliCompressAsync(buf)
  if (encoding === 'gzip') return gzipAsync(buf)
  return deflateAsync(buf)
}

/**
 * security — Common security headers.
 */
function securityGuard(mode) {
  const strict = mode === 'strict'
  return (request) => {
    request.setHeader('X-Content-Type-Options', 'nosniff')
    request.setHeader('X-Frame-Options', 'DENY')
    request.setHeader('X-XSS-Protection', '0')
    request.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
    request.setHeader('X-Permitted-Cross-Domain-Policies', 'none')
    request.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')

    if (strict) {
      request.setHeader('Content-Security-Policy',
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data:; font-src 'self'; connect-src 'self'; " +
        "frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
      )
      request.setHeader('Permissions-Policy',
        'camera=(), microphone=(), geolocation=(), payment=()'
      )
      request.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
      request.setHeader('Cross-Origin-Resource-Policy', 'same-origin')
    }
  }
}

/**
 * csrf — Double-submit cookie CSRF protection.
 *
 * On GET/HEAD/OPTIONS: generates a random token, sets it as `_csrf` cookie,
 * and exposes `csrfToken` + `csrfField` on the request for use in templates.
 *
 * On POST/PUT/DELETE/PATCH: validates that `_csrf` field in body matches
 * the `_csrf` cookie. Rejects with 403 if missing or mismatched.
 *
 * Usage: pipe: ['csrf']
 */
function csrfGuard() {
  return (request) => {
    const safeMethods = ['GET', 'HEAD', 'OPTIONS']

    if (safeMethods.includes(request.method)) {
      // Generate token for safe methods
      const token = randomBytes(32).toString('hex')

      // Set cookie (httpOnly: false so templates can read it, but we use the field approach)
      request.cookie('_csrf', token, {
        httpOnly: true,
        sameSite: 'Strict',
        path: '/',
      })

      // Expose token for templates
      request.csrfToken = token
      request.csrfField = `<input type="hidden" name="_csrf" value="${token}">`
      return { csrfToken: token, csrfField: request.csrfField }
    }

    // Unsafe methods — validate token
    const cookieToken = request.cookies._csrf
    const bodyToken = request.body?._csrf || request.headers['x-csrf-token']

    if (!cookieToken || !bodyToken) {
      throw new HttpError(403, 'CSRF token missing')
    }

    // Constant-time comparison
    const a = Buffer.from(String(cookieToken))
    const b = Buffer.from(String(bodyToken))
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new HttpError(403, 'CSRF token mismatch')
    }
  }
}

// ── Guard resolution ──

const BUILTIN = {
  auth: authGuard,
  role: roleGuard,
  rateLimit: rateLimitGuard,
  cors: corsGuard,
  logger: loggerGuard,
  compress: compressGuard,
  security: securityGuard,
  csrf: csrfGuard,
}

/**
 * Resolve a pipe string like 'auth' or 'role:admin' or 'rateLimit:100'
 * into an executable pipe function.
 *
 * Resolution order:
 *   1. Built-in guards (auth, role, rateLimit, cors, logger, compress, security)
 *   2. App-level custom guards (registered via app.addGuard)
 *   3. Global custom guards (registered via defineGuard)
 *   4. null (not found)
 *
 * @param {string} name
 * @param {Map} [appGuards] — app-level guard registry (optional)
 */
export function resolveGuard(name, appGuards) {
  const [guardName, ...paramParts] = name.split(':')
  const param = paramParts.join(':')

  // Built-in
  if (BUILTIN[guardName]) {
    return BUILTIN[guardName](param || undefined)
  }

  // App-level custom (checked first for per-app overrides)
  if (appGuards) {
    const appGuard = appGuards.get(guardName)
    if (appGuard) {
      return typeof appGuard === 'function'
        ? appGuard(param || undefined)
        : appGuard
    }
  }

  // Global custom
  const custom = _globalCustomGuards.get(guardName)
  if (custom) {
    return typeof custom === 'function'
      ? custom(param || undefined)
      : custom
  }

  return null
}

/**
 * List all available guard names (built-in + global custom + optional app-level)
 */
export function listGuards(appGuards) {
  return [
    ...Object.keys(BUILTIN),
    ...(appGuards ? appGuards.keys() : []),
    ..._globalCustomGuards.keys()
  ]
}
