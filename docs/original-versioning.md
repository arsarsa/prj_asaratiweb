# Originali EPUB versionati — pilota QRC

Il versionamento è opt-in per gli eBook a pagamento. La prima attivazione è limitata a **L’unica sostanza in natura**, prodotto `l-unica-sostanza-in-natura-20e0088e`. Non attiva `licenseMode`, watermark, recupero o nuove modalità di pagamento.

## Conservazione degli originali

`initializeProductVersion` richiede Firebase Auth con claim amministratore. L’operazione interna di inizializzazione può essere eseguita da un operatore Google già autorizzato, registrandone la provenienza nel documento privato della versione.

1. Riserva una lavorazione privata con scadenza e legge la generazione Storage esatta del file esistente.
2. Verifica lo ZIP/EPUB e calcola SHA-256 sui byte originali.
3. Copia in `protected_file/eBook/{productId}/versions/v1/original/{fileName}` con precondizione `ifGenerationMatch: 0`, impedendo sovrascritture.
4. Rilegge la copia e verifica hash e dimensione.
5. In una transazione Firestore crea `products/{id}/versions/v1` e aggiorna il puntatore corrente del prodotto. Se la sorgente cambia o una verifica fallisce, non attiva il nuovo puntatore.

Il file precedente non viene cancellato o riscritto. Il registro conserva hash dello ZIP, hash dell’EPUB interno, formato, percorso del package OPF e generazioni di origine/destinazione. Le letture degli originali versionati sono vincolate alla generazione registrata, non soltanto al nome dell’oggetto.

## Revisioni successive

Per un prodotto versionato `createProductRevisionUpload` riserva un identificativo e un numero di versione e restituisce un URL firmato per un oggetto separato in `protected_file/version_uploads/`. L’upload non scrive sull’originale pubblicato. Il browser restituisce `revisionId` a `recordProductRevision`, che verifica amministratore, scadenza, base di partenza, formato e hash prima di creare una nuova edizione immutabile.

Una transazione confronta la versione di partenza con quella ancora corrente. Due revisioni concorrenti non possono attivarsi entrambe sulla medesima base. Ripetere una finalizzazione completata riusa la versione già registrata e non riporta indietro il prodotto. I numeri prenotati possono avere intervalli se un tentativo viene annullato; file temporanei o copie non attivate non vengono eliminati automaticamente in questa tappa.

Il QR e i metadati editoriali rimangono quelli del prodotto. Una duplicazione crea un nuovo prodotto senza ereditare registro delle versioni o modalità di licenza. Gli altri prodotti mantengono il loro flusso precedente finché non vengono esplicitamente inizializzati.

## Verifiche EPUB

Il pilota è uno ZIP con un EPUB e metadati macOS. Il controllo accetta un EPUB diretto oppure un solo EPUB nello ZIP, con cover e ReadMe opzionali. Impone limiti a dimensione, numero di voci e dimensione decomprimibile; rifiuta percorsi non sicuri, link simbolici, allegati inattesi, XML con entità esterne, risorse mancanti e ordini di lettura incoerenti.

Un EPUB con firma richiede una verifica distinta e viene rifiutato. Cifratura del testo/DRM non supportata viene rifiutata. L’offuscamento IDPF/Adobe dei soli font è distinto dal DRM e viene conservato senza modifiche. L’EPUB del pilota contiene un font IDPF offuscato: il futuro watermark dovrà preservare l’identificatore originale da cui dipende il font.

Questa verifica strutturale non sostituisce EPUBCheck né i test sui lettori, previsti dopo la futura personalizzazione.

## Test ripetibili

Dalla cartella `functions`:

- `npm test`: include validazione EPUB, archivi ambigui, DRM, font, XML e le regressioni audio/Stripe.
- `npm run test:versions`: dieci test con transazioni Firestore reali nell’emulatore, Storage simulato e nessun dato live. Copre copie identiche, replay, concorrenza, formati, permessi, scadenze, sorgenti cambiate, copie fallite e conflitti su file immutabili.

Nel progetto QRC, `npm run test:security` verifica anche che versioni, lavorazioni e richieste di upload siano inaccessibili dal browser; `node --test tests/qr-offers.test.cjs` copre il caricamento delle edizioni dichiarate e il rifiuto di percorsi non coerenti.

Il test del browser con dati simulati verifica che la revisione ZIP invii l’identificativo ricevuto dal server e rimanga compatibile con navigazione e schede esistenti. Sul pilota live si registra soltanto `v1`; le prove distruttive e di concorrenza rimangono nell’emulatore.

## Prossima tappa

Fissare la versione al momento del pagamento, creare una sola licenza per acquisto confermato e generare una copia EPUB personalizzata. Fino ad allora gli acquisti continuano nel flusso precedente e non si promette una consegna con watermark.
