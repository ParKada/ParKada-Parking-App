import { AppStoreBadge, PlayStoreBadge } from './Badges'
import DarkVeil from './DarkVeil'
import TrueFocus from './TrueFocus'

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
        background: 'var(--accent)',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* DarkVeil Background */}
      <div className="absolute inset-0 z-0">
        <DarkVeil
          speed={2.0}
          noiseIntensity={0.05}
          scanlineIntensity={0.3}
          scanlineFrequency={800}
          hueShift={10}
          warpAmount={0.3}
          resolutionScale={1}
        />
      </div>

      {/* Semi-transparent overlay for text readability */}
      <div aria-hidden="true" style={{
        position: 'absolute', inset: 0, zIndex: 0,
        background: 'linear-gradient(to bottom, rgba(10,29,55,0.4), rgba(10,29,55,0.7))',
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
              background: 'rgba(37,99,235,0.12)',
              border: '1px solid rgba(37,99,235,0.28)',
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

            <div style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(2.5rem, 5vw, 3.75rem)',
              color: '#FFFFFF',
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
              marginBottom: '20px',
            }}>
              <TrueFocus 
                sentence="Smart Parking, Made Simple."
                manualMode={false}
                blurAmount={4}
                borderColor="#0df103" 
                glowColor="rgba(13, 241, 3, 0.4)"
                animationDuration={0.6}
                pauseBetweenAnimations={1.5}
              />
            </div>

            <p style={{
              fontFamily: 'var(--font-body)',
              fontSize: '1.0625rem',
              color: 'rgba(255,255,255,0.6)',
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
              borderTop: '1px solid rgba(255,255,255,0.08)',
            }}>
              {stats.map(s => (
                <div key={s.label}>
                  <div style={{
                    fontFamily: 'var(--font-heading)',
                    fontSize: '1.375rem',
                    fontWeight: 700,
                    color: '#fff',
                    letterSpacing: '-0.02em',
                    marginBottom: '2px',
                  }}>{s.value}</div>
                  <div style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.8125rem',
                    color: 'rgba(255,255,255,0.45)',
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
              background: 'radial-gradient(circle, rgba(37,99,235,0.22) 0%, transparent 70%)',
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
