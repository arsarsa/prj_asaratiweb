// functions/payments/index.js
// Backend Firebase Cloud Functions: gestione download e pagamenti

import * as functions from "firebase-functions";
import { logger, onCall, onRequest } from "firebase-functions";
import admin from './utils/firebaseAdmin.js';
import sgMail from "@sendgrid/mail";
import { config } from "firebase-functions";

admin.initializeApp();
const db = admin.firestore();

// ✅ CONFIG
const {
  sendgrid: { api_key: SENDGRID_API_KEY, sender_email: SENDER_EMAIL },
  general: {
    allowed_origin: ALLOWED_ORIGIN = "https://asarati.it",
    valid_tokens = "",
    support_email = "support@asarati.it",
    email_subject = "Il tuo download da asarati.it"
  } = {},
} = config();

const validTokens = valid_tokens.split(",").map(t => t.trim()).filter(Boolean);

sgMail.setApiKey(SENDGRID_API_KEY);

// ✅ UTILS
const isValidEmail = email => /\S+@\S+\.\S+/.test(email);

const checkOrigin = (origin) => {
  if (!origin || !origin.startsWith(ALLOWED_ORIGIN)) {
    throw new Error(`Origine non autorizzata: ${origin}`);
  }
};

const checkToken = (token) => {
  if (!validTokens.includes(token)) {
    throw new Error("Token non valido");
  }
};

const getEbookDoc = async (ebookId) => {
  const ebookRef = db.collection("ebooks").doc(ebookId);
  const ebookDoc = await ebookRef.get();
  if (!ebookDoc.exists) throw new Error("Ebook non trovato.");
  return ebookDoc;
};

const sendEmailWithTimeout = async (emailData, timeout = 8000) => {
  return Promise.race([
    sgMail.send(emailData),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Timeout invio email")), timeout)
    ),
  ]);
};

// ✅ FUNZIONE: updateDownloadCount (onCall)
export const updateDownloadCount = onCall(async (data, context) => {
  const {
    token,
    ebookId,
    email,
    downloadType,
    fileExtension = "pdf",
    isNewsletterSubscribed = false
  } = data;

  const origin = context.rawRequest.headers.origin;

  try {
    checkOrigin(origin);
    checkToken(token);

    if (!isValidEmail(email)) throw new Error("Email non valida");
    if (!ebookId || !downloadType) throw new Error("Dati mancanti");

    const ebookDoc = await getEbookDoc(ebookId);
    const countField = downloadType === "ebook" ? "ebookDownloadCount" : "audiobookDownloadCount";

    await ebookDoc.ref.update({ [countField]: admin.firestore.FieldValue.increment(1) });

    await db.collection("emailLogs").add({
      email,
      ebookId,
      downloadType,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    const now = new Date();
    const dateTime = now.toLocaleString();
    const newsletterMsg = isNewsletterSubscribed
      ? "✅ Grazie per esserti iscritto alla nostra newsletter!"
      : "ℹ️ Non sei iscritto alla newsletter.";

    const emailHtml = `
      <strong>Grazie per il tuo acquisto!</strong><br><br>
      <em>Dettagli ordine:</em><br>
      • Prodotto: ${ebookId}<br>
      • Tipo: ${downloadType}<br>
      • Estensione: .${fileExtension}<br>
      • Email: ${email}<br>
      • Data e ora: ${dateTime}<br><br>
      📥 Il download è partito automaticamente.<br>
      ${newsletterMsg}<br><br>
      Se hai problemi, contattaci a <a href="mailto:${support_email}">${support_email}</a>
    `;

    const emailText = `
Grazie per il tuo acquisto su Asarati!

Dettagli ordine:
• Prodotto: ${ebookId}
• Tipo: ${downloadType}
• Estensione: .${fileExtension}
• Email: ${email}
• Data e ora: ${dateTime}

Il download è partito automaticamente.

${newsletterMsg}

Se hai problemi, contattaci a ${support_email}
    `.trim();

    await sendEmailWithTimeout({
      to: email,
      from: SENDER_EMAIL,
      subject: email_subject,
      html: emailHtml,
      text: emailText,
    });

    logger.info(`Email inviata a ${email} per ${downloadType}`);
    return { success: true };

  } catch (error) {
    logger.error("Errore in updateDownloadCount:", error);
    throw new Error(error.message);
  }
});

// ✅ FUNZIONE: getDownloadCount (onRequest)
export const getDownloadCount = onRequest(async (req, res) => {
  const { ebookId } = req.query;
  const origin = req.headers.origin;

  try {
    checkOrigin(origin);
    if (!ebookId) throw new Error("ebookId mancante");

    const ebookDoc = await getEbookDoc(ebookId);
    const data = ebookDoc.data();

    res.status(200).json({
      ebookDownloadCount: data?.ebookDownloadCount || 0,
      audiobookDownloadCount: data?.audiobookDownloadCount || 0,
    });
  } catch (error) {
    logger.warn("Errore in getDownloadCount:", error.message);
    res.status(400).json({ error: error.message });
  }
});
