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
const bucket = "asarati-9aafe.firebasestorage.app";
let editingProduct = null;
let revisionProduct = null;

onAuthStateChanged(auth, (user) => {
  document.getElementById("loginModal").classList.toggle("show", !user);
});

function makeProductId(name) {
  const base = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);
  return `${base || "product"}-${crypto.randomUUID().slice(0, 8)}`;
}

function publicStorageUrl(path) {
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media`;
}

async function uploadProduct({ fileInput, nameInput, descriptionInput, priceInput, message, result, type }) {
  const file = document.getElementById(fileInput).files[0];
  const name = document.getElementById(nameInput).value.trim();
  const description = document.getElementById(descriptionInput).value.trim();
  const price = document.getElementById(priceInput).value.trim();
  const messageEl = document.getElementById(message);
  const resultEl = document.getElementById(result);
  messageEl.textContent = "";
  resultEl.replaceChildren();

  if (!auth.currentUser) return messageEl.textContent = "Accedi con un account amministratore.";
  if (!file || !name || !description || !/^\d+([.,]\d{1,2})?$/.test(price)) {
    return messageEl.textContent = "Inserisci file, titolo, descrizione e prezzo valido.";
  }

  const draftKey = `product-upload:${name}:${file.name}:${file.lastModified}`;
  const productId = sessionStorage.getItem(draftKey) || makeProductId(name);
  sessionStorage.setItem(draftKey, productId);
  const contentType = file.type || "application/octet-stream";
  messageEl.textContent = "Creo il prodotto e preparo l'upload sicuro…";
  try {
    const response = await createProductUpload({ productId, name, description, type, price, fileName: file.name, contentType });
    const { uploadUrl, publicUrl } = response.data;
    const uploaded = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": contentType }, body: file });
    if (!uploaded.ok) throw new Error(`Upload non riuscito (${uploaded.status}).`);

    messageEl.textContent = "File caricato. Attendo la generazione automatica del QR…";
    let ready = false;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const productSnapshot = await getDoc(doc(db, "products", productId));
      if (productSnapshot.exists() && productSnapshot.data().qrCodeGeneratedAt) { ready = true; break; }
      await new Promise((resolve) => window.setTimeout(resolve, 1500));
    }
    if (!ready) throw new Error("Upload completato, ma il QR non è ancora pronto. Riprova tra poco.");
    const qrPath = `public_qrcodes/${productId}.svg`;
    const link = document.createElement("a");
    link.href = publicUrl;
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = `Apri pagina prodotto: ${publicUrl}`;
    const qrPreview = document.createElement("img");
    qrPreview.src = publicStorageUrl(qrPath);
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

      actions.append(actionButton("Anteprima trailer", openTrailerPreview));
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
}

async function downloadQr(path, productId) {
  try {
    const response = await fetch(publicStorageUrl(path));
    if (!response.ok) throw new Error(`Download QR non riuscito (${response.status}).`);
    const objectUrl = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = `${productId}-qr.svg`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  } catch (error) {
    window.alert(error.message || "Non è stato possibile scaricare il QR.");
  }
}

async function downloadOriginal(productId) {
  try {
    const { data } = await createProductDownloadUrl({ productId });
    const link = document.createElement("a");
    link.href = data.downloadUrl;
    link.target = "_blank";
    link.rel = "noopener";
    link.click();
  } catch (error) {
    window.alert(error.message || "Non è stato possibile scaricare il file originale.");
  }
}

function openTrailerPreview() {
  const modal = document.getElementById("trailerModal");
  const player = document.getElementById("trailerPlayer");
  modal.classList.add("show");
  player.src = publicStorageUrl("public_file/trailer.mp4");
  player.load();
}

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
    fileInput: folder.file, nameInput: folder.name, descriptionInput: folder.description,
    priceInput: folder.price, message: folder.message, result: folder.result, type
  }));
}

bind("uploadEbookButton", { file: "ebookInput", name: "ebookName", description: "ebookDescription", price: "ebookPrice", message: "ebookMessage", result: "ebookFileId" }, "ebook");
bind("uploadaudiobookButton", { file: "audiobookInput", name: "audiobookName", description: "audiobookDescription", price: "audiobookPrice", message: "audiobookMessage", result: "audiobookFileId" }, "audiobook");
bind("uploadfileZipButton", { file: "fileZipInput", name: "boxbookName", description: "boxbookDescription", price: "fileZipPrice", message: "fileZipMessage", result: "fileZipFileId" }, "boxbook");

const toggleBtn = document.getElementById("toggleFilesBtn");
const fileSections = ["ebookList", "audioList", "boxList"];
toggleBtn.addEventListener("click", () => {
  const show = fileSections.some((id) => document.getElementById(id).style.display === "none");
  fileSections.forEach((id) => { document.getElementById(id).style.display = show ? "grid" : "none"; });
  toggleBtn.textContent = show ? "Nascondi prodotti caricati" : "Mostra prodotti caricati";
});
document.getElementById("showArchivedCheckbox").addEventListener("change", refreshProducts);

refreshProducts();
