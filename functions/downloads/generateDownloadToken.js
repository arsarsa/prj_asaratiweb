// functions/download/generateDownloadToken.js
// Backend

import * as functions from "firebase-functions";
import admin from "../utils/firebaseAdmin.js";

const db = admin.firestore();
const storage = admin.storage();

const MAX_DOWNLOADS = 3;
const SIGNED_URL_DURATION_MINUTES = 10;

export const generateDownloadToken = functions
  .region("europe-west1")
  .https.onCall(async (data, context) => {
    const { productType, filename, orderId } = data;

    if (!productType || !filename || !orderId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Parametri richiesti: productType, filename, orderId."
      );
    }

    const filePath = `protected_files/${productType}/${filename}`;

    try {
      const docRef = db.collection("downloads").doc(orderId);
      const docSnap = await docRef.get();

      const currentCount = docSnap.exists ? docSnap.data().count || 0 : 0;

      // 🔐 Verifica limite di download
      if (currentCount >= MAX_DOWNLOADS) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "Hai raggiunto il limite massimo di download."
        );
      }

      // 📊 Registra il nuovo tentativo
      await docRef.set(
        {
          count: currentCount + 1,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        },
        { merge: true }
      );

      // 📦 Crea signed URL valido per 10 minuti
      const [signedUrl] = await storage
        .bucket()
        .file(filePath)
        .getSignedUrl({
          action: "read",
          expires: Date.now() + SIGNED_URL_DURATION_MINUTES * 60 * 1000
        });

      return { url: signedUrl };

    } catch (err) {
      console.error("❌ Errore generateDownloadToken:", err);

      throw new functions.https.HttpsError(
        "internal",
        "Errore nella generazione del link protetto."
      );
    }
  });
