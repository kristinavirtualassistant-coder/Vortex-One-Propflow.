// Vercel Node function: POST /api/waitlist. Upserts one waitlist row in Airtable, keyed on email.
// The Airtable token stays server-side (AIRTABLE_TOKEN); nothing personal or secret is logged.

const AIRTABLE_BASE = 'appcIWisCiPXxqjXa';
const AIRTABLE_TABLE = 'tblAOayUEYAypdhXc';
// Airtable field names. Adjust here if the table uses different column names.
const FIELDS = { email: 'Email', name: 'Name', company: 'Company', role: 'Role', source: 'Source' } as const;

const MAX_BODY_BYTES = 8 * 1024;
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const UPSTREAM_TIMEOUT_MS = 8000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Per-instance limiter. Serverless instances do not share memory, so this caps bursts per warm instance.
const hits = new Map<string, number[]>();

type Req = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  on(event: 'data', cb: (chunk: Buffer) => void): unknown;
  on(event: 'end' | 'error', cb: (err?: Error) => void): unknown;
  destroy?: () => void;
};
type Res = {
  statusCode: number;
  setHeader(name: string, value: string): unknown;
  end(body?: string): unknown;
};

export type Submission = { email: string; name: string; company: string; role: string };

function header(req: Req, name: string): string {
  const v = req.headers[name];
  return (Array.isArray(v) ? v[0] : v ?? '').trim();
}

function send(res: Res, status: number, body: Record<string, unknown>) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

export function clientIp(req: Req): string {
  return header(req, 'x-real-ip') || header(req, 'x-forwarded-for').split(',')[0].trim() || 'unknown';
}

export function rateLimited(ip: string, now = Date.now()): boolean {
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (v.every((t) => now - t >= RATE_WINDOW_MS)) hits.delete(k);
  return false;
}

export function resetRateLimit() {
  hits.clear();
}

/** Same-origin: the Origin header's host must equal the request Host. */
export function sameOrigin(req: Req): boolean {
  const origin = header(req, 'origin');
  const host = header(req, 'x-forwarded-host') || header(req, 'host');
  if (!origin || !host) return false;
  try {
    return new URL(origin).host.toLowerCase() === host.toLowerCase();
  } catch {
    return false;
  }
}

function readBody(req: Req): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('too_large'));
        req.destroy?.();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', () => reject(new Error('read_error')));
  });
}

function clean(v: unknown, max: number): string | null {
  if (v === undefined || v === null) return '';
  if (typeof v !== 'string') return null;
  const s = v.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return s.length > max ? null : s;
}

export function validate(input: unknown): { ok: true; value: Submission } | { ok: false; field: string } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, field: 'body' };
  const o = input as Record<string, unknown>;
  const email = clean(o.email, 254);
  if (!email || !EMAIL_RE.test(email)) return { ok: false, field: 'email' };
  const name = clean(o.name, 120);
  if (name === null) return { ok: false, field: 'name' };
  const company = clean(o.company, 160);
  if (company === null) return { ok: false, field: 'company' };
  const role = clean(o.role, 120);
  if (role === null) return { ok: false, field: 'role' };
  return { ok: true, value: { email: email.toLowerCase(), name, company, role } };
}

async function airtable(path: string, token: string, init: RequestInit = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    return await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${AIRTABLE_TABLE}${path}`, {
      ...init,
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Find by email, then PATCH the existing row or POST a new one. Returns 'created' or 'updated'. */
export async function upsert(sub: Submission, token: string): Promise<'created' | 'updated'> {
  const formula = `LOWER({${FIELDS.email}})='${sub.email.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  const found = await airtable(`?maxRecords=1&filterByFormula=${encodeURIComponent(formula)}`, token);
  if (!found.ok) throw new Error(`lookup_${found.status}`);
  const existing = ((await found.json()) as { records?: { id: string }[] }).records?.[0];

  const fields: Record<string, string> = { [FIELDS.email]: sub.email, [FIELDS.source]: 'website' };
  if (sub.name) fields[FIELDS.name] = sub.name;
  if (sub.company) fields[FIELDS.company] = sub.company;
  if (sub.role) fields[FIELDS.role] = sub.role;

  const r = existing
    ? await airtable(`/${existing.id}`, token, { method: 'PATCH', body: JSON.stringify({ fields, typecast: true }) })
    : await airtable('', token, { method: 'POST', body: JSON.stringify({ records: [{ fields }], typecast: true }) });
  if (!r.ok) throw new Error(`${existing ? 'update' : 'create'}_${r.status}`);
  return existing ? 'updated' : 'created';
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return send(res, 405, { error: 'method_not_allowed' });
  }
  if (!sameOrigin(req)) return send(res, 403, { error: 'forbidden' });
  if (!/^application\/json\b/i.test(header(req, 'content-type'))) return send(res, 415, { error: 'json_required' });
  const declared = Number(header(req, 'content-length') || 0);
  if (declared > MAX_BODY_BYTES) return send(res, 413, { error: 'too_large' });
  if (rateLimited(clientIp(req))) {
    res.setHeader('Retry-After', String(RATE_WINDOW_MS / 1000));
    return send(res, 429, { error: 'rate_limited' });
  }

  let raw: string;
  try {
    raw = await readBody(req);
  } catch (e) {
    return send(res, (e as Error).message === 'too_large' ? 413 : 400, { error: (e as Error).message });
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return send(res, 400, { error: 'invalid_json' });
  }

  // Honeypot: real visitors never fill "website". Answer as if it worked so bots learn nothing.
  const hp = (parsed as Record<string, unknown> | null)?.website;
  if (typeof hp === 'string' && hp.trim() !== '') return send(res, 200, { ok: true });

  const v = validate(parsed);
  if (!v.ok) return send(res, 400, { error: 'invalid', field: v.field });

  const token = process.env.AIRTABLE_TOKEN;
  if (!token) return send(res, 503, { error: 'unavailable' });

  try {
    const result = await upsert(v.value, token);
    return send(res, 200, { ok: true, result });
  } catch (e) {
    const err = e as Error;
    // Status codes only: never the email, the request body or the token.
    console.error('waitlist upstream failure', err.name === 'AbortError' ? 'timeout' : err.message);
    return send(res, 502, { error: 'upstream_failed' });
  }
}
