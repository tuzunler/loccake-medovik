import Category from '../../models/Category.js'
import MenuItem from '../../models/MenuItem.js'

export const categoryStore = {
  async list() {
    return Category.find().sort({ sortOrder: 1, name: 1 })
  },

  async getById(id) {
    return Category.findById(id)
  },

  async countItems(id) {
    return MenuItem.countDocuments({ categoryId: id })
  },

  async create(data) {
    return Category.create({
      name: data.name,
      description: data.description || '',
      image: data.image || '',
      sortOrder: Number(data.sortOrder) || 0,
      active: data.active !== 'false' && data.active !== '0',
    })
  },

  async update(id, data) {
    const update = {}
    if (data.name !== undefined) update.name = data.name
    if (data.description !== undefined) update.description = data.description
    if (data.image !== undefined) update.image = data.image
    if (data.sortOrder !== undefined) update.sortOrder = Number(data.sortOrder) || 0
    if (data.active !== undefined) update.active = data.active !== 'false' && data.active !== '0'
    return Category.findByIdAndUpdate(id, update, { new: true })
  },

  async delete(id) {
    const result = await Category.findByIdAndDelete(id)
    return !!result
  },
}
