// uploadfile/scripts/firebase-config.js
// Backend

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.19.1/firebase-app.js";

const firebaseConfig = {
      apiKey: "AIzaSyDrMHULANbTosaXlthzXOReBm2Dp5B-6F8",
      authDomain: "asarati-27c0d.firebaseapp.com",
      databaseURL: "https://asarati-27c0d-default-rtdb.europe-west1.firebasedatabase.app",
      projectId: "asarati-27c0d",
      storageBucket: "asarati-27c0d.appspot.com",
      messagingSenderId: "365615545063",
      appId: "1:365615545063:web:df5c14dc00672ea6370042",
      measurementId: "G-CPZH0JMD7F"
};

// 🔹 Inizializza Firebase
const app = initializeApp(firebaseConfig);

// 🔹 Esporta l'app inizializzata
export { app };
