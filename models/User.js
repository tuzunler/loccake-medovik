import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

const userSchema = new mongoose.Schema({
  name:     { type: String, required: true, minlength: 2, maxlength: 50 },
  email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  role:     { type: String, enum: ['user', 'admin'], default: 'user' },
}, { timestamps: true })

userSchema.pre('save', async function () {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10)
  }
})

userSchema.methods.verifyPassword = function (plain) {
  return bcrypt.compare(plain, this.password)
}

userSchema.methods.toSafe = function () {
  const obj = this.toObject()
  delete obj.password
  obj.id = obj._id
  return obj
}

export default mongoose.model('User', userSchema)
