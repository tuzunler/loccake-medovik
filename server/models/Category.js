import mongoose from 'mongoose'

const categorySchema = new mongoose.Schema({
  name:        { type: String, required: true, minlength: 2, maxlength: 100 },
  description: { type: String, default: '' },
  image:       { type: String, default: '' },
  sortOrder:   { type: Number, default: 0 },
  active:      { type: Boolean, default: true },
}, { timestamps: true })

export default mongoose.model('Category', categorySchema)
