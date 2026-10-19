import { useState, type FormEvent } from 'react';
import { btnPrimary, inputCls, labelCls } from './ui';

type Status = { kind: 'idle' } | { kind: 'sending' } | { kind: 'done'; updated: boolean } | { kind: 'error'; message: string };

const ERRORS: Record<string, string> = {
  invalid: 'Please check your details and try again.',
  rate_limited: 'Too many attempts. Please try again in a few minutes.',
  unavailable: 'The waitlist is temporarily unavailable. Please try again later.',
};

export function WaitlistForm() {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    setStatus({ kind: 'sending' });
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; result?: string; error?: string; field?: string };
      if (res.ok && body.ok) {
        setStatus({ kind: 'done', updated: body.result === 'updated' });
        return;
      }
      const message =
        body.error === 'invalid' && body.field === 'email'
          ? 'Please enter a valid email address.'
          : ERRORS[body.error ?? ''] ?? 'Something went wrong. Please try again.';
      setStatus({ kind: 'error', message });
    } catch {
      setStatus({ kind: 'error', message: 'Network error. Please try again.' });
    }
  }

  if (status.kind === 'done') {
    return (
      <p role="status" className="m-0 text-base font-semibold text-ink">
        {status.updated ? "You're already on the list. We updated your details." : "You're on the list. We'll be in touch."}
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid w-full max-w-md gap-3 text-left" noValidate>
      <div>
        <label htmlFor="wl-email" className={labelCls}>Work email</label>
        <input id="wl-email" name="email" type="email" required autoComplete="email" maxLength={254} className={inputCls} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="wl-name" className={labelCls}>Name</label>
          <input id="wl-name" name="name" autoComplete="name" maxLength={120} className={inputCls} />
        </div>
        <div>
          <label htmlFor="wl-company" className={labelCls}>Company</label>
          <input id="wl-company" name="company" autoComplete="organization" maxLength={160} className={inputCls} />
        </div>
      </div>
      {/* Honeypot: hidden from people and assistive tech; bots tend to fill it. */}
      <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}>
        <label htmlFor="wl-website">Website</label>
        <input id="wl-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <button type="submit" className={btnPrimary} disabled={status.kind === 'sending'}>
        {status.kind === 'sending' ? 'Joining…' : 'Join the waitlist'}
      </button>
      {status.kind === 'error' && (
        <p role="alert" className="m-0 text-sm text-danger">{status.message}</p>
      )}
    </form>
  );
}
