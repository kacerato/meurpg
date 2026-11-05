// Tutoriais do RPG Maker MZ (Ajuda → Tutorial…): Seletor de Tutorial + sobreposição guiada.
//
// Os roteiros são os OFICIAIS: extraídos do Tutorial.exe do MZ 1.1.1 (recursos qrc
// qml/Tutorial/TutorialStep1..19.js e TutorialList.js) com os textos das traduções en/ja/zh do
// próprio Tutorial.exe — ver NOTES.md. Cada passo tem a janela-alvo (windowKey), a condição de
// avanço (click, yesNo, windowState,X,open|close, action,X, list,N, tabView..., spinBox...), o ícone
// (eye/click/doubleClick/rightClick/keyboard/wait) e os saltos (jump / jumpNo).
//
// API: api.tutorial = { open(), start(step), stop(), isRunning() }.
import { t, currentLanguage } from "../i18n.js";

const CSS_ID = "tutorialCss";
const DATA = new URL("./data/", import.meta.url).href;
let API = null;
let listCache = null;
let run = null;          // tutorial em andamento

export function register(api) {
    API = api;
    if (!document.getElementById(CSS_ID)) {
        const link = document.createElement("link");
        link.id = CSS_ID;
        link.rel = "stylesheet";
        link.href = new URL("../../css/tutorial.css", import.meta.url).href;
        document.head.appendChild(link);
    }
    api.tutorial = {
        open: () => openSelector(),
        start: step => startTutorial(step),
        stop: () => stopTutorial(),
        isRunning: () => !!run
    };
}

// ------------------------------------------------------------------ dados

async function loadJson(name) {
    const res = await fetch(DATA + name);
    if (!res.ok) { throw new Error(name + ": " + res.status); }
    return res.json();
}
async function stepList() {
    if (!listCache) { listCache = await loadJson("list.json"); }
    return listCache;
}

// Os textos do Tutorial.exe existem em en, ja_JP e zh_CN; os demais idiomas usam o inglês
// (o MZ faz o mesmo: o Tutorial.exe só traz essas três traduções).
function pick(texts) {
    const lang = currentLanguage();
    if (lang === "ja_JP" && texts.ja_JP) { return texts.ja_JP; }
    if ((lang === "zh_CN" || lang === "zh_TW") && texts.zh_CN) { return texts.zh_CN; }
    return texts.en || texts.ja_JP || "";
}

// ------------------------------------------------------------------ Seletor de Tutorial

function h(tag, props, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
        if (v === undefined || v === null) { continue; }
        if (k === "class") { e.className = v; }
        else if (k === "text") { e.textContent = v; }
        else if (k.startsWith("on")) { e.addEventListener(k.slice(2), v); }
        else { e.setAttribute(k, v); }
    }
    for (const c of kids.flat()) { if (c !== null && c !== undefined && c !== false) { e.append(c); } }
    return e;
}

export async function openSelector() {
    let list;
    try { list = await stepList(); } catch (e) { API.status(String(e.message || e)); return; }
    let cur = 0;
    let dlg = null;
    const start = () => {
        const s = list[cur];
        if (!s) { return false; }
        dlg.close();
        startTutorial(s.step);
        return false;
    };
    dlg = API.openDialog({
        title: t("Tutorial Selector", "Dialog_TutorialSelector"),
        width: "460px",
        height: "min(88vh, 560px)",
        buttons: [
            { label: t("Start Tutorial", "Dialog_TutorialSelector"), primary: true, onClick: start },
            { label: t("Cancel", "BasicConstants") }
        ]
    });
    dlg.root.classList.add("tutSelectorRoot");
    const box = h("div", { class: "tutList", role: "listbox" });
    list.forEach((s, i) => {
        const it = h("div", { class: "tutItem" + (i === cur ? " sel" : ""), role: "option", text: pick(s.title) });
        it.addEventListener("click", () => {
            cur = i;
            for (const x of box.querySelectorAll(".sel")) { x.classList.remove("sel"); }
            it.classList.add("sel");
        });
        it.addEventListener("dblclick", () => { cur = i; start(); });
        box.append(it);
    });
    const primary = dlg.root.querySelector(".mzDialogButtons .primary");
    if (primary) { primary.title = t("Start the selected tutorial.", "Dialog_TutorialSelector"); }
    dlg.body.classList.add("tutSelectorBody");
    dlg.body.append(box);
}

// ------------------------------------------------------------------ execução

