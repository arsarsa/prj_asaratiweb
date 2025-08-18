// src/firebase-config.js

// Configurazione Firebase flessibile per frontend
// Usa variabili ambiente per chiavi sensibili e ambienti differenti

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFunctions as _getFunctions } from "firebase/functions";
import { getStorage as _getStorage, connectStorageEmulator } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "default-apiKey",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "default-authDomain.firebaseapp.com",
  databaseURL: process.env.REACT_APP_FIREBASE_DATABASE_URL || "https://default-db-url.firebaseio.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "default-project-id",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "default-bucket.appspot.com",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "default-sender-id",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "default-app-id",
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || "default-measurement-id"
};

// Inizializza app Firebase
const app = initializeApp(firebaseConfig);

// Auth (anche se non serve l’autenticazione utente, tenerlo pronto)
const auth = getAuth(app);

// Cloud Functions con regione configurabile via env
const functionsRegion = process.env.REACT_APP_FIREBASE_FUNCTIONS_REGION || 'europe-west1';
const functions = _getFunctions(app, functionsRegion);

// Storage con supporto per emulator (dev)
function getStorage(useEmulator = false) {
  const storage = _getStorage(app);
  if (useEmulator) {
    connectStorageEmulator(storage, 'localhost', 9199);
    console.log("🧪 Connesso a Firebase Storage Emulator");
  }
  return storage;
}

// Export
export { app, auth, functions, getStorage };
export default firebaseConfig;
