// scripts/setupProducts.js

import { initializeApp } from 'firebase/app';
import { getFirestore, writeBatch, doc } from 'firebase/firestore';

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

const products = [{
  id: 'ebook01',
  name: 'eBook Titolo',
  fileName: 'file.zip',           // Nome VISIBILE
  storageFileName: 'file.zip'     // Nome REALE in Storage
}];

async function setup() {
  try {
    console.log('🔥 Tentativo scrittura...');
    const batch = writeBatch(db);
    const ref = doc(db, 'products', 'ebook01');
    
    batch.set(ref, {
      name: products[0].name,
      fileName: products[0].fileName,
      storagePath: 'protected_file/eBook',
      counters: { downloads: 0, total: 0 },
      createdAt: new Date()
    });
    
    await batch.commit();
    console.log('✅ ebook01 CREATO in Firestore!');
  } catch (error) {
    console.error('❌ ERRORE:', error.code, error.message);
  }
}

setup();
