export default {
  name: 'admin',
  prefix: '/admin',
  pipe: ['cookieAuth', 'admin'],

  routes: [
    ['GET', '', 'dashboard'],
  ],
}
