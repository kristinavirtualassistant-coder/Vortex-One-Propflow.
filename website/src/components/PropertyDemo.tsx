import { useState } from 'react';
import { Badge, Card, ScoreMeter, SectionHeading } from './ui';
import { scoreLead, type Signal } from '../lib/scoring';

interface Property {
  id: string;
  address: string;
  sub: string;
  type: string;
  apn: string;
  assessed: string;
  equity: number;
  years: number;
  absentee: boolean;
  signal: Signal;
  owner: string;
  entity: string;
  mailing: string;
  portfolio: string;
}

// Fictional data for illustration only.
const PROPERTIES: Property[] = [
  { id: 'p1', address: '1428 Elm Ave, Phoenix AZ', sub: 'Single-family · absentee owner', type: 'Single-family', apn: '000-00-001', assessed: '$412,000', equity: 78, years: 14, absentee: true, signal: 'taxlien', owner: 'Dana R.', entity: 'Individual', mailing: 'PO Box 220, Scottsdale AZ', portfolio: '1 property' },
  { id: 'p2', address: '77 Cactus Ln, Mesa AZ', sub: 'Townhome · owner-occupied', type: 'Townhome', apn: '000-00-002', assessed: '$298,000', equity: 55, years: 6, absentee: false, signal: 'none', owner: 'Marcus T.', entity: 'Individual', mailing: 'Same as property', portfolio: '1 property' },
  { id: 'p3', address: '40 Canal St, Tempe AZ', sub: 'Small multifamily · entity owner', type: 'Multifamily (4 units)', apn: '000-00-003', assessed: '$875,000', equity: 41, years: 3, absentee: true, signal: 'none', owner: 'Desert Row Holdings LLC', entity: 'LLC', mailing: '12 Example Plaza, Tempe AZ', portfolio: '3 properties' },
];

function Rows({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="m-0 flex flex-col gap-2">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-3 border-b border-line pb-2 text-sm">
          <dt className="text-ink-2">{k}</dt>
          <dd className="m-0 text-right font-semibold">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function PropertyDemo() {
  const [id, setId] = useState('p1');
  const p = PROPERTIES.find((x) => x.id === id) ?? PROPERTIES[0];
  const s = scoreLead({ equity: p.equity, years: p.years, absentee: p.absentee, signal: p.signal });

  return (
    <section id="intel" className="px-6 pb-16 pt-24">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <SectionHeading eyebrow="Property and owner intelligence" title="Know who owns the property before you call">
          Properties, parcels, owners and portfolios are linked records. Open a property to see its owner, signals and
          a transparent score with the reasons behind it.
        </SectionHeading>

        <div className="flex flex-wrap items-stretch gap-5">
          <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-3">
            <p className="m-0 text-[11px] font-bold uppercase tracking-[0.15em] text-ink-3">Sample properties · fictional</p>
            {PROPERTIES.map((x) => {
              const on = x.id === id;
              return (
                <button
                  key={x.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setId(x.id)}
                  className={`flex min-h-11 flex-col gap-0.5 rounded-2xl border px-4 py-3.5 text-left ${on ? 'border-accent bg-accent-subtle' : 'border-line bg-panel hover:bg-inset'}`}
                >
                  <span className="text-sm font-semibold">{x.address}</span>
                  <span className="text-xs text-ink-2">{x.sub}</span>
                </button>
              );
            })}
          </div>

          <Card elevated className="min-w-0 flex-[2_1_520px] p-6">
            <div className="flex flex-col gap-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="m-0 text-lg font-semibold">{p.address}</h3>
                <Badge tone={s.band === 'Hot' ? 'success' : s.band === 'Warm' ? 'accent' : 'neutral'}>{s.band} lead</Badge>
              </div>
              <div className="flex flex-wrap gap-6">
                <div className="min-w-60 flex-1">
                  <p className="m-0 pb-2 text-[11px] font-bold uppercase tracking-[0.15em] text-ink-3">Property</p>
                  <Rows rows={[['Type', p.type], ['APN', p.apn], ['Assessed value', p.assessed], ['Est. equity', `${p.equity}%`], ['Owned', `${p.years} years`]]} />
                </div>
                <div className="min-w-60 flex-1">
                  <p className="m-0 pb-2 text-[11px] font-bold uppercase tracking-[0.15em] text-ink-3">Owner</p>
                  <Rows rows={[['Owner', p.owner], ['Entity', p.entity], ['Mailing address', p.mailing], ['Absentee', p.absentee ? 'Yes' : 'No'], ['Portfolio', p.portfolio]]} />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {s.reasons.length ? s.reasons.map((r) => <Badge key={r} tone="accent">{r}</Badge>) : <Badge>No strong signals</Badge>}
              </div>
              <ScoreMeter score={s.total} />
              <p className="m-0 text-xs leading-4 text-ink-3">
                Fictional data and illustrative scoring rules, not the production ruleset. Scores are estimates, not facts about a person.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}
