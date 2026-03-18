export async function loginPage(request) {
  const token = request.cookies.token
  if (token) return request.redirect('/admin')
  await request.render('pages/login', { title: 'Admin Login' })
}

export async function login(request, { authService }) {
  const { email, password } = request.body

  const result = await authService.login(email, password)
  if (!result) {
    request.flash('error', 'Invalid email or password')
    return request.redirect('/auth/login')
  }

  if (result.user.role !== 'admin') {
    request.flash('error', 'Access restricted to administrators only')
    return request.redirect('/auth/login')
  }

  request.cookie('token', result.token, {
    httpOnly: true,
    secure: false,
    sameSite: 'Lax',
    maxAge: 7 * 24 * 60 * 60,
  })

  request.flash('success', 'Welcome!')
  request.redirect('/admin')
}

export async function logout({ cookies, cookie, redirect }, { authService }) {
  const token = cookies.token
  if (token) {
    await authService.logout(token)
    cookie('token', '', { maxAge: 0 })
  }
  redirect('/auth/login')
}
