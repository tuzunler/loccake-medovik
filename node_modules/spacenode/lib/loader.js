// ─────────────────────────────────────────────
// SpaceNode — Module Auto-Discovery & Loader (v2)
// ─────────────────────────────────────────────
// v2 changes:
//   - Nested module directories (recursive discovery)
//   - Services can be objects, functions (factories), or classes
//   - Module lifecycle hooks: onInit(services), onDestroy()
//   - Module isolation: namespaced services (prefix with module name)
//   - String route format REMOVED — only tuple and object formats
//   - Programmatic module support via addModule()

import { readdir } from 'node:fs/promises'
import { join, basename } from 'node:path'
import { pathToFileURL } from 'node:url'
import { resolveGuard } from './guards.js'
import { validate } from './dto.js'
import { ValidationError } from './errors.js'

/**
 * Load a single module from a directory.
 *
 * @param {string} dirPath — absolute path to module folder
 * @returns {object} — { name, config, controllers, services, dtos, pipes, hooks, path }
 */
export async function loadModule(dirPath) {
  const files = await readdir(dirPath)
  const name = basename(dirPath)

  // ── 1. Load module.js config ──
  let config = { prefix: `/${name}`, routes: [], pipe: [] }
  let hooks = { onInit: null, onDestroy: null }

  if (files.includes('module.js')) {
    const mod = await dynamicImport(join(dirPath, 'module.js'))
    const exported = mod.default || mod
    config = { ...config, ...exported }

    // Extract lifecycle hooks
    if (typeof exported.onInit === 'function') hooks.onInit = exported.onInit
    if (typeof exported.onDestroy === 'function') hooks.onDestroy = exported.onDestroy
    // Also check named exports
    if (typeof mod.onInit === 'function') hooks.onInit = mod.onInit
    if (typeof mod.onDestroy === 'function') hooks.onDestroy = mod.onDestroy
  }
  if (!config.name) config.name = name

  // ── 2. Auto-discover controllers (*.controller.js) ──
  const controllers = {}
  for (const f of files.filter(f => f.endsWith('.controller.js'))) {
    const exports = await dynamicImport(join(dirPath, f))
    for (const [key, val] of Object.entries(exports)) {
      if (typeof val === 'function') {
        controllers[key] = val
      }
    }
  }

  // ── 3. Auto-discover services (*.service.js) ──
  // Accepts: objects, functions (factories), classes
  const services = {}
  for (const f of files.filter(f => f.endsWith('.service.js'))) {
    const exports = await dynamicImport(join(dirPath, f))
    for (const [key, val] of Object.entries(exports)) {
      if (val === null || val === undefined) continue
      if (typeof val === 'object' || typeof val === 'function') {
        services[key] = val
      }
    }
  }

  // ── 4. Auto-discover DTOs (*.dto.js) ──
  const dtos = {}
  for (const f of files.filter(f => f.endsWith('.dto.js'))) {
    const exports = await dynamicImport(join(dirPath, f))
    for (const [key, val] of Object.entries(exports)) {
      if (val && typeof val === 'object') {
        dtos[key] = val
      }
    }
  }

  return { name, config, controllers, services, dtos, hooks, path: dirPath }
}

/**
 * Load ALL modules from a directory (auto-discovery).
 * Supports nested directories (recursive).
 *
 * @param {string} modulesDir — absolute path to modules/ folder
 * @param {object} [options]
 * @param {boolean} [options.recursive=false] — scan nested directories
 * @returns {object[]} — array of loaded module objects
 */
export async function loadAllModules(modulesDir, options = {}) {
  const { recursive = false } = options
  const entries = await readdir(modulesDir, { withFileTypes: true })
  const modules = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    if (entry.name.startsWith('.') || entry.name.startsWith('_')) continue

    const modulePath = join(modulesDir, entry.name)

    // Check if this directory contains a module.js or *.controller.js
    const subFiles = await readdir(modulePath)
    const isModule = subFiles.some(f =>
      f === 'module.js' || f.endsWith('.controller.js')
    )

    if (isModule) {
      const mod = await loadModule(modulePath)
      modules.push(mod)
    }

    // Recursive: also scan sub-directories for nested modules
    if (recursive) {
      try {
        const nested = await loadAllModules(modulePath, { recursive: true })
        for (const nestedMod of nested) {
          // Prefix nested module prefix with parent
          if (!nestedMod.config._prefixOverride) {
            nestedMod.config.prefix = `/${entry.name}${nestedMod.config.prefix}`
          }
          modules.push(nestedMod)
        }
      } catch {
        // Not a modules directory — skip
      }
    }
  }

  return modules
}

/**
 * Resolve pipe names into executable pipe functions.
 * Handles: built-in guards, 'dto:schemaName', custom guards, direct functions.
 *
 * @param {string[]|Function[]} pipeNames — ['dto:loginDto', 'auth', 'role:admin']
 * @param {object} dtos — module's DTO exports for dto: resolution
 * @param {Map} [appGuards] — app-level guard registry
 * @returns {Function[]} — resolved pipe functions
 */
