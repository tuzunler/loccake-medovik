// ─────────────────────────────────────────────
// SpaceNode — Request Context (v2)
// ─────────────────────────────────────────────
// v2 changes:
//   - send() supports async compression (non-blocking)
//   - Improved multipart parser (unicode filenames, better boundary handling)
//   - Pluggable body parser (swap in busboy/formidable)
//   - Prototype pollution protection
//   - request._app reference for per-app features

import { HttpError } from './errors.js'
import { compressBuffer } from './guards.js'

// ── Pluggable body parser ──

let _customBodyParser = null

/**
 * Set a custom body parser (e.g. busboy-based).
 * Must return Promise<{ body, files }>.
 *
 *   setBodyParser(async (req, options) => {
 *     // Use busboy, formidable, etc.
 *     return { body: parsedFields, files: parsedFiles }
 *   })
 */
export function setBodyParser(parser) {
  _customBodyParser = parser
}

/**
 * Create the request object from raw Node.js req/res.
 *
 * @param {IncomingMessage} req — Node.js request
 * @param {ServerResponse} res — Node.js response
 * @param {object} options
 * @param {object} options.params — route params from trie router
 * @param {object} options.app — app reference (for db, config, events, auth)
 * @returns {object} request — the first handler argument
 */
// ── Fast URL parser (avoids heavy WHATWG new URL()) ──

function _fastParseUrl(rawUrl) {
  const qIdx = rawUrl.indexOf('?')
  if (qIdx === -1) return { pathname: rawUrl, query: {} }
  const pathname = rawUrl.substring(0, qIdx)
  const qs = rawUrl.substring(qIdx + 1)
  const query = Object.create(null)
  if (qs) {
    const pairs = qs.split('&')
    for (let i = 0; i < pairs.length; i++) {
      const pair = pairs[i]
      const eqIdx = pair.indexOf('=')
      if (eqIdx === -1) {
        const key = _tryDecode(pair)
        if (!_isDangerousKey(key)) query[key] = ''
      } else {
        const key = _tryDecode(pair.substring(0, eqIdx))
        if (!_isDangerousKey(key)) query[key] = _tryDecode(pair.substring(eqIdx + 1))
      }
    }
  }
  return { pathname, query }
}

function _tryDecode(s) {
  try { return decodeURIComponent(s) } catch { return s }
}

