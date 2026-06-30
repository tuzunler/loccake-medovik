export default {
  name: 'admin-scan',
  prefix: '/admin/scan',
  pipe: ['rateLimit:60', 'cookieAuth', 'admin'],

  routes: [
    ['GET', '', 'scanPage'],
  ],
}