import mongoose from 'mongoose'
import { randomBytes } from 'node:crypto'

const tokenSchema = new mongoose.Schema({
  token:  { type: String, required: true, unique: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true })

tokenSchema.statics.generate = function (userId) {
  const token = randomBytes(32).toString('hex')
  return this.create({ token, userId })
}

export default mongoose.model('Token', tokenSchema)
