import { APP_URL } from '../config';
import { Nav } from './Layout';
import { Eyebrow, btnPrimary } from './ui';

function VortexMark() {
  return (
    <div className="relative flex w-full max-w-[380px] items-center justify-center" aria-hidden="true">
      <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(56,189,248,0.28),transparent_68%)]" />
      <img src="/logo-mark.webp" alt="" width={640} height={609} className="relative h-auto w-full" />
    </div>
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
