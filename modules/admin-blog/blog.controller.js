function isUploadedFile(file) {
  return !!(file?.filename && file.size > 0)
}

async function processPostPayload(request, blogStore, existing = null) {
  const { saveImage, deleteImage } = await import('../../lib/upload.js')
  const files = (request.files || []).filter(isUploadedFile)
  const body = request.body

  let blocks = blogStore.parseBlocks(body.blocksJson)
  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index]
    if (block.type !== 'image') continue

    const file = files.find(item => item.fieldname === `blockImage_${index}`)
    if (file) {
      try {
        if (existing?.blocks?.[index]?.image) {
          await deleteImage(existing.blocks[index].image)
        }
        block.image = await saveImage(file)
      } catch (err) {
        throw new Error(err.message)
      }
    }
  }

  let coverImage = existing?.coverImage || ''
  const coverFile = files.find(item => item.fieldname === 'coverImage')
  if (coverFile) {
    try {
      if (coverImage) await deleteImage(coverImage)
      coverImage = await saveImage(coverFile)
    } catch (err) {
      throw new Error(err.message)
    }
  }

  let metaImage = existing?.metaImage || ''
  const metaFile = files.find(item => item.fieldname === 'metaImage')
  if (metaFile) {
    try {
      if (metaImage) await deleteImage(metaImage)
      metaImage = await saveImage(metaFile)
    } catch (err) {
      throw new Error(err.message)
    }
  }

  return {
    ...body,
    blocksJson: JSON.stringify(blocks),
    coverImage,
    metaImage,
  }
}

export async function blogList(request, { blogStore }) {
  const posts = (await blogStore.list()).map(post => ({
  ...post.toObject(),
  publishedAtFormatted: post.publishedAt
    ? new Date(post.publishedAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })
    : '',
  }))

  await request.render('pages/admin/blog/list', {
    title: 'Blog',
    activePage: 'blog',
    user: request.user,
    posts,
  })
}

export async function blogCreatePage(request) {
  await request.render('pages/admin/blog/form', {
    title: 'New Blog Post',
    activePage: 'blog',
    user: request.user,
    post: null,
    blocksJson: '[]',
    isEdit: false,
  })
}

export async function blogCreate(request, { blogStore }) {
  const { title } = request.body
  if (!title || title.trim().length < 2) {
    request.flash('error', 'Title is required (min 2 characters)')
    return request.redirect('/admin/blog/create')
  }

  try {
    const payload = await processPostPayload(request, blogStore)
    const data = await blogStore.prepareCreate(payload)
    await blogStore.create(data)
    request.flash('success', 'Blog post created')
    request.redirect('/admin/blog')
  } catch (err) {
    request.flash('error', err.message)
    request.redirect('/admin/blog/create')
  }
}

export async function blogEditPage(request, { blogStore }) {
  const post = await blogStore.getById(request.params.id)
  if (!post) {
    request.flash('error', 'Blog post not found')
    return request.redirect('/admin/blog')
  }

  await request.render('pages/admin/blog/form', {
    title: 'Edit Blog Post',
    activePage: 'blog',
    user: request.user,
    post,
    blocksJson: JSON.stringify(post.blocks || []),
    isEdit: true,
  })
}

export async function blogUpdate(request, { blogStore }) {
  const { title } = request.body
  if (!title || title.trim().length < 2) {
    request.flash('error', 'Title is required (min 2 characters)')
    return request.redirect(`/admin/blog/${request.params.id}/edit`)
  }

  const existing = await blogStore.getById(request.params.id)
  if (!existing) {
    request.flash('error', 'Blog post not found')
    return request.redirect('/admin/blog')
  }

  try {
    const payload = await processPostPayload(request, blogStore, existing)
    const data = await blogStore.prepareUpdate(request.params.id, payload)
    const updated = await blogStore.update(request.params.id, data)

    if (!updated) {
      request.flash('error', 'Blog post not found')
      return request.redirect('/admin/blog')
    }

    request.flash('success', 'Blog post updated')
    request.redirect('/admin/blog')
  } catch (err) {
    request.flash('error', err.message)
    request.redirect(`/admin/blog/${request.params.id}/edit`)
  }
}

export async function blogRemove(request, { blogStore }) {
  const post = await blogStore.getById(request.params.id)
  if (!post) {
    request.flash('error', 'Blog post not found')
    return request.redirect('/admin/blog')
  }

  const deleted = await blogStore.delete(request.params.id)
  if (deleted) {
    const { deleteImage } = await import('../../lib/upload.js')
    if (post.coverImage) await deleteImage(post.coverImage)
    if (post.metaImage) await deleteImage(post.metaImage)
    for (const block of post.blocks || []) {
      if (block.type === 'image' && block.image) await deleteImage(block.image)
    }
    request.flash('success', 'Blog post deleted')
  }

  request.redirect('/admin/blog')
}
