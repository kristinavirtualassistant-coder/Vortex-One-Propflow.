# Vortex One PropFlow — Firebase deployment

Vortex One PropFlow is no longer configured for Vercel deployment. Firebase Hosting is the web hosting target, with Firebase Functions reserved for the server API runtime.

Create a Firebase project and set its project ID in .firebaserc. Do not commit service-account credentials.

The application continues to use PostgreSQL/Supabase for persistent application data. Firebase replaces the deployment/runtime integration, not PostgreSQL.
