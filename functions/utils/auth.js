// functions/utils/auth.js
// Backend - Verifica del token ricevuto dal client

import { getAuth } from 'firebase-admin/auth';

// Verifica un ID token (che proviene dal frontend)
export async function verifyIdToken(idToken) {
    try {
        const decodedToken = await getAuth().verifyIdToken(idToken);
        console.log('✅ Token verificato:', decodedToken.uid);
        return decodedToken;
    } catch (error) {
        console.error('❌ Errore nella verifica del token:', error);
        return null;
    }
}
