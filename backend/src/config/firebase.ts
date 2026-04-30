import * as admin from 'firebase-admin';

let app: admin.app.App | null = null;
let initAttempted = false;

export function getFirebaseApp(): admin.app.App | null {
  if (initAttempted) return app;
  initAttempted = true;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    console.warn('[push] FIREBASE_SERVICE_ACCOUNT_JSON not set — push sends disabled');
    return null;
  }

  try {
    const serviceAccount = JSON.parse(raw);
    app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    return app;
  } catch (err) {
    console.error('[push] failed to init firebase-admin:', err);
    return null;
  }
}
