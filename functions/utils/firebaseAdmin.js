// functions/utils/firebaseAdmin.js
// Backend - Inizializzazione centralizzata

import admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const auth = admin.auth();
const storage = admin.storage();

export { db, auth, storage };
