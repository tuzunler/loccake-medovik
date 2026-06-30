// ─────────────────────────────────────────────
// SpaceNode — OpenAPI 3.0 Spec Generator
// ─────────────────────────────────────────────
// Auto-generates OpenAPI 3.0 specification from
// module configs, routes, DTO schemas, and pipes.
//
// Supports:
//   - Route metadata from module.js (summary, tags, deprecated)
//   - DTO schemas → request body JSON Schema
//   - Auth/role pipes → security requirements
//   - Method-based response defaults
//
// Note: String route format is no longer supported (v2).

/**
 * Convert a SpaceNode DTO schema to JSON Schema.
 */
function dtoToJsonSchema(dto) {
  if (!dto || typeof dto !== 'object') return null
  if (dto.adapter) return null

  const schema = { type: 'object', properties: {}, required: [] }

  for (const [field, ruleStr] of Object.entries(dto)) {
    if (typeof ruleStr === 'function') {
      schema.properties[field] = { description: 'Custom validator' }
      continue
    }
    if (typeof ruleStr === 'object' && ruleStr !== null && !Array.isArray(ruleStr)) {
      const nested = dtoToJsonSchema(ruleStr)
      if (nested) schema.properties[field] = nested
      continue
    }
    if (!Array.isArray(ruleStr)) continue

    const parts = ruleStr
    const prop = {}
    let isRequired = false

    for (const part of parts) {
      const [name, ...paramParts] = part.split(':')
      const param = paramParts.join(':')

      switch (name) {
        case 'string':   prop.type = 'string';  break
        case 'number':   prop.type = 'number';  break
        case 'boolean':  prop.type = 'boolean'; break
        case 'array':    prop.type = 'array';   break
        case 'object':   prop.type = 'object';  break
        case 'email':    prop.type = 'string'; prop.format = 'email';    break
        case 'url':      prop.type = 'string'; prop.format = 'uri';      break
        case 'uuid':     prop.type = 'string'; prop.format = 'uuid';     break
        case 'date':     prop.type = 'string'; prop.format = 'date-time'; break
        case 'required': isRequired = true; break
        case 'optional': break
        case 'min':
          if (prop.type === 'string') prop.minLength = Number(param)
          else if (prop.type === 'number') prop.minimum = Number(param)
          else if (prop.type === 'array') prop.minItems = Number(param)
          break
        case 'max':
          if (prop.type === 'string') prop.maxLength = Number(param)
          else if (prop.type === 'number') prop.maximum = Number(param)
          else if (prop.type === 'array') prop.maxItems = Number(param)
          break
        case 'length':
          if (prop.type === 'string') { prop.minLength = Number(param); prop.maxLength = Number(param) }
          break
        case 'enum':
          prop.enum = param.split(',')
          break
        case 'pattern':
          prop.pattern = param
          break
        case 'default':
          prop.default = param
          break
      }
    }

    if (!prop.type) prop.type = 'string'
    schema.properties[field] = prop
    if (isRequired) schema.required.push(field)
  }

  if (schema.required.length === 0) delete schema.required
  return schema
}

function toOpenAPIPath(path) {
  return path.replace(/:([^/]+)/g, '{$1}')
}

function extractPathParams(path) {
  const params = []
  const regex = /:([^/]+)/g
  let match
  while ((match = regex.exec(path)) !== null) {
    params.push({
      name: match[1],
      in: 'path',
      required: true,
      schema: { type: 'string' },
    })
  }
  return params
}

function requiresAuth(pipeNames) {
  if (!pipeNames) return false
  return pipeNames.some(p => typeof p === 'string' && (p === 'auth' || p.startsWith('role:')))
}

function defaultResponses(method, hasDto) {
  const responses = {}
  switch (method) {
    case 'GET':
      responses['200'] = { description: 'Successful response' }
      break
    case 'POST':
      responses['201'] = { description: 'Created successfully' }
      if (hasDto) responses['400'] = { description: 'Validation error' }
      break
    case 'PUT':
    case 'PATCH':
      responses['200'] = { description: 'Updated successfully' }
      if (hasDto) responses['400'] = { description: 'Validation error' }
      break
    case 'DELETE':
      responses['204'] = { description: 'Deleted successfully' }
      break
    default:
      responses['200'] = { description: 'Successful response' }
  }
  responses['500'] = { description: 'Internal server error' }
  return responses
}

/**
 * Generate an OpenAPI 3.0 spec from loaded modules and their routes.
 */
export function generateOpenAPISpec({ modules = [], routes = [], config = {} } = {}) {
  const spec = {
    openapi: '3.0.3',
    info: {
      title: config.title || 'SpaceNode API',
      version: config.version || '1.0.0',
      description: config.description || 'Auto-generated API documentation from SpaceNode modules.',
    },
    servers: config.servers || [{ url: '/', description: 'Current server' }],
    paths: {},
    components: {
      schemas: {},
      securitySchemes: {},
    },
    tags: [],
  }

  const tagSet = new Set()
  for (const mod of modules) {
    const tag = mod.config.name || mod.name
    if (!tagSet.has(tag)) {
      tagSet.add(tag)
      spec.tags.push({
        name: tag,
        description: mod.config.openapi?.description || `${tag} module`,
      })
    }
  }

  const hasAuth = routes.some(r => requiresAuth(r.pipeNames))
  if (hasAuth) {
    spec.components.securitySchemes.BearerAuth = {
      type: 'http',
      scheme: 'bearer',
      description: 'JWT or session token via Authorization header',
    }
  }

  for (const route of routes) {
    const openApiPath = toOpenAPIPath(route.path)
    const method = route.method.toLowerCase()
    const meta = route.openapi || {}

    if (!spec.paths[openApiPath]) {
      spec.paths[openApiPath] = {}
    }

    const operation = {
      summary: meta.summary || `${route.method} ${route.path}`,
      tags: meta.tags || [route.module],
      operationId: `${route.module}_${route.handler?.name || method}_${openApiPath.replace(/[^a-zA-Z0-9]/g, '_')}`,
      parameters: extractPathParams(route.path),
      responses: {},
    }

    if (meta.description) operation.description = meta.description
    if (meta.deprecated) operation.deprecated = true

    if (requiresAuth(route.pipeNames)) {
      operation.security = [{ BearerAuth: [] }]
    }

    if (route.dtoSchema && ['POST', 'PUT', 'PATCH'].includes(route.method)) {
      const jsonSchema = dtoToJsonSchema(route.dtoSchema.schema)
      if (jsonSchema) {
        const schemaName = route.dtoSchema.name
        spec.components.schemas[schemaName] = jsonSchema
        operation.requestBody = {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: `#/components/schemas/${schemaName}` },
            },
          },
        }
      }
    }

    if (meta.responses) {
      for (const [code, resp] of Object.entries(meta.responses)) {
        operation.responses[String(code)] = resp
      }
    } else {
      operation.responses = defaultResponses(route.method, !!route.dtoSchema)
    }

    if (route.method === 'GET' && meta.queryParams) {
      for (const qp of meta.queryParams) {
        operation.parameters.push({
          name: qp.name,
          in: 'query',
          required: qp.required || false,
          schema: { type: qp.type || 'string' },
          description: qp.description || '',
        })
      }
    }

    spec.paths[openApiPath][method] = operation
  }

  if (Object.keys(spec.components.schemas).length === 0) delete spec.components.schemas
  if (Object.keys(spec.components.securitySchemes).length === 0) delete spec.components.securitySchemes
  if (Object.keys(spec.components).length === 0) delete spec.components

  return spec
}
