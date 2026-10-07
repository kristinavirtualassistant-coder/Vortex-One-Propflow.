import { APP_URL } from '../config';
import { Nav } from './Layout';
import { Eyebrow, btnPrimary } from './ui';

function VortexMark() {
  return (
    <svg width="100%" viewBox="0 0 400 400" className="max-w-[360px]" aria-hidden="true">
      <defs>
        <linearGradient id="hvo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#38bdf8" />
          <stop offset="0.5" stopColor="#6366f1" />
          <stop offset="1" stopColor="#a855f7" />
        </linearGradient>
        <linearGradient id="hvi" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#00f2fe" />
          <stop offset="1" stopColor="#4facfe" />
        </linearGradient>
        <radialGradient id="hvg" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#6366f1" stopOpacity="0.35" />
          <stop offset="1" stopColor="#6366f1" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="200" cy="200" r="196" fill="url(#hvg)" />
      <circle cx="200" cy="200" r="160" fill="none" stroke="url(#hvo)" strokeWidth="26" strokeLinecap="round" strokeDasharray="780 226" transform="rotate(-40 200 200)" />
      <circle cx="200" cy="200" r="104" fill="none" stroke="url(#hvi)" strokeWidth="22" strokeLinecap="round" strokeDasharray="480 174" transform="rotate(120 200 200)" />
      <text x="200" y="244" textAnchor="middle" fontSize="150" fontWeight="800" fill="#ffffff" fontFamily="-apple-system,Segoe UI,Roboto,Arial,sans-serif">1</text>
    </svg>
  );
}

export default function Hero() {
  return (
    <header className="bg-navy px-6 pb-24 text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-16">
        <Nav />
        <div id="main" className="flex flex-wrap items-center gap-12">
          <div className="flex min-w-0 flex-[1_1_480px] flex-col gap-6">
            <Eyebrow tone="sky">Property intelligence · CRM · dialer</Eyebrow>
            <h1 className="m-0 text-5xl font-black leading-[1.05] tracking-tight">
              Find the right property. Know the owner. Reach them. Close the loop.
            </h1>
            <p className="m-0 max-w-xl text-lg leading-7 text-slate-300">
              Vortex One brings property and owner intelligence, lead scoring, CRM, a power dialer and workflow
              automation into one workspace, so every lead moves from search to follow-up in one place.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <a className={btnPrimary} href={APP_URL}>Start free</a>
              <a
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/35 px-5 text-sm font-bold text-white hover:bg-white/10"
                href="#demo"
              >
                Try the interactive demo
              </a>
            </div>
            <p className="m-0 text-xs leading-4 text-slate-400">
              The demos on this page need no account. Creating an account or starting the live demo takes you to the app.
            </p>
          </div>
          <div className="flex min-w-60 flex-[0_1_360px] justify-center">
            <VortexMark />
          </div>
        </div>
      </div>
    </header>
  );
}
