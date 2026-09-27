type Constraint = { type: 'orderBy' | 'limit' | 'where'; field?: string; direction?: 'asc' | 'desc'; value?: unknown };
type QueryRef = { collection: string; constraints: Constraint[] };
type Snapshot = { docs: Array<{ id: string; data: () => Record<string, any> }> };

const token = () => { try { return window.localStorage.getItem('vortex_one_session') || ''; } catch { return ''; } };
const request = async (url: string, init: RequestInit = {}) => {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  const t = token(); if (t) headers.set('Authorization', `Bearer ${t}`);
  const response = await fetch(url, { ...init, headers });
  if (!response.ok) { const payload = await response.json().catch(() => ({})); throw new Error(payload.error || `Request failed: ${response.status}`); }
  if (response.status === 204) return null;
  return response.json();
};

export const db = {};
export const collection = (_db: unknown, name: string) => ({ collection: name });
export const doc = (_db: unknown, name: string, id: string) => ({ collection: name, id });
export const query = (ref: any, ...constraints: Constraint[]) => ({ ...ref, constraints });
export const orderBy = (field: string, direction: 'asc' | 'desc' = 'asc'): Constraint => ({ type: 'orderBy', field, direction });
export const limit = (value: number): Constraint => ({ type: 'limit', value });
export const where = (field: string, _operator: '==' = '==', value?: unknown): Constraint => ({ type: 'where', field, value });
export const serverTimestamp = () => new Date().toISOString();

const toSnapshot = (rows: any[]): Snapshot => ({ docs: rows.map(row => ({ id: String(row.id), data: () => ({ ...row.data }) })) });
const runQuery = async (ref: QueryRef) => {
  const p = new URLSearchParams();
  for (const c of ref.constraints || []) {
    if (c.type === 'orderBy' && c.field) { p.set('orderBy', c.field); p.set('order', c.direction || 'asc'); }
    if (c.type === 'limit' && c.value != null) p.set('limit', String(c.value));
    if (c.type === 'where' && c.field) p.append('where', JSON.stringify({ field: c.field, value: c.value }));
  }
  const payload = await request(`/api/data/${encodeURIComponent(ref.collection)}?${p}`);
  return toSnapshot(payload.records || []);
};
export const getDocs = async (ref: QueryRef) => runQuery(ref);

export const onSnapshot = (ref: QueryRef, callback: (snapshot: Snapshot) => void, onError?: (error: Error) => void) => {
  let active = true;
  const poll = async () => {
    try { const snapshot = await runQuery(ref); if (active) callback(snapshot); }
    catch (error) { if (active && onError) onError(error as Error); }
  };
  void poll();
  const timer = window.setInterval(poll, 10000);
  return () => { active = false; window.clearInterval(timer); };
};

export const addDoc = async (ref: { collection: string }, data: Record<string, any>) =>
  request(`/api/data/${encodeURIComponent(ref.collection)}`, { method: 'POST', body: JSON.stringify({ data }) });

export const updateDoc = async (ref: { collection: string; id: string }, data: Record<string, any>) =>
  request(`/api/data/${encodeURIComponent(ref.collection)}/${encodeURIComponent(ref.id)}`, { method: 'PATCH', body: JSON.stringify({ data }) });

export const deleteDoc = async (ref: { collection: string; id: string }) =>
  request(`/api/data/${encodeURIComponent(ref.collection)}/${encodeURIComponent(ref.id)}`, { method: 'DELETE' });

export const getAccessToken = async () => { try { return window.localStorage.getItem('vortex_one_session'); } catch { return null; } };
export const googleSignIn = async () => { throw new Error('Google Workspace OAuth is not configured in this application.'); };
