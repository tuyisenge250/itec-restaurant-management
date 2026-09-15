'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Trash2, ClipboardList } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useInventory, useInventoryLots, useLogWaste, useWasteLog, type LogWasteInput } from '@/lib/api/inventory'
import { logWasteSchema } from '@/lib/validation/inventory.schema'
import { rwf } from '@/lib/utils'

export default function KitchenWastePage() {
  const { data: inventory = [], isLoading } = useInventory()
  const [selectedItemId, setSelectedItemId] = useState('')
  const { data: lots = [] } = useInventoryLots(selectedItemId || undefined)
  const { data: wasteLog = [], isLoading: logLoading } = useWasteLog()
  const logWaste = useLogWaste()

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<LogWasteInput>({
    resolver: zodResolver(logWasteSchema),
  })
  const lotId = watch('lotId')
  const selectedLot = lots.find((l) => l.id === lotId)

  async function onSubmit(values: LogWasteInput) {
    await logWaste.mutateAsync(values)
    reset({ lotId: '', quantity: undefined, notes: '' })
    setSelectedItemId('')
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Report Waste" description="Log spoiled or discarded ingredients, against the exact batch" />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="h-fit">
          <CardContent className="p-5">
            {isLoading ? (
              <div className="flex flex-col gap-4">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label>Item</Label>
                  <Select
                    value={selectedItemId || null}
                    onValueChange={(v) => { setSelectedItemId(v ?? ''); setValue('lotId', '') }}
                  >
                    <SelectTrigger className="w-full"><SelectValue placeholder="Select an item" /></SelectTrigger>
                    <SelectContent>
                      {inventory.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name} — {item.currentStock.toFixed(2)} {item.unit} available
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label>Batch (lot)</Label>
                  <Select
                    value={lotId || null}
                    onValueChange={(v) => v && setValue('lotId', v)}
                    disabled={!selectedItemId}
                  >
                    <SelectTrigger className="w-full"><SelectValue placeholder={selectedItemId ? 'Select a batch' : 'Select an item first'} /></SelectTrigger>
                    <SelectContent>
                      {lots.map((lot) => (
                        <SelectItem key={lot.id} value={lot.id}>
                          {lot.quantityRemaining.toFixed(2)} remaining · {lot.costingMethod.toUpperCase()} · received {new Date(lot.receivedAt).toLocaleDateString()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedItemId && lots.length === 0 && (
                    <p className="text-xs text-muted-foreground">No open batches for this item.</p>
                  )}
                  {errors.lotId && <p className="text-xs text-destructive">{errors.lotId.message}</p>}
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label>Quantity wasted</Label>
                  <Input
                    type="number" step="0.01" placeholder="0.00"
                    max={selectedLot?.quantityRemaining}
                    {...register('quantity', { valueAsNumber: true })}
                  />
                  {errors.quantity && <p className="text-xs text-destructive">{errors.quantity.message}</p>}
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label>Notes (optional)</Label>
                  <Textarea placeholder="e.g. spoiled overnight, dropped tray" {...register('notes')} />
                </div>

                <Button type="submit" disabled={logWaste.isPending || !lotId} className="mt-1">
                  {logWaste.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                  Log waste
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {logLoading ? (
              <div className="flex flex-col gap-2 p-4">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : wasteLog.length === 0 ? (
              <EmptyState icon={ClipboardList} message="No waste logged yet." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead>When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {wasteLog.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium">{entry.inventoryItem.name}</TableCell>
                      <TableCell className="text-right">{Math.abs(entry.quantity).toFixed(2)} {entry.inventoryItem.unit}</TableCell>
                      <TableCell className="text-right">{rwf(Math.abs(entry.quantity) * entry.unitCost)}</TableCell>
                      <TableCell className="text-muted-foreground">{new Date(entry.createdAt).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
