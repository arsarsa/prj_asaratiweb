// functions/index.js (backend)

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const crypto = require("crypto");
const Stripe = require("stripe");
const QRCode = require("qrcode");
const { Resend } = require("resend");

admin.initializeApp({
  storageBucket: "asarati-9aafe.firebasestorage.app"
});
const db = admin.firestore();
const bucket = admin.storage().bucket("asarati-9aafe.firebasestorage.app");

const { createAudioPreviewHandlers } = require("./audio-preview-functions");
const audioPreviews = createAudioPreviewHandlers({ functions, admin, db, bucket });
exports.generateAudiobookPreview = functions.runWith({ timeoutSeconds: 540, memory: "2GB" }).https.onCall(audioPreviews.generate);
exports.getAudiobookPreview = functions.https.onCall(audioPreviews.preview);
exports.setAudiobookPreviewPublished = functions.runWith({ timeoutSeconds: 120, memory: "256MB" }).https.onCall(audioPreviews.publish);

let resendClient;

function getRuntimeConfig() {
  return functions.config?.() || {};
}

function getStripeSettings() {
  const config = getRuntimeConfig().stripe || {};
  const isTest = config.mode !== "live";
  return {
    config,
    isTest,
    secret: isTest ? config.test_secret : config.live_secret,
    webhookSecret: isTest ? config.test_webhook_secret : config.live_webhook_secret
  };
}

function getStripeClient() {
  const { secret } = getStripeSettings();
  if (!secret) throw new Error("Stripe secret is not configured.");
  return Stripe(secret);
}

function getResendClient() {
  if (resendClient) return resendClient;
  const apiKey = getRuntimeConfig().resend?.key;
  if (!apiKey) throw new Error("Resend API key is not configured.");
  resendClient = new Resend(apiKey);
  return resendClient;
}

// Admin creates a private product draft and receives a one-object signed URL.
// The client never receives Storage read access to paid files.
exports.createProductUpload = functions.https.onCall(async (data, context) => {
  if (!context.auth || context.auth.token.admin !== true) {
    throw new functions.https.HttpsError("permission-denied", "Admin access required.");
  }

  const productId = String(data.productId || "").trim();
  const name = String(data.name || "").trim();
  const type = String(data.type || "").trim();
  const fileName = String(data.fileName || "").trim();
  const description = String(data.description || "").trim();
  const accessMode = String(data.accessMode || "paid");
  const price = accessMode === "free" ? "0" : String(data.price || "").trim().replace(",", ".");
  const categoryByType = { ebook: "eBook", audiobook: "audioBook", boxbook: "boxBook" };
  const extension = fileName.split(".").pop().toLowerCase();
  const allowedExtensions = {
    ebook: ["epub", "pdf", "zip"],
    audiobook: ["mp3", "wav", "m4a", "m4b", "mp4", "zip"],
    boxbook: ["zip", "mp4"]
  };
  const trailerFileName = String(data.trailerFileName || "").trim();
  const hasTrailer = Boolean(trailerFileName);
  if (!/^[a-zA-Z0-9_-]{3,80}$/.test(productId) || !name || !categoryByType[type] || !["paid", "free"].includes(accessMode) ||
      !/^[^/\\]+\.[a-z0-9]{2,5}$/i.test(fileName) || !allowedExtensions[type].includes(extension) ||
      (hasTrailer && !/^[^/\\]+\.mp4$/i.test(trailerFileName)) || !/^\d+(\.\d{1,2})?$/.test(price) ||
      (accessMode === "paid" && Number(price) <= 0) || !description) {
    throw new functions.https.HttpsError("invalid-argument", "Product details are invalid.");
  }

  const storageRoot = accessMode === "free" ? "public_file" : "protected_file";
  const storagePath = `${storageRoot}/${categoryByType[type]}/${productId}`;
  const objectPath = `${storagePath}/${fileName}`;
  const trailerPath = hasTrailer ? `public_file/product_trailers/${productId}.mp4` : null;
  const productRef = db.collection("products").doc(productId);
  const existing = await productRef.get();
  if (existing.exists && (existing.get("active") === true || existing.get("archivedAt"))) {
    throw new functions.https.HttpsError("already-exists", "Product ID already exists.");
  }
  const productData = {
    productId, name, type, description, price, currency: "eur", accessMode, active: false,
    fileName, storageFileName: fileName, storagePath,
    createdBy: { uid: context.auth.uid, email: context.auth.token.email || null },
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    counters: { downloads: 0, total: 0 }
  };
  if (existing.exists) await productRef.set(productData, { merge: true });
  else await productRef.create(productData);
  const offerRef = db.collection("offers").doc(`product_${productId}`);
  await offerRef.set({ productId, name, title: name, slug: productId, campaignId: "qrc", active: false }, { merge: true });

  const [uploadUrl] = await bucket.file(objectPath).getSignedUrl({
    version: "v4", action: "write", expires: Date.now() + 15 * 60 * 1000,
    contentType: String(data.contentType || "application/octet-stream")
  });
  let trailerUploadUrl = null;
  if (hasTrailer) {
    [trailerUploadUrl] = await bucket.file(trailerPath).getSignedUrl({
      version: "v4", action: "write", expires: Date.now() + 15 * 60 * 1000,
      contentType: "video/mp4"
    });
  }
  return { uploadUrl, objectPath, trailerUploadUrl, trailerPath, publicUrl: `https://asaratiqrc.web.app/p/${productId}` };
});

exports.createProductTrailerUpload = functions.https.onCall(async (data, context) => {
  if (!context.auth || context.auth.token.admin !== true) {
    throw new functions.https.HttpsError("permission-denied", "Admin access required.");
  }
  const productId = String(data.productId || "").trim();
  if (!/^[a-zA-Z0-9_-]{3,80}$/.test(productId)) {
    throw new functions.https.HttpsError("invalid-argument", "Product ID is invalid.");
  }
  const productRef = db.collection("products").doc(productId);
  const snapshot = await productRef.get();
  if (!snapshot.exists) throw new functions.https.HttpsError("not-found", "Product not found.");
  const trailerPath = `public_file/product_trailers/${productId}.mp4`;
  const [uploadUrl] = await bucket.file(trailerPath).getSignedUrl({
    version: "v4", action: "write", expires: Date.now() + 15 * 60 * 1000,
    contentType: "video/mp4"
  });
  return { uploadUrl, trailerPath };
});

