import { Project, patchImageManagerForProject, PROJECT_BASE } from "./project.js";
import { MapView } from "./mapview.js";
import { api } from "./api.js";
import { loadModules } from "./modules.js";
import { t, translateDom, bindOptions } from "./i18n.js";
import { buildMenuBar, closeMenus } from "./menubar.js";

const $ = id => document.getElementById(id);
const pad3 = n => String(n).padStart(3, "0");
const android = window.Android || null;

const project = new Project();
let view = null;
let currentMapId = 0;
let treeExpandChanged = false;

function setStatus(msg) {
    $("statusMsg").textContent = msg || "";
}

// ---------------------------------------------------------------------------------------------
// Lista de mapas (árvore com expandir/recolher, estado em MapInfos.expanded como no MZ)

function buildTree(infos) {
    const byParent = new Map();
    for (const info of infos) {
        if (!info) {
            continue;
        }
        const list = byParent.get(info.parentId) || [];
        list.push(info);
        byParent.set(info.parentId, list);
    }
    const make = parentId => {
        const ul = document.createElement("ul");
        const children = (byParent.get(parentId) || []).sort((a, b) => a.order - b.order);
        for (const info of children) {
            const li = document.createElement("li");
            const row = document.createElement("div");
            const hasKids = byParent.has(info.id);
            const arrow = document.createElement("span");
            arrow.className = "treeArrow" + (hasKids ? (info.expanded ? " open" : "") : " leaf");
            if (hasKids) {
                arrow.addEventListener("click", e => {
                    e.stopPropagation();
                    setExpanded(info, !info.expanded);
                });
                // o toque longo/arrasto da lista não deve começar na seta
                arrow.addEventListener("pointerdown", e => e.stopPropagation());
            }
            const label = document.createElement("span");
            label.className = "treeLabel";
            label.textContent = info.name || `MAP${pad3(info.id)}`;
            row.append(arrow, label);
            row.dataset.id = info.id;
            row.addEventListener("click", () => selectMap(info.id));
            row.addEventListener("dblclick", e => {
                if (hasKids && e.target !== arrow) { setExpanded(info, !info.expanded); }
            });
            li.appendChild(row);
            if (hasKids) {
                const sub = make(info.id);
                sub.hidden = !info.expanded;
                li.appendChild(sub);
            }
            ul.appendChild(li);
        }
        return ul;
    };
    const tree = $("mapTree");
    tree.innerHTML = "";
    tree.appendChild(make(0));
    markSelectedRow();
}

function setExpanded(info, on) {
    if (!!info.expanded === on) {
        return;
    }
    info.expanded = on;
    // como no MZ, o estado vai para MapInfos.json no próximo Salvar (sem marcar o projeto)
    treeExpandChanged = true;
    const row = document.querySelector(`#mapTree div[data-id="${info.id}"]`);
    if (row) {
        const sub = row.parentNode.querySelector(":scope > ul");
        if (sub) { sub.hidden = !on; }
        const arrow = row.querySelector(".treeArrow");
        if (arrow) { arrow.classList.toggle("open", on); }
    }
}

// Abre os pais de um mapa para que ele fique visível na lista.
async function revealInTree(id) {
    const infos = await project.mapInfos();
    let p = infos[id] ? infos[id].parentId : 0;
    let guard = 0;
    while (p && infos[p] && guard++ < 1000) {
        setExpanded(infos[p], true);
        p = infos[p].parentId;
    }
}

function markSelectedRow() {
    for (const row of document.querySelectorAll("#mapTree div[data-id]")) {
        row.classList.toggle("selected", Number(row.dataset.id) === currentMapId);
    }
}

async function selectMap(id) {
    try {
        setStatus(t("Loading map…"));
        const [map, tilesets] = await Promise.all([project.map(id), project.tilesets()]);
        const tileset = tilesets[map.tilesetId];
        if (!tileset) {
            throw new Error(t("Tileset %1 does not exist", null, map.tilesetId));
        }
        currentMapId = id;
        api.currentMapId = id;
        view.load(map, tileset);
        api.emit("map:selected", { id, map, tileset });
        $("emptyHint").classList.add("hidden");
        await revealInTree(id);
        markSelectedRow();
        updateMapStatus(id, map, tileset);
        setStatus("");
        if (window.matchMedia("(max-width: 700px)").matches) {
            $("sidebar").classList.add("hidden");
        }
    } catch (e) {
        console.error(e);
        setStatus(String(e.message || e));
    }
}

