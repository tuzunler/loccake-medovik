import SeoSettings from '../../models/SeoSettings.js'
import BlogPost from '../../models/BlogPost.js'

const DEFAULT_SITE_URL = 'https://www.loccake.com.tr'
const DEFAULT_IMAGE = '/uploads/seed-full-medovik.jpg'
const DEFAULT_ROBOTS_DISALLOW = ''
const SENSITIVE_ROBOTS_PATHS = new Set(['/admin', '/auth'])
const DEFAULT_PRODUCT_TITLE_TEMPLATE = '{name} | Loccake İzmir Alsancak'
const DEFAULT_PRODUCT_DESCRIPTION_TEMPLATE = '{category} kategorisinde {name}: {description} Loccake İzmir Alsancak mağaza teslim sipariş için WhatsApp veya telefonla ulaşın.'

const DEFAULT_PAGES = [
  {
    key: 'home',
    label: 'Ana Sayfa',
    path: '/',
    title: 'Loccake | İzmir Alsancak Rus Pastaları ve Medovik',
    description: 'İzmir Alsancak Loccake; Medovik, Napolyon, Spartak, özel doğum günü pastaları ve Avrupa tatlılarını geleneksel tariflerle hazırlar.',
    image: DEFAULT_IMAGE,
    changefreq: 'weekly',
    priority: 1,
  },
  {
    key: 'menu',
    label: 'Ürünlerimiz',
    path: '/menu',
    title: 'Ürünlerimiz | Rus Pastaları, Medovik ve Tatlılar | Loccake',
    description: 'Loccake ürün menüsünü inceleyin: Medovik, Napolyon, Spartak, kurabiyeler, özel pastalar ve Alsancak mağaza teslim sipariş seçenekleri.',
    image: '/uploads/seed-medovik-pasta-izmir.jpg',
    changefreq: 'weekly',
    priority: 0.9,
  },
  {
    key: 'about',
    label: 'Hakkımızda',
    path: '/about',
    title: 'Hakkımızda | İzmir Alsancak Rus Pastaları | Loccake',
    description: 'Loccake hikayesini keşfedin: Moskova’dan İzmir Alsancak’a uzanan geleneksel Rus pastaları, cafe atmosferi ve el yapımı tatlılar.',
    image: '/uploads/seed-cafe-1.jpeg',
    changefreq: 'monthly',
    priority: 0.7,
  },
  {
    key: 'contact',
    label: 'İletişim',
    path: '/contact',
    title: 'İletişim | Loccake Alsancak İzmir Adres ve Telefon',
    description: 'Loccake Alsancak adresi, telefon numarası, çalışma saatleri ve yol tarifi bilgileri. Sipariş ve bilgi için WhatsApp veya telefonla ulaşın.',
    image: '/uploads/seed-cafe-3.jpeg',
    changefreq: 'monthly',
    priority: 0.8,
  },
  {
    key: 'delivery',
    label: 'Paket Servis',
    path: '/delivery',
    title: 'Paket Servis ve Sipariş | Loccake İzmir Alsancak',
    description: 'Loccake pastaları için mağazadan teslim, WhatsApp, Instagram DM ve telefonla sipariş seçeneklerini inceleyin.',
    image: '/uploads/seed-cafe-1.jpeg',
    changefreq: 'monthly',
    priority: 0.7,
  },
  {
    key: 'payment',
    label: 'Ödeme Yöntemleri',
    path: '/payment',
    title: 'Ödeme Yöntemleri | Loccake Sipariş ve Online Ödeme',
    description: 'Loccake siparişleriniz için nakit, kredi kartı, banka kartı, EFT/havale ve WhatsApp ile ödeme linki seçenekleri.',
    image: '/uploads/seed-medovik-pasta-izmir.jpg',
    changefreq: 'monthly',
    priority: 0.6,
  },
  {
    key: 'birthday',
    label: 'Doğum Günü Partileri',
    path: '/birthday',
    title: 'Doğum Günü Pastası ve Parti Organizasyonu | Loccake İzmir',
    description: 'İzmir Alsancak Loccake’de doğum günü pastası, cupcake, muffin, parti süsleme ve özel kutlama organizasyonu seçenekleri.',
    image: '/uploads/seed-birthday-1.jpeg',
    changefreq: 'monthly',
    priority: 0.7,
  },
  {
    key: 'blog',
    label: 'Blog',
    path: '/blog',
    title: 'Blog | Medovik, Rus Pastaları ve Loccake Hikayeleri | İzmir',
    description: 'Medovik tarihi, Rus pastaları, cafe kültürü ve İzmir Alsancak Loccake’den lezzet rehberleri. Gerçek tarifler, mekan ipuçları ve sipariş bilgileri.',
    image: '/uploads/seed-medovik.jpg',
    changefreq: 'weekly',
    priority: 0.8,
  },
]

