// scripts/addAudioBook.js

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAWPbTgRnXVJYLjbP-A6KKa82_KTDp2uoE",
  authDomain: "asarati-9aafe.firebaseapp.com",
  projectId: "asarati-9aafe",
  storageBucket: "asarati-9aafe.firebasestorage.app",
  messagingSenderId: "574370087223",
  appId: "1:574370087223:web:16a2d0a87a31f0a1925ab2"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function addAudioBook() {
  try {
    await setDoc(doc(db, 'products', 'audiobook01'), {
      name: 'AudioBook Principale',
      fileName: 'audiofile.zip',
      storageFileName: 'audiofile.zip',
      storagePath: 'protected_file/audioBook',  // ← DIVERSO PATH
      counters: { 
        downloads: 0, 
        total: 0 
      },
      createdAt: new Date()
    });
    console.log('✅ audiobook01 AGGIUNTO!');
  } catch (error) {
    console.error('❌ ERRORE:', error);
  }
}

addAudioBook();
