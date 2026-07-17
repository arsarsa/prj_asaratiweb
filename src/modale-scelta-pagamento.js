// src/modale-scelta-pagamento.js (frontend)

import { getStripe } from './stripe-client.js';

let elements = null;
let paymentElement = null;
let selectedProduct = null;
let stripeReady = false;
let paymentModalInitialized = false;

window.paymentState = {
    paymentMethod:
        'stripe'
};

const productData = {
    ebook01: {
        shortName:
            'eBook',
        title:
            'Titolo ebook'
    },

    audiobook01: {
        shortName:
            'Audiobook',
        title:
            'Titolo audiobook'
    },

    boxbook01: {
        shortName:
            'BoxBook',
        title:
            'Titolo boxbook'
    }
};

// 🔥 CACHE + STATE
let paymentIntentCache = {};
let debounceTimer = null;
let currentEmail = null;

export function initPaymentModal() {

    if (
        paymentModalInitialized
    ) return;

    paymentModalInitialized =
        true;

    console.log(
        "✅ Payment modal init"
    );

    document
        .getElementById(
            'close-payment-x'
        )
        .onclick = () => {

        window.closePaymentModal();
    };

// Listener sui tasti pagamento
    document
    .getElementById(
        'btn-stripe'
    )
    .onclick =
    selectStripe;

    document
    .getElementById(
        'btn-paypal'
    )
    .onclick =
    selectPaypal;

    document
    .getElementById(
        'btn-satispay'
    )
    .onclick =
    selectSatispay;

    // chiusura click esterno
    const paymentModal =
        document.getElementById(
            'payment-modal'
        );

    paymentModal
        ?.addEventListener(
            'click',
            (event) => {

                if (
                    event.target ===
                    paymentModal
                ) {

                    window.closePaymentModal();
                }
            }
        );

    initPaymentUI();
}

// =========================
//   MODALE API
// =========================

function closeAllModals() {
    document.getElementById('products-modal')
        ?.classList.remove('show');

    document.getElementById('payment-modal')
        ?.classList.remove('modal-show');
}

// =========================
// PAYMENT UI MODE
// =========================

function setPaymentMode(
    mode = 'form'
) {

    const form =
        document.getElementById(
            'payment-form-section'
        );

    const status =
        document.getElementById(
            'payment-status-message'
        );

    if (
        !form ||
        !status
    ) return;

    // modalità processing
    if (
        mode === 'processing'
    ) {

        form.style.display =
            'none';

        status.style.display =
            'block';

        return;
    }

    // modalità default
    form.style.display =
        'block';

    status.style.display =
        'none';
}

// =========================
// CLOSE PAYMENT MODAL
// =========================

window.closePaymentModal =
function () {

    document
        .getElementById(
            'payment-modal'
        )
        ?.classList.remove(
            'modal-show'
        );

    resetPaymentForm();

    setPaymentMode(
        'form'
    );

    console.log(
        '🔒 payment modal chiusa'
    );
};

    window.showPaymentModal =
    function (productId) {

        closeAllModals();

        selectedProduct =
            productId;

        resetPaymentForm();

        setPaymentMode(
            'form'
        );

        const product =
            productData[
                productId
            ];

        document.getElementById(
            'payment-title'
        ).innerHTML = `
            💳 Completa l'acquisto

            <div style="
                font-size:14px;
                font-weight:500;
                margin-top:6px;
                opacity:.75;
            ">
                ${
                    product?.shortName
                    || ''
                }

                ${
                    product?.title
                    ? ' · ' +
                      product.title
                    : ''
                }
            </div>
        `;

        const modal =
            document.getElementById(
                'payment-modal'
            );

        modal.classList.add(
            'modal-show'
        );

    console.log(
        '✅ payment modal aperta:',
        productId
    );
};

// =========================
//   UI INIT
// =========================

function initPaymentUI() {
    const emailInput = document.getElementById('emailInput');
    const payBtn = document.getElementById('pay-btn');

    emailInput.oninput = () => {
        const email = emailInput.value.trim();

        clearTimeout(debounceTimer);

        debounceTimer = setTimeout(() => {
            handleEmailChange(email);
        }, 600);
    };

    payBtn.onclick = handlePayment;
}

const newsletterCheckbox =
    document.getElementById(
        'newsletterConsent'
    );

newsletterCheckbox?.addEventListener(
    'change',
    () => {

        if (!currentEmail) return;

        const cacheKey =
            `${selectedProduct}_${
                currentEmail
            }_${
                paymentState
                .paymentMethod
        }`;

        delete paymentIntentCache[
            cacheKey
        ];

        console.log(
            '♻️ cache PaymentIntent invalidata (newsletter cambiata)'
        );

        handleEmailChange(
            currentEmail
        );
    }
);

/* =========================
   EMAIL FLOW (CORE LOGIC)
========================= */