const CHANGEFREQ_VALUES = new Set(['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never'])

function normalizeSiteUrl(value) {
  const siteUrl = String(value || process.env.SITE_URL || DEFAULT_SITE_URL).trim()
  return siteUrl.replace(/\/$/, '')
}

function normalizePath(value, fallback = '/') {
  const path = String(value || fallback).trim() || fallback
  return path.startsWith('/') ? path : `/${path}`
}

function isSensitiveRobotsPath(path) {
  const normalized = normalizePath(path).replace(/\/$/, '') || '/'
  return SENSITIVE_ROBOTS_PATHS.has(normalized)
}

function normalizePriority(value, fallback) {
  const priority = Number(value)
  if (!Number.isFinite(priority)) return fallback
  return Math.min(1, Math.max(0, priority))
}

function normalizeChangefreq(value, fallback) {
  return CHANGEFREQ_VALUES.has(value) ? value : fallback
}

function trimText(text = '', maxLength = 155) {
  const normalized = String(text).replace(/\s+/g, ' ').trim()
  if (normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, maxLength - 1).trim()}…`
}

function applyTemplate(template, values) {
  return String(template).replace(/\{(name|description|category|price)\}/g, (_, key) => values[key] || '')
}

function absoluteUrl(path = '/', siteUrl = DEFAULT_SITE_URL) {
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  return `${siteUrl}${path.startsWith('/') ? path : `/${path}`}`
}

function escapeXml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function safeJsonLd(data) {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}

function normalizePage(savedPage, defaultPage) {
  return {
    ...defaultPage,
    ...savedPage,
    path: normalizePath(savedPage?.path, defaultPage.path),
    title: String(savedPage?.title || defaultPage.title).trim(),
    description: String(savedPage?.description || defaultPage.description).trim(),
    image: String(savedPage?.image || defaultPage.image || DEFAULT_IMAGE).trim(),
    robots: String(savedPage?.robots || 'index, follow').trim(),
    changefreq: normalizeChangefreq(savedPage?.changefreq, defaultPage.changefreq),
    priority: normalizePriority(savedPage?.priority, defaultPage.priority),
    includeInSitemap: savedPage?.includeInSitemap !== false,
  }
}

function normalizeSettings(document) {
  const raw = document?.toObject ? document.toObject() : (document || {})
  const savedPages = new Map((raw.pages || []).map(page => [page.key, page]))
  const robotsDisallow = String(raw.robotsDisallow || DEFAULT_ROBOTS_DISALLOW).replace(/\r\n/g, '\n').trim()

  return {
    siteUrl: normalizeSiteUrl(raw.siteUrl),
    defaultImage: String(raw.defaultImage || DEFAULT_IMAGE).trim(),
    robotsDisallow,
    productTitleTemplate: String(raw.productTitleTemplate || DEFAULT_PRODUCT_TITLE_TEMPLATE).trim(),
    productDescriptionTemplate: String(raw.productDescriptionTemplate || DEFAULT_PRODUCT_DESCRIPTION_TEMPLATE).trim(),
    productRobots: String(raw.productRobots || 'index, follow').trim(),
    productSitemapChangefreq: normalizeChangefreq(raw.productSitemapChangefreq, 'weekly'),
    productSitemapPriority: normalizePriority(raw.productSitemapPriority, 0.8),
    includeProductsInSitemap: raw.includeProductsInSitemap !== false,
    pages: DEFAULT_PAGES.map(defaultPage => normalizePage(savedPages.get(defaultPage.key), defaultPage)),
  }
}

function websiteSchema(settings) {
  return {
    '@type': 'WebSite',
    '@id': `${settings.siteUrl}/#website`,
    url: settings.siteUrl,
    name: 'Loccake',
  }
}

