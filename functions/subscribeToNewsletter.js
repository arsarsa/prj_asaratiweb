// functions/subscribeToNewsletter.js
// Backend - ESM

import axios from "axios";
import { region, https, config } from "firebase-functions";

// Configura questi valori nei tuoi secrets/env
const MAILCHIMP_API_KEY = config().mailchimp.key;
const MAILCHIMP_SERVER_PREFIX = config().mailchimp.prefix;
const MAILCHIMP_AUDIENCE_ID = config().mailchimp.audience;

export const subscribeToNewsletter = region('europe-west1').https.onCall(async (data, context) => {
  const { email } = data;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new functions.https.HttpsError("invalid-argument", "Email non valida");
  }

  const url = `https://${MAILCHIMP_SERVER_PREFIX}.api.mailchimp.com/3.0/lists/${MAILCHIMP_AUDIENCE_ID}/members`;

  try {
    const res = await axios.post(
      url,
      {
        email_address: email,
        status: "subscribed"
      },
      {
        headers: {
          Authorization: `apikey ${MAILCHIMP_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    return { success: true };
  } catch (error) {
    console.error("Errore Mailchimp:", error.response?.data || error);
    throw new functions.https.HttpsError("internal", "Errore durante l'iscrizione");
  }
});
