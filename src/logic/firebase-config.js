// src/firebase-config.js
// Backend

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFunctions as _getFunctions } from "firebase/functions";
import { getStorage as _getStorage, connectStorageEmulator } from "firebase/storage";

const firebaseConfig = {
  apiKey: "REMOVED_API_KEY",
  authDomain: "asarati-27c0d.firebaseapp.com",
  databaseURL: "https://asarati-27c0d-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "asarati-27c0d",
  storageBucket: "asarati-27c0d.appspot.com",
  messagingSenderId: "365615545063",
  appId: "1:365615545063:web:df5c14dc00672ea6370042",
  measurementId: "G-CPZH0JMD7F"
};

// ✅ Inizializza app
const app = initializeApp(firebaseConfig);

// ✅ Autenticazione
const auth = getAuth(app);

// ✅ Callable Functions
const functions = _getFunctions(app, 'europe-west1');

// ✅ Storage configurabile
function getStorage(useEmulator = false) {
  const storage = _getStorage(app);
  if (useEmulator) {
    connectStorageEmulator(storage, 'localhost', 9199);
    console.log("🧪 Connesso a Firebase Storage Emulator");
  }
  return storage;
}

// ✅ Esportazioni
export { app, auth, functions, getStorage };

// ✅ Export default per chi ha bisogno del config puro
export default firebaseConfig;
