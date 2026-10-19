import { app } from "./firebase-config.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.19.1/firebase-auth.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/9.19.1/firebase-functions.js";
import { getFirestore, collection, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.19.1/firebase-firestore.js";

const auth = getAuth(app);
const functions = getFunctions(app, "us-central1");
const db = getFirestore(app);
const createProductUpload = httpsCallable(functions, "createProductUpload");
const updateProductDetails = httpsCallable(functions, "updateProductDetails");
const createProductRevisionUpload = httpsCallable(functions, "createProductRevisionUpload");
const recordProductRevision = httpsCallable(functions, "recordProductRevision");
const archiveProduct = httpsCallable(functions, "archiveProduct");
const restoreProduct = httpsCallable(functions, "restoreProduct");
const createProductDownloadUrl = httpsCallable(functions, "createProductDownloadUrl");
const duplicateProduct = httpsCallable(functions, "duplicateProduct");
const getProductsSummary = httpsCallable(functions, "getProductsSummary");
const createProductQrDownloadUrl = httpsCallable(functions, "createProductQrDownloadUrl");
const createProductTrailerUpload = httpsCallable(functions, "createProductTrailerUpload");
const recordProductTrailer = httpsCallable(functions, "recordProductTrailer");
const getProductTrailerUrl = httpsCallable(functions, "getProductTrailerUrl");
const generateAudiobookPreview = httpsCallable(functions, "generateAudiobookPreview", { timeout: 540000 });
const getAudiobookPreview = httpsCallable(functions, "getAudiobookPreview");
const setAudiobookPreviewPublished = httpsCallable(functions, "setAudiobookPreviewPublished", { timeout: 120000 });
const inspectAudiobookPackage = httpsCallable(functions, "inspectAudiobookPackage", { timeout: 540000 });
let audioPreviewSelection = null;
let audioPreviewRequest = 0;
let editingProduct = null;
let revisionProduct = null;
let trailerProductId = null;

onAuthStateChanged(auth, (user) => {
  document.getElementById("loginModal").classList.toggle("show", !user);
});

function makeProductId(name) {
  const base = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);
  return `${base || "product"}-${crypto.randomUUID().slice(0, 8)}`;
}

