import mongoose from 'mongoose'
import Category from '../../models/Category.js'
import MenuItem from '../../models/MenuItem.js'

export const publicStore = {
  async getCategories() {
    return Category.find({ active: true }).sort({ sortOrder: 1, name: 1 })
  },

  async getItems(filter = {}) {
    const items = await MenuItem.find({ active: true, ...filter })
      .populate('categoryId', 'name active')
      .sort({ sortOrder: 1, name: 1 })

    return items.filter(item => item.categoryId && item.categoryId.active !== false)
  },

  async getItemsByCategory() {
    const categories = await this.getCategories()
    const items = await this.getItems()

    return categories.map(cat => ({
      category: cat,
      items: items.filter(item => item.categoryId && item.categoryId._id.toString() === cat._id.toString()),
    })).filter(group => group.items.length > 0)
  },

  async getItemById(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) return null

    const item = await MenuItem.findOne({ _id: id, active: true })
      .populate('categoryId', 'name active')

    if (!item?.categoryId || item.categoryId.active === false) return null

    return item
  },

  async getRelatedItems(item, limit = 4) {
    if (!item?.categoryId) return []

    const relatedItems = await MenuItem.find({
      active: true,
      _id: { $ne: item._id },
      categoryId: item.categoryId,
    })
      .populate('categoryId', 'name active')
      .sort({ sortOrder: 1 })
      .limit(limit)

    return relatedItems.filter(relatedItem => relatedItem.categoryId && relatedItem.categoryId.active !== false)
  },
}