// Ações do MZ (MainMenu/ToolBar) → botões da barra deste editor.
const ACTION_TARGET = {
    fileNew: "#btnNew", fileOpen: "#btnOpen", fileSave: "#btnSave", gamePlaytest: "#btnPlay",
    modeMap: "#btnModeMap", modeEvent: "#btnModeEvent", scaleZoomIn: "#btnZoomIn", scaleZoomOut: "#btnZoomOut",
    scaleActualSize: "#btnZoomActual", editUndo: "#btnUndo", editCut: "#btnCut", editCopy: "#btnCopy",
    editPaste: "#btnPaste", editDelete: "#btnDelete", drawPencil: "#btnPencil", drawRectangle: "#btnRect",
    drawEllipse: "#btnEllipse", drawFloodFill: "#btnFill", drawShadowPen: "#btnShadow",
    toolDatabase: "#btnDatabase", toolPluginManager: "#btnPlugins", toolSoundTest: "#btnSoundTest",
    toolEventSearcher: "#btnEventSearch", toolResourceManager: "#btnResources", toolCharacterGenerator: "#btnGenerator"
};
// Janelas abertas a partir da janela principal → botão que as abre.
const OPEN_TARGET = {
    DatabaseMain: "#btnDatabase", NewProject: "#btnNew", GamePlayer: "#btnPlay", PluginManager: "#btnPlugins",
    SoundTest: "#btnSoundTest", EventSearcher: "#btnEventSearch", ResourceManager: "#btnResources",
    CharacterGenerator: "#btnGenerator"
};
// Janelas que não existem neste editor (avançam sozinhas).
const AUTO_WINDOWS = new Set(["Copying", "FileDialog"]);

function topDialog() {
    const all = document.querySelectorAll(".mzDialogBackdrop:not(.tutLayer)");
    return all.length ? all[all.length - 1].querySelector(".mzDialog") : null;
}
function dialogCount() { return document.querySelectorAll(".mzDialogBackdrop:not(.tutLayer)").length; }
function playVisible() { const p = document.getElementById("playOverlay"); return !!p && !p.hidden; }

function parseCond(s) {
    const parts = String(s || "").split(",").map(x => x.trim());
    return { type: parts[0] || "click", args: parts.slice(1).filter(x => x !== "") };
}

export async function startTutorial(step) {
    stopTutorial(true);
    let data;
    try { data = await loadJson(`step${step}.json`); } catch (e) { API.status(String(e.message || e)); return; }
    const items = data.items.filter(it => !it.folder);
    run = { step, data, items, index: 0, cleanup: [], layer: null };
    buildLayer();
    show(0);
}

export function stopTutorial(silent) {
    if (!run) { return; }
    for (const fn of run.cleanup) { try { fn(); } catch (e) { /* nada */ } }
    if (run.layer) { run.layer.remove(); }
    clearHighlight();
    run = null;
    if (!silent) { API.status(""); }
}

function buildLayer() {
    // Camada fixa, fora dos diálogos: não bloqueia o editor (pointer-events só no balão).
    const layer = h("div", { class: "tutLayer" });
    const bubble = h("div", { class: "tutBubble", role: "dialog" });
    const head = h("div", { class: "tutHead" });
    const icon = h("span", { class: "tutIcon" });
    const title = h("span", { class: "tutTitle" });
    const count = h("span", { class: "tutCount" });
    const stop = h("button", { type: "button", class: "tutStop", title: t("Stop tutorial", "MainMenu"), text: "✕" });
    stop.addEventListener("click", () => stopTutorial());
    head.append(icon, title, count, stop);
    const text = h("div", { class: "tutText" });
    const buttons = h("div", { class: "tutButtons" });
    bubble.append(head, text, buttons);
    const arrow = h("div", { class: "tutArrow" });
    layer.append(arrow, bubble);
    document.body.append(layer);
    run.layer = layer;
    run.ui = { bubble, icon, title, count, text, buttons, arrow };
    // arrastar o balão pelo cabeçalho (cobre algo importante na tela pequena)
    let drag = null;
    head.addEventListener("pointerdown", e => {
        if (e.target === stop) { return; }
        const r = bubble.getBoundingClientRect();
        drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
        head.setPointerCapture(e.pointerId);
    });
    head.addEventListener("pointermove", e => {
        if (!drag) { return; }
        bubble.style.left = Math.max(0, e.clientX - drag.dx) + "px";
        bubble.style.top = Math.max(0, e.clientY - drag.dy) + "px";
        bubble.dataset.moved = "1";
    });
    head.addEventListener("pointerup", () => { drag = null; });
    const onResize = () => place();
    window.addEventListener("resize", onResize);
    run.cleanup.push(() => window.removeEventListener("resize", onResize));
}

