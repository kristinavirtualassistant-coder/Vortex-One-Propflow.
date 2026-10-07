import type { ReactNode } from 'react';
import { APP_URL, CONTACT_EMAIL } from '../config';
import { Badge, Card, Eyebrow, SectionHeading, btnPrimary, btnSecondary } from './ui';

function Icon({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-subtle text-accent">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {children}
      </svg>
    </div>
  );
}

const FEATURES: { title: string; body: string; status?: string; icon: ReactNode }[] = [
  {
    title: 'Property and owner intelligence',
    body: 'Properties, parcels, owners and portfolios as linked records, with characteristics, valuation, signals and import by APN.',
    icon: <><path d="M21 10c0 7-9 12-9 12S3 17 3 10a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></>,
  },
  {
    title: 'Transparent lead scoring',
    body: 'Rule-based scores from 0 to 100 with the reasons shown beside them, so the queue ranks itself and callers can see why.',
    icon: <><path d="M3 3v18h18" /><path d="M7 15l4-4 3 3 5-6" /></>,
  },
  {
    title: 'CRM and pipeline',
    body: 'Contacts, leads, tasks and notes with pipeline stages, assignment, search, filters and one activity log.',
    icon: <><rect x="3" y="4" width="5" height="16" rx="1" /><rect x="10" y="4" width="5" height="10" rx="1" /><rect x="17" y="4" width="4" height="13" rx="1" /></>,
  },
  {
    title: 'Power dialer and campaigns',
    body: 'Campaign lifecycle, queue-based dialing, call states, outcomes, follow-up tasks and Do Not Call enforcement.',
    status: 'Simulated calls today',
    icon: <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />,
  },
  {
    title: 'Workflow automation',
    body: 'Triggers, conditions and actions with saved runs and per-step results, so follow-ups are queued instead of forgotten.',
    icon: <><path d="M4 12a8 8 0 0 1 14-5.3L20 9" /><path d="M20 4v5h-5" /><path d="M20 12a8 8 0 0 1-14 5.3L4 15" /><path d="M4 20v-5h5" /></>,
  },
  {
    title: 'AI agents',
    body: 'A registry of agents with a purpose, permissions, typed inputs and outputs, and run history. Today they are rule-based.',
    status: 'Rule-based today',
    icon: <><rect x="4" y="8" width="16" height="12" rx="2" /><path d="M12 4v4" /><circle cx="9" cy="14" r="1" /><circle cx="15" cy="14" r="1" /></>,
  },
];

export function Platform() {
  return (
    <section id="platform" className="border-y border-line bg-panel px-6 py-20">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <SectionHeading eyebrow="Platform" title="One workspace for the whole loop, from search to follow-up" />
        <div className="flex flex-wrap gap-5">
          {FEATURES.map((f) => (
            <Card key={f.title} className="flex min-w-0 flex-[1_1_300px] flex-col gap-3">
              <Icon>{f.icon}</Icon>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="m-0 text-lg font-semibold leading-7">{f.title}</h3>
                {f.status && <Badge tone="warning">{f.status}</Badge>}
              </div>
              <p className="m-0 text-sm leading-5 text-ink-2">{f.body}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

const STEPS = [
  ['Import', 'Bring in properties and owners, including by APN, and keep them linked.'],
  ['Score', 'Rule-based scoring ranks every prospect and shows the reasons behind each score.'],
  ['Dial', 'Work the queue with campaigns and call outcomes. Do Not Call contacts are always excluded.'],
  ['Follow up', 'Callbacks and tasks land in the queue with the context a person needs to pick up the thread.'],
];

export function HowItWorks() {
  return (
    <section id="how" className="px-6 py-20">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <SectionHeading eyebrow="How it works" title="From list to follow-up in four steps" />
        <div className="flex flex-wrap gap-5">
          {STEPS.map(([t, b], i) => (
            <div key={t} className="flex min-w-0 flex-[1_1_240px] flex-col gap-2 border-t-2 border-ink pt-4">
              <span className="text-2xl font-bold leading-8 text-accent">{i + 1}</span>
              <h3 className="m-0 text-lg font-semibold leading-7">{t}</h3>
              <p className="m-0 text-sm leading-5 text-ink-2">{b}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Trust() {
  return (
    <section id="trust" className="px-6 pb-20">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-8 rounded-3xl bg-navy p-8 text-white md:p-12">
        <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-3">
          <Eyebrow tone="sky">Built to be honest</Eyebrow>
          <h2 className="m-0 text-3xl font-bold leading-9 tracking-tight">We label what is simulated, and we commit to how live AI calling will behave</h2>
        </div>
        <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-3 text-base leading-6 text-slate-300">
          <p className="m-0">
            The dialer is simulated today, and we say so. When live calling launches, the caller will identify itself as an AI,
            honor do-not-call requests the moment they are made, and never give legal, financial or tax advice, negotiate or
            guarantee an outcome.
          </p>
          <p className="m-0">
            Read the <a className="text-sky underline" href="/legal/ai-disclosure">AI disclosure</a> and the{' '}
            <a className="text-sky underline" href="/legal/communications-policy">communications policy</a>.
          </p>
        </div>
      </div>
    </section>
  );
}

export function Pricing() {
  return (
    <section id="pricing" className="px-6 pb-20">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <SectionHeading eyebrow="Pricing" title="Free while we are in early access">
          Paid plans are not available yet. Create a free account to use the platform now, and we will announce plans and prices before anything changes.
        </SectionHeading>
        <div className="flex flex-wrap gap-5">
          <Card elevated className="flex min-w-0 flex-[1_1_320px] flex-col gap-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="m-0 text-lg font-semibold">Early access</h3>
              <Badge tone="success">Available now</Badge>
            </div>
            <p className="m-0 text-3xl font-black tracking-tight">Free</p>
            <ul className="m-0 flex list-none flex-col gap-2 p-0 text-sm leading-5 text-ink-2">
              <li>CRM, pipeline, campaigns and workflows</li>
              <li>Property and owner records with scoring</li>
              <li>Simulated dialer and rule-based agents</li>
              <li>Isolated live demo workspace</li>
            </ul>
            <a className={`${btnPrimary} mt-auto`} href={APP_URL}>Start free</a>
          </Card>
          <Card className="flex min-w-0 flex-[1_1_320px] flex-col gap-4">
            <h3 className="m-0 text-lg font-semibold">Teams and custom needs</h3>
            <p className="m-0 text-sm leading-5 text-ink-2">
              Need more seats, a rollout plan or a security review? Tell us what you need and we will reply by email.
            </p>
            <a className={`${btnSecondary} mt-auto`} href={`mailto:${CONTACT_EMAIL}?subject=Vortex%20One%20for%20my%20team`}>Talk to us</a>
          </Card>
        </div>
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section id="cta" className="px-6 pb-24">
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-5 text-center">
        <Eyebrow>Next step</Eyebrow>
        <h2 className="m-0 text-4xl font-black leading-10 tracking-tight">Open your Vortex One workspace</h2>
        <p className="m-0 text-base leading-6 text-ink-2">Create a free account, or start the live demo to explore a seeded sandbox first.</p>
        <div className="flex flex-wrap justify-center gap-3">
          <a className={btnPrimary} href={APP_URL}>Start free</a>
          <a className={btnSecondary} href={APP_URL}>Sign in</a>
        </div>
      </div>
    </section>
  );
}