async function uploadProduct({ fileInput, trailerInput, accessInput, nameInput, descriptionInput, priceInput, message, result, type }) {
  const file = document.getElementById(fileInput).files[0];
  const trailerFile = trailerInput ? document.getElementById(trailerInput).files[0] : null;
  const name = document.getElementById(nameInput).value.trim();
  const description = document.getElementById(descriptionInput).value.trim();
  const accessMode = document.getElementById(accessInput).value;
  const priceInputEl = document.getElementById(priceInput);
  const price = accessMode === "free" ? "0" : priceInputEl.value.trim();
  const messageEl = document.getElementById(message);
  const resultEl = document.getElementById(result);
  messageEl.textContent = "";
  resultEl.replaceChildren();

  if (!auth.currentUser) return messageEl.textContent = "Accedi con un account amministratore.";
  const allowedExtensions = {
    ebook: ["epub", "pdf", "zip"],
    audiobook: ["mp3", "wav", "m4a", "m4b", "mp4", "zip"],
    boxbook: ["zip", "mp4"]
  };
  const extension = file?.name.split(".").pop().toLowerCase();
  if (!file || !allowedExtensions[type]?.includes(extension) || (trailerFile && !trailerFile.name.toLowerCase().endsWith(".mp4")) || !name || !description ||
      !["paid", "free"].includes(accessMode) || (accessMode === "paid" && (!/^\d+([.,]\d{1,2})?$/.test(price) || Number(price.replace(",", ".")) <= 0))) {
    return messageEl.textContent = "Controlla file, estensione, titolo, descrizione e prezzo. Il trailer deve essere MP4.";
  }

  const draftKey = `product-upload:${name}:${file.name}:${file.lastModified}`;
  const productId = sessionStorage.getItem(draftKey) || makeProductId(name);
  sessionStorage.setItem(draftKey, productId);
  const contentType = file.type || "application/octet-stream";
  messageEl.textContent = "Creo il prodotto e preparo l'upload sicuro…";
  try {
    const response = await createProductUpload({
      productId, name, description, type, price, accessMode,
      fileName: file.name, contentType,
      trailerFileName: trailerFile?.name || "",
      trailerContentType: trailerFile?.type || "video/mp4"
    });
    const { uploadUrl, trailerUploadUrl, trailerPath, publicUrl } = response.data;
    const uploaded = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": contentType }, body: file });
    if (!uploaded.ok) throw new Error(`Upload non riuscito (${uploaded.status}).`);
    if (trailerFile && trailerUploadUrl) {
      const trailerUploaded = await fetch(trailerUploadUrl, { method: "PUT", headers: { "Content-Type": "video/mp4" }, body: trailerFile });
      if (!trailerUploaded.ok) throw new Error(`Upload trailer non riuscito (${trailerUploaded.status}).`);
      await recordProductTrailer({ productId, trailerPath });
    }

    messageEl.textContent = "File caricato. Attendo la generazione automatica del QR…";
    let ready = false;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const productSnapshot = await getDoc(doc(db, "products", productId));
      if (productSnapshot.exists() && productSnapshot.data().qrCodeGeneratedAt) { ready = true; break; }
      await new Promise((resolve) => window.setTimeout(resolve, 1500));
    }
    if (!ready) throw new Error("Upload completato, ma il QR non è ancora pronto. Riprova tra poco.");
    const qrPath = `public_qrcodes/${productId}.svg`;
    const { data: qrUrls } = await createProductQrDownloadUrl({ productId });
    const link = document.createElement("a");
    link.href = publicUrl;
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = `Apri pagina prodotto: ${publicUrl}`;
    const qrPreview = document.createElement("img");
    qrPreview.src = qrUrls.previewUrl;
    qrPreview.alt = `QR code per ${name}`;
    qrPreview.width = 180;
    qrPreview.style.display = "block";
    qrPreview.style.margin = "14px 0";
    const download = actionButton("Scarica QR SVG", () => downloadQr(qrPath, productId));
    resultEl.append(link, qrPreview, download);
    const listId = { ebook: "ebookList", audiobook: "audioList", boxbook: "boxList" }[type];
    await displayUploadedProducts(type, listId);
    messageEl.textContent = accessMode === "free"
      ? "Prodotto gratuito pubblicato. QR e download dalla pagina QR sono pronti."
      : "Prodotto pubblicato. QR e pagina stabile sono pronti.";
    sessionStorage.removeItem(draftKey);
    if (trailerInput) document.getElementById(trailerInput).value = "";
    if (type === "audiobook") {
      const notes = [];
      messageEl.textContent = "Prodotto caricato. Leggo copertina e durata dei capitoli…";
      try {
        const { data: info } = await inspectAudiobookPackage({ productId });
        notes.push(`Durata totale: ${formatDuration(info.durationSeconds)}. ${info.coverFound ? 'Copertina estratta e pronta nella scheda QR.' : 'Nessuna cover.jpg trovata nello ZIP.'}`);
      } catch (inspectionError) {
        notes.push(`Copertina e durate non estratte: ${inspectionError.message}. Puoi riprovare dall’elenco.`);
      }
      if (document.getElementById("generateAudioPreviewOnUpload").checked) {
        messageEl.textContent = "Prodotto caricato. Genero la bozza privata dell’anteprima audio…";
        try {
          await generateAudiobookPreview({ productId });
          notes.push("Anteprima pronta: ascoltala dall’elenco e scegli se pubblicarla.");
        } catch (previewError) {
          notes.push(`Anteprima non generata: ${previewError.message}. Puoi riprovare dall’elenco.`);
        }
      }
      messageEl.textContent = `Prodotto caricato. ${notes.join(' ')}`;
      await displayUploadedProducts(type, listId);
    }
  } catch (error) {
    console.error(error);
    messageEl.textContent = error.code ? `${error.code}: ${error.message}` : error.message || "Errore durante la creazione del prodotto.";
  }
}