export function createRequest(req, res, { params = {}, app = {} } = {}) {
  const { pathname, query } = _fastParseUrl(req.url)

  // ── Parse incoming cookies (lazy — only if header exists) ──
  let _cookies = null
  const cookieHeader = req.headers.cookie
  function _parseCookies() {
    if (_cookies) return _cookies
    _cookies = {}
    if (cookieHeader) {
      const parts = cookieHeader.split(';')
      for (let i = 0; i < parts.length; i++) {
        const pair = parts[i]
        const eqIdx = pair.indexOf('=')
        if (eqIdx > 0) {
          const key = pair.substring(0, eqIdx).trim()
          if (_isDangerousKey(key)) continue
          const val = pair.substring(eqIdx + 1).trim()
          try { _cookies[key] = decodeURIComponent(val) } catch { _cookies[key] = val }
        }
      }
    }
    return _cookies
  }
  // Eagerly parse only if there's a cookie header (needed for flashes)
  const cookies = cookieHeader ? _parseCookies() : {}

  const request = {
    // ── Request data ──
    method: req.method,
    path: pathname,
    url: req.url,
    params,
    query,
    headers: req.headers,
    cookies,
    body: null,
    files: null,
    ip: (app.config?.trustProxy
        ? (req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress)
        : req.socket?.remoteAddress)
        || 'unknown',

    // ── App references ──
    db: app.db || null,
    config: app.config || {},
    _app: app,    // internal: full app reference for guards
    _req: req,
    _res: res,

    /** Raw Node.js req/res for streaming or advanced use. */
    raw: { req, res },
    _sent: false,
    _statusCode: 200,
    _compressEncoding: null, // set by compress guard

    // ── Utilities ──

    /**
     * Send JSON response (with optional async compression).
     *   send({ data })          → 200 + JSON
     *   send(201, { data })     → 201 + JSON
     *   send(204)               → 204 no content
     */
    send(statusOrData, data) {
      if (request._sent) return
      request._sent = true

      if (typeof statusOrData === 'number') {
        request._statusCode = statusOrData
        if (data === undefined || data === '') {
          res.writeHead(request._statusCode)
          res.end()
          return
        }
      } else {
        data = statusOrData
      }

      if (typeof data === 'string') {
        const buf = Buffer.from(data, 'utf8')
        _sendBuffer(request, res, buf, 'text/plain; charset=utf-8')
      } else {
        const json = JSON.stringify(data)
        const buf = Buffer.from(json, 'utf8')
        _sendBuffer(request, res, buf, 'application/json; charset=utf-8')
      }
    },

    /**
     * Assertion — if condition is falsy, throw HttpError.
     */
    check(condition, status = 400, message = 'Bad Request') {
      if (!condition) {
        throw new HttpError(status, message)
      }
      return condition
    },

    /**
     * Inverse assertion — if condition is truthy, throw HttpError.
     */
    guard(condition, status = 400, message = 'Bad Request') {
      if (condition) {
        throw new HttpError(status, message)
      }
    },

    /**
     * Throw an HttpError directly.
     */
    error(status = 500, message = 'Internal Server Error', details = null) {
      throw new HttpError(status, message, details)
    },

    /**
     * Emit an event through the app's event bus.
     */
    async emit(event, data) {
      if (app.events) {
        await app.events.emit(event, data)
      }
    },

    /**
     * Set a response header.
     */
    setHeader(key, value) {
      if (!request._sent) {
        res.setHeader(key, value)
      }
      return request
    },

    /**
     * Redirect to a URL.
     */
    redirect(url, status = 302) {
      if (request._sent) return
      request._sent = true
      request._statusCode = status
      res.writeHead(status, { Location: url })
      res.end()
    },

    /**
     * Send HTML response.
     */
    html(content, status = 200) {
      if (request._sent) return
      request._sent = true
      request._statusCode = status
      const buf = Buffer.from(content, 'utf8')
      _sendBuffer(request, res, buf, 'text/html; charset=utf-8')
    },

    /**
     * Render a view template and send HTML response.
     *   render('home')                 → render home.html with globals only
     *   render('home', { title: 'x' }) → render with data
     *   render('home', data, { layout: 'admin' }) → override layout
     */
    async render(template, data = {}, options = {}) {
      if (!app._viewEngine) {
        throw new Error('render() requires views to be enabled: createApp({ views: "./views" })')
      }
      // Auto-inject flash messages and CSRF token into template data
      const mergedData = { flashes: request.flashes, csrfToken: request.csrfToken, csrfField: request.csrfField, ...data }
      const html = await app._viewEngine.render(template, mergedData, options)
      request.html(html)
    },

    /**
     * Set a cookie.
     */
    cookie(name, value, options = {}) {
      const parts = [`${name}=${encodeURIComponent(value)}`]
      if (options.maxAge != null) parts.push(`Max-Age=${options.maxAge}`)
      parts.push(`Path=${options.path || '/'}`)
      if (options.domain) parts.push(`Domain=${options.domain}`)
      if (options.httpOnly !== false) parts.push('HttpOnly')
      if (options.secure) parts.push('Secure')
      parts.push(`SameSite=${options.sameSite || 'Lax'}`)
      const existing = res.getHeader('Set-Cookie') || []
      const cookies = Array.isArray(existing) ? existing : (existing ? [existing] : [])
      cookies.push(parts.join('; '))
      res.setHeader('Set-Cookie', cookies)
      return request
    },

    /**
     * Flash messages — survive exactly one redirect.
     *
     *   // Set:
     *   request.flash('success', 'Logged in!')
     *   request.flash('error', 'Wrong password')
     *
     *   // Read (next request, auto-cleared):
     *   request.flashes  → { success: ['Logged in!'], error: ['Wrong password'] }
     *
     * Flash data is base64-encoded in a `_flash` cookie.
     * On read, the cookie is immediately cleared.
     */
    flash(type, message) {
      if (!request._flashOut) request._flashOut = {}
      if (!request._flashOut[type]) request._flashOut[type] = []
      request._flashOut[type].push(message)
      // Write flash cookie (will be read on next request)
      const encoded = Buffer.from(JSON.stringify(request._flashOut)).toString('base64')
      request.cookie('_flash', encoded, { httpOnly: true, path: '/', sameSite: 'Lax' })
      return request
    },
  }

  // ── Parse incoming flash messages ──
  if (cookies._flash) {
    try {
      request.flashes = JSON.parse(Buffer.from(cookies._flash, 'base64').toString())
    } catch {
      request.flashes = {}
    }
    // Clear flash cookie immediately (one-time read)
    request.cookie('_flash', '', { maxAge: 0, path: '/' })
  } else {
    request.flashes = {}
  }

  return request
}

