function isUploadedFile(file) {
  return !!(file?.filename && file.size > 0)
}

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

  const { saveImage } = await import('../../lib/upload.js')
  const files = (request.files || []).filter(isUploadedFile)

  const mainFile = files.find(f => f.fieldname === 'image')
  if (mainFile) {
    try {
      createData.image = await saveImage(mainFile)
    } catch (err) {
      request.flash('error', err.message)
      return request.redirect('/admin/items/create')
    }
  }

  const galleryFiles = files.filter(f => f.fieldname === 'gallery')
  if (galleryFiles.length) {
    const galleryPaths = []
    for (const gf of galleryFiles) {
      try {
        const path = await saveImage(gf)
        if (path) galleryPaths.push(path)
      } catch (err) { /* skip invalid */ }
    }
    createData.gallery = galleryPaths
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

  const { saveImage, deleteImage } = await import('../../lib/upload.js')
  const existing = await itemStore.getById(request.params.id)
  const files = (request.files || []).filter(isUploadedFile)

  // Main image
  const mainFile = files.find(f => f.fieldname === 'image')
  if (mainFile) {
    try {
      if (existing?.image) await deleteImage(existing.image)
      updateData.image = await saveImage(mainFile)
    } catch (err) {
      request.flash('error', err.message)
      return request.redirect(`/admin/items/${request.params.id}/edit`)
    }
  }

  // Remove gallery images marked for deletion
  const removeGallery = request.body.removeGallery
  const toRemove = Array.isArray(removeGallery) ? removeGallery : (removeGallery ? [removeGallery] : [])
  let currentGallery = existing?.gallery || []
  if (toRemove.length) {
    for (const img of toRemove) await deleteImage(img)
    currentGallery = currentGallery.filter(g => !toRemove.includes(g))
  }

  // Add new gallery images
  const galleryFiles = files.filter(f => f.fieldname === 'gallery')
  if (galleryFiles.length) {
    for (const gf of galleryFiles) {
      try {
        const path = await saveImage(gf)
        if (path) currentGallery.push(path)
      } catch (err) { /* skip invalid */ }
    }
  }

  if (toRemove.length || galleryFiles.length) {
    updateData.gallery = currentGallery
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
  const item = await itemStore.getById(request.params.id)

  if (!item) {
    request.flash('error', 'Item not found')
    return request.redirect('/admin/items')
  }

  const deleted = await itemStore.delete(request.params.id)

  if (!deleted) {
    request.flash('error', 'Item not found')
  } else {
    const { deleteImage } = await import('../../lib/upload.js')
    if (item.image) await deleteImage(item.image)
    for (const g of (item.gallery || [])) await deleteImage(g)
    request.flash('success', 'Item deleted')
  }

  request.redirect('/admin/items')
}
