// src/modale-scelta-prodotto.js

import { updateCounts } from './firebase-init.js';

window.selectedProduct = null;

let modalOpen = false;
let raycaster = null;
let mouse = null;
let targetObject = null;
let popupObject = null;

let productsModalInitialized = false;

export function initProductsModal() {
    if (productsModalInitialized) return;
    productsModalInitialized = true;
    console.log("✅ Products modal init");

    bindModalEvents();
    initV3DProductButton();
}

function bindModalEvents() {
    document.querySelectorAll('[data-product]').forEach(btn => {
        btn.onclick = () => selectProduct(btn.dataset.product);
    });

    document.getElementById('close-product-btn').onclick = window.closeProductsModal;

    document.getElementById('products-modal').onclick = (e) => {
        if (e.target.id === 'products-modal') {
            window.closeProductsModal();
        }
    };

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modalOpen) {
            window.closeProductsModal();
        }
    });
}

function initV3DProductButton() {
    const tryInit = () => {
        const v3dContainer = document.getElementById('v3d-container');

        if (!window.v3dApp || !v3dContainer) {
            console.log("⌛ attendo v3dApp...");
            return setTimeout(tryInit, 500);
        }

        const app = window.v3dApp;

        raycaster = new v3d.Raycaster();
        mouse = new v3d.Vector2();

        targetObject = app.scene.getObjectByName('obj_prodFront');
        popupObject = app.scene.getObjectByName('obj_Popup');

        if (popupObject) {
            popupObject.visible = false;
        }

        if (!targetObject) {
            console.log("❌ obj_prodFront non trovato");
            return;
        }

        console.log("✅ obj_prodFront trovato");

        v3dContainer.addEventListener('mousemove', onMouseMove);
        v3dContainer.addEventListener('click', onMouseClick, true);

        console.log("✅ listener 3D attivi");
    };

    tryInit();
}

function updateMousePosition(e, container) {
    const rect = container.getBoundingClientRect();

    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
}

function intersectsTarget(app) {
    raycaster.setFromCamera(mouse, app.camera);
    const intersects = raycaster.intersectObject(targetObject, true);
    return intersects.length > 0;
}

function onMouseMove(e) {
    if (modalOpen) return;

    const app = window.v3dApp;
    const container = document.getElementById('v3d-container');

    updateMousePosition(e, container);

    const hovering = intersectsTarget(app);

    container.style.cursor = hovering ? 'pointer' : 'default';

    if (popupObject) {
        popupObject.visible = hovering;
    }
}

function onMouseClick(e) {
    if (modalOpen) return;

    const app = window.v3dApp;
    const container = document.getElementById('v3d-container');

    updateMousePosition(e, container);

    if (!intersectsTarget(app)) return;

    e.preventDefault();
    e.stopImmediatePropagation();

    console.log("🛒 CLICK obj_prodFront");

    window.showProductsModal();
}

window.showProductsModal = function () {
    if (modalOpen) return;

    const modal = document.getElementById('products-modal');

    modal.style.zIndex = '2147483647';
    modal.classList.add('show');

    document.body.classList.add('modal-open');

    modalOpen = true;

    updateCounts();

    console.log("DEBUG SHOW", modal.className);
    console.log("✅ products modal aperta");
};

window.closeProductsModal = function () {
    modalOpen = false;

    document.body.classList.remove('modal-open');
    // document.getElementById('products-modal').classList.remove('show');

    const modal = document.getElementById('products-modal');
    modal.classList.remove('show');

    console.log("🔒 products modal chiusa");
};

function selectProduct(productId) {
    window.selectedProduct = productId;

    window.closeProductsModal();

    setTimeout(() => {
        window.showPaymentModal(productId);
    }, 250);
}
