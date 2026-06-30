import { writeFile, mkdir, unlink } from 'node:fs/promises'
import { randomBytes } from 'node:crypto'
import { extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const UPLOADS_DIR = join(__dirname, '..', 'public', 'uploads')

const ALLOWED_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/pjpeg',
  'image/png',
  'image/x-png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'image/avif',
]

const MAX_SIZE_LOCAL = 5 * 1024 * 1024
const MAX_SIZE_BLOB = 4 * 1024 * 1024 // Vercel serverless body limit ~4.5 MB

function useBlob() {
  return !!process.env.BLOB_READ_WRITE_TOKEN
}

function isBlobUrl(url) {
  return typeof url === 'string'
    && url.startsWith('https://')
    && url.includes('.blob.vercel-storage.com')
}

function isProtectedLocalImage(url) {
  return typeof url === 'string' && url.startsWith('/uploads/seed-')
}

function validateFile(file, maxSize) {
  if (!file || !file.data) return null

  if (!ALLOWED_TYPES.includes(file.mimetype)) {
    throw new Error(`Invalid file type: ${file.mimetype}. Allowed: JPG, PNG, WebP, GIF, SVG, AVIF`)
  }

  if (file.size > maxSize) {
    const mb = Math.floor(maxSize / (1024 * 1024))
    throw new Error(`File too large. Maximum size: ${mb} MB`)
  }

  return extname(file.filename) || '.jpg'
}

async function ensureUploadsDir() {
  await mkdir(UPLOADS_DIR, { recursive: true })
}

async function saveToLocal(file) {
  const ext = validateFile(file, MAX_SIZE_LOCAL)
  if (!ext) return null

  await ensureUploadsDir()

  const name = randomBytes(16).toString('hex') + ext
  const filePath = join(UPLOADS_DIR, name)

  await writeFile(filePath, file.data)

  return '/uploads/' + name
}

async function saveToBlob(file) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error(
      'BLOB_READ_WRITE_TOKEN is not set. Create a Blob store in Vercel Dashboard → Storage and link it to this project.'
    )
  }

  const ext = validateFile(file, MAX_SIZE_BLOB)
  if (!ext) return null

  const { put } = await import('@vercel/blob')
  const pathname = `uploads/${randomBytes(16).toString('hex')}${ext}`

  const blob = await put(pathname, file.data, {
    access: 'public',
    contentType: file.mimetype,
    token: process.env.BLOB_READ_WRITE_TOKEN,
  })

  return blob.url
}

export async function saveImage(file) {
  if (useBlob()) {
    return saveToBlob(file)
  }
  return saveToLocal(file)
}

export async function deleteImage(imageUrl) {
  if (!imageUrl || isProtectedLocalImage(imageUrl)) return

  if (isBlobUrl(imageUrl)) {
    const { del } = await import('@vercel/blob')
    await del(imageUrl, { token: process.env.BLOB_READ_WRITE_TOKEN })
    return
  }

  if (!imageUrl.startsWith('/uploads/')) return

  const filename = imageUrl.replace('/uploads/', '')
  if (filename.includes('/') || filename.includes('..')) return

  const filePath = join(UPLOADS_DIR, filename)
  try {
    await unlink(filePath)
  } catch {
    // File may not exist, that's ok
  }
}

export function isRemoteImage(url) {
  return isBlobUrl(url)
}