// Barra de status: "Mapa 001: Nome · L×A · tileset · n eventos" (o MZ mostra ID e nome do mapa).
async function updateMapStatus(id, map, tileset) {
    const events = (map.events || []).filter(Boolean).length;
    const ts = tileset ? tileset.name : "";
    let name = "";
    try {
        const info = (await project.mapInfos())[id];
        name = info ? info.name : "";
    } catch (_) { /* sem MapInfos */ }
    const label = name ? `${pad3(id)}: ${name}` : pad3(id);
    $("statusMap").textContent = t("Map %1 · %2×%3 · %4 · %5 events", null, label, map.width, map.height, ts, events);
}

async function refreshMapTree() {
    // sem "fresh": MapInfos pode ter alterações ainda não salvas (estão no cache)
    const infos = await project.readJson("data/MapInfos.json");
    buildTree(infos);
    if (currentMapId && view && view.mapData) {
        const tilesets = await project.tilesets();
        updateMapStatus(currentMapId, view.mapData, tilesets[view.mapData.tilesetId]);
    }
}

function updateZoomLabel() {
    $("zoomLabel").textContent = Math.round(view.zoom * 100) + "%";
}

// ---------------------------------------------------------------------------------------------
// Teste de jogo: salva antes (como o MZ) e roda com ?test (F9, Ctrl atravessa, etc.)

let throughTimer = 0;

function gameWindow() {
    try {
        const w = $("playFrame").contentWindow;
        return w && w.Input ? w : null;
    } catch (_) {
        return null;
    }
}

function showPlay(url) {
    const frame = $("playFrame");
    frame.src = url;
    $("playOverlay").hidden = false;
    frame.focus();
}

async function openPlay() {
    if (!api.project) {
        return;
    }
    closeMenus();
    setStatus(t("Saving…"));
    const ok = await api.saveAll();
    setStatus("");
    if (!ok) {
        return;
    }
    showPlay(PROJECT_BASE + "index.html?test");
}

function closePlay() {
    setThrough(false);
    $("playFrame").src = "about:blank";
    $("playOverlay").hidden = true;
}

// Teste de batalha (?btest) e de evento (?etest) abertos por outros módulos também ganham "test",
// como no MZ ("btest&test"), para que F9 e os demais recursos de teste funcionem.
function watchPlayFrame() {
    const frame = $("playFrame");
    new MutationObserver(() => {
        const src = frame.getAttribute("src") || "";
        if (/[?&](btest|etest)(&|$)/.test(src) && !/[?&]test(&|$)/.test(src)) {
            frame.setAttribute("src", src + "&test");
        }
    }).observe(frame, { attributes: true, attributeFilter: ["src"] });
}

// Simula um toque de tecla do Input do runtime (ex.: "debug" = F9).
function pressGameKey(name) {
    const w = gameWindow();
    if (!w) {
        return;
    }
    w.Input._currentState[name] = true;
    setTimeout(() => {
        const w2 = gameWindow();
        if (w2) { w2.Input._currentState[name] = false; }
    }, 120);
    $("playFrame").focus();
}

// "Atravessar" = manter Ctrl pressionado (Game_Player.isDebugThrough, só no modo de teste).
function setThrough(on) {
    clearInterval(throughTimer);
    throughTimer = 0;
    const btn = $("btnPlayThrough");
    if (btn) { btn.classList.toggle("on", on); }
    const w = gameWindow();
    if (w && !on) { w.Input._currentState.control = false; }
    if (on) {
        throughTimer = setInterval(() => {
            const g = gameWindow();
            if (g) { g.Input._currentState.control = true; }
        }, 50);
    }
    $("playFrame").focus();
}

// ---------------------------------------------------------------------------------------------
// Ciclo de vida do projeto: abrir, novo, fechar, sair (com "Salvar as alterações no jogo?")

async function openProjectFlow() {
    if (!android) {
        return;
    }
    if (!(await api.confirmSave())) {
        return;
    }
    android.pickProject();
}

async function closeProjectFlow() {
    if (!api.project) {
        return;
    }
    if (!(await api.confirmSave())) {
        return;
    }
    api.discardOnUnload = true;
    if (android && android.closeProject) {
        android.closeProject();
    } else {
        location.href = location.pathname + "?closed";
    }
}

async function exitFlow() {
    if (!(await api.confirmSave())) {
        return;
    }
    api.discardOnUnload = true;
    if (android && android.exitApp) {
        android.exitApp();
    } else {
        window.close();
        setStatus(t("Close this browser tab to exit."));
    }
}

