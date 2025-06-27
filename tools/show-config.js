// tools/show-config.js

import { execSync } from 'child_process';

try {
  const output = execSync('firebase functions:config:get', { encoding: 'utf-8' });
  console.log("🔐 Configurazioni attuali di Firebase Functions:");
  console.log(output);
} catch (err) {
  console.error("❌ Errore nel recupero della configurazione:", err.message);
}
