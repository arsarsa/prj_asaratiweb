// functions/updateDownloadCount.js
// Backend

import * as functions from 'firebase-functions';
import { db, firestore } from '../firebaseAdmin.js';

export const updateDownloadCount = functions
  .region('europe-west1')
  .https.onCall(async (data, context) => {
    const { ebookId } = data;

    if (!ebookId) {
      functions.logger.error('ID ebook mancante');
      throw new functions.https.HttpsError('invalid-argument', 'ID ebook mancante');
    }

    const ebookRef = db.collection('ebooks').doc(ebookId);

    try {
      await ebookRef.set(
        { downloadCount: firestore.FieldValue.increment(1) },
        { merge: true }
      );
      functions.logger.info(`Conteggio download incrementato per ebook ${ebookId}`);
      return { success: true };
    } catch (error) {
      functions.logger.error('Errore aggiornamento conteggio download:', error);
      throw new functions.https.HttpsError('internal', 'Errore Firestore');
    }
  });
