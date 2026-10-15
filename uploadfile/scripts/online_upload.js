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

async function uploadProduct({ fileInput, trailerInput, nameInput, descriptionInput, priceInput, message, result, type }) {
  const file = document.getElementById(fileInput).files[0];
  const trailerFile = trailerInput ? document.getElementById(trailerInput).files[0] : null;
  const name = document.getElementById(nameInput).value.trim();
  const description = document.getElementById(descriptionInput).value.trim();
  const price = document.getElementById(priceInput).value.trim();
  const messageEl = document.getElementById(message);
  const resultEl = document.getElementById(result);
  messageEl.textContent = "";
  resultEl.replaceChildren();

  if (!auth.currentUser) return messageEl.textContent = "Accedi con un account amministratore.";
  const allowedExtensions = {
    ebook: ["epub", "pdf", "zip"],
    audiobook: ["mp3", "m4a", "m4b", "mp4", "zip"],
    boxbook: ["zip", "mp4"]
  };
  const extension = file?.name.split(".").pop().toLowerCase();
  if (!file || !allowedExtensions[type]?.includes(extension) || (trailerFile && !trailerFile.name.toLowerCase().endsWith(".mp4")) || !name || !description || !/^\d+([.,]\d{1,2})?$/.test(price)) {
    return messageEl.textContent = "Controlla file, estensione, titolo, descrizione e prezzo. Il trailer deve essere MP4.";
  }

  const draftKey = `product-upload:${name}:${file.name}:${file.lastModified}`;
  const productId = sessionStorage.getItem(draftKey) || makeProductId(name);
  sessionStorage.setItem(draftKey, productId);
  const contentType = file.type || "application/octet-stream";
  messageEl.textContent = "Creo il prodotto e preparo l'upload sicuro…";
  try {
    const response = await createProductUpload({
      productId, name, description, type, price,
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
    messageEl.textContent = "Prodotto pubblicato. QR e pagina stabile sono pronti.";
    sessionStorage.removeItem(draftKey);
    if (trailerInput) document.getElementById(trailerInput).value = "";
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
      const qrReady = Boolean(product.qrCodeGeneratedAt && product.qrCodePath);
      const title = document.createElement("h3");
      title.textContent = product.name || id;
      const isActive = product.active === true || product.active === "true";
      const status = archived ? "Archiviato" : isActive ? "Attivo" : qrReady ? "In attesa di attivazione" : "In elaborazione QR";
      const meta = document.createElement("div");
      meta.className = "product-meta";
      const createdBy = product.createdBy || {};
      const updatedBy = product.updatedBy || {};
      const summary = summaries[id] || {};
      const values = [
        ["Prezzo", `${product.price || "—"} €`], ["Stato", status],
        ["Caricato il", formatDate(product.createdAt)], ["Caricato da", createdBy.email || "Non registrato"],
        ["ID autore", createdBy.uid || "Non registrato"], ["ID prodotto", id],
        ["Trailer", product.trailerPath ? "Personalizzato" : "Trailer generale"],
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
        meta.append(item);
      }
      const description = document.createElement("p");
      description.className = "product-message";
      description.textContent = product.description || "Nessuna descrizione";
      const actions = document.createElement("div");
      actions.className = "product-actions";

      actions.append(actionButton("Anteprima trailer", () => openTrailerPreview(id)));
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
          actions.append(preview);
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
      row.append(title, meta, description, actions);
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
  return button;
}

function refreshProducts() {
  void displayUploadedProducts("ebook", "ebookList");
  void displayUploadedProducts("audiobook", "audioList");
  void displayUploadedProducts("boxbook", "boxList");
  void renderProductSummary();
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
        formatPriceLabel(product.price),
        String(product.counters?.views ?? 0),
        String(product.counters?.downloads ?? 0),
        String(summary.newsletterSubscribers ?? 0),
        String(summary.sales ?? 0),
        formatCents(summary.revenueCents ?? 0)
      ];
      values.forEach((value) => {
        const cell = document.createElement("td");
        cell.textContent = value;
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
  document.getElementById("editProductPrice").value = String(product.price || "").replace(",", ".");
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
  input.accept = product.type === "ebook" ? ".epub,.pdf" : product.type === "audiobook" ? ".mp3,audio/*" : ".zip";
  input.click();
}

document.getElementById("revisionFileInput").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file || !revisionProduct) return;
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
    fileInput: folder.file, trailerInput: folder.trailer, nameInput: folder.name, descriptionInput: folder.description,
    priceInput: folder.price, message: folder.message, result: folder.result, type
  }));
}

bind("uploadEbookButton", { file: "ebookInput", trailer: "ebookTrailerInput", name: "ebookName", description: "ebookDescription", price: "ebookPrice", message: "ebookMessage", result: "ebookFileId" }, "ebook");
bind("uploadaudiobookButton", { file: "audiobookInput", trailer: "audiobookTrailerInput", name: "audiobookName", description: "audiobookDescription", price: "audiobookPrice", message: "audiobookMessage", result: "audiobookFileId" }, "audiobook");
bind("uploadfileZipButton", { file: "fileZipInput", trailer: "boxbookTrailerInput", name: "boxbookName", description: "boxbookDescription", price: "fileZipPrice", message: "fileZipMessage", result: "boxbookFileId" }, "boxbook");

const toggleBtn = document.getElementById("toggleFilesBtn");
const fileSections = ["ebookList", "audioList", "boxList"];
toggleBtn.addEventListener("click", () => {
  const show = fileSections.some((id) => document.getElementById(id).style.display === "none");
  fileSections.forEach((id) => { document.getElementById(id).style.display = show ? "grid" : "none"; });
  toggleBtn.textContent = show ? "Nascondi prodotti caricati" : "Mostra prodotti caricati";
});
document.getElementById("showArchivedCheckbox").addEventListener("change", refreshProducts);

refreshProducts();
void renderTotalDownloads();
