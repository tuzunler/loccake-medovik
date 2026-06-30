// ─────────────────────────────────────────────
// SpaceNode — Pipeline Middleware System (v2)
// ─────────────────────────────────────────────
// Each pipe is a pure function: (request, services) => result
//
//   return nothing     → continue to next pipe
//   return { user }    → merge into request.state (safe namespace)
//   return { after }   → post-handler hook (timing, logging)
//   throw HttpError    → abort pipeline, send error response
//
// v2: Protected keys — pipes cannot overwrite built-in request properties.

/** Built-in request properties that must NOT be overwritten by pipes. */
const PROTECTED_KEYS = new Set([
  // Request data
  'method', 'path', 'url', 'params', 'query', 'headers',
  'cookies', 'body', 'files', 'ip',
  // App references
  'db', 'config', 'raw',
  // Utilities (functions)
  'send', 'check', 'guard', 'error', 'emit',
  'setHeader', 'redirect', 'html', 'cookie',
  // Internal
  '_req', '_res', '_sent', '_statusCode', '_app',
])

/**
 * Execute a pipeline of pipe functions sequentially.
 *
 * @param {Function[]} pipes — array of pipe functions
 * @param {object} request — the request context (first handler arg)
 * @param {object} services — DI container (second handler arg)
 * @returns {Function[]} afterHooks — functions to call after the handler
 */
export async function runPipeline(pipes, request, services) {
  const afterHooks = []

  for (const pipe of pipes) {
    if (typeof pipe !== 'function') continue

    const result = await pipe(request, services)

    // If send() was already called (e.g. cors preflight), stop
    if (request._sent) break

    // Pipe returned nothing → continue
    if (result == null) continue

    // Pipe returned an object → inspect it
    if (typeof result === 'object') {
      // Has an after hook? Collect it
      if (typeof result.after === 'function') {
        afterHooks.push(result.after)
      }

      // Merge data into request (PROTECTED keys are skipped)
      for (const key of Object.keys(result)) {
        if (key === 'after') continue
        if (PROTECTED_KEYS.has(key)) {
          console.warn(
            `[Pipeline] Pipe tried to overwrite protected key "${key}" — skipped. ` +
            `Use a different key name or store data in request.state.`
          )
          continue
        }
        request[key] = result[key]
      }
    }
  }

  return afterHooks
}

/**
 * Execute after-hooks in reverse order (LIFO — like try/finally).
 * Each hook receives the response status code.
 * Errors are collected and re-emitted, never swallowed.
 *
 * @param {Function[]} hooks
 * @param {number} statusCode
 * @param {object} [logger] — optional logger for error reporting
 * @returns {Error[]} — any errors that occurred
 */
export async function runAfterHooks(hooks, statusCode, logger) {
  const errors = []
  // Run in reverse (last pipe's after runs first)
  for (let i = hooks.length - 1; i >= 0; i--) {
    try {
      await hooks[i](statusCode)
    } catch (err) {
      errors.push(err)
      if (logger) {
        logger.error('After-hook error:', err)
      } else {
        console.error('  ✗ After-hook error:', err.message, err.stack)
      }
    }
  }
  return errors
}
