// ─────────────────────────────────────────────
// SpaceNode — TypeScript Declarations (v2)
// ─────────────────────────────────────────────

import { IncomingMessage, ServerResponse, Server } from 'node:http'

// ═══════════════════════════════════════════════
//  Request Context
// ═══════════════════════════════════════════════

export interface CookieOptions {
	maxAge?: number
	path?: string
	domain?: string
	httpOnly?: boolean
	secure?: boolean
	sameSite?: 'Strict' | 'Lax' | 'None'
}

export interface UploadedFile {
	fieldname: string
	filename: string
	mimetype: string
	data: Buffer
	size: number
}

/**
 * The request context object — first argument to every handler and pipe.
 */
export interface RequestContext<TBody = any> {
	readonly method: string
	readonly path: string
	readonly url: string
	readonly params: Record<string, string>
	readonly query: Record<string, string>
	readonly headers: Record<string, string | string[] | undefined>
	body: TBody | null
	readonly cookies: Record<string, string>
	files: UploadedFile[] | null
	readonly ip: string
	readonly db: any
	readonly config: AppConfig
	user?: any

	/** Raw Node.js req/res for streaming or advanced use */
	readonly raw: { req: IncomingMessage; res: ServerResponse }

	/** Pipeline-merged state (safe namespace for custom data) */
	[key: string]: any

	send(data: any): void
	send(status: number, data?: any): void
	check<T>(condition: T, status?: number, message?: string): NonNullable<T>
	guard(condition: any, status?: number, message?: string): void
	error(status?: number, message?: string, details?: any): never
	emit(event: string, data?: any): Promise<void>
	setHeader(key: string, value: string | number): RequestContext<TBody>
	redirect(url: string, status?: number): void
	html(content: string, status?: number): void
	render(template: string, data?: Record<string, any>, options?: RenderOptions): Promise<void>
	cookie(name: string, value: string, options?: CookieOptions): RequestContext<TBody>

	/**
	 * Flash messages — survive exactly one redirect.
	 *   request.flash('success', 'Logged in!')
	 *   // On next request: request.flashes → { success: ['Logged in!'] }
	 */
	flash(type: string, message: string): RequestContext<TBody>

	/** Incoming flash messages from previous request (auto-cleared after read). */
	readonly flashes: Record<string, string[]>

	/** CSRF token (set by csrf guard on safe methods). */
	csrfToken?: string
	/** Hidden input HTML for CSRF token (set by csrf guard). */
	csrfField?: string
}

// ═══════════════════════════════════════════════
//  Module Configuration
// ═══════════════════════════════════════════════

/** Route definition in tuple format. */
export type RouteTuple = [
	method: string,
	path: string,
	handlerName: string,
	pipes?: string[],
	openapi?: RouteOpenAPI,
]

/** Route definition in object format. */
export interface RouteObject {
	method: string
	path: string
	handlerName: string
	pipeNames?: string[]
	openapi?: RouteOpenAPI
}

/**
 * A route definition — supports two formats (string format removed in v2):
 * - Tuple:  `['POST', '/login', 'login', ['dto:loginDto']]`
 * - Object: `{ method: 'POST', path: '/login', handlerName: 'login' }`
 */
export type RouteDefinition = RouteTuple | RouteObject

export interface RouteOpenAPI {
	summary?: string
	description?: string
	tags?: string[]
	deprecated?: boolean
	responses?: Record<number | string, { description: string }>
	queryParams?: Array<{
		name: string
		required?: boolean
		type?: string
		description?: string
	}>
}

/**
 * Module configuration — the default export of `module.js`.
 */
export interface ModuleConfig {
	name?: string
	prefix?: string
	routes?: RouteDefinition[]
	pipe?: (BuiltinGuardName | string | PipeFunction)[]
	on?: Record<string, string>
	/** If true, services are only accessible via namespace (module.serviceName) */
	isolated?: boolean
	openapi?: {
		tags?: string[]
		description?: string
	}
	/** Called after all modules are loaded with resolved services */
	onInit?: (services: ServiceMap) => void | Promise<void>
	/** Called during graceful shutdown */
	onDestroy?: () => void | Promise<void>
}

