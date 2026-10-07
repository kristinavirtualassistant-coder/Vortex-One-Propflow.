// Client for the tenant-scoped portal records API (/api/portal/:collection).
// Exposes the small document-style surface the legacy portal components were written against.

type Constraint = { type: 'orderBy' | 'limit' | 'where'; field?: string; direction?: 'asc' | 'desc'; value?: unknown };
type CollectionRef = { collection: string };
type DocRef = { collection: string; id: string };
type QueryRef = CollectionRef & { constraints?: Constraint[] };

const POLL_INTERVAL_MS = 5000;
const TIMESTAMP_FIELDS = ['createdAt', 'updatedAt'];
const SERVER_TIMESTAMP = Symbol('serverTimestamp');

/** Placeholder the server replaces; timestamps are always assigned server-side. */
export const serverTimestamp = () => SERVER_TIMESTAMP;

export const db = {};
export const collection = (_db: unknown, name: string): CollectionRef => ({ collection: name });
export const doc = (_db: unknown, name: string, id: string): DocRef => ({ collection: name, id });
export const query = (ref: CollectionRef, ...constraints: Constraint[]): QueryRef => ({ ...ref, constraints });
export const orderBy = (field: string, direction: 'asc' | 'desc' = 'asc'): Constraint => ({ type: 'orderBy', field, direction });
export const limit = (value: number): Constraint => ({ type: 'limit', value });
export const where = (field: string, _operator: '==' = '==', value?: unknown): Constraint => ({ type: 'where', field, value });

type RawRecord = Record<string, any> & { id: string };

// Components call `createdAt.toDate()`; wrap server ISO strings so that keeps working.
const withDates = (record: RawRecord): RawRecord => {
  const out: RawRecord = { ...record };
  for (const field of TIMESTAMP_FIELDS) {
    const value = out[field];
    if (typeof value === 'string') {
      const date = new Date(value);
      out[field] = { toDate: () => date, toMillis: () => date.getTime(), seconds: Math.floor(date.getTime() / 1000) };
    }
  }
  return out;
};

const toSnapshot = (records: RawRecord[]) => {
  const docs = records.map((record) => {
    const data = withDates(record);
    const { id, ...rest } = data;
    return { id, data: () => rest };
  });
  return { docs, metadata: { hasPendingWrites: false }, forEach: (callback: (d: (typeof docs)[number]) => void) => docs.forEach(callback) };
};

const stripSentinels = (data: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(data).filter(([, value]) => value !== SERVER_TIMESTAMP));

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/portal/${path}`, {
    method,
    credentials: 'include',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw new Error(detail?.error || `Request failed (${response.status})`);
  }
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

const queryString = (ref: QueryRef) => {
  const params = new URLSearchParams();
  for (const constraint of ref.constraints || []) {
    if (constraint.type === 'orderBy' && constraint.field) {
      params.set('orderBy', constraint.field);
      params.set('direction', constraint.direction || 'asc');
    } else if (constraint.type === 'limit' && constraint.value != null) {
      params.set('limit', String(constraint.value));
    } else if (constraint.type === 'where' && constraint.field) {
      params.set(`where.${constraint.field}`, String(constraint.value));
    }
  }
  const text = params.toString();
  return text ? `?${text}` : '';
};

export const getDocs = async (ref: QueryRef) => {
  const { records } = await request<{ records: RawRecord[] }>('GET', `${ref.collection}${queryString(ref)}`);
  return toSnapshot(records);
};

/** Polls the API; pauses while the tab is hidden. Returns an unsubscribe function. */
export const onSnapshot = (
  ref: QueryRef,
  optionsOrCallback: any,
  callbackOrOnError?: any,
  onError?: (error: Error) => void,
) => {
  const callback = typeof optionsOrCallback === 'function' ? optionsOrCallback : callbackOrOnError;
  const errHandler = typeof optionsOrCallback === 'function' ? callbackOrOnError : onError;
  let active = true;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const tick = async () => {
    if (!active) return;
    if (typeof document === 'undefined' || document.visibilityState !== 'hidden') {
      try {
        const snapshot = await getDocs(ref);
        if (active && callback) callback(snapshot);
      } catch (error) {
        if (active && errHandler) errHandler(error as Error);
        else if (active) console.error('Portal data error:', error);
      }
    }
    if (active) timer = setTimeout(tick, POLL_INTERVAL_MS);
  };
  void tick();

  return () => {
    active = false;
    if (timer) clearTimeout(timer);
  };
};

export const addDoc = async (ref: CollectionRef, data: Record<string, any>) => {
  const { record } = await request<{ record: RawRecord }>('POST', ref.collection, stripSentinels(data));
  return { id: record.id };
};

export const updateDoc = async (ref: DocRef, data: Record<string, any>) => {
  await request('PATCH', `${ref.collection}/${encodeURIComponent(ref.id)}`, stripSentinels(data));
};

export const deleteDoc = async (ref: DocRef) => {
  await request('DELETE', `${ref.collection}/${encodeURIComponent(ref.id)}`);
};

export const getDoc = async (ref: DocRef) => {
  try {
    const { record } = await request<{ record: RawRecord }>('GET', `${ref.collection}/${encodeURIComponent(ref.id)}`);
    const { id, ...rest } = withDates(record);
    return { exists: () => true, id, data: () => rest };
  } catch {
    return { exists: () => false, id: ref.id, data: () => ({}) };
  }
};

export const getAccessToken = async () => null;
export const googleSignIn = async (): Promise<{ user: any; accessToken: string } | null> => {
  throw new Error('Google Workspace OAuth is not configured in this application.');
};
