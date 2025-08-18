// functions/utils/auth.js
// Backend - Verifica del token ricevuto dal client

import * as functions from 'firebase-functions';
import { getAuth } from 'firebase-admin/auth';

/**
 * Verifica il token ID Firebase dell'utente.
 * @param {string} idToken 
 * @returns {Promise<object>} - decoded token con UID e claims
 * @throws {functions.https.HttpsError} se token non valido o errore verifica
 */
export async function verifyIdToken(idToken) {
  if (typeof idToken !== 'string' || !idToken.trim()) {
    functions.logger.warn('Token ID mancante o non valido');
    throw new functions.https.HttpsError('unauthenticated', 'Token ID mancante o non valido');
  }

  try {
    const decoded = await getAuth().verifyIdToken(idToken);
    functions.logger.info('✅ Token verificato', { uid: decoded.uid });
    return decoded;
  } catch (error) {
    functions.logger.error('❌ Errore verifica token', error);
    throw new functions.https.HttpsError('unauthenticated', 'Token ID non valido o scaduto');
  }
}
