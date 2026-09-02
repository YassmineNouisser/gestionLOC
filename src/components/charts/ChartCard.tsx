export function ChartCard({
  title, subtitle, legend, children, action,
}: {
  title: string
  subtitle?: string
  legend?: { label: string; color: string }[]
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <section className="card reveal p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-[1.15rem] leading-tight text-ink-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-ink-500">{subtitle}</p>}
        </div>
        {action}
      </div>

      {legend && legend.length > 0 && (
        <ul className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1.5">
          {legend.map((l) => (
            <li key={l.label} className="flex items-center gap-2 text-sm text-ink-600">
              <span className="size-2.5 rounded-sm" style={{ background: l.color }} aria-hidden />
              {l.label}
            </li>
          ))}
        </ul>
      )}

      {children}
    </section>
  )
}