let hlEl = null;
function clearHighlight() {
    if (hlEl) { hlEl.classList.remove("tutHighlight"); hlEl = null; }
}
function highlight(el) {
    clearHighlight();
    if (el) { hlEl = el; el.classList.add("tutHighlight"); }
}

// Elemento indicado pelo passo (aproximação: o MZ usa coordenadas x/y na janela do PC).
function targetOf(item, cond) {
    const sel = q => (q ? document.querySelector(q) : null);
    if (cond.type === "action") { return sel(ACTION_TARGET[cond.args[0]]); }
    if (cond.type === "windowState" && cond.args[1] === "open" && OPEN_TARGET[cond.args[0]] && (item.windowKey === "MainWindow" || item.windowKey === "Menu")) {
        return sel(OPEN_TARGET[cond.args[0]]);
    }
    if (item.windowKey === "MapEditTreeBox") { return sel("#mapTree"); }
    if (item.windowKey === "MainWindow" && (cond.type === "mouseEvent" || cond.type === "popup" || cond.type === "menuEvent" || cond.type === "pressed")) {
        return sel("#viewport");
    }
    if (item.windowKey !== "MainWindow" && item.windowKey !== "Menu") {
        const d = topDialog();
        if (d && cond.type === "list") {
            // lista N: a N-ésima entrada da primeira lista visível do diálogo (abas do banco, mapas...)
            const n = Number(cond.args[0]);
            const tabs = d.querySelectorAll(".dbTabs:not(.small) > button");
            if (item.windowKey === "DatabaseMain" && tabs.length && n >= 0 && tabs[n]) { return tabs[n]; }
        }
        return d;
    }
    return null;
}

function place() {
    if (!run) { return; }
    const { bubble, arrow } = run.ui;
    const vw = window.innerWidth, vh = window.innerHeight;
    const bw = Math.min(380, vw - 24);
    bubble.style.width = bw + "px";
    const bh = bubble.offsetHeight;
    const tgt = hlEl && hlEl.isConnected ? hlEl.getBoundingClientRect() : null;
    arrow.hidden = true;
    if (bubble.dataset.moved) { return; }
    let x, y;
    if (tgt && tgt.width > 0 && tgt.width < vw * 0.6 && tgt.height < vh * 0.6) {
        // abaixo (ou acima) do alvo, com a seta apontando para ele
        x = Math.min(Math.max(8, tgt.left + tgt.width / 2 - bw / 2), vw - bw - 8);
        const below = tgt.bottom + 14;
        y = below + bh < vh - 8 ? below : Math.max(8, tgt.top - bh - 14);
        if (run.items[run.index] && run.items[run.index].showArrow !== false) {
            arrow.hidden = false;
            arrow.style.left = (tgt.left + tgt.width / 2 - 9) + "px";
            arrow.style.top = (y > tgt.bottom ? tgt.bottom + 2 : tgt.top - 14) + "px";
            arrow.classList.toggle("up", y > tgt.bottom);
        }
    } else if (tgt && tgt.width > 0) {
        // alvo grande (diálogo, mapa): canto inferior direito dele
        x = Math.min(Math.max(8, tgt.right - bw - 12), vw - bw - 8);
        y = Math.min(Math.max(8, tgt.bottom - bh - 12), vh - bh - 8);
    } else {
        x = vw - bw - 16;
        y = vh - bh - 40;
    }
    bubble.style.left = x + "px";
    bubble.style.top = y + "px";
}

const ICON_LABEL = {
    eye: "👁", click: "🖱", doubleClick: "🖱🖱", rightClick: "🖱▸", keyboard: "⌨", wait: "⏳"
};

function show(index) {
    if (!run) { return; }
    // limpa os ouvintes do passo anterior
    for (const fn of run.stepCleanup || []) { try { fn(); } catch (e) { /* nada */ } }
    run.stepCleanup = [];
    if (index < 0 || index >= run.items.length) { finish(); return; }
    run.index = index;
    const item = run.items[index];
    const cond = parseCond(item.condition);
    const { icon, title, count, text, buttons } = run.ui;
    icon.textContent = ICON_LABEL[item.icon] || "";
    icon.className = "tutIcon " + (item.icon || "");
    title.textContent = pick(run.data.title);
    count.textContent = `${index + 1}/${run.items.length}`;
    text.textContent = pick(item.text);
    buttons.innerHTML = "";
    const next = () => advance(item.jump);
    const btn = (label, fn, primary) => {
        const b = h("button", { type: "button", class: "tutBtn" + (primary ? " primary" : ""), text: label });
        b.addEventListener("click", fn);
        buttons.append(b);
        return b;
    };
    highlight(targetOf(item, cond));
    if (item.command && /^presetData,/.test(item.command)) {
        // o MZ grava os dados prontos da etapa no projeto novo (resource/patch/stepN); ver NOTES.md
        text.textContent += "\n\n" + t("The sample data for this step is not available in this editor; continue with your own project.");
    }
    if (cond.type === "yesNo") {
        btn(t("Yes", "BasicConstants"), () => advance(item.jump), true);
        btn(t("No", "BasicConstants"), () => advance(item.jumpNo));
    } else if (cond.type === "click") {
        btn(t("Next"), next, true);
    } else {
        watch(item, cond, next);
        // aproximação para toque: a condição pode não ter equivalente exato aqui
        btn(t("Skip", "EventCommandTexts"), next);
    }
    requestAnimationFrame(place);
    setTimeout(place, 120);
}

