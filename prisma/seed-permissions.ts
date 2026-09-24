import type { PrismaClient } from '@prisma/client'
import { PERMISSIONS } from '../lib/permissions'

function slugify(label: string) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

// Seeds Module + Permission rows from lib/permissions.ts's catalog — that
// file stays the single source of truth for what permissions CAN exist; this
// just materializes it into real rows so a role can only ever be granted a
// permission that genuinely exists (a DB-level FK, not just app-level
// validation of a loose string array). One Module per category, one
// Permission per catalog entry with `key` unchanged from today's dotted
// string ("requisitions.manage") so every requirePermission(...) call site
// across the app keeps working without modification. Idempotent (upserts by
// the unique `key`) — safe to re-run.
export async function seedPermissionCatalog(prisma: PrismaClient) {
  const moduleIdByCategory = new Map<string, string>()
  for (const category of [...new Set(PERMISSIONS.map((p) => p.category))]) {
    const key = slugify(category)
    const row = await prisma.module.upsert({
      where: { key },
      update: { label: category },
      create: { key, label: category },
    })
    moduleIdByCategory.set(category, row.id)
  }

  for (const p of PERMISSIONS) {
    const moduleId = moduleIdByCategory.get(p.category)!
    const action = p.key.includes('.') ? p.key.slice(p.key.indexOf('.') + 1) : p.key
    await prisma.permission.upsert({
      where: { key: p.key },
      update: { label: p.label, action, moduleId },
      create: { key: p.key, label: p.label, action, moduleId },
    })
  }
}
