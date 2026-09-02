export function EmptyState({
  icon, title, description, action,
}: {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="reveal flex flex-col items-center justify-center px-6 py-16 text-center">
      {icon && (
        <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-gradient-to-b from-ink-100 to-ink-50 text-ink-400 ring-1 ring-inset ring-ink-200">
          {icon}
        </div>
      )}
      <p className="font-display text-[1.2rem] leading-tight text-ink-900">{title}</p>
      {description && <p className="mt-1.5 max-w-md text-[15px] text-ink-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
