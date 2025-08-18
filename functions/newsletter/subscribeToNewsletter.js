// functions/newsletter/subscribeToNewsletter.js
// Backend - ESM compatibile, iscrizione newsletter anonima

import axios from "axios";
import * as functions from "firebase-functions";
import { validateEmailOrThrow, logInfo, logError } from "../utils/common.js";

const MAILCHIMP_API_KEY = functions.config().mailchimp.key;
const MAILCHIMP_SERVER_PREFIX = functions.config().mailchimp.prefix;
const MAILCHIMP_AUDIENCE_ID = functions.config().mailchimp.audience;

export const subscribeToNewsletter = functions.region('europe-west1').https.onCall(async (data, context) => {
  const { email } = data;

  // Validazione email centralizzata
  validateEmailOrThrow(email);

  const url = `https://${MAILCHIMP_SERVER_PREFIX}.api.mailchimp.com/3.0/lists/${MAILCHIMP_AUDIENCE_ID}/members`;

  try {
    await axios.post(
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
    logInfo(`Nuova iscrizione newsletter da email: ${email}`);

    return { success: true };
  } catch (error) {
    logError("Errore Mailchimp:", error.response?.data || error);
    throw new functions.https.HttpsError("internal", "Errore durante l'iscrizione");
  }
});
