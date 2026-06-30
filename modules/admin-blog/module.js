export default {
  name: 'admin-blog',
  prefix: '/admin/blog',
  pipe: ['rateLimit:120', 'cookieAuth', 'admin', 'csrf'],

  routes: [
    ['GET',  '',              'blogList'],
    ['GET',  '/create',       'blogCreatePage'],
    ['POST', '/create',       'blogCreate'],
    ['GET',  '/:id/edit',     'blogEditPage'],
    ['POST', '/:id/edit',     'blogUpdate'],
    ['POST', '/:id/delete',   'blogRemove'],
  ],
}
