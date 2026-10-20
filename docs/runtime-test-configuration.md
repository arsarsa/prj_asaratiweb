# Configurazione esplicita dei servizi test

Il progetto QRC rimane in modalità Stripe test. La configurazione precedente era presente nel servizio Runtime Config ma non risultava disponibile alle funzioni pubblicate: `getStripeConfig` restituiva HTTP 500.

- `functions/runtime-public-config.json` contiene soltanto la modalità test e la chiave **pubblicabile** test, destinata al client.
- `ASARATI_STRIPE_TEST_SECRET`, `ASARATI_STRIPE_TEST_WEBHOOK_SECRET` e `ASARATI_RESEND_KEY` sono in Secret Manager. Nessun valore riservato viene salvato nel repository.
- `createPayment` riceve soltanto la chiave privata Stripe test.
- `stripeWebhook` riceve la chiave Stripe test, il segreto di verifica webhook e la chiave del servizio email.
- `generateDownloadUrl` riceve soltanto la chiave email, usata dalla notifica amministrativa esistente.
- `getStripeConfig` non riceve segreti: restituisce soltanto la chiave pubblicabile e la modalità.

Il servizio runtime mantiene la modalità test e rifiuta una modalità live o chiavi con prefisso live. Un eventuale passaggio live richiede una revisione e un rilascio espliciti; non dipende più da valori legacy non disponibili al processo.

I valori esistenti sono stati copiati, senza ruotarli né rimuovere la configurazione legacy. Non sono state copiate chiavi Stripe live. I segreti vanno vincolati con `runWith({ secrets: [...] })` a ogni funzione che ne ha bisogno; una nuova funzione non li eredita automaticamente nell’ambiente.

Test ripetibile: `node --test test/runtime-settings.test.js` dalla cartella `functions`. Copre configurazione pubblica senza segreti, lettura dei valori riservati dall’ambiente, rifiuto di chiavi/modalità live e fallimento esplicito se manca la chiave pubblicabile.

Il collaudo della configurazione non equivale a un acquisto completo: pagamento Stripe test, gestione del webhook di pagamento, generazione della licenza e consegna del file personalizzato saranno verificati sul prodotto pilota.
