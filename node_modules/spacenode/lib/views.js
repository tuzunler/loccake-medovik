// ─────────────────────────────────────────────
// SpaceNode — Template Engine (v1.0.0)
// ─────────────────────────────────────────────
//   - Syntax: [= expr], [# if/each], [> include]
//   - AOT compilation to JS functions
//   - LRU cache for compiled templates
//   - Layout system (single `body` variable)
//   - Include with scope isolation
//   - Contextual auto-escaping (XSS protection)
//   - Built-in helpers: raw, upper, lower, capitalize, truncate, date, json, pad, plural, currency
//   - settings.js auto-discovery for globals & helpers

import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, resolve, extname } from 'node:path'

// ── HTML escaping ──

const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
const ESC_RE = /[&<>"']/g

function escapeHtml(val) {
  if (val == null) return ''
  const s = String(val)
  return ESC_RE.test(s) ? s.replace(ESC_RE, (ch) => ESC_MAP[ch]) : s
}

// ── Built-in helpers ──

const BUILTIN_HELPERS = {
  raw: (v) => v,
  upper: (v) => String(v ?? '').toUpperCase(),
  lower: (v) => String(v ?? '').toLowerCase(),
  capitalize: (v) => { const s = String(v ?? ''); return s.charAt(0).toUpperCase() + s.slice(1) },
  truncate: (v, len = 100, suffix = '...') => {
    const s = String(v ?? '')
    return s.length > len ? s.slice(0, len) + suffix : s
  },
  date: (v, fmt = 'YYYY-MM-DD') => {
    const d = v instanceof Date ? v : new Date(v)
    if (isNaN(d.getTime())) return String(v ?? '')
    const pad = (n) => String(n).padStart(2, '0')
    return fmt
      .replace('YYYY', d.getFullYear())
      .replace('MM', pad(d.getMonth() + 1))
      .replace('DD', pad(d.getDate()))
      .replace('HH', pad(d.getHours()))
      .replace('mm', pad(d.getMinutes()))
      .replace('ss', pad(d.getSeconds()))
  },
  json: (v) => JSON.stringify(v),
  pad: (v, len = 2, ch = '0') => String(v ?? '').padStart(len, ch),
  plural: (n, one, many) => `${n} ${n === 1 ? one : many}`,
  currency: (v, code = 'USD') => {
    const n = Number(v)
    if (isNaN(n)) return String(v ?? '')
    try { return n.toLocaleString('en-US', { style: 'currency', currency: code }) }
    catch { return `${n.toFixed(2)} ${code}` }
  },
}

// ── Tokenizer ──

// Token types
const T_TEXT   = 0 // raw HTML text
const T_EXPR   = 1 // [= expr]
const T_OPEN   = 2 // [# if cond] or [# each arr as item]
const T_CLOSE  = 3 // [/if] or [/each]
const T_ELSE   = 4 // [# else]
const T_INC    = 5 // [> file] or [> file { data }]

function tokenize(src) {
  const tokens = []
  let i = 0
  const len = src.length

  while (i < len) {
    // Find next `[`
    const start = src.indexOf('[', i)
    if (start === -1) {
      // Rest is text
      if (i < len) tokens.push({ type: T_TEXT, value: src.slice(i) })
      break
    }

    // Text before tag
    if (start > i) {
      tokens.push({ type: T_TEXT, value: src.slice(i, start) })
    }

    // Check what follows `[`
    const next = src[start + 1]

    if (next === '=') {
      // [= expr]
      const end = src.indexOf(']', start + 2)
      if (end === -1) {
        tokens.push({ type: T_TEXT, value: src.slice(start) })
        break
      }
      tokens.push({ type: T_EXPR, value: src.slice(start + 2, end).trim() })
      i = end + 1

    } else if (next === '#') {
      // [# if/each/else]
      const end = src.indexOf(']', start + 2)
      if (end === -1) {
        tokens.push({ type: T_TEXT, value: src.slice(start) })
        break
      }
      const content = src.slice(start + 2, end).trim()
      if (content === 'else') {
        tokens.push({ type: T_ELSE })
      } else {
        tokens.push({ type: T_OPEN, value: content })
      }
      i = end + 1

    } else if (next === '/') {
      // [/if] or [/each]
      const end = src.indexOf(']', start + 2)
      if (end === -1) {
        tokens.push({ type: T_TEXT, value: src.slice(start) })
        break
      }
      tokens.push({ type: T_CLOSE, value: src.slice(start + 2, end).trim() })
      i = end + 1

    } else if (next === '>') {
      // [> file] or [> file { data }]
      const end = src.indexOf(']', start + 2)
      if (end === -1) {
        tokens.push({ type: T_TEXT, value: src.slice(start) })
        break
      }
      tokens.push({ type: T_INC, value: src.slice(start + 2, end).trim() })
      i = end + 1

    } else {
      // Not a template tag, just a `[`
      tokens.push({ type: T_TEXT, value: '[' })
      i = start + 1
    }
  }

  return tokens
}

// ── AST Builder ──

// Node types
const N_TEXT  = 'text'
const N_EXPR  = 'expr'
const N_IF    = 'if'
const N_EACH  = 'each'
const N_INC   = 'include'
const N_BLOCK = 'block'

function buildAST(tokens) {
  const root = []
  const stack = [root]

  function current() { return stack[stack.length - 1] }

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i]

    switch (tok.type) {
      case T_TEXT:
        current().push({ type: N_TEXT, value: tok.value })
        break

      case T_EXPR:
        current().push({ type: N_EXPR, value: tok.value })
        break

      case T_OPEN: {
        const val = tok.value
        if (val.startsWith('if ')) {
          const node = { type: N_IF, condition: val.slice(3).trim(), then: [], else: [] }
          current().push(node)
          stack.push(node.then)
        } else if (val.startsWith('each ')) {
          // Parse: each arr as item, i
          const body = val.slice(5).trim()
          const asIndex = body.indexOf(' as ')
          if (asIndex === -1) {
            throw new SyntaxError(`Invalid each syntax: [# ${val}]. Expected: [# each array as item] or [# each array as item, index]`)
          }
          const arrExpr = body.slice(0, asIndex).trim()
          const vars = body.slice(asIndex + 4).trim()
          const commaIdx = vars.indexOf(',')
          let itemVar, indexVar
          if (commaIdx !== -1) {
            itemVar = vars.slice(0, commaIdx).trim()
            indexVar = vars.slice(commaIdx + 1).trim()
          } else {
            itemVar = vars.trim()
            indexVar = null
          }
          const node = { type: N_EACH, array: arrExpr, item: itemVar, index: indexVar, body: [] }
          current().push(node)
          stack.push(node.body)
        } else if (val === 'block' || val.startsWith('block ')) {
          const blockName = val.slice(6).trim()
          if (!blockName) throw new SyntaxError('Block name is required: [# block name]')
          const node = { type: N_BLOCK, name: blockName, body: [] }
          current().push(node)
          stack.push(node.body)
        } else {
          throw new SyntaxError(`Unknown block: [# ${val}]`)
        }
        break
      }

      case T_ELSE: {
        // Pop then-branch, push else-branch
        if (stack.length <= 1) {
          throw new SyntaxError('[# else] without matching [# if]')
        }
        stack.pop()
        const parent = current()
        const ifNode = parent[parent.length - 1]
        if (!ifNode || ifNode.type !== N_IF) {
          throw new SyntaxError('[# else] without matching [# if]')
        }
        stack.push(ifNode.else)
        break
      }

      case T_CLOSE: {
        const val = tok.value
        stack.pop()
        if (stack.length === 0) {
          throw new SyntaxError(`Unexpected closing tag: [/${val}]`)
        }
        break
      }

      case T_INC: {
        // Parse: file or file { data }
        const val = tok.value
        const braceIdx = val.indexOf('{')
        let file, data
        if (braceIdx !== -1) {
          file = val.slice(0, braceIdx).trim()
          data = val.slice(braceIdx).trim()
        } else {
          file = val.trim()
          data = null
        }
        current().push({ type: N_INC, file, data })
        break
      }
    }
  }

  if (stack.length !== 1) {
    throw new SyntaxError('Unclosed block tag — missing [/if] or [/each]')
  }

  return root
}


