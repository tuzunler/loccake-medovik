import mongoose from 'mongoose'

const contentFieldSchema = new mongoose.Schema({
  key:   { type: String, required: true },
  label: { type: String, required: true },
  type:  { type: String, default: 'text' },
  value: { type: String, default: '' },
  help:  { type: String, default: '' },
}, { _id: false })

const contentPageSchema = new mongoose.Schema({
  key:    { type: String, required: true },
  label:  { type: String, required: true },
  fields: [contentFieldSchema],
}, { _id: false })

const siteContentSchema = new mongoose.Schema({
  key:   { type: String, default: 'default', unique: true },
  pages: [contentPageSchema],
}, { timestamps: true })

export default mongoose.model('SiteContent', siteContentSchema)