export function resolvePipes(pipeNames, dtos = {}, appGuards = null) {
  return pipeNames.map(pipeName => {
    // Already a function (from module-level config)
    if (typeof pipeName === 'function') return pipeName

    // dto:schemaName — create validation pipe
    if (pipeName.startsWith('dto:')) {
      const schemaName = pipeName.slice(4)
      const schema = dtos[schemaName]
      if (!schema) {
        throw new Error(`DTO "${schemaName}" not found. Check your *.dto.js exports.`)
      }
      return (request) => {
        const cleaned = validate(request.body, schema)
        request.body = cleaned
      }
    }

    // Try guard resolution (auth, role:admin, rateLimit:100, etc.)
    const guard = resolveGuard(pipeName, appGuards)
    if (guard) return guard

    throw new Error(`Pipe "${pipeName}" not found. Register it with defineGuard() or app.addGuard().`)
  })
}

/**
 * Build the full route table for a loaded module.
 * Supports two formats:
 *   Tuple:  ['POST', '/login', 'login', ['dto:loginDto'], { openapi }]
 *   Object: { method, path, handlerName, pipeNames, openapi }
 *
 * String format ('POST /login => login | dto:loginDto') is NO LONGER supported.
 *
 * @param {object} mod — loaded module from loadModule()
 * @param {Map} [appGuards] — app-level guard registry
 * @returns {{ method, path, handler, pipes }[]}
 */
export function buildRoutes(mod, appGuards = null) {
  const { config, controllers, dtos } = mod
  const routes = []

  // Resolve module-level pipes
  const modulePipes = resolvePipes(config.pipe || [], dtos, appGuards)

  for (const routeDef of config.routes || []) {
    let parsed

    if (Array.isArray(routeDef)) {
      // Tuple format: [method, path, handlerName, pipeNames?, openapi?]
      const [method, path, handlerName, pipeNames, openapi] = routeDef
      parsed = {
        method: method.toUpperCase(), path, handlerName,
        pipeNames: pipeNames || [],
        openapi: openapi || null,
      }
    } else if (typeof routeDef === 'object' && routeDef !== null) {
      // Object format: { method, path, handlerName, pipeNames, openapi }
      parsed = {
        method: (routeDef.method || 'GET').toUpperCase(),
        path: routeDef.path || '/',
        handlerName: routeDef.handlerName,
        pipeNames: routeDef.pipeNames || [],
        openapi: routeDef.openapi || null,
      }
    } else if (typeof routeDef === 'string') {
      // String format is no longer supported
      throw new Error(
        `String route format is no longer supported: "${routeDef}". ` +
        `Use tuple ['METHOD', '/path', 'handler', ['pipes']] or object format instead.`
      )
    } else {
      continue
    }

    // Detect DTO schema from pipe names
    let dtoSchema = null
    for (const p of (parsed.pipeNames || [])) {
      if (typeof p === 'string' && p.startsWith('dto:')) {
        const schemaName = p.slice(4)
        if (dtos[schemaName]) dtoSchema = { name: schemaName, schema: dtos[schemaName] }
      }
    }
    parsed.dtoSchema = dtoSchema

    // Resolve handler
    const handler = controllers[parsed.handlerName]
    if (!handler) {
      throw new Error(
        `Handler "${parsed.handlerName}" not found in ${config.name} controllers. ` +
        `Available: [${Object.keys(controllers).join(', ')}]`
      )
    }

    // Resolve route-level pipes
    const routePipes = resolvePipes(parsed.pipeNames || [], dtos, appGuards)

    routes.push({
      method: parsed.method,
      path: config.prefix + parsed.path,
      handler,
      pipes: [...modulePipes, ...routePipes],
      module: config.name,
      openapi: parsed.openapi || null,
      pipeNames: parsed.pipeNames || [],
      dtoSchema: parsed.dtoSchema || null,
    })
  }

  return routes
}

/**
 * Create a module definition programmatically (without file system).
 *
 *   const mod = createModule({
 *     name: 'health',
 *     prefix: '/health',
 *     routes: [['GET', '/', 'check']],
 *     controllers: { check: ({ send }) => send({ ok: true }) },
 *     services: {},
 *   })
 *
 * @param {object} definition
 * @returns {object} — module object compatible with buildRoutes()
 */
export function createModule(definition) {
  const {
    name = 'unnamed',
    prefix,
    routes = [],
    controllers = {},
    services = {},
    dtos = {},
    pipe = [],
    on = {},
    onInit = null,
    onDestroy = null,
    isolated = false,
    openapi = null,
  } = definition

  return {
    name,
    config: {
      name,
      prefix: prefix || `/${name}`,
      routes,
      pipe,
      on,
      isolated,
      openapi,
    },
    controllers,
    services,
    dtos,
    hooks: { onInit, onDestroy },
    path: null, // programmatic — no file path
  }
}

// ── Utility ──

async function dynamicImport(filePath) {
  const url = pathToFileURL(filePath).href
  return import(url)
}