// ═══════════════════════════════════════════════
//  Handlers, Pipes & Services
// ═══════════════════════════════════════════════

export type ServiceMap = Record<string, any>

export type HandlerFunction = (
	request: RequestContext,
	services: ServiceMap,
) => void | Promise<void>

export type BuiltinGuardName =
	| 'auth'
	| 'cors'
	| 'csrf'
	| 'logger'
	| 'compress'
	| 'security'
	| `role:${string}`
	| `rateLimit:${string}`
	| `cors:${string}`
	| `compress:${string}`
	| `security:${string}`

export interface AfterHook {
	after: (statusCode: number) => void | Promise<void>
}

export type PipeFunction = (
	request: RequestContext,
	services?: ServiceMap,
) => void | Record<string, any> | AfterHook | Promise<void | Record<string, any> | AfterHook>

// ═══════════════════════════════════════════════
//  App Configuration & Instance
// ═══════════════════════════════════════════════

export interface AppConfig {
	/** import.meta.url of the entry file; when set, relative modulesDir / static paths resolve from that file */
	baseUrl?: string
	modulesDir?: string
	static?: string | boolean
	spa?: boolean
	db?: any
	debug?: boolean
	timeout?: number
	keepAliveTimeout?: number
	shutdownTimeout?: number
	pipe?: (BuiltinGuardName | string | PipeFunction)[]
	bodyLimit?: number
	openapi?: OpenAPIConfig | boolean
	wsOrigins?: string | string[]
	/** Enable recursive module discovery in nested directories */
	recursive?: boolean
	/** Max static files to cache in memory. Default: 500 */
	staticCacheMax?: number
	/** Max individual file size to cache (bytes). Default: 256KB */
	staticCacheFileSize?: number
	/** Logger configuration */
	logger?: LoggerOptions
	/** Trust proxy headers (x-forwarded-for) for IP resolution. Default: false */
	trustProxy?: boolean
	/** Restart server on file changes (dev mode). Default: false */
	watch?: boolean
	/** Path to views directory (enables SSR template engine). */
	views?: string | boolean
	/** Default layout template name. */
	layout?: string
	/** Max compiled templates to cache. Default: 500 */
	viewsCacheMax?: number
}

export interface OpenAPIConfig {
	title?: string
	version?: string
	description?: string
	servers?: Array<{ url: string; description?: string }>
}

export interface RouteInfo {
	method: string
	path: string
}

export interface EventInfo {
	event: string
	listeners: number
}

export interface AppInfo {
	modules: string[]
	routes: RouteInfo[]
	services: string[]
	events: EventInfo[]
}

export type ErrorHandler = (err: Error, request: RequestContext) => void

/**
 * The SpaceNode application instance.
 */
export interface SuperApp {
	readonly router: Router
	readonly config: AppConfig
	db: any
	readonly events: EventBus
	readonly container: Container
	readonly debug: boolean

	setDb(db: any): this
	onError(fn: ErrorHandler): this

	/** Set per-app auth verifier (takes precedence over global defineAuth). */
	setAuth(verifier: (token: string, request?: RequestContext) => any | Promise<any>): this

	/** Register a per-app named guard. */
	addGuard(name: string, factory: (params?: string) => PipeFunction): this

	/** Register a custom template helper function. */
	addHelper(name: string, fn: (...args: any[]) => any): this

	/**
	 * Register a programmatic view route.
	 *
	 *   app.render('GET', '/about', 'about')
	 *   app.render('GET', '/about', 'about', { year: 2025 })
	 *   app.render('GET', '/users', 'users', async (req, s) => ({ users: await s.userService.all() }))
	 *   app.render('GET', '/users', 'users', ['auth'], async (req, s) => ({ ... }))
	 */
	render(
		method: string,
		path: string,
		template: string,
		dataOrPipesOrOpts?: Record<string, any> | (BuiltinGuardName | string)[] | ViewDataFunction | RenderRouteOptions,
		dataFnOrOpts?: ViewDataFunction | RenderRouteOptions,
		opts?: RenderRouteOptions,
	): this

	/** Set a custom rate limit store. */
	setRateLimitStore(store: any): this

