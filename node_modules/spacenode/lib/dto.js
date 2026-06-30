// ─────────────────────────────────────────────
// SpaceNode — DTO Validation
// ─────────────────────────────────────────────
// Built-in validation + adapter support for Zod/Joi/Yup.
//
// Built-in syntax:
//   { email: ['string', 'required', 'email'], age: ['number', 'min:18', 'max:99'] }
//
// External adapter:
//   { adapter: 'zod', schema: zodSchema }

import { ValidationError } from './errors.js'

// ── Built-in validators ──

const VALIDATORS = {
  string:   (v) => typeof v === 'string',
  number:   (v) => typeof v === 'number' && !isNaN(v),
  boolean:  (v) => typeof v === 'boolean',
  array:    (v) => Array.isArray(v),
  object:   (v) => v !== null && typeof v === 'object' && !Array.isArray(v),
  email:    (v) => typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
  url:      (v) => typeof v === 'string' && /^https?:\/\/.+/.test(v),
  uuid:     (v) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v),
  date:     (v) => !isNaN(Date.parse(v)),
  required: () => true, // handled separately
}

const PARAM_VALIDATORS = {
  min: (v, param) => {
    if (typeof v === 'string') return v.length >= Number(param)
    if (typeof v === 'number') return v >= Number(param)
    if (Array.isArray(v)) return v.length >= Number(param)
    return false
  },
  max: (v, param) => {
    if (typeof v === 'string') return v.length <= Number(param)
    if (typeof v === 'number') return v <= Number(param)
    if (Array.isArray(v)) return v.length <= Number(param)
    return false
  },
  length: (v, param) => {
    if (typeof v === 'string' || Array.isArray(v)) return v.length === Number(param)
    return false
  },
  pattern: (v, param) => {
    if (typeof v !== 'string') return false
    try {
      // Safety: limit pattern length to prevent ReDoS
      if (param.length > 200) return false
      return new RegExp(param).test(v)
    } catch {
      return false
    }
  },
  enum: (v, param) => param.split(',').includes(String(v)),
  default: () => true, // handled separately as value assignment
}

/**
 * Parse a DTO rule array like ['string', 'required', 'min:6', 'email']
 */
function parseRule(ruleArr) {
  if (typeof ruleArr === 'function') {
    return { custom: ruleArr }
  }
  // Object format: { type: 'string', required: true, min: 6, max: 100, ... }
  if (!Array.isArray(ruleArr) && typeof ruleArr === 'object' && ruleArr !== null) {
    if (ruleArr.type) {
      const rules = {
        required: !!ruleArr.required,
        type: VALIDATORS[ruleArr.type] ? ruleArr.type : null,
        checks: [],
        extraTypeChecks: [],
        defaultValue: ruleArr.default,
      }
      for (const [key, val] of Object.entries(ruleArr)) {
        if (key === 'type' || key === 'required' || key === 'optional' || key === 'default') continue
        if (VALIDATORS[key]) {
          rules.extraTypeChecks.push(key)
        } else if (PARAM_VALIDATORS[key]) {
          rules.checks.push({ name: key, param: String(val) })
        }
      }
      if (ruleArr.optional) rules.required = false
      if (ruleArr.default !== undefined) rules.required = false
      return rules
    }
    return { nested: ruleArr }
  }

  const parts = Array.isArray(ruleArr) ? ruleArr : [ruleArr]
  const rules = {
    required: false,
    type: null,
    checks: [],
    defaultValue: undefined
  }

  for (const part of parts) {
    const [name, ...paramParts] = part.split(':')
    const param = paramParts.join(':') // rejoin in case value has colons

    if (name === 'required') {
      rules.required = true
    } else if (name === 'optional') {
      rules.required = false
    } else if (name === 'default') {
      rules.defaultValue = param
      rules.required = false
    } else if (VALIDATORS[name]) {
      rules.type = name
    } else if (PARAM_VALIDATORS[name]) {
      rules.checks.push({ name, param })
    }
  }

  return rules
}

/**
 * Validate data against a built-in DTO schema
 */
