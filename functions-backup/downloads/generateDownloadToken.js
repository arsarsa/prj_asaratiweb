// functions/download/generateDownloadToken.js
// Backend

import * as functions from "firebase-functions";
import admin from "../utils/firebaseAdmin.js";

const db = admin.firestore();
const storage = admin.storage();

exports.generateDownloadToken = functions
  .region("europe-west1")
  .https.onCall(async (data, context) => {
    const { productType, filename, orderId } = data;

    if (!productType || !filename || !orderId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Dati mancanti: productType, filename o orderId sono richiesti."
      );
    }

    // Costruisce il path verso il file protetto
    const filePath = `protected_files/${productType}/${filename}`;

    try {
      // Verifica quanti download sono già stati fatti
      const docRef = db.collection("downloads").doc(orderId);
      const doc = await docRef.get();
      const currentCount = doc.exists ? doc.data().count || 0 : 0;

      if (currentCount >= 3) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "Limite di download raggiunto."
        );
      }

      // Aggiorna il contatore
      await docRef.set({ count: currentCount + 1 }, { merge: true });

      // Crea URL temporaneo (2 minuti)
      const [url] = await storage
        .bucket()
        .file(filePath)
        .getSignedUrl({
          action: "read",
          expires: Date.now() + 2 * 60 * 1000,
        });

      return { url };
    } catch (error) {
      console.error("❌ Errore nella generazione del token:", error);
      throw new functions.https.HttpsError(
        "internal",
        "Errore durante la generazione del token di download."
      );
    }
  });
