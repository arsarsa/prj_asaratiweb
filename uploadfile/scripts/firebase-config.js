// uploadfile/scripts/firebase-config.js
// Backend

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.19.1/firebase-app.js";

const firebaseConfig = {
      apiKey: "AIzaSyAWPbTgRnXVJYLjbP-A6KKa82_KTDp2uoE",
      authDomain: "asarati-9aafe.firebaseapp.com",
      databaseURL: "https://asarati-9aafe-default-rtdb.europe-west1.firebasedatabase.app",
      projectId: "asarati-9aafe",
      storageBucket: "asarati-9aafe.firebasestorage.app",
      messagingSenderId: "574370087223",
      appId: "1:574370087223:web:16a2d0a87a31f0a1925ab2",
      measurementId: "G-SXC1Z7B2N0"
};

// 🔹 Inizializza Firebase
const app = initializeApp(firebaseConfig);

// 🔹 Esporta l'app inizializzata
export { app };
