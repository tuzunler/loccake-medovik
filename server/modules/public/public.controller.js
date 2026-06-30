const LAYOUT = { layout: 'public-layout' }

function sendText(request, body, contentType) {
  if (request._sent) return
  request._sent = true
  request._statusCode = 200
  request.raw.res.writeHead(200, {
    'Content-Type': contentType,
    'Content-Length': Buffer.byteLength(body),
  })
  request.raw.res.end(body)
}

async function pageContent(contentStore, key) {
  return contentStore ? await contentStore.getPageContent(key) : {}
}

async function contentData(contentStore, key) {
  return {
    content: await pageContent(contentStore, key),
    layoutContent: await pageContent(contentStore, 'layout'),
  }
}

export async function homePage(request, { publicStore, seoStore, contentStore, blogStore }) {
  const categories = await publicStore.getCategories()
  const items = await publicStore.getItems()
  const blogPosts = (await blogStore.list({ publishedOnly: true }))
    .slice(0, 3)
    .map(formatPostDates)

  await request.render('pages/public/home', {
    title: 'İzmir Alsancak Rus Pastaları ve Medovik',
    seo: await seoStore.buildSeo('home'),
    ...await contentData(contentStore, 'home'),
    page: 'home',
    categories,
    items,
    blogPosts,
  }, LAYOUT)
}

export async function menuPage(request, { publicStore, seoStore, contentStore }) {
  const groups = await publicStore.getItemsByCategory()

  await request.render('pages/public/menu', {
    title: 'Ürünlerimiz',
    seo: await seoStore.buildSeo('menu'),
    ...await contentData(contentStore, 'menu'),
    page: 'menu',
    navbarClass: 'navbar--solid',
    groups,
  }, LAYOUT)
}

export async function itemPage(request, { publicStore, seoStore, contentStore }) {
  const item = await publicStore.getItemById(request.params.id)
  if (!item) {
    return request.redirect('/menu')
  }

  const related = await publicStore.getRelatedItems(item)

  await request.render('pages/public/item', {
    title: item.name,
    seo: await seoStore.buildItemSeo(item),
    content: {},
    layoutContent: await pageContent(contentStore, 'layout'),
    page: 'menu',
    navbarClass: 'navbar--solid',
    item,
    related,
  }, LAYOUT)
}

export async function aboutPage(request, { publicStore, seoStore, contentStore }) {
  const categories = await publicStore.getCategories()
  const featuredCategory = categories[0] || null

  await request.render('pages/public/about', {
    title: 'Hakkımızda',
    seo: await seoStore.buildSeo('about'),
    ...await contentData(contentStore, 'about'),
    categories,
    featuredCategory,
    page: 'about',
    navbarClass: 'navbar--solid',
  }, LAYOUT)
}

export async function contactPage(request, { seoStore, contentStore }) {
  await request.render('pages/public/contact', {
    title: 'İletişim',
    seo: await seoStore.buildSeo('contact'),
    ...await contentData(contentStore, 'contact'),
    page: 'contact',
    navbarClass: 'navbar--solid',
  }, LAYOUT)
}

export async function deliveryPage(request, { seoStore, contentStore }) {
  await request.render('pages/public/delivery', {
    title: 'Paket Servis',
    seo: await seoStore.buildSeo('delivery'),
    ...await contentData(contentStore, 'delivery'),
    page: 'delivery',
    navbarClass: 'navbar--solid',
  }, LAYOUT)
}

export async function paymentPage(request, { seoStore, contentStore }) {
  await request.render('pages/public/payment', {
    title: 'Ödeme Yöntemleri',
    seo: await seoStore.buildSeo('payment'),
    ...await contentData(contentStore, 'payment'),
    page: 'payment',
    navbarClass: 'navbar--solid',
  }, LAYOUT)
}

export async function birthdayPage(request, { seoStore, contentStore }) {
  await request.render('pages/public/birthday', {
    title: 'Doğum Günü Partileri',
    seo: await seoStore.buildSeo('birthday'),
    ...await contentData(contentStore, 'birthday'),
    page: 'birthday',
    navbarClass: 'navbar--solid',
  }, LAYOUT)
}

function formatPostDates(post) {
  const publishedAt = post.publishedAt || post.createdAt
  return {
    ...post.toObject(),
    publishedAtFormatted: publishedAt
      ? new Date(publishedAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
      : '',
    publishedAtIso: publishedAt ? new Date(publishedAt).toISOString().slice(0, 10) : '',
  }
}

export async function blogListPage(request, { blogStore, seoStore, contentStore }) {
  const posts = (await blogStore.list({ publishedOnly: true })).map(formatPostDates)

  await request.render('pages/public/blog-list', {
    title: 'Blog',
    seo: await seoStore.buildSeo('blog'),
    ...await contentData(contentStore, 'blog'),
    page: 'blog',
    navbarClass: 'navbar--solid',
    posts,
  }, LAYOUT)
}

export async function blogPostPage(request, { blogStore, seoStore, contentStore }) {
  const post = await blogStore.getBySlug(request.params.slug)
  if (!post) {
    return request.redirect('/blog')
  }

  await request.render('pages/public/blog-post', {
    title: post.title,
    seo: await seoStore.buildBlogPostSeo(post),
    layoutContent: await pageContent(contentStore, 'layout'),
    page: 'blog',
    navbarClass: 'navbar--solid',
    post: formatPostDates(post),
  }, LAYOUT)
}

export async function robotsPage(request, { seoStore }) {
  const robots = await seoStore.buildRobots()
  sendText(request, robots, 'text/plain; charset=utf-8')
}

export async function sitemapPage(request, { publicStore, seoStore }) {
  const sitemap = await seoStore.buildSitemap(publicStore)
  sendText(request, sitemap, 'application/xml; charset=utf-8')
}
