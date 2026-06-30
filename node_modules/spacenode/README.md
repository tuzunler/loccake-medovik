# ⚡ SpaceNode

v1.1.0

**Official Site**
https://spacenode.org/

**Docs**
https://spacenode.org/docs/introduction.html

**Revolutionary Node.js microservice framework.**
REST APIs, SSR sites, static file serving — one framework, zero dependencies.
Auto-discovery modules, pipeline middleware, DI container, event bus, DTO validation, WebSocket, OpenAPI, built-in SSR template engine with layouts, partials & pipe filters.

> 2× faster than Express. On par with Fastify. Only 163 KB.

## Install

```bash
npm install spacenode
```

## Quick Start

```
my-api/
  app.js
  modules/
    auth/
      module.js
      auth.controller.js
      auth.service.js
      auth.dto.js
```

**app.js** — 3 lines to run a full microservice:

```js
import { createApp } from 'spacenode'

const app = await createApp()
app.listen(3000)
```

**modules/auth/module.js** — declarative config:

```js
export default {
  name: 'auth',
  prefix: '/auth',
  routes: [
    ['POST', '/login',    'login',    ['dto:loginDto']],
    ['POST', '/register', 'register', ['dto:registerDto']],
    ['GET',  '/me',       'me',       ['auth']],
  ],
}
```

**modules/auth/auth.controller.js** — clean handlers:

```js
// Destructured style — pick only what you need:
export async function login({ body, send, check }, { authService }) {
  const result = await authService.login(body.email, body.password)
  check(result, 401, 'Invalid credentials')
  send(result)
}

// Or use the full request object:
export async function me(request, services) {
  const profile = await services.userService.getProfile(request.user.id)
  request.send({ user: request.user, profile })
}
```

**modules/auth/auth.dto.js** — built-in validation (array format):

```js
export const loginDto = {
  email: ['string', 'required', 'email'],
  password: ['string', 'required', 'min:6'],
}
```

Or use the **object format** — same result, explicit syntax:

```js
export const loginDto = {
  email:    { type: 'string', required: true, email: true },
  password: { type: 'string', required: true, min: 6 },
}
```

**modules/auth/auth.service.js** — auto-injected via DI:

```js
export const authService = {
  async login(email, password) { /* ... */ },
}
```

That's it. No wiring, no boilerplate. Drop a folder → it works.

## Static Site Server

Serve a static site in 3 lines:

```js
import { createApp } from 'spacenode'

const app = await createApp({ static: './public' })
app.listen(3000)
```

```
my-site/
  app.js
  public/
    index.html
    about.html
    style.css
```

LRU cache, ETag, 304, streaming, path traversal protection out of the box.

For SPA frameworks (React, Vue, Angular) — add `spa: true` to fallback all routes to `index.html`:

```js
const app = await createApp({ static: './public', spa: true })
```



### Auto-Discovery Modules
Drop a folder in `modules/` → framework discovers it automatically.
Convention: `module.js` + `*.controller.js` + `*.service.js` + `*.dto.js`.

### Pipeline Middleware (No `next()`)

Pipes are pure functions that run **before** the route handler. No callback chains, no `next()`. Each pipe either continues (returns nothing), enriches the request (returns an object), or aborts (throws `HttpError`).

**How it works:**

```
Request → [pipe1] → [pipe2] → [pipe3] → Handler → Response
                                            ↑
                     Each pipe can:
                     • return nothing       → continue to next pipe
                     • return { user }      → merge into request (request.user = ...)
                     • return { after: fn } → post-handler hook (runs after response)
                     • throw HttpError      → abort pipeline, send error
```

Pipes receive two arguments — `(request, services)` — same as handlers.

**Three levels of pipes** (executed in order):

1. **Global pipes** — apply to ALL routes:
```js
const app = await createApp({
  pipe: ['cors', 'logger', 'compress'],
})
```

2. **Module-level pipes** — apply to all routes in a module:
```js
// modules/admin/module.js
export default {
  prefix: '/admin',
  pipe: ['auth', 'role:admin'],  // every route in this module requires admin
  routes: [
    ['GET', '/stats', 'stats'],
    ['GET', '/users', 'users'],
  ],
}
```

