import 'dotenv/config'
import mongoose from 'mongoose'
import User from './models/User.js'

const ADMIN_EMAIL = 'admin@loccake.ru'
const ADMIN_PASSWORD = 'admin123'
const ADMIN_NAME = 'Admin'

await mongoose.connect(process.env.MONGO_URI)

const existing = await User.findOne({ email: ADMIN_EMAIL })
if (existing) {
  console.log('⚠️  Admin already exists:', existing.email)
} else {
  const admin = await User.create({
    name: ADMIN_NAME,
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    role: 'admin',
  })
  console.log('✅ Admin created:', admin.email)
  console.log('   Password:', ADMIN_PASSWORD)
}

await mongoose.disconnect()