async function displayUploadedProducts(type, containerId) {
  const container = document.getElementById(containerId);
  container.replaceChildren();
  try {
    const snapshot = await getDocs(collection(db, "products"));
    const products = [];
    snapshot.forEach((item) => {
      const product = item.data();
      if (product.type !== type) return;
      const archived = Boolean(product.archivedAt);
      if (archived && !document.getElementById("showArchivedCheckbox").checked) return;
      products.push({ id: item.id, product, archived });
    });
    products.sort((a, b) => (b.product.createdAt?.seconds || 0) - (a.product.createdAt?.seconds || 0));
    const summaries = await loadProductSummaries(products.map(({ id }) => id));

    for (const { id, product, archived } of products) {
      const row = document.createElement("article");
      row.className = "product-card";
      row.id = `product-${id}`;
      const coverColumn = document.createElement("div");
      coverColumn.className = "product-cover";
      if (product.coverImage) {
        const cover = document.createElement("img");
        cover.src = product.coverImage;
        cover.alt = `Copertina di ${product.name || id}`;
        cover.loading = "lazy";
        const button = document.createElement("button");
        button.type = "button";
        button.className = "cover-button";
        button.setAttribute("aria-label", `Ingrandisci copertina di ${product.name || id}`);
        button.addEventListener("click", () => {
          const image = document.getElementById("enlargedCover");
          image.src = cover.src;
          image.alt = cover.alt;
          document.getElementById("coverDialog").showModal();
        });
        button.append(cover);
        coverColumn.append(button);
      } else {
        coverColumn.classList.add("cover-placeholder");
        coverColumn.textContent = "Copertina non disponibile";
      }
      row.append(coverColumn);
      const qrReady = Boolean(product.qrCodeGeneratedAt && product.qrCodePath);
      const title = document.createElement("h3");
      title.textContent = product.name || id;
      const isActive = product.active === true || product.active === "true";
      const status = archived ? "Archiviato" : isActive ? "Attivo" : qrReady ? "In attesa di attivazione" : "In elaborazione QR";
      const meta = document.createElement("div");
      meta.className = "product-meta";
      const mainColumn = document.createElement("div");
      mainColumn.className = "product-main";
      const secondary = document.createElement("div");
      secondary.className = "product-meta product-secondary";
      const secondaryLabels = new Set(["Stato", "Caricato il", "Caricato da", "ID autore", "Ultima revisione", "Modificato da", "Vendite pagate", "Incasso lordo", "Download registrati"]);
      const createdBy = product.createdBy || {};
      const updatedBy = product.updatedBy || {};
      const summary = summaries[id] || {};
      const values = [
        ["Prezzo", product.accessMode === "free" ? "Gratis" : `${product.price || "—"} €`], ["Stato", status],
        ["Disponibilità", product.accessMode === "free" ? "Pubblico / gratuito" : "Protetto / pagamento"],
        ["Caricato il", formatDate(product.createdAt)], ["Caricato da", createdBy.email || "Non registrato"],
        ["ID autore", createdBy.uid || "Non registrato"], ["ID prodotto", id],
        ...(type === "audiobook" ? [["Durata totale", formatDuration(product.audiobookPackage?.durationSeconds)]] : []),
        ["Trailer", product.trailerPath ? "Personalizzato" : "Non presente"],
        ...(type === "audiobook" ? [["Anteprima audio", product.audioPreviewPublished ? "Pubblicata" : product.audioPreviewDraft ? "Bozza privata" : "Da generare"]] : []),
        ["Ultima revisione", formatDate(product.revisedAt)], ["Modificato da", updatedBy.email || "—"],
        ["Vendite pagate", String(summary.sales ?? "—")],
        ["Incasso lordo", summary.revenueCents === undefined ? "—" : formatCents(summary.revenueCents)],
        ["Download registrati", String(product.counters?.downloads ?? 0)]
      ];
      for (const [label, value] of values) {
        const item = document.createElement("div");
        const strong = document.createElement("strong");
        strong.textContent = `${label}: `;
        item.append(strong, document.createTextNode(value));
        (secondaryLabels.has(label) ? secondary : meta).append(item);
      }
      const description = document.createElement("p");
      description.className = "product-message";
      description.textContent = product.description || "Nessuna descrizione";
      const actions = document.createElement("div");
      actions.className = "product-actions";

      if (type === "audiobook") {
        actions.append(actionButton("Estrai copertina e durate", (event) => inspectAudioPackage(id, event.currentTarget)));
        const generating = product.audioPreviewJob?.status === "running"
          && Date.now() - (product.audioPreviewJob.startedAt?.toMillis?.() || 0) < 10 * 60 * 1000;
        const generate = actionButton(generating ? "Elaborazione anteprima…" : product.audioPreviewDraft ? "Rigenera anteprima" : "Genera anteprima", (event) => generateAudioPreview(id, event.currentTarget));
        generate.disabled = archived || generating;
        actions.append(generate);
        if (product.audioPreviewDraft) actions.append(actionButton("Ascolta / pubblica anteprima", () => openAudioPreview(id)));
        if (product.audioPreviewPublished) actions.append(actionButton("Ritira anteprima", (event) => updateAudioPublication(id, false, event.currentTarget)));
      }
      if (product.trailerPath) actions.append(actionButton("Anteprima trailer", () => openTrailerPreview(id)));
      actions.append(actionButton(product.trailerPath ? "Sostituisci trailer" : "Carica trailer", () => chooseProductTrailer(id)));
      actions.append(actionButton("Scarica file originale", () => downloadOriginal(id)));
      if (qrReady) {
        actions.append(actionButton("Scarica QR SVG", () => downloadQr(product.qrCodePath, id)));
        if (product.publicUrl) {
          const preview = document.createElement("a");
          preview.href = product.publicUrl;
          preview.target = "_blank";
          preview.rel = "noopener";
          preview.textContent = "Apri pagina prodotto";
          preview.className = "button-link";
          actions.append(withActionHelp(preview, "Apri pagina prodotto"));
        }
      }
      actions.append(actionButton("Modifica", () => openEditProduct(id, product)));
      if (!archived) {
        actions.append(actionButton("Duplica", () => duplicateProductFromList(id, product.name)));
        actions.append(actionButton("Carica revisione", () => chooseRevision(id, product)));
        actions.append(actionButton("Cancella", () => archiveProductFromList(id, product.name), "danger-button"));
      } else {
        actions.append(actionButton("Ripristina", () => restoreArchivedProduct(id)));
      }
      mainColumn.append(title, meta);
      row.append(mainColumn, secondary, description);
      if (type === "audiobook" && product.audiobookPackage?.tracks?.length) {
        const details = document.createElement("details");
        const summary = document.createElement("summary");
        summary.textContent = `Tracce e durata (${product.audiobookPackage.tracks.length})`;
        const list = document.createElement("ol");
        for (const track of product.audiobookPackage.tracks) {
          const item = document.createElement("li");
          item.textContent = `${track.fileName.split('/').pop()} — ${formatDuration(track.durationSeconds)}`;
          list.append(item);
        }
        details.append(summary, list);
        row.append(details);
      }
      for (const button of [...actions.children]) {
        if (button.dataset.helpLabel) { const marker = document.createTextNode(""); button.before(marker); marker.replaceWith(withActionHelp(button, button.dataset.helpLabel)); }
      }
      row.append(actions);
      container.append(row);
    }
    if (!products.length) {
      const empty = document.createElement("p");
      empty.className = "product-message";
      empty.textContent = "Nessun prodotto in questa sezione.";
      container.append(empty);
    }
  } catch (error) {
    container.textContent = `Errore elenco prodotti: ${error.message}`;
  }
}