exports.getProductTrailerUrl = functions.https.onCall(async (data, context) => {
  if (!context.auth || context.auth.token.admin !== true) {
    throw new functions.https.HttpsError("permission-denied", "Admin access required.");
  }
  const productId = String(data.productId || "").trim();
  if (!/^[a-zA-Z0-9_-]{3,80}$/.test(productId)) {
    throw new functions.https.HttpsError("invalid-argument", "Product ID is invalid.");
  }
  const snapshot = await db.collection("products").doc(productId).get();
  if (!snapshot.exists) throw new functions.https.HttpsError("not-found", "Product not found.");
  const configuredPath = snapshot.get("trailerPath");
  const trailerPath = typeof configuredPath === "string" && configuredPath === `public_file/product_trailers/${productId}.mp4`
    ? configuredPath
    : "public_file/trailer.mp4";
  const [exists] = await bucket.file(trailerPath).exists();
  if (!exists) throw new functions.https.HttpsError("not-found", "Trailer non disponibile per questo prodotto.");
  const [previewUrl] = await bucket.file(trailerPath).getSignedUrl({
    version: "v4", action: "read", expires: Date.now() + 60 * 60 * 1000
  });
  return { previewUrl };
});

exports.recordProductTrailer = functions.https.onCall(async (data, context) => {
  if (!context.auth || context.auth.token.admin !== true) {
    throw new functions.https.HttpsError("permission-denied", "Admin access required.");
  }
  const productId = String(data.productId || "").trim();
  const trailerPath = `public_file/product_trailers/${productId}.mp4`;
  if (!/^[a-zA-Z0-9_-]{3,80}$/.test(productId) || data.trailerPath !== trailerPath) {
    throw new functions.https.HttpsError("invalid-argument", "Trailer path is invalid.");
  }
  const [exists] = await bucket.file(trailerPath).exists();
  if (!exists) throw new functions.https.HttpsError("not-found", "Trailer upload was not found.");
  await db.collection("products").doc(productId).update({
    trailerPath,
    trailerUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy: { uid: context.auth.uid, email: context.auth.token.email || null }
  });
  return { success: true, trailerPath };
});

exports.createProductQrDownloadUrl = functions.https.onCall(async (data, context) => {
  if (!context.auth || context.auth.token.admin !== true) {
    throw new functions.https.HttpsError("permission-denied", "Admin access required.");
  }
  const productId = String(data.productId || "").trim();
  if (!/^[a-zA-Z0-9_-]{3,80}$/.test(productId)) {
    throw new functions.https.HttpsError("invalid-argument", "Product ID is invalid.");
  }
  const snapshot = await db.collection("products").doc(productId).get();
  if (!snapshot.exists) throw new functions.https.HttpsError("not-found", "Product not found.");
  const qrPath = `public_qrcodes/${productId}.svg`;
  if (snapshot.get("qrCodePath") !== qrPath || !snapshot.get("qrCodeGeneratedAt")) {
    throw new functions.https.HttpsError("failed-precondition", "QR code is not ready.");
  }
  const [exists] = await bucket.file(qrPath).exists();
  if (!exists) throw new functions.https.HttpsError("not-found", "QR code file is missing.");
  const [downloadUrl] = await bucket.file(qrPath).getSignedUrl({
    version: "v4", action: "read", expires: Date.now() + 5 * 60 * 1000,
    responseDisposition: `attachment; filename="${productId}-qr.svg"`
  });
  const [previewUrl] = await bucket.file(qrPath).getSignedUrl({
    version: "v4", action: "read", expires: Date.now() + 5 * 60 * 1000,
    responseDisposition: "inline"
  });
  return { downloadUrl, previewUrl };
});

exports.updateProductDetails = functions.https.onCall(async (data, context) => {
  if (!context.auth || context.auth.token.admin !== true) {
    throw new functions.https.HttpsError("permission-denied", "Admin access required.");
  }

  const productId = String(data.productId || "").trim();
  const name = String(data.name || "").trim();
  const description = String(data.description || "").trim();
  const price = String(data.price || "").trim().replace(",", ".");
  if (!productId || !name || !description || !/^\d+(\.\d{1,2})?$/.test(price)) {
    throw new functions.https.HttpsError("invalid-argument", "Product details are invalid.");
  }

  const productRef = db.collection("products").doc(productId);
  const product = await productRef.get();
  if (!product.exists) throw new functions.https.HttpsError("not-found", "Product not found.");
  const accessMode = product.get("accessMode") || "paid";
  if ((accessMode === "free" && Number(price) !== 0) || (accessMode !== "free" && Number(price) <= 0)) {
    throw new functions.https.HttpsError("invalid-argument", accessMode === "free"
      ? "I prodotti gratuiti devono avere prezzo zero."
      : "Il prezzo di un prodotto a pagamento deve essere maggiore di zero.");
  }

  const editor = { uid: context.auth.uid, email: context.auth.token.email || null };
  await productRef.update({
    name, description, price,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy: editor
  });
  await db.collection("offers").doc(`product_${productId}`).set({
    name, title: name
  }, { merge: true });
  return { success: true };
});

exports.createProductRevisionUpload = functions.https.onCall(async (data, context) => {
  if (!context.auth || context.auth.token.admin !== true) {
    throw new functions.https.HttpsError("permission-denied", "Admin access required.");
  }

  const productId = String(data.productId || "").trim();
  const productRef = db.collection("products").doc(productId);
  const productSnapshot = await productRef.get();
  if (!productSnapshot.exists) throw new functions.https.HttpsError("not-found", "Product not found.");
  const product = productSnapshot.data();
  if (product.archivedAt || !product.storagePath || !product.storageFileName) {
    throw new functions.https.HttpsError("failed-precondition", "Restore the product before uploading a revision.");
  }
  const categoryByType = { ebook: "eBook", audiobook: "audioBook", boxbook: "boxBook" };
  const root = (product.accessMode || "paid") === "free" ? "public_file" : "protected_file";
  if (!categoryByType[product.type] || product.storagePath !== `${root}/${categoryByType[product.type]}/${productId}` || /[\\/]/.test(product.storageFileName)) {
    throw new functions.https.HttpsError("failed-precondition", "Product file path is invalid.");
  }

  const contentType = String(data.contentType || "application/octet-stream");
  const objectPath = `${product.storagePath}/${product.storageFileName}`;
  const [uploadUrl] = await bucket.file(objectPath).getSignedUrl({
    version: "v4", action: "write", expires: Date.now() + 15 * 60 * 1000, contentType
  });
  return { uploadUrl, objectPath };
});