async function handleEmailChange(email) {

    const payBtn =
        document.getElementById('pay-btn');

    email =
        email
            .trim()
            .toLowerCase();

    // blocca virgole, spazi,
    // doppie @, domini strani
    const valid =
        /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i
            .test(email);

    // typo molto comuni
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
        email.split("@")[1];

    if (commonTypos[domain]) {

        showInlinePaymentError(
            `Forse intendevi ${email.replace(
                domain,
                commonTypos[domain]
            )}?`
        );

        payBtn.disabled = true;
        return;
    }

    if (!valid) {

        showInlinePaymentError(
            'Inserisci un indirizzo email valido'
        );

        payBtn.disabled = true;
        return;
    }

    hideInlinePaymentError();

    currentEmail = email;

    const cacheKey =
        `${selectedProduct}_${
            email
        }_${
            paymentState
            .paymentMethod
    }`;

    // 🔥 CACHE HIT
    if (paymentIntentCache[cacheKey]) {
        console.log("♻️ PaymentIntent da cache");

        const cachedPayment =
            paymentIntentCache[cacheKey];

        if (
            cachedPayment.provider ===
            'stripe'
        ) {

            mountStripeElements(
                cachedPayment.clientSecret
            );
        }

        return;
    }

    // 🔥 CACHE MISS
    await createPayment(email, cacheKey);
}

/* =========================
   CREATE PAYMENT
========================= */

async function createPayment(
    email,
    cacheKey
) {

    try {

        const requestedPaymentMethod =
            paymentState
                .paymentMethod;

        const newsletterConsent =
            document.getElementById(
                'newsletterConsent'
            )?.checked || false;

        const payload = {
            productId:
                selectedProduct,

            email,

            newsletterConsent,

            paymentMethod:
                requestedPaymentMethod
        };

        console.log(
            '📦 createPayment payload:',
            payload
        );

        console.log(
            '📬 newsletterConsent:',
            newsletterConsent
        );

        const res =
            await fetch(
                '/createPayment',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type':
                            'application/json'
                    },

                    body:
                        JSON.stringify(
                            payload
                        )
                }
            );

        if (!res.ok) {

            const errorText =
                await res.text();

            console.error(
                '❌ createPayment server error:',
                errorText
            );

            throw new Error(
                errorText ||
                'Errore createPayment'
            );
        }

        const data =
            await res.json();

        // Ignora la risposta di un metodo che l'utente ha
        // cambiato mentre la richiesta era ancora in corso.
        if (
            requestedPaymentMethod !==
            paymentState.paymentMethod
        ) {

            console.log(
                '♻️ risposta pagamento ignorata: metodo cambiato'
            );

            return;
        }

        console.log(
            '💳 provider:',
            data.provider
        );

// =========================
// STRIPE
// =========================

if (
    data.provider ===
    'stripe'
) {

    console.log(
        '🧠 CLIENT SECRET:',
        data.clientSecret
            ?.slice(0, 25)
    );

    paymentIntentCache[
        cacheKey
    ] = {

        checkoutId:
            data.checkoutId,

        clientSecret:
            data.clientSecret,

        provider:
            data.provider
    };

    console.log(
        '🆕 Stripe payment creato'
    );

    mountStripeElements(
        data.clientSecret
    );

    document.getElementById(
        'pay-btn'
    ).disabled = false;

    return;
}

// =========================
// PAYPAL
// =========================

if (
    data.provider ===
    'paypal'
) {

    disablePaymentButton();

    mostraMessaggioPagamento(`
        PayPal disponibile a breve
    `);

    return;
}

// =========================
// SATISPAY
// =========================

if (
    data.provider ===
    'satispay'
) {

    disablePaymentButton();

    mostraMessaggioPagamento(`
        Satispay disponibile a breve
    `);

    return;
}

    } catch (err) {

        console.error(
            '❌ createPayment error:',
            err
        );

        showInlinePaymentError(
            'Errore inizializzazione pagamento'
        );
    }
}

/* =========================
   STRIPE MOUNT (CLEAN)
========================= */

async function mountStripeElements(clientSecret) {
    const stripe = await getStripe();

    stripeReady = false;

    const payBtn = document.getElementById('pay-btn');

    if (payBtn) {
        payBtn.disabled = true;
        payBtn.textContent = 'Caricamento pagamento...';
    }

    if (paymentElement) {
        paymentElement.destroy();
        paymentElement = null;
    }

    const container = document.getElementById('payment-element');
    container.innerHTML = '';

    elements = stripe.elements({
        clientSecret
    });

    paymentElement = elements.create('payment');

    paymentElement.on('ready', () => {
        stripeReady = true;

        console.log("✅ Stripe pronto");

        if (payBtn) {
            payBtn.disabled = false;
            payBtn.textContent = 'Paga';
        }
    });

    paymentElement.on('loaderror', (event) => {
        console.error("❌ Stripe loaderror:", event.error);
    });

    paymentElement.mount(container);

    console.log("✅ Stripe Elements montato");
}

