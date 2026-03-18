export default {
  name: 'admin-categories',
  prefix: '/admin/categories',
  pipe: ['cookieAuth', 'admin', 'csrf'],

  routes: [
    ['GET',  '',              'categoryList'],
    ['GET',  '/create',       'categoryCreatePage'],
    ['POST', '/create',       'categoryCreate'],
    ['GET',  '/:id/edit',     'categoryEditPage'],
    ['POST', '/:id/edit',     'categoryUpdate'],
    ['POST', '/:id/delete',   'categoryRemove'],
  ],
}
