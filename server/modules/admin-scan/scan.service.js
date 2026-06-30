const STATIC_PAGES = [
  { type: 'Static', label: 'Home', path: '/' },
  { type: 'Static', label: 'Menu', path: '/menu' },
  { type: 'Static', label: 'About', path: '/about' },
  { type: 'Static', label: 'Contact', path: '/contact' },
  { type: 'Static', label: 'Delivery', path: '/delivery' },
  { type: 'Static', label: 'Payment', path: '/payment' },
  { type: 'Static', label: 'Birthday', path: '/birthday' },
]

function absoluteUrl(baseUrl, path) {
  return `${baseUrl.replace(/\/$/, '')}${path}`
}

function getTag(html, pattern) {
  return html.match(pattern)?.[1]?.trim() || ''
}

function analyzeHtml(html) {
  const title = getTag(html, /<title>(.*?)<\/title>/is)
  const description = getTag(html, /<meta\s+name=["']description["']\s+content=["'](.*?)["']/is)
  const canonical = getTag(html, /<link\s+rel=["']canonical["']\s+href=["'](.*?)["']/is)
  const h1Count = [...html.matchAll(/<h1\b/gi)].length
  const jsonLdCount = [...html.matchAll(/application\/ld\+json/gi)].length
  let imagesTotal = 0
  let imagesMissingAlt = 0
  let imagesEmptyAlt = 0

  for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
    imagesTotal++
    const alt = match[0].match(/\salt=["'](.*?)["']/i)?.[1]
    if (alt === undefined) {
      imagesMissingAlt++
    } else if (!alt.trim()) {
      imagesEmptyAlt++
    }
  }

  const issues = []
  if (!title) issues.push('Missing title')
  if (!description) issues.push('Missing description')
  if (!canonical) issues.push('Missing canonical')
  if (h1Count !== 1) issues.push(`H1 count: ${h1Count}`)
  if (jsonLdCount < 1) issues.push('Missing JSON-LD')
  if (imagesMissingAlt > 0) issues.push(`Images missing alt: ${imagesMissingAlt}`)
  if (imagesEmptyAlt > 0) issues.push(`Images with empty alt: ${imagesEmptyAlt}`)

  return {
    title,
    description,
    canonical,
    h1Count,
    jsonLdCount,
    imagesTotal,
    imagesMissingAlt,
    imagesEmptyAlt,
    issues,
  }
}

async function scanUrl(page, baseUrl) {
  const url = absoluteUrl(baseUrl, page.path)
  const startedAt = Date.now()

  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(10_000),
    })
    const responseTimeMs = Date.now() - startedAt
    const contentType = response.headers.get('content-type') || ''
    const html = contentType.includes('text/html') ? await response.text() : ''
    const analysis = html ? analyzeHtml(html) : { issues: ['Response is not HTML'] }
    const issues = [...(analysis.issues || [])]

    if (!response.ok) issues.unshift(`HTTP ${response.status}`)

    return {
      ...page,
      url,
      status: response.status,
      ok: response.ok && issues.length === 0,
      responseTimeMs,
      contentType,
      ...analysis,
      issues,
    }
  } catch (err) {
    return {
      ...page,
      url,
      status: 0,
      ok: false,
      responseTimeMs: Date.now() - startedAt,
      contentType: '',
      title: '',
      description: '',
      canonical: '',
      h1Count: 0,
      jsonLdCount: 0,
      imagesTotal: 0,
      imagesMissingAlt: 0,
      imagesEmptyAlt: 0,
      issues: [err.name === 'TimeoutError' ? 'Request timeout' : err.message],
    }
  }
}

export const pageScanStore = {
  async getPublicPages(publicStore) {
    const items = await publicStore.getItems()
    const productPages = items.map(item => ({
      type: 'Product',
      label: item.name,
      path: `/menu/${item._id}`,
    }))

    return [...STATIC_PAGES, ...productPages]
  },

  async scanPublicPages(baseUrl, publicStore) {
    const pages = await this.getPublicPages(publicStore)
    const results = []

    for (const page of pages) {
      results.push(await scanUrl(page, baseUrl))
    }

    return results
  },
}