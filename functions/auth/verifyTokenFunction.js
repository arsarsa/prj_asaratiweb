// functions/auth/verifyTokenFunction.js
// Backend - verifica token Firebase ID

import * as functions from 'firebase-functions';
import { auth } from '../firebaseAdmin.js';

export const verifyTokenFunction = functions
  .region('europe-west1')
  .https.onCall(async (data, context) => {
    const { idToken } = data;

    if (!idToken || typeof idToken !== 'string') {
      functions.logger.warn('Token ID non fornito o non valido');
      throw new functions.https.HttpsError(
        'invalid-argument',
        'ID token mancante o non valido'
      );
    }

    try {
      const decodedToken = await auth.verifyIdToken(idToken);
      return { uid: decodedToken.uid, email: decodedToken.email || null };
    } catch (error) {
      functions.logger.error('Errore verifica token:', error);
      throw new functions.https.HttpsError('unauthenticated', 'Token non valido');
    }
  });