3. **Route-level pipes** — apply to a single route:
```js
routes: [
  ['POST', '/login', 'login', ['dto:loginDto']],              // only DTO validation
  ['GET',  '/me',    'me',    ['auth']],                       // only auth
  ['PUT',  '/user',  'update', ['auth', 'dto:updateUserDto']], // auth + validation
]
```

Execution order: **global → module → route → handler**.

#### Creating Custom Pipes

**Inline pipe** (directly in module config):
```js
export default {
  prefix: '/api',
  pipe: [
    // Add request timing
    (request) => {
      request.startTime = Date.now()
      return {
        after: (statusCode) => {
          console.log(`${request.method} ${request.path} → ${statusCode} (${Date.now() - request.startTime}ms)`)
        }
      }
    }
  ],
  routes: [...],
}
```

**Named pipe** (reusable via `defineGuard` or `app.addGuard` — see Guards below):
```js
import { defineGuard } from 'spacenode'
import { HttpError } from 'spacenode'

defineGuard('apiKey', () => (request) => {
  const key = request.headers['x-api-key']
  if (key !== 'secret-key') throw new HttpError(401, 'Invalid API key')
})

// Now use it by name:
routes: [
  ['GET', '/data', 'getData', ['apiKey']]
]
```

**Pipe with data merging:**
```js
// This pipe adds `request.lang` for all subsequent pipes and the handler
defineGuard('locale', () => (request) => {
  const lang = request.headers['accept-language']?.slice(0, 2) || 'en'
  return { lang }  // → request.lang = 'en'
})
```

> **Protected keys:** Pipes cannot overwrite built-in request properties (`method`, `path`, `body`, `send`, `headers`, etc.). Attempting to do so logs a warning and skips the key. Store custom data in unique keys or `request.state`.

### DI Container
Services from ALL modules are collected and injected as the second handler argument:
```js
export async function createOrder({ body, send }, { orderService, authService, emailService }) {
  // All services available — zero imports
}
```

Supports singleton, transient, and scoped lifetimes with circular dependency detection.

### Event Bus
Decoupled inter-module communication:
```js
// In controller:
export async function checkout({ send, emit }, { orderService }) {
  const order = await orderService.create(/* ... */)
  await emit('order:created', { orderId: order.id })
  send(201, order)
}

// In another module's module.js:
export default {
  on: { 'order:created': 'onOrderCreated' },
}
```

### WebSocket

Built-in RFC 6455 WebSocket support — no dependencies:

```js
const app = await createApp()

app.ws('/chat', (ws, req, services) => {
  ws.on('message', (data) => {
    ws.send(`Echo: ${data}`)
  })

  ws.on('close', () => {
    console.log('Client disconnected')
  })
})

app.listen(3000)
```

Features: fragment assembly, ping/pong heartbeat, backpressure control (`ws.pause()` / `ws.resume()`), DI services injection, origin validation via `config.wsOrigins`.

### Static File Serving

```js
const app = await createApp({
  static: './public',
  spa: true,  // SPA mode — fallback to index.html for client-side routes
})
```

Features: LRU cache, ETag + 304 responses, streaming for large files, 40+ MIME types, path traversal protection.

### Hot Reload

```js
const app = await createApp({ watch: true })
```

File watcher auto-restarts the server on changes. Uses parent/child process architecture with 150ms debounce. Ignores `node_modules/` and `.git/`.

### Views / SSR

Built-in template engine for server-side rendering — no dependencies:

```js
import { createApp } from 'spacenode'

const app = await createApp({
  baseUrl: import.meta.url,
  views: './views',
  static: './public',
})
app.listen(3000)
```

```
my-site/
  app.js
  public/
    css/
      main.css
  views/
    settings.js
    layout.html
    pages/
      home.html
      login.html
    partials/
      nav.html
      footer.html
```

**views/settings.js** — auto-loaded config:

```js
export default {
  layout: 'layout',             // default layout template
  globals: {                     // variables available in ALL templates
    siteName: 'My Site',
    year: new Date().getFullYear(),
  },
}
```

