import { app } from "./firebase-config.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.19.1/firebase-auth.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/9.19.1/firebase-functions.js";

const auth = getAuth(app);
const functions = getFunctions(app, "us-central1");
const getDownloadReport = httpsCallable(functions, "getDownloadReport");
const pageStatus = document.getElementById("pageStatus");
const report = document.getElementById("report");
const rowsBody = document.getElementById("downloadRows");
const pageSize = 20;
const items = [];
let cursor = null;
let hasMore = true;
let loading = false;
let currentPage = 1;

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.replace("/uploadfile/login_upload.html");
    return;
  }

  try {
    const token = await user.getIdTokenResult();
    if (token.claims.admin !== true) {
      pageStatus.textContent = "Questa pagina è riservata agli amministratori.";
      pageStatus.classList.add("error");
      return;
    }
    report.hidden = false;
    pageStatus.textContent = "Accesso amministratore verificato.";
    await loadAllPages();
  } catch (error) {
    pageStatus.textContent = `Impossibile caricare il report: ${error.message}`;
    pageStatus.classList.add("error");
  }
});

async function loadAllPages() {
  while (hasMore) {
    await loadNextPage();
    pageStatus.textContent = `Caricamento download… ${new Intl.NumberFormat("it-IT").format(items.length)} acquisiti.`;
  }
  pageStatus.textContent = `Report aggiornato: ${new Intl.NumberFormat("it-IT").format(items.length)} download caricati.`;
  render();
}

async function loadNextPage() {
  if (loading || !hasMore) return;
  loading = true;
  try {
    const response = await getDownloadReport({ cursor });
    const result = response.data || {};
    items.push(...(Array.isArray(result.items) ? result.items : []));
    cursor = result.nextCursor || null;
    hasMore = result.hasMore === true;
    updateProductOptions();
    render();
  } catch (error) {
    throw error;
  } finally {
    loading = false;
  }
}

function updateProductOptions() {
  const select = document.getElementById("productFilter");
  const selected = select.value;
  const products = new Map(items.map((item) => [item.productId, item.productName]));
  select.replaceChildren(new Option("Tutti i prodotti", ""));
  [...products.entries()]
    .sort((a, b) => String(a[1]).localeCompare(String(b[1]), "it"))
    .forEach(([id, name]) => select.add(new Option(`${name} (${id})`, id)));
  select.value = selected;
}

function getFilteredItems() {
  const search = document.getElementById("searchFilter").value.trim().toLowerCase();
  const productId = document.getElementById("productFilter").value;
  const from = document.getElementById("dateFrom").value;
  const to = document.getElementById("dateTo").value;
  return items.filter((item) => {
    if (productId && item.productId !== productId) return false;
    const day = dateKey(item.downloadedAt);
    if (from && day < from) return false;
    if (to && day > to) return false;
    if (search) {
      const searchable = [item.email, item.productName, item.productId, item.paymentIntentId, item.source]
        .filter(Boolean).join(" ").toLowerCase();
      if (!searchable.includes(search)) return false;
    }
    return true;
  });
}

function render() {
  const filtered = getFilteredItems();
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  currentPage = Math.min(Math.max(currentPage, 1), pageCount);
  const firstIndex = (currentPage - 1) * pageSize;
  const pageItems = filtered.slice(firstIndex, firstIndex + pageSize);
  rowsBody.replaceChildren(...pageItems.map((item, index) => createRow(item, firstIndex + index + 1)));
  document.getElementById("emptyState").hidden = filtered.length > 0;
  const uniqueCustomers = new Set(filtered.map((item) => item.email).filter(Boolean));
  const paidOrders = new Map();
  filtered.forEach((item) => {
    if (item.paymentIntentId && item.paymentStatus === "completed" && !paidOrders.has(item.paymentIntentId)) {
      paidOrders.set(item.paymentIntentId, item);
    }
  });
  const revenueCents = [...paidOrders.values()].reduce((sum, item) => sum + Number(item.amount || 0), 0);
  document.getElementById("statDownloads").textContent = formatNumber(filtered.length);
  document.getElementById("statCustomers").textContent = formatNumber(uniqueCustomers.size);
  document.getElementById("statOrders").textContent = formatNumber(paidOrders.size);
  document.getElementById("statRevenue").textContent = formatMoney(revenueCents, "EUR");
  const shownFrom = filtered.length ? firstIndex + 1 : 0;
  const shownTo = Math.min(firstIndex + pageSize, filtered.length);
  document.getElementById("pageInfo").textContent = `Risultati ${formatNumber(shownFrom)}–${formatNumber(shownTo)} di ${formatNumber(filtered.length)} · ${formatNumber(pageSize)} per pagina.`;
  document.getElementById("paginationInfo").textContent = `Pagina ${formatNumber(currentPage)} / ${formatNumber(pageCount)}`;
  document.getElementById("firstPage").disabled = currentPage === 1;
  document.getElementById("previousPage").disabled = currentPage === 1;
  document.getElementById("nextPage").disabled = currentPage === pageCount;
  document.getElementById("lastPage").disabled = currentPage === pageCount;
}

