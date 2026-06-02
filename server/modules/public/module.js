export default {
  name: 'public',
  prefix: '',

  routes: [
    ['GET', '',          'homePage'],
    ['GET', '/menu',     'menuPage'],
    ['GET', '/menu/:id', 'itemPage'],
    ['GET', '/about',    'aboutPage'],
    ['GET', '/contact',  'contactPage'],
    ['GET', '/delivery', 'deliveryPage'],
    ['GET', '/payment',  'paymentPage'],
    ['GET', '/birthday', 'birthdayPage'],
  ],
}
