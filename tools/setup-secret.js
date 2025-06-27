// tools/setup-secret.js

import crypto from 'crypto';
import { execSync } from 'child_process';

const token = crypto.randomBytes(32).toString('hex');
const origin = "https://asarati.it";

console.log(`🔥 Token generato: ${token}`);

try {
  execSync(`firebase functions:config:set secrets.token="${token}" secrets.origin="${origin}"`, { stdio: 'inherit' });
  console.log("✅ Configurazione aggiornata con successo su Firebase.");
} catch (err) {
  console.error("❌ Errore durante l'aggiornamento della config Firebase:", err.message);
}