function formatDate(value) {
  if (!value?.toDate) return "—";
  return new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "short" }).format(value.toDate());
}

function formatDuration(seconds) {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) return "Da leggere";
  const rounded = Math.round(seconds);
  return `${Math.floor(rounded / 60)} min ${String(rounded % 60).padStart(2, "0")} s`;
}

async function inspectAudioPackage(productId, button) {
  button.disabled = true;
  button.textContent = "Lettura copertina e durate…";
  try {
    await inspectAudiobookPackage({ productId });
  } catch (error) {
    window.alert(error.message || "Non è stato possibile analizzare il pacchetto.");
  } finally {
    await displayUploadedProducts("audiobook", "audioList");
  }
}

function formatCents(value) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(value / 100);
}

async function loadProductSummaries(productIds) {
  const summaries = {};
  for (let offset = 0; offset < productIds.length; offset += 30) {
    try {
      const { data } = await getProductsSummary({ productIds: productIds.slice(offset, offset + 30) });
      Object.assign(summaries, data.summaries || {});
    } catch (error) {
      console.error("Riepilogo vendite non disponibile:", error);
    }
  }
  return summaries;
}

function actionButton(label, handler, extraClass = "") {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  if (extraClass) button.className = extraClass;
  button.addEventListener("click", handler);
  button.dataset.helpLabel = label;
  return button;
}

function refreshProducts() {
  void displayUploadedProducts("ebook", "ebookList");
  void displayUploadedProducts("audiobook", "audioList");
  void displayUploadedProducts("boxbook", "boxList");
  void renderProductSummary();
  void renderTotalQrViewsToday();
}

