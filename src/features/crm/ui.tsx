import React, { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Loader2, X } from 'lucide-react';
import { ApiError, api, errorMessage, qs } from './api';

// ------------------------------------------------------------------ toasts (success/error feedback, announced)
type Toast = { id: number; kind: 'success' | 'error'; message: string };
const ToastContext = createContext<{ success(m: string): void; error(m: string): void }>({ success() {}, error() {} });
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((kind: Toast['kind'], message: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, message }]);
    // Errors stay until dismissed (UX contract); successes fade.
    if (kind === 'success') setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);
  const value = useMemo(() => ({ success: (m: string) => push('success', m), error: (m: string) => push('error', m) }), [push]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-12 right-4 z-[70] flex flex-col gap-2 w-[min(92vw,380px)]" role="region" aria-label="Notifications">
        {toasts.map((t) => (
          <div key={t.id} role={t.kind === 'error' ? 'alert' : 'status'}
            className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm shadow-lg ${t.kind === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/80 dark:border-emerald-800 dark:text-emerald-200'
              : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950/80 dark:border-red-800 dark:text-red-200'}`}>
            {t.kind === 'success' ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" /> : <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />}
            <span className="flex-1">{t.message}</span>
            <button type="button" aria-label="Dismiss" onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}><X className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// ------------------------------------------------------------------ data hooks
/** Fetches on mount/dependency change; ignores stale responses so a slow old request cannot overwrite a newer one. */
export function useFetch<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<{ data: T | null; loading: boolean; error: string | null }>({ data: null, loading: true, error: null });
  const seq = useRef(0);
  const run = useCallback(() => {
    const id = ++seq.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    fn().then(
      (data) => { if (id === seq.current) setState({ data, loading: false, error: null }); },
      (e) => { if (id === seq.current) setState((s) => ({ data: s.data, loading: false, error: errorMessage(e) })); },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { run(); }, [run]);
  return { ...state, reload: run };
}

export function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

// ------------------------------------------------------------------ primitives
export const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ');

export function Card({ children, className, title, actions }: { children: React.ReactNode; className?: string; title?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <section className={cx('bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm', className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 px-5 pt-4 pb-2">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h3>
          <div className="flex items-center gap-2">{actions}</div>
        </header>
      )}
      <div className="p-5 pt-3">{children}</div>
    </section>
  );
}

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost'; size?: 'sm' | 'md'; loading?: boolean };
export function Button({ variant = 'secondary', size = 'md', loading, className, children, disabled, ...rest }: BtnProps) {
  const styles = {
    primary: 'bg-indigo-600 hover:bg-indigo-700 text-white border-transparent',
    secondary: 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700',
    danger: 'bg-red-600 hover:bg-red-700 text-white border-transparent',
    ghost: 'bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 border-transparent',
  }[variant];
  return (
    <button type="button" disabled={disabled || loading} {...rest}
      className={cx('inline-flex items-center justify-center gap-2 rounded-xl border font-semibold disabled:opacity-50 disabled:cursor-not-allowed',
        size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm', styles, className)}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}

const TONES: Record<string, string> = {
  slate: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  green: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  red: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  amber: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  violet: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300',
};
export function Badge({ children, tone = 'slate' }: { children: React.ReactNode; tone?: keyof typeof TONES }) {
  return <span className={cx('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap', TONES[tone])}>{children}</span>;
}

export const toneFor = (value: string | null | undefined): keyof typeof TONES => {
  switch (value) {
    case 'won': case 'completed': case 'active': case 'done': case 'connected': case 'hot': case 'appointment_set': case 'connected_interested': return 'green';
    case 'lost': case 'failed': case 'do_not_call': case 'urgent': case 'exhausted': case 'busy': return 'red';
    case 'warm': case 'paused': case 'high': case 'callback': case 'no_answer': case 'running': case 'ringing': case 'dialing': return 'amber';
    case 'qualified': case 'appointment': case 'negotiating': case 'contacted': case 'queued': return 'blue';
    case 'draft': case 'identified': case 'nurture': case 'open': case 'pending': return 'slate';
    default: return 'slate';
  }
};

export function StatusBadge({ value }: { value: string | null | undefined }) {
  if (!value) return <span className="text-slate-400">—</span>;
  return <Badge tone={toneFor(value)}>{value.replace(/[._]/g, ' ')}</Badge>;
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500" role="status"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />{label}</div>;
}

export function ErrorBanner({ message, onRetry }: { message: string | null; onRetry?: () => void }) {
  if (!message) return null;
  return (
    <div role="alert" className="flex items-center gap-3 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-300">
      <AlertCircle className="h-4 w-4 shrink-0" />
      <span className="flex-1">{message}</span>
      {onRetry && <Button size="sm" onClick={onRetry}>Retry</Button>}
    </div>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="text-center py-12 px-4">
      <p className="font-semibold text-slate-700 dark:text-slate-200">{title}</p>
      {hint && <p className="mt-1 text-sm text-slate-500">{hint}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
      <div className="min-w-0">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">{title}</h2>
        {subtitle && <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">{actions}</div>
    </div>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: string; tone?: 'red' | 'green' }) {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className={cx('mt-1 text-2xl font-black', tone === 'red' ? 'text-red-600' : tone === 'green' ? 'text-emerald-600' : 'text-slate-900 dark:text-white')}>{value}</div>
      {hint && <div className="text-xs text-slate-500 mt-0.5">{hint}</div>}
    </div>
  );
}

// ------------------------------------------------------------------ forms
const inputCls = 'w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) =>
  <input ref={ref} {...p} className={cx(inputCls, className)} />);
Input.displayName = 'Input';

export function Select({ className, children, ...p }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...p} className={cx(inputCls, className)}>{children}</select>;
}

export function Textarea({ className, ...p }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...p} className={cx(inputCls, 'min-h-[80px]', className)} />;
}

export function Field({ label, error, help, children, required }: { label: string; error?: string; help?: string; children: (id: string) => React.ReactNode; required?: boolean }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">{label}{required && <span className="text-red-500"> *</span>}</label>
      {children(id)}
      {help && !error && <p className="text-xs text-slate-500 mt-1">{help}</p>}
      {error && <p role="alert" className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

export function TagInput({ value, onChange, id }: { value: string[]; onChange: (v: string[]) => void; id?: string }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const t = draft.trim();
    if (t && !value.includes(t)) onChange([...value, t]);
    setDraft('');
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5">
      {value.map((t) => (
        <span key={t} className="inline-flex items-center gap-1 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-200 px-2 py-0.5 text-xs font-semibold">
          {t}<button type="button" aria-label={`Remove tag ${t}`} onClick={() => onChange(value.filter((x) => x !== t))}><X className="h-3 w-3" /></button>
        </span>
      ))}
      <input id={id} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={value.length ? '' : 'Add a tag and press Enter'}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); } if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1)); }}
        onBlur={add} className="flex-1 min-w-[100px] bg-transparent text-sm outline-none py-0.5" />
    </div>
  );
}

// ------------------------------------------------------------------ dialogs (app-owned; never alert/confirm)
export function Modal({ title, onClose, children, wide, footer }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean; footer?: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    ref.current?.querySelector<HTMLElement>('input,select,textarea,button')?.focus();
    return () => { window.removeEventListener('keydown', onKey); prev?.focus?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId}
        className={cx('bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-h-[90vh] flex flex-col', wide ? 'max-w-3xl' : 'max-w-lg')}>
        <header className="flex items-center justify-between px-6 pt-5 pb-3">
          <h2 id={titleId} className="text-lg font-bold text-slate-900 dark:text-white">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close dialog" className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"><X className="h-5 w-5" /></button>
        </header>
        <div className="px-6 pb-4 overflow-y-auto">{children}</div>
        {footer && <footer className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">{footer}</footer>}
      </div>
    </div>
  );
}

export function ConfirmDialog({ title, message, confirmLabel, danger, onConfirm, onClose }: {
  title: string; message: React.ReactNode; confirmLabel: string; danger?: boolean; onConfirm: () => Promise<unknown> | unknown; onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal title={title} onClose={onClose} footer={<>
      <Button onClick={onClose} disabled={busy}>Cancel</Button>
      <Button variant={danger ? 'danger' : 'primary'} loading={busy} onClick={async () => {
        setBusy(true); setError(null);
        try { await onConfirm(); onClose(); } catch (e) { setError(errorMessage(e)); setBusy(false); }
      }}>{confirmLabel}</Button>
    </>}>
      <p className="text-sm text-slate-600 dark:text-slate-300">{message}</p>
      {error && <div className="mt-3"><ErrorBanner message={error} /></div>}
    </Modal>
  );
}

// ------------------------------------------------------------------ record picker (typeahead over the API)
export type PickerKind = 'contacts' | 'properties' | 'owners' | 'leads' | 'users';
const pickerLabel = (kind: PickerKind, r: any) => {
  switch (kind) {
    case 'contacts': return `${r.firstName} ${r.lastName}`.trim() + (r.phone ? ` · ${r.phone}` : '');
    case 'properties': return `${r.address}, ${r.city}, ${r.state}`;
    case 'owners': return r.name;
    case 'leads': return r.title;
    case 'users': return `${r.name} (${r.role.replace(/_/g, ' ')})`;
  }
};

export function RecordPicker({ kind, value, onChange, id, placeholder, initialLabel }: {
  kind: PickerKind; value: string | null | undefined; onChange: (id: string | null, record?: any) => void; id?: string; placeholder?: string; initialLabel?: string;
}) {
  const [text, setText] = useState('');
  const [label, setLabel] = useState(initialLabel ?? '');
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const q = useDebounced(text, 250);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    const path = kind === 'users' ? '/org/members' : `/${kind}${qs({ q, limit: 8 })}`;
    api.get(path).then((r) => {
      if (cancelled) return;
      const items = (r.items ?? []).filter((x: any) => (kind === 'users' ? !x.disabledAt && (!q || x.name.toLowerCase().includes(q.toLowerCase())) : true));
      setOptions(items.slice(0, 8));
    }).catch(() => !cancelled && setOptions([])).finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [q, open, kind]);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div ref={box} className="relative">
      {value && !open ? (
        <div className="flex items-center justify-between rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm">
          <span className="truncate">{label || value}</span>
          <button type="button" aria-label="Clear selection" onClick={() => { onChange(null); setLabel(''); setText(''); }}><X className="h-4 w-4 text-slate-400" /></button>
        </div>
      ) : (
        <Input id={id} value={text} placeholder={placeholder ?? `Search ${kind}…`} onFocus={() => setOpen(true)} onChange={(e) => { setText(e.target.value); setOpen(true); }} role="combobox" aria-expanded={open} autoComplete="off" />
      )}
      {open && (
        <ul role="listbox" className="absolute z-20 mt-1 w-full max-h-56 overflow-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg">
          {loading && <li className="px-3 py-2 text-sm text-slate-500">Searching…</li>}
          {!loading && options.length === 0 && <li className="px-3 py-2 text-sm text-slate-500">No matches</li>}
          {options.map((o) => (
            <li key={o.id} role="option" aria-selected={false}>
              <button type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                onClick={() => { onChange(o.id, o); setLabel(pickerLabel(kind, o)); setText(''); setOpen(false); }}>{pickerLabel(kind, o)}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ schema-driven form modal
export type FieldDef = {
  name: string; label: string; type?: 'text' | 'email' | 'tel' | 'number' | 'date' | 'select' | 'textarea' | 'checkbox' | 'tags' | 'record';
  required?: boolean; options?: Array<{ value: string; label: string }>; placeholder?: string; help?: string; span?: 1 | 2;
  record?: PickerKind; recordLabel?: string;
};

export function FormModal({ title, fields, initial, submitLabel = 'Save', onSubmit, onClose, wide }: {
  title: string; fields: FieldDef[]; initial: Record<string, any>; submitLabel?: string; wide?: boolean;
  onSubmit: (values: Record<string, any>) => Promise<unknown>; onClose: () => void;
}) {
  const [values, setValues] = useState<Record<string, any>>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const set = (name: string, v: any) => setValues((s) => ({ ...s, [name]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const missing: Record<string, string> = {};
    for (const f of fields) if (f.required && (values[f.name] === undefined || values[f.name] === null || String(values[f.name]).trim() === '')) missing[f.name] = `${f.label} is required`;
    setFieldErrors(missing);
    if (Object.keys(missing).length) return;
    setBusy(true); setError(null);
    try { await onSubmit(values); onClose(); }
    catch (err) {
      if (err instanceof ApiError && err.issues?.length) {
        setFieldErrors(Object.fromEntries(err.issues.map((i) => [i.path, i.message])));
        setError('Please fix the highlighted fields.');
      } else setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Modal title={title} onClose={onClose} wide={wide}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {fields.map((f) => (
            <div key={f.name} className={f.span === 2 || f.type === 'textarea' || f.type === 'tags' ? 'sm:col-span-2' : ''}>
              {f.type === 'checkbox' ? (
                <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 pt-6">
                  <input type="checkbox" checked={Boolean(values[f.name])} onChange={(e) => set(f.name, e.target.checked)} className="h-4 w-4 rounded" />{f.label}
                </label>
              ) : (
                <Field label={f.label} required={f.required} help={f.help} error={fieldErrors[f.name]}>
                  {(id) => f.type === 'select' ? (
                    <Select id={id} value={values[f.name] ?? ''} onChange={(e) => set(f.name, e.target.value)}>
                      {!f.required && <option value="">—</option>}
                      {f.options!.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </Select>
                  ) : f.type === 'textarea' ? (
                    <Textarea id={id} value={values[f.name] ?? ''} onChange={(e) => set(f.name, e.target.value)} placeholder={f.placeholder} />
                  ) : f.type === 'tags' ? (
                    <TagInput id={id} value={values[f.name] ?? []} onChange={(v) => set(f.name, v)} />
                  ) : f.type === 'record' ? (
                    <RecordPicker id={id} kind={f.record!} value={values[f.name]} onChange={(v) => set(f.name, v)} initialLabel={f.recordLabel} />
                  ) : (
                    <Input id={id} type={f.type ?? 'text'} value={values[f.name] ?? ''} placeholder={f.placeholder}
                      onChange={(e) => set(f.name, e.target.value)} step={f.type === 'number' ? 'any' : undefined} />
                  )}
                </Field>
              )}
            </div>
          ))}
        </div>
        {error && <ErrorBanner message={error} />}
        <div className="flex justify-end gap-2 pt-2">
          <Button onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" variant="primary" loading={busy}>{submitLabel}</Button>
        </div>
      </form>
    </Modal>
  );
}

// ------------------------------------------------------------------ table + pagination
export type Column<T> = { key: string; header: string; render: (row: T) => React.ReactNode; sort?: string; className?: string };

export function DataTable<T extends { id: string }>({ columns, rows, loading, error, onRetry, onRowClick, sort, dir, onSort, emptyTitle, emptyHint, emptyAction }: {
  columns: Column<T>[]; rows: T[] | undefined; loading: boolean; error: string | null; onRetry?: () => void; onRowClick?: (row: T) => void;
  sort?: string; dir?: 'asc' | 'desc'; onSort?: (key: string) => void; emptyTitle: string; emptyHint?: string; emptyAction?: React.ReactNode;
}) {
  if (error && !rows) return <ErrorBanner message={error} onRetry={onRetry} />;
  if (loading && !rows) return <Spinner />;
  return (
    <div>
      {error && <div className="mb-3"><ErrorBanner message={`Some data may be out of date: ${error}`} onRetry={onRetry} /></div>}
      {rows && rows.length === 0 ? <EmptyState title={emptyTitle} hint={emptyHint} action={emptyAction} /> : (
        <div className={cx('overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900', loading && 'opacity-60')} aria-busy={loading}>
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>{columns.map((c) => (
                <th key={c.key} scope="col" className={cx('px-4 py-2.5 font-semibold whitespace-nowrap', c.className)} aria-sort={c.sort && sort === c.sort ? (dir === 'asc' ? 'ascending' : 'descending') : undefined}>
                  {c.sort && onSort ? (
                    <button type="button" className="inline-flex items-center gap-1 uppercase" onClick={() => onSort(c.sort!)}>
                      {c.header}{sort === c.sort && <ChevronDown className={cx('h-3 w-3', dir === 'asc' && 'rotate-180')} />}
                    </button>
                  ) : c.header}
                </th>))}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows?.map((row) => (
                <tr key={row.id} className={cx(onRowClick && 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50')}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={onRowClick ? (e) => { if (e.key === 'Enter') onRowClick(row); } : undefined} tabIndex={onRowClick ? 0 : undefined}>
                  {columns.map((c) => <td key={c.key} className={cx('px-4 py-3 align-middle', c.className)}>{c.render(row)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function Pagination({ total, limit, offset, onChange }: { total: number; limit: number; offset: number; onChange: (offset: number) => void }) {
  if (total <= limit) return total ? <p className="mt-2 text-xs text-slate-500">{total} result{total === 1 ? '' : 's'}</p> : null;
  const page = Math.floor(offset / limit) + 1;
  const pages = Math.ceil(total / limit);
  return (
    <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
      <span>{offset + 1}–{Math.min(offset + limit, total)} of {total}</span>
      <div className="flex items-center gap-2">
        <Button size="sm" disabled={page <= 1} onClick={() => onChange(Math.max(0, offset - limit))} aria-label="Previous page"><ChevronLeft className="h-3 w-3" /></Button>
        <span>Page {page} of {pages}</span>
        <Button size="sm" disabled={page >= pages} onClick={() => onChange(offset + limit)} aria-label="Next page"><ChevronRight className="h-3 w-3" /></Button>
      </div>
    </div>
  );
}

/** Shared list state: search + filters + sort + page, with a fetch that ignores stale responses. */
export function useList<T>(resource: string, base: Record<string, string | number | boolean | undefined> = {}, pageSize = 25) {
  const [q, setQ] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<string | undefined>();
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');
  const [offset, setOffset] = useState(0);
  const dq = useDebounced(q, 300);
  const baseKey = JSON.stringify(base);
  const result = useFetch<{ items: T[]; total: number; limit: number; offset: number }>(
    () => api.get(`/${resource}${qs({ ...base, ...filters, q: dq, sort, dir, limit: pageSize, offset })}`),
    [resource, dq, JSON.stringify(filters), sort, dir, offset, baseKey],
  );
  const toggleSort = (key: string) => { if (sort === key) setDir((d) => (d === 'asc' ? 'desc' : 'asc')); else { setSort(key); setDir('asc'); } setOffset(0); };
  return {
    ...result, q, setQ: (v: string) => { setQ(v); setOffset(0); }, filters, setFilter: (k: string, v: string) => { setFilters((f) => ({ ...f, [k]: v })); setOffset(0); },
    sort, dir, toggleSort, offset, setOffset, pageSize,
  };
}
