import { Project, patchImageManagerForProject, PROJECT_BASE } from "./project.js";
import { MapView } from "./mapview.js";
import { api } from "./api.js";
import { loadModules } from "./modules.js";
import { t, translateDom, bindOptions } from "./i18n.js";

const $ = id => document.getElementById(id);

const project = new Project();
let view = null;
let currentMapId = 0;

function setStatus(msg) {
    $("statusMsg").textContent = msg || "";
}

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
            row.textContent = info.name || `MAP${String(info.id).padStart(3, "0")}`;
            row.dataset.id = info.id;
            row.addEventListener("click", () => selectMap(info.id));
            li.appendChild(row);
            if (byParent.has(info.id)) {
                li.appendChild(make(info.id));
            }
            ul.appendChild(li);
        }
        return ul;
    };
    const tree = $("mapTree");
    tree.innerHTML = "";
    tree.appendChild(make(0));
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
        for (const row of document.querySelectorAll("#mapTree div")) {
            row.classList.toggle("selected", Number(row.dataset.id) === id);
        }
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

function updateMapStatus(id, map, tileset) {
    const events = (map.events || []).filter(Boolean).length;
    const ts = tileset ? tileset.name : "";
    $("statusMap").textContent = t("Map %1 · %2×%3 · %4 · %5 events", null, String(id).padStart(3, "0"), map.width, map.height, ts, events);
}

async function refreshMapTree() {
    const infos = await project.readJson("data/MapInfos.json", { fresh: true });
    buildTree(infos);
    for (const row of document.querySelectorAll("#mapTree div")) {
        row.classList.toggle("selected", Number(row.dataset.id) === currentMapId);
    }
}

function updateZoomLabel() {
    $("zoomLabel").textContent = Math.round(view.zoom * 100) + "%";
}

function openPlay() {
    const frame = $("playFrame");
    frame.src = PROJECT_BASE + "index.html";
    $("playOverlay").hidden = false;
    frame.focus();
}

function closePlay() {
    $("playFrame").src = "about:blank";
    $("playOverlay").hidden = true;
}

function createView() {
    patchImageManagerForProject();
    view = new MapView($("mapCanvas"), $("viewport"));
    view.onPointerTile = (x, y) => {
        $("statusPos").textContent = `(${x}, ${y})`;
    };
    view.app.ticker.add(updateZoomLabel);
}

async function boot() {
    translateDom();
    bindOptions(api);
    $("btnMaps").addEventListener("click", () => $("sidebar").classList.toggle("hidden"));
    $("btnZoomIn").addEventListener("click", () => { if (view) { view.setZoom(view.zoom * 1.25); updateZoomLabel(); } });
    $("btnZoomOut").addEventListener("click", () => { if (view) { view.setZoom(view.zoom / 1.25); updateZoomLabel(); } });
    $("btnGrid").addEventListener("click", e => {
        e.currentTarget.classList.toggle("on");
        if (view) {
            view.setGrid(e.currentTarget.classList.contains("on"));
        }
    });
    $("btnPlay").addEventListener("click", openPlay);
    $("btnPlayClose").addEventListener("click", closePlay);
    $("btnPlayReload").addEventListener("click", () => { $("playFrame").contentWindow.location.reload(); });

    // Integração com a casca Android (window.Android é a ponte Java).
    const android = window.Android;
    if (android) {
        $("btnOpen").addEventListener("click", () => android.pickProject());
    } else {
        $("btnOpen").disabled = true;
        $("btnOpen").title = t("Open Project (on the PC, pass --project to the server)");
    }
    $("btnZoomActual").addEventListener("click", () => { if (view) { view.setZoom(1); updateZoomLabel(); } });
    window.mzBack = () => {
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
        return false;
    };

    try {
        let info;
        try {
            info = await project.open();
        } catch (e) {
            $("emptyHint").textContent = android
                ? t("No project is open. Tap “%1” and choose the RPG Maker MZ project folder.", null, t("Open Project", "MainMenu"))
                : t("No project is open (%1)", null, e.message);
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
