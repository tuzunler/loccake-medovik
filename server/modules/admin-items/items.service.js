import MenuItem from '../../models/MenuItem.js'

export const itemStore = {
  async list(filter = {}) {
    return MenuItem.find(filter).populate('categoryId', 'name').sort({ sortOrder: 1, name: 1 })
  },

  async getById(id) {
    return MenuItem.findById(id).populate('categoryId', 'name')
  },

  async create(data) {
    return MenuItem.create({
      name: data.name,
      description: data.description || '',
      price: Number(data.price) || 0,
      categoryId: data.categoryId,
      image: data.image || '',
      gallery: data.gallery || [],
      sortOrder: Number(data.sortOrder) || 0,
      active: data.active !== 'false' && data.active !== '0',
    })
  },

  async update(id, data) {
    const allowed = ['name', 'description', 'price', 'categoryId', 'image', 'gallery', 'sortOrder', 'active']
    const update = {}
    for (const key of allowed) {
      if (data[key] !== undefined) {
        if (key === 'price' || key === 'sortOrder') {
          update[key] = Number(data[key]) || 0
        } else if (key === 'active') {
          update[key] = data[key] !== 'false' && data[key] !== '0'
        } else {
          update[key] = data[key]
        }
      }
    }
    return MenuItem.findByIdAndUpdate(id, update, { new: true })
  },

  async delete(id) {
    const result = await MenuItem.findByIdAndDelete(id)
    return !!result
  },
}
