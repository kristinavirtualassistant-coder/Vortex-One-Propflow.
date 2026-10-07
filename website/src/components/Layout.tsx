import { useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { APP_URL, CONTACT_EMAIL, LEGAL_ENTITY, YEAR } from '../config';
import { LEGAL_DOCS } from '../content/legal';

export function Logo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" aria-hidden="true">
      <defs>
        <linearGradient id="vxo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#38bdf8" />
          <stop offset="0.5" stopColor="#6366f1" />
          <stop offset="1" stopColor="#a855f7" />
        </linearGradient>
        <linearGradient id="vxi" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#00f2fe" />
          <stop offset="1" stopColor="#4facfe" />
        </linearGradient>
      </defs>
      <circle cx="100" cy="100" r="84" fill="none" stroke="url(#vxo)" strokeWidth="14" strokeLinecap="round" strokeDasharray="400 128" transform="rotate(-40 100 100)" />
      <circle cx="100" cy="100" r="54" fill="none" stroke="url(#vxi)" strokeWidth="12" strokeLinecap="round" strokeDasharray="250 90" transform="rotate(120 100 100)" />
      <text x="100" y="124" textAnchor="middle" fontSize="76" fontWeight="800" fill="#ffffff" fontFamily="-apple-system,Segoe UI,Roboto,Arial,sans-serif">1</text>
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="text-lg font-extrabold uppercase tracking-[0.3em] text-white">
      Vortex <span className="text-sky">One</span>
    </span>
  );
}

const navLink = 'rounded px-2 py-3 text-sm font-medium text-slate-300 hover:text-white';

export function Nav() {
  const { pathname } = useLocation();
  const home = pathname === '/';
  const anchor = (id: string) => (home ? `#${id}` : `/#${id}`);
  return (
    <nav aria-label="Main" className="flex flex-wrap items-center justify-between gap-4 py-6">
      <Link to="/" aria-label="Vortex One home" className="flex min-h-11 items-center gap-3">
        <Logo />
        <Wordmark />
      </Link>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <a className={navLink} href={anchor('platform')}>Platform</a>
        <a className={navLink} href={anchor('demo')}>Demo</a>
        <a className={navLink} href={anchor('pricing')}>Pricing</a>
        <a className={navLink} href={anchor('trust')}>Trust</a>
        <a className={navLink} href={APP_URL}>Sign in</a>
        <a
          href={APP_URL}
          className="inline-flex min-h-11 items-center rounded-lg bg-accent px-4 text-sm font-medium text-white shadow-sm hover:bg-accent-hover"
        >
          Start free
        </a>
      </div>
    </nav>
  );
}

export function Footer() {
  return (
    <footer className="bg-navy px-6 py-10 text-slate-300">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Wordmark />
          <span className="text-xs">AI-assisted property intelligence, CRM and dialer</span>
        </div>
        <nav aria-label="Legal" className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
          {LEGAL_DOCS.map((d) => (
            <Link key={d.slug} to={`/legal/${d.slug}`} className="py-2 hover:text-white">
              {d.navLabel}
            </Link>
          ))}
        </nav>
        <p className="text-xs">
          © {YEAR} {LEGAL_ENTITY} ·{' '}
          <a className="underline hover:text-white" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </p>
      </div>
    </footer>
  );
}

export default function Layout() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (!hash) window.scrollTo(0, 0);
    else document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [pathname, hash]);

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:p-3">
        Skip to content
      </a>
      <Outlet />
      <Footer />
    </div>
  );
}
