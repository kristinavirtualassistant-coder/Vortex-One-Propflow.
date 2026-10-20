import { APP_URL } from '../config';
import { Eyebrow, btnPrimary } from './ui';

function SignalRow({ address, score, reason }: { address: string; score: string; reason: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
      <div><p className="m-0 text-sm font-bold text-ink">{address}</p><p className="m-0 pt-1 text-[11px] text-ink-3">{reason}</p></div>
      <span className="rounded-full bg-accent-subtle px-2.5 py-1 text-sm font-black text-accent">{score}</span>
    </div>
  );
}

function IntelligencePreview() {
  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-line bg-white p-4 shadow-[0_24px_70px_rgba(54,38,77,0.14)] sm:p-6">
      <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[#f5c9d4]/70 blur-3xl" />
      <div className="relative flex items-center justify-between border-b border-line pb-4"><div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-accent" /><span className="text-xs font-bold text-ink">Vortex One / Command center</span></div><span className="text-[10px] font-bold uppercase tracking-widest text-ink-3">Today · 09:42</span></div>
      <div className="relative grid gap-3 py-6 sm:grid-cols-2">
        <div className="rounded-2xl border border-line bg-inset p-4 sm:col-span-2"><div className="mb-5 flex items-center justify-between"><span className="text-xs font-bold text-ink">Priority opportunities</span><span className="rounded-full bg-[#f5c9d4] px-2 py-1 text-[10px] font-black text-[#713149]">12 new signals</span></div><div className="space-y-3"><SignalRow address="1428 Elm Ave" score="82" reason="High equity · Absentee owner" /><SignalRow address="77 Cactus Lane" score="68" reason="11 years owned · New signal" /><SignalRow address="310 Palm Court" score="54" reason="Long ownership · Verified" /></div></div>
        <div className="rounded-2xl bg-[#35254b] p-4 text-white"><p className="m-0 text-[10px] font-bold uppercase tracking-[0.16em] text-white/60">Pipeline velocity</p><p className="m-0 pt-3 text-2xl font-black">+24%</p></div>
        <div className="rounded-2xl bg-accent p-4 text-white"><p className="m-0 text-[10px] font-bold uppercase tracking-[0.16em] text-white/70">Follow-ups due</p><p className="m-0 pt-3 text-2xl font-black">18</p></div>
      </div>
      <div className="relative flex items-center gap-2 border-t border-line pt-4 text-[11px] font-medium text-ink-3"><span className="h-2 w-2 rounded-full bg-success" /> All systems operational · Scoring is transparent by design</div>
    </div>
  );
}

export default function Hero() {
  return (
    <header className="relative overflow-hidden bg-canvas px-6 pb-20 pt-16 sm:pb-28 sm:pt-24">
      <div className="pointer-events-none absolute -left-32 top-12 h-96 w-96 rounded-full bg-[#f5c9d4]/50 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-0 h-96 w-96 rounded-full bg-[#e9d9f5]/60 blur-3xl" />
      <div className="relative mx-auto flex max-w-7xl flex-col gap-16">
        <div id="main" className="flex flex-wrap items-center gap-12 lg:gap-20">
          <div className="flex min-w-0 flex-[1_1_440px] flex-col gap-6"><Eyebrow tone="orange">Property intelligence · CRM · workflows</Eyebrow><h1 className="m-0 max-w-2xl text-5xl font-black leading-[.96] tracking-[-0.055em] text-ink sm:text-7xl">Make your next move <span className="font-serif italic font-medium text-accent">count.</span></h1><p className="m-0 max-w-xl text-lg leading-8 text-ink-2">Vortex One brings the signal, the strategy and the follow-through into one focused workspace—so ambitious teams can move with clarity.</p><div className="flex flex-wrap gap-3 pt-2"><a className={btnPrimary} href={APP_URL}>Start free <span className="pl-2">→</span></a><a className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line-strong px-5 text-sm font-bold text-ink transition hover:border-ink hover:bg-white" href="#demo">Explore the platform</a></div><p className="m-0 text-xs font-medium text-ink-3">Free early access · No credit card · Built for teams that move first</p></div>
          <div className="min-w-0 flex-[1_1_460px]"><IntelligencePreview /></div>
        </div>
        <div className="flex flex-wrap items-center gap-x-10 gap-y-4 border-t border-line pt-8 text-sm text-ink-3"><span className="font-bold text-ink">One workspace. Less context switching.</span><span>Property signals</span><span>Owner records</span><span>Pipeline clarity</span><span>Follow-up momentum</span></div>
      </div>
    </header>
  );
}