exports.recordProductRevision = functions.https.onCall(async (data, context) => {
  if (!context.auth || context.auth.token.admin !== true) {
    throw new functions.https.HttpsError("permission-denied", "Admin access required.");
  }
  const productId = String(data.productId || "").trim();
  const productRef = db.collection("products").doc(productId);
  const product = await productRef.get();
  if (!product.exists) throw new functions.https.HttpsError("not-found", "Product not found.");
  const editor = { uid: context.auth.uid, email: context.auth.token.email || null };
  await productRef.update({
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy: editor,
    revisedAt: admin.firestore.FieldValue.serverTimestamp(),
    revisedBy: editor
  });
  return { success: true };
});

exports.archiveProduct = functions.https.onCall(async (data, context) => {
  if (!context.auth || context.auth.token.admin !== true) {
    throw new functions.https.HttpsError("permission-denied", "Admin access required.");
  }
  const productId = String(data.productId || "").trim();
  const productRef = db.collection("products").doc(productId);
  const product = await productRef.get();
  if (!product.exists) throw new functions.https.HttpsError("not-found", "Product not found.");
  const editor = { uid: context.auth.uid, email: context.auth.token.email || null };
  const batch = db.batch();
  batch.update(productRef, {
    active: false,
    archivedAt: admin.firestore.FieldValue.serverTimestamp(),
    archivedBy: editor,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy: editor
  });
  batch.set(db.collection("offers").doc(`product_${productId}`), { active: false }, { merge: true });
  await batch.commit();
  return { success: true, archived: true };
});

