function getBaseUrl(request) {
  const forwardedProto = request.headers['x-forwarded-proto']?.split(',')[0]?.trim()
  const protocol = forwardedProto || (process.env.NODE_ENV === 'production' ? 'https' : 'http')
  const host = request.headers.host || `localhost:${process.env.PORT || 4000}`
  return `${protocol}://${host}`
}

export async function scanPage(request, { pageScanStore, publicStore }) {
  const baseUrl = getBaseUrl(request)
  const results = await pageScanStore.scanPublicPages(baseUrl, publicStore)
  const okCount = results.filter(result => result.ok).length
  const issueCount = results.length - okCount

  await request.render('pages/admin/scan/list', {
    title: 'Page Scan',
    activePage: 'scan',
    user: request.user,
    baseUrl,
    results,
    stats: {
      total: results.length,
      ok: okCount,
      issues: issueCount,
    },
  })
}