/**
 * Internal: send a buffer with optional async compression.
 * If compression is requested (via compress guard), compresses asynchronously.
 *
 * @param {object} request — framework request context
 * @param {ServerResponse} res — Node.js response
 * @param {Buffer} buf — response body buffer
 * @param {string} contentType — MIME type
 */
async function _sendBuffer(request, res, buf, contentType) {
  const encoding = request._compressEncoding
  const MIN_COMPRESS_SIZE = 150

  if (encoding && buf.length >= MIN_COMPRESS_SIZE) {
    try {
      const compressed = await compressBuffer(buf, encoding)
      res.writeHead(request._statusCode, {
        'Content-Type': contentType,
        'Content-Encoding': encoding,
        'Content-Length': compressed.length,
        'Vary': 'Accept-Encoding',
      })
      res.end(compressed)
    } catch {
      // Compression failed — fallback to uncompressed
      res.writeHead(request._statusCode, {
        'Content-Type': contentType,
        'Content-Length': buf.length,
      })
      res.end(buf)
    }
  } else {
    res.writeHead(request._statusCode, {
      'Content-Type': contentType,
      'Content-Length': buf.length,
    })
    res.end(buf)
  }
}

/**
 * Parse request body.
 *
 * Supported content types:
 *   - application/json → parsed JSON object
 *   - application/x-www-form-urlencoded → parsed key-value object
 *   - multipart/form-data → { fields, files }
 *
 * If a custom body parser is set via setBodyParser(), it is used instead.
 *
 * @param {IncomingMessage} req
 * @param {object} [options]
 * @param {number} [options.bodyLimit] — max body in bytes (default 1MB)
 * @returns {Promise<{ body: object|null, files: Array|null }>}
 */
// Pre-allocated result for GET/HEAD/OPTIONS — avoids Promise creation
const _EMPTY_BODY = Object.freeze({ body: null, files: null })

export function parseBody(req, options = {}) {
  // Fast path: skip body parsing entirely for bodyless methods
  const m = req.method
  if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') {
    return _EMPTY_BODY
  }

  // Use custom body parser if set
  if (_customBodyParser) {
    return _customBodyParser(req, options)
  }

  return new Promise((resolve, reject) => {

    const contentType = req.headers['content-type'] || ''
    const maxSize = options.bodyLimit || 1024 * 1024 // default 1MB

    const chunks = []
    let size = 0
    let destroyed = false

    req.on('data', chunk => {
      if (destroyed) return
      size += chunk.length
      if (size > maxSize) {
        destroyed = true
        req.destroy()
        reject(new HttpError(413, `Request body too large (max ${Math.round(maxSize / 1024)}KB)`))
        return
      }
      chunks.push(chunk)
    })

    req.on('end', () => {
      if (destroyed) return
      const raw = Buffer.concat(chunks)

      // ── JSON ──
      if (contentType.includes('application/json') || (!contentType && raw.length > 0)) {
        const str = raw.toString()
        if (!str || str.trim() === '') return resolve({ body: null, files: null })
        try {
          return resolve({ body: JSON.parse(str), files: null })
        } catch {
          return reject(new HttpError(400, 'Invalid JSON in request body'))
        }
      }

      // ── URL-encoded form ──
      if (contentType.includes('application/x-www-form-urlencoded')) {
        const str = raw.toString()
        if (!str || str.trim() === '') return resolve({ body: {}, files: null })
        const body = _safeFromEntries(new URLSearchParams(str))
        return resolve({ body, files: null })
      }

      // ── Multipart form-data ──
      if (contentType.includes('multipart/form-data')) {
        try {
          const result = _parseMultipart(raw, contentType)
          return resolve(result)
        } catch (err) {
          return reject(new HttpError(400, `Multipart parse error: ${err.message}`))
        }
      }

      // ── Plain text / other ──
      if (raw.length > 0) {
        return resolve({ body: raw.toString(), files: null })
      }

      resolve({ body: null, files: null })
    })

    req.on('error', (err) => {
      if (!destroyed) reject(err)
    })
  })
}


