export default {
  name: 'public',
  prefix: '',

  routes: [
    ['GET', '/robots.txt',  'robotsPage'],
    ['GET', '/sitemap.xml', 'sitemapPage'],
    ['GET', '',          'homePage'],
    ['GET', '/menu',     'menuPage'],
    ['GET', '/menu/:id', 'itemPage'],
    ['GET', '/about',    'aboutPage'],
    ['GET', '/contact',  'contactPage'],
    ['GET', '/delivery', 'deliveryPage'],
    ['GET', '/payment',  'paymentPage'],
    ['GET', '/birthday', 'birthdayPage'],
    ['GET', '/blog',      'blogListPage'],
    ['GET', '/blog/:slug', 'blogPostPage'],
  ],
}
