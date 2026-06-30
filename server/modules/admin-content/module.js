export default {
  name: 'admin-content',
  prefix: '/admin/content',
  pipe: ['rateLimit:120', 'cookieAuth', 'admin', 'csrf'],

  routes: [
    ['GET',  '',          'contentPageList'],
    ['GET',  '/:pageKey', 'contentPageEdit'],
    ['POST', '/:pageKey', 'contentPageUpdate'],
  ],
}