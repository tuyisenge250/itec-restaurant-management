'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, ShieldCheck, Loader2, Pencil, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import { useRoles, useCreateRole, useUpdateRole, useDeleteRole, type Role, type HomeArea, type CreateRoleInput } from '@/lib/api/roles'
import { PERMISSIONS, PERMISSION_CATEGORIES } from '@/lib/permissions'
import { createRoleSchema } from '@/lib/validation/role.schema'

const HOME_AREA_LABEL: Record<HomeArea, string> = { admin: 'Admin', kitchen: 'Kitchen', waiter: 'Waiter', cashier: 'Cashier' }
const homeAreaBadge: Record<HomeArea, string> = {
  admin:   'bg-primary text-primary-foreground',
  kitchen: 'bg-warning text-warning-foreground',
  waiter:  'bg-secondary text-secondary-foreground',
  cashier: 'bg-success text-success-foreground',
}

const DEFAULT_VALUES: CreateRoleInput = { name: '', homeArea: 'waiter', maxDiscountPercent: 0, permissions: [] }

export default function RolesPage() {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Role | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null)

  const { data: roles = [], isLoading } = useRoles()
  const createMutation = useCreateRole()
  const updateMutation = useUpdateRole()
  const deleteMutation = useDeleteRole()

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<CreateRoleInput>({
    resolver: zodResolver(createRoleSchema),
    defaultValues: DEFAULT_VALUES,
  })
  const permissions = watch('permissions') ?? []

  function togglePermission(key: string, checked: boolean) {
    setValue('permissions', checked ? [...permissions, key] : permissions.filter((k) => k !== key))
  }

  function openEdit(role: Role) {
    setEditing(role)
    reset({ name: role.name, homeArea: role.homeArea, maxDiscountPercent: role.maxDiscountPercent, permissions: role.permissions })
    setOpen(true)
  }

  function openCreate() {
    setEditing(null)
    reset(DEFAULT_VALUES)
    setOpen(true)
  }

  async function onSubmit(values: CreateRoleInput) {
    if (editing) {
      await updateMutation.mutateAsync({ id: editing.id, data: values })
    } else {
      await createMutation.mutateAsync(values)
    }
    reset(DEFAULT_VALUES)
    setOpen(false)
    setEditing(null)
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    await deleteMutation.mutateAsync(deleteTarget.id)
    setDeleteTarget(null)
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Roles & Permissions"
        description="Create custom roles and control exactly what each one can do"
        action={<Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />New role</Button>}
      />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : roles.length === 0 ? (
            <EmptyState icon={ShieldCheck} message="No roles yet." action={{ label: 'New role', onClick: openCreate }} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Home area</TableHead>
                  <TableHead>Discount cap</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map((role) => (
                  <TableRow key={role.id} className="hover:bg-accent">
                    <TableCell className="font-medium">{role.name}</TableCell>
                    <TableCell><Badge className={homeAreaBadge[role.homeArea]}>{HOME_AREA_LABEL[role.homeArea]}</Badge></TableCell>
                    <TableCell className="text-muted-foreground">{role.maxDiscountPercent}%</TableCell>
                    <TableCell className="text-muted-foreground">{role.permissions.length} / {PERMISSIONS.length}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(role)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setDeleteTarget(role)}>
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

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditing(null); reset(DEFAULT_VALUES) } }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edit role' : 'New role'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Name</Label>
                <Input placeholder="e.g. Shift Supervisor" {...register('name')} />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Home area <span className="text-muted-foreground">(which page shell)</span></Label>
                <Select value={watch('homeArea')} onValueChange={(v) => v && setValue('homeArea', v as HomeArea)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="kitchen">Kitchen</SelectItem>
                    <SelectItem value="waiter">Waiter</SelectItem>
                    <SelectItem value="cashier">Cashier</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Max discount % <span className="text-muted-foreground">(server-enforced ceiling on any discount this role applies)</span></Label>
              <Input type="number" min={0} max={100} {...register('maxDiscountPercent', { valueAsNumber: true })} />
              {errors.maxDiscountPercent && <p className="text-xs text-destructive">{errors.maxDiscountPercent.message}</p>}
            </div>

            <div className="flex flex-col gap-3">
              <Label>Permissions <span className="text-muted-foreground">({permissions.length} selected)</span></Label>
              {PERMISSION_CATEGORIES.map((category) => (
                <div key={category} className="flex flex-col gap-1.5 rounded-md border border-border p-3">
                  <span className="text-xs font-medium text-muted-foreground">{category}</span>
                  {PERMISSIONS.filter((p) => p.category === category).map((p) => (
                    <label key={p.key} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={permissions.includes(p.key)}
                        onCheckedChange={(checked) => togglePermission(p.key, checked === true)}
                      />
                      {p.label}
                    </label>
                  ))}
                </div>
              ))}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setOpen(false); setEditing(null); reset(DEFAULT_VALUES) }}>Cancel</Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editing ? 'Update' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete role &ldquo;{deleteTarget?.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              This can&apos;t be undone. A role with users still assigned to it can&apos;t be deleted — reassign them first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="destructive" disabled={deleteMutation.isPending} onClick={confirmDelete}>
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
