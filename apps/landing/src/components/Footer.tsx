import { ExternalLink } from 'lucide-react'
import { AppStoreBadge, PlayStoreBadge } from './Badges'

export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer
      id="footer"
      style={{
        background: 'var(--accent)',
        color: 'rgba(255,255,255,0.6)',
        paddingTop: '72px',
        paddingBottom: '40px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Top border glow line */}
      <div aria-hidden="true" style={{
        position: 'absolute', top: 0, left: '10%', right: '10%', height: '1px',
        background: 'linear-gradient(90deg, transparent, rgba(37,99,235,0.5) 50%, transparent)',
      }}/>

      <div className="container">

        {/* Top row: brand + nav + download */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: '48px',
          marginBottom: '64px',
        }}>

          {/* Brand */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{
                width: '36px', height: '36px',
                background: 'var(--primary)',
                borderRadius: '9px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <rect x="3" y="3" width="14" height="14" rx="3" stroke="#fff" strokeWidth="1.75" fill="none"/>
                  <circle cx="10" cy="10" r="2.5" fill="#fff"/>
                  <circle cx="10" cy="10" r="1" fill="var(--primary)"/>
                </svg>
              </div>
              <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.125rem', color: '#fff' }}>
                ParKada
              </span>
            </div>
            <p style={{
              fontFamily: 'var(--font-body)',
              fontSize: '0.875rem',
              lineHeight: 1.7,
              color: 'rgba(255,255,255,0.45)',
              maxWidth: '240px',
            }}>
              AI-powered smart parking for De La Salle Lipa. 
              Real-time detection, instant reservations, QR entry.
            </p>
          </div>

          {/* Links */}
          <div>
            <div style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '0.75rem',
              fontWeight: 600,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.4)',
              marginBottom: '16px',
            }}>Quick Links</div>
            <nav aria-label="Footer navigation" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { label: 'Features', href: '#features' },
                { label: 'Meet the Team', href: '#team' },
                { label: 'Download', href: '#download' },
              ].map(l => (
                <a
                  key={l.href}
                  href={l.href}
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.9375rem',
                    color: 'rgba(255,255,255,0.55)',
                    textDecoration: 'none',
                    transition: 'color 0.15s',
                  }}
                  onMouseEnter={e => { (e.target as HTMLAnchorElement).style.color = '#fff' }}
                  onMouseLeave={e => { (e.target as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.55)' }}
                >
                  {l.label}
                </a>
              ))}
              <a
                href="https://admin.parkada.site"
                target="_blank"
                rel="noopener noreferrer"
                id="footer-admin-link"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '5px',
                  fontFamily: 'var(--font-body)',
                  fontSize: '0.9375rem',
                  color: 'rgba(255,255,255,0.55)',
                  textDecoration: 'none',
                  transition: 'color 0.15s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = '#fff' }}
                onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.55)' }}
              >
                Admin Portal
                <ExternalLink size={12} strokeWidth={2}/>
              </a>
            </nav>
          </div>

          {/* Download */}
          <div>
            <div style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '0.75rem',
              fontWeight: 600,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.4)',
              marginBottom: '16px',
            }}>Download</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <AppStoreBadge id="footer-badge-appstore" />
              <PlayStoreBadge id="footer-badge-playstore" />
            </div>
          </div>

        </div>

        {/* Divider */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '32px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.8125rem', color: 'rgba(255,255,255,0.3)' }}>
              © {year} ParKada — IT3C Group 9 · De La Salle Lipa
            </p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.8125rem', color: 'rgba(255,255,255,0.3)' }}>
              Cadeliña · Alcantara · Lique · Mendez
            </p>
          </div>
        </div>

      </div>

      <style>{`
        @media (max-width: 768px) {
          #footer > div > div:first-child { grid-template-columns: 1fr !important; gap: 32px !important; }
        }
      `}</style>
    </footer>
  )
}
