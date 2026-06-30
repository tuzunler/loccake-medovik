import mongoose from 'mongoose'

const seoPageSchema = new mongoose.Schema({
  key:              { type: String, required: true },
  label:            { type: String, required: true },
  path:             { type: String, required: true },
  title:            { type: String, default: '' },
  description:      { type: String, default: '' },
  image:            { type: String, default: '' },
  robots:           { type: String, default: 'index, follow' },
  changefreq:       { type: String, default: 'monthly' },
  priority:         { type: Number, default: 0.7, min: 0, max: 1 },
  includeInSitemap: { type: Boolean, default: true },
}, { _id: false })

const seoSettingsSchema = new mongoose.Schema({
  key:                       { type: String, default: 'default', unique: true },
  siteUrl:                   { type: String, default: 'https://www.loccake.com.tr' },
  defaultImage:              { type: String, default: '/uploads/seed-full-medovik.jpg' },
  robotsDisallow:            { type: String, default: '' },
  productTitleTemplate:      { type: String, default: '{name} | Loccake İzmir Alsancak' },
  productDescriptionTemplate: { type: String, default: '{category} kategorisinde {name}: {description} Loccake İzmir Alsancak mağaza teslim sipariş için WhatsApp veya telefonla ulaşın.' },
  productRobots:             { type: String, default: 'index, follow' },
  productSitemapChangefreq:  { type: String, default: 'weekly' },
  productSitemapPriority:    { type: Number, default: 0.8, min: 0, max: 1 },
  includeProductsInSitemap:  { type: Boolean, default: true },
  pages:                     [seoPageSchema],
}, { timestamps: true })

export default mongoose.model('SeoSettings', seoSettingsSchema)