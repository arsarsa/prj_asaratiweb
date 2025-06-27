// functions/test.js

import { region } from "firebase-functions";

export const testRegion = region("europe-west1").https.onRequest((req, res) => {
  res.send("Funzione di test in europe-west1 funziona!");
});
