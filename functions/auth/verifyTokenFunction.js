// functions/auth/verifyTokenFunction.js
// Backend

import * as functions from "firebase-functions";
import admin from "../utils/firebaseAdmin.js";

export const verifyTokenFunction = functions
  .region("europe-west1")
  .https.onCall(async (data, context) => {
    const { idToken } = data;

    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      return { uid: decodedToken.uid, email: decodedToken.email || null };
    } catch (error) {
      console.error("Errore verifica token:", error);
      throw new functions.https.HttpsError("unauthenticated", "Token non valido");
    }
  });