function getRomeDateKey() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const part = (type) => parts.find((item) => item.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

async function renderProductSummary() {
  const container = document.getElementById("productSummary");
  container.textContent = "Caricamento riepilogo…";
  try {
    const snapshot = await getDocs(collection(db, "products"));
    const products = snapshot.docs
      .map((item) => ({ id: item.id, product: item.data() }))
      .filter(({ product }) => ["ebook", "audiobook", "boxbook"].includes(product.type))
      .sort((a, b) => String(a.product.name || a.id).localeCompare(String(b.product.name || b.id), "it"));
    if (!products.length) {
      container.textContent = "Non ci sono ancora prodotti.";
      return;
    }
    const summaries = await loadProductSummaries(products.map(({ id }) => id));
    const table = document.createElement("table");
    table.className = "summary-table";
    const head = document.createElement("thead");
    const headerRow = document.createElement("tr");
    ["Titolo", "Prezzo", "Visite", "Download", "Newsletter", "Vendite", "Incasso"]
      .forEach((label) => {
        const cell = document.createElement("th");
        cell.scope = "col";
        cell.textContent = label;
        headerRow.append(cell);
      });
    head.append(headerRow);
    table.append(head);
    const body = document.createElement("tbody");
    for (const { id, product } of products) {
      const summary = summaries[id] || {};
      const row = document.createElement("tr");
      const title = product.name || id;
      const titleCell = document.createElement("td");
      const titleLink = document.createElement("a");
      titleLink.href = `#product-${id}`;
      titleLink.textContent = product.archivedAt ? `${title} (archiviato)` : title;
      titleLink.addEventListener("click", async (event) => {
        event.preventDefault();
        const listId = { ebook: "ebookList", audiobook: "audioList", boxbook: "boxList" }[product.type];
        const showArchived = document.getElementById("showArchivedCheckbox");
        if (product.archivedAt) showArchived.checked = true;
        ["ebookList", "audioList", "boxList"].forEach((id) => {
          document.getElementById(id).style.display = "grid";
        });
        document.getElementById("toggleFilesBtn").textContent = "Nascondi prodotti caricati";
        await displayUploadedProducts(product.type, listId);
        window.location.hash = `product-${id}`;
        document.getElementById(`product-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      titleCell.append(titleLink);
      row.append(titleCell);
      const values = [
        product.accessMode === "free" ? "Gratis" : formatPriceLabel(product.price),
        String(product.counters?.views ?? 0),
        String(product.counters?.downloads ?? 0),
        String(summary.newsletterSubscribers ?? 0),
        String(summary.sales ?? 0),
        formatCents(summary.revenueCents ?? 0)
      ];
      values.forEach((value, index) => {
        const cell = document.createElement("td");
        if (index === 1) {
          cell.textContent = value;
          const dailyViews = document.createElement("small");
          dailyViews.className = "daily-views-detail";
          dailyViews.textContent = `oggi ${product.counters?.viewsDate === getRomeDateKey() ? Number(product.counters?.viewsToday || 0) : 0}`;
          cell.append(document.createElement("br"), dailyViews);
        } else {
          cell.textContent = value;
        }
        row.append(cell);
      });
      body.append(row);
    }
    table.append(body);
    container.replaceChildren(table);
  } catch (error) {
    container.textContent = `Riepilogo non disponibile: ${error.message}`;
  }
}

async function renderTotalDownloads() {
  const total = document.getElementById("totalDownloads");
  try {
    const snapshot = await getDoc(doc(db, "stats", "downloads"));
    const count = snapshot.exists() ? Number(snapshot.data().totalDownloads || 0) : 0;
    total.textContent = `Download totali: ${new Intl.NumberFormat("it-IT").format(count)}`;
  } catch (error) {
    console.error("Unable to load total downloads:", error);
    total.textContent = "Download totali: non disponibili";
  }
}

async function renderTotalQrViewsToday() {
  const total = document.getElementById("todayQrViews");
  if (!total) return;
  try {
    const snapshot = await getDocs(collection(db, "products"));
    const today = getRomeDateKey();
    const count = snapshot.docs.reduce((sum, productSnapshot) => {
      const product = productSnapshot.data();
      if (!["ebook", "audiobook", "boxbook"].includes(product.type)) return sum;
      if (product.counters?.viewsDate !== today) return sum;
      return sum + Number(product.counters?.viewsToday || 0);
    }, 0);
    total.textContent = `Visite QR oggi: ${new Intl.NumberFormat("it-IT").format(count)}`;
  } catch (error) {
    console.error("Unable to load today's QR views:", error);
    total.textContent = "Visite QR oggi: non disponibili";
  }
}

function formatPriceLabel(value) {
  const normalized = Number(String(value ?? "").trim().replace(",", "."));
  return Number.isFinite(normalized)
    ? new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(normalized)
    : "—";
}

async function downloadQr(path, productId) {
  try {
    const { data } = await createProductQrDownloadUrl({ productId });
    triggerDownload(data.downloadUrl);
  } catch (error) {
    window.alert(error.message || `Non è stato possibile scaricare il QR ${path || productId}.`);
  }
}

function triggerDownload(url) {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  frame.style.position = "fixed";
  frame.style.width = "1px";
  frame.style.height = "1px";
  frame.style.opacity = "0";
  frame.src = url;
  document.body.append(frame);
  window.setTimeout(() => frame.remove(), 60_000);
}

async function downloadOriginal(productId) {
  try {
    const { data } = await createProductDownloadUrl({ productId });
    triggerDownload(data.downloadUrl);
  } catch (error) {
    window.alert(error.message || "Non è stato possibile scaricare il file originale.");
  }
}


async function generateAudioPreview(productId, button) {
  button.disabled = true;
  button.textContent = "Elaborazione anteprima…";
  try {
    await generateAudiobookPreview({ productId });
    await displayUploadedProducts("audiobook", "audioList");
    await openAudioPreview(productId);
  } catch (error) {
    window.alert(error.message || "Non è stato possibile generare l’anteprima.");
    await displayUploadedProducts("audiobook", "audioList");
  }
}

async function openAudioPreview(productId) {
  const modal = document.getElementById("audioPreviewModal");
  const player = document.getElementById("audioPreviewPlayer");
  const message = document.getElementById("audioPreviewMessage");
  const publish = document.getElementById("publishAudioPreview");
  closeAudioPreview();
  const request = audioPreviewRequest;
  modal.classList.add("show");
  publish.disabled = true;
  message.textContent = "Caricamento bozza privata…";
  try {
    const { data } = await getAudiobookPreview({ productId });
    if (request !== audioPreviewRequest || !modal.classList.contains("show")) return;
    audioPreviewSelection = { productId, draftId: data.draftId };
    player.src = data.previewUrl;
    player.load();
    const svg = document.getElementById("audioPreviewWaveform");
    svg.replaceChildren();
    (data.peaks || []).forEach((peak, index, peaks) => {
      const bar = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      const step = 200 / peaks.length;
      const height = Math.max(2, peak * 42);
      for (const [key, value] of Object.entries({ x: index * step, y: (48 - height) / 2, width: step * 0.6, height, fill: "#aeb8c7" })) bar.setAttribute(key, value);
      svg.append(bar);
    });
    message.textContent = `Bozza privata di ${Math.round(data.duration)} secondi, con sfumatura finale. Ascoltala prima di pubblicarla sul QRC.`;
    publish.disabled = false;
  } catch (error) {
    if (request !== audioPreviewRequest) return;
    message.textContent = error.message || "Anteprima non disponibile.";
  }
}

function closeAudioPreview() {
  audioPreviewRequest += 1;
  audioPreviewSelection = null;
  const player = document.getElementById("audioPreviewPlayer");
  player.pause();
  player.removeAttribute("src");
  player.load();
  document.getElementById("audioPreviewWaveform").replaceChildren();
  document.getElementById("audioPreviewModal").classList.remove("show");
}

async function updateAudioPublication(productId, published, button, draftId) {
  button.disabled = true;
  try {
    await setAudiobookPreviewPublished({ productId, published, ...(draftId ? { draftId } : {}) });
    closeAudioPreview();
    await displayUploadedProducts("audiobook", "audioList");
  } catch (error) {
    window.alert(error.message || "Pubblicazione non aggiornata.");
  } finally {
    button.disabled = false;
  }
}

document.getElementById("publishAudioPreview").addEventListener("click", (event) => {
  if (audioPreviewSelection) {
    void updateAudioPublication(audioPreviewSelection.productId, true, event.currentTarget, audioPreviewSelection.draftId);
  }
});
document.getElementById("closeAudioPreview").addEventListener("click", closeAudioPreview);
document.getElementById("audioPreviewModal").addEventListener("click", (event) => {
  if (event.target.id === "audioPreviewModal") closeAudioPreview();
});
document.getElementById("audioPreviewPlayer").addEventListener("timeupdate", (event) => {
  const audio = event.currentTarget;
  const progress = audio.duration > 0 ? audio.currentTime / audio.duration : 0;
  const bars = document.getElementById("audioPreviewWaveform").children;
  Array.from(bars).forEach((bar, index) => bar.setAttribute("fill", (index + 0.5) / bars.length <= progress ? "#1d4ed8" : "#aeb8c7"));
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeAudioPreview();
});

async function openTrailerPreview(productId) {
  const modal = document.getElementById("trailerModal");
  const player = document.getElementById("trailerPlayer");
  modal.classList.add("show");
  player.removeAttribute("src");
  player.load();
  try {
    const { data } = await getProductTrailerUrl({ productId });
    player.src = data.previewUrl;
    player.load();
  } catch (error) {
    modal.classList.remove("show");
    window.alert(error.message || "Trailer non disponibile.");
  }
}

function chooseProductTrailer(productId) {
  trailerProductId = productId;
  const input = document.getElementById("productTrailerFileInput");
  input.value = "";
  input.click();
}

document.getElementById("productTrailerFileInput").addEventListener("change", async (event) => {
  const input = event.currentTarget;
  const file = input.files?.[0];
  const productId = trailerProductId;
  trailerProductId = null;
  if (!file || !productId) return;
  if (!file.name.toLowerCase().endsWith(".mp4")) {
    window.alert("Il trailer deve essere un file MP4.");
    return;
  }
  try {
    const { data } = await createProductTrailerUpload({ productId });
    const response = await fetch(data.uploadUrl, { method: "PUT", headers: { "Content-Type": "video/mp4" }, body: file });
    if (!response.ok) throw new Error(`Upload trailer non riuscito (${response.status}).`);
    await recordProductTrailer({ productId, trailerPath: data.trailerPath });
    refreshProducts();
    window.alert("Trailer aggiornato.");
  } catch (error) {
    window.alert(error.message || "Impossibile aggiornare il trailer.");
  } finally {
    input.value = "";
  }
});

function closeTrailerPreview() {
  const player = document.getElementById("trailerPlayer");
  player.pause();
  player.removeAttribute("src");
  player.load();
  document.getElementById("trailerModal").classList.remove("show");
}

document.getElementById("closeTrailerPreview").addEventListener("click", closeTrailerPreview);
document.getElementById("trailerModal").addEventListener("click", (event) => {
  if (event.target.id === "trailerModal") closeTrailerPreview();
});

async function duplicateProductFromList(productId, productName) {
  if (!window.confirm(`Creare una copia indipendente di “${productName || productId}”? Verrà duplicato anche il file originale e sarà creato un nuovo QR.`)) return;
  try {
    const { data } = await duplicateProduct({ productId });
    refreshProducts();
    let qrReady = false;
    for (let attempt = 0; attempt < 15; attempt += 1) {
      const snapshot = await getDoc(doc(db, "products", data.productId));
      if (snapshot.exists() && snapshot.data().qrCodeGeneratedAt) { qrReady = true; break; }
      await new Promise((resolve) => window.setTimeout(resolve, 1000));
    }
    refreshProducts();
    window.alert(qrReady
      ? `Copia pronta: ${data.name}. Il nuovo QR è disponibile nell'elenco.`
      : `Copia creata: ${data.name}. Il QR è ancora in elaborazione.`);
  } catch (error) {
    window.alert(error.message || "Impossibile duplicare il prodotto.");
  }
}

function openEditProduct(productId, product) {
  editingProduct = productId;
  document.getElementById("editProductName").value = product.name || "";
  document.getElementById("editProductDescription").value = product.description || "";
  const priceInput = document.getElementById("editProductPrice");
  priceInput.value = String(product.price ?? "").replace(",", ".");
  priceInput.readOnly = product.accessMode === "free";
  priceInput.min = product.accessMode === "free" ? "0" : "0.01";
  document.getElementById("editProductMessage").textContent = "";
  document.getElementById("editProductModal").classList.add("show");
  document.getElementById("editProductName").focus();
}

document.getElementById("cancelEditProduct").addEventListener("click", () => {
  document.getElementById("editProductModal").classList.remove("show");
  editingProduct = null;
});

document.getElementById("editProductForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!editingProduct) return;
  const saveButton = document.getElementById("saveProductChanges");
  const message = document.getElementById("editProductMessage");
  saveButton.disabled = true;
  message.textContent = "Salvo le modifiche…";
  try {
    await updateProductDetails({
      productId: editingProduct,
      name: document.getElementById("editProductName").value.trim(),
      description: document.getElementById("editProductDescription").value.trim(),
      price: document.getElementById("editProductPrice").value.trim()
    });
    document.getElementById("editProductModal").classList.remove("show");
    editingProduct = null;
    refreshProducts();
  } catch (error) {
    message.textContent = error.message || "Impossibile salvare le modifiche.";
  } finally {
    saveButton.disabled = false;
  }
});

function chooseRevision(productId, product) {
  revisionProduct = { id: productId, product };
  const input = document.getElementById("revisionFileInput");
  input.value = "";
  const currentExtension = String(product.storageFileName || "").split(".").pop().toLowerCase();
  input.accept = product.type === "ebook" ? ".epub,.pdf" : product.type === "audiobook" ? `.${currentExtension}` : ".zip";
  input.click();
}

document.getElementById("revisionFileInput").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file || !revisionProduct) return;
  if (revisionProduct.product.type === "audiobook") {
    const expected = String(revisionProduct.product.storageFileName || "").split(".").pop().toLowerCase();
    if (file.name.split(".").pop().toLowerCase() !== expected) {
      window.alert(`La revisione deve mantenere il formato .${expected} del file originale.`);
      event.target.value = "";
      return;
    }
  }
  if (!window.confirm(`Caricare una nuova versione di “${revisionProduct.product.name || revisionProduct.id}”? Il file pubblicato verrà sostituito.`)) return;
  try {
    const contentType = file.type || "application/octet-stream";
    const { data } = await createProductRevisionUpload({ productId: revisionProduct.id, contentType });
    const upload = await fetch(data.uploadUrl, { method: "PUT", headers: { "Content-Type": contentType }, body: file });
    if (!upload.ok) throw new Error(`Upload non riuscito (${upload.status}).`);
    await recordProductRevision({ productId: revisionProduct.id });
    window.alert("Revisione caricata. Il QR rimane invariato e continua a puntare alla stessa pagina.");
    refreshProducts();
  } catch (error) {
    window.alert(error.message || "Impossibile caricare la revisione.");
  } finally {
    revisionProduct = null;
    event.target.value = "";
  }
});

