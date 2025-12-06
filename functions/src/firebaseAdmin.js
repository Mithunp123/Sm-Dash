import admin from 'firebase-admin';

if (admin.apps.length === 0) {
  admin.initializeApp();
}

export const firestore = admin.firestore();
export const storage = admin.storage();
export const auth = admin.auth();

