// uploadfile/scripts/signup.js
// Frontend

import { getAuth, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.19.1/firebase-auth.js";
import { app } from "./firebase-config.js"; // Assicurati che il percorso sia corretto

const auth = getAuth(app);

export async function signUp(email, password) {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        console.log("✅ Registrazione riuscita:", userCredential.user);
        alert("Registrazione completata! Ora puoi accedere.");
        window.location.href = "/uploadfile/login_upload.html";
    } catch (error) {
        console.error("❌ Errore registrazione:", error.message);
        document.getElementById("signup-error-message").textContent = error.message;
    }
}
