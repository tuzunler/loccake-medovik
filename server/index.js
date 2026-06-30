import { createApp, defineGuard, HttpError } from 'spacenode'
import 'dotenv/config'
import mongoose from 'mongoose'
import User from './models/User.js'
import Token from './models/Token.js'

const isProduction = process.env.NODE_ENV === 'production'
const port = Number(process.env.PORT) || 4000

// ── Connect to MongoDB ──

await mongoose.connect(process.env.MONGO_URI)
console.log('MongoDB connected')

// ── Cookie-based auth guard ──

defineGuard('cookieAuth', () => async (request) => {
  const token = request.cookies.token
  if (!token) return request.redirect('/auth/login')

  const session = await Token.findOne({ token, expiresAt: { $gt: new Date() } })
  if (!session) {
    request.cookie('token', '', { maxAge: 0 })
    return request.redirect('/auth/login')
  }

  const user = await User.findById(session.userId)
  if (!user) {
    request.cookie('token', '', { maxAge: 0 })
    return request.redirect('/auth/login')
  }

  return { user: user.toSafe() }
})

// ── Admin guard ──

defineGuard('admin', () => (request) => {
  if (!request.user || request.user.role !== 'admin') {
    throw new HttpError(403, 'ACCESS DENIED')
  }
})

// ── Create application ──

const app = await createApp({
  baseUrl: import.meta.url,
  views: './views',
  static: './public',
  spa: false,
  watch: !isProduction,
  bodyLimit: 10 * 1024 * 1024,  // 10 MB (for file uploads)
})

// ── Start ──

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`)
})
