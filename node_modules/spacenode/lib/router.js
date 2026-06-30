// ─────────────────────────────────────────────
// SpaceNode — Trie Router (fast, no regex)
// ─────────────────────────────────────────────
// Radix-trie based router. O(path_length) lookup instead of O(n_routes).
// Faster than Express regex-based matching.

const PARAM_PREFIX = ':'
const WILDCARD = '*'

class TrieNode {
  constructor() {
    this.children = new Map()   // static segments
    this.paramChild = null      // :param node
    this.wildcardChild = null   // * node
    this.paramName = null
    this.handlers = new Map()   // METHOD -> { handler, options }
  }
}

export class Router {
  constructor() {
    this.root = new TrieNode()
    this._globalMiddleware = []
  }

  /**
   * Register a route
   * @param {string} method — GET, POST, PUT, DELETE, PATCH, etc.
   * @param {string} path — e.g. /users/:id/posts
   * @param {Function} handler
   * @param {object} [options] — { dto, middleware, meta }
   */
  add(method, path, handler, options = {}) {
    const segments = this._splitPath(path)
    let node = this.root

    for (const segment of segments) {
      if (segment.startsWith(PARAM_PREFIX)) {
        // Dynamic parameter: :id, :name, etc.
        if (!node.paramChild) {
          node.paramChild = new TrieNode()
          node.paramChild.paramName = segment.slice(1)
        }
        node = node.paramChild
      } else if (segment === WILDCARD) {
        // Wildcard: catch-all
        if (!node.wildcardChild) {
          node.wildcardChild = new TrieNode()
        }
        node = node.wildcardChild
        break // wildcard consumes the rest
      } else {
        // Static segment
        if (!node.children.has(segment)) {
          node.children.set(segment, new TrieNode())
        }
        node = node.children.get(segment)
      }
    }

    node.handlers.set(method.toUpperCase(), {
      handler,
      dto: options.dto || null,
      middleware: options.middleware || [],
      meta: options.meta || {},
      hooks: options.hooks || null
    })

    return this
  }

  /**
   * Find matching route for a request
   * @param {string} method
   * @param {string} path
   * @returns {{ handler, params, dto, middleware, meta } | null}
   */
  find(method, path) {
    const segments = this._splitPath(path)
    const params = {}
    const result = this._search(this.root, segments, 0, params)

    if (!result) return null

    const route = result.handlers.get(method.toUpperCase())
    if (!route) {
      // Method not allowed — check if any method exists
      if (result.handlers.size > 0) {
        return {
          handler: null,
          params,
          methodNotAllowed: true,
          allowedMethods: [...result.handlers.keys()]
        }
      }
      return null
    }

    return {
      handler: route.handler,
      params,
      dto: route.dto,
      middleware: [...this._globalMiddleware, ...route.middleware],
      meta: route.meta,
      hooks: route.hooks,
      methodNotAllowed: false
    }
  }

  /**
   * Add global middleware (applied to all routes)
   */
  use(fn) {
    this._globalMiddleware.push(fn)
    return this
  }

  /**
   * Get all registered routes (for debugging/info)
   */
  listRoutes() {
    const routes = []
    this._collectRoutes(this.root, '', routes)
    return routes
  }

  // ── Private methods ──

  _search(node, segments, index, params) {
    if (index === segments.length) {
      return node.handlers.size > 0 ? node : null
    }

    const segment = segments[index]

    // 1. Try exact match first (fastest)
    if (node.children.has(segment)) {
      const result = this._search(node.children.get(segment), segments, index + 1, params)
      if (result) return result
    }

    // 2. Try param match
    if (node.paramChild) {
      try { params[node.paramChild.paramName] = decodeURIComponent(segment) }
      catch { params[node.paramChild.paramName] = segment }
      const result = this._search(node.paramChild, segments, index + 1, params)
      if (result) return result
      delete params[node.paramChild.paramName]
    }

    // 3. Try wildcard
    if (node.wildcardChild) {
      params['*'] = segments.slice(index).map(s => { try { return decodeURIComponent(s) } catch { return s } }).join('/')
      return node.wildcardChild.handlers.size > 0 ? node.wildcardChild : null
    }

    return null
  }

  _splitPath(path) {
    return path.split('/').filter(Boolean)
  }

  _collectRoutes(node, prefix, routes) {
    for (const [method] of node.handlers) {
      routes.push({ method, path: prefix || '/' })
    }
    for (const [segment, child] of node.children) {
      this._collectRoutes(child, `${prefix}/${segment}`, routes)
    }
    if (node.paramChild) {
      this._collectRoutes(node.paramChild, `${prefix}/:${node.paramChild.paramName}`, routes)
    }
    if (node.wildcardChild) {
      this._collectRoutes(node.wildcardChild, `${prefix}/*`, routes)
    }
  }
}