**Template syntax:**

```html
<!-- Expressions (auto-escaped) -->
[= title]
[= user.name]

<!-- Raw output (unescaped — for trusted HTML) -->
[= raw(body)]

<!-- Pipe filters -->
[= user.name | upper]
[= user.name | capitalize]
[= description | truncate:200]
[= createdAt | date:'DD.MM.YYYY']
[= price | currency:'EUR']
[= data | json]

<!-- Conditionals -->
[# if user]
  <p>Welcome, [= user.name]!</p>
[# else]
  <p>Please log in</p>
[/if]

<!-- Loops -->
[# each users as u]
  <tr><td>[= u.name]</td><td>[= u.email]</td></tr>
[/each]

<!-- Includes (partials) -->
[> partials/nav]
[> partials/card { title: 'Hello' }]

<!-- Blocks (inject content into layout slots) -->
[# block head]<link rel="stylesheet" href="/css/admin.css">[/block]
```

**Layout** (`views/layout.html`) — wraps every page:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <title>[= title] — [= siteName]</title>
  <link rel="stylesheet" href="/css/main.css">
  [= raw(head)]
</head>
<body>
  [> partials/nav]
  <main>[= raw(body)]</main>
  [> partials/footer]
</body>
</html>
```

**Render from controller** via `request.render()`:

```js
export async function profilePage(request) {
  await request.render('pages/profile', {
    title: 'Profile',
    user: request.user,
  })
}
```

**Declarative routes** via `app.render()` — no controller needed:

```js
// Static data:
app.render('GET', '/', 'pages/home', { title: 'Home' })

// Async data with services:
app.render('GET', '/users', 'pages/users', async (req, services) => ({
  users: await services.userService.all()
}))

// With guard pipes:
app.render('GET', '/dashboard', 'pages/dashboard', ['auth'], async (req, s) => ({
  stats: await s.statsService.get()
}))
```

**Override layout per-render:**

```js
request.render('pages/home', data, { layout: 'admin' })  // different layout
request.render('pages/home', data, { layout: false })     // no layout
```

**Custom helpers:**

```js
app.addHelper('slug', (v) => String(v).toLowerCase().replace(/\s+/g, '-'))
// → [= title | slug]
```

Built-in pipes: `upper`, `lower`, `capitalize`, `truncate`, `date`, `json`, `pad`, `plural`, `currency`.

Features: AOT compilation, LRU template cache, auto-escaping, layouts, partials, blocks, pipe filters, flash messages, CSRF support, path traversal protection.

### OpenAPI

```js
const app = await createApp({
  openapi: {
    title: 'My API',
    version: '1.0.0',
  }
})
// → GET /openapi.json
```

Auto-generates OpenAPI 3.0.3 spec from your modules: routes, path parameters, DTO schemas → JSON Schema, security requirements, tags. Add route-level metadata:

```js
['POST', '/login', 'login', ['dto:loginDto'], {
  summary: 'User login',
  responses: { 200: { description: 'Success' } }
}]
```

### Built-in Guards

Guards are **named pipes** — registered by name and referenced as strings in route/module config. A guard is a **factory function** that receives an optional parameter and returns a pipe function.

Format: `'guardName'` or `'guardName:param'` — the part after `:` is passed to the factory.

| Guard | Usage | Description |
|-------|-------|-------------|
| `auth` | `['auth']` | Bearer token → calls your `defineAuth()` verifier |
| `role:admin` | `['auth', 'role:admin']` | Check user role (requires auth first) |
| `rateLimit:100` | `['rateLimit:100']` | 100 req/min per IP, sliding window |
| `cors` | `['cors']` | CORS headers + preflight |
| `cors:origin` | `['cors:https://example.com']` | CORS with specific origin |
| `logger` | `['logger']` | Request timing log |
| `compress` | `['compress']` | Brotli/Gzip/Deflate response compression |
| `security` | `['security']` | Security headers (XSS, HSTS, X-Frame, etc.) |
| `security:strict` | `['security:strict']` | + CSP, Permissions-Policy, COOP, CORP |

#### Creating Custom Guards

**Global guard** — available everywhere:
```js
import { defineGuard } from 'spacenode'
import { HttpError } from 'spacenode'

