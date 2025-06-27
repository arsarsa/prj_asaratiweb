// functions/sendConfirmationEmail.js
// Backend - ESM compatibile

import nodemailer from "nodemailer";
import axios from "axios";
import crypto from "crypto";
import { region, https, config } from "firebase-functions";

// Accesso ai secrets (config)
const MAILCHIMP_API_KEY = config().mailchimp.key;
const MAILCHIMP_SERVER_PREFIX = config().mailchimp.prefix;
const MAILCHIMP_AUDIENCE_ID = config().mailchimp.audience;

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: config().email.user,
    pass: config().email.pass,
  },
});

// 🔄 Funzione di supporto: verifica se l'email è già iscritta
async function isSubscribedToNewsletter(email) {
  const subscriberHash = crypto.createHash("md5").update(email.toLowerCase()).digest("hex");
  const url = `https://${MAILCHIMP_SERVER_PREFIX}.api.mailchimp.com/3.0/lists/${MAILCHIMP_AUDIENCE_ID}/members/${subscriberHash}`;

  try {
    const response = await axios.get(url, {
      headers: {
        Authorization: `apikey ${MAILCHIMP_API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    return response.data.status === "subscribed";
  } catch (error) {
    if (error.response?.status === 404) return false; // Non iscritto
    console.error("Errore controllo iscrizione Mailchimp:", error.response?.data || error);
    throw new functions.https.HttpsError("internal", "Errore controllo iscrizione newsletter");
  }
}

export const sendConfirmationEmail = region('europe-west1').https.onCall(async (data, context) => {
  const { to, productName, orderId } = data;

  if (!to || !productName || !orderId) {
    throw new functions.https.HttpsError("invalid-argument", "Dati mancanti per l’email");
  }

  const isSubscribed = await isSubscribedToNewsletter(to);

  const newsletterHtml = isSubscribed
    ? `<p>🎉 Sei iscritto alla nostra newsletter. Grazie per far parte della community!</p>`
    : `<p>🔔 Non sei ancora iscritto alla nostra newsletter.<br>
         <a href="https://asarati.it/newsletter" target="_blank">Iscriviti qui</a> per ricevere novità e contenuti esclusivi!</p>`;

  const mailOptions = {
    from: '"Asarati Store" <noreply@asarati.it>',
    to,
    subject: `Conferma ordine #${orderId}`,
    html: `
      <p>Grazie per il tuo acquisto!</p>
      <p><strong>Hai scaricato:</strong> ${productName}</p>
      <hr>
      ${newsletterHtml}
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error("Errore invio email:", error);
    throw new functions.https.HttpsError("internal", "Errore durante l’invio email");
  }
});
