export function PageHeader({
  title, subtitle, actions,
}: {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}) {
  return (
    <header className="reveal mb-7 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
      <div className="min-w-0">
        <h1 className="font-display text-[1.7rem] leading-[1.08] text-ink-900 sm:text-[2rem]">
          {title}
        </h1>
        {subtitle && <p className="mt-1.5 max-w-3xl text-[15px] leading-snug text-ink-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 no-print">{actions}</div>}
    </header>
  )
}
