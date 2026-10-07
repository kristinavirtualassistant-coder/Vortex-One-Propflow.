import { useEffect, useRef, useState } from 'react';
import { Badge, Card, Eyebrow, ScoreMeter, SectionHeading, btnPrimary, inputCls, labelCls } from './ui';
import { SIGNAL_LABEL, scoreLead, type Signal } from '../lib/scoring';

/* ---------------------------------------------------------------- scoring */
function ScoringDemo() {
  const [equity, setEquity] = useState(62);
  const [years, setYears] = useState(11);
  const [signal, setSignal] = useState<Signal>('none');
  const [absentee, setAbsentee] = useState(true);
  const s = scoreLead({ equity, years, absentee, signal });

  return (
    <div className="flex flex-wrap items-stretch gap-5">
      <Card className="min-w-0 flex-[1_1_420px] p-6">
        <div className="flex flex-col gap-5">
          <div>
            <Eyebrow>Lead scoring · tune a sample lead</Eyebrow>
            <h3 className="m-0 pt-1 text-lg font-semibold">What do we know about the owner?</h3>
          </div>
          <div>
            <label className={labelCls} htmlFor="eq">Estimated equity: {equity}%</label>
            <input id="eq" type="range" min={0} max={100} value={equity} onChange={(e) => setEquity(Number(e.target.value))} />
          </div>
          <div>
            <label className={labelCls} htmlFor="yrs">Years owned: {years}</label>
            <input id="yrs" type="range" min={0} max={40} value={years} onChange={(e) => setYears(Number(e.target.value))} />
          </div>
          <div>
            <label className={labelCls} htmlFor="sig">Situation signal</label>
            <select id="sig" className={inputCls} value={signal} onChange={(e) => setSignal(e.target.value as Signal)}>
              {(Object.keys(SIGNAL_LABEL) as Signal[]).map((k) => (
                <option key={k} value={k}>{SIGNAL_LABEL[k]}</option>
              ))}
            </select>
          </div>
          <label htmlFor="abs" className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium">
            <input id="abs" type="checkbox" className="h-5 w-5 accent-accent" checked={absentee} onChange={(e) => setAbsentee(e.target.checked)} />
            Absentee owner (mailing address differs)
          </label>
        </div>
      </Card>
      <div className="flex min-w-0 flex-[1_1_340px] flex-col gap-5">
        <Card elevated className="flex flex-col gap-4 p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Eyebrow>Lead score</Eyebrow>
            <Badge tone={s.band === 'Hot' ? 'success' : s.band === 'Warm' ? 'accent' : 'neutral'}>{s.band}</Badge>
          </div>
          <ScoreMeter score={s.total} />
          <p className="m-0 text-xs leading-4 text-ink-2">{s.reasons.length ? s.reasons.join(' · ') : 'No strong signals yet'}</p>
        </Card>
        <Card>
          <Eyebrow>Transparent by design</Eyebrow>
          <p className="m-0 pt-2 text-sm leading-5 text-ink-2">
            Scoring is rule-based, so callers can see the score and the reasons behind it and rank the queue with confidence.
            This sample uses simple illustrative weights, not the production rules.
          </p>
        </Card>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- pipeline */
const STAGES = ['New', 'Contacted', 'Callback', 'Qualified'] as const;
interface Lead { id: string; name: string; address: string; score: number; dnc?: boolean }
const LEADS: Lead[] = [
  { id: 'dana', name: 'Dana R.', address: '1428 Elm Ave, Phoenix AZ', score: 82 },
  { id: 'marcus', name: 'Marcus T.', address: '77 Cactus Ln, Mesa AZ', score: 68 },
  { id: 'priya', name: 'Priya N.', address: '310 Palm Ct, Tempe AZ', score: 54 },
  { id: 'walt', name: 'Walt K.', address: '9 Saguaro Rd, Gilbert AZ', score: 41 },
  { id: 'elena', name: 'Elena V.', address: '22 Mesa Dr, Chandler AZ', score: 91 },
  { id: 'roy', name: 'Roy P.', address: '5 Desert Way, Peoria AZ', score: 33, dnc: true },
];
const START: Record<string, number> = { dana: 0, marcus: 0, priya: 1, walt: 2, elena: 3, roy: 1 };

function PipelineDemo() {
  const [stage, setStage] = useState<Record<string, number>>(START);
  return (
    <div className="flex flex-col gap-4">
      <p className="m-0 text-sm leading-5 text-ink-2">Move leads through the stages. The do-not-call lead stays locked everywhere it appears.</p>
      <div className="flex flex-wrap items-start gap-4">
        {STAGES.map((label, si) => {
          const cards = LEADS.filter((l) => stage[l.id] === si);
          return (
            <div key={label} className="flex min-w-0 flex-[1_1_240px] flex-col gap-3 rounded-2xl bg-track p-3">
              <div className="flex items-center justify-between px-1 pt-1">
                <h3 className="m-0 text-xs font-bold uppercase tracking-wider text-ink-2">{label}</h3>
                <span className="text-xs font-semibold text-ink-2">{cards.length}</span>
              </div>
              {cards.map((l) => {
                const last = si === STAGES.length - 1;
                const tone = l.dnc ? 'danger' : last ? 'success' : l.score >= 75 ? 'success' : l.score >= 40 ? 'accent' : 'neutral';
                const text = l.dnc ? 'Do not call' : last ? 'Qualified' : l.score >= 75 ? 'Hot' : l.score >= 40 ? 'Warm' : 'Cold';
                return (
                  <Card key={l.id} className="flex flex-col gap-3 p-4">
                    <div>
                      <div className="text-sm font-semibold">{l.name}</div>
                      <div className="text-xs text-ink-3">{l.address}</div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={tone}>{text}</Badge>
                      <span className="text-xs font-semibold text-ink-2">Score {l.score}</span>
                    </div>
                    {!l.dnc && !last && (
                      <button
                        type="button"
                        className="inline-flex min-h-11 items-center justify-center rounded-lg border border-line-strong bg-panel px-4 text-sm font-medium hover:bg-inset"
                        onClick={() => setStage((s) => ({ ...s, [l.id]: si + 1 }))}
                      >
                        Move to {STAGES[si + 1]}
                      </button>
                    )}
                  </Card>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ dialer sim */
const SCRIPT: { who: string; ai: boolean; text: string }[] = [
  { who: 'Caller', ai: true, text: 'Hi, this is an automated assistant calling for [Your brokerage]. Am I speaking with Dana R.?' },
  { who: 'Owner', ai: false, text: "Yes. What's this about?" },
  { who: 'Caller', ai: true, text: "I'm an AI assistant, and I'm checking whether you'd be open to hearing about selling 1428 Elm Ave. There's no obligation." },
  { who: 'Owner', ai: false, text: 'Maybe. Call me back Thursday after 4.' },
  { who: 'Caller', ai: true, text: 'Thursday after 4 pm, noted. A person from our team will follow up. You can ask to be removed from our list at any time.' },
];

function DialerSimDemo() {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => () => { if (timer.current) window.clearInterval(timer.current); }, []);

  const play = () => {
    if (timer.current) window.clearInterval(timer.current);
    setStep(1);
    setPlaying(true);
    timer.current = window.setInterval(() => {
      setStep((n) => {
        if (n + 1 >= SCRIPT.length) {
          if (timer.current) window.clearInterval(timer.current);
          timer.current = null;
          setPlaying(false);
          return SCRIPT.length;
        }
        return n + 1;
      });
    }, 1600);
  };

  const done = step >= SCRIPT.length && !playing;
  return (
    <div className="flex flex-wrap items-stretch gap-5">
      <Card elevated className="flex min-w-0 flex-[1_1_520px] flex-col gap-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Eyebrow>Dialer · scripted simulation · sample data</Eyebrow>
            <h3 className="m-0 pt-1 text-lg font-semibold">Dana R. · 1428 Elm Ave, Phoenix AZ</h3>
          </div>
          <Badge tone={playing ? 'accent' : done ? 'success' : 'neutral'}>{playing ? 'Simulating' : done ? 'Call ended' : 'Ready'}</Badge>
        </div>
        <div aria-live="polite" className="flex min-h-72 flex-col gap-3 rounded-xl border border-line bg-inset p-4">
          {step === 0 && (
            <p className="m-auto max-w-xs text-center text-sm leading-5 text-ink-3">
              Press play to step through a scripted call and see how an outcome and follow-up are recorded.
            </p>
          )}
          {SCRIPT.slice(0, step).map((l, i) => (
            <div key={i} className={`flex flex-col gap-1 ${l.ai ? 'items-start' : 'items-end'}`}>
              <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-ink-3">{l.who}</span>
              <div className={`max-w-[82%] rounded-xl border border-line px-3.5 py-2.5 text-sm leading-5 ${l.ai ? 'bg-accent-subtle' : 'bg-panel'}`}>{l.text}</div>
            </div>
          ))}
        </div>
        <div>
          <button type="button" className={`${btnPrimary} disabled:opacity-50`} onClick={play} disabled={playing}>
            {playing ? 'Simulation running' : done ? 'Replay simulation' : 'Play simulation'}
          </button>
        </div>
      </Card>
      <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-5">
        <Card className="flex flex-col gap-3">
          <Eyebrow>Call outcome</Eyebrow>
          {done ? (
            <>
              <div className="flex flex-wrap gap-2"><Badge tone="warning">Callback due</Badge><Badge tone="accent">Follow-up task</Badge></div>
              <p className="m-0 text-sm leading-5"><strong>Thursday after 4 pm.</strong> Owner is open to hearing an offer.</p>
            </>
          ) : (
            <p className="m-0 text-sm leading-5 text-ink-3">Outcome, tags and the follow-up task appear here when the call ends.</p>
          )}
        </Card>
        <Card className="flex flex-col gap-2">
          <Eyebrow>Where this stands today</Eyebrow>
          <p className="m-0 text-sm leading-5 text-ink-2">
            The Vortex One dialer is simulated. No real phone calls are placed yet, and no AI voice is connected. Do-not-call
            rules, call states, outcomes and follow-up tasks already work. Live calling is planned, and when it ships the
            caller will say it is an AI.
          </p>
        </Card>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ time calc */
function TimeDemo() {
  const [people, setPeople] = useState(4);
  const [calling, setCalling] = useState(10);
  const [research, setResearch] = useState(8);
  const [followup, setFollowup] = useState(6);
  const [share, setShare] = useState(50);
  const total = calling + research + followup;
  const back = Math.round((people * total * share) / 100);

  const slider = (id: string, label: string, v: number, set: (n: number) => void, max: number, step = 1) => (
    <div>
      <label className={labelCls} htmlFor={id}>{label}</label>
      <input id={id} type="range" min={0} max={max} step={step} value={v} onChange={(e) => set(Number(e.target.value))} />
    </div>
  );

  return (
    <div className="flex flex-wrap items-stretch gap-5">
      <Card className="flex min-w-0 flex-[1_1_420px] flex-col gap-5 p-6">
        <div>
          <Eyebrow>Time calculator · your assumptions</Eyebrow>
          <h3 className="m-0 pt-1 text-lg font-semibold">Where does your team's week go today?</h3>
        </div>
        {slider('tp', `Team members: ${people}`, people, setPeople, 20)}
        {slider('tc', `Manual calling, hours each per week: ${calling}`, calling, setCalling, 30)}
        {slider('tr', `Property and owner research, hours each per week: ${research}`, research, setResearch, 30)}
        {slider('tf', `Manual follow-up, hours each per week: ${followup}`, followup, setFollowup, 30)}
        {slider('ts', `Share of that work done inside Vortex One instead: ${share}%`, share, setShare, 100, 5)}
      </Card>
      <Card elevated className="flex min-w-0 flex-[1_1_340px] flex-col justify-center gap-3 p-6">
        <Eyebrow>Estimated time saved per week</Eyebrow>
        <p className="m-0 text-5xl font-black leading-none tracking-tight tabular-nums text-accent">{back} hrs</p>
        <p className="m-0 text-sm leading-5 text-ink-2">{people} people × {total} manual hours × {share}% done in Vortex One. That is time, not revenue.</p>
        <p className="m-0 text-xs leading-4 text-ink-3">Arithmetic on the numbers you set. Not a benchmark, a forecast or a promise of results.</p>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ shell */
const TABS = [
  { id: 'score', label: 'Lead scoring', el: <ScoringDemo /> },
  { id: 'pipeline', label: 'Pipeline', el: <PipelineDemo /> },
  { id: 'dialer', label: 'Dialer (simulated)', el: <DialerSimDemo /> },
  { id: 'time', label: 'Time calculator', el: <TimeDemo /> },
] as const;

export default function Demos() {
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('score');
  return (
    <section id="demo" className="px-6 pb-20 pt-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <SectionHeading eyebrow="Interactive demo" title="Try the command center before you create an account">
          Four working samples on fictional data. Demo data does not represent actual property, owner, contact, market,
          conversion or performance data.
        </SectionHeading>
        <div role="group" aria-label="Choose a demo" className="flex flex-wrap gap-2">
          {TABS.map((t) => {
            const on = t.id === tab;
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={on}
                onClick={() => setTab(t.id)}
                className={`min-h-11 rounded-full border px-5 text-sm font-semibold ${on ? 'border-accent bg-accent text-white' : 'border-line-strong bg-panel text-ink hover:bg-inset'}`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
        {TABS.find((t) => t.id === tab)?.el}
      </div>
    </section>
  );
}
