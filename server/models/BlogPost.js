import mongoose from 'mongoose'

const blogBlockSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['title', 'subtitle', 'paragraph', 'italic', 'image', 'map', 'cta'],
    required: true,
  },
  text: { type: String, default: '' },
  image: { type: String, default: '' },
  imageAlt: { type: String, default: '' },
  embedUrl: { type: String, default: '' },
  buttonLabel: { type: String, default: '' },
  buttonHref: { type: String, default: '' },
}, { _id: false })

const blogPostSchema = new mongoose.Schema({
  title: { type: String, required: true, minlength: 2, maxlength: 200 },
  slug: { type: String, required: true, unique: true, maxlength: 200 },
  excerpt: { type: String, default: '', maxlength: 500 },
  coverImage: { type: String, default: '' },
  blocks: [blogBlockSchema],
  metaTitle: { type: String, default: '', maxlength: 200 },
  metaDescription: { type: String, default: '', maxlength: 320 },
  metaImage: { type: String, default: '' },
  robots: { type: String, default: 'index, follow' },
  published: { type: Boolean, default: false },
  publishedAt: { type: Date },
  sortOrder: { type: Number, default: 0 },
}, { timestamps: true })

blogPostSchema.index({ published: 1, publishedAt: -1, sortOrder: 1 })

export default mongoose.model('BlogPost', blogPostSchema)
