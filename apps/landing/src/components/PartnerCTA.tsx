import { Building2, ArrowRight } from 'lucide-react'

export default function PartnerCTA() {
  return (
    <section id="partner" style={{ padding: '80px 0', position: 'relative' }}>
      <div className="container">
        <div style={{
          background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.1) 0%, rgba(37, 99, 235, 0.05) 100%)',
          borderRadius: '24px',
          padding: '64px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Subtle glow effect */}
          <div style={{
            position: 'absolute',
            top: '0',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '60%',
            height: '200px',
            background: 'radial-gradient(ellipse at top, rgba(37, 99, 235, 0.3) 0%, transparent 70%)',
            zIndex: 0,
            pointerEvents: 'none'
          }}></div>

          <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '16px',
              background: 'rgba(37, 99, 235, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '24px'
            }}>
              <Building2 size={32} color="var(--primary)" />
            </div>

            <h2 style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '2.5rem',
              fontWeight: 800,
              color: '#fff',
              marginBottom: '16px',
              letterSpacing: '-0.02em'
            }}>
              List Your Parking Establishment
            </h2>
            
            <p style={{
              fontFamily: 'var(--font-body)',
              fontSize: '1.125rem',
              color: 'rgba(255, 255, 255, 0.7)',
              maxWidth: '600px',
              lineHeight: 1.6,
              marginBottom: '40px'
            }}>
              Join the ParKada network. Manage your parking slots digitally, track revenue in real-time, and attract more drivers to your establishment.
            </p>

            <a
              href="https://portal.parkada.site"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                background: 'var(--primary)',
                color: '#fff',
                padding: '16px 32px',
                borderRadius: '12px',
                fontFamily: 'var(--font-heading)',
                fontWeight: 600,
                fontSize: '1rem',
                textDecoration: 'none',
                transition: 'all 0.2s ease-in-out',
                boxShadow: '0 4px 14px 0 rgba(37, 99, 235, 0.39)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(37, 99, 235, 0.5)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 4px 14px 0 rgba(37, 99, 235, 0.39)'
              }}
            >
              Register as a Partner
              <ArrowRight size={18} />
            </a>
          </div>
        </div>
      </div>
      
      <style>{`
        @media (max-width: 768px) {
          #partner > .container > div {
            padding: 40px 24px !important;
          }
          #partner h2 {
            fontSize: 2rem !important;
          }
        }
      `}</style>
    </section>
  )
}
