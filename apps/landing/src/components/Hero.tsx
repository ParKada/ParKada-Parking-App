import { AppStoreBadge, PlayStoreBadge } from './Badges'

const stats = [
  { value: '100%', label: 'AI-Powered Detection' },
  { value: 'Real-time', label: 'Live Slot Updates' },
  { value: 'QR-based', label: 'Seamless Entry' },
]

export default function Hero() {
  return (
    <section
      id="home"
      style={{
        background: 'transparent',
        borderBottom: '1px solid rgba(0,0,0,0.08)',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background grid overlay */}
      <div aria-hidden="true" style={{
        position: 'absolute', inset: 0,
        backgroundImage: `
          linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px)
        `,
        backgroundSize: '48px 48px',
        maskImage: 'radial-gradient(ellipse 80% 80% at 50% 40%, black 40%, transparent 100%)',
        WebkitMaskImage: 'radial-gradient(ellipse 80% 80% at 50% 40%, black 40%, transparent 100%)',
      }}/>

      {/* Glow blobs */}
      <div aria-hidden="true" style={{
        position: 'absolute', top: '15%', left: '8%',
        width: '420px', height: '420px',
        background: 'radial-gradient(circle, rgba(37,99,235,0.18) 0%, transparent 70%)',
        borderRadius: '50%',
        filter: 'blur(40px)',
        pointerEvents: 'none',
      }}/>
      <div aria-hidden="true" style={{
        position: 'absolute', bottom: '10%', right: '5%',
        width: '320px', height: '320px',
        background: 'radial-gradient(circle, rgba(5,150,105,0.12) 0%, transparent 70%)',
        borderRadius: '50%',
        filter: 'blur(60px)',
        pointerEvents: 'none',
      }}/>

      <div className="container" style={{ paddingTop: '100px', paddingBottom: '80px', width: '100%', position: 'relative', zIndex: 10 }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '64px',
          alignItems: 'center',
        }}>

          {/* Left: Text */}
          <div style={{ animation: 'fadeUp 0.7s ease forwards' }}>
            {/* Thesis badge */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              background: 'rgba(37,99,235,0.08)',
              border: '1px solid rgba(37,99,235,0.2)',
              borderRadius: '999px',
              padding: '5px 14px 5px 10px',
              marginBottom: '28px',
            }}>
              <span style={{
                width: '7px', height: '7px',
                borderRadius: '50%',
                background: '#2563EB',
                display: 'inline-block',
                boxShadow: '0 0 6px #2563EB',
              }}/>
              <span style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '0.75rem',
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#60A5FA',
              }}>
                IT Thesis Project · De La Salle Lipa
              </span>
            </div>

            <h1 style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 'clamp(2.5rem, 5vw, 3.75rem)',
              fontWeight: 700,
              color: 'var(--foreground)',
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
              marginBottom: '20px',
            }}>
              Smart Parking,<br/>
              <span style={{
                background: 'linear-gradient(90deg, #60A5FA 0%, #34D399 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>Made Simple.</span>
            </h1>

            <p style={{
              fontFamily: 'var(--font-body)',
              fontSize: '1.0625rem',
              color: 'var(--muted-fg)',
              lineHeight: 1.7,
              maxWidth: '440px',
              marginBottom: '36px',
            }}>
              ParKada eliminates parking guesswork using AI-powered real-time slot
              detection, instant mobile reservations, and QR code entry — all
              designed for De La Salle Lipa.
            </p>

            {/* CTA badges */}
            <div id="download" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '48px' }}>
              <AppStoreBadge id="hero-badge-appstore" />
              <PlayStoreBadge id="hero-badge-playstore" />
            </div>

            {/* Stats row */}
            <div style={{
              display: 'flex', gap: '32px',
              paddingTop: '32px',
              position: 'relative',
            }}>
              {/* Glowy dividing line */}
              <div aria-hidden="true" style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: '1px',
                background: 'linear-gradient(90deg, transparent, rgba(0,0,0,0.15) 30%, rgba(0,0,0,0.15) 70%, transparent)',
                boxShadow: '0 0 8px rgba(0,0,0,0.1)',
              }}/>
              {stats.map(s => (
                <div key={s.label}>
                  <div style={{
                    fontFamily: 'var(--font-heading)',
                    fontSize: '1.375rem',
                    fontWeight: 700,
                    color: 'var(--foreground)',
                    letterSpacing: '-0.02em',
                    marginBottom: '2px',
                  }}>{s.value}</div>
                  <div style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.8125rem',
                    color: 'var(--muted-fg)',
                    fontWeight: 500,
                  }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Phone mockup */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            position: 'relative',
          }}>
            {/* Glow ring behind phone */}
            <div aria-hidden="true" style={{
              position: 'absolute',
              width: '340px', height: '340px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(37,99,235,0.12) 0%, transparent 70%)',
              filter: 'blur(24px)',
            }}/>
            <img
              src="/phone-mockup.png"
              alt="ParKada app showing real-time parking slot availability on a map"
              className="animate-float"
              style={{
                maxHeight: '520px',
                width: 'auto',
                position: 'relative',
                zIndex: 1,
                filter: 'drop-shadow(0 24px 48px rgba(0,0,0,0.5))',
              }}
            />
          </div>

        </div>
      </div>

      {/* Responsive */}
      <style>{`
        @media (max-width: 900px) {
          #home > div > div { grid-template-columns: 1fr !important; gap: 48px !important; }
          #home img { max-height: 360px !important; }
        }
        @media (max-width: 480px) {
          #home h1 { font-size: 2.25rem !important; }
          #home > div { padding-top: 120px !important; }
        }
      `}</style>
    </section>
  )
}
