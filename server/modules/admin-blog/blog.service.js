import BlogPost from '../../models/BlogPost.js'

const BLOCK_TYPES = new Set(['title', 'subtitle', 'paragraph', 'italic', 'image', 'map', 'cta'])

export function slugify(text = '') {
  const map = { ğ: 'g', ü: 'u', ş: 's', ı: 'i', ö: 'o', ç: 'c', Ğ: 'g', Ü: 'u', Ş: 's', İ: 'i', Ö: 'o', Ç: 'c' }
  return String(text)
    .trim()
    .replace(/[ğüşıöçĞÜŞİÖÇ]/g, char => map[char] || char)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 180)
}

function cleanBlock(block = {}) {
  const type = BLOCK_TYPES.has(block.type) ? block.type : 'paragraph'
  return {
    type,
    text: String(block.text || '').trim(),
    image: String(block.image || '').trim(),
    imageAlt: String(block.imageAlt || '').trim(),
    embedUrl: String(block.embedUrl || '').trim(),
    buttonLabel: String(block.buttonLabel || '').trim(),
    buttonHref: String(block.buttonHref || '').trim(),
  }
}

function parseBlocks(raw) {
  if (!raw) return []
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    return Array.isArray(parsed) ? parsed.map(cleanBlock) : []
  } catch {
    return []
  }
}

async function uniqueSlug(baseSlug, excludeId = null) {
  let slug = baseSlug || 'yazi'
  let suffix = 0

  while (true) {
    const candidate = suffix ? `${slug}-${suffix}` : slug
    const query = { slug: candidate }
    if (excludeId) query._id = { $ne: excludeId }
    const exists = await BlogPost.exists(query)
    if (!exists) return candidate
    suffix += 1
  }
}

function normalizePostData(data, { isCreate = false } = {}) {
  const title = String(data.title || '').trim()
  const excerpt = String(data.excerpt || '').trim()
  const blocks = parseBlocks(data.blocksJson ?? data.blocks)
  const published = data.published === true || data.published === 'true' || data.published === 'on'
  const sortOrder = Number(data.sortOrder) || 0

  return {
    title,
    slug: String(data.slug || '').trim(),
    excerpt,
    coverImage: String(data.coverImage || '').trim(),
    blocks,
    metaTitle: String(data.metaTitle || '').trim(),
    metaDescription: String(data.metaDescription || '').trim(),
    metaImage: String(data.metaImage || '').trim(),
    robots: String(data.robots || 'index, follow').trim() || 'index, follow',
    published,
    publishedAt: published
      ? (data.publishedAt ? new Date(data.publishedAt) : new Date())
      : null,
    sortOrder,
    isCreate,
  }
}

export const blogStore = {
  async list({ publishedOnly = false } = {}) {
    const filter = publishedOnly ? { published: true } : {}
    return BlogPost.find(filter).sort({ sortOrder: 1, publishedAt: -1, createdAt: -1 })
  },

  async getById(id) {
    return BlogPost.findById(id)
  },

  async getBySlug(slug) {
    return BlogPost.findOne({ slug, published: true })
  },

  async getAdminBySlug(slug) {
    return BlogPost.findOne({ slug })
  },

  async prepareCreate(data) {
    const normalized = normalizePostData(data, { isCreate: true })
    const baseSlug = slugify(normalized.slug || normalized.title)
    normalized.slug = await uniqueSlug(baseSlug)
    if (normalized.published && !normalized.publishedAt) {
      normalized.publishedAt = new Date()
    }
    delete normalized.isCreate
    return normalized
  },

  async prepareUpdate(id, data) {
    const normalized = normalizePostData(data)
    const existing = await BlogPost.findById(id)
    if (!existing) return null

    const baseSlug = slugify(normalized.slug || normalized.title || existing.slug)
    normalized.slug = await uniqueSlug(baseSlug, id)

    if (normalized.published && !existing.publishedAt && !data.publishedAt) {
      normalized.publishedAt = new Date()
    } else if (existing.publishedAt) {
      normalized.publishedAt = existing.publishedAt
    }

    delete normalized.isCreate
    return normalized
  },

  async create(data) {
    const post = await BlogPost.create(data)
    return post
  },

  async update(id, data) {
    return BlogPost.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true })
  },

  async delete(id) {
    return BlogPost.findByIdAndDelete(id)
  },

  parseBlocks,
}
