// uploadfile/scripts/login_upload.js
// Backend

console.log("✅ login_upload.js Documento caricato!");

import { getAuth, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/9.19.1/firebase-auth.js";
import { app } from "./firebase-config.js";

const auth = getAuth(app);
const provider = new GoogleAuthProvider();

export async function login(email, password) {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        console.log("✅ Login riuscito:", userCredential.user);
        alert("🎉 Login effettuato con successo!");
        
        // Reindirizzamento alla home dopo il login
        window.location.href = "/uploadfile/index_upload.html";  
    } catch (error) {
        console.error("❌ Errore di login:", error.message);
        
        // Mostra il messaggio di errore nella pagina
        const errorMessage = document.getElementById("error-message");
        if (errorMessage) {
            errorMessage.textContent = `⚠️ ${error.message}`;
        }
    }
}

// ✅ Aggiungi questa funzione per il login con Google
export async function loginWithGoogle() {
    try {
        const result = await signInWithPopup(auth, provider);
        console.log("✅ Login con Google riuscito:", result.user);
        alert("🎉 Login con Google effettuato con successo!");
        
        // Reindirizzamento alla home dopo il login con Google
        window.location.href = "/uploadfile/index_upload.html";
    } catch (error) {
        console.error("❌ Errore login con Google:", error.message);
        
        // Mostra il messaggio di errore nella pagina
        const errorMessage = document.getElementById("error-message");
        if (errorMessage) {
            errorMessage.textContent = `⚠️ ${error.message}`;
        }
    }
}

// ✅ Aggiungi la funzione di logout
export function logout() {
    signOut(auth).then(() => {
        console.log("✅ Logout effettuato");
        window.location.href = "/uploadfile/login_upload.html"; // Reindirizza alla pagina di login
    }).catch((error) => {
        console.error("❌ Errore durante il logout:", error);
    });
}

// Invio del recupero tramite il flusso protetto ospitato da Firebase.
export async function resetPassword(email) {
    auth.languageCode = "it";
    try {
        await sendPasswordResetEmail(auth, email, {
            url: "https://asarati-9aafe.web.app/uploadfile/login_upload.html",
            handleCodeInApp: false
        });
    } catch (error) {
        // Non rivelare se un indirizzo è registrato.
        if (error.code === "auth/user-not-found") return;
        const messages = {
            "auth/invalid-email": "Inserisci un indirizzo email valido.",
            "auth/too-many-requests": "Troppe richieste. Attendi qualche minuto e riprova.",
            "auth/network-request-failed": "Connessione non disponibile. Controlla la rete e riprova."
        };
        throw new Error(messages[error.code] || "Non è stato possibile inviare l’email di recupero. Riprova più tardi.");
    }
}
