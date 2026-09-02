/**
 * Écran d'attente commun à toutes les pages de l'application.
 *
 * Next l'affiche dès le clic, sans attendre la réponse du serveur : la
 * navigation devient perceptible immédiatement au lieu de sembler figée.
 * La silhouette reprend la structure réelle des pages — en-tête, indicateurs,
 * tableau — pour que le contenu ne semble pas sauter à son arrivée.
 */
export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Chargement en cours…</span>

      {/* En-tête */}
      <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="skeleton h-9 w-64" />
          <div className="skeleton mt-3 h-4 w-80" />
        </div>
        <div className="skeleton h-11 w-40 rounded-lg" />
      </div>

      {/* Indicateurs */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card h-[7.5rem] p-5">
            <div className="skeleton h-3.5 w-24" />
            <div className="skeleton mt-4 h-7 w-32" />
            <div className="skeleton mt-3 h-3 w-28" />
          </div>
        ))}
      </div>

      {/* Bloc de contenu */}
      <div className="card overflow-hidden">
        <div className="border-b border-ink-100 px-5 py-4">
          <div className="skeleton h-4 w-40" />
        </div>
        <div className="divide-y divide-ink-100">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4">
              <div className="skeleton h-4 w-28 shrink-0" />
              <div className="skeleton h-4 flex-1" />
              <div className="skeleton h-4 w-24 shrink-0" />
              <div className="skeleton h-6 w-20 shrink-0 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
