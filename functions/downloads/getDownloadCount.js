// functions/downloads/getDownloadCount.js
// Backend

import * as functions from 'firebase-functions';
import { db } from '../firebaseAdmin.js';

export const getDownloadCount = functions
  .region('europe-west1')
  .https.onCall(async (data, context) => {
    functions.logger.info('Richiesta getDownloadCount:', data);

    const { ebookId } = data;

    if (!ebookId) {
      functions.logger.error('ebookId non fornito');
      throw new functions.https.HttpsError('invalid-argument', "Identificativo dell'ebook mancante.");
    }

    const ebookRef = db.collection('ebooks').doc(ebookId);
    const ebookDoc = await ebookRef.get();

    if (!ebookDoc.exists) {
      functions.logger.error(`Ebook con ID ${ebookId} non trovato.`);
      throw new functions.https.HttpsError('not-found', 'Ebook non trovato.');
    }

    const ebookData = ebookDoc.data();
    const currentCount = ebookData.downloadCount ?? 0;

    if (typeof currentCount !== 'number') {
      functions.logger.error(`Campo 'downloadCount' non numerico.`);
      throw new functions.https.HttpsError('data-loss', "Campo 'downloadCount' non valido nei dati dell'ebook.");
    }

    functions.logger.info(`Download count per ebook ${ebookId}: ${currentCount}`);

    return {
      success: true,
      message: `Questo ebook è stato già scaricato ${currentCount} volte.`,
      downloadCount: currentCount,
    };
  });