exports.restoreProduct = functions.https.onCall(async (data, context) => {
  if (!context.auth || context.auth.token.admin !== true) {
    throw new functions.https.HttpsError("permission-denied", "Admin access required.");
  }
  const productId = String(data.productId || "").trim();
  const productRef = db.collection("products").doc(productId);
  const product = await productRef.get();
  if (!product.exists) throw new functions.https.HttpsError("not-found", "Product not found.");
  if (!product.get("qrCodeGeneratedAt")) {
    throw new functions.https.HttpsError("failed-precondition", "The product QR code is not ready.");
  }
  const editor = { uid: context.auth.uid, email: context.auth.token.email || null };
  const batch = db.batch();
  batch.update(productRef, {
    active: true,
    archivedAt: admin.firestore.FieldValue.delete(),
    archivedBy: admin.firestore.FieldValue.delete(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy: editor
  });
  batch.set(db.collection("offers").doc(`product_${productId}`), { active: true }, { merge: true });
  await batch.commit();
  return { success: true, archived: false };
});

exports.createProductDownloadUrl = functions.https.onCall(async (data, context) => {
  if (!context.auth || context.auth.token.admin !== true) {
    throw new functions.https.HttpsError("permission-denied", "Admin access required.");
  }
  const productId = String(data.productId || "").trim();
  const productSnapshot = await db.collection("products").doc(productId).get();
  if (!productSnapshot.exists) throw new functions.https.HttpsError("not-found", "Product not found.");
  const product = productSnapshot.data();
  const categoryByType = { ebook: "eBook", audiobook: "audioBook", boxbook: "boxBook" };
  const category = categoryByType[product.type];
  const root = (product.accessMode || "paid") === "free" ? "public_file" : "protected_file";
  if (!category || !product.storagePath || !product.storageFileName ||
      ![`${root}/${category}`, `${root}/${category}/${productId}`].includes(product.storagePath) ||
      /[\\/]/.test(product.storageFileName)) {
    throw new functions.https.HttpsError("failed-precondition", "Product file path is missing.");
  }
  const fileName = String(product.storageFileName).replace(/[\\"\r\n]/g, "_");
  const [downloadUrl] = await bucket.file(`${product.storagePath}/${product.storageFileName}`).getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + 5 * 60 * 1000,
    responseDisposition: `attachment; filename="${fileName}"`
  });
  return { downloadUrl, fileName };
});

exports.getProductsSummary = functions.https.onCall(async (data, context) => {
  if (!context.auth || context.auth.token.admin !== true) {
    throw new functions.https.HttpsError("permission-denied", "Admin access required.");
  }
  const productIds = [...new Set((Array.isArray(data.productIds) ? data.productIds : [])
    .filter((id) => typeof id === "string" && /^[a-zA-Z0-9_-]{3,80}$/.test(id)))];
  if (productIds.length > 30) {
    throw new functions.https.HttpsError("invalid-argument", "Request at most 30 product IDs at a time.");
  }
  const summaries = Object.fromEntries(productIds.map((id) => [id, {
    sales: 0, revenueCents: 0, newsletterEmails: new Set()
  }]));
  if (!productIds.length) return { summaries };

  const payments = await db.collection("payments").where("productId", "in", productIds).get();
  payments.forEach((payment) => {
    const data = payment.data();
    if (data.status !== "completed" || !summaries[data.productId]) return;
    summaries[data.productId].sales += 1;
    if (Number.isFinite(data.amount)) summaries[data.productId].revenueCents += data.amount;
    if (data.newsletterConsent === true && typeof data.email === "string") {
      summaries[data.productId].newsletterEmails.add(data.email.toLowerCase());
    }
  });
  const activeSubscribers = await db.collection("subscribers").where("subscribed", "==", true).get();
  const activeSubscriberEmails = new Set(activeSubscribers.docs.map((item) =>
    String(item.get("email") || item.id).toLowerCase()
  ));
  Object.keys(summaries).forEach((productId) => {
    const consentedEmails = summaries[productId].newsletterEmails;
    summaries[productId] = {
      sales: summaries[productId].sales,
      revenueCents: summaries[productId].revenueCents,
      newsletterSubscribers: [...consentedEmails].filter((email) => activeSubscriberEmails.has(email)).length
    };
  });
  return { summaries };
});

async function getDocumentsByIds(collectionName, ids) {
  const documents = new Map();
  const uniqueIds = [...new Set(ids.filter((id) => typeof id === "string" && id))];
  for (let offset = 0; offset < uniqueIds.length; offset += 300) {
    const refs = uniqueIds.slice(offset, offset + 300)
      .map((id) => db.collection(collectionName).doc(id));
    if (!refs.length) continue;
    const snapshots = await db.getAll(...refs);
    snapshots.forEach((snapshot) => {
      if (snapshot.exists) documents.set(snapshot.id, snapshot.data());
    });
  }
  return documents;
}

function timestampToIso(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

exports.getDownloadReport = functions.https.onCall(async (data, context) => {
  if (!context.auth || context.auth.token.admin !== true) {
    throw new functions.https.HttpsError("permission-denied", "Admin access required.");
  }

  const pageSize = 100;
  const cursor = data?.cursor;
  let query = db.collection("downloads")
    .orderBy("downloadedAt", "desc")
    .limit(pageSize);

  if (cursor) {
    if (typeof cursor.id !== "string" || !/^[a-zA-Z0-9_-]{1,150}$/.test(cursor.id)) {
      throw new functions.https.HttpsError("invalid-argument", "Download cursor is invalid.");
    }
    const cursorSnapshot = await db.collection("downloads").doc(cursor.id).get();
    if (!cursorSnapshot.exists || !cursorSnapshot.get("downloadedAt")) {
      throw new functions.https.HttpsError("failed-precondition", "Download list changed. Reload the report.");
    }
    query = query.startAfter(cursorSnapshot);
  }

  const downloadSnapshot = await query.get();
  const rows = downloadSnapshot.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }));
  const paymentIds = rows.map((row) => row.paymentIntentId).filter(Boolean);
  const customerEmails = rows.map((row) => String(row.email || "").toLowerCase()).filter(Boolean);
  const productIds = rows.map((row) => row.productId).filter(Boolean);
  const [payments, customers, products, subscribers] = await Promise.all([
    getDocumentsByIds("payments", paymentIds),
    getDocumentsByIds("customers", customerEmails),
    getDocumentsByIds("products", productIds),
    getDocumentsByIds("subscribers", customerEmails)
  ]);

  const items = rows.map((row) => {
    const email = String(row.email || "").toLowerCase();
    const payment = payments.get(row.paymentIntentId) || {};
    const customer = customers.get(email) || {};
    const product = products.get(row.productId) || {};
    const subscriber = subscribers.get(email) || {};
    return {
      downloadId: row.id,
      email: email || null,
      productId: row.productId || null,
      productName: product.name || row.productId || "Prodotto non disponibile",
      productType: product.type || null,
      accessMode: product.accessMode || (String(product.storagePath || "").startsWith("public_file/") ? "free" : "paid"),
      source: row.source || payment.source || null,
      offerId: row.offerId || payment.offerId || null,
      downloadedAt: timestampToIso(row.downloadedAt),
      paymentIntentId: row.paymentIntentId || null,
      paymentStatus: payment.status || null,
      amount: Number.isFinite(payment.amount) ? payment.amount : null,
      currency: payment.currency || null,
      purchasedAt: timestampToIso(payment.created || payment.createdAt),
      fulfilled: payment.fulfilled === true,
      newsletterConsent: typeof payment.newsletterConsent === "boolean" ? payment.newsletterConsent : null,
      customer: email ? {
        firstPurchaseAt: timestampToIso(customer.firstPurchaseAt),
        lastPurchaseAt: timestampToIso(customer.lastPurchaseAt),
        totalOrders: Number(customer.totalOrders || 0),
        totalSpent: Number(customer.totalSpent || 0),
        products: Array.isArray(customer.products) ? customer.products : [],
        updatedAt: timestampToIso(customer.updatedAt),
        subscribed: subscriber.subscribed === true,
        subscriberSource: subscriber.source || null,
        subscribedAt: timestampToIso(subscriber.createdAt),
        subscriberUpdatedAt: timestampToIso(subscriber.updatedAt)
      } : null
    };
  });

  const last = downloadSnapshot.docs.at(-1);
  const hasMore = downloadSnapshot.size === pageSize;
  return {
    items,
    hasMore,
    nextCursor: hasMore && last ? { id: last.id } : null
  };
});

exports.duplicateProduct = functions.https.onCall(async (data, context) => {
  if (!context.auth || context.auth.token.admin !== true) {
    throw new functions.https.HttpsError("permission-denied", "Admin access required.");
  }
  const sourceId = String(data.productId || "").trim();
  const sourceRef = db.collection("products").doc(sourceId);
  const sourceSnapshot = await sourceRef.get();
  if (!sourceSnapshot.exists) throw new functions.https.HttpsError("not-found", "Product not found.");
  const source = sourceSnapshot.data();
  const categoryByType = { ebook: "eBook", audiobook: "audioBook", boxbook: "boxBook" };
  const category = categoryByType[source.type];
  const root = (source.accessMode || "paid") === "free" ? "public_file" : "protected_file";
  if (!category || ![`${root}/${category}`, `${root}/${category}/${sourceId}`].includes(source.storagePath) ||
      !source.storageFileName || /[\\/]/.test(source.storageFileName) || source.archivedAt) {
    throw new functions.https.HttpsError("failed-precondition", "This product cannot be duplicated.");
  }

  const sourcePath = `${source.storagePath}/${source.storageFileName}`;
  const [sourceExists] = await bucket.file(sourcePath).exists();
  if (!sourceExists) throw new functions.https.HttpsError("not-found", "The original product file is missing.");

  const base = String(source.name || sourceId).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 42) || "product";
  const productId = `${base}-copy-${crypto.randomUUID().slice(0, 8)}`;
  const name = `${String(source.name || sourceId).slice(0, 112)} (copia)`;
  const storagePath = `${root}/${category}/${productId}`;
  const destinationPath = `${storagePath}/${source.storageFileName}`;
  const productRef = db.collection("products").doc(productId);
  const offerRef = db.collection("offers").doc(`product_${productId}`);
  const createdBy = { uid: context.auth.uid, email: context.auth.token.email || null };
  const duplicate = {
    ...source,
    productId,
    name,
    active: false,
    storagePath,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy,
    counters: { downloads: 0, total: 0 }
  };
  // A copied product must generate and approve its own preview.
  Object.keys(duplicate).filter((field) => field.startsWith("audioPreview")).forEach((field) => delete duplicate[field]);
  const sourceTrailerPath = source.trailerPath === `public_file/product_trailers/${sourceId}.mp4`
    ? source.trailerPath
    : null;
  const duplicateTrailerPath = sourceTrailerPath
    ? `public_file/product_trailers/${productId}.mp4`
    : null;
  if (duplicateTrailerPath) duplicate.trailerPath = duplicateTrailerPath;
  ["publicUrl", "qrCodePath", "qrCodeGeneratedAt", "archivedAt", "archivedBy", "updatedAt", "updatedBy", "revisedAt", "revisedBy"].forEach((field) => delete duplicate[field]);

  await productRef.create(duplicate);
  await offerRef.set({ productId, name, title: name, slug: productId, campaignId: "qrc", active: false }, { merge: true });
  try {
    if (sourceTrailerPath && duplicateTrailerPath) {
      const [trailerExists] = await bucket.file(sourceTrailerPath).exists();
      if (trailerExists) await bucket.file(sourceTrailerPath).copy(bucket.file(duplicateTrailerPath));
      if (!trailerExists) await productRef.update({ trailerPath: admin.firestore.FieldValue.delete() });
    }
    await bucket.file(sourcePath).copy(bucket.file(destinationPath));
  } catch (error) {
    await Promise.allSettled([
      productRef.delete(), offerRef.delete(),
      bucket.file(destinationPath).delete({ ignoreNotFound: true }),
      duplicateTrailerPath ? bucket.file(duplicateTrailerPath).delete({ ignoreNotFound: true }) : Promise.resolve()
    ]);
    throw new functions.https.HttpsError("internal", "Could not copy the product file.");
  }
  return { productId, name, publicUrl: `https://asaratiqrc.web.app/p/${productId}` };
});