async function archiveProductFromList(productId, productName) {
  const confirmed = window.confirm(`Archiviare “${productName || productId}”? Non sarà più acquistabile. I file e lo storico degli ordini saranno conservati.`);
  if (!confirmed) return;
  try {
    await archiveProduct({ productId });
    refreshProducts();
  } catch (error) {
    window.alert(error.message || "Impossibile archiviare il prodotto.");
  }
}

async function restoreArchivedProduct(productId) {
  try {
    await restoreProduct({ productId });
    refreshProducts();
  } catch (error) {
    window.alert(error.message || "Impossibile ripristinare il prodotto.");
  }
}

function bind(button, folder, type) {
  document.getElementById(button).addEventListener("click", () => uploadProduct({
    fileInput: folder.file, trailerInput: folder.trailer, accessInput: folder.access, nameInput: folder.name, descriptionInput: folder.description,
    priceInput: folder.price, message: folder.message, result: folder.result, type
  }));
}

bind("uploadEbookButton", { file: "ebookInput", trailer: "ebookTrailerInput", access: "ebookAccessMode", name: "ebookName", description: "ebookDescription", price: "ebookPrice", message: "ebookMessage", result: "ebookFileId" }, "ebook");
bind("uploadaudiobookButton", { file: "audiobookInput", trailer: "audiobookTrailerInput", access: "audiobookAccessMode", name: "audiobookName", description: "audiobookDescription", price: "audiobookPrice", message: "audiobookMessage", result: "audiobookFileId" }, "audiobook");
bind("uploadfileZipButton", { file: "fileZipInput", trailer: "boxbookTrailerInput", access: "boxbookAccessMode", name: "boxbookName", description: "boxbookDescription", price: "fileZipPrice", message: "fileZipMessage", result: "boxbookFileId" }, "boxbook");