function createRow(item, rowNumber) {
  const row = document.createElement("tr");
  const numberCell = appendCell(row, formatNumber(rowNumber));
  numberCell.className = "row-number";
  appendCell(row, formatDate(item.downloadedAt));
  const emailCell = appendCell(row, item.email || "Utente anonimo");
  emailCell.className = "email";
  appendCell(row, `${item.productName}${item.productId ? ` (${item.productId})` : ""}`);
  appendCell(row, formatDate(item.purchasedAt));
  appendCell(row, item.amount == null ? "—" : formatMoney(item.amount, item.currency || "EUR"));
  appendCell(row, newsletterLabel(item));
  appendCell(row, item.source || "—");

  const detailsCell = document.createElement("td");
  const details = document.createElement("details");
  const summary = document.createElement("summary");
  summary.textContent = "Apri";
  details.append(summary);
  const content = document.createElement("div");
  content.className = "details-body";
  const customer = item.customer || {};
  const detailLines = [
    ["Stato pagamento", item.paymentStatus || "Nessun pagamento associato"],
    ["Tipo prodotto", item.productType || "—"],
    ["Disponibilità", item.accessMode === "free" ? "Pubblico / gratuito" : "Protetto / a pagamento"],
    ["Consenso newsletter", newsletterLabel(item)],
    ["Iscrizione newsletter attiva", customer.subscribed ? "Sì" : "No"],
    ["Origine iscrizione", customer.subscriberSource || "—"],
    ["Iscrizione creata", formatDate(customer.subscribedAt)],
    ["Primo acquisto", formatDate(customer.firstPurchaseAt)],
    ["Ultimo acquisto", formatDate(customer.lastPurchaseAt)],
    ["Ordini totali cliente", formatNumber(customer.totalOrders || 0)],
    ["Spesa totale cliente", formatMoney(customer.totalSpent || 0, "EUR")],
    ["Altri prodotti acquistati", (customer.products || []).join(", ") || "—"],
    ["Aggiornamento cliente", formatDate(customer.updatedAt)],
    ["ID evento download", item.downloadId || "—"],
    ["ID pagamento Stripe", item.paymentIntentId || "—"],
    ["ID offerta", item.offerId || "—"],
    ["Download completato registrato", item.fulfilled ? "Sì" : "No"]
  ];
  detailLines.forEach(([label, value]) => {
    const line = document.createElement("p");
    const strong = document.createElement("strong");
    strong.textContent = `${label}: `;
    line.append(strong, document.createTextNode(String(value)));
    content.append(line);
  });
  details.append(content);
  detailsCell.append(details);
  row.append(detailsCell);
  return row;
}

function appendCell(row, text) {
  const cell = document.createElement("td");
  cell.textContent = String(text);
  row.append(cell);
  return cell;
}

function newsletterLabel(item) {
  if (item.newsletterConsent === null || item.newsletterConsent === undefined) return "Non registrato";
  if (!item.newsletterConsent) return "No";
  return item.customer?.subscribed ? "Sì · attiva" : "Sì · non attiva";
}

function dateKey(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(date);
  const part = (type) => parts.find((entry) => entry.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Rome" }).format(date);
}

function formatNumber(value) {
  return new Intl.NumberFormat("it-IT").format(value);
}

function formatMoney(cents, currency) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency }).format(Number(cents || 0) / 100);
}

function csvSafe(value) {
  let text = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function exportCsv() {
  const headers = ["scaricato_il", "email", "prodotto", "product_id", "tipo", "disponibilita", "stato_pagamento", "acquistato_il", "importo_cent", "valuta", "newsletter_consenso", "newsletter_attiva", "origine", "payment_intent_id", "download_id", "offer_id", "ordini_cliente", "spesa_cliente_cent", "prodotti_cliente"];
  const values = getFilteredItems().map((item) => [
    item.downloadedAt, item.email, item.productName, item.productId, item.productType, item.accessMode,
    item.paymentStatus, item.purchasedAt, item.amount, item.currency, item.newsletterConsent,
    item.customer?.subscribed, item.source, item.paymentIntentId, item.downloadId, item.offerId,
    item.customer?.totalOrders, item.customer?.totalSpent, (item.customer?.products || []).join(" | ")
  ]);
  const csv = [headers, ...values].map((row) => row.map(csvSafe).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `asarati-download-${dateKey(new Date()) || "report"}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function renderFromFirstPage() {
  currentPage = 1;
  render();
}

document.getElementById("firstPage").addEventListener("click", () => { currentPage = 1; render(); });
document.getElementById("previousPage").addEventListener("click", () => { currentPage -= 1; render(); });
document.getElementById("nextPage").addEventListener("click", () => { currentPage += 1; render(); });
document.getElementById("lastPage").addEventListener("click", () => {
  currentPage = Math.max(1, Math.ceil(getFilteredItems().length / pageSize));
  render();
});
document.getElementById("searchFilter").addEventListener("input", renderFromFirstPage);
document.getElementById("productFilter").addEventListener("change", renderFromFirstPage);
document.getElementById("dateFrom").addEventListener("change", renderFromFirstPage);
document.getElementById("dateTo").addEventListener("change", renderFromFirstPage);
document.getElementById("clearFilters").addEventListener("click", () => {
  document.getElementById("searchFilter").value = "";
  document.getElementById("productFilter").value = "";
  document.getElementById("dateFrom").value = "";
  document.getElementById("dateTo").value = "";
  renderFromFirstPage();
});
document.getElementById("exportCsv").addEventListener("click", exportCsv);
