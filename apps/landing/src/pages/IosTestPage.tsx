import { ArrowLeft, Download, QrCode, AlertCircle } from "lucide-react";

export default function IosTestPage() {
  return (
    <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh', display: 'flex', justifyContent: 'center', fontFamily: 'var(--font-body)' }}>
      {/* Mobile Container */}
      <div style={{ width: '100%', maxWidth: '448px', backgroundColor: '#ffffff', minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
        
        {/* Sticky Header - GCash Style */}
        <div style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#ffffff', borderBottom: '1px solid #e2e8f0', padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button 
            onClick={() => window.history.back()}
            style={{ padding: '8px', marginLeft: '-8px', borderRadius: '9999px', transition: 'background-color 0.2s', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <ArrowLeft size={24} color="#1e293b" />
          </button>
          <h1 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#0f172a', fontFamily: "'Plus Jakarta Sans', sans-serif", margin: 0 }}>
            Test on iOS
          </h1>
        </div>

        {/* Scrollable Content */}
        <div style={{ padding: '24px', overflowY: 'auto', paddingBottom: '80px', color: '#334155', display: 'flex', flexDirection: 'column', gap: '32px' }}>
          
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: '64px', height: '64px', backgroundColor: '#dbeafe', color: '#2563eb', borderRadius: '9999px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Download size={32} />
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginBottom: '8px', marginTop: 0 }}>Step 1: Install Expo Go</h2>
            <p style={{ fontSize: '0.875rem', lineHeight: 1.625, color: '#475569', margin: 0 }}>
              To test the ParKada app on your iPhone, you need the <strong>Expo Go</strong> app. You can download it directly from the App Store.
            </p>
            <a 
              href="https://apps.apple.com/app/expo-go/id982107779"
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'inline-block', marginTop: '16px', backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 500, padding: '10px 24px', borderRadius: '9999px', fontSize: '0.875rem', textDecoration: 'none', transition: 'background-color 0.2s' }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#1e293b'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#0f172a'}
            >
              Download Expo Go
            </a>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid #f1f5f9', margin: 0 }} />

          <div style={{ textAlign: 'center' }}>
            <div style={{ width: '64px', height: '64px', backgroundColor: '#d1fae5', color: '#059669', borderRadius: '9999px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <QrCode size={32} />
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginBottom: '8px', marginTop: 0 }}>Step 2: Scan the QR Code</h2>
            <p style={{ fontSize: '0.875rem', lineHeight: 1.625, color: '#475569', margin: 0 }}>
              Open your iPhone's standard <strong>Camera app</strong> and scan the QR code provided by the ParKada developer team. A prompt will appear at the top of your screen to open the app in Expo Go.
            </p>
            
            <div style={{ marginTop: '24px', backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '12px', padding: '16px', textAlign: 'left', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <AlertCircle color="#d97706" size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ fontSize: '0.875rem', color: '#92400e', lineHeight: 1.625 }}>
                <p style={{ fontWeight: 700, margin: '0 0 4px 0' }}>Important Note About QR Codes</p>
                <p style={{ margin: 0 }}>
                  Because we are currently running the app through a local tunnel, <strong>the QR code changes every time the development server is restarted</strong>. You cannot use an old QR code if the tunnel was closed. Please ask the developer for the latest active QR code.
                </p>
              </div>
            </div>
          </div>

          <div style={{ paddingTop: '32px', paddingBottom: '16px', textAlign: 'center' }}>
            <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: 0 }}>© 2026 ParKada. All rights reserved.</p>
          </div>

        </div>
      </div>
    </div>
  );
}
