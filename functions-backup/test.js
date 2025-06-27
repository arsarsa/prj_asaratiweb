// functions/test.js

import * as functions from "firebase-functions";

export const testRegion = functions
  .region("europe-west1")
  .https.onRequest((req, res) => {
    res.send("Funzione di test in europe-west1 funziona!");
  });
  