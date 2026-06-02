import 'dotenv/config'
import mongoose from 'mongoose'
import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import User from './models/User.js'
import Category from './models/Category.js'
import MenuItem from './models/MenuItem.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const UPLOADS_DIR = join(__dirname, 'public', 'uploads')

// ── Config ──

const ADMIN_EMAIL = 'admin@loccake.ru'
const ADMIN_PASSWORD = 'admin123'
const ADMIN_NAME = 'Admin'

// ── Image URLs from loccake.com ──

const IMAGES = {
  // Category images
  cat_rus: 'https://www.loccake.com/wp-content/gallery/puspastalari/medovik-ball%C4%B1-rus-pastas%C4%B1.jpg',
  cat_avrupa: 'https://www.loccake.com/wp-content/uploads/2020/06/havuclu-cevizli-ananasli-pasta.jpg',
  cat_kurabiye: 'https://www.loccake.com/wp-content/uploads/2016/11/cev.jpg',

  // Product images
  medovik: 'https://www.loccake.com/wp-content/uploads/2020/05/Medovik-rus-pastasi.jpg',
  spartak: 'https://www.loccake.com/wp-content/uploads/2020/11/img-20230818-wa0007.jpg',
  napolyon: 'https://www.loccake.com/wp-content/uploads/2020/11/napolyon-pasta-milfoylu-rus-pastasi.jpg',
  havuclu: 'https://www.loccake.com/wp-content/uploads/2020/06/havuclu-cevizli-ananasli-pasta.jpg',
  truffle: 'https://www.loccake.com/wp-content/uploads/2022/05/cikolatali-truffle-loccake-izmir.jpg',
  oreshki: 'https://www.loccake.com/wp-content/uploads/2016/11/cev.jpg',

  // Birthday party photos
  'birthday-1': 'https://www.loccake.com/wp-content/gallery/dogumgunu/16.jpeg',
  'birthday-2': 'https://www.loccake.com/wp-content/gallery/dogumgunu/15.jpeg',
  'birthday-3': 'https://www.loccake.com/wp-content/gallery/dogumgunu/13.jpeg',
  'birthday-4': 'https://www.loccake.com/wp-content/gallery/dogumgunu/12.jpeg',
  'birthday-5': 'https://www.loccake.com/wp-content/gallery/dogumgunu/11.jpeg',
  'birthday-6': 'https://www.loccake.com/wp-content/gallery/dogumgunu/9.jpeg',

  // Cafe photos
  'cafe-1': 'https://www.loccake.com/wp-content/gallery/cafe/kordon-kafeleri.jpeg',
  'cafe-2': 'https://www.loccake.com/wp-content/gallery/cafe/kordon-izmir-eglence.jpeg',
  'cafe-3': 'https://www.loccake.com/wp-content/gallery/cafe/konak-kafeleri.jpeg',
  'cafe-4': 'https://www.loccake.com/wp-content/gallery/cafe/izmir-sessiz-kafeler.jpeg',
  'cafe-5': 'https://www.loccake.com/wp-content/gallery/cafe/izmir-kahve-fiyatlari.jpeg',
  'cafe-6': 'https://www.loccake.com/wp-content/gallery/cafe/izmir-elit-kafeler.jpeg',

  // Extra gallery/page images
  'full-medovik': 'https://www.loccake.com/wp-content/gallery/puspastalari/full-medovik.jpg',
  'medovik-pasta-izmir': 'https://www.loccake.com/wp-content/gallery/puspastalari/medovik_pasta_izmir.jpg',
  'medovik-pasta-izmir-2': 'https://www.loccake.com/wp-content/uploads/2020/11/medovik-pasta-izmir.jpg',
  'medovik-1': 'https://www.loccake.com/wp-content/uploads/2020/04/medovik-1.jpg',
  'full-medovik-2': 'https://www.loccake.com/wp-content/uploads/2020/04/full-medovik.jpg',
  'irina-ozgur': 'https://www.loccake.com/wp-content/uploads/2020/04/irina-ozgur-loccake.jpg',
  'spartak-1': 'https://www.loccake.com/wp-content/gallery/puspastalari/SPARTAK-1.jpg',
  'medovik-1-1': 'https://www.loccake.com/wp-content/gallery/puspastalari/medovik-1-1.jpg',
  'napolyon-izmir': 'https://www.loccake.com/wp-content/uploads/2020/11/napolyon-pasta-izmir.jpeg',
  'alsancak': 'https://www.loccake.com/wp-content/gallery/cafe/izmir-alsancak-kafeleri.jpeg',

  // Product gallery images (from loccake.com product pages)
  'portakali-medovik': 'https://www.loccake.com/wp-content/uploads/2018/05/portakal%C4%B1-medovik.jpeg',
  'medovik-siparis': 'https://www.loccake.com/wp-content/uploads/2020/05/Medovik-rus-pastasi-siparis.jpg',
  'spartak-2': 'https://www.loccake.com/wp-content/uploads/2020/05/spartak.jpg',
  'spartak-izmir': 'https://www.loccake.com/wp-content/uploads/2020/05/spartak-pasta-izmir.jpg',
  'rus-napoleon': 'https://www.loccake.com/wp-content/uploads/2020/11/rus-napoleon-pasta.jpeg',
  'napolyon-cilek': 'https://www.loccake.com/wp-content/uploads/2020/11/napolyon-dogum-gunu-pastasi-cilek-dekorlu.jpeg',
  'havuclu-raffaello': 'https://www.loccake.com/wp-content/uploads/2020/06/havuclu-raffaello.jpg',
  'dogal-kek': 'https://www.loccake.com/wp-content/uploads/2020/06/DOGAL-KEK-2.jpg',
  'oreshki-2': 'https://www.loccake.com/wp-content/uploads/2021/06/adsiz-tasarim_20231203_205656_0000.jpg',
}

