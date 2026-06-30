// ─────────────────────────────────────────────
// SpaceNode — Application Core (v1.0.0)
// ─────────────────────────────────────────────
//   - Static files: LRU cache, ETag, 304 Not Modified, streaming large files
//   - WebSocket: fragment assembly, ping/pong heartbeat, backpressure
//   - Error handling: structured logging, no swallowed errors
//   - Module lifecycle: onInit/onDestroy hooks
//   - Per-app auth & guards (not just global)
//   - Graceful shutdown with process signal handling
//   - Programmatic module support via addModule()

import http from 'node:http'
import { existsSync } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import { Readable } from 'node:stream'
import { createHash } from 'node:crypto'
import { Router } from './router.js'
import { createRequest, parseBody, setBodyParser } from './context.js'
import { HttpError } from './errors.js'
import { Logger } from './errors.js'
import { EventBus } from './events.js'
import { Container } from './container.js'
import { loadAllModules, buildRoutes, resolvePipes, createModule } from './loader.js'
import { runPipeline, runAfterHooks } from './pipeline.js'
import { generateOpenAPISpec } from './openapi.js'
import { ViewEngine, loadViewSettings } from './views.js'

import { dirname, join, resolve, isAbsolute, extname, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

// ── Static file MIME types ──

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.otf':  'font/otf',
  '.eot':  'application/vnd.ms-fontobject',
  '.mp4':  'video/mp4',
  '.webm': 'video/webm',
  '.mp3':  'audio/mpeg',
  '.ogg':  'audio/ogg',
  '.wav':  'audio/wav',
  '.pdf':  'application/pdf',
  '.zip':  'application/zip',
  '.wasm': 'application/wasm',
  '.xml':  'application/xml',
  '.txt':  'text/plain; charset=utf-8',
  '.map':  'application/json',
}

/**
 * Resolve a path relative to a module's import.meta.url.
 */
export function dir(importMetaUrl, ...paths) {
  const __dirname = dirname(fileURLToPath(importMetaUrl))
  return join(__dirname, ...paths)
}

/**
 * Resolve a relative path from the entry script's directory.
 */
function resolveFromEntry(relPath) {
  if (isAbsolute(relPath)) return relPath
  const entryDir = dirname(resolve(process.argv[1]))
  return join(entryDir, relPath)
}

const resolveModulesDir = resolveFromEntry
const resolveStaticDir  = resolveFromEntry


// ── LRU Static File Cache ──

class StaticCache {
  /**
   * @param {number} maxEntries — max cached files
   * @param {number} maxFileSize — max individual file size to cache (bytes)
   */
  constructor(maxEntries = 500, maxFileSize = 256 * 1024) {
    this._map = new Map()
    this._maxEntries = maxEntries
    this._maxFileSize = maxFileSize
  }

  get(key) {
    const entry = this._map.get(key)
    if (!entry) return null
    // Move to end (most recently used)
    this._map.delete(key)
    this._map.set(key, entry)
    return entry
  }

  set(key, value) {
    if (this._map.has(key)) this._map.delete(key)
    this._map.set(key, value)
    // Evict oldest entries
    while (this._map.size > this._maxEntries) {
      const first = this._map.keys().next().value
      this._map.delete(first)
    }
  }

  clear() { this._map.clear() }
}


class SuperApp {
  constructor(config = {}) {
    this.router = new Router()
    this.config = config
    this.db = config.db || null
    this.events = new EventBus()
    this.container = new Container()
    this._modules = []
    this._routeMeta = []
    this._globalPipes = []
    this._server = null
    this._onErrorHandlers = []
    this._staticDir = null
    this._staticCache = new StaticCache(
      config.staticCacheMax || 500,
      config.staticCacheFileSize || 256 * 1024
    )
    this._spa = false
    this._openApiSpec = null
    this._wsHandlers = new Map()
    this._wsClients = new Set()
    this.debug = config.debug || false

    // Per-app auth & guards
    this._authVerifier = null
    this._appGuards = new Map()
    this._rateLimitStore = null

    // Structured logger
    this._logger = new Logger({
      level: this.debug ? 'debug' : 'info',
      ...(config.logger || {}),
    })

    if (this.debug) {
      this.events.debug = true
    }

    // Module lifecycle tracking
    this._moduleDestroyHooks = []

    // View engine (initialized in createApp when config.views is set)
    this._viewEngine = null
  }

  /**
   * Set database reference accessible as request.db
   */
  setDb(db) {
    this.db = db
    return this
  }

  /**
   * Set per-app auth verifier (takes precedence over global defineAuth).
   *
   *   app.setAuth(async (token, request) => {
   *     const user = await User.findByToken(token)
   *     return user || null
   *   })
   */
  setAuth(verifier) {
    if (typeof verifier !== 'function') {
      throw new Error('setAuth() requires a function: (token, request?) => user | null')
    }
    this._authVerifier = verifier
    return this
  }

