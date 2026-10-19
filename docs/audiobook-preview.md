# Anteprima audiobook da ZIP

Il pannello `uploadfile/online_upload.html` genera una bozza privata dal file
originale già caricato. Non richiede un secondo upload e non modifica lo ZIP.

## Regola editoriale

- Convenzione nuova: `001_005_003.mp3` oppure `.wav`.
- I tre numeri identificano libro, capitolo, segmento. Gli identificativi libro
  sono stabili; i titoli leggibili restano nei metadati del prodotto.
- Un capitolo intero usa segmento `001`; non occorre un file per ogni paragrafo.
- Compatibilità: `USN_Cpt01-01.mp3`, con numeri di capitolo e segmento.
- La generazione parte da capitolo 001, segmento 001, ordinando numericamente.
- Massimo 120 secondi; si prosegue nei segmenti consecutivi dello stesso capitolo
  se il primo è breve. Non si passa al capitolo successivo.
- Sfumatura negli ultimi 5 secondi, o sull'intera anteprima se più breve.
- Se esistono MP3 e WAV della stessa posizione si usa MP3.
- ZIP con più libri, segmenti duplicati/assenti o numerazione interrotta sono
  rifiutati. Metadati macOS e file non audio non vengono usati.
- Un singolo file MP3/WAV/M4A/M4B/MP4 è trattato come una traccia unica.

Il trailer video MP4 è facoltativo anche per gli audiobook: può essere caricato
e gestito insieme all’anteprima audio. Il QRC mostra entrambi quando disponibili.

## Uso del pannello

1. Caricare il prodotto: per gli audiobook la generazione è selezionata di default.
2. Per prodotti già caricati scegliere **Genera anteprima**, oppure **Rigenera**.
3. Aprire **Ascolta / pubblica anteprima** e controllare la bozza e la forma d'onda.
4. Premere **Pubblica anteprima sul QRC** per renderla disponibile ai visitatori.
5. **Ritira anteprima** nasconde il player e rimuove la copia pubblicata. La bozza
   privata rimane disponibile. I link temporanei già emessi scadono normalmente.

Generare una bozza non pubblica nulla. Rigenerare non ritira un'anteprima già
pubblicata; la nuova bozza deve essere approvata. Se cambia l'originale, la bozza
precedente non è più pubblicabile: va rigenerata. La duplicazione di un prodotto
non copia l'approvazione o i riferimenti della sua anteprima.

## Implementazione

- `functions/audio-preview.js`: lettura ZIP con yauzl, selezione capitolo,
  decodifica con FFmpeg, taglio, sfumatura, MP3 mono e 120 picchi normalizzati.
- `functions/audio-preview-functions.js`: operazioni amministrative, controllo
  versione originale, lock per prodotto e accesso alle bozze con URL temporanei.
- Callable: `generateAudiobookPreview`, `getAudiobookPreview`,
  `setAudiobookPreviewPublished`, nella regione predefinita `us-central1`.
- Bozze: `protected_file/audio_previews/{productId}/{draftId}.mp3`.
- Pubblicazione: `public_file/product_audio_previews/{productId}.mp3`.
- Firestore: `audioPreviewDraft`, `audioPreviewJob`, `audioPreviewPath`,
  `audioPreviewPublished`, `audioPreviewPeaks`, durata e audit della pubblicazione.
- Nessuna modifica a pagamenti, download acquistati, contatori o licenze.
- Limiti iniziali: originale 512 MB, segmento estratto 256 MB, archivio 5000 voci.
  ZIP cifrati non supportati. Le scritture locali usano nomi generati, non percorsi
  controllati dall'archivio. I file temporanei vengono rimossi a fine elaborazione.
- FFmpeg viene installato per la piattaforma del runtime cloud con ffmpeg-static.

La prima versione esegue la generazione in una callable con timeout di 540 secondi
ed espone lo stato nel pannello. Per volumi o file maggiori servirà una coda di
elaborazione dedicata. Dopo un'interruzione il lock scade in 10 minuti.

## Verifiche

`cd functions && npm test` verifica selezione, audio sintetico, ZIP non validi,
autorizzazioni, concorrenza e pubblicazione. Il test facoltativo
`node functions/test/audio-preview-ui.cjs` richiede Playwright e simula Firebase:
non legge o modifica dati di produzione. L'elaborazione dei contenuti editoriali
reali e la loro pubblicazione rimangono azioni esplicite dell'amministratore.


## Copertina e durate del pacchetto

Dopo un upload audiobook, il pannello esegue `inspectAudiobookPackage` prima
 dell'eventuale generazione della bozza audio. Il comando **Estrai copertina e
 durate** è disponibile anche sui prodotti esistenti. Non riproduce i capitoli:
 ffprobe ne legge i metadati, conservando durata totale e durata di ogni traccia
 in `products.audiobookPackage`, con riferimento alla versione del file originale.

Una sola `cover.jpg` è riconosciuta nella radice o nella cartella del libro nello
 ZIP. Metadati macOS sono ignorati. La JPEG è verificata (massimo 10 MB e 32 MP),
 ridimensionata entro 1200 pixel e salvata senza metadati in
 `public_file/product_covers/{productId}/{jobId}.jpg`. L'URL pubblico della sola
 copertina viene registrato in `coverImage`, già supportato dalla scheda QRC,
 insieme a `coverPath`. Le regole Storage non vengono ampliate; il download della
 copertina usa un token dedicato. Senza una cover non si sostituiscono immagini
 preesistenti. Il ReadMe e lo ZIP originale non vengono modificati.

L'analisi richiede accesso admin, usa lo stesso lock delle anteprime e verifica
 che la versione dell'originale sia ancora corrente prima di aggiornare il prodotto.
 Non pubblica né l'audio integrale né la bozza audio. Non modifica Stripe o il
 percorso di pagamento, che resta oggetto del collaudo in modalità test.
