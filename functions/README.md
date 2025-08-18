# Cartella `functions/`

Questa cartella contiene il codice backend implementato con Firebase Cloud Functions per il progetto AsaratiWeb.

## Struttura e contenuti principali

- **`auth/`**  
  Funzioni di autenticazione e verifica token Firebase ID utente.  
  Esempio: `verifyTokenFunction.js`.

- **`downloads/`**  
  Funzioni per la gestione download: generazione link sicuri, tracking download per prodotto e utente.

- **`email/`**  
  Funzioni per l’invio di email, inclusa conferma ordine e newsletter.

- **`newsletter/`**  
  Callable per iscrizione e gestione newsletter.

- **`payment/`**  
  Funzioni legate al sistema di pagamento Stripe, inclusi PaymentIntent, webhook e chiavi pubbliche.

- **`utils/`**  
  Utility backend condivise: validazioni, logging centralizzato, inizializzazione Firebase Admin SDK, gestione errori.

- **File principali**:  
  `firebaseFunctions.js` (config e registrazione funzioni), `index.js` se presente come punto d’ingresso.

## Note

- Tutte le funzioni sono scritte in Node.js con Firebase Admin SDK e Firebase Functions SDK.  
- Errori gestiti mediante `functions.https.HttpsError` con logging strutturato tramite `functions.logger`.  
- Riservato esclusivamente al codice backend, che non deve essere mescolato con il frontend.

## Linee guida

- Mantenere isolato il codice backend.  
- Usare utilities in `utils/` per evitare duplicazione codice.  
- Aggiornare la documentazione di ogni nuova funzione inserita.