  /**
   * Register a per-app named guard (takes precedence over global defineGuard).
   *
   *   app.addGuard('premium', (params) => (request, services) => {
   *     if (!request.user?.isPremium) throw new HttpError(403, 'Premium required')
   *   })
   */
  addGuard(name, factory) {
    this._appGuards.set(name, factory)
    return this
  }

  /**
   * Set a custom rate limit store (for Redis, etc.)
   * Must implement: get(key), set(key, value), delete(key), has(key)
   *
   *   app.setRateLimitStore(redisRateLimitStore)
   */
  setRateLimitStore(store) {
    this._rateLimitStore = store
    return this
  }

  /**
   * Set a custom body parser (e.g. busboy-based).
   */
  setBodyParser(parser) {
    setBodyParser(parser)
    return this
  }

  /**
   * Register a global error handler.
   */
  onError(fn) {
    this._onErrorHandlers.push(fn)
    return this
  }

  // ── Programmatic module registration ──

  /**
   * Add a module programmatically (without file system).
   *
   *   app.addModule({
   *     name: 'health',
   *     prefix: '/health',
   *     routes: [['GET', '/', 'check']],
   *     controllers: { check: ({ send }) => send({ ok: true }) },
   *   })
   */
  addModule(definition) {
    const mod = createModule(definition)

    // Check for duplicate name
    if (this._modules.some(m => m.name === mod.name)) {
      throw new Error(`Duplicate module name: "${mod.name}". Each module must have a unique name.`)
    }
    // Check for duplicate prefix
    if (this._modules.some(m => m.config.prefix === mod.config.prefix)) {
      throw new Error(`Duplicate module prefix: "${mod.config.prefix}" (module "${mod.name}"). Each module must have a unique prefix.`)
    }

    this._modules.push(mod)

    // Register services
    for (const [name, service] of Object.entries(mod.services)) {
      this._registerModuleService(mod, name, service)
    }

    // Build and register routes
    const routes = buildRoutes(mod, this._appGuards)
    for (const route of routes) {
      this.router.add(route.method, route.path, route.handler, {
        meta: { _pipes: route.pipes, module: route.module }
      })
      this._routeMeta.push({
        method: route.method,
        path: route.path,
        module: route.module,
        handler: route.handler,
        openapi: route.openapi,
        pipeNames: route.pipeNames,
        dtoSchema: route.dtoSchema,
      })
    }

    // Invalidate cached OpenAPI spec
    this._openApiSpec = null

    return this
  }

  /** @private Register a module's service with optional namespacing */
  _registerModuleService(mod, name, service) {
    const namespacedName = `${mod.name}.${name}`

    // Module isolation: if isolated, only register namespaced
    if (mod.config.isolated) {
      this.container.register(namespacedName, service)
      return
    }

    // Throw on collision — duplicate service names are a configuration error
    if (this.container.has(name)) {
      throw new Error(
        `Service "${name}" conflict: module "${mod.name}" registers a service that already exists. ` +
        `Rename it, use module isolation (isolated: true), or access via "${namespacedName}".`
      )
    }

    this.container.register(name, service)
    this.container.register(namespacedName, service)
  }

  // ── View helpers ──

  /**
   * Register a custom template helper function.
   *   app.addHelper('upper', (v) => v.toUpperCase())
   */
  addHelper(name, fn) {
    if (!this._viewEngine) {
      throw new Error('addHelper() requires views to be enabled: createApp({ views: "./views" })')
    }
    this._viewEngine.addHelper(name, fn)
    return this
  }

  /**
   * Register a programmatic view route.
   *
   *   app.render('GET', '/about', 'about')               // static data from globals
   *   app.render('GET', '/about', 'about', { year: 2025 }) // static data
   *   app.render('GET', '/users', 'users', async (req, s) => ({ users: await s.userService.all() }))
   *   app.render('GET', '/users', 'users', ['auth'], async (req, s) => ({ ... }))
   *   app.render('GET', '/page', 'page', { ... }, { layout: 'admin' })
   */
  render(method, path, template, dataOrPipesOrOpts, dataFnOrOpts, opts) {
    if (!this._viewEngine) {
      throw new Error('render() requires views to be enabled: createApp({ views: "./views" })')
    }

    let pipeNames = []
    let dataFn = null
    let options = {}

    if (Array.isArray(dataOrPipesOrOpts)) {
      // app.render(method, path, template, pipes, dataFn?, opts?)
      pipeNames = dataOrPipesOrOpts
      if (typeof dataFnOrOpts === 'function') {
        dataFn = dataFnOrOpts
        options = opts || {}
      } else {
        options = dataFnOrOpts || {}
      }
    } else if (typeof dataOrPipesOrOpts === 'function') {
      // app.render(method, path, template, dataFn, opts?)
      dataFn = dataOrPipesOrOpts
      options = dataFnOrOpts || {}
    } else if (typeof dataOrPipesOrOpts === 'object' && dataOrPipesOrOpts !== null) {
      // app.render(method, path, template, staticData, opts?)
      const staticData = dataOrPipesOrOpts
      dataFn = () => staticData
      options = dataFnOrOpts || {}
    } else {
      // app.render(method, path, template) — no data
      options = {}
    }

    const engine = this._viewEngine
    const renderOptions = { layout: options.layout }

    const handler = async (request, services) => {
      const data = dataFn ? await dataFn(request, services) : {}
      const mergedData = { flashes: request.flashes, csrfToken: request.csrfToken, csrfField: request.csrfField, ...data }
      const html = await engine.render(template, mergedData, renderOptions)
      request.html(html)
    }

    return this.setRoute(method.toUpperCase(), path, handler, pipeNames)
  }

