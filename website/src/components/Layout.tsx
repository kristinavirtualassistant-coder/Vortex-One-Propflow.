import { useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { APP_URL, CONTACT_EMAIL, LEGAL_ENTITY, YEAR } from '../config';
import { LEGAL_DOCS } from '../content/legal';

export function Logo({ size = 36 }: { size?: number }) {
  return (
    <img
      src="/logo-mark-sm.webp"
      srcSet="/logo-mark-sm.webp 1x, /logo-mark.webp 2x"
      width={size}
      height={Math.round(size * 0.95)}
      alt=""
      aria-hidden="true"
    />
  );
}

export function Wordmark() {
  return (
    <span className="text-xl uppercase leading-none tracking-wide text-white">
      <span className="font-extrabold">Vortex</span> <span className="font-light text-sky">One</span>
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
