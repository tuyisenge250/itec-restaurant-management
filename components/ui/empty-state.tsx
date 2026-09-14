import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface EmptyStateProps {
  icon: LucideIcon
  message: string
  action?: { label: string; onClick: () => void }
}

export function EmptyState({ icon: Icon, message, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 border border-dashed border-border bg-card/60 px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary shadow-sm ring-1 ring-border/80">
        <Icon className="h-6 w-6 text-primary" />
      </div>
      <p className="max-w-sm text-base font-medium text-foreground">{message}</p>
      {action && (
        <Button onClick={action.onClick} size="sm">
          {action.label}
        </Button>
      )}
    </div>
  )
}
