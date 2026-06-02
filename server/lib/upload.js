import { writeFile, mkdir, unlink } from 'node:fs/promises'
import { randomBytes } from 'node:crypto'
import { extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const UPLOADS_DIR = join(__dirname, '..', 'public', 'uploads')
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
const MAX_SIZE = 5 * 1024 * 1024 // 5 MB

await mkdir(UPLOADS_DIR, { recursive: true })

export async function saveImage(file) {
  if (!file || !file.data) return null

  if (!ALLOWED_TYPES.includes(file.mimetype)) {
    throw new Error('Invalid file type. Allowed: JPG, PNG, WebP, GIF, SVG')
  }

  if (file.size > MAX_SIZE) {
    throw new Error('File too large. Maximum size: 5 MB')
  }

  const ext = extname(file.filename) || '.jpg'
  const name = randomBytes(16).toString('hex') + ext
  const filePath = join(UPLOADS_DIR, name)

  await writeFile(filePath, file.data)

  return '/uploads/' + name
}

export async function deleteImage(imageUrl) {
  if (!imageUrl || !imageUrl.startsWith('/uploads/')) return

  if (imageUrl.startsWith('/uploads/seed-')) return

  const filename = imageUrl.replace('/uploads/', '')

  // Prevent path traversal
  if (filename.includes('/') || filename.includes('..')) return

  const filePath = join(UPLOADS_DIR, filename)
  try {
    await unlink(filePath)
  } catch {
    // File may not exist, that's ok
  }
}