// Simple guard (no parameter):
defineGuard('premium', () => (request) => {
  if (!request.user?.isPremium) {
    throw new HttpError(403, 'Premium subscription required')
  }
})

// Usage: ['auth', 'premium']
```

**Guard with parameter** — the string after `:` is passed as `param`:
```js
// 'minAge:18' → param = '18'
defineGuard('minAge', (param) => (request) => {
  const minAge = Number(param)
  if (!request.user?.age || request.user.age < minAge) {
    throw new HttpError(403, `Minimum age: ${minAge}`)
  }
})

// Usage: ['auth', 'minAge:21']
```

**Guard with after-hook** — run logic after the handler:
```js
defineGuard('timing', () => (request) => {
  const start = Date.now()
  return {
    after: (statusCode) => {
      console.log(`${request.method} ${request.path} → ${statusCode} (${Date.now() - start}ms)`)
    }
  }
})

// Usage: ['timing']
```

**Guard that enriches the request:**
```js
defineGuard('loadCompany', () => async (request, services) => {
  const company = await services.companyService.findById(request.params.companyId)
  if (!company) throw new HttpError(404, 'Company not found')
  return { company }  // → request.company available in handler
})

// Usage: ['auth', 'loadCompany']
// In handler: ({ company, send }) => send(company)
```

**Per-app guard** — overrides global, scoped to one app instance:
```js
const app = await createApp()

app.addGuard('rateLimit', (param) => (request) => {
  // Custom rate limit logic (e.g. Redis-backed)
})
```

#### Guard Resolution Order

1. **Built-in** guards (`auth`, `role`, `cors`, etc.)
2. **App-level** guards (`app.addGuard()`) — override built-in
3. **Global** guards (`defineGuard()`) — fallback

If a pipe name is not found in any registry → throws `Error("Pipe not found")`.

### Built-in DTO Validation

Two equivalent formats — pick what fits your style:

**Array format** (concise):
```js
export const userDto = {
  email: ['string', 'required', 'email'],
  name: ['string', 'required', 'min:2', 'max:50'],
  age: ['number', 'min:18', 'max:99'],
  role: ['string', 'enum:user,admin,seller'],
  bio: ['string', 'optional', 'max:500'],
  metadata: {
    provider: ['string', 'default:github'],
  },
}
```

**Object format** (explicit):
```js
export const userDto = {
  email:    { type: 'string', required: true, email: true },
  name:     { type: 'string', required: true, min: 2, max: 50 },
  age:      { type: 'number', min: 18, max: 99 },
  role:     { type: 'string', enum: 'user,admin,seller' },
  bio:      { type: 'string', optional: true, max: 500 },
  metadata: {
    provider: { type: 'string', default: 'github' },
  },
}
```

Both formats produce identical validation results and can be mixed within a single schema.

Built-in rules: `string`, `number`, `boolean`, `array`, `object`, `email`, `url`, `uuid`, `date`, `required`, `optional`, `min`, `max`, `length`, `pattern`, `enum`, `default`.

Supports nested objects and custom validator functions. Also supports Zod/Joi/Yup via `registerAdapter()`.

### Global Pipes

Apply pipes to ALL routes:
```js
const app = await createApp({
  pipe: ['cors', 'logger', 'compress'],
})
```

### Module Lifecycle Hooks

```js
export default {
  name: 'payments',
  prefix: '/payments',
  routes: [...],

  async onInit(services) {
    // Called after all modules loaded — setup connections, caches
  },

  async onDestroy() {
    // Called during graceful shutdown — cleanup resources
  },
}
```

### Cookies

```js
// Read
const token = request.cookies.sessionId

// Set
request.cookie('sessionId', 'abc123', {
  httpOnly: true,
  secure: true,
  sameSite: 'Strict',
  maxAge: 86400_000,
})
```

### Testing with `inject()`

Test routes without starting the server:

```js
const app = await createApp()

const res = await app.inject({
  method: 'POST',
  url: '/auth/login',
  body: { email: 'test@test.com', password: '123456' },
  headers: { 'Authorization': 'Bearer token' },
})

