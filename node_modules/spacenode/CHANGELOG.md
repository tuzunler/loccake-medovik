# Changelog

All notable changes to this project will be documented in this file.

v1.1.0

- **security:** WebSocket max message size limit — prevents unbounded fragment accumulation (DDoS vector)
  - Default limit: 1 MB per message (configurable via `createApp({ wsMaxMessageSize: bytes })`)
  - Oversized messages close the connection with RFC 6455 status code `1009` (Message Too Big)
  - Fragment buffer is cleaned up immediately on limit breach — no memory leak
  - Zero impact on normal WebSocket traffic (messages under 1 MB pass through unchanged)

- **feat:** Built-in SSR template engine — server-side rendering with zero dependencies
  - Template syntax: `[= expr]` (auto-escaped), `[# if]`, `[# each]`, `[> partial]`, `[# block]`
  - Layout system: default layout wraps all pages, override per-render with `{ layout: 'name' }` or `{ layout: false }`
  - Pipe filters: `upper`, `lower`, `capitalize`, `truncate`, `date`, `json`, `pad`, `plural`, `currency` — chainable via `[= val | filter]`
  - Partials with isolated scope: `[> partials/card { title: 'Hello' }]`
  - `request.render(view, data, opts)` — render templates from controllers
  - `request.flash(type, message)` — flash messages (auto-injected as `flashes` on next request)
  - `app.render(method, path, view, data)` — declarative view routes without controllers
  - `app.addHelper(name, fn)` — register custom pipe filters
  - `views/settings.js` — auto-loaded config: default layout, global variables, custom helpers
  - AOT compilation: templates compiled to JS functions on first access, cached in LRU (default 500)
  - Security: auto-escaping by default, `raw()` for trusted HTML, path traversal protection, CSRF support
  - Config: `views`, `baseUrl`, `layout` options in `createApp()`

- **perf:** Hot-path optimizations in `context.js` — SpaceNode now matches or exceeds raw `http.createServer` throughput
  - `new URL()` → `_fastParseUrl()` — lightweight manual parser via `indexOf('?')` + `split('&')`, avoids heavy WHATWG URL constructor (biggest win)
  - Cookie parsing — `for` loop with index instead of `for...of`, lazy init only when `cookie` header is present
  - `parseBody()` fast path for GET/HEAD/OPTIONS — returns pre-allocated frozen `_EMPTY_BODY` object synchronously instead of creating a Promise

v1.0.3

- **feat:** DTO object format — alternative syntax for validation schemas
  - **Before:** only array format `email: ['string', 'required', 'email']`
  - **Now:** also supports `email: { type: 'string', required: true, email: true }`
  - Both formats produce identical results, object format is ~2% faster (no string splitting)
  - Supports all existing rules: `type`, `required`, `optional`, `default`, `min`, `max`, `length`, `pattern`, `enum`, `email`, `url`, `uuid`, `date`

- **fix:** duplicate module name/prefix detection
  - **Before:** two modules with the same `name` or `prefix` silently overwrote each other's routes and services
  - **Now:** `createApp()` and `addModule()` throw a clear error:
    - `Duplicate module name: "auth". Each module must have a unique name.`
    - `Duplicate module prefix: "/auth" (module "auth2"). Each module must have a unique prefix.`

- **fix:** service name collision now throws instead of warning
  - **Before:** `Service "userService" conflict: module "auth2" overrides existing.` (warn, silently overwrites)
  - **Now:** throws `Error` with three resolution options: rename, use `isolated: true`, or access via namespaced key `"moduleName.serviceName"`

v1.0.2
- **fix:** `watch` mode + imperative API (`setRoute`, `addModule`, etc.)
  - **Before:** `createApp({ watch: true })` returned a watcher object — `setRoute` and other methods threw `TypeError`
  - **Now:** `createApp()` always returns `SuperApp`, watch logic moved to `listen()`


v1.0.1
- Updated README.md