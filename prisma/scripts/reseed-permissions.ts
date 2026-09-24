import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { seedPermissionCatalog } from '../seed-permissions'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

// Re-run whenever lib/permissions.ts gains new catalog entries — idempotent
// upsert, safe on a live DB with existing roles (nothing already granted is
// touched, only new/changed catalog rows are written).
seedPermissionCatalog(prisma)
  .then(() => console.log('Permission catalog synced.'))
  .catch((err) => { console.error(err); process.exit(1) })
  .finally(() => prisma.$disconnect())
