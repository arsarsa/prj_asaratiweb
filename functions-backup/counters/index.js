// functions/counters/index.js
// Backend

import * as functions from 'firebase-functions';
import admin from './utils/firebaseAdmin.js';
import { FieldValue } from 'firebase-admin/firestore';

// 🔁 Funzione condivisa
async function handleDownloadUpdate(req, res, collectionName) {
  if (req.method !== 'POST') {
    return res.status(405).send('Metodo non consentito. Usa POST.');
  }

  const { ebookId, userId = null } = req.body;

  if (!ebookId) {
    return res.status(400).send({ success: false, error: "ebookId mancante." });
  }

  try {
    const docRef = admin.firestore().collection(collectionName).doc(ebookId);
    const updateData = {
      downloadCount: FieldValue.increment(1),
      lastDownload: FieldValue.serverTimestamp(),
    };

    if (userId) {
      updateData.users = FieldValue.arrayUnion(userId);
    }

    await docRef.set(updateData, { merge: true });

    const updatedDoc = await docRef.get();
    const newCount = updatedDoc.data()?.downloadCount || 0;

    return res.status(200).send({ success: true, newCount });
  } catch (error) {
    console.error(`❌ Errore aggiornamento [${collectionName}]:`, error);
    return res.status(500).send({ success: false, error: error.message });
  }
}

// ✅ Endpoint pubblico per ebook
export const updateEbookDownload = functions.region('europe-west1').https.onRequest((req, res) => {
  return handleDownloadUpdate(req, res, 'downloads_ebook');
});

// ✅ Endpoint pubblico per audiobook
export const updateAudioDownload = functions.region('europe-west1').https.onRequest((req, res) => {
  return handleDownloadUpdate(req, res, 'downloads_audio');
});

// ✅ Endpoint pubblico per boxbook (.zip)
export const updateBoxDownload = functions.region('europe-west1').https.onRequest((req, res) => {
  return handleDownloadUpdate(req, res, 'downloads_box');
});