for (const [accessId, priceId] of [["ebookAccessMode", "ebookPrice"], ["audiobookAccessMode", "audiobookPrice"], ["boxbookAccessMode", "fileZipPrice"]]) {
  const access = document.getElementById(accessId);
  const price = document.getElementById(priceId);
  access.addEventListener("change", () => {
    const free = access.value === "free";
    price.readOnly = free;
    price.min = free ? "0" : "0.01";
    price.placeholder = free ? "Gratis" : "Prezzo in EUR";
    if (free) price.value = "0";
    else if (price.value === "0") price.value = "";
  });
}

const toggleBtn = document.getElementById("toggleFilesBtn");
const fileSections = ["ebookList", "audioList", "boxList"];
toggleBtn.addEventListener("click", () => {
  const show = fileSections.some((id) => window.getComputedStyle(document.getElementById(id)).display === "none");
  fileSections.forEach((id) => { document.getElementById(id).style.display = show ? "grid" : "none"; });
  toggleBtn.textContent = show ? "Nascondi prodotti caricati" : "Mostra prodotti caricati";
});
document.getElementById("showArchivedCheckbox").addEventListener("change", refreshProducts);

refreshProducts();
void renderTotalDownloads();
void renderTotalQrViewsToday();

const actionDescriptions = {
  "Estrai copertina e durate": "Legge cover.jpg e la durata delle tracce nello ZIP. Aggiorna la copertina e i dati del prodotto senza modificare il file originale.",
  "Genera anteprima": "Crea una bozza privata di 120 secondi dall’inizio del capitolo 001, con sfumatura finale di 5 secondi. Potrai ascoltarla prima di pubblicarla.",
  "Rigenera anteprima": "Sostituisce la bozza privata con un nuovo estratto di 120 secondi e sfumatura di 5 secondi. L’anteprima già pubblicata resta visibile finché non pubblichi la nuova bozza.",
  "Ascolta / pubblica anteprima": "Apre la bozza privata con la forma d’onda. Ascoltala e premi Pubblica anteprima sul QRC per mostrarla ai visitatori.",
  "Ritira anteprima": "Nasconde il campione audio dalla scheda pubblica. La bozza privata rimane disponibile nel backend.",
  "Carica trailer": "Seleziona un video MP4 opzionale da mostrare nella scheda pubblica del prodotto, anche per gli audiobook.",
  "Sostituisci trailer": "Carica un nuovo video MP4 al posto del trailer attuale.",
  "Anteprima trailer": "Riproduce il trailer caricato per questo prodotto.",
  "Scarica file originale": "Scarica il pacchetto originale caricato, per verificarne il contenuto. Non è un download cliente.",
  "Scarica QR SVG": "Scarica il QR in formato vettoriale SVG, adatto anche alla stampa. Il QR apre la pagina stabile del prodotto.",
  "Apri pagina prodotto": "Apre in una nuova scheda la pagina pubblica che vedrà chi scansiona il QR.",
  "Modifica": "Modifica titolo, descrizione e prezzo del prodotto.",
  "Duplica": "Crea una copia del prodotto da configurare separatamente, con un nuovo identificativo e QR.",
  "Carica revisione": "Sostituisce il file scaricabile con una nuova versione, mantenendo lo stesso prodotto e il suo QR.",
  "Cancella": "Archivia il prodotto e lo ritira dalla vendita. Puoi ritrovarlo con Mostra anche gli archiviati e ripristinarlo.",
  "Ripristina": "Ripristina un prodotto archiviato."
};
function withActionHelp(control, label) {
  const text = actionDescriptions[label];
  if (!text) return control;
  control.title = text;
  const wrapper = document.createElement("span");
  wrapper.className = "action-with-help";
  const help = document.createElement("button");
  help.type = "button";
  help.className = "action-help";
  help.textContent = "?";
  help.setAttribute("aria-label", `Aiuto: ${label}`);
  help.addEventListener("click", () => {
    document.getElementById("actionHelpTitle").textContent = label;
    document.getElementById("actionHelpText").textContent = text;
    document.getElementById("actionHelpDialog").showModal();
  });
  wrapper.append(control, help);
  return wrapper;
}
for (const id of ["coverDialog", "actionHelpDialog"]) {
  const dialog = document.getElementById(id);
  dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
}
document.getElementById("enlargedCover").addEventListener("click", () => document.getElementById("coverDialog").close());
