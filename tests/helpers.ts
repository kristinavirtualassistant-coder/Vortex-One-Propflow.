import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

/** Integration tests need a real PostgreSQL with the supabase/migrations applied (see README). */
export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

let counter = 0;
const uniqueIp = () => `10.${(Date.now() >> 8) & 255}.${(++counter >> 8) & 255}.${counter & 255}`;

export interface Api {
  base: string;
  close(): Promise<void>;
}

export const startApi = async (): Promise<Api> => {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.SOCIAL_AUTH_PEPPER ||= 'test-pepper';
  process.env.TRUST_PROXY_HOPS = '1';
  const { createApp } = await import('../server.ts');
  const app = createApp();
  const server: Server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { base, close: () => new Promise((resolve) => server.close(() => resolve())) };
};

/** Minimal cookie-jar HTTP client; each client has its own session and source IP (rate limits). */
export class Client {
  private cookie = '';
  private ip = uniqueIp();
  constructor(private base: string) {}

  async req(method: string, path: string, body?: unknown) {
    const res = await fetch(this.base + path, {
      method,
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': this.ip,
        ...(this.cookie ? { cookie: this.cookie } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const set = res.headers.get('set-cookie');
    if (set) {
      const pair = set.split(';')[0];
      this.cookie = pair.endsWith('=') ? '' : pair;
    }
    const text = await res.text();
    let json: any = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = text; }
    return { status: res.status, body: json };
  }
  get = (p: string) => this.req('GET', p);
  post = (p: string, b?: unknown) => this.req('POST', p, b ?? {});
  patch = (p: string, b: unknown) => this.req('PATCH', p, b);
  del = (p: string) => this.req('DELETE', p);
}

export const uniqueEmail = (tag: string) => `${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

export const signup = async (api: Api, role: string, tag = role) => {
  const c = new Client(api.base);
  const email = uniqueEmail(tag);
  const r = await c.post('/api/auth/signup', { email, password: 'correct-horse-9', name: `Test ${tag}`, role });
  if (r.status !== 201) throw new Error(`signup failed: ${r.status} ${JSON.stringify(r.body)}`);
  return { client: c, email, user: r.body.user };
};
