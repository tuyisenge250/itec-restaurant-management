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

  // A second admin exists so the seeded purchase order can demonstrate the
  // "a PO can't be approved by its own creator" rule with two real users.
  const opsAdmin = await prisma.user.upsert({
    where: { email: 'ops@demo.com' },
    update: {},
    create: { name: 'Ops Admin', email: 'ops@demo.com', passwordHash, role: 'admin' },
  })

  await prisma.user.upsert({
    where: { email: 'kitchen@demo.com' },
    update: {},
    create: { name: 'Kitchen User', email: 'kitchen@demo.com', passwordHash, role: 'kitchen' },
  })

  await prisma.user.upsert({
    where: { email: 'waiter@demo.com' },
    update: {},
    create: { name: 'Waiter User', email: 'waiter@demo.com', passwordHash, role: 'waiter' },
  })

  await prisma.user.upsert({
    where: { email: 'cashier@demo.com' },
    update: {},
    create: { name: 'Cashier User', email: 'cashier@demo.com', passwordHash, role: 'cashier' },
  })

  const supplier = await prisma.supplier.create({
    data: {
      name: 'Fresh Farms Ltd',
      phone: '+250-788-000-111',
      email: 'orders@freshfarms.example',
      paymentTerms: 'Net 30',
    },
  })

  const flour = await prisma.inventoryItem.create({
    data: { name: 'Flour', unit: 'kg', reorderLevel: 10 },
  })
  const cheese = await prisma.inventoryItem.create({
    data: { name: 'Cheese', unit: 'kg', reorderLevel: 5 },
  })
  const tomato = await prisma.inventoryItem.create({
    data: { name: 'Tomato sauce', unit: 'l', reorderLevel: 3 },
  })

  // A fully worked purchase-order lifecycle (draft -> pending_approval ->
  // ordered -> received), so the resulting InventoryLots/transactions look
  // like real receiving activity rather than data injected out of band.
  const po = await prisma.purchaseOrder.create({
    data: {
      supplierId: supplier.id,
      status: 'draft',
      createdById: admin.id,
      items: {
        create: [
          { inventoryItemId: flour.id, quantityOrdered: 50, unitCost: 1.2 },
          { inventoryItemId: cheese.id, quantityOrdered: 20, unitCost: 6.5 },
          { inventoryItemId: tomato.id, quantityOrdered: 15, unitCost: 2.0 },
        ],
      },
    },
    include: { items: true },
  })

  await prisma.purchaseOrder.update({
    where: { id: po.id },
    data: {
      status: 'ordered',
      approvedById: opsAdmin.id,
      approvedAt: new Date(),
    },
  })

  const goodsReceipt = await prisma.goodsReceipt.create({
    data: { purchaseOrderId: po.id, receivedById: admin.id },
  })

  for (const item of po.items) {
    const lot = await prisma.inventoryLot.create({
      data: {
        inventoryItemId: item.inventoryItemId,
        supplierId: supplier.id,
        costingMethod: 'fifo',
        unitCost: item.unitCost,
        quantityReceived: item.quantityOrdered,
        quantityRemaining: item.quantityOrdered,
      },
    })

    await prisma.goodsReceiptLine.create({
      data: {
        goodsReceiptId: goodsReceipt.id,
        purchaseOrderItemId: item.id,
        quantityReceived: item.quantityOrdered,
        unitCost: item.unitCost,
        costingMethod: 'fifo',
        inventoryLotId: lot.id,
      },
    })

    await prisma.inventoryTransaction.create({
      data: {
        inventoryItemId: item.inventoryItemId,
        lotId: lot.id,
        type: 'receipt',
        source: 'purchase_order',
        quantity: item.quantityOrdered,
        unitCost: item.unitCost,
        referenceId: po.id,
        recordedById: admin.id,
      },
    })

    await prisma.purchaseOrderItem.update({
      where: { id: item.id },
      data: { quantityReceived: item.quantityOrdered },
    })

    await prisma.inventoryItem.update({
      where: { id: item.inventoryItemId },
      data: { currentStock: item.quantityOrdered },
    })
  }

  await prisma.purchaseOrder.update({ where: { id: po.id }, data: { status: 'received' } })

  const mains = await prisma.menuCategory.create({ data: { name: 'Mains', sortOrder: 1 } })

  const pizza = await prisma.menuItem.create({
    data: { name: 'Margherita Pizza', categoryId: mains.id, price: 12.5, preparationCost: 0.5 },
  })

  await prisma.recipeItem.createMany({
    data: [
      { menuItemId: pizza.id, inventoryItemId: flour.id, quantity: 0.3 },
      { menuItemId: pizza.id, inventoryItemId: cheese.id, quantity: 0.2 },
      { menuItemId: pizza.id, inventoryItemId: tomato.id, quantity: 0.15 },
    ],
  })

  console.log('Seed complete:')
  console.log('  admin@demo.com   / demo1234  (created the seeded PO)')
  console.log('  ops@demo.com     / demo1234  (approved the seeded PO)')
  console.log('  kitchen@demo.com / demo1234')
  console.log('  waiter@demo.com  / demo1234')
  console.log('  cashier@demo.com / demo1234')
  console.log(`Seeded ${po.items.length} inventory lots for supplier "${supplier.name}".`)
  console.log(`Seeded menu item "${pizza.name}" with a 3-ingredient recipe.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