// ── Download helper ──

async function downloadImage(url, filename) {
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const buffer = Buffer.from(await res.arrayBuffer())
    const filePath = join(UPLOADS_DIR, filename)
    await writeFile(filePath, buffer)
    console.log(`  + Downloaded: ${filename}`)
    return '/uploads/' + filename
  } catch (err) {
    console.log(`  x Failed to download ${filename}: ${err.message}`)
    return ''
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

// 2. Download all images
console.log('\n── Downloading images ──')
const downloaded = {}
for (const [key, url] of Object.entries(IMAGES)) {
  const ext = url.match(/\.\w+$/)?.[0] || '.jpg'
  const filename = `seed-${key}${ext}`
  downloaded[key] = await downloadImage(url, filename)
}

// 3. Clear existing categories and items
console.log('\n── Clearing old data ──')
await MenuItem.deleteMany({})
await Category.deleteMany({})
console.log('  + Cleared categories and menu items')

// 4. Create categories
console.log('\n── Creating categories ──')
const categories = {}

categories.rus = await Category.create({
  name: 'Rus Pastaları',
  description: 'Geleneksel Rus pastacılığının en sevilen klasikleri',
  image: downloaded.cat_rus,
  sortOrder: 1,
  active: true,
})
console.log(`  + Category: ${categories.rus.name}`)

categories.avrupa = await Category.create({
  name: 'Avrupa Pastaları',
  description: 'Avrupa pastacılık geleneklerinden seçme lezzetler',
  image: downloaded.cat_avrupa,
  sortOrder: 2,
  active: true,
})
console.log(`  + Category: ${categories.avrupa.name}`)

categories.kurabiye = await Category.create({
  name: 'Kurabiyeler',
  description: 'El yapımı geleneksel kurabiyeler',
  image: downloaded.cat_kurabiye,
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
    price: 250,
    categoryId: categories.rus._id,
    image: downloaded.medovik,
    gallery: [downloaded['medovik-pasta-izmir-2'], downloaded['medovik-1'], downloaded['full-medovik-2'], downloaded['portakali-medovik'], downloaded['medovik-siparis']].filter(Boolean),
    sortOrder: 1,
  },
  {
    name: 'Spartak | Çikolatalı Medovik',
    description: 'Spartak (Ballı Cevizli Rus Pastası) Kakao ve Smetana\'lı. Çikolatalı Medovik.',
    price: 250,
    categoryId: categories.rus._id,
    image: downloaded.spartak,
    gallery: [downloaded['spartak-2'], downloaded['spartak-izmir']].filter(Boolean),
    sortOrder: 2,
  },
  {
    name: 'Napolyon Pastası – Rus Usulü Milföy Katları',
    description: 'Napolyon pastası, Rus pastacılık kültürünün en bilinen klasiklerinden biridir. Endüstriyel yöntemlerden uzak, Rus usulü çok katlı milföy hamurlarıyla hazırlanır. Diplomat krema ile dengeli şekilde buluşturulur.',
    price: 280,
    categoryId: categories.rus._id,
    image: downloaded.napolyon,
    gallery: [downloaded['napolyon-izmir'], downloaded['rus-napoleon'], downloaded['napolyon-cilek']].filter(Boolean),
    sortOrder: 3,
  },
  {
    name: 'Havuçlu Ananaslı Cevizli Pasta',
    description: 'Loccake Havuçlu Ananaslı Cevizli Pasta. Mağaza Teslim Fiyatı.',
    price: 300,
    categoryId: categories.avrupa._id,
    image: downloaded.havuclu,
    gallery: [downloaded['havuclu-raffaello'], downloaded['dogal-kek']].filter(Boolean),
    sortOrder: 1,
  },
  {
    name: 'Çikolatalı Truffle',
    description: 'Yoğun çikolata lezzetiyle hazırlanan özel truffle pasta.',
    price: 290,
    categoryId: categories.avrupa._id,
    image: downloaded.truffle,
    gallery: [],
    sortOrder: 2,
  },
  {
    name: 'Oreshki, İçi Dolgulu Rus Kurabiyesi',
    description: 'Sgushonka dolgulu Rus Kurabiyesi. Ceviz şeklinde hazırlanan geleneksel Rus tatlısı.',
    price: 310,
    categoryId: categories.kurabiye._id,
    image: downloaded.oreshki,
    gallery: [downloaded['oreshki-2']].filter(Boolean),
    sortOrder: 1,
  },
]

for (const item of items) {
  const created = await MenuItem.create(item)
  console.log(`  + Item: ${created.name} — ₺${created.price}`)
}

// Done
console.log('\n======================================')
console.log('  Seed completed successfully!')
console.log(`  Categories: ${await Category.countDocuments()}`)
console.log(`  Items: ${await MenuItem.countDocuments()}`)
console.log(`  Admin: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`)
console.log('======================================\n')

await mongoose.disconnect()