// ── Compiler: AST → JavaScript function string ──

/**
 * Parse pipe filter syntax from expression:
 *   "user.name | upper | truncate:20"
 *   → { expr: "user.name", filters: [{name:"upper",args:[]}, {name:"truncate",args:["20"]}] }
 *
 * Pipes use ` | ` (space-pipe-space) to avoid conflict with `||` logical OR.
 * Respects string boundaries — won't split inside quotes.
 */
function _parsePipeExpr(value) {
  const parts = _splitPipes(value)
  if (parts.length <= 1) return { expr: value, filters: [] }

  const expr = parts[0]
  const filters = []
  for (let i = 1; i < parts.length; i++) {
    const seg = parts[i]
    const colonIdx = seg.indexOf(':')
    if (colonIdx === -1) {
      filters.push({ name: seg, args: [] })
    } else {
      const name = seg.slice(0, colonIdx)
      const args = _splitFilterArgs(seg.slice(colonIdx + 1))
      filters.push({ name, args })
    }
  }
  return { expr, filters }
}

/** Split expression on ` | ` (space-pipe-space) outside of string literals */
function _splitPipes(str) {
  const parts = []
  let cur = ''
  let inSQ = false, inDQ = false, inBT = false

  for (let i = 0; i < str.length; i++) {
    const ch = str[i]
    const prev = i > 0 ? str[i - 1] : ''

    if (ch === "'" && !inDQ && !inBT && prev !== '\\') inSQ = !inSQ
    else if (ch === '"' && !inSQ && !inBT && prev !== '\\') inDQ = !inDQ
    else if (ch === '`' && !inSQ && !inDQ && prev !== '\\') inBT = !inBT

    if (!inSQ && !inDQ && !inBT &&
        ch === '|' && str[i + 1] === ' ' && (i === 0 || str[i - 1] === ' ') &&
        str[i + 1] !== '|' && (i === 0 || str[i - 1] !== '|')) {
      parts.push(cur.trimEnd())
      cur = ''
      i++ // skip space after |
      continue
    }
    cur += ch
  }
  if (cur.trim()) parts.push(cur.trim())
  return parts
}

