'use client'

import { useTransition } from 'react'
import { Download, Eye, Loader2 } from 'lucide-react'
import { getDocumentUrl } from '@/lib/actions/documents'

export function DocumentOpenButtons({ id, name }: { id: string; name: string }) {
  const [pending, start] = useTransition()

  function open(download: boolean) {
    start(async () => {
      const { url, error } = await getDocumentUrl(id, download)
      if (url) window.open(url, '_blank', 'noopener')
      else alert(error ?? 'Document indisponible.')
    })
  }

  return (
    <div className="flex items-center gap-0.5">
      <button type="button" onClick={() => open(false)} disabled={pending}
              className="btn-ghost btn-sm text-ink-600" aria-label={`Ouvrir ${name}`}>
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Eye className="size-4" aria-hidden />}
      </button>
      <button type="button" onClick={() => open(true)} disabled={pending}
              className="btn-ghost btn-sm text-ink-600" aria-label={`Télécharger ${name}`}>
        <Download className="size-4" aria-hidden />
      </button>
    </div>
  )
}