function validateBuiltIn(data, schema) {
  const errors = []
  const output = {}

  for (const [field, ruleStr] of Object.entries(schema)) {
    const rules = parseRule(ruleStr)

    // Custom function validator
    if (rules.custom) {
      const result = rules.custom(data[field], data)
      if (result !== true) {
        errors.push({ field, message: typeof result === 'string' ? result : `${field} is invalid` })
      } else {
        output[field] = data[field]
      }
      continue
    }

    // Nested object validation
    if (rules.nested) {
      if (data[field] && typeof data[field] === 'object') {
        const nested = validateBuiltIn(data[field], rules.nested)
        if (nested.errors.length) {
          for (const err of nested.errors) {
            errors.push({ field: `${field}.${err.field}`, message: err.message })
          }
        } else {
          output[field] = nested.output
        }
      } else if (rules.required) {
        errors.push({ field, message: `${field} must be an object` })
      }
      continue
    }

    let value = data?.[field]

    // Default value
    if ((value === undefined || value === null) && rules.defaultValue !== undefined) {
      value = rules.defaultValue
    }

    // Required check
    if (rules.required && (value === undefined || value === null || value === '')) {
      errors.push({ field, message: `${field} is required` })
      continue
    }

    // Skip validation if optional and not provided
    if (!rules.required && (value === undefined || value === null)) {
      continue
    }

    // Type check
    if (rules.type && !VALIDATORS[rules.type](value)) {
      errors.push({ field, message: `${field} must be a valid ${rules.type}` })
      continue
    }

    // Extra type checks (email, url, uuid, date — from object format)
    if (rules.extraTypeChecks) {
      let extraFailed = false
      for (const checkName of rules.extraTypeChecks) {
        if (!VALIDATORS[checkName](value)) {
          errors.push({ field, message: `${field} must be a valid ${checkName}` })
          extraFailed = true
        }
      }
      if (extraFailed) continue
    }

    // Param checks (min, max, etc.)
    for (const { name, param } of rules.checks) {
      if (!PARAM_VALIDATORS[name](value, param)) {
        errors.push({ field, message: `${field} failed ${name}:${param} check` })
      }
    }

    output[field] = value
  }

  return { errors, output }
}


// ── External adapters ──

const adapters = new Map()

/**
 * Register an external validation adapter (Zod, Joi, Yup, etc.)
 *
 *   registerAdapter('zod', (schema, data) => {
 *     const result = schema.safeParse(data)
 *     if (!result.success) return { errors: result.error.issues }
 *     return { output: result.data }
 *   })
 */
export function registerAdapter(name, fn) {
  adapters.set(name, fn)
}


// ── Main validation entry point ──

/**
 * Validate request body against DTO schema.
 * Supports built-in string rules AND external adapters.
 *
 * @param {object} data — request body
 * @param {object} dto — schema definition
 * @returns {object} validated/cleaned data
 * @throws {ValidationError} if validation fails
 */
export function validate(data, dto) {
  if (!dto) return data

  // External adapter: { adapter: 'zod', schema: zodSchema }
  if (dto.adapter && dto.schema) {
    const adapter = adapters.get(dto.adapter)
    if (!adapter) throw new Error(`DTO adapter "${dto.adapter}" not registered. Use registerAdapter().`)
    const result = adapter(dto.schema, data)
    if (result.errors && result.errors.length > 0) {
      throw new ValidationError(result.errors)
    }
    return result.output || data
  }

  // Built-in validation: { email: ['string', 'required'], age: ['number', 'min:18'] }
  const { errors, output } = validateBuiltIn(data || {}, dto)
  if (errors.length > 0) {
    throw new ValidationError(errors)
  }
  return output
}

/**
 * Create a reusable DTO schema (just returns the object, but makes intent clear)
 *
 *   const userDto = dto({
 *     email: ['string', 'required', 'email'],
 *     password: ['string', 'required', 'min:6'],
 *     name: ['string', 'required', 'min:2', 'max:50']
 *   })
 */
export function dto(schema) {
  return schema
}