/** Split filter arguments on `:` outside of string literals */
function _splitFilterArgs(str) {
  const args = []
  let cur = ''
  let inSQ = false, inDQ = false

  for (let i = 0; i < str.length; i++) {
    const ch = str[i]
    const prev = i > 0 ? str[i - 1] : ''

    if (ch === "'" && !inDQ && prev !== '\\') inSQ = !inSQ
    else if (ch === '"' && !inSQ && prev !== '\\') inDQ = !inDQ

    if (ch === ':' && !inSQ && !inDQ) {
      args.push(cur.trim())
      cur = ''
      continue
    }
    cur += ch
  }
  if (cur.trim()) args.push(cur.trim())
  return args
}

function compileNode(node, ctx) {
  switch (node.type) {
    case N_TEXT:
      return `__out+=${JSON.stringify(node.value)};`

    case N_EXPR: {
      const { expr, filters } = _parsePipeExpr(node.value)
      const isRaw = /^raw\s*\(/.test(expr)

      if (filters.length === 0) {
        // No pipe filters — existing behavior
        if (isRaw) {
          const inner = expr.replace(/^raw\s*\(\s*/, '').replace(/\s*\)\s*$/, '')
          return `__v=${inner};if(__v!=null)__out+=String(__v);`
        }
        return `__v=(${expr});if(__v!=null)__out+=__esc(__v);`
      }

      // Build filter chain: each filter wraps the previous value
      const baseExpr = isRaw
        ? expr.replace(/^raw\s*\(\s*/, '').replace(/\s*\)\s*$/, '')
        : expr
      let code = `__v=(${baseExpr});`
      for (const f of filters) {
        const args = f.args.length ? ',' + f.args.join(',') : ''
        code += `if(__v!=null)__v=${f.name}(__v${args});`
      }
      code += `if(__v!=null)__out+=${isRaw ? 'String(__v)' : '__esc(__v)'};`
      return code
    }

    case N_IF: {
      let code = `if(${node.condition}){`
      for (const child of node.then) code += compileNode(child, ctx)
      code += '}'
      if (node.else.length > 0) {
        code += 'else{'
        for (const child of node.else) code += compileNode(child, ctx)
        code += '}'
      }
      return code
    }

    case N_EACH: {
      const arrVar = `__arr${ctx.arrCount++}`
      let code = `let ${arrVar}=(${node.array});`
      code += `if(${arrVar}&&${arrVar}.length){`
      code += `for(let __i=0;__i<${arrVar}.length;__i++){`
      code += `let ${node.item}=${arrVar}[__i];`
      if (node.index) {
        code += `let ${node.index}=__i;`
      }
      for (const child of node.body) code += compileNode(child, ctx)
      code += '}}'
      return code
    }

    case N_INC: {
      const id = ctx.incCount++
      ctx.includes.push({ id, file: node.file, data: node.data })
      return `__out+=__inc${id};`
    }

    case N_BLOCK: {
      let code = `{let __prev=__out;__out='';`
      for (const child of node.body) code += compileNode(child, ctx)
      code += `__blocks[${JSON.stringify(node.name)}]=__out;__out=__prev;}`
      return code
    }
  }

  return ''
}

function compileAST(ast) {
  const ctx = { arrCount: 0, incCount: 0, includes: [] }
  let body = ''
  for (const node of ast) {
    body += compileNode(node, ctx)
  }
  return { body, includes: ctx.includes }
}


// ── Template Engine ──

export class ViewEngine {
  /**
   * @param {object} options
   * @param {string} options.dir — absolute path to views directory
   * @param {string} [options.layout] — default layout name (without extension)
   * @param {object} [options.globals] — global variables for all templates
   * @param {object} [options.helpers] — custom helper functions
   * @param {number} [options.cacheMax] — max cached compiled templates
   */
  constructor(options = {}) {
    this._dir = options.dir
    this._layout = options.layout || null
    this._globals = options.globals || {}
    this._helpers = { ...BUILTIN_HELPERS, ...(options.helpers || {}) }
    this._cache = new Map()
    this._cacheMax = options.cacheMax || 500
    this._srcCache = new Map()
  }

  /**
   * Register a custom helper function.
   */
  addHelper(name, fn) {
    this._helpers[name] = fn
  }

  /**
   * Render a template with data.
   *
   * @param {string} name — template name (relative to views dir, without .html)
   * @param {object} [data] — template data
   * @param {object} [options]
   * @param {string|false} [options.layout] — override layout, false to disable
   * @returns {Promise<string>} — rendered HTML
   */
  async render(name, data = {}, options = {}) {
    // Merge globals into data (data takes precedence)
    const mergedData = { ...this._globals, ...data }

    // Render the template
    const result = await this._renderTemplate(name, mergedData)
    const content = result.__html
    const blocks = result.__blocks || {}

    // Apply layout
    const layoutName = options.layout !== undefined ? options.layout : this._layout
    if (layoutName === false || !layoutName) {
      return content
    }

    // Render layout with body = content + blocks as extra variables
    const layoutData = { ...mergedData, ...blocks, body: content }
    return (await this._renderTemplate(layoutName, layoutData)).__html
  }

  /**
   * Internal: render a template by name with given scope.
   */
  async _renderTemplate(name, scope) {
    const compiled = await this._compile(name)
    return compiled(scope)
  }

  /**
   * Internal: compile a template (with LRU cache).
   */
  async _compile(name) {
    const cached = this._cache.get(name)
    if (cached) {
      // LRU: move to end
      this._cache.delete(name)
      this._cache.set(name, cached)
      return cached
    }

    const src = await this._readTemplate(name)
    const tokens = tokenize(src)
    const ast = buildAST(tokens)
    const { body, includes } = compileAST(ast)

    // Pre-compile all includes
    const includeCompilers = []
    for (const inc of includes) {
      const incCompiled = await this._compile(inc.file)
      includeCompilers.push({ ...inc, compiled: incCompiled })
    }

    // Build the render function
    const fn = this._buildFunction(body, includeCompilers)

    // LRU eviction
    this._cache.set(name, fn)
    while (this._cache.size > this._cacheMax) {
      const first = this._cache.keys().next().value
      this._cache.delete(first)
    }

    return fn
  }

  /**
   * Internal: build the actual render function from compiled body.
   */
  _buildFunction(body, includes) {
    const helpers = this._helpers
    const engine = this

    return async function render(scope) {
      // Resolve includes
      const incResults = {}
      for (const inc of includes) {
        let incScope
        if (inc.data) {
          // Evaluate data expression in parent scope context
          try {
            const merged = { ...scope, ...helpers }
            const proxy = new Proxy(merged, {
              has(target, key) {
                if (typeof key === 'symbol') return key in target
                if (key in target) return true
                return !(key in globalThis)
              },
              get(target, key) {
                return key in target ? target[key] : undefined
              },
            })
            const dataFn = new Function('__scope', `with(__scope){return (${inc.data})}`)
            incScope = dataFn(proxy)
          } catch {
            incScope = {}
          }
        } else {
          incScope = scope
        }
        const incResult = await inc.compiled(incScope)
        incResults[inc.id] = incResult.__html
      }

      // Build unified scope object: data + helpers + includes + builtins
      const __scope = { ...scope }

      // Add helpers (don't overwrite data)
      for (const k of Object.keys(helpers)) {
        if (!(k in __scope)) __scope[k] = helpers[k]
      }

      // Add include results
      for (const inc of includes) {
        __scope[`__inc${inc.id}`] = incResults[inc.id]
      }

      // Add builtins
      __scope.__esc = escapeHtml

      // Execute compiled function using Proxy + `with` for safe variable resolution
      // Proxy `has` trap intercepts scope vars + unknown vars (→ undefined),
      // but lets JS globals (String, Math, etc.) resolve normally
      const __proxy = new Proxy(__scope, {
        has(target, key) {
          if (typeof key === 'symbol') return key in target
          if (key in target) return true
          return !(key in globalThis)
        },
        get(target, key) {
          return key in target ? target[key] : undefined
        },
      })
      const fnBody = `with(__scope){let __out='',__v,__blocks={};${body}return {__html:__out,__blocks};}`
      try {
        const fn = new Function('__scope', fnBody)
        return fn(__proxy)
      } catch (err) {
        throw new Error(`Template render error: ${err.message}`)
      }
    }
  }

  /**
   * Internal: read template source from disk.
   */
  async _readTemplate(name) {
    // Try with and without .html extension
    const candidates = []
    if (extname(name)) {
      candidates.push(name)
    } else {
      candidates.push(name + '.html')
      candidates.push(join(name, 'index.html'))
    }

    for (const candidate of candidates) {
      const filePath = resolve(join(this._dir, candidate))

      // Path traversal protection
      if (!filePath.startsWith(resolve(this._dir))) {
        throw new Error(`Template path traversal blocked: ${name}`)
      }

      try {
        return await readFile(filePath, 'utf8')
      } catch {
        continue
      }
    }

    throw new Error(`Template not found: "${name}" (searched in ${this._dir})`)
  }

  /**
   * Resolve include file path. Search order:
   * 1. views/components/{name}.html
   * 2. views/{name}.html
   */
  async _resolveInclude(name) {
    // Already resolved to full path from views dir
    return name
  }

  /**
   * Clear template cache.
   */
  clearCache() {
    this._cache.clear()
    this._srcCache.clear()
  }
}


/**
 * Load settings.js from views directory if it exists.
 *
 * @param {string} viewsDir — absolute path
 * @returns {Promise<object>}
 */
export async function loadViewSettings(viewsDir) {
  const settingsPath = join(viewsDir, 'settings.js')
  if (!existsSync(settingsPath)) return {}

  try {
    const mod = await import('file://' + settingsPath.replace(/\\/g, '/'))
    return mod.default || mod
  } catch (err) {
    throw new Error(`Failed to load views/settings.js: ${err.message}`)
  }
}
