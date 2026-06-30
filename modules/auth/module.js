export default {
  name: 'auth',
  prefix: '/auth',
  pipe: ['rateLimit:30', 'csrf'],

  routes: [
    ['GET',  '/login',  'loginPage'],
    ['POST', '/login',  'login',  ['rateLimit:5', 'dto:loginDto']],
    ['GET',  '/logout', 'logout'],
  ],
}
