// Barra de menus do RPG Maker MZ (manual 01_04): Arquivo, Editar, Modo, Desenhar, Camada, Zoom,
// Ferramentas, Jogo, Ajuda. Os itens acionam os mesmos botões da barra de ferramentas (habilitado e
// marcado seguem o botão), para não depender da ordem de carga dos módulos.

import { t } from "./i18n.js";

const $ = id => document.getElementById(id);
let openMenu = null;

const btnEnabled = id => () => { const b = $(id); return !!b && !b.disabled; };
const btnOn = id => () => { const b = $(id); return !!b && b.classList.contains("on"); };
const click = id => () => { const b = $(id); if (b && !b.disabled) { b.click(); } };

function layerSelect() {
    return document.querySelector(".mtLayer");
}

function layerItem(value, label, tip) {
    return {
        label, tip,
        enabled: () => { const s = layerSelect(); return !!s && !s.disabled && !!$("btnPencil") && !$("btnPencil").disabled; },
        checked: () => { const s = layerSelect(); return !!s && s.value === value; },
        run: () => {
            const s = layerSelect();
            if (s) { s.value = value; s.dispatchEvent(new Event("change")); }
        }
    };
}

function spec(api, shell) {
    const hasProject = () => shell.hasProject;
    const tools = () => api.tools || {};
    return [
        { label: t("File", "MainMenu"), items: [
            { label: t("New Project", "MainMenu") + "…", key: "Ctrl+N", tip: t("Creates a new project.", "MainMenu"), enabled: btnEnabled("btnNew"), run: click("btnNew") },
            { label: t("Open Project", "MainMenu") + "…", key: "Ctrl+O", tip: t("Opens an existing project.", "MainMenu"), enabled: btnEnabled("btnOpen"), run: click("btnOpen") },
            { label: t("Close Project", "MainMenu"), tip: t("Closes the current project.", "MainMenu"), enabled: hasProject, run: () => shell.closeProjectFlow() },
            null,
            { label: t("Save Project", "MainMenu"), key: "Ctrl+S", tip: t("Saves the current project.", "MainMenu"), enabled: hasProject, run: () => shell.saveProject() },
            null,
            { label: t("Deployment", "MainMenu") + "…", tip: t("Creates a distribution package.", "MainMenu"), enabled: btnEnabled("btnDeploy"), run: click("btnDeploy") },
            null,
            { label: t("Exit %1", "MainMenu", "MZ Editor"), tip: t("Exits the application.", "MainMenu"), run: () => shell.exitFlow() }
        ] },
        { label: t("Edit", "MainMenu"), items: [
            { label: t("Undo", "BasicConstants"), key: "Ctrl+Z", tip: t("Undoes the last action.", "BasicConstants"), enabled: btnEnabled("btnUndo"), run: click("btnUndo") },
            null,
            { label: t("Cut", "BasicConstants"), key: "Ctrl+X", tip: t("Removes and copies the selection to the clipboard.", "BasicConstants"), enabled: btnEnabled("btnCut"), run: click("btnCut") },
            { label: t("Copy", "BasicConstants"), key: "Ctrl+C", tip: t("Copies the selection to the clipboard.", "BasicConstants"), enabled: btnEnabled("btnCopy"), run: click("btnCopy") },
            { label: t("Paste", "BasicConstants"), key: "Ctrl+V", tip: t("Inserts the contents of the clipboard.", "BasicConstants"), enabled: btnEnabled("btnPaste"), run: click("btnPaste") },
            { label: t("Delete", "BasicConstants"), key: "Del", tip: t("Removes the selection.", "BasicConstants"), enabled: btnEnabled("btnDelete"), run: click("btnDelete") }
        ] },
        { label: t("Mode", "MainMenu"), items: [
            { label: t("Map", "MainMenu"), key: "F5", tip: t("Switches to the map editing mode.", "MainMenu"), enabled: btnEnabled("btnModeMap"), checked: btnOn("btnModeMap"), run: click("btnModeMap") },
            { label: t("Event", "MainMenu"), key: "F6", tip: t("Switches to the event editing mode.", "MainMenu"), enabled: btnEnabled("btnModeEvent"), checked: btnOn("btnModeEvent"), run: click("btnModeEvent") }
        ] },
        { label: t("Draw", "MainMenu"), items: [
            { label: t("Pencil", "MainMenu"), tip: t("Draws tiles freehand.", "MainMenu"), enabled: btnEnabled("btnPencil"), checked: btnOn("btnPencil"), run: click("btnPencil") },
            { label: t("Rectangle", "MainMenu"), tip: t("Draws a rectangle.", "MainMenu"), enabled: btnEnabled("btnRect"), checked: btnOn("btnRect"), run: click("btnRect") },
            { label: t("Ellipse", "MainMenu"), tip: t("Draws an ellipse.", "MainMenu"), enabled: btnEnabled("btnEllipse"), checked: btnOn("btnEllipse"), run: click("btnEllipse") },
            { label: t("Flood Fill", "MainMenu"), tip: t("Fills an enclosed area.", "MainMenu"), enabled: btnEnabled("btnFill"), checked: btnOn("btnFill"), run: click("btnFill") },
            { label: t("Shadow Pen", "MainMenu"), tip: t("Adds or removes shadows of walls.", "MainMenu"), enabled: btnEnabled("btnShadow"), checked: btnOn("btnShadow"), run: click("btnShadow") }
        ] },
        { label: t("Layer", "MainMenu"), items: [
            layerItem("-1", t("Automatic", "MainMenu"), t("Writes to all layers.", "MainMenu")),
            null,
            ...[0, 1, 2, 3].map(z => layerItem(String(z), t("Layer %1", "MainMenu", z + 1), t("Writes to layer %1 only.", "MainMenu", z + 1)))
        ] },
        { label: t("Scale", "MainMenu"), items: [
            { label: t("Zoom In", "MainMenu"), tip: t("Zooms in the map view.", "MainMenu"), enabled: hasProject, run: click("btnZoomIn") },
            { label: t("Zoom Out", "MainMenu"), tip: t("Zooms out the map view.", "MainMenu"), enabled: hasProject, run: click("btnZoomOut") },
            { label: t("Actual Size", "MainMenu"), tip: t("Displays the map at a scale of 1:1.", "MainMenu"), enabled: hasProject, run: click("btnZoomActual") }
        ] },
        { label: t("Tools", "MainMenu"), items: [
            { label: t("Database", "MainMenu") + "…", key: "F9", tip: t("Opens the database.", "MainMenu"), enabled: btnEnabled("btnDatabase"), run: click("btnDatabase") },
            { label: t("Plugin Manager", "MainMenu") + "…", key: "F10", tip: t("Opens the plugin manager window.", "MainMenu"), enabled: btnEnabled("btnPlugins"), run: click("btnPlugins") },
            { label: t("Sound Test", "MainMenu") + "…", key: "F11", tip: t("Opens the sound test window.", "MainMenu"), enabled: btnEnabled("btnSoundTest"), run: click("btnSoundTest") },
            { label: t("Event Searcher", "MainMenu") + "…", tip: t("Opens the event searcher window.", "MainMenu"), enabled: btnEnabled("btnEventSearch"), run: click("btnEventSearch") },
            { label: t("Character Generator", "MainMenu") + "…", tip: t("Opens the Character Generator window.", "MainMenu"), enabled: btnEnabled("btnGenerator"), run: click("btnGenerator") },
            { label: t("Resource Manager", "MainMenu") + "…", tip: t("Opens the Resource Manager window.", "MainMenu"), enabled: btnEnabled("btnResources"), run: click("btnResources") },
            null,
            { label: t("Options", "MainMenu") + "…", tip: t("Changes editor settings.", "MainMenu"), enabled: () => !!tools().openOptions, run: () => tools().openOptions() }
        ] },
        { label: t("Game", "MainMenu"), items: [
            { label: t("Playtest", "MainMenu"), key: "Ctrl+R", tip: t("Starts a playtest of the current game.", "MainMenu"), enabled: hasProject, run: () => shell.openPlay() },
            null,
            { label: t("Open Folder", "MainMenu"), tip: t("Opens folder for the current game.", "MainMenu"), enabled: hasProject, run: () => shell.openFolder() },
            { label: t("Update Corescript", "MainMenu") + "…", tip: t("Updates the core js files of the current game.", "MainMenu"), enabled: hasProject, run: () => shell.updateCorescript() }
        ] },
        { label: t("Help", "MainMenu"), items: [
            { label: t("Contents", "MainMenu"), key: "F1", tip: t("Opens the help.", "MainMenu"), enabled: () => !!tools().openHelp, run: () => tools().openHelp() },
            null,
            { label: t("RPG Maker Website"), tip: "https://tkool.jp/", run: () => shell.openUrl("https://tkool.jp/") },
            { label: t("Tutorial", "MainMenu") + "…", tip: t("Start the tutorial.", "MainMenu"), enabled: () => !!tools().openHelp, run: () => tools().openHelp("01_02.html") },
            null,
            { label: t("About", "MainMenu") + "…", tip: t("Displays the version number and copyrights.", "MainMenu"), enabled: () => !!tools().openAbout, run: () => tools().openAbout() }
        ] }
    ];
}