	/** Set a custom body parser. */
	setBodyParser(parser: (req: IncomingMessage, options: any) => Promise<{ body: any; files: any }>): this

	/** Add a module programmatically. */
	addModule(definition: ProgrammaticModuleDefinition): this

	listen(port: number, callback?: (app: SuperApp) => void): this
	close(callback?: () => void): Promise<this>
	info(): AppInfo

	setRoute(
		method: string,
		path: string,
		handler: HandlerFunction,
		pipeNames?: (BuiltinGuardName | string)[],
	): this

	inject(opts?: InjectOptions): Promise<InjectResponse>

	ws(path: string, handler: (socket: WebSocket, req: IncomingMessage, services: ServiceMap) => void): this

	handle(req: IncomingMessage, res: ServerResponse): Promise<void>
}

/** Definition for programmatic module creation via app.addModule(). */
export interface ProgrammaticModuleDefinition {
	name: string
	prefix?: string
	routes?: RouteDefinition[]
	controllers?: Record<string, HandlerFunction>
	services?: Record<string, any>
	dtos?: Record<string, any>
	pipe?: (BuiltinGuardName | string | PipeFunction)[]
	on?: Record<string, string>
	isolated?: boolean
	onInit?: (services: ServiceMap) => void | Promise<void>
	onDestroy?: () => void | Promise<void>
}

// ═══════════════════════════════════════════════
//  Inject (Testing)
// ═══════════════════════════════════════════════

export interface InjectOptions {
	method?: string
	url?: string
	headers?: Record<string, string>
	body?: any
}

export interface InjectResponse {
	statusCode: number
	headers: Record<string, string | string[]>
	body: string
	json: any | null
}

// ═══════════════════════════════════════════════
//  WebSocket
// ═══════════════════════════════════════════════

export interface WebSocket {
	readyState: number
	send(data: string | Buffer): boolean
	close(code?: number): void
	on(event: 'message', handler: (data: string | Buffer) => void): this
	on(event: 'close', handler: () => void): this
	on(event: 'error', handler: (err: Error) => void): this
	on(event: 'ping', handler: (data: Buffer) => void): this
	on(event: 'pong', handler: (data: Buffer) => void): this
	pause(): void
	resume(): void
}

// ═══════════════════════════════════════════════
//  Router
// ═══════════════════════════════════════════════

export interface RouterAddOptions {
	dto?: any
	middleware?: Function[]
	meta?: Record<string, any>
	hooks?: any
}

export interface RouterMatch {
	handler: HandlerFunction | null
	params: Record<string, string>
	dto?: any
	middleware?: Function[]
	meta?: Record<string, any>
	hooks?: any
	methodNotAllowed: boolean
	allowedMethods?: string[]
}

export declare class Router {
	add(method: string, path: string, handler: HandlerFunction, options?: RouterAddOptions): this
	find(method: string, path: string): RouterMatch | null
	use(fn: Function): this
	listRoutes(): RouteInfo[]
}

// ═══════════════════════════════════════════════
//  DI Container (v2)
// ═══════════════════════════════════════════════

/**
 * Dependency injection container with lifecycle management.
 *
 * - `register(name, instance)` — plain object → singleton
 * - `register(name, factory)` — function → lazy singleton factory
 * - `singleton(name, factory)` — explicit singleton factory
 * - `transient(name, factory)` — new instance per resolve()
 * - `scoped(name, factory)` — per-scope instance (via createScope)
 */
export declare class Container {
	register(name: string, instanceOrFactory: any): void
	registerAll(map: Record<string, any>): void
	singleton(name: string, factory: (container: Container) => any): void
	transient(name: string, factory: (container: Container) => any): void
	scoped(name: string, factory: (container: Container | ScopedContainer) => any): void
	resolve(name: string): any | null
	getAll(): Readonly<ServiceMap>
	has(name: string): boolean
	list(): string[]
	createScope(): ScopedContainer
	unregister(name: string): void
	clear(): void
}

/**
 * Scoped container — child of a parent Container.
 * Scoped services get a per-scope instance.
 */
