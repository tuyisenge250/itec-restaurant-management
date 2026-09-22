'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Users, Loader2, Pencil, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { StatusBadge } from '@/components/ui/status-badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { useUsers, useCreateUser, useUpdateUser, useDeleteUser, type User } from '@/lib/api/users'
import { useRoles } from '@/lib/api/roles'

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  roleId: z.string().min(1),
})
const editSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6).or(z.literal('')).optional(),
  roleId: z.string().min(1),
})
type CreateFormValues = z.infer<typeof createSchema>
type EditFormValues = z.infer<typeof editSchema>

const homeAreaBadge: Record<string, string> = {
  admin:   'bg-primary text-primary-foreground',
  kitchen: 'bg-warning text-warning-foreground',
  waiter:  'bg-secondary text-secondary-foreground',
  cashier: 'bg-success text-success-foreground',
}

export default function UsersPage() {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<User | null>(null)

  const { data: users = [], isLoading } = useUsers()
  const { data: roles = [] } = useRoles()
  const createMutation = useCreateUser()
  const updateMutation = useUpdateUser()
  const deleteMutation = useDeleteUser()

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<CreateFormValues | EditFormValues>({
    resolver: zodResolver(editing ? editSchema : createSchema) as never,
  })

  function openEdit(u: User) {
    setEditing(u)
    reset({ name: u.name, email: u.email, password: '', roleId: u.role.id })
    setOpen(true)
  }

  function openCreate() {
    setEditing(null)
    reset({ name: '', email: '', password: '', roleId: undefined })
    setOpen(true)
  }

  async function onSubmit(values: CreateFormValues | EditFormValues) {
    if (editing) {
      const { password, ...rest } = values as EditFormValues
      await updateMutation.mutateAsync({
        id: editing.id,
        data: { ...rest, ...(password ? { password } : {}) },
      })
    } else {
      await createMutation.mutateAsync(values as CreateFormValues)
    }
    reset()
    setOpen(false)
    setEditing(null)
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Users" description="Manage staff accounts and roles"
        action={<Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Add user</Button>}
      />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : users.length === 0 ? (
            <EmptyState icon={Users} message="No users yet." action={{ label: 'Add user', onClick: openCreate }} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id} className="hover:bg-accent">
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell><Badge className={homeAreaBadge[u.role.homeArea]}>{u.role.name}</Badge></TableCell>
                    <TableCell>
                      <button onClick={() => updateMutation.mutate({ id: u.id, data: { isActive: !u.isActive } })}>
                        <StatusBadge status={u.isActive ? 'active' : 'inactive'} />
                      </button>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(u)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(u.id)}
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
          <DialogHeader><DialogTitle>{editing ? 'Edit user' : 'Add user'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label>Name</Label>
              <Input placeholder="Jane Doe" {...register('name')} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Email</Label>
              <Input type="email" placeholder="jane@example.com" {...register('email')} />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{editing ? 'New password (leave blank to keep)' : 'Password'}</Label>
              <Input type="password" placeholder="••••••••" {...register('password')} />
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Role</Label>
              <Select
                value={watch('roleId') || null}
                onValueChange={(v) => v && setValue('roleId', v)}
              >
                <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                <SelectContent>
                  {roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {errors.roleId && <p className="text-xs text-destructive">{errors.roleId.message}</p>}
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
    </div>
  )
}
