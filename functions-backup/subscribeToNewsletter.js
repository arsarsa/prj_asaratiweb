// functions/subscribeToNewsletter.js
// Backend

const functions = require("firebase-functions");
const axios = require("axios");

// Configura questi valori nei tuoi secrets/env
const MAILCHIMP_API_KEY = functions.config().mailchimp.key;
const MAILCHIMP_SERVER_PREFIX = functions.config().mailchimp.prefix; // es. us21
const MAILCHIMP_AUDIENCE_ID = functions.config().mailchimp.audience;

exports.iscrizioneNewsletter = functions.https.onCall(async (data, context) => {
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
