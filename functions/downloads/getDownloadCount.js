// functions/downloads/getDownloadCount.js
// Backend

import * as functions from "firebase-functions";
import admin from "../utils/firebaseAdmin.js";

// Funzione callable per ottenere il numero totale di download
export const getDownloadCount = functions
  .region("europe-west1")
  .https.onCall(async (data, context) => {
    console.log("📌 Richiesta ricevuta per getDownloadCount:", data);

    try {
      const { ebookId } = data;

      if (!ebookId) {
        console.error("❌ Errore: ebookId non fornito!");
        throw new functions.https.HttpsError(
          "invalid-argument",
          "Identificativo dell'ebook mancante."
        );
      }

      const ebookRef = admin.firestore().collection("ebooks").doc(ebookId);
      const ebookDoc = await ebookRef.get();

      if (!ebookDoc.exists) {
        console.error(`❌ Ebook con ID ${ebookId} non trovato.`);
        throw new functions.https.HttpsError("not-found", "Ebook non trovato.");
      }

      const ebookData = ebookDoc.data();
      let currentCount = ebookData.downloadCount ?? 0;

      if (typeof currentCount !== "number") {
        console.error(`❌ Il campo 'downloadCount' non è un numero.`);
        throw new functions.https.HttpsError(
          "data-loss",
          "Campo 'downloadCount' non valido nei dati dell'ebook."
        );
      }

      console.log(`✅ Download count per l'ebook ${ebookId}: ${currentCount}`);
      return {
        success: true,
        message: `Questo ebook è stato già scaricato ${currentCount} volte.`,
        downloadCount: currentCount,
      };

    } catch (error) {
      console.error("❌ Errore nel recupero del download count:", error);

      if (error instanceof functions.https.HttpsError) {
        throw error;
      }

      throw new functions.https.HttpsError(
        "internal",
        "Errore nel recupero del download count."
      );
    }
  });
