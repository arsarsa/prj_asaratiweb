// uploadfile/scripts/online_upload.js
// Backend

console.log("🔥 Avvio Firebase...");

import { app } from "./firebase-config.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.19.1/firebase-auth.js";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.19.1/firebase-storage.js";
import { getFirestore, collection, addDoc, doc, updateDoc, getDocs, deleteDoc, increment, Timestamp } from "https://www.gstatic.com/firebasejs/9.19.1/firebase-firestore.js";

// Init
const auth = getAuth(app);
const storage = getStorage(app);
const db = getFirestore(app);

// 🔐 Check login
onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log("✅ Autenticato:", user.email);
  } else {
    console.warn("⚠️ Utente non autenticato.");
    document.getElementById('loginModal')?.style?.display = 'block';
  }
});

// 🕒 Timestamp
function getReadableDate() {
  return new Date().toLocaleString("it-IT");
}

// 📂 Verifica se file esiste già
async function fileExists(fileName, folder) {
  const fileRef = storageRef(storage, `${folder}/${fileName}`);
  try {
    await getDownloadURL(fileRef);
    return true;
  } catch (error) {
    return error.code !== 'storage/object-not-found' ? (() => { throw error })() : false;
  }
}

// 📤 Upload e salvataggio su Firestore
async function uploadFile(file, folder, priceInput, messageEl, idEl) {
  if (!file) {
    messageEl.textContent = "❌ Nessun file selezionato.";
    return;
  }

  let priceValue = priceInput.value.trim();
  if (!priceValue.match(/^\d+([.,]\d{1,2})?$/)) {
    messageEl.textContent = "❌ Prezzo non valido (es. 0,00 o 0.00).";
    return;
  }
  priceValue = parseFloat(priceValue.replace(",", "."));

  const exists = await fileExists(file.name, folder);
  if (exists) {
    messageEl.textContent = `⚠️ Il file "${file.name}" esiste già.`;
    return;
  }

  const fileRef = storageRef(storage, `${folder}/${file.name}`);
  try {
    await uploadBytes(fileRef, file);
    const downloadURL = await getDownloadURL(fileRef);

    const docRef = await addDoc(collection(db, folder.toLowerCase()), {
      name: file.name,
      price: priceValue,
      fileUrl: downloadURL,
      downloadCount: 0,
      uploadDate: Timestamp.now(),
      description: "Descrizione del contenuto",
      author: "admin"
    });

    messageEl.textContent = `✅ Caricato: ${file.name}`;
    idEl.textContent = `🆔 ID: ${docRef.id}`;

    const listId = {
      eBook: "ebookList",
      audioBook: "audioList",
      boxBook: "boxList"
    }[folder];

    if (listId) displayUploadedFiles(folder, listId);

  } catch (error) {
    console.error("❌ Errore upload:", error);
    messageEl.textContent = `❌ Errore: ${error.message}`;
  }
}

// 🎯 Collegamento bottoni
function setupUploadButton(buttonId, fileInputId, priceInputId, messageId, idId, folder) {
  document.getElementById(buttonId).addEventListener("click", () => {
    const file = document.getElementById(fileInputId).files[0];
    const priceInput = document.getElementById(priceInputId);
    const messageEl = document.getElementById(messageId);
    const idEl = document.getElementById(idId);
    uploadFile(file, folder, priceInput, messageEl, idEl);
  });
}

// 🗃️ Visualizza file
async function displayUploadedFiles(folder, containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = "📦 Caricamento...";

  try {
    const snapshot = await getDocs(collection(db, folder));
    if (snapshot.empty) {
      container.innerHTML = "🚫 Nessun file caricato.";
      return;
    }

    container.innerHTML = "";
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const fileId = docSnap.id;

      const div = document.createElement("div");
      div.style.marginBottom = "1em";
      div.innerHTML = `
        <strong>${data.name}</strong><br>
        💶 <b>${data.price.toFixed(2)} €</b><br>
        📄 ${data.description}<br>
        👤 ${data.author}<br>
        📈 Vendite: ${data.downloadCount}<br>
        🕒 ${data.uploadDate.toDate().toLocaleString()}
      `;
      container.appendChild(div);
    });
  } catch (error) {
    container.innerHTML = `❌ Errore nel caricamento: ${error.message}`;
  }
}

// 🔽🔼 Logica dinamica per cambiare l’icona e il testo del bottone in base allo stato (visibile/nascosto)
const toggleBtn = document.getElementById('toggleFilesBtn');
const fileSections = ['ebookList', 'audioList', 'boxList'];

toggleBtn?.addEventListener('click', () => {
  let isHidden = false;

  fileSections.forEach(id => {
    const el = document.getElementById(id);
    // Se anche uno è visibile, li nascondiamo tutti
    if (el.style.display !== 'none') {
      isHidden = true;
    }
  });

  fileSections.forEach(id => {
    const el = document.getElementById(id);
    el.style.display = isHidden ? 'none' : 'block';
  });

  // Cambia testo e icona
  toggleBtn.textContent = isHidden ? '🔽 Mostra file' : '🔼 Nascondi file';
});

// 🧠 Attiva upload per ogni sezione
setupUploadButton("uploadEbookButton", "ebookInput", "ebookPrice", "ebookMessage", "ebookFileId", "eBook");
setupUploadButton("uploadaudiobookButton", "audiobookInput", "audiobookPrice", "audiobookMessage", "audiobookFileId", "audioBook");
setupUploadButton("uploadfileZipButton", "fileZipInput", "fileZipPrice", "fileZipMessage", "fileZipFileId", "boxBook");
