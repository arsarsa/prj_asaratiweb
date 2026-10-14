// functions/index.js (backend)

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const crypto = require("crypto");
const Stripe = require("stripe");
const QRCode = require("qrcode");
const { Resend } = require("resend");

const resend =
  new Resend(
    functions.config().resend.key
  );

admin.initializeApp({
  storageBucket: "asarati-9aafe.firebasestorage.app"
});
const db = admin.firestore();
const bucket = admin.storage().bucket("asarati-9aafe.firebasestorage.app");

const config = functions.config().stripe;
const isTest = config.mode !== "live";

// 🔥 selezione automatica
const stripeSecret = isTest ? config.test_secret : config.live_secret;
const webhookSecret = isTest ? config.test_webhook_secret : config.live_webhook_secret;

const stripe = Stripe(stripeSecret);

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
  const price = String(data.price || "").trim().replace(",", ".");
  const categoryByType = { ebook: "eBook", audiobook: "audioBook", boxbook: "boxBook" };
  if (!/^[a-zA-Z0-9_-]{3,80}$/.test(productId) || !name || !categoryByType[type] ||
      !/^[^/\\]+\.(zip|epub|pdf|mp3)$/i.test(fileName) || !/^\d+(\.\d{1,2})?$/.test(price) ||
      Number(price) <= 0 || !description) {
    throw new functions.https.HttpsError("invalid-argument", "Product details are invalid.");
  }

  const storagePath = `protected_file/${categoryByType[type]}/${productId}`;
  const objectPath = `${storagePath}/${fileName}`;
  const productRef = db.collection("products").doc(productId);
  const existing = await productRef.get();
  if (existing.exists && (existing.get("active") === true || existing.get("archivedAt"))) {
    throw new functions.https.HttpsError("already-exists", "Product ID already exists.");
  }
  const productData = {
    productId, name, type, description, price, currency: "eur", active: false,
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
  return { uploadUrl, objectPath, publicUrl: `https://asaratiqrc.web.app/p/${productId}` };
});

