'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { WalletConnect } from './WalletConnect';

const NAV_LINKS = [
  { href: '/',         label: 'Protocol' },
  { href: '/register', label: 'Register' },
  { href: '/circles',  label: 'Circles'  },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/90 backdrop-blur-sm">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-12 flex items-center justify-between gap-4">
        {/* Wordmark */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-5 h-5 border border-accent/60 rounded-sm flex items-center justify-center group-hover:border-accent transition-colors">
            <div className="w-2 h-2 bg-accent rounded-[1px]" />
          </div>
          <span className="font-display font-bold text-sm tracking-tight text-text">
            Shroud
          </span>
        </Link>

        {/* Links */}
        <nav className="hidden sm:flex items-center gap-1">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={[
                'px-3 py-1.5 rounded text-xs font-medium transition-all',
                pathname === href
                  ? 'text-text bg-highlight'
                  : 'text-muted hover:text-text hover:bg-highlight',
              ].join(' ')}
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Wallet */}
        <WalletConnect />
      </div>
    </header>
  );
}
