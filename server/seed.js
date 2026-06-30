import 'dotenv/config'
import mongoose from 'mongoose'
import { mkdir, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import User from './models/User.js'
import Category from './models/Category.js'
import MenuItem from './models/MenuItem.js'
import SeoSettings from './models/SeoSettings.js'
import SiteContent from './models/SiteContent.js'
import BlogPost from './models/BlogPost.js'
import { seoStore } from './modules/admin-seo/seo.service.js'
import { contentStore } from './modules/admin-content/content.service.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const UPLOADS_DIR = join(__dirname, 'public', 'uploads')

// ── Config ──

const ADMIN_EMAIL = 'admin@loccake.com'
const ADMIN_PASSWORD = '123admin123cake'
const ADMIN_NAME = 'Admin'

const HERO_IMAGE = '/uploads/9875270b9d7bdb52e4e3707c3e5d92fd.jpg'

// Keys map to files in public/uploads as seed-{key}.{ext}
const IMAGE_KEYS = [
  // Category images
  'cat_rus',
  'cat_avrupa',
  'cat_kurabiye',

  // Product images
  'medovik',
  'spartak',
  'napolyon',
  'havuclu',
  'truffle',
  'oreshki',

  // Birthday party photos
  'birthday-1',
  'birthday-2',
  'birthday-3',
  'birthday-4',
  'birthday-5',
  'birthday-6',

  // Cafe photos
  'cafe-1',
  'cafe-2',
  'cafe-3',
  'cafe-4',
  'cafe-5',
  'cafe-6',

  // Extra gallery/page images
  'full-medovik',
  'medovik-pasta-izmir',
  'medovik-pasta-izmir-2',
  'medovik-1',
  'full-medovik-2',
  'irina-ozgur',
  'spartak-1',
  'medovik-1-1',
  'napolyon-izmir',
  'alsancak',

  // Product gallery images
  'portakali-medovik',
  'medovik-siparis',
  'spartak-2',
  'spartak-izmir',
  'rus-napoleon',
  'napolyon-cilek',
  'havuclu-raffaello',
  'dogal-kek',
  'oreshki-2',
]

// ── Local uploads helper ──

let uploadsIndex = null

async function getUploadsIndex() {
  if (!uploadsIndex) {
    const files = await readdir(UPLOADS_DIR)
    uploadsIndex = new Map()

    for (const file of files) {
      if (!file.startsWith('seed-')) continue
      const base = file.slice('seed-'.length).replace(/\.[^.]+$/, '')
      uploadsIndex.set(base, '/uploads/' + file)
    }
  }

  return uploadsIndex
}

async function resolveLocalImage(key) {
  const path = (await getUploadsIndex()).get(key)
  if (!path) {
    console.log(`  x Missing upload: seed-${key}.*`)
    return ''
  }

  console.log(`  > ${path}`)
  return path
}

function seedContentDocument(settings) {
  return {
    key: 'default',
    pages: settings.pages.map(page => ({
      key: page.key,
      label: page.label,
      fields: page.fields.map(field => ({
        key: field.key,
        label: field.label,
        type: field.type,
        value: page.key === 'home' && field.key === 'heroImage'
          ? HERO_IMAGE
          : field.value,
        help: field.help || '',
      })),
    })),
  }
}

function seedSeoDocument(settings) {
  return {
    key: 'default',
    siteUrl: settings.siteUrl,
    defaultImage: settings.defaultImage,
    robotsDisallow: settings.robotsDisallow,
    productTitleTemplate: settings.productTitleTemplate,
    productDescriptionTemplate: settings.productDescriptionTemplate,
    productRobots: settings.productRobots,
    productSitemapChangefreq: settings.productSitemapChangefreq,
    productSitemapPriority: settings.productSitemapPriority,
    includeProductsInSitemap: settings.includeProductsInSitemap,
    pages: settings.pages.map(page => ({
      key: page.key,
      label: page.label,
      path: page.path,
      title: page.title,
      description: page.description,
      image: page.image,
      robots: page.robots,
      changefreq: page.changefreq,
      priority: page.priority,
      includeInSitemap: page.includeInSitemap,
    })),
  }
}

// ── Main ──

await mongoose.connect(process.env.MONGO_URI)
console.log('+ MongoDB connected\n')

await mkdir(UPLOADS_DIR, { recursive: true })

// 1. Create admin user
console.log('── Creating admin user ──')
const existingAdmin = await User.findOne({ email: ADMIN_EMAIL })
if (existingAdmin) {
  console.log(`  > Admin already exists: ${existingAdmin.email}`)
} else {
  const admin = await User.create({
    name: ADMIN_NAME,
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    role: 'admin',
  })
  console.log(`  + Admin created: ${admin.email}`)
  console.log(`     Password: ${ADMIN_PASSWORD}`)
}

// 2. Resolve local upload paths
console.log('\n── Resolving local uploads ──')
const uploads = {}
for (const key of IMAGE_KEYS) {
  uploads[key] = await resolveLocalImage(key)
}

// 3. Clear existing site data
console.log('\n── Clearing old data ──')
await MenuItem.deleteMany({})
await Category.deleteMany({})
await SeoSettings.deleteMany({})
await SiteContent.deleteMany({})
console.log('  + Cleared categories, menu items, SEO settings and content settings')

// 4. Create categories
console.log('\n── Creating categories ──')
const categories = {}

categories.rus = await Category.create({
  name: 'Rus Pastaları',
  description: 'Geleneksel Rus pastacılığının en sevilen klasikleri',
  image: uploads.cat_rus,
  sortOrder: 1,
  active: true,
})
console.log(`  + Category: ${categories.rus.name}`)

categories.avrupa = await Category.create({
  name: 'Avrupa Pastaları',
  description: 'Avrupa pastacılık geleneklerinden seçme lezzetler',
  image: uploads.cat_avrupa,
  sortOrder: 2,
  active: true,
})
console.log(`  + Category: ${categories.avrupa.name}`)

categories.kurabiye = await Category.create({
  name: 'Kurabiyeler',
  description: 'El yapımı geleneksel kurabiyeler',
  image: uploads.cat_kurabiye,
  sortOrder: 3,
  active: true,
})
console.log(`  + Category: ${categories.kurabiye.name}`)

// 5. Create menu items
console.log('\n── Creating menu items ──')

const items = [
  {
    name: 'Medovik | Ballı Cevizli Rus Pastası',
    description: 'Medovik, Rus pastacılık geleneğinin en sevilen klasiklerinden biridir. Bal ile hazırlanan ince hamur katları, özel smetana (ekşi krema) ile bir araya getirilir.',
    price: 280,
    categoryId: categories.rus._id,
    image: uploads.medovik,
    gallery: [uploads['medovik-pasta-izmir-2'], uploads['medovik-1'], uploads['full-medovik-2'], uploads['portakali-medovik'], uploads['medovik-siparis']].filter(Boolean),
    sortOrder: 1,
  },
  {
    name: 'Spartak | Çikolatalı Medovik',
    description: 'Spartak (Ballı Cevizli Rus Pastası) Kakao ve Smetana\'lı. Çikolatalı Medovik.',
    price: 280,
    categoryId: categories.rus._id,
    image: uploads.spartak,
    gallery: [uploads['spartak-2'], uploads['spartak-izmir']].filter(Boolean),
    sortOrder: 2,
  },
  {
    name: 'Napolyon Pastası – Rus Usulü Milföy Katları',
    description: 'Napolyon pastası, Rus pastacılık kültürünün en bilinen klasiklerinden biridir. Endüstriyel yöntemlerden uzak, Rus usulü çok katlı milföy hamurlarıyla hazırlanır. Diplomat krema ile dengeli şekilde buluşturulur.',
    price: 290,
    categoryId: categories.rus._id,
    image: uploads.napolyon,
    gallery: [uploads['napolyon-izmir'], uploads['rus-napoleon'], uploads['napolyon-cilek']].filter(Boolean),
    sortOrder: 3,
  },
  {
    name: 'Havuçlu Ananaslı Cevizli Pasta',
    description: 'Loccake Havuçlu Ananaslı Cevizli Pasta. Mağaza Teslim Fiyatı.',
    price: 300,
    categoryId: categories.avrupa._id,
    image: uploads.havuclu,
    gallery: [uploads['havuclu-raffaello'], uploads['dogal-kek']].filter(Boolean),
    sortOrder: 1,
  },
  {
    name: 'Çikolatalı Truffle',
    description: 'Yoğun çikolata lezzetiyle hazırlanan özel truffle pasta.',
    price: 290,
    categoryId: categories.avrupa._id,
    image: uploads.truffle,
    gallery: [],
    sortOrder: 2,
  },
  {
    name: 'Oreshki, İçi Dolgulu Rus Kurabiyesi',
    description: 'Sgushonka dolgulu Rus Kurabiyesi. Ceviz şeklinde hazırlanan geleneksel Rus tatlısı.',
    price: 310,
    categoryId: categories.kurabiye._id,
    image: uploads.oreshki,
    gallery: [uploads['oreshki-2']].filter(Boolean),
    sortOrder: 1,
  },
]

for (const item of items) {
  const created = await MenuItem.create(item)
  console.log(`  + Item: ${created.name} — ₺${created.price}`)
}

// 6. Create SEO and content settings
console.log('\n── Creating SEO and content settings ──')
const seoDefaults = await seoStore.getSettings()
await SeoSettings.create(seedSeoDocument(seoDefaults))
console.log('  + SEO settings created')

const contentDefaults = await contentStore.getSettings()
await SiteContent.create(seedContentDocument(contentDefaults))
console.log('  + Content settings created')

// 7. Create Medovik blog post
console.log('\n── Creating blog post ──')
const MAP_EMBED = 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3125.8!2d27.144111!3d38.438194!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x14bbd8e66b3a3eeb%3A0x1c3d1c8c1c4dd5e8!2sLoccake!5e0!3m2!1str!2str!4v1700000000'

const medovikPost = {
  title: 'Medovik Nedir? Tarihi, Tarifi ve İzmir Alsancak Loccake\'de Nerede Tadabilirsiniz?',
  slug: 'medovik-nedir-tarihi-izmir-loccake',
  excerpt: 'Medovik (ballı Rus pastası) tarihini, geleneksel hazırlık sürecini ve İzmir Alsancak\'taki Loccake cafe\'de gerçek Medovik deneyimini keşfedin. Adres, harita ve sipariş bilgileri.',
  coverImage: uploads.medovik,
  metaTitle: 'Medovik Nedir? Tarihi ve İzmir Alsancak Loccake\'de Tadın',
  metaDescription: 'Medovik pastasının tarihini, geleneksel tarifini ve İzmir Alsancak Loccake\'de gerçek Rus Medovik deneyimini keşfedin. Alsancak adresi, harita ve sipariş için hemen ulaşın.',
  metaImage: uploads.medovik,
  robots: 'index, follow',
  published: true,
  publishedAt: new Date(),
  sortOrder: 1,
  blocks: [
    { type: 'title', text: 'Medovik Nedir?' },
    { type: 'subtitle', text: 'Rusya\'nın Efsanevi Ballı Pastası' },
    { type: 'paragraph', text: 'Medovik, bal ile hazırlanan ince hamur katları ve hafif ekşi krema (smetana) ile bir araya getirilen, Rusya pastacılığının en sevilen klasiklerinden biridir. Türkiye\'de özellikle İzmir\'de arayanlar için gerçek Medovik deneyimi, geleneksel tariflere sadık kalarak hazırlanan pastanelerde mümkündür.' },
    { type: 'image', image: uploads.medovik, imageAlt: 'Loccake Medovik — İzmir Alsancak Rus pastası' },
    { type: 'title', text: 'Medovik\'in Tarihi' },
    { type: 'paragraph', text: 'Medovik\'in kökeni 19. yüzyıl Rusya\'sına dayanır. Hikâyeye göre bir imparatoriçenin aşçısının bal aromalı bu pastayı ilk kez sunmasıyla ün kazanmıştır. Yıllar içinde evlerden saray mutfaklarına, oradan da günümüzün sevilen pastanelerine uzanan bir yolculuk yapmıştır.' },
    { type: 'italic', text: 'İnce hamur katları, balın derin aroması ve dengeli krema — Medovik\'i sıradan bir pastadan ayıran üç temel unsurdur.' },
    { type: 'paragraph', text: 'Bugün Medovik; doğum günleri, aile buluşmaları ve özel kutlamalarda Rusya ve komşu ülkelerde vazgeçilmez bir lezzettir. İzmir\'de de Rus pastası kültürünü yaşatan mekânlar, bu geleneği özenle sürdürmektedir.' },
    { type: 'image', image: uploads['full-medovik'], imageAlt: 'Geleneksel Medovik pasta katmanları' },
    { type: 'title', text: 'Medovik Nasıl Hazırlanır?' },
    { type: 'subtitle', text: 'İnce Hamur Katları ve Smetana' },
    { type: 'paragraph', text: 'Gerçek Medovik aceleye gelmez. Bal, yumurta, un ve tereyağı ile hazırlanan hamur ince ince açılır, fırınlanır ve soğumaya bırakılır. Her kat arasına özel smetana kreması sürülür; pasta bir gece dolapta dinlendirildikten sonra servis edilir. Bu süreç, hamurun kremayla yumuşamasını ve bal aromasının tüm katmanlara işlemesini sağlar.' },
    { type: 'image', image: uploads['medovik-1'], imageAlt: 'Medovik hamur katmanları hazırlığı' },
    { type: 'paragraph', text: 'Endüstriyel üretimde kısaltılan bu süreç, geleneksel pastanelerde hâlâ sabırla uygulanır. Loccake\'de Medovik; kat kat açılan hamur, gerçek bal ve özenle hazırlanan krema ile üretilir — İzmir Alsancak\'ta aradığınız o otantik lezzet için.' },
    { type: 'image', image: uploads['medovik-pasta-izmir-2'], imageAlt: 'İzmir Loccake Medovik pasta' },
    { type: 'title', text: 'Loccake\'de Gerçek Medovik Deneyimi' },
    { type: 'paragraph', text: 'Loccake, 2018 yılından bu yana İzmir Alsancak\'ta geleneksel Rus ve Avrupa pastalarını el yapımı olarak sunmaktadır. Medovik, Spartak ve Napolyon gibi klasikler; cafe atmosferinde taze kahve eşliğinde tadılabilir ya da paket servis ile evinize götürülebilir.' },
    { type: 'image', image: uploads['cafe-1'], imageAlt: 'Loccake cafe — Alsancak İzmir' },
    { type: 'image', image: uploads['irina-ozgur'], imageAlt: 'Loccake ekibi ve cafe atmosferi' },
    { type: 'paragraph', text: 'Alsancak Mahallesi 1440 Sokak 20/B adresinde, Kordon\'a yürüme mesafesinde konumlanan Loccake; hem yerli misafirler hem de Rus pastası arayan ziyaretçiler için sıcak bir durak. Medovik siparişi için 2–3 gün önceden haber vermeniz önerilir; yoğunluk durumuna göre ertesi güne yetiştirme imkânı da olabilir.' },
    { type: 'cta', text: 'İzmir\'de gerçek Medovik tatmak için Loccake\'e bekleriz. Dilim veya bütün pasta siparişi verebilir, cafe\'mizde keyifle yiyebilirsiniz.', buttonLabel: 'Medovik Sipariş Ver', buttonHref: '/menu' },
    { type: 'cta', text: 'Adres ve yol tarifi için iletişim sayfamızı ziyaret edin veya WhatsApp\'tan yazın.', buttonLabel: 'İletişim ve Harita', buttonHref: '/contact' },
    { type: 'map', embedUrl: MAP_EMBED },
    { type: 'paragraph', text: 'İzmir Alsancak Medovik, Rus pastası İzmir, Alsancak cafe ve geleneksel tatlı arayanlar için Loccake; harita üzerinden kolayca bulunabilir. Google\'da "Medovik İzmir" veya "Alsancak Rus pastası" arayanlar için gerçek lezzet, gerçek adres.' },
  ],
}

await BlogPost.findOneAndUpdate(
  { slug: medovikPost.slug },
  medovikPost,
  { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
)
console.log(`  + Blog post: ${medovikPost.title}`)

// Done
console.log('\n======================================')
console.log('  Seed completed successfully!')
console.log(`  Categories: ${await Category.countDocuments()}`)
console.log(`  Items: ${await MenuItem.countDocuments()}`)
console.log(`  SEO Settings: ${await SeoSettings.countDocuments()}`)
console.log(`  Content Settings: ${await SiteContent.countDocuments()}`)
console.log(`  Blog Posts: ${await BlogPost.countDocuments()}`)
console.log(`  Admin: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`)
console.log('======================================\n')

await mongoose.disconnect()
