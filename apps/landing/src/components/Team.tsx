import { Github } from 'lucide-react'

interface Member {
  id: string
  name: string
  handle: string
  role: string
  contributions: string[]
  initials: string
  color: string
  colorBg: string
}

const team: Member[] = [
  {
    id: 'team-regina',
    name: 'Regina Angeli Cadeliña',
    handle: '@rivioops',
    role: 'Project Leader & Systems Engineer',
    contributions: ['Project Management', 'Full-Stack Development', 'AI & IoT Integration', 'Cloud Solutions'],
    initials: 'RC',
    color: '#2563EB',
    colorBg: 'rgba(37,99,235,0.1)',
  },
  {
    id: 'team-janna',
    name: 'Janna Mikhaela Alcantara',
    handle: '@jmkalcantara',
    role: 'Business Analyst & QA Engineer',
    contributions: ['Business Analysis', 'Quality Assurance', 'Client Relations'],
    initials: 'JA',
    color: '#059669',
    colorBg: 'rgba(5,150,105,0.1)',
  },
  {
    id: 'team-jeric',
    name: 'Jeric Lique',
    handle: '@jeric444',
    role: 'Full-Stack & Infrastructure Engineer',
    contributions: ['Full-Stack Development', 'Database Architecture', 'DevOps & Deployment'],
    initials: 'JL',
    color: '#7C3AED',
    colorBg: 'rgba(124,58,237,0.1)',
  },
  {
    id: 'team-wyeth',
    name: 'Wyeth Irish Mendez',
    handle: '@wyethirish',
    role: 'System Analyst & QA Engineer',
    contributions: ['System Architecture', 'Quality Assurance', 'Technical Documentation'],
    initials: 'WM',
    color: '#B45309',
    colorBg: 'rgba(180,83,9,0.1)',
  },
]

export default function Team() {
  return (
    <section
      id="team"
      className="section"
      style={{ background: 'transparent' }}
    >
      <div className="container">

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '64px' }}>
          <div className="section-label">The Team</div>
          <h2 style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 'clamp(1.875rem, 3.5vw, 2.5rem)',
            fontWeight: 700,
            color: '#ffffff',
            letterSpacing: '-0.02em',
            marginBottom: '16px',
          }}>
            Built by students,<br/>powered by purpose.
          </h2>
          <p style={{
            fontFamily: 'var(--font-body)',
            fontSize: '1.0625rem',
            color: 'rgba(255,255,255,0.6)',
            maxWidth: '480px',
            margin: '0 auto',
            lineHeight: 1.65,
          }}>
            IT4C Group 9 — De La Salle Lipa, 2026
          </p>
        </div>

        {/* Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '24px',
        }}>
          {team.map(member => (
            <div
              key={member.id}
              id={member.id}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 'var(--radius-card)',
                padding: '28px 24px',
                boxShadow: 'none',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLDivElement
                el.style.transform = 'translateY(-4px)'
                el.style.boxShadow = 'var(--shadow-card-hover)'
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLDivElement
                el.style.transform = 'translateY(0)'
                el.style.boxShadow = 'var(--shadow-card)'
              }}
            >
              {/* Avatar */}
              <div style={{
                width: '64px', height: '64px',
                borderRadius: '50%',
                background: member.colorBg,
                border: `2px solid ${member.color}30`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: '20px',
              }}>
                <span style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  color: member.color,
                }}>
                  {member.initials}
                </span>
              </div>

              {/* Name + handle */}
              <h3 style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '1rem',
                fontWeight: 700,
                color: '#ffffff',
                letterSpacing: '-0.01em',
                marginBottom: '2px',
              }}>
                {member.name}
              </h3>
              <div style={{
                fontFamily: 'var(--font-body)',
                fontSize: '0.8125rem',
                color: member.color,
                fontWeight: 500,
                marginBottom: '8px',
              }}>
                {member.handle}
              </div>

              {/* Role */}
              <div style={{
                fontFamily: 'var(--font-body)',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'rgba(255,255,255,0.9)',
                marginBottom: '14px',
                lineHeight: 1.35,
              }}>
                {member.role}
              </div>

              {/* Divider */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', marginBottom: '14px' }}/>

              {/* Contributions */}
              <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {member.contributions.map(c => (
                  <li key={c} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      width: '5px', height: '5px',
                      borderRadius: '50%',
                      background: member.color,
                      flexShrink: 0,
                    }}/>
                    <span style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: '0.8125rem',
                      color: 'rgba(255,255,255,0.6)',
                    }}>
                      {c}
                    </span>
                  </li>
                ))}
              </ul>

            </div>
          ))}
        </div>

        {/* GitHub links row */}
        <div style={{
          display: 'flex', justifyContent: 'center',
          gap: '16px', flexWrap: 'wrap',
          marginTop: '48px',
        }}>
          {team.map(m => (
            <a
              key={m.id + '-gh'}
              href={`https://github.com/${m.handle.replace('@', '')}`}
              target="_blank"
              rel="noopener noreferrer"
              id={`${m.id}-github`}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                fontFamily: 'var(--font-body)',
                fontSize: '0.8125rem',
                fontWeight: 500,
                color: 'rgba(255,255,255,0.6)',
                textDecoration: 'none',
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.03)',
                transition: 'color 0.15s, border-color 0.15s, background 0.15s',
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLAnchorElement
                el.style.color = '#ffffff'
                el.style.borderColor = 'rgba(255,255,255,0.25)'
                el.style.background = 'rgba(255,255,255,0.08)'
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLAnchorElement
                el.style.color = 'rgba(255,255,255,0.6)'
                el.style.borderColor = 'rgba(255,255,255,0.1)'
                el.style.background = 'rgba(255,255,255,0.03)'
              }}
            >
              <Github size={13} strokeWidth={2}/>
              {m.handle}
            </a>
          ))}
        </div>

      </div>

      <style>{`
        @media (max-width: 600px) {
          #team > div > div:nth-child(3) { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 420px) {
          #team > div > div:nth-child(3) { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  )
}
