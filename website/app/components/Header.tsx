'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Header() {
  const pathname = usePathname();

  const isActive = (path: string) => {
    if (path === '/' && pathname === '/') return true;
    if (path !== '/' && pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <nav className="position-fixed w-100 top-0 z-3 pt-4 px-3 px-sm-4">
      <div className="glass-panel max-w-2xl mx-auto rounded-pill px-4 py-2 d-flex justify-content-between align-items-center">
        <Link href="/" className="text-decoration-none">
          <div className="fw-bold fs-6 text-ink terminal-prompt font-monospace">
            <span className="d-none d-md-inline">john@jroverton.com:~$ ./thoughts.sh</span>
            <span className="d-inline d-md-none text-sm">$ ./thoughts.sh</span>
            <span className="blinking-cursor">_</span>
          </div>
        </Link>
        
        <div className="d-flex gap-3 gap-sm-4 small sm-text-base">
          <Link 
            href="/" 
            className={`nav-link-custom ${isActive('/') ? 'active' : ''}`}
          >
            Home
          </Link>
          <Link 
            href="/blog" 
            className={`nav-link-custom ${isActive('/blog') ? 'active' : ''}`}
          >
            Archive
          </Link>
          <Link 
            href="/#about" 
            className="nav-link-custom"
          >
            About
          </Link>
        </div>
      </div>
    </nav>
  );
}
