'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Truck, Loader2, Pencil, Trash2, History } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { StatusBadge } from '@/components/ui/status-badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import {
  useSuppliers, useCreateSupplier, useUpdateSupplier, useDeleteSupplier, useSupplierHistory,
  type Supplier,
} from '@/lib/api/suppliers'
import { createSupplierSchema } from '@/lib/validation/purchase-order.schema'
import { rwf } from '@/lib/utils'
import type { z } from 'zod'

type FormValues = z.infer<typeof createSupplierSchema>

function SupplierHistoryDialog({ supplierId, onClose }: { supplierId: string | null; onClose: () => void }) {
  const { data, isLoading } = useSupplierHistory(supplierId ?? undefined)

  return (
    <Dialog open={!!supplierId} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Supplier history — {data?.supplier.name}</DialogTitle></DialogHeader>
        {isLoading || !data ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <div className="flex flex-col gap-4">
            {data.supplier.paymentTerms && (
              <p className="text-sm text-muted-foreground">Terms: {data.supplier.paymentTerms}</p>
            )}
            <div className="grid grid-cols-3 gap-3 rounded-md border border-border p-3 text-sm">
              <div><span className="text-muted-foreground">Received value</span><p className="font-medium">{rwf(data.totals.receivedValue)}</p></div>
              <div><span className="text-muted-foreground">Paid</span><p className="font-medium">{rwf(data.totals.paidValue)}</p></div>
              <div>
                <span className="text-muted-foreground">{data.totals.owed > 0 ? 'Total owed' : 'Total credit'}</span>
                <p className={`font-medium ${data.totals.owed > 0 ? 'text-destructive' : 'text-success'}`}>
                  {rwf(Math.abs(data.totals.owed))}
                </p>
              </div>
            </div>

            {data.orders.length === 0 ? (
              <p className="text-sm text-muted-foreground">No purchase orders with this supplier yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Received</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Owed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.orders.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="text-muted-foreground">{new Date(o.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell><StatusBadge status={o.status} /></TableCell>
                      <TableCell className="text-right">{rwf(o.receivedValue)}</TableCell>
                      <TableCell className="text-right">{rwf(o.paidValue)}</TableCell>
                      <TableCell className={`text-right ${o.owed > 0 ? 'text-destructive' : ''}`}>{rwf(o.owed)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function SuppliersPage() {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [historyId, setHistoryId] = useState<string | null>(null)

  const { data: suppliers = [], isLoading } = useSuppliers()
  const createMutation = useCreateSupplier()
  const updateMutation = useUpdateSupplier()
  const deleteMutation = useDeleteSupplier()

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(createSupplierSchema),
  })

  function openEdit(s: Supplier) {
    setEditing(s)
    reset({ name: s.name, phone: s.phone ?? '', email: s.email ?? '', address: s.address ?? '', paymentTerms: s.paymentTerms ?? '' })
    setOpen(true)
  }

  function openCreate() {
    setEditing(null)
    reset({ name: '', phone: '', email: '', address: '', paymentTerms: '' })
    setOpen(true)
  }

  async function onSubmit(values: FormValues) {
    if (editing) {
      await updateMutation.mutateAsync({ id: editing.id, data: values })
    } else {
      await createMutation.mutateAsync(values)
    }
    reset()
    setOpen(false)
    setEditing(null)
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Suppliers" description="Manage your ingredient suppliers"
        action={<Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Add supplier</Button>}
      />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : suppliers.length === 0 ? (
            <EmptyState icon={Truck} message="No suppliers yet." action={{ label: 'Add supplier', onClick: openCreate }} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.map((s) => (
                  <TableRow key={s.id} className="hover:bg-accent">
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="text-muted-foreground">{s.phone ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{s.email ?? '—'}</TableCell>
                    <TableCell>
                      <button onClick={() => updateMutation.mutate({ id: s.id, data: { isActive: !s.isActive } })}>
                        <StatusBadge status={s.isActive ? 'active' : 'inactive'} />
                      </button>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => setHistoryId(s.id)}>
                          <History className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => openEdit(s)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(s.id)}
                          disabled={deleteMutation.isPending}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditing(null); reset() } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editing ? 'Edit supplier' : 'Add supplier'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label>Name</Label>
              <Input placeholder="Fresh Farms" {...register('name')} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Phone</Label>
              <Input placeholder="0700-000-000" {...register('phone')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Email</Label>
              <Input type="email" placeholder="supplier@example.com" {...register('email')} />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Address</Label>
              <Input placeholder="Kigali, Rwanda" {...register('address')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Payment terms <span className="text-muted-foreground">(optional)</span></Label>
              <Input placeholder="Net 30, COD, ..." {...register('paymentTerms')} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setOpen(false); setEditing(null); reset() }}>Cancel</Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editing ? 'Update' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <SupplierHistoryDialog supplierId={historyId} onClose={() => setHistoryId(null)} />
    </div>
  )
}
