// src/asset/index.js
// Backend (Firebase Functions, ES6 Module)

import 'dotenv/config';
import * as functions from 'firebase-functions';
import admin from './utils/firebaseAdmin.js';
import Stripe from 'stripe';

// Emulatore?
const IS_EMULATOR = process.env.FUNCTIONS_EMULATOR === "true";
if (IS_EMULATOR) {
  console.warn("⚠️ ATTENZIONE: L'emulatore Firebase è attivo. Stripe non funzionerà in questa modalità.");
}

// Chiave Stripe dal .env o da Firebase config
const stripeSecret =
  process.env.STRIPE_SECRET ||
  (functions.config().stripe && functions.config().stripe.secret);

if (!stripeSecret) {
  console.error('❌ ERRORE: STRIPE_SECRET non è configurata!');
  throw new Error('STRIPE_SECRET mancante. Imposta la chiave su Firebase Config o nel file .env.');
}

// Inizializza Stripe
const stripe = new Stripe(stripeSecret, { apiVersion: '2025-04-30.basil' });

// Firestore
const db = admin.firestore();

// ✅ Export se ti serve usarlo altrove
export { stripe, db };

// createPaymentIntent con salvataggio su Firestore
exports.createPaymentIntent = functions.https.onCall(async (data, context) => {
  console.log("📌 Richiesta ricevuta per createPaymentIntent:", data);

  try {
    // Legge i parametri dal frontend
    const email       = data?.email;
    const amount      = data?.amount;
    const currency    = data?.currency || "eur";
    const fileId      = data?.fileId;
    const paymentType = "stripe";

    // Validazioni
    if (!email || typeof email !== "string" || !email.includes("@")) {
      throw new functions.https.HttpsError("invalid-argument", "Email non valida.");
    }
    if (!fileId || typeof fileId !== "string") {
      throw new functions.https.HttpsError("invalid-argument", "fileId mancante o non valido.");
    }
    if (!amount || isNaN(amount) || amount <= 0) {
      throw new functions.https.HttpsError("invalid-argument", "Importo non valido.");
    }
    if (amount < 50 || amount > 1000000) {
      throw new functions.https.HttpsError("invalid-argument", "Importo deve essere tra €0.50 e €10.000.");
    }

    // 1️⃣ Crea PaymentIntent su Stripe
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      payment_method_types: ["card"],
      receipt_email: email
    });
    console.log("✅ PaymentIntent creato:", paymentIntent.id);

    // 2️⃣ Crea documento transaction in Firestore
    const txRef = db.collection("transactions").doc();
    await txRef.set({
      email,
      fileId,
      amount,
      currency,
      paymentType,
      paymentIntentId: paymentIntent.id,
      status: "pending",
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log("📂 Transaction salvata con ID:", txRef.id);

    // 3️⃣ Restituisci al frontend i dati necessari
    return {
      clientSecret:   paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      transactionId:  txRef.id
    };

  } catch (error) {
    console.error("❌ Errore createPaymentIntent:", error);

    if (error instanceof functions.https.HttpsError) {
      // Ri-lancia gli errori già formattati
      throw error;
    }

    // Gestione errori Stripe
    if (error.type === "StripeCardError") {
      throw new functions.https.HttpsError("failed-precondition", "Carta rifiutata.");
    }
    if (error.type === "RateLimitError") {
      throw new functions.https.HttpsError("resource-exhausted", "Troppi tentativi, riprova più tardi.");
    }

    // Errore generico
    throw new functions.https.HttpsError(
      "internal",
      "Errore durante la creazione del pagamento.",
      error.message
    );
  }
});
