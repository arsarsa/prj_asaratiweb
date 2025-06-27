// functions/utils/firebaseAdmin.js
// Backend - Inizializzazione centralizzata

import admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp();
}

export default admin;
