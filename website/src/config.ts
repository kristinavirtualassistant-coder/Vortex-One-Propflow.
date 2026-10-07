/** Public URL of the Vortex One application (sign in, create account, live demo). */
export const APP_URL: string = (
  import.meta.env.VITE_APP_URL ?? 'https://vortexone-propflow.vercel.app'
).replace(/\/+$/, '');

export const LEGAL_ENTITY = 'The Remote Account Managers';
export const CONTACT_EMAIL = 'info@remoteaccountmanagers.online';
export const PRIVACY_CONTACT_EMAIL = CONTACT_EMAIL;
export const BUSINESS_ADDRESS = '49 Margarita, Bacolod City, Philippines';
export const YEAR = 2026;
export const LEGAL_UPDATED = 'October 7, 2026';
