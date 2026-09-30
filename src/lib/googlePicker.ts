import { getAuth, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { initializeApp, getApps, getApp } from 'firebase/app';
import firebaseConfig from '../../firebase-applet-config.json';

// Ensure Firebase is initialized
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);

let cachedAccessToken: string | null = null;

export const getGoogleAccessToken = async (): Promise<string> => {
  if (cachedAccessToken) return cachedAccessToken;

  const provider = new GoogleAuthProvider();
  provider.addScope('https://www.googleapis.com/auth/drive.file');
  provider.addScope('https://www.googleapis.com/auth/drive.metadata.readonly');

  const result = await signInWithPopup(auth, provider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  if (!credential?.accessToken) {
    throw new Error('Failed to obtain Google access token');
  }

  cachedAccessToken = credential.accessToken;
  return cachedAccessToken;
};

// Define Picker origin helper as described in references/picker.md
const getPickerOrigin = () => {
  return window.location.ancestorOrigins && window.location.ancestorOrigins.length > 0
    ? window.location.ancestorOrigins[window.location.ancestorOrigins.length - 1]
    : window.location.origin;
};

// Types for window.google
declare global {
  interface Window {
    google: any;
    gapi: any;
  }
}

export const loadGooglePickerScript = (): Promise<void> => {
  return new Promise((resolve) => {
    if (window.google?.picker) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.onload = () => {
      window.gapi.load('client:picker', () => {
        resolve();
      });
    };
    document.body.appendChild(script);
  });
};

export interface PickerDoc {
  id: string;
  name: string;
  url: string;
  sizeBytes: number;
  mimeType: string;
}

export const openGooglePicker = async (onPicked: (docs: PickerDoc[]) => void): Promise<void> => {
  await loadGooglePickerScript();
  const token = await getGoogleAccessToken();

  const picker = new window.google.picker.PickerBuilder()
    .addView(window.google.picker.ViewId.DOCS)
    .setOAuthToken(token)
    .setCallback((data: any) => {
      if (data.action === window.google.picker.Action.PICKED) {
        const docs = data.docs.map((d: any) => ({
          id: d.id,
          name: d.name,
          url: d.url,
          sizeBytes: d.sizeBytes || 0,
          mimeType: d.mimeType || 'application/octet-stream',
        }));
        onPicked(docs);
      }
    })
    .setOrigin(getPickerOrigin())
    .build();

  picker.setVisible(true);
};
