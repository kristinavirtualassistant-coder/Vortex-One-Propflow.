import { APP_URL } from '../config';
import { Eyebrow, btnPrimary } from './ui';

function SignalCard({ label, value, tone = 'orange' }: { label: string; value: string; tone?: 'orange' | 'green' }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur">
      <div className="mb-3 flex items-center justify-between gap-3 text-[10px] font-bold uppercase tracking-[0.16em] text-white/45">
        <span>{label}</span><span className={tone === 'green' ? 'text-emerald-300' : 'text-orange-300'}>Live</span>
      </div>
      <p className="m-0 text-2xl font-bold tracking-tight text-white">{value}</p>
    </div>
  );
}

function IntelligencePreview() {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/15 bg-[#161d19] p-4 shadow-2xl shadow-black/30 sm:p-6">
      <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-orange-500/20 blur-3xl" />
      <div className="relative flex items-center justify-between border-b border-white/10 pb-4">
        <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-orange-400" /><span className="text-xs font-semibold text-white/80">Vortex One / Command center</span></div>
        <span className="text-[10px] uppercase tracking-widest text-white/40">Today · 09:42</span>
      </div>
      <div className="relative grid gap-3 py-6 sm:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-black/20 p-4 sm:col-span-2">
          <div className="mb-5 flex items-center justify-between"><span className="text-xs font-semibold text-white/70">Priority opportunities</span><span className="rounded-full bg-orange-400/15 px-2 py-1 text-[10px] font-bold text-orange-300">12 new signals</span></div>
          <div className="space-y-3">
            {[['1428 Elm Ave', '82', 'High equity · Absentee owner'], ['77 Cactus Lane', '68', '11 years owned · New signal'], ['310 Palm Court', '54', 'Long ownership · Verified']].map(([address, score, reason]) => <div key={address} className="flex items-center justify-between gap-3 border-t border-white/10 pt-3"><div><p className="m-0 text-sm font-semibold text-white">{address}</p><p className="m-0 pt-1 text-[11px] text-white/45">{reason}</p></div><span className="text-lg font-bold text-orange-300">{score}</span></div>)}
          </div>
        </div>
        <SignalCard label="Pipeline velocity" value="+24%" tone="green" />
        <SignalCard label="Follow-ups due" value="18" />
      </div>
      <div className="relative flex items-center gap-2 border-t border-white/10 pt-4 text-[11px] text-white/45"><span className="h-2 w-2 rounded-full bg-emerald-400" /> All systems operational · Scoring is transparent by design</div>
    </div>
  );
}

export default function Hero() {
  return (
    <header className="relative overflow-hidden bg-navy px-6 pb-24 pt-16 text-white sm:pt-24">
      <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(255,255,255,.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.04)_1px,transparent_1px)] [background-size:48px_48px]" />
      <div className="relative mx-auto flex max-w-7xl flex-col gap-16">
        <div id="main" className="flex flex-wrap items-center gap-12 lg:gap-20">
          <div className="flex min-w-0 flex-[1_1_440px] flex-col gap-6">
            <Eyebrow tone="sky">Property intelligence · CRM · workflows</Eyebrow>
            <h1 className="m-0 max-w-2xl text-5xl font-black leading-[.98] tracking-[-0.045em] sm:text-7xl">Turn scattered property data into your next best move.</h1>
            <p className="m-0 max-w-xl text-lg leading-8 text-white/65">Vortex One connects property intelligence, transparent lead scoring, CRM and follow-up automation in one focused workspace.</p>
            <div className="flex flex-wrap gap-3 pt-2"><a className={btnPrimary} href={APP_URL}>Start free <span className="pl-2">→</span></a><a className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/20 px-5 text-sm font-bold text-white transition hover:bg-white/10" href="#demo">Explore the platform</a></div>
            <p className="m-0 text-xs text-white/40">Free early access · No credit card · Built for teams that move first</p>
          </div>
          <div className="min-w-0 flex-[1_1_460px]"><IntelligencePreview /></div>
        </div>
        <div className="flex flex-wrap items-center gap-x-10 gap-y-4 border-t border-white/10 pt-8 text-sm text-white/45"><span className="font-semibold text-white/70">One workspace. Less context switching.</span><span>Property signals</span><span>Owner records</span><span>Pipeline clarity</span><span>Follow-up momentum</span></div>
      </div>
    </header>
  );
}
