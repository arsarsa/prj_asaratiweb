// functions/updateDownloadCount.js
// Backend

import * as functions from "firebase-functions";
import admin from "./utils/firebaseAdmin.js";

export const updateDownloadCount = functions
  .region("europe-west1")
  .https.onCall(async (data, context) => {
    const { productId } = data;

    if (!productId)
      throw new functions.https.HttpsError("invalid-argument", "ID prodotto mancante");

    const ref = admin.firestore().collection("downloads").doc(productId);

    try {
      await ref.set({ count: admin.firestore.FieldValue.increment(1) }, { merge: true });
      return { success: true };
    } catch (error) {
      console.error("Errore aggiornamento conteggio:", error);
      throw new functions.https.HttpsError("internal", "Errore Firestore");
    }
  });
