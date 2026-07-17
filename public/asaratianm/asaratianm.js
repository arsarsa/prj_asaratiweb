/* __V3D_TEMPLATE__ - template-based file; delete this line to prevent this file from being updated */

console.log('🚀 asaratianm.js caricato');

'use strict';

window.addEventListener('load', async function () {
    try {
        console.log('🚀 Bootstrap Verge3D avviato');

        const params = v3d.AppUtils.getPageParams();

        const appBundle = await createApp({
            containerId: 'v3d-container',
            fsButtonId: 'fullscreen-button',
            sceneURL: params.load || 'asaratianm/asaratianm.gltf',
            logicURL: params.logic || 'asaratianm/visual_logic.js',
        });

        if (!appBundle || !appBundle.app || !appBundle.app.scene) {
            console.error('❌ App o scena non inizializzata');
            return;
        }

        console.log('🔥 APP CREATA');
        window.v3dApp = appBundle.app;

    } catch (err) {
        console.error('❌ Bootstrap error:', err);
    }
});

async function createApp({containerId, fsButtonId = null, sceneURL, logicURL = ''}) {
    if (!sceneURL) {
        console.log('No scene URL specified');
        return null;
    }

    let PL = null, PE = null;

    try {
        if (v3d.AppUtils.isXML(logicURL)) {
            const PUZZLES_DIR = '/puzzles/';
            const logicURLJS = logicURL.match(/(.*)\.xml$/)[1] + '.js';
            PL = await new v3d.PuzzlesLoader().loadEditorWithLogic(PUZZLES_DIR, logicURLJS);
            PE = v3d.PE;
        } else if (v3d.AppUtils.isJS(logicURL)) {
            PL = await new v3d.PuzzlesLoader().loadLogic(logicURL);
        }
    } catch (err) {
        console.error('❌ Logic load error:', err);
        return null;
    }

    let initOptions = { useFullscreen: true };

    if (PL) {
        initOptions = PL.execInitPuzzles({ container: containerId }).initOptions;
    }

    sceneURL = initOptions.useCompAssets ? `${sceneURL}.xz` : sceneURL;

    const disposeFullscreen = prepareFullscreen(containerId, fsButtonId, initOptions.useFullscreen);
    const preloader = createPreloader(containerId, initOptions, PE);

    const app = createAppInstance(containerId, initOptions, preloader, PE);

    app.addEventListener('dispose', () => {
        if (disposeFullscreen) disposeFullscreen();
    });

    return new Promise((resolve) => {
        app.loadScene(sceneURL, () => {
            try {
                if (!app.scene) {
                    console.error("❌ Scene non disponibile");
                    resolve(null);
                    return;
                }

                app.enableControls();
                app.run();

                if (PE) PE.updateAppInstance(app);

                if (PL) {
                    Promise.allSettled(PL.loadedLibraries || []).then(() => {
                        try {
                            PL.init(app, initOptions);
                        } catch (err) {
                            console.error("❌ PL.init error:", err);
                        }
                    });
                }

                runCode(app, PL);

                resolve({ app, PL });

            } catch (err) {
                console.error("❌ loadScene callback error:", err);
                resolve(null);
            }

        }, null, () => {
            console.error(`❌ Can't load the scene ${sceneURL}`);
            resolve(null);
        });
    });
}

function createPreloader(containerId, initOptions, PE) {
    const preloader = initOptions.useCustomPreloader
        ? createCustomPreloader(initOptions.preloaderProgressCb, initOptions.preloaderEndCb)
        : new v3d.SimplePreloader({ container: containerId });

    if (PE) puzzlesEditorPreparePreloader(preloader, PE);

    return preloader;
}

function createCustomPreloader(updateCb, finishCb) {
    class CustomPreloader extends v3d.Preloader {
        onUpdate(percentage) {
            super.onUpdate(percentage);
            if (updateCb) updateCb(percentage);
        }

        onFinish() {
            super.onFinish();
            if (finishCb) finishCb();
        }
    }

    return new CustomPreloader();
}

function puzzlesEditorPreparePreloader(preloader, PE) {
    const _onUpdate = preloader.onUpdate.bind(preloader);
    preloader.onUpdate = function(percentage) {
        _onUpdate(percentage);
        PE.loadingUpdateCb(percentage);
    };

    const _onFinish = preloader.onFinish.bind(preloader);
    preloader.onFinish = function() {
        _onFinish();
        PE.loadingFinishCb();
    };
}

function createAppInstance(containerId, initOptions, preloader, PE) {
    const ctxSettings = {};

    if (initOptions.useBkgTransp) ctxSettings.alpha = true;
    if (initOptions.preserveDrawBuf) ctxSettings.preserveDrawingBuffer = true;

    const app = new v3d.App(containerId, ctxSettings, preloader);

    if (initOptions.useBkgTransp) {
        app.clearBkgOnLoad = true;
        if (app.renderer) {
            app.renderer.setClearColor(0x000000, 0);
        }
    }

    app.ExternalInterface = {};
    prepareExternalInterface(app);

    if (PE) PE.viewportUseAppInstance(app);

    return app;
}

function prepareExternalInterface(app) {}

function prepareFullscreen(containerId, fsButtonId, useFullscreen) {
    return null;
}

function runCode(app, puzzles) {
    if (!app || !app.scene) {
        console.error("❌ runCode abort: scene non pronta");
        return;
    }

    console.log('🎬 runCode ESEGUITO');

    const scene = app.scene;
    const container = app.container;

    const objProdFront = scene.getObjectByName('obj_prodFront');
    if (!objProdFront) {
        console.error("❌ obj_prodFront non trovato");
        return;
    }

    const raycaster = new v3d.Raycaster();
    const mouseVec = new v3d.Vector2();

    container.addEventListener('click', (e) => {
        try {
            if (!app || !app.scene) return;

            const rect = container.getBoundingClientRect();

            const x = (e.clientX - rect.left) / rect.width * 2 - 1;
            const y = -(e.clientY - rect.top) / rect.height * 2 + 1;

            mouseVec.set(x, y);
            raycaster.setFromCamera(mouseVec, app.camera);

            const target = app.scene.getObjectByName('obj_prodFront');
            if (!target) return;

            const intersects = raycaster.intersectObject(target, true);

            if (intersects.length > 0) {
                console.log('🛒 CLICK obj_prodFront rilevato');

                if (typeof window.openProductsModal === 'function') {
                    window.openProductsModal();
                }
            }

        } catch (err) {
            console.error("❌ click handler error:", err);
        }
    });

    window.v3dApp = app;
    console.log('✅ Verge3D stabile');
}
