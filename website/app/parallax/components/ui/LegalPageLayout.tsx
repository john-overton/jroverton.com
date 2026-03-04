'use client';

import { ReactNode } from 'react';
import ParallaxMark from './ParallaxMark';

interface LegalPageLayoutProps {
  children: ReactNode;
}

export default function LegalPageLayout({ children }: LegalPageLayoutProps) {
  return (
    <div
      style={{
        minHeight: '100vh',
        fontFamily: "'DM Sans', var(--font-dm-sans), sans-serif",
        color: '#1a1d23',
        background: '#f4f3f0',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      {/* Header */}
      <header
        style={{
          width: '100%',
          maxWidth: 820,
          padding: '32px 24px 0',
        }}
      >
        <a
          href="/parallax"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 12,
            textDecoration: 'none',
            color: '#1a1d23',
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#4e4f52" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={16} height={16}>
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          <ParallaxMark size="xs" variant="color" />
          <span
            style={{
              fontFamily: "'Outfit', var(--font-outfit), sans-serif",
              fontWeight: 600,
              fontSize: 20,
              letterSpacing: 4,
              textTransform: 'uppercase' as const,
            }}
          >
            Parallax
          </span>
        </a>
      </header>

      {/* Content card */}
      <main
        style={{
          width: '100%',
          maxWidth: 820,
          padding: '24px 24px 48px',
          flex: 1,
        }}
      >
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.55)',
            backdropFilter: 'blur(3px) saturate(1.3)',
            WebkitBackdropFilter: 'blur(3px) saturate(1.3)',
            borderRadius: 20,
            border: '1px solid rgba(255, 255, 255, 0.35)',
            boxShadow:
              '0 0 2px 1px rgba(26,29,35,0.06) inset, ' +
              '0 0 10px 4px rgba(26,29,35,0.04) inset, ' +
              '0 4px 24px rgba(26,29,35,0.06), ' +
              '0 8px 48px rgba(26,29,35,0.04)',
            padding: '48px 56px',
          }}
        >
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer
        style={{
          width: '100%',
          maxWidth: 820,
          padding: '0 24px 32px',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 20,
            background: 'rgba(244, 243, 240, 0.3)',
            backdropFilter: 'blur(3px) saturate(1.3)',
            WebkitBackdropFilter: 'blur(3px) saturate(1.3)',
            borderRadius: 12,
            border: '1px solid rgba(255, 255, 255, 0.25)',
            boxShadow: '0 0 2px 1px rgba(26,29,35,0.04) inset, 0 0 8px 3px rgba(26,29,35,0.03) inset',
            padding: '10px 20px',
          }}
        >
          <span style={{ fontSize: 13, color: '#4e4f52' }}>&copy; 2026 Parallax</span>
          <a href="/parallax/privacy" style={{ fontSize: 13, color: '#4e4f52', textDecoration: 'none' }}>Privacy</a>
          <a href="/parallax/terms" style={{ fontSize: 13, color: '#4e4f52', textDecoration: 'none' }}>Terms</a>
          <a href="mailto:john@jroverton.com" style={{ fontSize: 13, color: '#4e4f52', textDecoration: 'none' }}>Contact</a>
        </div>
      </footer>
    </div>
  );
}
