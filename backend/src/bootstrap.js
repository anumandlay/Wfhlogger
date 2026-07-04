import path from 'path'
import dotenv from 'dotenv'

const envName = String(process.env.NODE_ENV || 'development').toLowerCase()

dotenv.config({ path: path.resolve(process.cwd(), `.env.${envName}`) })
dotenv.config({ path: path.resolve(process.cwd(), '.env') })

await import('./server.js')