export function closeMenus() {
    if (!openMenu) {
        return false;
    }
    openMenu.drop.remove();
    openMenu.head.classList.remove("open");
    openMenu = null;
    document.removeEventListener("pointerdown", onOutside, true);
    return true;
}

function onOutside(e) {
    if (openMenu && !openMenu.drop.contains(e.target) && !e.target.closest("#menubar")) {
        closeMenus();
    }
}

function show(head, menu) {
    closeMenus();
    const drop = document.createElement("div");
    drop.className = "mbDrop";
    for (const it of menu.items) {
        if (!it) {
            const sep = document.createElement("div");
            sep.className = "mbSep";
            drop.appendChild(sep);
            continue;
        }
        const b = document.createElement("button");
        b.type = "button";
        b.className = "mbItem";
        const enabled = it.enabled ? it.enabled() : true;
        b.disabled = !enabled;
        const chk = document.createElement("span");
        chk.className = "mbCheck";
        chk.textContent = it.checked && it.checked() ? "✓" : "";
        const lab = document.createElement("span");
        lab.className = "mbLabel";
        lab.textContent = it.label;
        const key = document.createElement("span");
        key.className = "mbKey";
        key.textContent = it.key || "";
        b.append(chk, lab, key);
        if (it.tip) {
            b.title = it.tip;
            b.addEventListener("pointerenter", () => { const m = $("statusMsg"); if (m) { m.textContent = it.tip; } });
            b.addEventListener("pointerleave", () => { const m = $("statusMsg"); if (m && m.textContent === it.tip) { m.textContent = ""; } });
        }
        b.addEventListener("click", () => {
            closeMenus();
            const m = $("statusMsg");
            if (m && m.textContent === it.tip) { m.textContent = ""; }
            it.run();
        });
        drop.appendChild(b);
    }
    document.body.appendChild(drop);
    const r = head.getBoundingClientRect();
    drop.style.left = Math.max(2, Math.min(r.left, window.innerWidth - drop.offsetWidth - 2)) + "px";
    drop.style.top = r.bottom + "px";
    head.classList.add("open");
    openMenu = { head, drop, menu };
    setTimeout(() => document.addEventListener("pointerdown", onOutside, true), 0);
}

export function buildMenuBar(api, shell) {
    const bar = $("menubar");
    if (!bar) {
        return;
    }
    bar.innerHTML = "";
    for (const menu of spec(api, shell)) {
        const head = document.createElement("button");
        head.type = "button";
        head.className = "mbHead";
        head.textContent = menu.label;
        head.addEventListener("click", () => {
            if (openMenu && openMenu.head === head) { closeMenus(); } else { show(head, menu); }
        });
        // com um menu aberto, passar o mouse troca de menu (como numa barra de menus nativa)
        head.addEventListener("pointerenter", e => {
            if (openMenu && openMenu.head !== head && e.pointerType === "mouse") { show(head, menu); }
        });
        bar.appendChild(head);
    }
    // um diálogo aberto fecha os menus (e o menu de contexto da lista de mapas)
    api.on("dialog:open", () => closeMenus());
}
