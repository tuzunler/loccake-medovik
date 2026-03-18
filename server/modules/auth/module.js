export default {
  name: 'auth',
  prefix: '/auth',
  pipe: ['csrf'],

  routes: [
    ['GET',  '/login',  'loginPage'],
    ['POST', '/login',  'login',  ['dto:loginDto']],
    ['GET',  '/logout', 'logout'],
  ],
}