function advance(jump) {
    if (!run) { return; }
    if (typeof jump === "number" && jump > 0) {
        const i = run.items.findIndex(it => it.id === jump);
        if (i >= 0) { show(i); return; }
    }
    show(run.index + 1);
}

function finish() {
    const step = run && run.step;
    stopTutorial(true);
    const dlg = API.openDialog({
        title: t("Tutorial", "TutorialManager"), width: "420px", height: "170px",
        buttons: [{ label: t("OK", "BasicConstants"), primary: true }]
    });
    dlg.body.textContent = t("The tutorial has been completed.", "TutorialManager");
    API.emit("tutorial:completed", { step });
}

// Espera a condição do passo. Devolve nada; registra a limpeza em run.stepCleanup.
function watch(item, cond, done) {
    const clean = run.stepCleanup;
    let fired = false;
    const fire = () => { if (!fired && run) { fired = true; setTimeout(done, 60); } };
    const on = (target, ev, fn, opts) => { target.addEventListener(ev, fn, opts); clean.push(() => target.removeEventListener(ev, fn, opts)); };
    const inLayer = e => run && run.layer && run.layer.contains(e.target);

    if (cond.type === "windowState") {
        const [win, state] = cond.args;
        if (AUTO_WINDOWS.has(win) || AUTO_WINDOWS.has(item.windowKey)) { const id = setTimeout(fire, 900); clean.push(() => clearTimeout(id)); return; }
        if (win === "GamePlayer") {
            const id = setInterval(() => { if (state === "close" ? !playVisible() : playVisible()) { fire(); } }, 300);
            clean.push(() => clearInterval(id));
            return;
        }
        const start = dialogCount();
        const mo = new MutationObserver(() => {
            const n = dialogCount();
            if (state === "close" ? n < start : n > start) { fire(); }
        });
        mo.observe(document.body, { childList: true });
        clean.push(() => mo.disconnect());
        return;
    }
    if (cond.type === "action") {
        const name = cond.args[0];
        if (name === "Project Loaded") {
            if (API.project) { const id = setTimeout(fire, 600); clean.push(() => clearTimeout(id)); }
            return;
        }
        if (name === "fileSave") { const fn = () => fire(); API.on("saved", fn); clean.push(() => API.off("saved", fn)); }
        const sel = ACTION_TARGET[name];
        if (sel) {
            on(document, "click", e => { if (e.target.closest && e.target.closest(sel)) { fire(); } }, true);
            return;
        }
        // ações de menu de contexto (Copiar/Colar evento, Posição inicial...): qualquer escolha de menu
        on(document, "click", e => {
            if (inLayer(e)) { return; }
            if (e.target.closest && e.target.closest(".mbMenu, .ctxMenu, [role=menuitem], .mzMenu, .menuItem")) { fire(); }
        }, true);
        return;
    }
    // list / tabView / spinBox / comboBox / checked / radioButton / popup / mouseEvent / pressed / menuEvent:
    // avança na primeira interação do usuário dentro da janela-alvo.
    const scope = () => (item.windowKey === "MainWindow" || item.windowKey === "Menu" || item.windowKey === "MapEditTreeBox") ? null : topDialog();
    const evs = cond.type === "popup" || cond.type === "menuEvent" ? ["contextmenu", "pointerup"]
        : cond.type === "spinBox" || cond.type === "comboBox" || cond.type === "checked" || cond.type === "radioButton" ? ["change", "input"]
            : ["click", "pointerup"];
    for (const ev of evs) {
        on(document, ev, e => {
            if (inLayer(e)) { return; }
            const sc = scope();
            if (sc && !sc.contains(e.target)) { return; }
            if (item.windowKey === "MapEditTreeBox" && !(e.target.closest && e.target.closest("#mapTree, #sidebar"))) { return; }
            fire();
        }, true);
    }
}