// Keep the original us-central1 trigger deployed as a no-op during migration.
// Storage events must be handled in the bucket's europe-west1 location.
exports.generateProductQr = functions.storage.object().onFinalize(async () => null);

exports.generateProductQrEurope = functions.region("europe-west1").storage.object().onFinalize(async (object) => {
  const objectPath = object.name || "";
  const match = objectPath.match(/^(protected_file|public_file)\/(eBook|audioBook|boxBook)\/([a-zA-Z0-9_-]{3,80})\/([^/]+)$/);
  if (!match) return null;
  const [, root, category, productId, fileName] = match;
  const productRef = db.collection("products").doc(productId);
  const productSnapshot = await productRef.get();
  if (!productSnapshot.exists) return null;
  const product = productSnapshot.data();
  if (product.archivedAt) return null;
  const accessMode = product.accessMode || "paid";
  const expectedRoot = accessMode === "free" ? "public_file" : "protected_file";
  const priceCents = priceToMinorUnits(product.price);
  if (root !== expectedRoot || product.storagePath !== `${root}/${category}/${productId}` || product.storageFileName !== fileName ||
      (accessMode === "free" && priceCents !== 0) || (accessMode !== "free" && priceCents <= 0)) return null;

  const publicUrl = `https://asaratiqrc.web.app/p/${productId}`;
  const qrCodePath = `public_qrcodes/${productId}.svg`;
  const svg = await QRCode.toString(publicUrl, { type: "svg", errorCorrectionLevel: "M", margin: 2 });
  await bucket.file(qrCodePath).save(svg, {
    resumable: false,
    metadata: { contentType: "image/svg+xml", cacheControl: "public, max-age=31536000, immutable" }
  });
  await db.collection("offers").doc(`product_${productId}`).update({ active: true });
  await productRef.update({ accessMode, publicUrl, qrCodePath, qrCodeGeneratedAt: admin.firestore.FieldValue.serverTimestamp(), active: true });
  return null;
});

function priceToMinorUnits(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value * 100);
  }

  if (typeof value !== "string") return null;

  const cleaned = value.trim().replace(/[^\d,.-]/g, "");
  const normalized = cleaned.includes(",")
    ? cleaned.replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".")
    : cleaned;
  const parsed = Number(normalized);

  return Number.isFinite(parsed) && parsed >= 0
    ? Math.round(parsed * 100)
    : null;
}

