'use client'

import { useState } from 'react'
import type { DateRange } from 'react-day-picker'
import { Plus, Pencil, Trash2, Settings, Loader2, Receipt } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog'
import { DateRangePicker } from '@/components/date-range-picker'
import {
  useExpenseCategories, useCreateExpenseCategory, useUpdateExpenseCategory,
  useExpenses, useCreateExpense, useUpdateExpense, useDeleteExpense,
  type Expense, type ExpenseCategory,
} from '@/lib/api/expenses'
import { rwf } from '@/lib/utils'

function toDateInput(d: Date) {
  return d.toISOString().slice(0, 10)
}

function CategoriesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: categories = [] } = useExpenseCategories()
  const createCategory = useCreateExpenseCategory()
  const updateCategory = useUpdateExpenseCategory()
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  async function handleAdd() {
    if (!newName.trim()) return
    await createCategory.mutateAsync({ name: newName.trim() })
    setNewName('')
  }

  function startRename(c: ExpenseCategory) {
    setEditingId(c.id)
    setEditingName(c.name)
  }

  async function commitRename(c: ExpenseCategory) {
    if (editingName.trim() && editingName.trim() !== c.name) {
      await updateCategory.mutateAsync({ id: c.id, data: { name: editingName.trim() } })
    }
    setEditingId(null)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Expense categories</DialogTitle></DialogHeader>
        <div className="flex flex-col gap-2">
          {categories.length === 0 && <p className="text-sm text-muted-foreground">No categories yet.</p>}
          {categories.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2">
              {editingId === c.id ? (
                <Input
                  autoFocus
                  className="h-7"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onBlur={() => commitRename(c)}
                  onKeyDown={(e) => { if (e.key === 'Enter') commitRename(c) }}
                />
              ) : (
                <button className="text-sm hover:underline" onClick={() => startRename(c)}>{c.name}</button>
              )}
              <Button
                size="sm"
                variant="outline"
                disabled={updateCategory.isPending}
                onClick={() => updateCategory.mutate({ id: c.id, data: { isActive: !c.isActive } })}
              >
                {c.isActive ? 'Active' : 'Inactive'}
              </Button>
            </div>
          ))}
        </div>
        <div className="flex gap-2 pt-2">
          <Input placeholder="New category name" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <Button disabled={!newName.trim() || createCategory.isPending} onClick={handleAdd}>Add</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ExpenseFormDialog({ expense, open, onClose }: { expense: Expense | null; open: boolean; onClose: () => void }) {
  const isEditing = !!expense
  const { data: categories = [] } = useExpenseCategories(true)
  const createExpense = useCreateExpense()
  const updateExpense = useUpdateExpense()

  const [categoryId, setCategoryId] = useState('')
  const [amount, setAmount] = useState('')
  const [expenseDate, setExpenseDate] = useState(toDateInput(new Date()))
  const [description, setDescription] = useState('')
  const [isRecurring, setIsRecurring] = useState(false)
  const [error, setError] = useState('')

  // Re-seed the form whenever a different expense is opened for editing (or
  // the dialog is opened fresh for a new one).
  const [seededFor, setSeededFor] = useState<string | null>(null)
  const key = expense?.id ?? 'new'
  if (open && seededFor !== key) {
    setSeededFor(key)
    setCategoryId(expense?.categoryId ?? '')
    setAmount(expense ? String(expense.amount) : '')
    setExpenseDate(expense ? expense.expenseDate.slice(0, 10) : toDateInput(new Date()))
    setDescription(expense?.description ?? '')
    setIsRecurring(expense?.isRecurring ?? false)
    setError('')
  }

  async function handleSubmit() {
    setError('')
    const amountN = parseFloat(amount)
    if (!categoryId) { setError('Choose a category.'); return }
    if (!amountN || amountN <= 0) { setError('Enter an amount greater than zero.'); return }
    try {
      if (isEditing) {
        await updateExpense.mutateAsync({
          id: expense.id,
          data: { categoryId, amount: amountN, description: description || undefined, isRecurring },
        })
      } else {
        await createExpense.mutateAsync({
          categoryId, amount: amountN, expenseDate, description: description || undefined, isRecurring,
        })
      }
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the expense.')
    }
  }

  const isPending = createExpense.isPending || updateExpense.isPending

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent>
        <DialogHeader><DialogTitle>{isEditing ? 'Edit expense' : 'Add expense'}</DialogTitle></DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Category</Label>
            <Select value={categoryId || null} onValueChange={(v) => setCategoryId(v ?? '')}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Choose a category" /></SelectTrigger>
              <SelectContent>
                {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Amount</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Expense date</Label>
            <Input
              type="date"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              disabled={isEditing}
            />
            {isEditing && (
              <p className="text-xs text-muted-foreground">
                The date can&apos;t be changed once an expense is logged — delete and re-create it instead.
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Description <span className="text-muted-foreground">(optional)</span></Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-border"
              checked={isRecurring}
              onChange={(e) => setIsRecurring(e.target.checked)}
            />
            Recurring (a label only — you&apos;ll need to log it again next period)
          </label>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={isPending} onClick={handleSubmit}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? 'Save changes' : 'Add expense'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function ExpensesPage() {
  const [range, setRange] = useState<DateRange | undefined>(undefined)
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [recurringOnly, setRecurringOnly] = useState(false)
  const [page, setPage] = useState(1)

  const [formTarget, setFormTarget] = useState<Expense | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [categoriesOpen, setCategoriesOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null)

  const { data: allCategories = [] } = useExpenseCategories()
  const deleteExpense = useDeleteExpense()

  const { data, isLoading } = useExpenses({
    from: range?.from ? toDateInput(range.from) : undefined,
    to: range?.to ? toDateInput(range.to) : undefined,
    categoryId: categoryFilter === 'all' ? undefined : categoryFilter,
    isRecurring: recurringOnly ? true : undefined,
    page,
  })

  const expenses = data?.entries ?? []
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1

  function openAdd() {
    setFormTarget(null)
    setFormOpen(true)
  }
  function openEdit(expense: Expense) {
    setFormTarget(expense)
    setFormOpen(true)
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Expenses"
        description="Operating costs logged against a period, for net profit reporting"
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setCategoriesOpen(true)}>
              <Settings className="mr-2 h-4 w-4" />Categories
            </Button>
            <Button onClick={openAdd}><Plus className="mr-2 h-4 w-4" />Add expense</Button>
          </div>
        }
      />

      <Card>
        <CardContent className="flex flex-row flex-wrap items-end gap-3 p-4">
          <DateRangePicker value={range} onChange={(r) => { setRange(r); setPage(1) }} />
          <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v ?? 'all'); setPage(1) }}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {allCategories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <label className="flex h-9 items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-border"
              checked={recurringOnly}
              onChange={(e) => { setRecurringOnly(e.target.checked); setPage(1) }}
            />
            Recurring only
          </label>
          {(range || categoryFilter !== 'all' || recurringOnly) && (
            <Button variant="outline" size="sm" onClick={() => { setRange(undefined); setCategoryFilter('all'); setRecurringOnly(false); setPage(1) }}>
              Clear filters
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col gap-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : expenses.length === 0 ? (
            <EmptyState icon={Receipt} message="No expenses match these filters." action={{ label: 'Add expense', onClick: openAdd }} />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Recorded by</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map((e) => (
                    <TableRow key={e.id} className="hover:bg-accent">
                      <TableCell className="font-medium">{new Date(e.expenseDate).toLocaleDateString()}</TableCell>
                      <TableCell>
                        {e.category.name}
                        {e.isRecurring && <Badge variant="secondary" className="ml-2">Recurring</Badge>}
                      </TableCell>
                      <TableCell className="text-right">{rwf(e.amount)}</TableCell>
                      <TableCell className="text-muted-foreground">{e.description || '—'}</TableCell>
                      <TableCell className="text-muted-foreground">{e.recordedBy.name}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEdit(e)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setDeleteTarget(e)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-border p-3">
                  <span className="text-sm text-muted-foreground">Page {page} of {totalPages} · {data?.total} total</span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                    <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <ExpenseFormDialog expense={formTarget} open={formOpen} onClose={() => setFormOpen(false)} />
      <CategoriesDialog open={categoriesOpen} onClose={() => setCategoriesOpen(false)} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this expense?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && `${deleteTarget.category.name} · ${rwf(deleteTarget.amount)} on ${new Date(deleteTarget.expenseDate).toLocaleDateString()}. `}
              This removes it from all future reports but keeps the record for audit purposes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => { if (deleteTarget) deleteExpense.mutate(deleteTarget.id); setDeleteTarget(null) }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
