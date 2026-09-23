import { Badge } from '@/components/ui/badge'

type Status =
  | 'pending' | 'preparing' | 'ready' | 'served' | 'payment_pending' | 'paid' | 'cancelled'
  | 'draft' | 'pending_approval' | 'ordered' | 'received'
  | 'active' | 'inactive' | 'low_stock' | 'fulfilled' | 'approved' | 'rejected' | 'on_hold'

const config: Record<Status, { label: string; className: string }> = {
  pending:            { label: 'Pending',            className: 'border border-border bg-muted text-foreground' },
  on_hold:            { label: 'On hold',             className: 'border border-warning/30 bg-warning/60 text-warning-foreground' },
  preparing:          { label: 'Preparing',          className: 'border border-warning/30 bg-warning text-warning-foreground' },
  ready:              { label: 'Ready',              className: 'border border-success/20 bg-success text-success-foreground' },
  served:             { label: 'Served',             className: 'border border-primary/10 bg-secondary text-secondary-foreground' },
  payment_pending:    { label: 'Awaiting confirmation', className: 'border border-warning/30 bg-warning/60 text-warning-foreground' },
  paid:               { label: 'Paid',               className: 'border border-success/20 bg-success text-success-foreground' },
  cancelled:          { label: 'Cancelled',          className: 'border border-destructive/20 bg-destructive/10 text-destructive' },
  draft:              { label: 'Draft',              className: 'border border-border bg-muted text-foreground' },
  pending_approval:   { label: 'Pending approval',   className: 'border border-warning/30 bg-warning/60 text-warning-foreground' },
  ordered:            { label: 'Ordered',            className: 'border border-warning/30 bg-warning text-warning-foreground' },
  received:           { label: 'Received',           className: 'border border-success/20 bg-success text-success-foreground' },
  active:             { label: 'Active',             className: 'border border-success/20 bg-success text-success-foreground' },
  inactive:           { label: 'Inactive',           className: 'border border-border bg-muted text-foreground' },
  low_stock:          { label: 'Low Stock',          className: 'border border-warning/30 bg-warning text-warning-foreground' },
  fulfilled:          { label: 'Fulfilled',          className: 'border border-success/20 bg-success text-success-foreground' },
  approved:           { label: 'Approved',           className: 'border border-warning/30 bg-warning text-warning-foreground' },
  rejected:           { label: 'Rejected',           className: 'border border-destructive/20 bg-destructive/10 text-destructive' },
}

export function StatusBadge({ status }: { status: string }) {
  const { label, className } = (config as Record<string, { label: string; className: string }>)[status] ?? { label: status, className: 'bg-muted text-muted-foreground' }
  return <Badge className={className}>{label}</Badge>
}