exports.createPayment = functions.https.onRequest( async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");

  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return res.status(405).send("POST only");

  const {
    productId,
    email,
    newsletterConsent,
    paymentMethod,
    source,
    offerId
  } = req.body;

  const paymentSource = source === "qrc" ? "qrc" : "web";
  const normalizedOfferId =
    typeof offerId === "string" && offerId.trim()
      ? offerId.trim()
      : null;

  switch (
  paymentMethod
) {

  case "stripe":
    break;

  default:

    return res
      .status(400)
      .json({

        error:
          "Metodo pagamento non supportato"
      });
}

// ==========================
// EMAIL NORMALIZATION
// ==========================

  const normalizedEmail =
    email
      ?.trim()
      .toLowerCase();

  const emailRegex =
    /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;

  if (
    !normalizedEmail ||
    !emailRegex.test(
      normalizedEmail
    )
  ) {

    return res
      .status(400)
      .send("Invalid email");
  }

// ==========================
// TYPO CHECK
// ==========================

  const commonTypos = {
    "gmai.com": "gmail.com",
    "gmail,com": "gmail.com",
    "gmial.com": "gmail.com",
    "gnail.com": "gmail.com",
    "hotmial.com": "hotmail.com",
    "icloud.con": "icloud.com",
    "outlok.com": "outlook.com"
  };

  const domain =
    normalizedEmail
      .split("@")[1];

  if (
    commonTypos[domain]
  ) {

    return res
      .status(400)
      .json({
        error:
          "email_typo",

        suggestion:
          normalizedEmail
            .replace(
              domain,
              commonTypos[
                domain
              ]
            )
      });
  }

// ==========================
// VALIDAZIONE PARAMS
// ==========================

  if (!productId) {
    return res
      .status(400)
      .send("Missing params");
  }

  const productSnapshot =
    await db.collection("products")
      .doc(productId)
      .get();

  if (!productSnapshot.exists) {
    return res.status(404).send("Product not found");
  }

  const product = productSnapshot.data();
  if ((product.accessMode || "paid") === "free" || String(product.storagePath || "").startsWith("public_file/")) {
    return res.status(400).send("Il prodotto è gratuito: non è richiesto alcun pagamento");
  }
  if (
    product.active !== undefined &&
    product.active !== true &&
    product.active !== "true"
  ) {
    return res.status(400).send("Product inactive");
  }

  const amount = priceToMinorUnits(product.price);
  if (amount === null || amount <= 0) {
    return res.status(400).send("Invalid product price");
  }

  const currency = String(product.currency || "eur").toLowerCase();
  if (currency !== "eur") {
    return res.status(400).send("Unsupported product currency");
  }

  console.log(
    "🧾 createPayment INPUT:",
    {
      productId,
      email: normalizedEmail,
      amount,
      paymentMethod
    }
  );

  const { isTest } = getStripeSettings();
  console.log(
    "⚙️ MODE:",
    isTest
      ? "TEST"
      : "LIVE"
  );

  try {

    switch (
      paymentMethod
    ) {

      case "stripe":

          return await
          createStripePayment({
            productId,
            productName: product.name || productId,
            normalizedEmail,
            amount,
            currency,
            newsletterConsent,
            source: paymentSource,
            offerId: normalizedOfferId,
            res
          });

      case "paypal":

        return res.json({

          success: false,

          provider:
            "paypal",

          message:
            "PayPal in arrivo"
        });

      case "satispay":

        return res.json({

          success: false,

          provider:
            "satispay",

          message:
            "Satispay in arrivo"
        });

      default:

        return res
          .status(400)
          .json({

            error:
              "Metodo pagamento non supportato"
          });
    }

  } catch (err) {

    console.error(
      "❌ createPayment ERROR:",
      {
        message:
          err.message,

        type:
          err.type,

        code:
          err.code
      }
    );

    return res
      .status(500)
      .send(err.message);
  }
});

exports.checkPaymentStatus = functions.https.onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");

  try {
    const paymentIntentId = req.query.paymentIntentId;

    if (!paymentIntentId) {
      return res.status(400).send("Missing paymentIntentId");
    }

    const doc = await db.collection("payments").doc(paymentIntentId).get();

    if (!doc.exists) {
      return res.json({
        success: false,
        status: "pending"
      });
    }

    const payment = doc.data();

    return res.json({
      success: true,
      status: payment.status,
      productId: payment.productId
    });

  } catch (err) {
    console.error("checkPaymentStatus:", err);
    res.status(500).send("Server error");
  }
});

exports.stripeWebhook = functions.https.onRequest(async (req, res) => {
  console.log("🔥 WEBHOOK RICEVUTO");

  try {
    const { isTest, webhookSecret } = getStripeSettings();
    const sig = req.headers["stripe-signature"];
    console.log("signature presente:", !!sig);

    console.log(
      "🪝 SIGNATURE:",
      sig?.slice(0, 20)
    );

    const event = getStripeClient().webhooks.constructEvent(
      req.rawBody,
      sig,
      webhookSecret
    );

    console.log("evento:", event.type);

if (event.type === "payment_intent.succeeded") {

  const paymentIntent =
    event.data.object;

  // ==========================
  // IDPOTENZA WEBHOOK (evita doppi processamenti)
  // ==========================

  const paymentRef =
    db.collection("payments")
      .doc(paymentIntent.id);

  const existingPayment =
    await paymentRef.get();

  if (
    existingPayment.exists &&
    existingPayment.data()
      .fulfilled === true
  ) {

    console.log(
      "♻️ webhook già processato:",
      paymentIntent.id
    );

    return res.status(200)
      .send("Already processed");
  }

  const metadata =
    paymentIntent.metadata || {};

  const productId =
    metadata.productId || null;

  const source =
    metadata.source === "qrc" ? "qrc" : "web";

  const offerId =
    metadata.offerId || null;

  const email =
    metadata.email?.toLowerCase();

  const newsletterConsent =
    String(
      metadata.newsletterConsent
    ).toLowerCase() === "true";

  console.log(
    "paymentIntent:",
    paymentIntent.id
  );

  console.log(
    "newsletterConsent:",
    newsletterConsent
  );

// ==========================
// 1. REGISTRA PAYMENT
// ==========================

await paymentRef.set({

  provider: "stripe",

  paymentIntentId:
    paymentIntent.id,

  productId,

  source,

  ...(offerId ? { offerId } : {}),

  email,

  amount:
    paymentIntent.amount,

  currency:
    paymentIntent.currency.toUpperCase(),

  status: "completed",

  fulfilled: true,

  fulfilledAt:
    admin.firestore
      .FieldValue
      .serverTimestamp(),

  downloaded: false,

  newsletterConsent,

  created:
    admin.firestore
      .FieldValue
      .serverTimestamp()

},
{
  merge: true
});

// ==========================
// CUSTOMER DB
// ==========================

if (email) {

  const customerRef =
    db.collection("customers")
      .doc(email);

  const customerDoc =
    await customerRef.get();

  const customerData =
    customerDoc.exists
      ? customerDoc.data()
      : null;

  await customerRef.set({

    email,

    firstPurchaseAt:
      customerData
        ?.firstPurchaseAt
      ||
      admin.firestore
        .FieldValue
        .serverTimestamp(),

    lastPurchaseAt:
      admin.firestore
        .FieldValue
        .serverTimestamp(),

    totalOrders:
      admin.firestore
        .FieldValue.increment(1),

    totalSpent:
      admin.firestore
        .FieldValue.increment(
          paymentIntent.amount
        ),

    newsletterConsent,

    products:
      admin.firestore
        .FieldValue.arrayUnion(
          productId
        ),

    updatedAt:
      admin.firestore
        .FieldValue
        .serverTimestamp()

  }, {
    merge: true
  });

  console.log(
    "👤 customer aggiornato:",
    email
  );
}

// ==========================
// 2. SUBSCRIBER
// ==========================

if (
  newsletterConsent &&
  email
) {

  console.log(
    "📬 aggiorno subscriber:",
    email
  );

  const subscriberRef =
    db.collection("subscribers")
      .doc(email);

  const existing =
    await subscriberRef.get();

  await subscriberRef.set(
    {
      email,
      subscribed: true,
      source: "checkout",
      createdAt:
        existing.exists
          ? existing.data()
              .createdAt
          : admin.firestore
              .FieldValue
              .serverTimestamp(),

      updatedAt:
        admin.firestore
          .FieldValue
          .serverTimestamp()
    },
    { merge: true }
  );

  console.log(
    "✅ subscriber aggiornato"
  );
}

// ==========================
  // 3. EMAILS
// ==========================

const productSnapshot = productId
  ? await db.collection("products").doc(productId).get()
  : null;
const productName = productSnapshot?.exists
  ? productSnapshot.get("name") || productId
  : productId || "Prodotto";
const formattedAmount = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: paymentIntent.currency.toUpperCase()
}).format(paymentIntent.amount / 100);

if (isTest) {
  try {
    await sendUserEmail({
      email,
      productId,
      productName,
      amount: formattedAmount,
      paymentIntentId: paymentIntent.id,
      newsletterConsent
    });
    console.log("📧 TEST CUSTOMER EMAIL OK");
  } catch (err) {
    console.error("❌ TEST CUSTOMER EMAIL ERROR:", err);
  }
}

try {

  await sendAdminEmail({
    email,
    productId,
    productName,
    amount: formattedAmount,
    paymentIntentId: paymentIntent.id,
    source,
    newsletterConsent
  });

  console.log(
    "📧 ADMIN EMAIL OK"
  );

} catch (err) {

  console.error(
    "❌ ADMIN EMAIL ERROR:",
    err
  );
}

  console.log(
    "✅ pagamento registrato:",
    paymentIntent.id
  );
}

    res.status(200).send("OK");

  } catch (err) {

  console.error(
    "❌ WEBHOOK ERROR:",
    err.message
  );

  res.status(400)
    .send("Webhook error");
  }
});

