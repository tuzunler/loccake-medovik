import mongoose from 'mongoose'
import { randomBytes } from 'node:crypto'

const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60

const tokenSchema = new mongoose.Schema({
  token:  { type: String, required: true, unique: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
}, { timestamps: true })

tokenSchema.statics.generate = function (userId) {
  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000)
  return this.create({ token, userId, expiresAt })
}

export default mongoose.model('Token', tokenSchema)