  // ── Imperative route registration ──

  setRoute(method, path, handler, pipeNames = []) {
    if (typeof handler !== 'function') {
      throw new Error(`setRoute: handler must be a function, got ${typeof handler}`)
    }
    const pipes = resolvePipes(pipeNames, {}, this._appGuards)
    this.router.add(method.toUpperCase(), path, handler, {
      meta: { _pipes: pipes, module: '_imperative' }
    })
    this._openApiSpec = null
    this._routeMeta.push({
      method: method.toUpperCase(),
      path,
      module: '_imperative',
      handler,
      openapi: null,
      pipeNames,
      dtoSchema: null,
    })
    return this
  }

  // ── Inject (testing without server) ──

  async inject({ method = 'GET', url = '/', headers = {}, body = null } = {}) {
    return new Promise((resolveInject) => {
      const bodyStr = body && typeof body !== 'string' ? JSON.stringify(body) : (body || '')
      const reqHeaders = { ...headers }
      if (body && !reqHeaders['content-type']) {
        reqHeaders['content-type'] = 'application/json'
      }
      if (!reqHeaders.host) reqHeaders.host = 'localhost'

      const readable = new Readable({ read() {} })
      readable.method = method.toUpperCase()
      readable.url = url
      readable.headers = Object.fromEntries(
        Object.entries(reqHeaders).map(([k, v]) => [k.toLowerCase(), v])
      )
      readable.socket = { remoteAddress: '127.0.0.1' }
      readable.connection = readable.socket

      const resChunks = []
      let resStatusCode = 200
      let resHeaders = {}

      const fakeRes = {
        writableEnded: false,
        writeHead(status, hdrs) {
          resStatusCode = status
          if (hdrs) Object.assign(resHeaders, hdrs)
        },
        setHeader(key, value) {
          resHeaders[key] = value
        },
        getHeader(key) {
          return resHeaders[key]
        },
        end(data) {
          if (data) resChunks.push(typeof data === 'string' ? Buffer.from(data) : data)
          fakeRes.writableEnded = true
          const bodyBuf = Buffer.concat(resChunks)
          const bodyStr = bodyBuf.toString()
          let json = null
          try { json = JSON.parse(bodyStr) } catch {}
          resolveInject({
            statusCode: resStatusCode,
            headers: resHeaders,
            body: bodyStr,
            json,
          })
        },
        write(chunk) {
          resChunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
        },
      }

      this._handleRequest(readable, fakeRes)

      if (bodyStr && !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase())) {
        readable.push(Buffer.from(bodyStr))
      }
      readable.push(null)
    })
  }

  // ── WebSocket support ──

  ws(path, handler) {
    this._wsHandlers.set(path, handler)
    return this
  }

  /**
   * Raw request handler for serverless platforms.
   */
  handle(req, res) {
    return this._handleRequest(req, res)
  }

  // ── Static file serving (cache, ETag, 304, streaming) ──

  async _serveStatic(urlPath, req, res) {
    if (!this._staticDir) return false

    const decoded = decodeURIComponent(urlPath)
    const safePath = normalize(decoded).replace(/^\.\.([\/\\]|$)/g, '')
    const filePath = resolve(join(this._staticDir, safePath))
    if (!filePath.startsWith(resolve(this._staticDir))) return false

    // Check cache first
    const cached = this._staticCache.get(filePath)
    if (cached) {
      // ETag / 304
      if (req.headers['if-none-match'] === cached.etag) {
        res.writeHead(304)
        res.end()
        return true
      }
      res.writeHead(200, {
        'Content-Type': cached.mime,
        'Content-Length': cached.content.length,
        'ETag': cached.etag,
        'Cache-Control': cached.cache,
      })
      res.end(cached.content)
      return true
    }

    try {
      const fileStat = await stat(filePath)
      if (!fileStat.isFile()) return false

      const ext = extname(filePath).toLowerCase()
      const mime = MIME_TYPES[ext] || 'application/octet-stream'
      const isFont = ext === '.woff2' || ext === '.woff' || ext === '.ttf'
      const cacheControl = isFont ? 'public, max-age=31536000, immutable'
                                  : 'public, max-age=3600'

      // Large files → stream (don't cache)
      if (fileStat.size > this._staticCache._maxFileSize) {
        const weakEtag = `W/"${fileStat.size.toString(16)}-${fileStat.mtimeMs.toString(16)}"`
        if (req.headers['if-none-match'] === weakEtag) {
          res.writeHead(304)
          res.end()
          return true
        }
        res.writeHead(200, {
          'Content-Type': mime,
          'Content-Length': fileStat.size,
          'ETag': weakEtag,
          'Cache-Control': cacheControl,
        })
        createReadStream(filePath).pipe(res)
        return true
      }

      // Small files → read, cache, serve
      const content = await readFile(filePath)
      const etag = `"${createHash('md5').update(content).digest('hex')}"`

      this._staticCache.set(filePath, { content, mime, etag, cache: cacheControl })

      if (req.headers['if-none-match'] === etag) {
        res.writeHead(304)
        res.end()
        return true
      }

      res.writeHead(200, {
        'Content-Type': mime,
        'Content-Length': content.length,
        'ETag': etag,
        'Cache-Control': cacheControl,
      })
      res.end(content)
      return true
    } catch {
      return false
    }
  }

  /**
   * Serve a custom 404 page or JSON fallback.
   */
  async _serve404(res) {
    if (this._staticDir) {
      const page404 = join(this._staticDir, '404.html')
      try {
        const content = await readFile(page404)
        res.writeHead(404, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache',
        })
        res.end(content)
        return
      } catch {
        // 404.html not found — fall through to JSON
      }
    }
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Not found' }))
  }

  // ── Request handling ──

  async _handleRequest(req, res) {
    // Default headers
    res.setHeader('X-Powered-By', 'SpaceNode')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('X-Frame-Options', 'DENY')

    const urlPath = req.url.split('?')[0]

    // ── HEAD → treat as GET for routing, suppress body at the end ──
    const isHead = req.method === 'HEAD'
    const effectiveMethod = isHead ? 'GET' : req.method

    // For HEAD requests, suppress response body but keep headers/status
    if (isHead) {
      const _origEnd = res.end.bind(res)
      const _origWrite = res.write.bind(res)
      res.write = () => true
      res.end = (data) => _origEnd()
    }

    // ── Static files ──
    if (this._staticDir && (effectiveMethod === 'GET')) {
      const ext = extname(urlPath)

      if (this._spa) {
        if (ext && ext !== '.html') {
          const served = await this._serveStatic(urlPath, req, res)
          if (served) return
        }
      } else {
        if (ext) {
          const served = await this._serveStatic(urlPath, req, res)
          if (served) return
        }
        if (!ext) {
          const served = await this._serveStatic(urlPath + '.html', req, res)
                       || await this._serveStatic(urlPath + '/index.html', req, res)
          if (served) return
        }
      }
    }

    // ── OpenAPI endpoint ──
    if (urlPath === '/openapi.json' && req.method === 'GET' && this.config.openapi) {
      const spec = this._getOpenAPISpec()
      const json = JSON.stringify(spec, null, 2)
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Content-Length': Buffer.byteLength(json),
      })
      res.end(json)
      return
    }

    // Find route in trie (HEAD falls back to GET)
    let match
    try {
      match = this.router.find(req.method, urlPath)
      if (!match && isHead) {
        match = this.router.find('GET', urlPath)
      }
    } catch (routeErr) {
      this._logger.error('Route matching error:', routeErr)
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Bad request' }))
      return
    }

    if (!match) {
      if (this._staticDir && this._spa && effectiveMethod === 'GET') {
        const served = await this._serveStatic('index.html', req, res)
        if (served) return
      }
      await this._serve404(res)
      return
    }

    if (match.methodNotAllowed) {
      res.writeHead(405, {
        'Content-Type': 'application/json',
        'Allow': match.allowedMethods.join(', ')
      })
      res.end(JSON.stringify({ error: 'Method not allowed' }))
      return
    }

    // Create request context
    const request = createRequest(req, res, {
      params: match.params,
      app: this,
    })

    let afterHooks = []
    let statusCode = 200
    const services = this.container.getAll()

    try {
      // Parse body
      const bodyLimit = this.config.bodyLimit || undefined
      const parsed = await parseBody(req, { bodyLimit })
      request.body = parsed.body
      request.files = parsed.files

      // Run pipeline (global pipes + route pipes)
      const allPipes = this._globalPipes.length
        ? [...this._globalPipes, ...(match.meta._pipes || [])]
        : (match.meta._pipes || [])
      afterHooks = await runPipeline(allPipes, request, services)

      if (request._sent) {
        statusCode = request._statusCode
        await runAfterHooks(afterHooks, statusCode, this._logger)
        return
      }

      // Execute handler
      await match.handler(request, services)

      statusCode = request._statusCode

      // Auto-send 204 if handler didn't respond
      if (!request._sent) {
        res.writeHead(204)
        res.end()
        request._statusCode = 204
        statusCode = 204
      }

    } catch (err) {
      try {
        statusCode = this._handleError(err, request, res)
      } catch (fatalErr) {
        this._logger.error('Fatal error in error handler:', fatalErr)
        if (!res.writableEnded) {
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Internal Server Error' }))
        }
        statusCode = 500
      }
    }

    // Run after-hooks
    await runAfterHooks(afterHooks, statusCode, this._logger)
  }

  _handleError(err, request, res) {
    // Custom error handlers
    for (const handler of this._onErrorHandlers) {
      try {
        handler(err, request)
        if (request?._sent) return err.status || 500
      } catch (handlerErr) {
        // Don't swallow — log it
        this._logger.error('Error in custom error handler:', handlerErr)
      }
    }

    // Known HTTP errors
    if (err instanceof HttpError) {
      if (!request?._sent) {
        res.writeHead(err.status, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(err.toJSON()))
      }
      return err.status
    }

    // Unknown errors — always log with full context
    this._logger.error(`Unhandled error: ${err.message}`, {
      stack: err.stack,
      method: request?.method,
      path: request?.path,
    })

    if (!request?._sent) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        error: 'Internal Server Error',
        ...(this.debug ? { message: err.message, stack: err.stack } : {})
      }))
    }
    return 500
  }

  // ── Server ──

  listen(port, callback) {
    // Watch mode: parent process becomes a lightweight file watcher,
    // child process runs the actual server. Zero overhead on the hot path.
    if (this.config.watch && !process.env.SPACENODE_CHILD) {
      _startWatcher(port)
      return this
    }

    this._server = http.createServer((req, res) => this._handleRequest(req, res))

    this._server.on('error', (err) => {
      this._logger.error('Server error:', err)
    })

    // WebSocket upgrade handling
    if (this._wsHandlers.size > 0) {
      this._setupWebSocket(this._server)
    }

    // Production timeouts
    const timeout = this.config.timeout || 30_000
    this._server.timeout = timeout
    this._server.keepAliveTimeout = this.config.keepAliveTimeout || 5_000
    this._server.headersTimeout = timeout + 1_000

    this._server.listen(port, () => {
      const routeList = this.router.listRoutes()
      const logo = `
  ═══════════════════════════════════════
           ⚡ SpaceNode v1.0.0          
  ═══════════════════════════════════════
    Port:     ${String(port).padEnd(27)}
    Modules:  ${String(this._modules.length).padEnd(27)}
    Routes:   ${String(routeList.length).padEnd(27)}
    Services: ${String(this.container.list().length).padEnd(27)}
  ═══════════════════════════════════════`
      console.log(logo)

      for (const r of routeList) {
        console.log(`  ${r.method.padEnd(7)} ${r.path}`)
      }

      if (callback) callback(this)
    })

    // Graceful shutdown on process signals
    this._setupGracefulShutdown()

    return this
  }

  /**
   * Gracefully shut down the server and run module onDestroy hooks.
   */
  async close(callback) {
    if (!this._server) {
      if (callback) callback()
      return this
    }

    this._logger.info('Shutting down...')

    // Run module onDestroy hooks
    for (const destroyFn of this._moduleDestroyHooks) {
      try {
        await destroyFn()
      } catch (err) {
        this._logger.error('Module onDestroy error:', err)
      }
    }

    // Close WebSocket connections
    for (const ws of this._wsClients) {
      try { ws.close(1001) } catch {}
    }
    this._wsClients.clear()

    // Clean up event bus
    this.events.destroy()

    // Close HTTP server
    this._server.close(() => {
      this._logger.info('Server closed.')
      if (callback) callback()
    })

    // Force-close idle connections after grace period
    const grace = this.config.shutdownTimeout || 5_000
    if (typeof this._server.closeAllConnections === 'function') {
      setTimeout(() => this._server.closeAllConnections(), grace).unref()
    }

    return this
  }

  /** @private */
  _setupGracefulShutdown() {
    const shutdown = () => {
      this.close(() => process.exit(0))
    }
    process.once('SIGTERM', shutdown)
    process.once('SIGINT', shutdown)
  }

  info() {
    return {
      modules: this._modules.map(m => m.name),
      routes: this.router.listRoutes(),
      services: this.container.list(),
      events: this.events.listEvents(),
    }
  }

  _getOpenAPISpec() {
    if (!this._openApiSpec) {
      this._openApiSpec = generateOpenAPISpec({
        modules: this._modules,
        routes: this._routeMeta,
        config: typeof this.config.openapi === 'object' ? this.config.openapi : {},
      })
    }
    return this._openApiSpec
  }

  // ── WebSocket (fragments, heartbeat, backpressure) ──

  _setupWebSocket(server) {
    server.on('upgrade', (req, socket, head) => {
      const urlPath = req.url.split('?')[0]
      const handler = this._wsHandlers.get(urlPath)

      if (!handler) {
        socket.write('HTTP/1.1 404 Not Found\r\n\r\n')
        socket.destroy()
        return
      }

      // Validate Origin header
      const origin = req.headers.origin
      const allowedOrigins = this.config.wsOrigins || null
      if (allowedOrigins) {
        const origins = Array.isArray(allowedOrigins) ? allowedOrigins : [allowedOrigins]
        if (origin && !origins.includes(origin) && !origins.includes('*')) {
          socket.write('HTTP/1.1 403 Forbidden\r\n\r\n')
          socket.destroy()
          return
        }
      }

      // WebSocket handshake
      const key = req.headers['sec-websocket-key']
      if (!key) {
        socket.write('HTTP/1.1 400 Bad Request\r\n\r\n')
        socket.destroy()
        return
      }

      const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'
      const acceptKey = createHash('sha1').update(key + GUID).digest('base64')

      socket.write(
        'HTTP/1.1 101 Switching Protocols\r\n' +
        'Upgrade: websocket\r\n' +
        'Connection: Upgrade\r\n' +
        `Sec-WebSocket-Accept: ${acceptKey}\r\n\r\n`
      )

      const ws = this._createWsWrapper(socket)
      this._wsClients.add(ws)
      ws.on('close', () => this._wsClients.delete(ws))

      // Pass services to WebSocket handlers for DI integration
      const services = this.container.getAll()
      handler(ws, req, services)
    })
  }

  _createWsWrapper(socket) {
    const listeners = { message: [], close: [], error: [], ping: [], pong: [] }

    // Fragment assembly state
    let fragmentBuffer = []
    let fragmentOpcode = null
    let fragmentSize = 0
    const maxMessageSize = this.config.wsMaxMessageSize || 1_048_576 // 1 MB

    const ws = {
      readyState: 1, // OPEN

      /**
       * Send data. Returns false if backpressure (buffer full).
       */
      send(data) {
        if (ws.readyState !== 1) return false
        const payload = typeof data === 'string' ? Buffer.from(data) : data
        const frame = _encodeWsFrame(payload, typeof data === 'string' ? 0x01 : 0x02)
        try {
          return socket.write(frame)
        } catch {
          return false
        }
      },

      close(code = 1000) {
        if (ws.readyState !== 1) return
        ws.readyState = 2 // CLOSING
        const buf = Buffer.alloc(2)
        buf.writeUInt16BE(code, 0)
        try { socket.write(_encodeWsFrame(buf, 0x08)) } catch {}
        socket.end()
        ws.readyState = 3 // CLOSED
      },

      on(event, fn) {
        if (listeners[event]) listeners[event].push(fn)
        return ws
      },

      /**
       * Pause receiving data (for backpressure from consumer side).
       */
      pause() { socket.pause() },
      resume() { socket.resume() },
    }

    // ── Ping/Pong heartbeat ──
    let lastPong = Date.now()
    const heartbeatInterval = setInterval(() => {
      if (ws.readyState !== 1) {
        clearInterval(heartbeatInterval)
        return
      }
      // Check if client is alive (no pong in 60s → dead)
      if (Date.now() - lastPong > 60_000) {
        ws.close(1001) // Going Away
        clearInterval(heartbeatInterval)
        return
      }
      try {
        socket.write(_encodeWsFrame(Buffer.alloc(0), 0x09)) // Ping
      } catch {}
    }, 30_000)
    heartbeatInterval.unref()

    // ── Parse incoming frames (with fragment assembly) ──
    let buffer = Buffer.alloc(0)

    socket.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk])
      while (buffer.length >= 2) {
        const result = _decodeWsFrame(buffer)
        if (!result) break
        buffer = result.rest

        const { opcode, payload, fin } = result

        // Close frame
        if (opcode === 0x08) {
          clearInterval(heartbeatInterval)
          ws.readyState = 3
          for (const fn of listeners.close) fn()
          socket.end()
          return
        }

        // Ping → respond with Pong
        if (opcode === 0x09) {
          try { socket.write(_encodeWsFrame(payload, 0x0A)) } catch {}
          for (const fn of listeners.ping) fn(payload)
          continue
        }

        // Pong → update heartbeat timestamp
        if (opcode === 0x0A) {
          lastPong = Date.now()
          for (const fn of listeners.pong) fn(payload)
          continue
        }

        // ── Fragment assembly ──
        if (opcode !== 0x00 && !fin) {
          // First fragment (FIN=0, opcode != 0)
          fragmentOpcode = opcode
          fragmentBuffer = [payload]
          fragmentSize = payload.length
          if (fragmentSize > maxMessageSize) {
            ws.close(1009) // Message Too Big
            return
          }
          continue
        }

        if (opcode === 0x00) {
          // Continuation frame
          fragmentSize += payload.length
          if (fragmentSize > maxMessageSize) {
            fragmentBuffer = []
            fragmentSize = 0
            fragmentOpcode = null
            ws.close(1009) // Message Too Big
            return
          }
          fragmentBuffer.push(payload)
          if (!fin) continue // More fragments coming

          // Final fragment — assemble
          const assembled = Buffer.concat(fragmentBuffer)
          fragmentBuffer = []
          fragmentSize = 0
          const finalOpcode = fragmentOpcode
          fragmentOpcode = null

          const msg = finalOpcode === 0x01 ? assembled.toString() : assembled
          for (const fn of listeners.message) fn(msg)
          continue
        }

        // Regular single-frame message (FIN=1, opcode=1 or 2)
        if (opcode === 0x01 || opcode === 0x02) {
          const msg = opcode === 0x01 ? payload.toString() : payload
          for (const fn of listeners.message) fn(msg)
        }
      }
    })

    socket.on('close', () => {
      clearInterval(heartbeatInterval)
      ws.readyState = 3
      for (const fn of listeners.close) fn()
    })

    socket.on('error', (err) => {
      clearInterval(heartbeatInterval)
      for (const fn of listeners.error) fn(err)
    })

    // Backpressure: expose drain event
    socket.on('drain', () => {
      // socket is ready for more writes
    })

    return ws
  }
}


