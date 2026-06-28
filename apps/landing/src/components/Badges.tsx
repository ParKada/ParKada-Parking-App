// Apple App Store + Google Play Store — authentic SVG badges

export function AppStoreBadge({ id }: { id?: string }) {
  return (
    <a
      id={id ?? 'badge-appstore'}
      href="#download"
      aria-label="Download on the App Store"
      style={{
        display: 'inline-block',
        cursor: 'pointer',
        transition: 'transform 0.15s ease, filter 0.15s ease',
        borderRadius: '10px',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.transform = 'scale(1.04)'; (e.currentTarget as HTMLAnchorElement).style.filter = 'brightness(1.1)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.transform = 'scale(1)'; (e.currentTarget as HTMLAnchorElement).style.filter = 'brightness(1)' }}
    >
      <svg width="160" height="48" viewBox="0 0 160 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" role="img">
        <rect width="160" height="48" rx="10" fill="black"/>
        <rect x="0.5" y="0.5" width="159" height="47" rx="9.5" stroke="white" strokeOpacity="0.25"/>
        {/* Apple logo */}
        <path d="M38.5 15.8c.7-.9 1.2-2.1 1.1-3.3-1.1.1-2.4.7-3.1 1.6-.7.8-1.3 2-1.1 3.2 1.2.1 2.4-.6 3.1-1.5z" fill="white"/>
        <path d="M39.6 17.5c-1.7-.1-3.2.9-4 .9s-2.1-.9-3.5-.8c-1.8 0-3.4 1-4.3 2.6-1.8 3.2-.5 7.9 1.3 10.5.9 1.3 1.9 2.7 3.3 2.6 1.3-.1 1.8-.8 3.3-.8s2 .8 3.4.8c1.4 0 2.3-1.3 3.2-2.6.6-.9 1-1.8 1.3-2.8-3.1-1.2-3.6-5.6-.5-7.2-.9-1.4-2.4-2.2-3.5-2.2z" fill="white"/>
        {/* "Download on the" text */}
        <text x="56" y="18" fontFamily="'SF Pro Text', -apple-system, sans-serif" fontSize="9" fill="white" opacity="0.85" letterSpacing="0.2">Download on the</text>
        {/* "App Store" text */}
        <text x="56" y="33" fontFamily="'SF Pro Display', -apple-system, sans-serif" fontSize="16" fontWeight="600" fill="white" letterSpacing="-0.3">App Store</text>
      </svg>
    </a>
  )
}

export function PlayStoreBadge({ id }: { id?: string }) {
  return (
    <a
      id={id ?? 'badge-playstore'}
      href="#download"
      aria-label="Get it on Google Play"
      style={{
        display: 'inline-block',
        cursor: 'pointer',
        transition: 'transform 0.15s ease, filter 0.15s ease',
        borderRadius: '10px',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.transform = 'scale(1.04)'; (e.currentTarget as HTMLAnchorElement).style.filter = 'brightness(1.1)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.transform = 'scale(1)'; (e.currentTarget as HTMLAnchorElement).style.filter = 'brightness(1)' }}
    >
      <svg width="160" height="48" viewBox="0 0 160 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" role="img">
        <rect width="160" height="48" rx="10" fill="black"/>
        <rect x="0.5" y="0.5" width="159" height="47" rx="9.5" stroke="white" strokeOpacity="0.25"/>
        {/* Play Store triangle icon (simplified colorful) */}
        <polygon points="33,14 33,34 43,24" fill="url(#ps-grad)"/>
        <defs>
          <linearGradient id="ps-grad" x1="33" y1="14" x2="43" y2="34" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#00D4AA"/>
            <stop offset="50%" stopColor="#FFB300"/>
            <stop offset="100%" stopColor="#FF4458"/>
          </linearGradient>
        </defs>
        {/* "GET IT ON" */}
        <text x="56" y="18" fontFamily="'Roboto', sans-serif" fontSize="9" fill="white" opacity="0.85" letterSpacing="0.5">GET IT ON</text>
        {/* "Google Play" */}
        <text x="56" y="33" fontFamily="'Roboto', sans-serif" fontSize="16" fontWeight="500" fill="white" letterSpacing="-0.2">Google Play</text>
      </svg>
    </a>
  )
}
