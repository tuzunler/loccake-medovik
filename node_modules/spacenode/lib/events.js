// ─────────────────────────────────────────────
// SpaceNode — Inter-Module Event Bus
// ─────────────────────────────────────────────
// Decoupled communication between modules.
// Auth emits 'auth:login' → Orders module reacts.
// No module imports another module. Pure events.

export class EventBus {
  constructor() {
    this._handlers = new Map()
    this._onceHandlers = new Map()
    this.debug = false
  }

  /**
   * Listen for an event
   * @param {string} event — e.g. 'auth:login', 'order:created'
   * @param {Function} handler — async (data) => {}
   */
  on(event, handler) {
    if (!this._handlers.has(event)) {
      this._handlers.set(event, [])
    }
    this._handlers.get(event).push(handler)
    return this
  }

  /**
   * Listen once — auto-removes after first call
   */
  once(event, handler) {
    if (!this._onceHandlers.has(event)) {
      this._onceHandlers.set(event, [])
    }
    this._onceHandlers.get(event).push(handler)
    return this
  }

  /**
   * Emit an event — runs all handlers sequentially
   * @param {string} event
   * @param {*} data — payload
   */
  async emit(event, data) {
    if (this.debug) {
      console.log(`  ⚡ event: ${event}`, data ? JSON.stringify(data).slice(0, 80) : '')
    }

    const errors = []

    // Regular handlers
    const handlers = this._handlers.get(event) || []
    for (const h of handlers) {
      try {
        await h(data)
      } catch (err) {
        errors.push({ event, error: err })
        console.error(`  ✗ Event handler error [${event}]:`, err.message)
      }
    }

    // Once handlers — run and remove
    const onceHandlers = this._onceHandlers.get(event) || []
    if (onceHandlers.length > 0) {
      this._onceHandlers.delete(event)
      for (const h of onceHandlers) {
        try {
          await h(data)
        } catch (err) {
          errors.push({ event, error: err })
          console.error(`  ✗ Event once-handler error [${event}]:`, err.message)
        }
      }
    }

    // Surface errors instead of silently swallowing them
    // Guard against recursion — don't re-emit event:error from event:error
    if (errors.length > 0 && event !== 'event:error') {
      this.emit('event:error', { event, errors }).catch(() => {})
    }
  }

  /**
   * Remove handler(s)
   * @param {string} event
   * @param {Function} [handler] — specific handler, or omit to remove all
   */
  off(event, handler) {
    if (!handler) {
      this._handlers.delete(event)
      this._onceHandlers.delete(event)
    } else {
      const list = this._handlers.get(event)
      if (list) {
        this._handlers.set(event, list.filter(h => h !== handler))
      }
    }
    return this
  }

  /**
   * List all registered events (debug/info)
   */
  listEvents() {
    const events = []
    for (const [event, handlers] of this._handlers) {
      events.push({ event, listeners: handlers.length })
    }
    return events
  }

  /**
   * Remove all listeners (for testing/cleanup).
   */
  clear() {
    this._handlers.clear()
    this._onceHandlers.clear()
  }

  /**
   * Full cleanup — clear listeners, remove references.
   */
  destroy() {
    this.clear()
  }
}
