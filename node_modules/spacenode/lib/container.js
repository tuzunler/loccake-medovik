// ─────────────────────────────────────────────
// SpaceNode — DI Container (v2)
// ─────────────────────────────────────────────
// Full lifecycle management: singleton, transient, scoped.
// Supports factories, dependency resolution, circular detection.
// Backward compatible: register(name, plainObject) still works.

export class Container {
  constructor() {
    /** @type {Map<string, Registration>} */
    this._registrations = new Map()
    this._singletons = new Map()
    this._resolving = new Set()
    this._cache = null
  }

  // ── Registration methods ──

  /**
   * Register a service.
   * - Plain object/value → stored as singleton instance directly
   * - Function → stored as singleton factory (called with container on first resolve)
   *
   * @param {string} name
   * @param {*} instanceOrFactory
   */
  register(name, instanceOrFactory) {
    if (typeof instanceOrFactory === 'function') {
      this._registrations.set(name, {
        factory: instanceOrFactory,
        lifetime: 'singleton',
      })
    } else {
      this._registrations.set(name, {
        instance: instanceOrFactory,
        lifetime: 'singleton',
      })
      this._singletons.set(name, instanceOrFactory)
    }
    this._cache = null
  }

  /**
   * Register multiple services at once.
   * @param {object} map — { serviceName: instanceOrFactory, ... }
   */
  registerAll(map) {
    for (const [name, value] of Object.entries(map)) {
      this.register(name, value)
    }
  }

  /**
   * Register a singleton factory — one shared instance, created lazily.
   *
   *   container.singleton('db', (c) => new Database(c.resolve('config')))
   *
   * @param {string} name
   * @param {Function} factory — (container) => instance
   */
  singleton(name, factory) {
    this._registrations.set(name, { factory, lifetime: 'singleton' })
    this._cache = null
  }

  /**
   * Register a transient factory — new instance per resolve() call.
   *
   *   container.transient('requestLogger', (c) => new RequestLogger())
   *
   * @param {string} name
   * @param {Function} factory — (container) => instance
   */
  transient(name, factory) {
    this._registrations.set(name, { factory, lifetime: 'transient' })
    this._cache = null
  }

  /**
   * Register a scoped factory — one instance per scope (per-request).
   * Only meaningful within a ScopedContainer created via createScope().
   *
   * @param {string} name
   * @param {Function} factory — (container) => instance
   */
  scoped(name, factory) {
    this._registrations.set(name, { factory, lifetime: 'scoped' })
    this._cache = null
  }

  // ── Resolution ──

  /**
   * Resolve a service by name.
   * Handles lifecycle, lazy factory invocation, and circular dependency detection.
   *
   * @param {string} name
   * @returns {*} service instance or null
   */
  resolve(name) {
    const reg = this._registrations.get(name)
    if (!reg) return null

    // Direct instance (plain object registration)
    if ('instance' in reg) return reg.instance

    // Already-resolved singleton
    if (reg.lifetime === 'singleton' && this._singletons.has(name)) {
      return this._singletons.get(name)
    }

    // Factory resolution
    if (!reg.factory) return null
    return this._invokeFactory(name, reg)
  }

  /** @private */
  _invokeFactory(name, reg) {
    // Circular dependency detection
    if (this._resolving.has(name)) {
      const chain = [...this._resolving, name].join(' → ')
      throw new Error(`Circular dependency detected: ${chain}`)
    }

    this._resolving.add(name)
    try {
      const instance = reg.factory(this)

      if (reg.lifetime === 'singleton') {
        this._singletons.set(name, instance)
      }
      // Transient: always create new (no caching)
      // Scoped: handled by ScopedContainer

      return instance
    } finally {
      this._resolving.delete(name)
    }
  }

  /**
   * Get ALL services as a frozen flat object.
   * This is injected as the second handler argument.
   * Singletons are resolved lazily on first getAll() call.
   */
  getAll() {
    if (!this._cache) {
      const all = Object.create(null)
      for (const [name] of this._registrations) {
        try {
          all[name] = this.resolve(name)
        } catch (err) {
          // Log but don't crash — service might be optional
          console.error(`[Container] Failed to resolve "${name}":`, err.message)
        }
      }
      this._cache = Object.freeze(all)
    }
    return this._cache
  }

  /**
   * Check if a service is registered.
   * @param {string} name
   * @returns {boolean}
   */
  has(name) {
    return this._registrations.has(name)
  }

  /**
   * List all registered service names.
   * @returns {string[]}
   */
  list() {
    return [...this._registrations.keys()]
  }

  /**
   * Create a scoped child container (for per-request services).
   * Scoped services get their own instance per scope.
   * Singletons and transients delegate to the parent.
   *
   * @returns {ScopedContainer}
   */
  createScope() {
    return new ScopedContainer(this)
  }

  /**
   * Remove a service registration.
   * @param {string} name
   */
  unregister(name) {
    this._registrations.delete(name)
    this._singletons.delete(name)
    this._cache = null
  }

  /**
   * Clear all services (for testing).
   */
  clear() {
    this._registrations.clear()
    this._singletons.clear()
    this._resolving.clear()
    this._cache = null
  }
}

/**
 * Scoped container — child of a parent Container.
 * Scoped services get a per-scope instance.
 * Singletons delegate to parent. Transients always create new.
 */
export class ScopedContainer {
  constructor(parent) {
    this._parent = parent
    this._scopedInstances = new Map()
    this._resolving = new Set()
  }

  resolve(name) {
    const reg = this._parent._registrations.get(name)
    if (!reg) return null

    // Direct instance
    if ('instance' in reg) return reg.instance

    // Scoped: per-scope instance
    if (reg.lifetime === 'scoped') {
      if (this._scopedInstances.has(name)) return this._scopedInstances.get(name)

      if (this._resolving.has(name)) {
        const chain = [...this._resolving, name].join(' → ')
        throw new Error(`Circular dependency detected (scoped): ${chain}`)
      }

      this._resolving.add(name)
      try {
        const instance = reg.factory(this)
        this._scopedInstances.set(name, instance)
        return instance
      } finally {
        this._resolving.delete(name)
      }
    }

    // Singleton & transient: delegate to parent
    return this._parent.resolve(name)
  }

  getAll() {
    const all = Object.create(null)
    for (const [name] of this._parent._registrations) {
      try {
        all[name] = this.resolve(name)
      } catch (err) {
        console.error(`[ScopedContainer] Failed to resolve "${name}":`, err.message)
      }
    }
    return Object.freeze(all)
  }

  has(name) { return this._parent.has(name) }
  list()    { return this._parent.list() }
}
