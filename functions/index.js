// functions/index.js (backend)

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const Stripe = require("stripe");
const { Resend } = require("resend");

const resend =
  new Resend(
    functions.config().resend.key
  );

admin.initializeApp();
const db = admin.firestore();
const bucket = admin.storage().bucket();

const config = functions.config().stripe;
const isTest = config.mode !== "live";

// 🔥 selezione automatica
const stripeSecret = isTest ? config.test_secret : config.live_secret;
const webhookSecret = isTest ? config.test_webhook_secret : config.live_webhook_secret;

const stripe = Stripe(stripeSecret);

console.log("⚙️ Stripe MODE:", isTest ? "TEST" : "LIVE");
console.log("🔑 Stripe KEY:", stripeSecret?.slice(-6));

exports.createPayment = functions.https.onRequest( async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");

  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return res.status(405).send("POST only");

  const { productId, email, newsletterConsent, paymentMethod } = req.body;

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

  const prices = {
    ebook01: 1999,
    audiobook01: 2999,
    boxbook01: 4999
  };

const amount =
  prices[productId];

if (!amount) {
  return res
    .status(400)
    .send("Invalid product");
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
            newsletterConsent,
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

  email,

  amount:
    paymentIntent.amount,

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
  res

}) {

  const paymentIntent =
    await stripe
      .paymentIntents
      .create({

        amount,

        currency:
          "eur",

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
              : "false"
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
        .client_secret
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
