AsaratiWeb - Documentazione Generale
Questo progetto include una web app frontend integrata con backend Firebase Functions. Fornisce un sistema di e-commerce digitale con download protetti, gestione pagamenti (attualmente Stripe), newsletter e flussi di autenticazione.
Struttura principale del progetto

1. Backend - Firebase Functions (`functions/`)
• Autenticazione e sicurezza
• `auth/` contiene funzioni per la verifica token Firebase ID e gestione accessi.
• Gestione download
• Funzioni per generare link firmati, tracciare conteggio download per prodotto e utente.
• Pagamento
• Moduli specifici per gestire checkout, creare intenti di pagamento Stripe, webhook e chiave pubblica Stripe.
• Newsletter e email
• Funzioni callable per iscrizioni newsletter e invio mail di conferma ordine.
• Utils backend
• Funzioni di validazione, logging centralizzato, inizializzazione SDK Firebase Admin.
		Le funzioni sono implementate in Node.js con Firebase Admin SDK e `firebase-functions`.
2. Frontend (`src/`)
• Logica centralizzata
• `logic/` contiene la configurazione Firebase frontend e la logica condivisa.
• Scripts e flussi
• `scripts/` ospita moduli per flussi di pagamento, download, e flussi di interazione utente (free e paid).
• `scripts/payments/` contiene implementazioni di metodi di pagamento: Stripe (attivo), placeholder per Paypal e crypto.
• Utilities frontend
• `utils/` contiene helper frontend ES6: validazioni leggere, gestione interazioni con callable Firebase, accesso Storage lato client.
• Stili
• Fogli CSS e risorse UI.

3. Strumenti di supporto (`tools/`)
• Script CLI per configurare i segreti Firebase (`setup-secret.js`), vedere configurazioni in uso (`show-config.js`) e altri tool di sviluppo.
Linee guida per sviluppo
• Separazione chiara frontend/backend
Utils backend (`functions/utils/`) sono esclusivi per funzioni cloud, con validazioni rigorose e logging `functions.logger`.
Utils frontend (`src/utils/`) sono leggeri e destinati a browser/client.
• Configurazione Firebase
Frontend: un’unica configurazione e inizializzazione in `src/logic/firebase-config.js`.
Backend: inizializzazione centralizzata in `functions/utils/firebaseAdmin.js`.
• Gestione errori
Backend: uso sistematico di `functions.https.HttpsError` per callable coerenti.
Frontend: validazione preventiva leggera per miglior UX, gestione errori tramite UI e console.
• Pagamenti
Stripe è attualmente implementato e operativo. Paypal e Crypto sono in placeholders pronti per future integrazioni.
• Validazioni
Input dagli utenti validati sia lato frontend sia backend per sicurezza e user experience.
Come contribuire
• Seguire la struttura cartelle e nominazioni standard per nuovi moduli.
• Mantenere nette le distinzioni frontend/backend nel codice.
• Documentare ogni modulo e funzione con commenti chiari.
• Scrivere test automatici quando possibile.
Comandi utili
• Avviare emulatore Firebase Functions e Hosting
`firebase emulators:start`
• Deploy Funzioni
`firebase deploy --only functions`
• Build frontend (Webpack)
`npm run build`
• Eseguire test validazioni frontend
Aprire `src/utils/testCommonFrontend.js` nel browser o eseguirlo con Node.js ESModule support.
Contatti
Per domande o supporto tecnico contattare il team di sviluppo Asarati.
Se vuoi, posso prepararti versioni anche in altre lingue o modulari per singole cartelle.