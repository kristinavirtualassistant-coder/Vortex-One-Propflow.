import fs from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'app_data.json');

export interface LocalData {
  users: any[];
  sessions: any[];
  app_records: any[];
  financial_metrics: any[];
}

const loadData = (): LocalData => {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      const defaultData: LocalData = {
        users: [],
        sessions: [],
        app_records: [],
        financial_metrics: [
          { id: 1, month: 'Jan', revenue: 45000, occupancyRate: 92 },
          { id: 2, month: 'Feb', revenue: 48000, occupancyRate: 94 },
          { id: 3, month: 'Mar', revenue: 52000, occupancyRate: 95 },
          { id: 4, month: 'Apr', revenue: 51000, occupancyRate: 93 },
          { id: 5, month: 'May', revenue: 56000, occupancyRate: 96 }
        ]
      };
      fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2));
      return defaultData;
    }
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return { users: [], sessions: [], app_records: [], financial_metrics: [] };
  }
};

const saveData = (data: LocalData) => {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Failed to write to local persistent storage:", err);
  }
};

export const localDb = {
  getUsers: () => loadData().users,
  saveUser: (user: any) => {
    const data = loadData();
    data.users.push(user);
    saveData(data);
    return user;
  },
  updateUser: (uid: string, fields: any) => {
    const data = loadData();
    const idx = data.users.findIndex(u => u.uid === uid);
    if (idx !== -1) {
      data.users[idx] = { ...data.users[idx], ...fields };
      saveData(data);
      return data.users[idx];
    }
    return null;
  },
  getSessions: () => loadData().sessions,
  saveSession: (session: any) => {
    const data = loadData();
    data.sessions.push(session);
    saveData(data);
    return session;
  },
  deleteSession: (id: string) => {
    const data = loadData();
    data.sessions = data.sessions.filter(s => s.id !== id);
    saveData(data);
  },
  getRecords: (collection: string, ownerUid: string) => {
    return loadData().app_records.filter(r => r.collection === collection && r.owner_uid === ownerUid);
  },
  addRecord: (collection: string, ownerUid: string, data: any) => {
    const localData = loadData();
    const id = Math.random().toString(36).substring(7);
    const newRecord = { id, owner_uid: ownerUid, collection, data, created_at: new Date().toISOString() };
    localData.app_records.push(newRecord);
    saveData(localData);
    return newRecord;
  },
  updateRecord: (id: string, collection: string, ownerUid: string, data: any) => {
    const localData = loadData();
    const idx = localData.app_records.findIndex(r => r.id === id && r.owner_uid === ownerUid && r.collection === collection);
    if (idx !== -1) {
      localData.app_records[idx].data = { ...localData.app_records[idx].data, ...data };
      saveData(localData);
      return localData.app_records[idx];
    }
    return null;
  },
  deleteRecord: (id: string, collection: string, ownerUid: string) => {
    const localData = loadData();
    localData.app_records = localData.app_records.filter(r => !(r.id === id && r.owner_uid === ownerUid && r.collection === collection));
    saveData(localData);
  },
  getMetrics: () => loadData().financial_metrics
};