// ── WebSocket frame helpers (RFC 6455) ──

function _encodeWsFrame(payload, opcode) {
  const len = payload.length
  let header
  if (len < 126) {
    header = Buffer.alloc(2)
    header[0] = 0x80 | opcode  // FIN + opcode
    header[1] = len
  } else if (len < 65536) {
    header = Buffer.alloc(4)
    header[0] = 0x80 | opcode
    header[1] = 126
    header.writeUInt16BE(len, 2)
  } else {
    header = Buffer.alloc(10)
    header[0] = 0x80 | opcode
    header[1] = 127
    header.writeBigUInt64BE(BigInt(len), 2)
  }
  return Buffer.concat([header, payload])
}

function _decodeWsFrame(buf) {
  if (buf.length < 2) return null
  const byte0 = buf[0]
  const byte1 = buf[1]
  const fin = !!(byte0 & 0x80)
  const opcode = byte0 & 0x0F
  const masked = !!(byte1 & 0x80)
  let payloadLen = byte1 & 0x7F
  let offset = 2

  if (payloadLen === 126) {
    if (buf.length < 4) return null
    payloadLen = buf.readUInt16BE(2)
    offset = 4
  } else if (payloadLen === 127) {
    if (buf.length < 10) return null
    payloadLen = Number(buf.readBigUInt64BE(2))
    offset = 10
  }

  const maskLen = masked ? 4 : 0
  const totalLen = offset + maskLen + payloadLen
  if (buf.length < totalLen) return null

  let payload
  if (masked) {
    const mask = buf.subarray(offset, offset + 4)
    payload = Buffer.alloc(payloadLen)
    for (let i = 0; i < payloadLen; i++) {
      payload[i] = buf[offset + 4 + i] ^ mask[i % 4]
    }
  } else {
    payload = buf.subarray(offset, offset + payloadLen)
  }

  return {
    fin,
    opcode,
    payload,
    rest: buf.subarray(totalLen),
  }
}

