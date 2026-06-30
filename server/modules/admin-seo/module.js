export default {
  name: 'admin-seo',
  prefix: '/admin/seo',
  pipe: ['rateLimit:120', 'cookieAuth', 'admin', 'csrf'],

  routes: [
    ['GET',  '', 'seoSettingsPage'],
    ['POST', '', 'seoSettingsUpdate'],
  ],
}