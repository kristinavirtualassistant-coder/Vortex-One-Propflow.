import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sameOriginGuard } from '../src/middleware/sameOrigin.ts';

const run = (headers: Record<string, string>, method = 'POST') => {
  let status = 200, nexted = false;
  const res: any = { status(c: number) { status = c; return this; }, json() { return this; } };
  sameOriginGuard({ method, headers } as any, res, () => { nexted = true; });
  return { status, nexted };
};
const base = { cookie: 'a=b', host: 'app.example.com' };

test('same-origin POST passes', () => assert.equal(run({ ...base, origin: 'https://app.example.com' }).nexted, true));
test('cross-site POST with cookie is blocked', () => assert.equal(run({ ...base, origin: 'https://evil.example' }).status, 403));
test('null origin is blocked', () => assert.equal(run({ ...base, origin: 'null' }).status, 403));
test('GET is never blocked', () => assert.equal(run({ ...base, origin: 'https://evil.example' }, 'GET').nexted, true));
test('no cookie or no Origin passes', () => {
  assert.equal(run({ host: 'app.example.com', origin: 'https://evil.example' }).nexted, true);
  assert.equal(run(base).nexted, true);
});
test('forwarded host is honoured', () => assert.equal(run({ cookie: 'a=b', host: 'internal', 'x-forwarded-host': 'app.example.com', origin: 'https://app.example.com' }).nexted, true));
