export const money = (n: number | string | null | undefined) =>
  n === null || n === undefined || n === '' ? '—' : Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export const num = (n: number | string | null | undefined) => (n === null || n === undefined ? '—' : Number(n).toLocaleString('en-US'));

export const fmtDate = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—');

export const fmtDateTime = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';

export const relTime = (d: string | null | undefined) => {
  if (!d) return '—';
  const diff = Date.now() - new Date(d).getTime();
  const abs = Math.abs(diff);
  const mins = Math.round(abs / 60000);
  const text = mins < 1 ? 'just now' : mins < 60 ? `${mins}m` : mins < 1440 ? `${Math.round(mins / 60)}h` : `${Math.round(mins / 1440)}d`;
  if (text === 'just now') return text;
  return diff >= 0 ? `${text} ago` : `in ${text}`;
};

export const titleCase = (s: string | null | undefined) =>
  (s ?? '').replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export const duration = (seconds: number | null | undefined) => {
  if (seconds === null || seconds === undefined) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

export const fullName = (c: { firstName?: string; lastName?: string } | null | undefined) =>
  c ? `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() : '';