// ── Factory function ──

/**
 * Create a SpaceNode application with auto-discovery.
 *
 * @param {object} config
 * @param {string} [config.baseUrl] — import.meta.url of the entry file; when set, relative modulesDir / static paths resolve from that file
 * @param {string} [config.modulesDir='./modules']
 * @param {string|boolean} [config.static]
 * @param {boolean} [config.spa=true]
 * @param {*} [config.db]
 * @param {boolean} [config.debug]
 * @param {boolean} [config.recursive] — enable recursive module discovery
 * @param {boolean} [config.watch] — restart on file changes (dev mode)
 * @returns {Promise<SuperApp>}
 */
export async function createApp(config = {}) {
  const app = new SuperApp(config)

  // If baseUrl provided, resolve relative paths from the caller's file
  const resolvePath = config.baseUrl
    ? (rel) => isAbsolute(rel) ? rel : dir(config.baseUrl, rel)
    : resolveFromEntry

  // ── Static file serving ──
  const staticOpt = config.static
  if (staticOpt) {
    const staticPath = typeof staticOpt === 'string'
      ? resolvePath(staticOpt)
      : resolvePath('./public')
    if (existsSync(staticPath)) {
      app._staticDir = staticPath
      app._spa = config.spa !== false
    }
  }

  // ── Views engine ──
  if (config.views) {
    const viewsPath = typeof config.views === 'string'
      ? resolvePath(config.views)
      : resolvePath('./views')

    if (!existsSync(viewsPath)) {
      throw new Error(`Views directory not found: ${viewsPath}`)
    }

    const settings = await loadViewSettings(viewsPath)

    app._viewEngine = new ViewEngine({
      dir: viewsPath,
      layout: settings.layout || config.layout || null,
      globals: settings.globals || {},
      helpers: settings.helpers || {},
      cacheMax: config.viewsCacheMax || 500,
    })

    if (app.debug) {
      app._logger.debug(`Views enabled: ${viewsPath}${settings.layout ? `, layout: ${settings.layout}` : ''}`)
    }
  }

  // ── Auto-discover modules ──
  const modulesDir = resolvePath(config.modulesDir || './modules')
  if (existsSync(modulesDir)) {
    const modules = await loadAllModules(modulesDir, {
      recursive: config.recursive || false,
    })

    // Validate: no duplicate module names or prefixes
    const seenNames = new Set()
    const seenPrefixes = new Set()
    for (const mod of modules) {
      if (seenNames.has(mod.name)) {
        throw new Error(`Duplicate module name: "${mod.name}". Each module must have a unique name.`)
      }
      seenNames.add(mod.name)
      const prefix = mod.config.prefix
      if (seenPrefixes.has(prefix)) {
        throw new Error(`Duplicate module prefix: "${prefix}" (module "${mod.name}"). Each module must have a unique prefix.`)
      }
      seenPrefixes.add(prefix)
    }

    app._modules = modules

    // Phase 1: Register all services into DI container
    for (const mod of modules) {
      for (const [name, service] of Object.entries(mod.services)) {
        app._registerModuleService(mod, name, service)
      }
    }

    // Phase 2: Wire event listeners from module configs
    for (const mod of modules) {
      const eventConfig = mod.config.on || {}
      for (const [event, handlerName] of Object.entries(eventConfig)) {
        const handler = mod.controllers[handlerName]
        if (handler) {
          app.events.on(event, (data) => handler(data, app.container.getAll()))
        } else {
          app._logger.warn(`Event handler "${handlerName}" not found in ${mod.name} controllers`)
        }
      }
    }

    // Phase 3: Build routes and register in trie router
    for (const mod of modules) {
      const routes = buildRoutes(mod, app._appGuards)
      for (const route of routes) {
        app.router.add(route.method, route.path, route.handler, {
          meta: { _pipes: route.pipes, module: route.module }
        })
        app._routeMeta.push({
          method: route.method,
          path: route.path,
          module: route.module,
          handler: route.handler,
          openapi: route.openapi,
          pipeNames: route.pipeNames,
          dtoSchema: route.dtoSchema,
        })
      }

      if (app.debug) {
        app._logger.debug(`Module "${mod.name}": ${routes.length} routes, ${Object.keys(mod.services).length} services`)
      }
    }

    // Phase 4: Resolve global pipes
    if (config.pipe && config.pipe.length > 0) {
      app._globalPipes = resolvePipes(config.pipe, {}, app._appGuards)
    }

    // Phase 5: Run module onInit hooks
    const services = app.container.getAll()
    for (const mod of modules) {
      if (mod.hooks?.onInit) {
        try {
          await mod.hooks.onInit(services)
          if (app.debug) {
            app._logger.debug(`Module "${mod.name}" onInit complete`)
          }
        } catch (err) {
          app._logger.error(`Module "${mod.name}" onInit failed:`, err)
          throw err // Fail fast — don't start with broken modules
        }
      }
      if (mod.hooks?.onDestroy) {
        app._moduleDestroyHooks.push(mod.hooks.onDestroy)
      }
    }
  }

  return app
}

