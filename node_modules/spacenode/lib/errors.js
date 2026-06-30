// ─────────────────────────────────────────────
// SpaceNode — Error classes & Structured Logger
// ─────────────────────────────────────────────

/**
 * Base HTTP error — thrown by check(), guard(), error()
 * Caught automatically by the framework and sent as JSON response
 */
export class HttpError extends Error {
  constructor(status = 500, message = 'Internal Server Error', details = null) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.details = details
  }

  toJSON() {
    const obj = { error: this.message, status: this.status }
    if (this.details) obj.details = this.details
    return obj
  }
}

/**
 * Validation error — thrown by DTO validation
 */
export class ValidationError extends HttpError {
  constructor(errors) {
    super(400, 'Validation failed', errors)
    this.name = 'ValidationError'
  }
}

/**
 * Module error — thrown when module configuration is invalid
 */
export class ModuleError extends Error {
  constructor(moduleName, message) {
    super(`[Module: ${moduleName}] ${message}`)
    this.name = 'ModuleError'
    this.moduleName = moduleName
  }
}

// ─────────────────────────────────────────────
// Structured Logger
// ─────────────────────────────────────────────
// Pluggable logger with levels and structured output.
// Default: console-based.  Override with custom transport.

const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 }

export class Logger {
  /**
   * @param {object} [options]
   * @param {'error'|'warn'|'info'|'debug'} [options.level='info']
   * @param {Function} [options.transport] — custom (level, message, data) => void
   * @param {boolean} [options.timestamps=true]
   */
  constructor(options = {}) {
    this._level = LOG_LEVELS[options.level] ?? LOG_LEVELS.info
    this._transport = options.transport || null
    this._timestamps = options.timestamps !== false
  }

  _log(level, message, data) {
    if (LOG_LEVELS[level] > this._level) return

    if (this._transport) {
      this._transport(level, message, data)
      return
    }

    const ts = this._timestamps ? new Date().toISOString() : ''
    const prefix = ts ? `[${ts}] ` : ''
    const tag = level.toUpperCase().padEnd(5)

    if (data !== undefined) {
      const extra = data instanceof Error
        ? `${data.message}\n${data.stack}`
        : (typeof data === 'object' ? JSON.stringify(data) : String(data))
      console.log(`${prefix}${tag} ${message} ${extra}`)
    } else {
      console.log(`${prefix}${tag} ${message}`)
    }
  }

  error(message, data) { this._log('error', message, data) }
  warn(message, data)  { this._log('warn', message, data) }
  info(message, data)  { this._log('info', message, data) }
  debug(message, data) { this._log('debug', message, data) }

  child(prefix) {
    const parent = this
    const child = new Logger({ level: 'debug', timestamps: this._timestamps })
    child._level = this._level
    child._transport = (level, msg, data) => {
      parent._log(level, `[${prefix}] ${msg}`, data)
    }
    return child
  }
}
