// src/success.js

console.log("✅ success.js caricato");

function getParam(param) {
    const url = new URL(window.location.href);
    return url.searchParams.get(param);
}

const productId = getParam("productId");
const email = getParam("email");
const storageUrl = getParam("url");

const infoDiv = document.getElementById("download-info");

if (!productId || !email || !storageUrl) {
    infoDiv.innerHTML = "❌ Parametri mancanti. Contatta il supporto.";
    throw new Error("Missing params");
}

infoDiv.innerHTML = `
    <p><strong>Prodotto:</strong> ${productId}</p>
    <p><strong>Email:</strong> ${email}</p>
    <p>⏳ Preparazione download...</p>
`;

console.log("🔗 Download URL:", storageUrl);

// ⬇️ Avvia download automatico
setTimeout(() => {
    window.location.href = storageUrl;
}, 1500);
