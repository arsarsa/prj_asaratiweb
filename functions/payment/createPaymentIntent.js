// functions/payment/createPaymentIntent.js

import * as functions from "firebase-functions";
import Stripe from "stripe";
import { firestore } from "../firebaseAdmin.js";
import { 
  validateIdOrThrow, 
  validateEmailOrThrow, 
  logInfo, 
  logError, 
  throwHttpsError 
} from "../utils/common.js";

// Inizializzazione Stripe (chiave segreta da env o Firebase config)
const stripeSecret = process.env.STRIPE_SECRET || functions.config().stripe?.secret;

if (!stripeSecret) {
  throw new Error("Chiave Stripe segreta mancante. Configura STRIPE_SECRET.");
}

// Usa versione API Stripe aggiornata
const stripe = new Stripe(stripeSecret, { apiVersion: "2025-04-30.basil" });

/**
 * Callable HTTPS Cloud Function per creare un PaymentIntent Stripe.
 * Riceve dati da frontend per il prodotto acquistato e l'email ricevuta.
 */
export const createPaymentIntent = functions
  .region("europe-west1") // adegua in base alla region preferita
  .https.onCall(async (data, context) => {
    logInfo("📌 Richiesta createPaymentIntent ricevuta", { data });

    try {
      // Estrai e valida parametri
      const { productId, receiptEmail, currency = "eur", metadata = {} } = data;

      validateIdOrThrow(productId);
      validateEmailOrThrow(receiptEmail);

      // Recupero dati prodotto da Firestore
      const productRef = firestore.collection("products").doc(productId);
      const productSnap = await productRef.get();

      if (!productSnap.exists) {
        throwHttpsError("not-found", "Prodotto non trovato.");
      }

      const productData = productSnap.data();
      const { price, title, type } = productData;

      if (typeof price !== "number" || price <= 0) {
        throwHttpsError("invalid-argument", "Prezzo non valido nel prodotto.");
      }

      // Crea PaymentIntent su Stripe
      let paymentIntent;
      try {
        paymentIntent = await stripe.paymentIntents.create({
          amount: price,
          currency,
          receipt_email: receiptEmail,
          meta {
            ...metadata,
            productId,
            title,
            type,
          },
          automatic_payment_methods: { enabled: true },
        });
      } catch (err) {
        logError("Errore durante creazione PaymentIntent Stripe", err);
        throwHttpsError("internal", "Errore creazione PaymentIntent Stripe.");
      }

      // Salva la transazione su Firestore
      const transactionRef = firestore.collection("transactions").doc();
      const transactionId = transactionRef.id;
      const timestamp = Date.now();

      const transactionData = {
        email: receiptEmail,
        productId,
        productTitle: title,
        productType: type,
        amount: price,
        currency,
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
        status: "created",
        timestamp,
      };

      await transactionRef.set(transactionData);

      logInfo("✅ PaymentIntent e transazione salvati con successo", {
        paymentIntentId: paymentIntent.id,
        transactionId,
      });

      // Risposta al frontend
      return {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        transactionId,
      };

    } catch (error) {
      logError("❌ Errore in createPaymentIntent callable", error);

      if (error instanceof functions.https.HttpsError) {
        throw error; // Rilancia gli errori formattati
      }

      // Errore generico
      throw new functions.https.HttpsError(
        "internal",
        "Errore interno durante la creazione del pagamento.",
        error.message || error.toString()
      );
    }
  });
