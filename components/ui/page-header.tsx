interface PageHeaderProps {
  title: string
  description?: string
  action?: React.ReactNode
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[2rem]">{title}</h1>
        {description && <p className="text-sm font-medium text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="shrink-0 sm:pt-1">{action}</div>}
    </div>
  )
}
