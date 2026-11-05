// "Tela cheia" (extensão do port, não existe no MZ): ajusta a resolução do jogo à proporção da tela,
// sem distorcer. Mantém a altura do projeto (Sistema 2 → Resolução da tela) e alarga a largura
// (ou o contrário em retrato); a área de UI continua do tamanho do projeto e o runtime a centraliza
// (Scene_Base.createWindowLayer). Assim o mapa mostra mais tiles e não há barras pretas.
//
// Ligado quando: window.MZ_FIT === true (player do APK, via app.json) ou, no teste de jogo do editor,
// localStorage["mzEditor.fitScreen"] === "1" (botão na barra do teste). Carregado antes de main.js.
(function () {
    "use strict";
    let on = window.MZ_FIT === true;
    if (window.MZ_FIT === undefined) {
        try { on = localStorage.getItem("mzEditor.fitScreen") === "1"; } catch (e) { on = false; }
    }
    if (!on) {
        return;
    }
    function fit() {
        const adv = window.$dataSystem && $dataSystem.advanced;
        if (!adv) {
            return;
        }
        const vw = window.innerWidth || screen.width;
        const vh = window.innerHeight || screen.height;
        if (!vw || !vh) {
            return;
        }
        const ratio = vw / vh;
        const w = adv.screenWidth;
        const h = adv.screenHeight;
        if (ratio > w / h) {
            adv.screenWidth = Math.min(4096, Math.round(h * ratio));
        } else if (ratio < w / h) {
            adv.screenHeight = Math.min(4096, Math.round(w / ratio));
        }
        // área de UI nunca maior que a tela
        adv.uiAreaWidth = Math.min(adv.uiAreaWidth || w, adv.screenWidth);
        adv.uiAreaHeight = Math.min(adv.uiAreaHeight || h, adv.screenHeight);
    }
    function patch() {
        if (!window.Scene_Boot || !Scene_Boot.prototype.resizeScreen) {
            return false;
        }
        const original = Scene_Boot.prototype.resizeScreen;
        Scene_Boot.prototype.resizeScreen = function () {
            try { fit(); } catch (e) { console.error("fitscreen", e); }
            original.call(this);
        };
        return true;
    }
    // rmmz_scenes.js é carregado por main.js depois deste script: espera a classe existir
    const timer = setInterval(() => { if (patch()) { clearInterval(timer); } }, 5);
    setTimeout(() => clearInterval(timer), 60000);
    // sem margens nem fundo visível em volta do canvas
    const style = document.createElement("style");
    style.textContent = "html,body{margin:0;padding:0;background:#000;overflow:hidden}";
    (document.head || document.documentElement).appendChild(style);
})();
