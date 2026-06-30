import mongoose from 'mongoose'

const menuItemSchema = new mongoose.Schema({
  name:        { type: String, required: true, minlength: 2, maxlength: 200 },
  description: { type: String, default: '' },
  price:       { type: Number, required: true, min: 0 },
  categoryId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  image:       { type: String, default: '' },
  gallery:     [{ type: String }],
  active:      { type: Boolean, default: true },
  sortOrder:   { type: Number, default: 0 },
}, { timestamps: true })

export default mongoose.model('MenuItem', menuItemSchema)