/* =========================
   PAYMENT HANDLER
========================= */

async function handlePayment() {
    const payBtn =
        document.getElementById('pay-btn');

    if (!stripeReady) {
        mostraMessaggioPagamento(
            "Attendere un istante: il sistema di pagamento si sta inizializzando..."
        );
        return;
    }

    const stripe = await getStripe();

    try {

        console.log("🚨 STEP 1");

        payBtn.disabled = true;
        hideInlinePaymentError();

        setPaymentMode(
            'processing'
        );

        console.log("🚨 STEP 2");

        const result =
            await stripe.confirmPayment({
                elements,
                redirect: 'if_required'
            });

        console.log("🚨 STEP 3 RESULT:",
            result
        );

        if (result.error) {

    console.log(
        "🚨 STEP 4 ERROR:",
        result.error
        );

        setPaymentMode(
            'form'
        );

        if (
            result.error.message?.includes(
                "incomplete"
            ) ||
            result.error.message?.includes(
                "incompleto"
            )
        ) {

            mostraMessaggioPagamento(
                "Il modulo di pagamento si sta ancora caricando. Attendere un istante e riprovare."
            );

        } else {

            showInlinePaymentError(
                result.error.message ||
                "Pagamento fallito"
            );
        }

        payBtn.disabled = false;
        return;
    }

        console.log("🚨 STEP 5");

        const paymentIntent =
            result.paymentIntent;

        console.log( "🚨 STEP 6 STATUS:",
            paymentIntent?.status
        );

        if (
            paymentIntent.status !==
            'succeeded'
        ) {
            showInlinePaymentError(
                "Pagamento non completato"
            );

            payBtn.disabled = false;
            return;
        }

        console.log( "🚨 STEP 7:",

            paymentIntent.id
        );

        // =====================
        // INVALIDA PAYMENT INTENT
        // appena pagato
        // =====================

        const cacheKey =
            `${selectedProduct}_${
                currentEmail
            }_${
                paymentState
                .paymentMethod
        }`;

        delete paymentIntentCache[
            cacheKey
        ];

        console.log(
            '♻️ PaymentIntent invalidato dopo pagamento'
        );

        await waitForPaymentConfirmation(
            paymentIntent.id
        );

        console.log("🚨 STEP 8");

        await downloadProductV2(
            selectedProduct,
            paymentIntent.id
        );

    } catch (err) {

        console.error(
            "❌ pagamento error:",
            err
        );

        setPaymentMode(
            'form'
        );

        showInlinePaymentError(
            "Errore durante il pagamento"
        );

        payBtn.disabled = false;
    }
}

/* =========================
   DOWNLOAD FLOW
========================= */

async function downloadProductV2(
    productId,
    paymentIntentId
) {

    console.log(
        "🚨 VERSIONE NUOVA downloadProductV2"
    );

    // =====================
    // STATO 1
    // pagamento ricevuto
    // =====================

    mostraMessaggioPagamento(`
        • Pagamento ricevuto
        • Preparazione download in corso...
    `);

    const res = await fetch(
        `/generateDownloadUrl?productId=${encodeURIComponent(productId)}&paymentIntentId=${encodeURIComponent(paymentIntentId)}`
    );

    if (!res.ok) {
        throw new Error(
            "Download non autorizzato"
        );
    }

    const data = await res.json();

    const productNames = {
        ebook01: "eBook",
        audiobook01: "Audiobook"
    };

    const productName =
        productNames[productId] || "file";

    // =====================
    // STATO 2
    // download avviato
    // =====================

    mostraMessaggioPagamento(`
        • Pagamento ricevuto

        • Download avviato:
        ${productName}
            `);

    // UX pause
    await new Promise(resolve =>
        setTimeout(resolve, 1800)
    );

    // avvia download
    window.location.href = data.url;

    // =====================
    // STATO 3
    // ringraziamento
    // =====================

    mostraMessaggioPagamento(`
        • Download avviato

        Grazie per il tuo acquisto.
        Buona lettura / ascolto.
    `);

    // tempo per leggere
    await new Promise(resolve =>
        setTimeout(resolve, 2600)
    );

    // =====================
    // STATO 4
    // reset completo
    // =====================

    destroyPaymentElements();

    elements = null;
    paymentElement = null;
    stripeReady = false;

    // reset UI
    if (window.closePaymentModal) {
        window.closePaymentModal();
    }

    console.log(
        '♻️ payment session reset'
    );

    return true;
}

/* =========================
   PAYMENT CONFIRMATION
========================= */

