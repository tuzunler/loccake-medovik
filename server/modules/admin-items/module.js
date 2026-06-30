export default {
  name: 'admin-items',
  prefix: '/admin/items',
  pipe: ['rateLimit:120', 'cookieAuth', 'admin', 'csrf'],

  routes: [
    ['GET',  '',              'itemList'],
    ['GET',  '/create',       'itemCreatePage'],
    ['POST', '/create',       'itemCreate'],
    ['GET',  '/:id/edit',     'itemEditPage'],
    ['POST', '/:id/edit',     'itemUpdate'],
    ['POST', '/:id/delete',   'itemRemove'],
  ],
}
