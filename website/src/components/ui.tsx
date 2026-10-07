import type { ReactNode } from 'react';

export function Eyebrow({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'sky' }) {
  return (
    <p className={`m-0 text-[11px] font-bold uppercase leading-4 tracking-[0.15em] ${tone === 'sky' ? 'text-sky' : 'text-ink-3'}`}>
      {children}
    </p>
  );
}

export function SectionHeading({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <div className="flex max-w-3xl flex-col gap-3">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="m-0 text-3xl font-bold leading-9 tracking-tight">{title}</h2>
      {children && <p className="m-0 text-base leading-6 text-ink-2">{children}</p>}
    </div>
  );
}

export function Card({ children, elevated = false, className = '' }: { children: ReactNode; elevated?: boolean; className?: string }) {
  return (
    <div className={`rounded-2xl border border-line bg-panel p-5 ${elevated ? 'shadow-card' : ''} ${className}`}>{children}</div>
  );
}

type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';
const BADGE: Record<Tone, string> = {
  neutral: 'bg-track text-ink-2',
  accent: 'bg-accent-subtle text-accent',
  success: 'bg-success-subtle text-success',
  warning: 'bg-warning-subtle text-ink',
  danger: 'bg-danger-subtle text-danger',
};

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold leading-4 ${BADGE[tone]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${tone === 'warning' ? 'bg-warning' : 'bg-current'}`} aria-hidden="true" />
      {children}
    </span>
  );
}

export function ScoreMeter({ score }: { score: number }) {
  const fill = score >= 75 ? 'bg-success' : score < 40 ? 'bg-ink-3' : 'bg-accent';
  return (
    <div className="flex items-center gap-3">
      <span className="min-w-[2.5ch] text-2xl font-bold tabular-nums">{score}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-track" role="img" aria-label={`Score ${score} out of 100`}>
        <div className={`h-full rounded-full ${fill}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

export const btnPrimary =
  'inline-flex min-h-11 items-center justify-center rounded-xl bg-accent px-5 text-sm font-bold text-white shadow-sm hover:bg-accent-hover';
export const btnSecondary =
  'inline-flex min-h-11 items-center justify-center rounded-lg border border-line-strong bg-panel px-4 text-sm font-medium text-ink hover:bg-inset';
export const labelCls = 'mb-2 block text-xs font-bold uppercase tracking-wider text-ink-2';
export const inputCls = 'min-h-11 w-full rounded-xl border border-line bg-inset px-4 text-sm text-ink';
