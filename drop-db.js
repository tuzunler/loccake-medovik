import 'dotenv/config'
import mongoose from 'mongoose'

const mongoUri = process.env.MONGO_URI
if (!mongoUri) {
  console.error('MONGO_URI is not set in .env')
  process.exit(1)
}

const confirmed = process.argv.includes('--yes') || process.env.CONFIRM_DROP === '1'
if (!confirmed) {
  console.error('Refusing to drop database without confirmation.')
  console.error('Run: npm run drop-db:yes')
  process.exit(1)
}

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to drop database when NODE_ENV=production')
  process.exit(1)
}

await mongoose.connect(mongoUri)
const dbName = mongoose.connection.name

console.log(`Dropping database: ${dbName}`)
await mongoose.connection.dropDatabase()
console.log(`Database "${dbName}" dropped successfully.`)

await mongoose.disconnect()
