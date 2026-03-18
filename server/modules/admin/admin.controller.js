import Category from '../../models/Category.js'
import MenuItem from '../../models/MenuItem.js'

export async function dashboard(request) {
  const totalCategories = await Category.countDocuments()
  const totalItems = await MenuItem.countDocuments()
  const activeItems = await MenuItem.countDocuments({ active: true })

  await request.render('pages/admin/dashboard', {
    title: 'Dashboard',
    activePage: 'dashboard',
    user: request.user,
    stats: { totalCategories, totalItems, activeItems },
  })
}
