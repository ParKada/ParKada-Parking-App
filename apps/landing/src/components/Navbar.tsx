import { useState, useEffect, useRef } from 'react'
import { Menu, X, ExternalLink } from 'lucide-react'
import { motion } from 'motion/react'
import DarkVeil from './DarkVeil'

const navLinks = [
  { label: 'Features', href: '#features' },
  { label: 'Meet the Team', href: '#team' },
  { label: 'Download', href: '#home' },
]

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const navRefs = useRef<(HTMLAnchorElement | null)[]>([])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (href.startsWith('#')) {
      e.preventDefault();
      setOpen(false);
      
      if (href === '#home') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      
      const target = document.getElementById(href.replace('#', ''));
      if (target) {
        // Adjust for navbar height (84px) + a little extra padding if desired
        const navbarHeight = 84;
        const targetPosition = target.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({
          top: targetPosition - navbarHeight,
          behavior: 'smooth'
        });
      }
    }
  }

  return (
    <header
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        transition: 'box-shadow 0.25s ease',
        background: 'transparent',
        boxShadow: scrolled ? '0 1px 0 rgba(255,255,255,0.06)' : 'none',
        overflow: 'hidden',
      }}
    >
      {/* DarkVeil Background - ALWAYS VISIBLE */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '100vh',
        zIndex: -1,
        pointerEvents: 'none',
        background: '#0a1d37',
      }}>
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

      <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '84px', position: 'relative' }}>
        {/* Logo */}
        <a href="#" onClick={(e) => handleNavClick(e, '#home')} style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
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
        <nav style={{ display: 'flex', alignItems: 'center', gap: '6px', position: 'relative' }} aria-label="Main navigation" onMouseLeave={() => setHoveredIndex(null)}>
          
          {hoveredIndex !== null && navRefs.current[hoveredIndex] && (
            <motion.div
              layoutId="nav-focus"
              className="absolute pointer-events-none"
              initial={false}
              animate={{
                left: navRefs.current[hoveredIndex]?.offsetLeft || 0,
                top: navRefs.current[hoveredIndex]?.offsetTop || 0,
                width: navRefs.current[hoveredIndex]?.offsetWidth || 0,
                height: navRefs.current[hoveredIndex]?.offsetHeight || 0,
                opacity: 1
              }}
              transition={{ duration: 0.1 }}
              style={{
                '--border-color': '#0df103',
                '--glow-color': 'rgba(13, 241, 3, 0.4)'
              } as React.CSSProperties}
            >
              <span className="absolute w-2 h-2 border-[2px] rounded-[2px] -top-1 -left-1 border-r-0 border-b-0" style={{ borderColor: 'var(--border-color)', filter: 'drop-shadow(0 0 4px var(--border-color))' }}></span>
              <span className="absolute w-2 h-2 border-[2px] rounded-[2px] -top-1 -right-1 border-l-0 border-b-0" style={{ borderColor: 'var(--border-color)', filter: 'drop-shadow(0 0 4px var(--border-color))' }}></span>
              <span className="absolute w-2 h-2 border-[2px] rounded-[2px] -bottom-1 -left-1 border-r-0 border-t-0" style={{ borderColor: 'var(--border-color)', filter: 'drop-shadow(0 0 4px var(--border-color))' }}></span>
              <span className="absolute w-2 h-2 border-[2px] rounded-[2px] -bottom-1 -right-1 border-l-0 border-t-0" style={{ borderColor: 'var(--border-color)', filter: 'drop-shadow(0 0 4px var(--border-color))' }}></span>
            </motion.div>
          )}

          {navLinks.map((link, i) => (
            <a
              key={link.href}
              href={link.href}
              ref={el => { navRefs.current[i] = el; }}
              onClick={(e) => handleNavClick(e, link.href)}
              style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 500,
                fontSize: '0.9375rem',
                color: hoveredIndex === i ? '#ffffff' : 'rgba(255,255,255,0.72)',
                textDecoration: 'none',
                padding: '7px 14px',
                borderRadius: '8px',
                transition: 'color 0.15s',
              }}
              onMouseEnter={() => setHoveredIndex(i)}
            >
              {link.label}
            </a>
          ))}
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
              onClick={(e) => handleNavClick(e, link.href)}
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