async function openFolder() {
    if (!api.project) {
        return;
    }
    if (android && android.openFolder) {
        android.openFolder();
        return;
    }
    try {
        const r = await fetch("/api/openFolder", { method: "POST" });
        if (!r.ok) { throw new Error(String(r.status)); }
    } catch (e) {
        setStatus(t("Could not open the folder: %1", null, e.message || e));
    }
}

function openUrl(url) {
    if (android && android.openUrl) {
        android.openUrl(url);
    } else {
        window.open(url, "_blank", "noopener");
    }
}

// Jogo → Atualizar Corescript: copia js/rmmz_*.js e js/libs do editor (template 1.1.1) para o projeto.
const CORE_FILES = ["js/rmmz_core.js", "js/rmmz_managers.js", "js/rmmz_objects.js", "js/rmmz_scenes.js",
    "js/rmmz_sprites.js", "js/rmmz_windows.js", "js/main.js"];

async function coreVersion(fetchText) {
    try {
        const m = /RPGMAKER_VERSION\s*=\s*"([^"]+)"/.exec(await fetchText());
        return m ? m[1] : "?";
    } catch (_) {
        return "?";
    }
}

async function updateCorescript() {
    if (!api.project) {
        return;
    }
    const text = async url => { const r = await fetch(url, { cache: "no-store" }); if (!r.ok) { throw new Error(r.status); } return r.text(); };
    const cur = await coreVersion(() => text("/api/file?path=js/rmmz_core.js"));
    const neu = await coreVersion(() => text("template/js/rmmz_core.js"));
    let libs = [];
    try {
        const man = JSON.parse(await text("template/manifest.json"));
        libs = (man.files || []).map(f => f.path).filter(p => /^js\/libs\//.test(p));
    } catch (_) { /* sem manifest: só os rmmz_*.js */ }
    const files = [...CORE_FILES, ...libs];
    const dlg = api.openDialog({
        title: t("Corescript Updater", "Dialog_CorescriptUpdater"),
        width: "420px",
        height: "220px",
        buttons: [
            { label: t("OK", "BasicConstants"), primary: true, onClick: () => { run(); return false; } },
            { label: t("Cancel", "BasicConstants") }
        ]
    });
    const grid = document.createElement("div");
    grid.className = "coreGrid";
    const row = (a, b) => { const x = document.createElement("span"); x.textContent = a; const y = document.createElement("b"); y.textContent = b; grid.append(x, y); };
    row(t("Current corescript version of the game.", "Dialog_CorescriptUpdater"), cur);
    row(t("New corescript version for update.", "Dialog_CorescriptUpdater"), neu);
    const msg = document.createElement("div");
    msg.className = "coreMsg";
    dlg.body.append(grid, msg);
    let busy = false;
    async function run() {
        if (busy) { return; }
        busy = true;
        try {
            let n = 0;
            for (const f of files) {
                const r = await fetch("template/" + f, { cache: "no-store" });
                if (!r.ok) { continue; }
                await api.project.writeBinary(f, await r.blob(), "application/javascript");
                msg.textContent = `${++n}/${files.length} ${f}`;
            }
            dlg.close();
            setStatus(t("Corescript updated (%1 files).", null, n));
        } catch (e) {
            msg.textContent = String(e.message || e);
            busy = false;
        }
    }
}

// ---------------------------------------------------------------------------------------------
// Atalhos de teclado do MZ (teclado físico / DeX)

function clickButton(id) {
    const b = $(id);
    if (b && !b.disabled) {
        b.click();
        return true;
    }
    return false;
}

function bindShortcuts() {
    document.addEventListener("keydown", e => {
        const tag = (e.target && e.target.tagName) || "";
        const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (e.target && e.target.isContentEditable);
        const dialog = !!document.querySelector(".mzDialogBackdrop");
        const playing = !$("playOverlay").hidden;
        const ctrl = e.ctrlKey || e.metaKey;
        const k = e.key;
        if (k === "Escape") {
            closeMenus();
        }
        if (playing) {
            return; // o teste de jogo usa o teclado
        }
        let handled = true;
        if (ctrl && !e.shiftKey && !e.altKey && k.toLowerCase() === "s") {
            if (!dialog && api.project) { saveProject(); }
        } else if (dialog || typing) {
            handled = false;
        } else if (ctrl && k.toLowerCase() === "n") {
            clickButton("btnNew");
        } else if (ctrl && k.toLowerCase() === "o") {
            clickButton("btnOpen");
        } else if (ctrl && k.toLowerCase() === "r") {
            clickButton("btnPlay");
        } else if (!ctrl && k === "F1") {
            clickButton("btnHelpContents");
        } else if (!ctrl && k === "F5") {
            clickButton("btnModeMap");
        } else if (!ctrl && k === "F6") {
            clickButton("btnModeEvent");
        } else if (!ctrl && k === "F9") {
            clickButton("btnDatabase");
        } else if (!ctrl && k === "F10") {
            clickButton("btnPlugins");
        } else if (!ctrl && k === "F11") {
            clickButton("btnSoundTest");
        } else {
            handled = false;
        }
        if (handled) {
            e.preventDefault();
        }
    });
}

async function saveProject() {
    setStatus(t("Saving…"));
    const n = api.dirtyFiles().filter(f => /^data\/Map\d+\.json$/.test(f)).length;
    const ok = await api.saveAll();
    if (ok) {
        setStatus(n > 1 ? t("Project saved (%1 maps)", null, n) : n ? t("Project saved (%1 map)", null, n) : t("Project saved"));
    }
}

function bindDirtyIndicator() {
    const status = $("status");
    let flag = $("mtModifiedFlag");
    if (!flag) {
        flag = document.createElement("span");
        flag.id = "mtModifiedFlag";
        status.insertBefore(flag, $("statusMsg"));
    }
    const update = () => {
        const d = api.isDirty();
        $("btnSave").classList.toggle("mtModified", d);
        flag.textContent = d ? "● " + t("Modified") : "";
        document.title = (d ? "*" : "") + (project.name || "MZ Editor") + (project.name ? " – MZ Editor" : "");
    };
    api.on("dirty:changed", update);
    update();
}

// ---------------------------------------------------------------------------------------------

function createView() {
    patchImageManagerForProject();
    view = new MapView($("mapCanvas"), $("viewport"));
    view.onPointerTile = (x, y) => {
        $("statusPos").textContent = `(${x}, ${y})`;
    };
    view.app.ticker.add(updateZoomLabel);
}

// Sem projeto: só Novo, Abrir, Ajuda/Sobre/Opções (módulo tools) ficam disponíveis.
const NO_PROJECT_BUTTONS = new Set(["btnMaps", "btnNew", "btnOpen", "btnHelpContents", "btnHelpAbout", "btnToolsMenu"]);

function disableProjectButtons() {
    for (const b of document.querySelectorAll("#toolbar button")) {
        if (!NO_PROJECT_BUTTONS.has(b.id)) {
            b.disabled = true;
        }
    }
}

const shell = {
    get hasProject() { return !!api.project; },
    android,
    openPlay, closeProjectFlow, exitFlow, openFolder, openUrl, updateCorescript, saveProject, openProjectFlow,
    clickButton
};

async function boot() {
    translateDom();
    bindOptions(api);
    project.isDirtyFile = f => api.isDirtyFile(f);
    $("btnMaps").addEventListener("click", () => $("sidebar").classList.toggle("hidden"));
    $("btnZoomIn").addEventListener("click", () => { if (view) { view.setZoom(view.zoom * 1.25); updateZoomLabel(); } });
    $("btnZoomOut").addEventListener("click", () => { if (view) { view.setZoom(view.zoom / 1.25); updateZoomLabel(); } });
    $("btnZoomActual").addEventListener("click", () => { if (view) { view.setZoom(1); updateZoomLabel(); } });
    $("btnGrid").addEventListener("click", e => {
        e.currentTarget.classList.toggle("on");
        if (view) {
            view.setGrid(e.currentTarget.classList.contains("on"));
        }
    });
    $("btnPlay").addEventListener("click", openPlay);
    $("btnPlayClose").addEventListener("click", closePlay);
    $("btnPlayReload").addEventListener("click", () => {
        setThrough(false);
        try { $("playFrame").contentWindow.location.reload(); } catch (_) { /* outra origem */ }
    });
    $("btnPlayDebug").addEventListener("click", () => pressGameKey("debug"));
    $("btnPlayThrough").addEventListener("click", () => setThrough(!throughTimer));
    $("btnPlayFull").addEventListener("click", () => {
        const f = $("playFrame");
        if (document.fullscreenElement) { document.exitFullscreen(); } else if (f.requestFullscreen) { f.requestFullscreen().catch(() => {}); }
    });
    watchPlayFrame();
    bindShortcuts();

    if (android) {
        $("btnOpen").addEventListener("click", openProjectFlow);
    } else {
        $("btnOpen").disabled = true;
        $("btnOpen").title = t("Open Project (on the PC, pass --project to the server)");
    }
    // Novo projeto na casca Android: o Java pergunta aqui antes de trocar de projeto.
    window.mzConfirmLeave = async kind => {
        if (await api.confirmSave()) {
            api.discardOnUnload = true;
            if (android && android.leaveConfirmed) { android.leaveConfirmed(kind); }
        }
    };
    window.mzBack = () => {
        if (closeMenus()) {
            return true;
        }
        if (document.getElementById("mtTreeMenu")) {
            document.getElementById("mtTreeMenu").remove();
            return true;
        }
        if (api.closeTopDialog()) {
            return true;
        }
        if (!$("playOverlay").hidden) {
            closePlay();
            return true;
        }
        if (window.matchMedia("(max-width: 700px)").matches && !$("sidebar").classList.contains("hidden")) {
            $("sidebar").classList.add("hidden");
            return true;
        }
        if (api.isDirty()) {
            exitFlow();
            return true;
        }
        return false;
    };
    window.addEventListener("beforeunload", e => {
        if (api.isDirty() && !api.discardOnUnload) {
            e.preventDefault();
            e.returnValue = "";
        }
    });
    api.shell = shell;
    buildMenuBar(api, shell);

    try {
        let info = null;
        const closed = new URLSearchParams(location.search).has("closed");
        if (!closed) {
            try {
                info = await project.open();
            } catch (e) {
                info = null;
                $("emptyHint").textContent = android
                    ? t("No project is open. Tap “%1” and choose the RPG Maker MZ project folder.", null, t("Open Project", "MainMenu"))
                    : t("No project is open (%1)", null, e.message);
            }
        } else {
            $("emptyHint").textContent = t("No project is open. Tap “%1” and choose the RPG Maker MZ project folder.", null, t("Open Project", "MainMenu"));
        }
        if (!info) {
            // P0: Novo projeto, Ajuda e Opções precisam funcionar no primeiro uso
            await loadModules(api, { noProject: true });
            disableProjectButtons();
            return;
        }
        // Novo projeto (casca Android): a pasta acabou de ser criada vazia; copia o template antes de tudo.
        const newTitle = new URLSearchParams(location.search).get("newProject");
        if (newTitle !== null) {
            $("emptyHint").textContent = t("Creating project…");
            try {
                const np = await import("./tools/newproject.js");
                await np.createProject(np.apiWriter(project), {
                    title: newTitle,
                    onProgress: (done, total, file) => { $("emptyHint").textContent = `${t("Creating project…")} ${done}/${total} ${file}`; }
                });
            } catch (e) {
                console.error(e);
                $("emptyHint").textContent = t("Failed to create the project: %1", null, e.message || e);
                return;
            }
            location.replace(location.pathname);
            return;
        }
        if (typeof Tilemap === "undefined" || typeof ImageManager === "undefined") {
            // o runtime do projeto não carregou (página aberta antes do projeto): recarrega
            location.reload();
            return;
        }
        createView();
        api.project = project;
        api.view = view;
        api.selectMap = selectMap;
        api.refreshMapTree = refreshMapTree;
        api.bindToolbar("btnSave", saveProject, t("Save Project", "MainMenu"));
        bindDirtyIndicator();
        // expandir/recolher entra no MapInfos.json gravado (como o MZ), sem marcar o projeto
        api.on("save", () => {
            if (treeExpandChanged && !api.isDirtyFile("data/MapInfos.json")) {
                api.markDirty("data/MapInfos.json");
            }
        });
        api.on("saved", ({ files }) => { if (files.includes("data/MapInfos.json")) { treeExpandChanged = false; } });
        api.on("map:changed", async ({ id }) => {
            if (id === currentMapId && view.mapData) {
                const tilesets = await project.tilesets();
                updateMapStatus(id, view.mapData, tilesets[view.mapData.tilesetId]);
                view.redrawOverlay();
            }
        });
        await loadModules(api);
        $("projectName").textContent = info.name;
        document.title = info.name + " – MZ Editor";
        const [infos, system] = await Promise.all([project.mapInfos(), project.system()]);
        buildTree(infos);
        const first = system.editMapId && infos[system.editMapId] ? system.editMapId : (infos.find(Boolean) || {}).id;
        if (first) {
            await selectMap(first);
        }
    } catch (e) {
        console.error(e);
        setStatus(String(e.message || e));
    }
}

boot();
