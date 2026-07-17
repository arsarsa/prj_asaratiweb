// src/stripe-client.js

let stripeInstance = null;

export async function getStripe() {

    if (stripeInstance) {
        return stripeInstance;
    }

    const res = await fetch('/getStripeConfig');

    if (!res.ok) {
        throw new Error(`getStripeConfig failed: ${res.status}`);
    }

    // DEBUG SAFE
    const text = await res.text();

    console.log("📦 getStripeConfig RAW:", text);

    let data;

    try {
        data = JSON.parse(text);
    } catch (err) {
        console.error("❌ JSON parse error:", err);
        throw new Error("Risposta Stripe config non valida");
    }

    console.log("🟣 Stripe init:", data.mode);

    console.log(
        "🔑 PUB KEY:",
        data.publishableKey?.slice(-6)
    );

    if (data.mode === "test") {
        console.warn("⚠️ TEST MODE ATTIVO");
    }

    if (!data.publishableKey) {
        throw new Error("Publishable key mancante");
    }

    stripeInstance = Stripe(data.publishableKey);

    return stripeInstance;
}