exports.updateProductDetails = functions.https.onCall(async (data, context) => {
  if (!context.auth || context.auth.token.admin !== true) {
    throw new functions.https.HttpsError("permission-denied", "Admin access required.");
  }

  const productId = String(data.productId || "").trim();
  const name = String(data.name || "").trim();
  const description = String(data.description || "").trim();
  const price = String(data.price || "").trim().replace(",", ".");
  if (!productId || !name || !description || !/^\d+(\.\d{1,2})?$/.test(price) || Number(price) <= 0) {
    throw new functions.https.HttpsError("invalid-argument", "Product details are invalid.");
  }

  const productRef = db.collection("products").doc(productId);
  const product = await productRef.get();
  if (!product.exists) throw new functions.https.HttpsError("not-found", "Product not found.");

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
  if (!category || !product.storagePath || !product.storageFileName ||
      ![`protected_file/${category}`, `protected_file/${category}/${productId}`].includes(product.storagePath) ||
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
  const summaries = Object.fromEntries(productIds.map((id) => [id, { sales: 0, revenueCents: 0 }]));
  if (!productIds.length) return { summaries };

  const payments = await db.collection("payments").where("productId", "in", productIds).get();
  payments.forEach((payment) => {
    const data = payment.data();
    if (data.status !== "completed" || !summaries[data.productId]) return;
    summaries[data.productId].sales += 1;
    if (Number.isFinite(data.amount)) summaries[data.productId].revenueCents += data.amount;
  });
  return { summaries };
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
  if (!category || !["protected_file/" + category, `protected_file/${category}/${sourceId}`].includes(source.storagePath) ||
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
  const storagePath = `protected_file/${category}/${productId}`;
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
  ["publicUrl", "qrCodePath", "qrCodeGeneratedAt", "archivedAt", "archivedBy", "updatedAt", "updatedBy", "revisedAt", "revisedBy"].forEach((field) => delete duplicate[field]);

  await productRef.create(duplicate);
  await offerRef.set({ productId, name, title: name, slug: productId, campaignId: "qrc", active: false }, { merge: true });
  try {
    await bucket.file(sourcePath).copy(bucket.file(destinationPath));
  } catch (error) {
    await Promise.allSettled([productRef.delete(), offerRef.delete(), bucket.file(destinationPath).delete({ ignoreNotFound: true })]);
    throw new functions.https.HttpsError("internal", "Could not copy the product file.");
  }
  return { productId, name, publicUrl: `https://asaratiqrc.web.app/p/${productId}` };
});

// Keep the original us-central1 trigger deployed as a no-op during migration.
// Storage events must be handled in the bucket's europe-west1 location.
exports.generateProductQr = functions.storage.object().onFinalize(async () => null);

exports.generateProductQrEurope = functions.region("europe-west1").storage.object().onFinalize(async (object) => {
  const objectPath = object.name || "";
  const match = objectPath.match(/^protected_file\/(eBook|audioBook|boxBook)\/([a-zA-Z0-9_-]{3,80})\/([^/]+)$/);
  if (!match) return null;
  const [, category, productId, fileName] = match;
  const productRef = db.collection("products").doc(productId);
  const productSnapshot = await productRef.get();
  if (!productSnapshot.exists) return null;
  const product = productSnapshot.data();
  if (product.archivedAt) return null;
  if (product.storagePath !== `protected_file/${category}/${productId}` || product.storageFileName !== fileName) return null;

  const publicUrl = `https://asaratiqrc.web.app/p/${productId}`;
  const qrCodePath = `public_qrcodes/${productId}.svg`;
  const svg = await QRCode.toString(publicUrl, { type: "svg", errorCorrectionLevel: "M", margin: 2 });
  await bucket.file(qrCodePath).save(svg, {
    resumable: false,
    metadata: { contentType: "image/svg+xml", cacheControl: "public, max-age=31536000, immutable" }
  });
  await db.collection("offers").doc(`product_${productId}`).update({ active: true });
  await productRef.update({ publicUrl, qrCodePath, qrCodeGeneratedAt: admin.firestore.FieldValue.serverTimestamp(), active: true });
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

console.log("⚙️ Stripe MODE:", isTest ? "TEST" : "LIVE");
console.log("🔑 Stripe KEY:", stripeSecret?.slice(-6));

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

  console.log(
    "⚙️ MODE:",
    isTest
      ? "TEST"
      : "LIVE"
  );

  console.log(
    "🔑 SECRET:",
    stripeSecret
      ?.slice(-6)
  );

  try {

    switch (
      paymentMethod
    ) {

      case "stripe":

          return await
          createStripePayment({
            productId,
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
    const sig = req.headers["stripe-signature"];
    console.log("signature presente:", !!sig);

    console.log(
      "🪝 WEBHOOK SECRET:",
      webhookSecret?.slice(-10)
    );

    console.log(
      "🪝 SIGNATURE:",
      sig?.slice(0, 20)
    );

    const event = stripe.webhooks.constructEvent(
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

try {

  await sendUserEmail({
    email,
    productId,
    paymentIntentId:
      paymentIntent.id,
    newsletterConsent
  });

  console.log(
    "📧 USER EMAIL OK"
  );

} catch (err) {

  console.error(
    "❌ USER EMAIL ERROR:",
    err
  );
}

try {

  await sendAdminEmail({
    email,
    productId,
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

  const config = functions.config().stripe;
  const isTest = config.mode !== "live";
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
  normalizedEmail,
  amount,
  newsletterConsent,
  source,
  offerId,
  currency,
  res

}) {

  const paymentIntent =
    await stripe
      .paymentIntents
      .create({

        amount,

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
  paymentIntentId,
  newsletterConsent
}) {

  if (!email) return;

  const productNames = {
    ebook01: "eBook",
    audiobook01: "Audiobook",
    boxbook01: "BoxBook"
  };

  const productName =
    productNames[productId] ||
    productId;

  try {

    const result =
      await resend.emails.send({

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
            Grazie per il tuo acquisto!
          </h2>

          <p>
            Il pagamento è stato ricevuto
            correttamente.
          </p>

          <p>
            <strong>Hai scaricato:</strong>
            ${productName}
          </p>

          <p>
            Il download è già stato avviato.
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
  newsletterConsent
}) {

  try {

    const result =
      await resend.emails.send({

        from:
        "Asarati <noreply@mail.asarati.it>",

        to:
          "asarati.it@gmail.com",

        subject:
          "💰 Nuovo acquisto su asarati.it!",

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
              ${productId}
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
