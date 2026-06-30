export default {
  name: 'admin',
  prefix: '/admin',
  pipe: ['rateLimit:120', 'cookieAuth', 'admin'],

  routes: [
    ['GET', '', 'dashboard'],
  ],
}
