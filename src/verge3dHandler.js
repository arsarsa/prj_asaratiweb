// src/verge3dHandler.js - BRIDGE SINGOLO

export function initVerge3DBridge() {
    window.openProductsModal = function(attempt = 0) {
        console.log(`🔄 openProductsModal tentativo ${attempt}`);
        const modal = document.getElementById('products-modal');
        if (
            document.readyState === 'complete' &&
            modal &&
            typeof window.showProductsModal === 'function'
        ) {
            window.showProductsModal();
            return;
        }
        if (attempt < 100) {
            setTimeout(() => window.openProductsModal(attempt + 1), 50);
        } else {
            console.error("❌ impossibile aprire products-modal");
        }
    };
    console.log("🔌 Verge3D Bridge pronto");
}
