export async function contentPageList(request, { contentStore }) {
  const settings = await contentStore.getAdminSettings()

  await request.render('pages/admin/content/list', {
    title: 'Content',
    activePage: 'content',
    user: request.user,
    pages: settings.pages,
  })
}

export async function contentPageEdit(request, { contentStore }) {
  const page = await contentStore.getAdminPage(request.params.pageKey)
  if (!page) {
    request.flash('error', 'Content page not found')
    return request.redirect('/admin/content')
  }

  await request.render('pages/admin/content/page-form', {
    title: `Content: ${page.label}`,
    activePage: 'content',
    user: request.user,
    page,
  })
}

export async function contentPageUpdate(request, { contentStore }) {
  const page = await contentStore.getAdminPage(request.params.pageKey)
  if (!page) {
    request.flash('error', 'Content page not found')
    return request.redirect('/admin/content')
  }

  try {
    await contentStore.updatePage(request.params.pageKey, request.body, request.files || [])
  } catch (err) {
    request.flash('error', err.message || 'Could not save content')
    return request.redirect(`/admin/content/${request.params.pageKey}`)
  }

  request.flash('success', `${page.label} content saved`)
  request.redirect(`/admin/content/${request.params.pageKey}`)
}