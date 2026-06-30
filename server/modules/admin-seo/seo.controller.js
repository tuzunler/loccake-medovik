export async function seoSettingsPage(request, { seoStore }) {
  const settings = await seoStore.getAdminSettings()

  await request.render('pages/admin/seo/form', {
    title: 'SEO Settings',
    activePage: 'seo',
    user: request.user,
    settings,
  })
}

export async function seoSettingsUpdate(request, { seoStore }) {
  const siteUrl = request.body.siteUrl?.trim()

  if (!siteUrl) {
    request.flash('error', 'Site URL is required')
    return request.redirect('/admin/seo')
  }

  try {
    new URL(siteUrl)
  } catch {
    request.flash('error', 'Please enter a valid Site URL')
    return request.redirect('/admin/seo')
  }

  await seoStore.updateSettings(request.body)
  request.flash('success', 'SEO settings saved')
  request.redirect('/admin/seo')
}