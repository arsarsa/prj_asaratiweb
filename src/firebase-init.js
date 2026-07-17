// src/firebase-init.js

const firebaseConfig = {
    apiKey: "AIzaSyAWPbTgRnXVJYLjbP-A6KKa82_KTDp2uoE",
    authDomain: "asarati-9aafe.firebaseapp.com",
    projectId: "asarati-9aafe",
    storageBucket: "asarati-9aafe.firebasestorage.app",
    messagingSenderId: "574370087223",
    appId: "1:574370087223:web:16a2d0a87a31f0a1925ab2"
};

export let db = null;

window.productStats = {
    products: {
        ebook: 0,
        audiobook: 0,
        boxbook: 0
    },
    totalDownloads: 0
};

export function initFirebase() {
    return new Promise((resolve, reject) => {
        try {
            if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
            }

            db = firebase.firestore();

            let firstLoad = true;

            db.collection('products').onSnapshot((snap) => {
                let total = 0;

                snap.forEach(doc => {
                    const data = doc.data();
                    const downloads = data.counters?.downloads || 0;

                    if (doc.id === 'ebook01') {
                        window.productStats.products.ebook = downloads;
                    }

                    if (doc.id === 'audiobook01') {
                        window.productStats.products.audiobook = downloads;
                    }

                    if (doc.id === 'boxbook01') {
                        window.productStats.products.boxbook = downloads;
                    }

                    total += downloads;
                });

                window.productStats.totalDownloads = total;

                updateCounts();

                if (firstLoad) {
                    firstLoad = false;
                    resolve();
                }

            }, reject);

        } catch (err) {
            reject(err);
        }
    });
}

export function updateCounts() {
    const stats = window.productStats;

    const ebook = document.getElementById('ebook-count');
    const audiobook = document.getElementById('audiobook-count');
    const boxbook = document.getElementById('boxbook-count');
    const total = document.getElementById('total-downloads');

    if (!ebook || !audiobook || !boxbook || !total) return;

    ebook.textContent = stats.products.ebook;
    audiobook.textContent = stats.products.audiobook;
    boxbook.textContent = stats.products.boxbook;
    total.textContent = `Download totali: ${stats.totalDownloads}`;
}