exports.generateDownloadUrl = functions.https.onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");

  const { productId, paymentIntentId } = req.query;

  if (!productId || !paymentIntentId) {
    return res.status(400).send("Missing params");
  }

  try {

    // 🔎 1. Verifica pagamento
    const paymentRef = db.collection("payments").doc(paymentIntentId);
    const paymentDoc = await paymentRef.get();

    if (!paymentDoc.exists) {
      return res.status(403).send("Payment not found");
    }

    const payment = paymentDoc.data();

    if (payment.status !== "completed") {
      return res.status(403).send("Payment not completed");
    }

    if (payment.productId !== productId) {
      return res.status(403).send("Product mismatch");
    }

    // 🔎 2. Recupera prodotto da Firestore
    const productRef = db.collection("products").doc(productId);
    const productDoc = await productRef.get();

    if (!productDoc.exists) {
      return res.status(404).send("Product not found");
    }

    const product = productDoc.data();
    if ((product.accessMode || "paid") === "free" || String(product.storagePath || "").startsWith("public_file/")) {
      return res.status(403).send("Free products must use the QR free-download flow");
    }

    const storagePath = product.storagePath;
    const storageFileName = product.storageFileName;

    if (!storagePath || !storageFileName) {
      return res.status(500).send("Product storage config missing");
    }

    const fullPath = `${storagePath}/${storageFileName}`;

    console.log("📦 file richiesto:", fullPath);

    // 🔐 3. Genera URL firmato
    const [url] = await bucket.file(fullPath).getSignedUrl({
      action: "read",
      expires: Date.now() + 24 * 60 * 60 * 1000
    });

// ====================================
// 4. Aggiorna contatori SOLO UNA VOLTA
// ====================================

if (!payment.downloaded) {

  console.log(
    "📈 primo download → aggiorno contatori"
  );

  // A. contatore prodotto
  await productRef.update({
    "counters.downloads":
      admin.firestore.FieldValue.increment(1)
  });

  // B. contatore globale
  await db
    .collection("stats")
    .doc("downloads")
    .set(
      {
        totalDownloads:
          admin.firestore.FieldValue.increment(1)
      },
      { merge: true }
    );

  // C. flag payment
  await paymentRef.update({
    downloaded: true,
    downloadedAt:
      admin.firestore.FieldValue.serverTimestamp()
  });

  await sendAdminDownloadEmail({
    email: payment.email,
    productId,
    productName: product.name || productId,
    paymentIntentId,
    source: payment.source || "web"
  });

} else {

  console.log(
    "♻️ download già conteggiato"
  );
}

// ====================================
// 5. Log download (sempre)
// ====================================

  await db.collection("downloads").add({
  paymentIntentId,
  productId,
  email: payment.email,
  source: payment.source || "web",
  ...(payment.offerId ? { offerId: payment.offerId } : {}),
  downloadedAt:
    admin.firestore.FieldValue.serverTimestamp()
});

console.log(
  "✅ download autorizzato:",
  paymentIntentId
);

return res.json({ url });

  } catch (err) {
    console.error("❌ generateDownloadUrl error:", err);
    return res.status(500).send(err.message);
  }
});

exports.getStripeConfig = functions.https.onRequest((req, res) => {
  res.set("Access-Control-Allow-Origin", "*");

  const { config, isTest } = getStripeSettings();
  const publishableKey = isTest
    ? config.test_publishable
    : config.live_publishable;

  if (!publishableKey) {
    console.error("❌ Missing publishable key");
    return res.status(500).json({
      error: "Stripe publishable key not configured"
    });
  }

  console.log("⚙️ getStripeConfig MODE:", isTest ? "TEST" : "LIVE");

  res.json({
    publishableKey,
    mode: isTest ? "test" : "live"
  });
});

// ==========================
// STRIPE PAYMENT PROVIDER
// ==========================

async function createStripePayment({

  productId,
  productName,
  normalizedEmail,
  amount,
  newsletterConsent,
  source,
  offerId,
  currency,
  res

}) {

  const paymentIntent =
    await getStripeClient()
      .paymentIntents
      .create({

        amount,

        description: productName,

        currency,

        automatic_payment_methods: {
          enabled: true
        },

        metadata: {

          productId,

          email:
            normalizedEmail,

          newsletterConsent:
            newsletterConsent
              ? "true"
              : "false",

          source: source || "web",

          ...(offerId ? { offerId } : {})
        },

        receipt_email:
          normalizedEmail
      });

  console.log(
    "🧠 createPayment OUTPUT:",
    {
      id:
        paymentIntent.id,

      client_secret_prefix:
        paymentIntent
          .client_secret
          ?.slice(0, 20),

      livemode:
        paymentIntent.livemode,

      amount:
        paymentIntent.amount
    }
  );

  return res.json({

    success: true,

    provider:
      "stripe",

    checkoutId:
      paymentIntent.id,

    clientSecret:
      paymentIntent
        .client_secret,

    amount: paymentIntent.amount,

    currency: paymentIntent.currency.toUpperCase()
  });
}

