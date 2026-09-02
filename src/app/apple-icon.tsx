import { ImageResponse } from 'next/og'

/** Icône d'écran d'accueil iOS : même marque, dessinée pour un grand format. */
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
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
        }}
      >
        <svg width="112" height="112" viewBox="0 0 20 20" fill="none">
          <rect x="2.5" y="4" width="7" height="13" rx="1" fill="#ffffff" />
          <rect x="10.5" y="8" width="7" height="9" rx="1" fill="#ffffff" opacity="0.82" />
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
          <rect x="3.4" y="2.6" width="5.2" height="1" rx="0.5" fill="#dcbe79" />
        </svg>
      </div>
    ),
    size,
  )
}