// ── Multipart parser (RFC 2046, improved) ──

function _parseMultipart(buf, contentType) {
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^\s;]+))/)
  if (!boundaryMatch) throw new Error('Missing boundary in multipart Content-Type')

  const boundary = boundaryMatch[1] || boundaryMatch[2]
  const delimiter = Buffer.from(`--${boundary}`)

  const fields = Object.create(null)
  const files = []

  // Split buffer by boundary
  let pos = _indexOf(buf, delimiter, 0)
  if (pos === -1) throw new Error('No boundary found in body')
  pos += delimiter.length

  while (pos < buf.length) {
    // Skip CRLF after delimiter
    if (buf[pos] === 0x0D && buf[pos + 1] === 0x0A) pos += 2
    else if (buf[pos] === 0x0A) pos += 1

    // Check for closing boundary (-- after boundary)
    if (buf[pos] === 0x2D && buf[pos + 1] === 0x2D) break

    // Find next boundary
    const nextBoundary = _indexOf(buf, delimiter, pos)
    if (nextBoundary === -1) break

    const part = buf.subarray(pos, nextBoundary)

    // Split headers and body at \r\n\r\n or \n\n
    let headerEnd = _indexOf(part, Buffer.from('\r\n\r\n'), 0)
    let headerSepLen = 4
    if (headerEnd === -1) {
      headerEnd = _indexOf(part, Buffer.from('\n\n'), 0)
      headerSepLen = 2
    }
    if (headerEnd === -1) { pos = nextBoundary + delimiter.length; continue }

    const headerStr = part.subarray(0, headerEnd).toString()
    // Body: strip trailing \r\n before boundary
    let body = part.subarray(headerEnd + headerSepLen)
    if (body.length >= 2 && body[body.length - 2] === 0x0D && body[body.length - 1] === 0x0A) {
      body = body.subarray(0, body.length - 2)
    } else if (body.length >= 1 && body[body.length - 1] === 0x0A) {
      body = body.subarray(0, body.length - 1)
    }

    // Parse part headers
    const disposition = headerStr.match(/Content-Disposition:\s*form-data;\s*(.*)/i)
    if (!disposition) { pos = nextBoundary + delimiter.length; continue }

    const nameMatch = disposition[1].match(/\bname="([^"]*)"/)
    const filenameMatch = disposition[1].match(/\bfilename="([^"]*)"/)
    // RFC 5987: filename*=UTF-8''encoded-name
    const filenameStar = disposition[1].match(/\bfilename\*=(?:UTF-8|utf-8)''(.+?)(?:;|$)/)
    const ctMatch = headerStr.match(/Content-Type:\s*(.+)/i)

    let filename = null
    if (filenameStar) {
      try { filename = decodeURIComponent(filenameStar[1].trim()) } catch { filename = filenameStar[1].trim() }
    } else if (filenameMatch) {
      filename = filenameMatch[1]
    }

    if (filename !== null) {
      files.push({
        fieldname: nameMatch ? nameMatch[1] : 'file',
        filename,
        mimetype: ctMatch ? ctMatch[1].trim() : 'application/octet-stream',
        data: Buffer.from(body), // Copy to avoid subarray reference issues
        size: body.length,
      })
    } else if (nameMatch && !_isDangerousKey(nameMatch[1])) {
      fields[nameMatch[1]] = body.toString()
    }

    pos = nextBoundary + delimiter.length
  }

  return { body: fields, files: files.length > 0 ? files : null }
}

// ── Prototype pollution protection ──

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

function _isDangerousKey(key) {
  return DANGEROUS_KEYS.has(key)
}

function _safeFromEntries(entries) {
  const obj = Object.create(null)
  for (const [key, value] of entries) {
    if (!_isDangerousKey(key)) {
      obj[key] = value
    }
  }
  return obj
}

function _indexOf(buf, needle, from) {
  for (let i = from; i <= buf.length - needle.length; i++) {
    let found = true
    for (let j = 0; j < needle.length; j++) {
      if (buf[i + j] !== needle[j]) { found = false; break }
    }
    if (found) return i
  }
  return -1
}
