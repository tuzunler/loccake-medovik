// ─────────────────────────────────────────────
// SpaceNode — Public API (inside lib/)
// ─────────────────────────────────────────────

// Core
export { createApp, dir } from './app.js'

// Auth & Guards
export { defineAuth, defineGuard } from './guards.js'

// DTO Validation
export { dto, validate, registerAdapter } from './dto.js'

// Errors & Logging
export { HttpError, ValidationError, ModuleError, Logger } from './errors.js'

// Events (for manual usage)
export { EventBus } from './events.js'

// Router (for advanced usage)
export { Router } from './router.js'

// Container (for advanced usage)
export { Container, ScopedContainer } from './container.js'

// Module loader (for advanced/programmatic usage)
export { createModule } from './loader.js'

// Body parser (for plugging in custom parsers)
export { setBodyParser } from './context.js'

// View engine (for SSR templates)
export { ViewEngine } from './views.js'
