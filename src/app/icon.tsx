import { ImageResponse } from 'next/og'

/**
 * Icône de l'onglet, générée à la compilation plutôt que fournie en fichier :
 * elle reste ainsi alignée sur les couleurs de la marque, définies au même
 * endroit que le reste du thème.
 *
 * Contrainte de dessin : l'icône est lue à 16 px. Silhouette pleine, peu de
 * fenêtres, fort contraste — tout détail fin disparaîtrait.
 */
export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(145deg, #4f63b6 0%, #2a3468 100%)',
          borderRadius: 7,
        }}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          {/* Tour haute */}
          <rect x="2.5" y="4" width="7" height="13" rx="1" fill="#ffffff" />
          {/* Tour basse */}
          <rect x="10.5" y="8" width="7" height="9" rx="1" fill="#ffffff" opacity="0.82" />
          {/* Fenêtres : creusées dans la façade, lisibles en très petit */}
          <rect x="4.2" y="6.1" width="1.7" height="1.7" fill="#2a3468" />
          <rect x="6.6" y="6.1" width="1.7" height="1.7" fill="#2a3468" />
          <rect x="4.2" y="9.2" width="1.7" height="1.7" fill="#2a3468" />
          <rect x="6.6" y="9.2" width="1.7" height="1.7" fill="#2a3468" />
          <rect x="4.2" y="12.3" width="1.7" height="1.7" fill="#2a3468" />
          <rect x="6.6" y="12.3" width="1.7" height="1.7" fill="#2a3468" />
          <rect x="12.2" y="10.3" width="1.6" height="1.6" fill="#2a3468" />
          <rect x="14.4" y="10.3" width="1.6" height="1.6" fill="#2a3468" />
          <rect x="12.2" y="13.1" width="1.6" height="1.6" fill="#2a3468" />
          <rect x="14.4" y="13.1" width="1.6" height="1.6" fill="#2a3468" />
          {/* Liseré doré en couronnement, rappel de la marque */}
          <rect x="3.4" y="2.6" width="5.2" height="1" rx="0.5" fill="#dcbe79" />
        </svg>
      </div>
    ),
    size,
  )
}
