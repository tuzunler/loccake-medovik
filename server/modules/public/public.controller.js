const LAYOUT = { layout: 'public-layout' }

export async function homePage(request, { publicStore }) {
  const categories = await publicStore.getCategories()
  const items = await publicStore.getItems()

  await request.render('pages/public/home', {
    page: 'home',
    categories,
    items,
  }, LAYOUT)
}

export async function menuPage(request, { publicStore }) {
  const groups = await publicStore.getItemsByCategory()

  await request.render('pages/public/menu', {
    title: 'Ürünlerimiz',
    page: 'menu',
    navbarClass: 'navbar--solid',
    groups,
  }, LAYOUT)
}

export async function itemPage(request, { publicStore }) {
  const item = await publicStore.getItemById(request.params.id)
  if (!item) {
    return request.redirect('/menu')
  }

  const related = await publicStore.getRelatedItems(item)

  await request.render('pages/public/item', {
    title: item.name,
    page: 'menu',
    navbarClass: 'navbar--solid',
    item,
    related,
  }, LAYOUT)
}

export async function aboutPage(request) {
  await request.render('pages/public/about', {
    title: 'Hakkımızda',
    page: 'about',
    navbarClass: 'navbar--solid',
  }, LAYOUT)
}

export async function contactPage(request) {
  await request.render('pages/public/contact', {
    title: 'İletişim',
    page: 'contact',
    navbarClass: 'navbar--solid',
  }, LAYOUT)
}

export async function deliveryPage(request) {
  await request.render('pages/public/delivery', {
    title: 'Paket Servis',
    page: 'delivery',
    navbarClass: 'navbar--solid',
  }, LAYOUT)
}

export async function paymentPage(request) {
  await request.render('pages/public/payment', {
    title: 'Ödeme Yöntemleri',
    page: 'payment',
    navbarClass: 'navbar--solid',
  }, LAYOUT)
}

export async function birthdayPage(request) {
  await request.render('pages/public/birthday', {
    title: 'Doğum Günü Partileri',
    page: 'birthday',
    navbarClass: 'navbar--solid',
  }, LAYOUT)
}