console.log(res.statusCode) // 200
console.log(res.json)       // { token: '...' }
```

### Programmatic Routes

```js
app.setRoute('GET', '/health', (request) => {
  request.send({ status: 'ok' })
}, ['logger'])
```

---

## Database

Two approaches — pick what fits your project:

```js
// Option 1: Pass connection via config.db → available as request.db
import mongoose from 'mongoose'
await mongoose.connect('mongodb://127.0.0.1:27017/myapp')

const app = await createApp({ db: mongoose.connection })

// In controller:
export async function stats({ db, send }) {
  const count = await db.collection('users').countDocuments()
  send({ count })
}
```

```js
// Option 2: Use models directly (Mongoose global connection)
import mongoose from 'mongoose'
await mongoose.connect('mongodb://127.0.0.1:27017/myapp')

const app = await createApp()

// In controller — models work through global connection:
import { User } from './user.model.js'

export async function stats({ send }) {
  const count = await User.countDocuments()
  send({ count })
}
```

`config.db` accepts any database reference (Mongoose connection, Knex instance, pg pool, etc.).

## Auth Setup

```js
import { createApp, defineAuth } from 'spacenode'

defineAuth(async (token) => {
  const session = await Session.findOne({ token, active: true })
  if (!session) return null
  return await User.findById(session.userId) // returned as request.user
})

const app = await createApp()
app.listen(3000)
```

## API Reference

### `createApp(config?)`
| Option | Default | Description |
|--------|---------|-------------|
| `modulesDir` | `'./modules'` | Path to modules folder |
| `db` | `null` | Database reference → `request.db` |
| `debug` | `false` | Enable debug logging |
| `pipe` | `[]` | Global pipes for all routes |
| `static` | `false` | Static files directory (e.g. `'./public'`) |
| `spa` | `false` | SPA mode — fallback to index.html |
| `views` | `false` | Views directory for SSR templates (e.g. `'./views'`) |
| `baseUrl` | `null` | Base URL for path resolution (`import.meta.url`) |
| `layout` | `null` | Default layout template (or set in `views/settings.js`) |
| `watch` | `false` | Hot reload on file changes |
| `openapi` | `false` | OpenAPI spec generation (`true` or `{ title, version }`) |
| `wsOrigins` | `null` | Allowed WebSocket origins |
| `timeout` | `30000` | Server timeout (ms) |
| `keepAliveTimeout` | `5000` | Keep-alive timeout (ms) |
| `shutdownTimeout` | `5000` | Graceful shutdown grace period (ms) |

### Request Object (first handler arg)
```js
{
  method, path, params, query, headers, cookies, body, ip,
  db,       // your database reference
  user,     // set by auth guard
  config,   // app config
  send(data),           // send(200, data) or send(data)
  check(val, 404, msg), // assert — if falsy, throw HttpError
  guard(val, 409, msg), // inverse assert — if truthy, throw
  error(500, msg),      // throw HttpError
  emit(event, data),    // emit event
  setHeader(k, v),
  redirect(url, 302),
  html(content, 200),
  cookie(name, value, opts),
  render(view, data, opts),  // SSR — render template
  flash(type, message),      // flash message for next request
}
```

### Exports
```js
import {
  createApp,          // create app with auto-discovery
  dir,                // ESM path helper: dir(import.meta.url, '.env')
  defineAuth,         // define auth verification logic
  defineGuard,        // register custom named guard
  dto,                // create DTO schema
  validate,           // validate data against schema
  registerAdapter,    // register Zod/Joi/Yup adapter
  setBodyParser,      // plug custom body parser (e.g. busboy)
  createModule,       // programmatic module creation
  HttpError,          // throwable HTTP error
  ValidationError,    // 400 validation error
  ModuleError,        // module config error
  Logger,             // structured logger
  EventBus,           // event bus (for manual usage)
  Router,             // trie router (for advanced usage)
  Container,          // DI container (for advanced usage)
  ScopedContainer,    // scoped DI container
} from 'spacenode'
```

## License

MIT