function businessSchema(settings) {
  return {
    '@type': 'Bakery',
    '@id': `${settings.siteUrl}/#bakery`,
    name: 'Loccake',
    url: settings.siteUrl,
    image: absoluteUrl(settings.defaultImage, settings.siteUrl),
    telephone: '+905558937078',
    email: 'info@loccake.com',
    priceRange: '₺₺',
    servesCuisine: ['Russian', 'European', 'Dessert'],
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Alsancak Mahallesi 1440 Sokak 20/B',
      addressLocality: 'Konak',
      addressRegion: 'İzmir',
      addressCountry: 'TR',
    },
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        opens: '12:00',
        closes: '20:00',
      },
    ],
    sameAs: ['https://www.instagram.com/loccake'],
  }
}

export const seoStore = {
  async getSettings() {
    const document = await SeoSettings.findOne({ key: 'default' })
    return normalizeSettings(document)
  },

  async getAdminSettings() {
    return this.getSettings()
  },

  async updateSettings(data) {
    const pages = DEFAULT_PAGES.map(defaultPage => ({
      key: defaultPage.key,
      label: defaultPage.label,
      path: normalizePath(data[`${defaultPage.key}_path`], defaultPage.path),
      title: String(data[`${defaultPage.key}_title`] || defaultPage.title).trim(),
      description: String(data[`${defaultPage.key}_description`] || defaultPage.description).trim(),
      image: String(data[`${defaultPage.key}_image`] || defaultPage.image || DEFAULT_IMAGE).trim(),
      robots: String(data[`${defaultPage.key}_robots`] || 'index, follow').trim(),
      changefreq: normalizeChangefreq(data[`${defaultPage.key}_changefreq`], defaultPage.changefreq),
      priority: normalizePriority(data[`${defaultPage.key}_priority`], defaultPage.priority),
      includeInSitemap: data[`${defaultPage.key}_includeInSitemap`] === 'true',
    }))

    const update = {
      siteUrl: normalizeSiteUrl(data.siteUrl),
      defaultImage: String(data.defaultImage || DEFAULT_IMAGE).trim(),
      robotsDisallow: String(data.robotsDisallow ?? DEFAULT_ROBOTS_DISALLOW).replace(/\r\n/g, '\n').trim(),
      productTitleTemplate: String(data.productTitleTemplate || DEFAULT_PRODUCT_TITLE_TEMPLATE).trim(),
      productDescriptionTemplate: String(data.productDescriptionTemplate || DEFAULT_PRODUCT_DESCRIPTION_TEMPLATE).trim(),
      productRobots: String(data.productRobots || 'index, follow').trim(),
      productSitemapChangefreq: normalizeChangefreq(data.productSitemapChangefreq, 'weekly'),
      productSitemapPriority: normalizePriority(data.productSitemapPriority, 0.8),
      includeProductsInSitemap: data.includeProductsInSitemap === 'true',
      pages,
    }

    return SeoSettings.findOneAndUpdate(
      { key: 'default' },
      { $set: update },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )
  },

  async buildSeo(key, overrides = {}) {
    const settings = await this.getSettings()
    const page = settings.pages.find(item => item.key === key) || DEFAULT_PAGES[0]
    const metadata = { ...page, ...overrides }
    const canonical = absoluteUrl(metadata.path, settings.siteUrl)
    const image = absoluteUrl(metadata.image || settings.defaultImage, settings.siteUrl)
    const description = trimText(metadata.description)

    return {
      ...metadata,
      description,
      canonical,
      image,
      type: metadata.type || 'website',
      robots: metadata.robots || 'index, follow',
      schema: safeJsonLd({
        '@context': 'https://schema.org',
        '@graph': [
          websiteSchema(settings),
          businessSchema(settings),
          {
            '@type': 'WebPage',
            '@id': `${canonical}#webpage`,
            url: canonical,
            name: metadata.title,
            description,
            isPartOf: { '@id': `${settings.siteUrl}/#website` },
            about: { '@id': `${settings.siteUrl}/#bakery` },
            primaryImageOfPage: { '@type': 'ImageObject', url: image },
          },
        ],
      }),
    }
  },

  async buildBlogPostSeo(post) {
    const settings = await this.getSettings()
    const path = `/blog/${post.slug}`
    const image = post.metaImage || post.coverImage || settings.defaultImage
    const title = trimText(post.metaTitle || post.title, 120)
    const description = trimText(post.metaDescription || post.excerpt || post.title)
    const canonical = absoluteUrl(path, settings.siteUrl)
    const imageUrl = absoluteUrl(image, settings.siteUrl)
    const publishedAt = post.publishedAt || post.createdAt

    return {
      title,
      description,
      path,
      canonical,
      image: imageUrl,
      type: 'article',
      robots: post.robots || 'index, follow',
      schema: safeJsonLd({
        '@context': 'https://schema.org',
        '@graph': [
          websiteSchema(settings),
          businessSchema(settings),
          {
            '@type': 'BlogPosting',
            '@id': `${canonical}#article`,
            headline: post.title,
            description,
            image: imageUrl,
            datePublished: publishedAt ? new Date(publishedAt).toISOString() : undefined,
            dateModified: post.updatedAt ? new Date(post.updatedAt).toISOString() : undefined,
            author: { '@type': 'Organization', name: 'Loccake' },
            publisher: {
              '@type': 'Organization',
              name: 'Loccake',
              logo: { '@type': 'ImageObject', url: absoluteUrl(settings.defaultImage, settings.siteUrl) },
            },
            mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
            about: { '@id': `${settings.siteUrl}/#bakery` },
          },
        ],
      }),
    }
  },

  async buildItemSeo(item) {
    const settings = await this.getSettings()
    const path = `/menu/${item._id}`
    const image = item.image || settings.defaultImage
    const values = {
      name: item.name,
      description: item.description,
      category: item.categoryId?.name || '',
      price: String(item.price),
    }
    const title = trimText(applyTemplate(settings.productTitleTemplate, values), 120)
    const description = trimText(applyTemplate(settings.productDescriptionTemplate, values))
    const canonical = absoluteUrl(path, settings.siteUrl)
    const imageUrl = absoluteUrl(image, settings.siteUrl)

    return {
      title,
      description,
      path,
      canonical,
      image: imageUrl,
      type: 'product',
      robots: settings.productRobots,
      schema: safeJsonLd({
        '@context': 'https://schema.org',
        '@graph': [
          websiteSchema(settings),
          businessSchema(settings),
          {
            '@type': 'Product',
            '@id': `${canonical}#product`,
            name: item.name,
            description,
            image: imageUrl,
            category: item.categoryId?.name,
            brand: { '@type': 'Brand', name: 'Loccake' },
            offers: {
              '@type': 'Offer',
              url: canonical,
              priceCurrency: 'TRY',
              price: item.price,
              availability: 'https://schema.org/InStock',
              seller: { '@id': `${settings.siteUrl}/#bakery` },
            },
          },
        ],
      }),
    }
  },

  async buildRobots() {
    const settings = await this.getSettings()
    const disallow = settings.robotsDisallow
      .split('\n')
      .map(path => path.trim())
      .filter(path => path && !isSensitiveRobotsPath(path))

    return [
      'User-agent: *',
      'Allow: /',
      ...disallow.map(path => `Disallow: ${normalizePath(path)}`),
      '',
      `Sitemap: ${settings.siteUrl}/sitemap.xml`,
    ].join('\n')
  },

  async buildSitemap(publicStore) {
    const settings = await this.getSettings()
    const pages = settings.pages.filter(page => page.includeInSitemap)
    const items = settings.includeProductsInSitemap ? await publicStore.getItems() : []
    const posts = await BlogPost.find({ published: true }).sort({ publishedAt: -1 })
    const pageUrls = pages.map(page => ({
      loc: absoluteUrl(page.path, settings.siteUrl),
      changefreq: page.changefreq,
      priority: page.priority,
    }))
    const itemUrls = items.map(item => ({
      loc: absoluteUrl(`/menu/${item._id}`, settings.siteUrl),
      changefreq: settings.productSitemapChangefreq,
      priority: settings.productSitemapPriority,
      lastmod: item.updatedAt ? new Date(item.updatedAt).toISOString().slice(0, 10) : '',
    }))
    const blogUrls = posts.map(post => ({
      loc: absoluteUrl(`/blog/${post.slug}`, settings.siteUrl),
      changefreq: 'monthly',
      priority: 0.75,
      lastmod: post.updatedAt ? new Date(post.updatedAt).toISOString().slice(0, 10) : '',
    }))

    const urls = [...pageUrls, ...itemUrls, ...blogUrls]
      .map(url => [
        '  <url>',
        `    <loc>${escapeXml(url.loc)}</loc>`,
        url.lastmod ? `    <lastmod>${escapeXml(url.lastmod)}</lastmod>` : '',
        `    <changefreq>${escapeXml(url.changefreq)}</changefreq>`,
        `    <priority>${url.priority.toFixed(1)}</priority>`,
        '  </url>',
      ].filter(Boolean).join('\n'))
      .join('\n')

    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`
  },
}