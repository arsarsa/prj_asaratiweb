# Cartella `src/scripts/payments`

Questa cartella contiene i moduli dedicati alla gestione dei pagamenti nel frontend per il progetto Asarati.

## Descrizione dei file

- **`cryptoPayment.js`**  
  Placeholder per gestione pagamenti in criptovalute (ad es. Coinbase Commerce). Contiene funzioni callable Firebase per creare transazioni e verificare lo stato. Ancora in sviluppo.

- **`paypalPayment.js`**  
  Placeholder per integrazione PayPal. Fornisce funzioni callable per creare ordini, catturare pagamenti e ottenere URL per il download. Ancora in sviluppo.

- **`stripePaymentForm.js`**  
  Modulo frontend per la gestione del form di pagamento Stripe, integra le chiamate a Stripe.js, valida email e ID prodotto, gestisce l’intero processo di pagamento e follow-up download.

## Funzionalità comuni

- Tutti i moduli importano e utilizzano callable Firebase Functions per comunicare col backend.
- La funzione `getDownloadURLForFile` è centralizzata in `src/utils/downloadUtils.js` per uniformità e riuso.
- Le validazioni email e stringhe sono delegate a `src/utils/commonFrontend.js`.

## Linee guida per sviluppo

- I moduli PayPal e Crypto sono in placeholder; attivare e i test solo dopo completamento backend.
- Usare sempre validazioni centralizzate per input utente e error handling coerente.
- Coordinarsi con il backend per mantenere consistenza nei nomi delle callable Firebase.
- Eventuali nuove modalità di pagamento devono rispettare la struttura modulare e integrare chiaramente la funzione di download unificata.

---

*Per domande o integrazioni, contattare il team tecnico Asarati.*