export declare class ScopedContainer {
	resolve(name: string): any | null
	getAll(): Readonly<ServiceMap>
	has(name: string): boolean
	list(): string[]
}

// ═══════════════════════════════════════════════
//  Event Bus
// ═══════════════════════════════════════════════

export type EventHandler = (data: any) => void | Promise<void>

export declare class EventBus {
	debug: boolean
	on(event: string, handler: EventHandler): this
	once(event: string, handler: EventHandler): this
	emit(event: string, data?: any): Promise<void>
	off(event: string, handler?: EventHandler): this
	listEvents(): EventInfo[]
	clear(): void
	destroy(): void
}

// ═══════════════════════════════════════════════
//  Errors & Logging
// ═══════════════════════════════════════════════

export declare class HttpError extends Error {
	status: number
	details: any
	constructor(status?: number, message?: string, details?: any)
	toJSON(): { error: string; status: number; details?: any }
}

export declare class ValidationError extends HttpError {
	constructor(errors: Array<{ field: string; message: string }>)
}

export declare class ModuleError extends Error {
	moduleName: string
	constructor(moduleName: string, message: string)
}

export interface LoggerOptions {
	level?: 'error' | 'warn' | 'info' | 'debug'
	transport?: (level: string, message: string, data?: any) => void
	timestamps?: boolean
}

/**
 * Structured logger with levels and pluggable transport.
 */
export declare class Logger {
	constructor(options?: LoggerOptions)
	error(message: string, data?: any): void
	warn(message: string, data?: any): void
	info(message: string, data?: any): void
	debug(message: string, data?: any): void
	child(prefix: string): Logger
}

// ═══════════════════════════════════════════════
//  DTO Validation
// ═══════════════════════════════════════════════

export type DTORule = string[]
export type DTOSchema = Record<string, DTORule | Function | DTOSchema>

export interface DTOAdapterSchema {
	adapter: string
	schema: any
}

export declare function dto(schema: DTOSchema): DTOSchema
export declare function validate(data: any, schema: DTOSchema | DTOAdapterSchema): any
export declare function registerAdapter(
	name: string,
	fn: (schema: any, data: any) => { errors?: any[]; output?: any },
): void

// ═══════════════════════════════════════════════
//  Module Loader
// ═══════════════════════════════════════════════

/**
 * Create a module definition programmatically (without file system).
 */
export declare function createModule(definition: ProgrammaticModuleDefinition): any

/**
 * Set a custom body parser (e.g. busboy-based).
 */
export declare function setBodyParser(
	parser: (req: IncomingMessage, options: any) => Promise<{ body: any; files: any }>,
): void

// ═══════════════════════════════════════════════
//  Core Public API
// ═══════════════════════════════════════════════

export declare function createApp(config?: AppConfig): Promise<SuperApp>

export declare function defineAuth(
	verifier: (token: string, request?: RequestContext) => any | Promise<any>,
): void

export declare function defineGuard(
	name: string,
	factory: (params?: string) => PipeFunction,
): void

export declare function dir(importMetaUrl: string, ...paths: string[]): string

// ═══════════════════════════════════════════════
//  View Engine (SSR Templates)
// ═══════════════════════════════════════════════

export interface ViewEngineOptions {
	dir: string
	layout?: string
	globals?: Record<string, any>
	helpers?: Record<string, (...args: any[]) => any>
	cacheMax?: number
}

export interface RenderOptions {
	layout?: string | false
}

export interface RenderRouteOptions {
	layout?: string | false
}

export type ViewDataFunction = (
	request: RequestContext,
	services: ServiceMap,
) => Record<string, any> | Promise<Record<string, any>>

export interface ViewSettings {
	layout?: string
	globals?: Record<string, any>
	helpers?: Record<string, (...args: any[]) => any>
}

/**
 * Template engine with [= expr], [# if/each], [> include] syntax.
 * AOT-compiled to JS functions with LRU cache.
 */
export declare class ViewEngine {
	constructor(options?: ViewEngineOptions)
	addHelper(name: string, fn: (...args: any[]) => any): void
	render(name: string, data?: Record<string, any>, options?: RenderOptions): Promise<string>
	clearCache(): void
}
