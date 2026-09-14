import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  const passwordHash = await bcrypt.hash('demo1234', 10)

  const admin = await prisma.user.upsert({
    where: { email: 'admin@demo.com' },
    update: {},
    create: { name: 'Admin User', email: 'admin@demo.com', passwordHash, role: 'admin' },
  })

  const kitchen = await prisma.user.upsert({
    where: { email: 'kitchen@demo.com' },
    update: {},
    create: { name: 'Kitchen User', email: 'kitchen@demo.com', passwordHash, role: 'kitchen' },
  })

  const waiter = await prisma.user.upsert({
    where: { email: 'waiter@demo.com' },
    update: {},
    create: { name: 'Waiter User', email: 'waiter@demo.com', passwordHash, role: 'waiter' },
  })

  // Sample inventory items
  const flour = await prisma.inventoryItem.create({
    data: { name: 'Flour', unit: 'kg', currentStock: 50, avgUnitCost: 1.2, reorderLevel: 10 },
  })
  const cheese = await prisma.inventoryItem.create({
    data: { name: 'Cheese', unit: 'kg', currentStock: 20, avgUnitCost: 6.5, reorderLevel: 5 },
  })
  const tomato = await prisma.inventoryItem.create({
    data: { name: 'Tomato sauce', unit: 'l', currentStock: 15, avgUnitCost: 2.0, reorderLevel: 3 },
  })

  // Sample menu item with recipe (BOM)
  const pizza = await prisma.menuItem.create({
    data: { name: 'Margherita Pizza', category: 'Main', price: 12.5 },
  })

  await prisma.recipeItem.createMany({
    data: [
      { menuItemId: pizza.id, inventoryItemId: flour.id, quantity: 0.3 },
      { menuItemId: pizza.id, inventoryItemId: cheese.id, quantity: 0.2 },
      { menuItemId: pizza.id, inventoryItemId: tomato.id, quantity: 0.15 },
    ],
  })

  console.log('Seed complete:')
  console.log('  admin@demo.com   / demo1234')
  console.log('  kitchen@demo.com / demo1234')
  console.log('  waiter@demo.com  / demo1234')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })