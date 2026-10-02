# Vortex One PropFlow — Firebase deployment

> **Note:** Cloud Functions cannot be deployed on the free Spark plan, so the live site currently runs on Vercel (frontend and API). See `docs/VERCEL_DEPLOYMENT.md`. The Firebase setup below applies only if the project is moved to the Blaze plan.

Vortex One PropFlow can be deployed with Firebase Hosting as the web hosting target and Firebase Functions as the server API runtime.

Create a Firebase project and set its project ID in .firebaserc. Do not commit service-account credentials.

The application continues to use PostgreSQL/Supabase for persistent application data. Firebase replaces the deployment/runtime integration, not PostgreSQL.