// ==========================
// EMAIL: USER
// ==========================

async function sendUserEmail({
  email,
  productId,
  productName,
  amount,
  paymentIntentId,
  newsletterConsent
}) {

  if (!email) return;

  try {

    const result =
      await getResendClient().emails.send({

        from:
          "asarati <noreply@mail.asarati.it>",

        to: email,

        subject:
          "Il tuo ordine su asarati.it",

      html: `
        <div style="
          font-family:-apple-system,BlinkMacSystemFont,sans-serif;
          max-width:600px;
          margin:auto;
          padding:24px;
          color:#222;
        ">

          <h2>
            Conferma del tuo ordine
          </h2>

          <p>
            Il pagamento è stato ricevuto
            correttamente.
          </p>

          <p>
            <strong>Prodotto:</strong>
            ${productName}
          </p>

          <p>
            <strong>Importo pagato:</strong>
            ${amount}
          </p>

          <p>
            Puoi scaricare il prodotto dalla pagina di conferma aperta dopo il pagamento.
          </p>

          <p>
            <strong>Newsletter:</strong>
            ${
              newsletterConsent
                ? "Iscrizione confermata"
                : "Non iscrittə"
            }
          </p>

          <hr style="
            margin:28px 0;
            border:none;
            border-top:1px solid #ddd;
          ">

          <p style="
            font-size:13px;
            color:#777;
            margin-bottom:28px;
          ">
            <strong>ID ordine:</strong>
            ${paymentIntentId}
          </p>

          <!-- FOOTER BRAND -->

          <table
            role="presentation"
            cellpadding="0"
            cellspacing="0"
            style="margin-top:24px;"
          >
            <tr>

              <!-- LOGO -->
              <td
                style="
                  vertical-align:middle;
                  padding-right:8px;
                "
              >
                <img
                  src="https://asarati-9aafe.web.app/assets/logo-mail.png?v=4"
                  alt="logo asarati.it"
                  width="54"
                  height="54"
                  style="
                    display:block;
                    border-radius:8px;
                    border:0;
                    outline:none;
                    text-decoration:none;
                    object-fit:cover;
                  "
                />
              </td>

              <!-- LINEA VERTICALE -->
              <td
                style="
                  width:1px;
                  background:#d7d7d7;
                "
              >
                &nbsp;
              </td>

              <!-- TESTO -->
              <td
                style="
                  padding-left:8px;
                  vertical-align:middle;
                  color:#777;
                  font-size:12px;
                  line-height:1.45;
                "
              >
                <strong
                  style="
                    color:#333;
                    letter-spacing:0.5px;
                  "
                >
                  KLUDGEROOM
                </strong>
                <br>
                Milano, Italia
                <br>
                <span style="color:#555;">
                  asarati.it
                </span>
              </td>

            </tr>
          </table>
        </div>
      `
      });

    console.log(
      "📨 USER EMAIL RESULT:",
      JSON.stringify(result, null, 2)
    );

  } catch (err) {

    console.error(
      "❌ sendUserEmail FULL ERROR:",
      err
    );
  }
}

// ==========================
// EMAIL: ADMIN
// ==========================

async function sendAdminEmail({
  email,
  productId,
  productName,
  amount,
  paymentIntentId,
  source,
  newsletterConsent
}) {

  try {

    const result =
      await getResendClient().emails.send({

        from:
        "Asarati <noreply@mail.asarati.it>",

        to:
          "asarati.it@gmail.com",

        subject:
          `💰 Nuovo acquisto: ${productName}`,

        html: `
          <div style="
            font-family:-apple-system,BlinkMacSystemFont,sans-serif;
            padding:24px;
          ">

            <h2>
              C'è stato un nuovo acquisto!
            </h2>

            <p>
              <strong>Email:</strong>
              ${email}
            </p>

            <p>
              <strong>Prodotto:</strong>
              ${productName} (${productId})
            </p>

            <p>
              <strong>Importo:</strong>
              ${amount}
            </p>

            <p>
              <strong>Origine:</strong>
              ${source}
            </p>

            <p>
              <strong>ID pagamento Stripe:</strong>
              ${paymentIntentId}
            </p>

            <p>
              <strong>Newsletter:</strong>
              ${
                newsletterConsent
                  ? "SI"
                  : "NO"
              }
            </p>

          </div>
        `
      });

    console.log(
      "📨 ADMIN EMAIL RESULT:",
      JSON.stringify(result, null, 2)
    );

  } catch (err) {

      console.error(
        "❌ sendAdminEmail FULL ERROR:",
        err
      );
  }
}

async function sendAdminDownloadEmail({
  email,
  productId,
  productName,
  paymentIntentId,
  source
}) {
  try {
    const result = await getResendClient().emails.send({
      from: "Asarati <noreply@mail.asarati.it>",
      to: "asarati.it@gmail.com",
      subject: `⬇️ Download autorizzato: ${productName}`,
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;padding:24px">
          <h2>È stato richiesto il download di un prodotto protetto</h2>
          <p><strong>Cliente:</strong> ${email || "Email non disponibile"}</p>
          <p><strong>Prodotto:</strong> ${productName} (${productId})</p>
          <p><strong>Origine:</strong> ${source}</p>
          <p><strong>ID pagamento Stripe:</strong> ${paymentIntentId}</p>
          <p>Il link di download è stato generato. Questo avviso conferma l'autorizzazione del link, non il completamento del trasferimento sul dispositivo.</p>
        </div>
      `
    });
    console.log("📨 ADMIN DOWNLOAD EMAIL RESULT:", JSON.stringify(result, null, 2));
  } catch (err) {
    console.error("❌ sendAdminDownloadEmail ERROR:", err);
  }
}