async function waitForPaymentConfirmation(
    paymentIntentId
) {

    const maxAttempts = 10;
    const delay = 1500;

    // subito dopo il pagamento
    mostraMessaggioPagamento(`
        • Pagamento ricevuto
        • Potrebbero essere necessari alcuni secondi.
    `);

    for (
        let attempt = 1;
        attempt <= maxAttempts;
        attempt++
    ) {

        console.log(
            `• Verifica pagamento ${attempt}/${maxAttempts}`
        );

        // aggiorna messaggio
        mostraMessaggioPagamento(`
        • Conferma pagamento

        • Verifica sicura in corso...
        (${attempt}/${maxAttempts})

        • Attendere un istante.
        `);

        const res = await fetch(
            `/checkPaymentStatus?paymentIntentId=${encodeURIComponent(
                paymentIntentId
            )}`
        );

        if (!res.ok) {
            throw new Error(
                "Errore verifica pagamento"
            );
        }

        const data =
            await res.json();

        if (
            data.success &&
            data.status === 'completed'
        ) {

            console.log(
                "✅ pagamento registrato nel backend"
            );

            // stato positivo
            mostraMessaggioPagamento(`
            • Pagamento confermato
            • Preparazione download...
            `);

            // piccolo respiro UX
            await new Promise(resolve =>
                setTimeout(resolve, 700)
            );

            return true;
        }

        await new Promise(resolve =>
            setTimeout(resolve, delay)
        );
    }

    throw new Error(
        "Pagamento non ancora registrato"
    );
}

/* =========================
   PAYMENT STATUS MESSAGE
========================= */

function mostraMessaggioPagamento(message) {

    const el = document.getElementById(
        'payment-status-message'
    );

    if (!el) return;

    el.innerHTML = message
        .replace(/\n/g, '<br>');

    el.style.display = 'block';
}

function nascondiMessaggioPagamento() {

    const el = document.getElementById(
        'payment-status-message'
    );

    if (!el) return;

    el.innerHTML = '';
    el.style.display = 'none';
}

/* =========================
   UI HELPERS
========================= */

function showInlinePaymentError(message) {
    const emailError = document.getElementById('emailError');
    emailError.textContent = message;
    emailError.style.display = 'block';
}

function hideInlinePaymentError() {
    const emailError = document.getElementById('emailError');
    emailError.textContent = '';
    emailError.style.display = 'none';
}

function resetPaymentForm() {

    document.getElementById(
        'emailInput'
    ).value = '';

    document.getElementById(
        'pay-btn'
    ).disabled = true;

    document.getElementById(
        'pay-btn'
    ).textContent = 'Paga';

    document.getElementById(
        'newsletterConsent'
    ).checked = false;

    currentEmail = null;

 //   selectedProduct = null;
    stripeReady = false;

    hideInlinePaymentError();

    nascondiMessaggioPagamento();

    destroyPaymentElements();
}

/* =========================
   CLEANUP
========================= */

function destroyPaymentElements() {
    if (paymentElement) {
        paymentElement.destroy();
        paymentElement = null;
    }

    elements = null;

    const container = document.getElementById('payment-element');
    container.innerHTML = '';
}

/* =========================
   STRIPE MODE SELECT
========================= */

function activatePaymentButton(
    buttonId
) {

    document
        .querySelectorAll(
            '.btn-metodo'
        )
        .forEach(btn => {

            btn.classList.remove(
                'attivo'
            );

        });

    document
        .getElementById(
            buttonId
        )
        ?.classList.add(
            'attivo'
        );
}

// Select Stripe
function selectStripe() {
    selectPaymentMethod(
        'stripe',
        'btn-stripe'
    );
}

// Select PayPal
function selectPaypal() {
    selectPaymentMethod(
        'paypal',
        'btn-paypal'
    );
}

// Select Satispay
function selectSatispay() {

    selectPaymentMethod(
        'satispay',
        'btn-satispay'
    );
}

function selectPaymentMethod(
    method,
    buttonId
) {

    const methodChanged =
        paymentState.paymentMethod !==
        method;

    paymentState
        .paymentMethod =
            method;

    activatePaymentButton(
        buttonId
    );

    if (methodChanged) {
        invalidateCurrentPayment();
    }

    console.log(
        '💳 metodo:',
        paymentState
            .paymentMethod
    );
}

function invalidateCurrentPayment() {

    paymentIntentCache =
        {};

    destroyPaymentElements();

    stripeReady =
        false;

    disablePaymentButton();

    nascondiMessaggioPagamento();

    console.log(
        '♻️ cache invalidata'
    );

    if (currentEmail) {
        handleEmailChange(
            currentEmail
        );
    }
}

function disablePaymentButton() {

    const payBtn =
        document.getElementById(
            'pay-btn'
        );

    if (!payBtn) return;

    payBtn.disabled = true;
    payBtn.textContent = 'Paga';
}
