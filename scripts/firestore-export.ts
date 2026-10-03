/**
 * Read-only Firestore export.
 *
 * Writes every document in every collection (including subcollections) of the app's
 * named Firestore database to ./_exports/firestore-<timestamp>.json.
 *
 * Read-only by construction: this file only calls listCollections(), listDocuments()
 * and getAll(). It never calls set/add/update/delete/batch/transaction/recursiveDelete.
 *
 * Usage:
 *   npx tsx scripts/firestore-export.ts
 *
 * Credentials: Application Default Credentials, i.e. either
 *   - GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json, or
 *   - `gcloud auth application-default login`
 * The Admin SDK bypasses Firestore security rules, so access is governed by IAM.
 * Use an identity that only has a read role (e.g. roles/datastore.viewer).
 *
 * Optional environment overrides:
 *   FIREBASE_PROJECT_ID       defaults to projectId in firebase-applet-config.json
 *   FIRESTORE_DATABASE_ID     defaults to firestoreDatabaseId in firebase-applet-config.json
 *
 * The export contains personal data (emails, names, tenant details). The output
 * directory is git-ignored and the script refuses to run if it is not.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import {
  getFirestore,
  Timestamp,
  GeoPoint,
  DocumentReference,
  type CollectionReference,
  type Firestore,
} from 'firebase-admin/firestore';

const EXPORT_DIR = path.resolve(process.cwd(), '_exports');
const GET_ALL_CHUNK = 300;

const config = JSON.parse(
  fs.readFileSync(new URL('../firebase-applet-config.json', import.meta.url), 'utf8'),
) as { projectId?: string; firestoreDatabaseId?: string };

const projectId = process.env.FIREBASE_PROJECT_ID || config.projectId;
const databaseId = process.env.FIRESTORE_DATABASE_ID || config.firestoreDatabaseId;

if (!projectId || !databaseId) {
  console.error('Missing project or database id (firebase-applet-config.json, or FIREBASE_PROJECT_ID / FIRESTORE_DATABASE_ID).');
  process.exit(1);
}

// Refuse to write personal data anywhere git could pick it up.
const assertExportDirIgnored = () => {
  fs.mkdirSync(EXPORT_DIR, { recursive: true, mode: 0o700 });
  try {
    execFileSync('git', ['check-ignore', '-q', EXPORT_DIR], { stdio: 'ignore' });
  } catch {
    console.error(`Refusing to export: ${EXPORT_DIR} is not git-ignored. Add "_exports/" to .gitignore first.`);
    process.exit(1);
  }
};

// Firestore value types that plain JSON cannot represent are tagged so the export is lossless.
const serialize = (value: unknown): unknown => {
  if (value === null || value === undefined) return value ?? null;
  if (value instanceof Timestamp) return { __type: 'timestamp', value: value.toDate().toISOString(), seconds: value.seconds, nanoseconds: value.nanoseconds };
  if (value instanceof GeoPoint) return { __type: 'geopoint', latitude: value.latitude, longitude: value.longitude };
  if (value instanceof DocumentReference) return { __type: 'reference', path: value.path };
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) return { __type: 'bytes', base64: Buffer.from(value).toString('base64') };
  if (typeof value === 'number' && !Number.isFinite(value)) return { __type: 'number', value: String(value) };
  if (Array.isArray(value)) return value.map(serialize);
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, serialize(v)]));
  }
  return value;
};

type ExportedDoc = { id: string; exists: boolean; data: unknown; subcollections?: Record<string, ExportedDoc[]> };

const exportCollection = async (col: CollectionReference, counts: Record<string, number>): Promise<ExportedDoc[]> => {
  // listDocuments() also returns "missing" docs that have no fields but still have subcollections.
  const refs = await col.listDocuments();
  const out: ExportedDoc[] = [];
  const db = col.firestore;

  for (let i = 0; i < refs.length; i += GET_ALL_CHUNK) {
    const chunk = refs.slice(i, i + GET_ALL_CHUNK);
    const snaps = await db.getAll(...chunk);
    for (const snap of snaps) {
      const subs = await snap.ref.listCollections();
      const entry: ExportedDoc = {
        id: snap.id,
        exists: snap.exists,
        data: snap.exists ? serialize(snap.data()) : null,
      };
      if (subs.length) {
        entry.subcollections = {};
        for (const sub of subs) entry.subcollections[sub.id] = await exportCollection(sub, counts);
      }
      // Skip phantom parents with no data and no subcollections (nothing to preserve).
      if (snap.exists || subs.length) {
        out.push(entry);
        counts[col.path] = (counts[col.path] || 0) + (snap.exists ? 1 : 0);
      }
    }
  }
  counts[col.path] = counts[col.path] || 0;
  return out;
};

const main = async () => {
  assertExportDirIgnored();

  const app = initializeApp({ credential: applicationDefault(), projectId });
  const db: Firestore = getFirestore(app, databaseId);

  console.log(`Exporting project=${projectId} database=${databaseId} (read-only)`);
  const counts: Record<string, number> = {};
  const collections: Record<string, ExportedDoc[]> = {};
  for (const col of await db.listCollections()) {
    collections[col.id] = await exportCollection(col, counts);
    console.log(`  ${col.id}: ${counts[col.id]} documents`);
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(EXPORT_DIR, `firestore-${stamp}.json`);
  const payload = {
    meta: { projectId, databaseId, exportedAt: new Date().toISOString(), documentCounts: counts },
    collections,
  };
  fs.writeFileSync(file, JSON.stringify(payload, null, 2), { mode: 0o600 });
  console.log(`Wrote ${file}`);
};

main().catch((error) => {
  console.error('Export failed:', error?.message || error);
  process.exit(1);
});