// ── Watch mode (dev-only, zero cost when disabled) ──

function _startWatcher(port) {
  import('node:child_process').then(({ spawn }) => {
    import('node:fs').then(({ watch }) => {
      const script = process.argv[1]
      let child = null
      let restarting = false

      function start() {
        child = spawn(process.execPath, [script, ...process.argv.slice(2)], {
          env: { ...process.env, SPACENODE_CHILD: '1' },
          stdio: 'inherit',
        })
        child.on('exit', (code) => {
          if (!restarting) process.exit(code ?? 0)
        })
      }

      function restart(filename) {
        if (restarting) return
        restarting = true
        console.log(`\n  \u21BB ${filename} changed \u2014 restarting...\n`)
        if (child) {
          child.once('exit', () => {
            start()
            restarting = false
          })
          child.kill()
        } else {
          start()
          restarting = false
        }
      }

      // Clean exit
      for (const sig of ['SIGINT', 'SIGTERM']) {
        process.on(sig, () => { child?.kill(); process.exit() })
      }

      let debounce = null
      const ignored = /node_modules|\.git[\\/]|\.DS_Store/

      watch(process.cwd(), { recursive: true }, (_, filename) => {
        if (!filename || ignored.test(filename)) return
        clearTimeout(debounce)
        debounce = setTimeout(() => restart(filename), 150)
      })

      console.log(`  \u{1F441} Watch mode \u2014 restarting on file changes (port ${port})`)
      start()
    })
  })
}
