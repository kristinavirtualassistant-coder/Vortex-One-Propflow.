import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  getFirestore, 
  collection as firestoreCollection, 
  doc as firestoreDoc, 
  query as firestoreQuery, 
  orderBy as firestoreOrderBy, 
  limit as firestoreLimit, 
  where as firestoreWhere, 
  getDocs as firestoreGetDocs, 
  getDoc as firestoreGetDoc, 
  onSnapshot as firestoreOnSnapshot, 
  addDoc as firestoreAddDoc, 
  updateDoc as firestoreUpdateDoc, 
  deleteDoc as firestoreDeleteDoc,
  serverTimestamp as firestoreServerTimestamp,
  getDocFromServer
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase SDK
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId || 'ai-studio-propflow-e7772a74-4cce-4f55-8de0-069d13286eb6');
export const auth = getAuth(app);

// Secure rules error diagnostic throwing as required by instructions
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Connection check verification on boot
async function testConnection() {
  try {
    await getDocFromServer(firestoreDoc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
void testConnection();

// Compatibility adapters to seamlessly translate the legacy query format to Firestore
type Constraint = { type: 'orderBy' | 'limit' | 'where'; field?: string; direction?: 'asc' | 'desc'; value?: unknown };
type QueryRef = { collection: string; constraints?: Constraint[] };

export const collection = (_db: unknown, name: string) => ({ collection: name });
export const doc = (_db: unknown, name: string, id: string) => ({ collection: name, id });
export const query = (ref: any, ...constraints: Constraint[]) => ({ ...ref, constraints });
export const orderBy = (field: string, direction: 'asc' | 'desc' = 'asc'): Constraint => ({ type: 'orderBy', field, direction });
export const limit = (value: number): Constraint => ({ type: 'limit', value });
export const where = (field: string, _operator: '==' = '==', value?: unknown): Constraint => ({ type: 'where', field, value });
export const serverTimestamp = () => firestoreServerTimestamp();

const buildFirestoreQuery = (ref: QueryRef) => {
  const colRef = firestoreCollection(db, ref.collection);
  const queryConstraints: any[] = [];
  for (const c of ref.constraints || []) {
    if (c.type === 'orderBy' && c.field) {
      queryConstraints.push(firestoreOrderBy(c.field, c.direction || 'asc'));
    }
    if (c.type === 'limit' && c.value != null) {
      queryConstraints.push(firestoreLimit(Number(c.value)));
    }
    if (c.type === 'where' && c.field) {
      queryConstraints.push(firestoreWhere(c.field, '==', c.value));
    }
  }
  return firestoreQuery(colRef, ...queryConstraints);
};

export const getDocs = async (ref: QueryRef) => {
  try {
    const q = buildFirestoreQuery(ref);
    const snapshot = await firestoreGetDocs(q);
    const docs = snapshot.docs.map(d => ({ id: d.id, data: () => d.data() }));
    return {
      docs,
      metadata: { hasPendingWrites: snapshot.metadata.hasPendingWrites },
      forEach: (callback: any) => docs.forEach(callback)
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, ref.collection);
  }
};

export const onSnapshot = (
  ref: QueryRef,
  optionsOrCallback: any,
  callbackOrOnError?: any,
  onError?: (error: Error) => void
) => {
  const callback = typeof optionsOrCallback === 'function' ? optionsOrCallback : callbackOrOnError;
  const errHandler = typeof optionsOrCallback === 'function' ? callbackOrOnError : onError;

  try {
    const q = buildFirestoreQuery(ref);
    return firestoreOnSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, data: () => d.data() }));
      const snap = {
        docs,
        metadata: { hasPendingWrites: snapshot.metadata.hasPendingWrites },
        forEach: (cb: any) => docs.forEach(cb)
      };
      if (callback) callback(snap);
    }, (error) => {
      if (errHandler) {
        errHandler(error);
      } else {
        handleFirestoreError(error, OperationType.GET, ref.collection);
      }
    });
  } catch (error) {
    if (errHandler) {
      errHandler(error as Error);
    } else {
      handleFirestoreError(error, OperationType.GET, ref.collection);
    }
    return () => {};
  }
};

export const addDoc = async (ref: { collection: string }, data: Record<string, any>) => {
  try {
    const colRef = firestoreCollection(db, ref.collection);
    return await firestoreAddDoc(colRef, {
      ...data,
      createdAt: data.createdAt || firestoreServerTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, ref.collection);
  }
};

export const updateDoc = async (ref: { collection: string; id: string }, data: Record<string, any>) => {
  try {
    const docRef = firestoreDoc(db, ref.collection, ref.id);
    await firestoreUpdateDoc(docRef, {
      ...data,
      updatedAt: firestoreServerTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${ref.collection}/${ref.id}`);
  }
};

export const deleteDoc = async (ref: { collection: string; id: string }) => {
  try {
    const docRef = firestoreDoc(db, ref.collection, ref.id);
    await firestoreDeleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${ref.collection}/${ref.id}`);
  }
};

export const getDoc = async (ref: { collection: string; id: string }) => {
  try {
    const docRef = firestoreDoc(db, ref.collection, ref.id);
    const docSnap = await firestoreGetDoc(docRef);
    return {
      exists: () => docSnap.exists(),
      id: docSnap.id,
      data: () => docSnap.data() || {}
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `${ref.collection}/${ref.id}`);
  }
};

export const getAccessToken = async () => null;
export const googleSignIn = async (): Promise<{ user: any; accessToken: string } | null> => {
  throw new Error('Google Workspace OAuth is not configured in this application.');
};
