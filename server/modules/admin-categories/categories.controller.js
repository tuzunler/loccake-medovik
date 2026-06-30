function isUploadedFile(file) {
  return !!(file?.filename && file.size > 0)
}

export async function categoryList(request, { categoryStore }) {
  const categories = await categoryStore.list()

  await request.render('pages/admin/categories/list', {
    title: 'Categories',
    activePage: 'categories',
    user: request.user,
    categories,
  })
}

export async function categoryCreatePage(request) {
  await request.render('pages/admin/categories/form', {
    title: 'New Category',
    activePage: 'categories',
    user: request.user,
    category: null,
    isEdit: false,
  })
}

export async function categoryCreate(request, { categoryStore }) {
  const { name, description, sortOrder } = request.body

  if (!name || name.trim().length < 2) {
    request.flash('error', 'Category name is required (min 2 characters)')
    return request.redirect('/admin/categories/create')
  }

  let image = ''
  const file = (request.files || []).find(isUploadedFile)
  if (file) {
    try {
      const { saveImage } = await import('../../lib/upload.js')
      image = await saveImage(file)
    } catch (err) {
      request.flash('error', err.message)
      return request.redirect('/admin/categories/create')
    }
  }

  await categoryStore.create({ name: name.trim(), description, image, sortOrder })
  request.flash('success', 'Category created')
  request.redirect('/admin/categories')
}

export async function categoryEditPage(request, { categoryStore }) {
  const category = await categoryStore.getById(request.params.id)
  if (!category) {
    request.flash('error', 'Category not found')
    return request.redirect('/admin/categories')
  }

  await request.render('pages/admin/categories/form', {
    title: 'Edit Category',
    activePage: 'categories',
    user: request.user,
    category,
    isEdit: true,
  })
}

export async function categoryUpdate(request, { categoryStore }) {
  const { name, description, sortOrder, active } = request.body

  if (!name || name.trim().length < 2) {
    request.flash('error', 'Category name is required (min 2 characters)')
    return request.redirect(`/admin/categories/${request.params.id}/edit`)
  }

  const updateData = { name: name.trim(), description, sortOrder, active }

  const file = (request.files || []).find(isUploadedFile)
  if (file) {
    try {
      const { saveImage, deleteImage } = await import('../../lib/upload.js')
      const existing = await categoryStore.getById(request.params.id)
      if (existing?.image) await deleteImage(existing.image)
      updateData.image = await saveImage(file)
    } catch (err) {
      request.flash('error', err.message)
      return request.redirect(`/admin/categories/${request.params.id}/edit`)
    }
  }

  const updated = await categoryStore.update(request.params.id, updateData)

  if (!updated) {
    request.flash('error', 'Category not found')
    return request.redirect('/admin/categories')
  }

  request.flash('success', 'Category updated')
  request.redirect('/admin/categories')
}

export async function categoryRemove(request, { categoryStore }) {
  const category = await categoryStore.getById(request.params.id)

  if (!category) {
    request.flash('error', 'Category not found')
    return request.redirect('/admin/categories')
  }

  const linkedItemsCount = await categoryStore.countItems(request.params.id)
  if (linkedItemsCount > 0) {
    request.flash('error', 'Delete or move linked items before deleting this category')
    return request.redirect('/admin/categories')
  }

  const deleted = await categoryStore.delete(request.params.id)

  if (!deleted) {
    request.flash('error', 'Category not found')
  } else {
    const { deleteImage } = await import('../../lib/upload.js')
    if (category.image) await deleteImage(category.image)
    request.flash('success', 'Category deleted')
  }

  request.redirect('/admin/categories')
}
