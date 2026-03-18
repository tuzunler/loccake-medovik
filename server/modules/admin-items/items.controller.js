export async function itemList(request, { itemStore }) {
  const items = await itemStore.list()

  await request.render('pages/admin/items/list', {
    title: 'Menu Items',
    activePage: 'items',
    user: request.user,
    items,
  })
}

export async function itemCreatePage(request, { categoryStore }) {
  const categories = await categoryStore.list()

  await request.render('pages/admin/items/form', {
    title: 'New Item',
    activePage: 'items',
    user: request.user,
    item: null,
    categories,
    isEdit: false,
  })
}

export async function itemCreate(request, { itemStore, categoryStore }) {
  const { name, price, categoryId } = request.body

  if (!name || name.trim().length < 2) {
    request.flash('error', 'Name is required (min 2 characters)')
    return request.redirect('/admin/items/create')
  }
  if (!price || Number(price) < 0) {
    request.flash('error', 'Please enter a valid price')
    return request.redirect('/admin/items/create')
  }
  if (!categoryId) {
    request.flash('error', 'Please select a category')
    return request.redirect('/admin/items/create')
  }

  const category = await categoryStore.getById(categoryId)
  if (!category) {
    request.flash('error', 'Category not found')
    return request.redirect('/admin/items/create')
  }

  const createData = { ...request.body, name: name.trim() }

  const file = request.files?.[0]
  if (file) {
    try {
      const { saveImage } = await import('../../lib/upload.js')
      createData.image = await saveImage(file)
    } catch (err) {
      request.flash('error', err.message)
      return request.redirect('/admin/items/create')
    }
  }

  await itemStore.create(createData)
  request.flash('success', 'Item created')
  request.redirect('/admin/items')
}

export async function itemEditPage(request, { itemStore, categoryStore }) {
  const item = await itemStore.getById(request.params.id)
  if (!item) {
    request.flash('error', 'Item not found')
    return request.redirect('/admin/items')
  }

  const categories = await categoryStore.list()

  await request.render('pages/admin/items/form', {
    title: 'Edit Item',
    activePage: 'items',
    user: request.user,
    item,
    categories,
    isEdit: true,
  })
}

export async function itemUpdate(request, { itemStore, categoryStore }) {
  const { name, price, categoryId } = request.body

  if (!name || name.trim().length < 2) {
    request.flash('error', 'Name is required (min 2 characters)')
    return request.redirect(`/admin/items/${request.params.id}/edit`)
  }

  if (categoryId) {
    const category = await categoryStore.getById(categoryId)
    if (!category) {
      request.flash('error', 'Category not found')
      return request.redirect(`/admin/items/${request.params.id}/edit`)
    }
  }

  const updateData = { ...request.body, name: name.trim() }

  const file = request.files?.[0]
  if (file) {
    try {
      const { saveImage, deleteImage } = await import('../../lib/upload.js')
      const existing = await itemStore.getById(request.params.id)
      if (existing?.image) await deleteImage(existing.image)
      updateData.image = await saveImage(file)
    } catch (err) {
      request.flash('error', err.message)
      return request.redirect(`/admin/items/${request.params.id}/edit`)
    }
  }

  const updated = await itemStore.update(request.params.id, updateData)

  if (!updated) {
    request.flash('error', 'Item not found')
    return request.redirect('/admin/items')
  }

  request.flash('success', 'Item updated')
  request.redirect('/admin/items')
}

export async function itemRemove(request, { itemStore }) {
  const deleted = await itemStore.delete(request.params.id)

  if (!deleted) {
    request.flash('error', 'Item not found')
  } else {
    request.flash('success', 'Item deleted')
  }

  request.redirect('/admin/items')
}
