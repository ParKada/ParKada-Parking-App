import { useState, useEffect } from 'react'
import { Menu, X, ExternalLink } from 'lucide-react'

const navLinks = [
  { label: 'Features', href: '#features' },
  { label: 'Team', href: '#team' },
  { label: 'Download', href: '#download' },
]

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        transition: 'background 0.25s ease, box-shadow 0.25s ease, backdrop-filter 0.25s ease',
        background: scrolled ? 'rgba(10,29,55,0.88)' : 'transparent',
        backdropFilter: scrolled ? 'blur(14px)' : 'none',
        WebkitBackdropFilter: scrolled ? 'blur(14px)' : 'none',
        boxShadow: scrolled ? '0 1px 0 rgba(255,255,255,0.06)' : 'none',
      }}
    >
      <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '68px' }}>
        {/* Logo */}
        <a href="#" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
          <div style={{
            width: '36px', height: '36px',
            background: 'var(--primary)',
            borderRadius: '9px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(37,99,235,0.4)',
          }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <rect x="3" y="3" width="14" height="14" rx="3" stroke="#fff" strokeWidth="1.75" fill="none"/>
              <circle cx="10" cy="10" r="2.5" fill="#fff"/>
              <circle cx="10" cy="10" r="1" fill="var(--primary)"/>
            </svg>
          </div>
          <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1.1875rem', color: '#fff', letterSpacing: '-0.01em' }}>
            ParKada
          </span>
        </a>

        {/* Desktop nav */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '6px' }} aria-label="Main navigation">
          {navLinks.map(link => (
            <a
              key={link.href}
              href={link.href}
              onClick={(e) => {
                if (link.href.startsWith('#')) {
                  e.preventDefault();
                  document.getElementById(link.href.replace('#', ''))?.scrollIntoView({ behavior: 'smooth' });
                }
              }}
              style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 500,
                fontSize: '0.9375rem',
                color: 'rgba(255,255,255,0.72)',
                textDecoration: 'none',
                padding: '7px 14px',
                borderRadius: '8px',
                transition: 'color 0.15s, background 0.15s',
              }}
              onMouseEnter={e => {
                (e.target as HTMLAnchorElement).style.color = '#fff'
                ;(e.target as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.08)'
              }}
              onMouseLeave={e => {
                (e.target as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.72)'
                ;(e.target as HTMLAnchorElement).style.background = 'transparent'
              }}
            >
              {link.label}
            </a>
          ))}

          <a
            href="https://admin.parkada.site"
            target="_blank"
            rel="noopener noreferrer"
            id="nav-admin-portal"
            style={{
              marginLeft: '8px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontFamily: 'var(--font-body)',
              fontWeight: 600,
              fontSize: '0.875rem',
              color: '#fff',
              textDecoration: 'none',
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(255,255,255,0.06)',
              transition: 'background 0.15s, border-color 0.15s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.12)'
              ;(e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(255,255,255,0.35)'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.06)'
              ;(e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(255,255,255,0.2)'
            }}
          >
            Admin Portal
            <ExternalLink size={13} strokeWidth={2.2}/>
          </a>
        </nav>

        {/* Mobile hamburger */}
        <button
          id="nav-mobile-toggle"
          onClick={() => setOpen(o => !o)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          style={{
            display: 'none',
            background: 'none',
            border: 'none',
            color: '#fff',
            cursor: 'pointer',
            padding: '6px',
          }}
        >
          {open ? <X size={22}/> : <Menu size={22}/>}
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div style={{
          background: 'rgba(10,29,55,0.97)',
          backdropFilter: 'blur(16px)',
          padding: '12px 24px 24px',
          borderTop: '1px solid rgba(255,255,255,0.08)',
        }}>
          {navLinks.map(link => (
            <a
              key={link.href}
              href={link.href}
              onClick={(e) => {
                setOpen(false);
                if (link.href.startsWith('#')) {
                  e.preventDefault();
                  document.getElementById(link.href.replace('#', ''))?.scrollIntoView({ behavior: 'smooth' });
                }
              }}
              style={{
                display: 'block',
                padding: '12px 0',
                fontFamily: 'var(--font-body)',
                fontWeight: 500,
                color: 'rgba(255,255,255,0.8)',
                textDecoration: 'none',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              {link.label}
            </a>
          ))}
          <a
            href="https://admin.parkada.site"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'block',
              marginTop: '16px',
              padding: '12px 0',
              fontFamily: 'var(--font-body)',
              fontWeight: 600,
              color: 'var(--primary)',
              textDecoration: 'none',
            }}
          >
            Admin Portal →
          </a>
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          header nav { display: none !important; }
          #nav-mobile-toggle { display: flex !important; }
        }
      `}</style>
    </header>
  )
}
