import { ScanLine, CalendarCheck, QrCode, Video } from 'lucide-react'

const features = [
  {
    id: 'feature-ai-detection',
    icon: ScanLine,
    color: '#2563EB',
    colorBg: 'rgba(37,99,235,0.08)',
    title: 'AI Slot Detection',
    description:
      'YOLO-powered computer vision identifies vacant and occupied parking spaces in real time from live CCTV feeds — no manual counting required.',
  },
  {
    id: 'feature-reservations',
    icon: CalendarCheck,
    color: '#059669',
    colorBg: 'rgba(5,150,105,0.08)',
    title: 'Instant Reservations',
    description:
      'Book a guaranteed parking slot from your phone before you even leave home. Reserve, confirm, and navigate — all in seconds.',
  },
  {
    id: 'feature-qr-entry',
    icon: QrCode,
    color: '#7C3AED',
    colorBg: 'rgba(124,58,237,0.08)',
    title: 'QR Code Entry',
    description:
      'Scan in and scan out at the parking gate with a generated QR code tied to your reservation. No tickets, no friction.',
  },
  {
    id: 'feature-live-monitor',
    icon: Video,
    color: '#B45309',
    colorBg: 'rgba(180,83,9,0.08)',
    title: 'Live Monitoring',
    description:
      'Parking managers get a real-time dashboard with camera feeds, occupancy statistics, and reservation logs — accessible from anywhere.',
  },
]

export default function Features() {
  return (
    <section id="features" className="section" style={{ background: '#fff' }}>
      <div className="container">

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '64px' }}>
          <div className="section-label">How It Works</div>
          <h2 style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 'clamp(1.875rem, 3.5vw, 2.5rem)',
            fontWeight: 700,
            color: 'var(--foreground)',
            letterSpacing: '-0.02em',
            marginBottom: '16px',
          }}>
            Parking, intelligently reinvented
          </h2>
          <p style={{
            fontFamily: 'var(--font-body)',
            fontSize: '1.0625rem',
            color: 'var(--muted-fg)',
            maxWidth: '520px',
            margin: '0 auto',
            lineHeight: 1.65,
          }}>
            Four integrated systems work together so drivers park faster and
            managers operate smarter.
          </p>
        </div>

        {/* Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '24px',
        }}>
          {features.map(f => {
            const Icon = f.icon
            return (
              <div
                key={f.id}
                id={f.id}
                style={{
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-card)',
                  padding: '28px',
                  boxShadow: 'var(--shadow-card)',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
                  cursor: 'default',
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLDivElement
                  el.style.transform = 'translateY(-4px)'
                  el.style.boxShadow = 'var(--shadow-card-hover)'
                  el.style.borderColor = f.color + '44'
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLDivElement
                  el.style.transform = 'translateY(0)'
                  el.style.boxShadow = 'var(--shadow-card)'
                  el.style.borderColor = 'var(--border)'
                }}
              >
                {/* Icon */}
                <div style={{
                  width: '48px', height: '48px',
                  borderRadius: '12px',
                  background: f.colorBg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: '20px',
                }}>
                  <Icon size={22} color={f.color} strokeWidth={1.8}/>
                </div>

                <h3 style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '1.125rem',
                  fontWeight: 600,
                  color: 'var(--foreground)',
                  marginBottom: '10px',
                  letterSpacing: '-0.01em',
                }}>
                  {f.title}
                </h3>
                <p style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '0.9375rem',
                  color: 'var(--muted-fg)',
                  lineHeight: 1.65,
                }}>
                  {f.description}
                </p>
              </div>
            )
          })}
        </div>

      </div>
    </section>
  )
}
