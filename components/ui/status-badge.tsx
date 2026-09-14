import { Badge } from '@/components/ui/badge'

type Status =
  | 'pending' | 'preparing' | 'ready' | 'served' | 'paid' | 'cancelled'
  | 'draft' | 'ordered' | 'partially_received' | 'received'
  | 'active' | 'inactive' | 'low_stock'

const config: Record<Status, { label: string; className: string }> = {
  pending:            { label: 'Pending',            className: 'bg-muted text-muted-foreground' },
  preparing:          { label: 'Preparing',          className: 'bg-warning text-warning-foreground' },
  ready:              { label: 'Ready',              className: 'bg-success text-success-foreground' },
  served:             { label: 'Served',             className: 'bg-secondary text-secondary-foreground' },
  paid:               { label: 'Paid',               className: 'bg-success text-success-foreground' },
  cancelled:          { label: 'Cancelled',          className: 'bg-destructive text-destructive-foreground' },
  draft:              { label: 'Draft',              className: 'bg-muted text-muted-foreground' },
  ordered:            { label: 'Ordered',            className: 'bg-warning text-warning-foreground' },
  partially_received: { label: 'Partial',            className: 'bg-secondary text-secondary-foreground' },
  received:           { label: 'Received',           className: 'bg-success text-success-foreground' },
  active:             { label: 'Active',             className: 'bg-success text-success-foreground' },
  inactive:           { label: 'Inactive',           className: 'bg-muted text-muted-foreground' },
  low_stock:          { label: 'Low Stock',          className: 'bg-warning text-warning-foreground' },
}

export function StatusBadge({ status }: { status: string }) {
  const { label, className } = (config as Record<string, { label: string; className: string }>)[status] ?? { label: status, className: 'bg-muted text-muted-foreground' }
  return <Badge className={className}>{label}</Badge>
}
