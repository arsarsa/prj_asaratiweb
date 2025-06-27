// functions/payment/createPaymentIntent.js
// Backend (Firebase Cloud Function - Stripe PaymentIntent)

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as functions from "firebase-functions";
import Stripe from "stripe";
import dotenv from "dotenv";

// ✅ Carica .env solo in locale
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

// ✅ Inizializzazione Firebase Admin
initializeApp({
  credential: applicationDefault()
});

const firestore = getFirestore(); // ✅ Ottieni Firestore correttamente

// ✅ Inizializzazione Stripe
// Funziona in locale e in produzione
const stripeSecret =
  process.env.STRIPE_SECRET || functions.config().stripe?.secret;

if (!stripeSecret) throw new Error("Chiave Stripe mancante.");

const stripe = new Stripe(stripeSecret, { apiVersion: "2023-10-16" });

export const createPaymentIntent = functions
  .region("europe-west1")
  .https.onCall(async (data, context) => {
    const { productId, receiptEmail, currency = "eur", metadata = {} } = data;

    // ✅ Validazione parametri
    if (!productId || typeof productId !== "string") {
      throw new functions.https.HttpsError("invalid-argument", "ID del prodotto mancante o non valido.");
    }

    if (!receiptEmail || typeof receiptEmail !== "string") {
      throw new functions.https.HttpsError("invalid-argument", "Email non valida.");
    }

    // ✅ Recupera il prodotto da Firestore
    const productRef = firestore.collection("products").doc(productId);
    const productSnap = await productRef.get();

    if (!productSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Prodotto non trovato.");
    }

    const productData = productSnap.data();
    const { price, title, type } = productData;

    if (typeof price !== "number" || price <= 0) {
      throw new functions.https.HttpsError("invalid-argument", "Prezzo non valido nel prodotto.");
    }

    // ✅ Crea PaymentIntent
    let paymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.create({
        amount: price,
        currency,
        receipt_email: receiptEmail,
        metadata: {
          ...metadata,
          productId,
          title,
          type
        },
        automatic_payment_methods: { enabled: true }
      });
    } catch (err) {
      functions.logger.error("❌ Errore Stripe:", err);
      throw new functions.https.HttpsError("internal", "Errore creazione PaymentIntent.");
    }

    // ✅ Salva la transazione su Firestore
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
      timestamp
    };

    await transactionRef.set(transactionData);

    // ✅ Risposta al frontend
    functions.logger.info("✅ PaymentIntent & transazione salvata", {
      paymentIntentId: paymentIntent.id,
      transactionId
    });

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      transactionId
    };
  });
