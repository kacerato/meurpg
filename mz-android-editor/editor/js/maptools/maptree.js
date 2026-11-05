// Lista de mapas: menu de contexto do MZ (Editar, Novo, Carregar, Copiar, Colar, Excluir,
// Deslocar, Gerar Masmorra, Salvar como Imagem) e arrastar para reagrupar/reordenar.
// A árvore em si é desenhada por app.js (api.refreshMapTree); aqui só mexemos em MapInfos.

import { resizeMapData } from "./editops.js";
import { openMapProperties, newMapData } from "./properties.js";
import { openSampleLoader } from "./sampleloader.js";
import { openShiftDialog, openSaveImageDialog } from "./mapimage.js";
import { openDungeonDialog } from "./dungeon.js";
import { t } from "../i18n.js";

const pad3 = n => String(n).padStart(3, "0");
export const mapPath = id => `data/Map${pad3(id)}.json`;

let ctx; // { api, S, reloadView, updateButtons, editFor }

const $ = id => document.getElementById(id);

export function infos() {
    return ctx.api.project.mapInfos();
}

// Como no MZ, mudanças na lista ficam em memória até "Salvar projeto" (api.saveAll).
async function saveInfos(list) {
    ctx.api.markDirty("data/MapInfos.json", list);
    await ctx.api.refreshMapTree();
    ctx.api.emit("maps:changed", { infos: await infos() });
}

export function descendants(list, id) {
    const out = [];
    const walk = pid => {
        for (const inf of list) {
            if (inf && inf.parentId === pid) {
                out.push(inf.id);
                walk(inf.id);
            }
        }
    };
    walk(id);
    return out;
}

// Renumera "order" percorrendo a árvore em profundidade (ordem de exibição do MZ).
function renumber(list) {
    let n = 1;
    const walk = pid => {
        const kids = list.filter(i => i && i.parentId === pid).sort((a, b) => a.order - b.order);
        for (const k of kids) {
            k.order = n++;
            walk(k.id);
        }
    };
    walk(0);
}

// Insere um mapa novo como último filho de parentId e renumera a ordem.
function insertInfo(list, parentId, name) {
    let id = 1;
    while (list[id]) { id++; }
    if (id > 999) { return null; }
    const info = { id, expanded: false, name: name || "MAP" + pad3(id), order: 1e9, parentId: parentId || 0, scrollX: 0, scrollY: 0 };
    list[id] = info;
    renumber(list);
    return info;
}

export async function createMap(parentId, source) {
    const { api } = ctx;
    const list = await infos();
    let probe = 1;
    while (list[probe]) { probe++; }
    if (probe > 999) {
        api.status(t("Cannot create any more maps.", "MapEditTreeBox"));
        return null;
    }
    let map;
    let name = "MAP" + pad3(probe);
    if (source) {
        map = JSON.parse(JSON.stringify(source.map));
        name = source.info.name;
    } else {
        const cur = ctx.S.cur;
        map = newMapData(cur ? cur.map.tilesetId : 1);
        const r = await openMapProperties(api, { title: t("Map Properties", "Dialog_MapProperties"), map, info: { name } });
        if (!r) { return null; }
        map = r.map;
        resizeMapData(map, r.width, r.height);
        name = r.name;
    }
    const info = insertInfo(list, parentId, name);
    if (!info) {
        api.status(t("Cannot create any more maps.", "MapEditTreeBox"));
        return null;
    }
    api.markDirty(mapPath(info.id), map); // também põe o mapa no cache do projeto
    await saveInfos(list);
    api.emit("map:changed", { id: info.id });
    await api.selectMap(info.id);
    api.status(t("Map %1 created", null, pad3(info.id)));
    return info;
}

export async function editMapProperties(id) {
    const { api, S } = ctx;
    const list = await infos();
    const info = list[id];
    if (!info) { return; }
    const map = await api.project.map(id);
    const r = await openMapProperties(api, { map, info });
    if (!r) { return; }
    const edit = await ctx.editFor(id, map);
    const before = edit.snapshot();
    const keepData = map.data;
    Object.assign(map, r.map, { data: keepData, events: map.events, width: map.width, height: map.height });
    if (r.width !== map.width || r.height !== map.height) {
        resizeMapData(map, r.width, r.height);
    }
    edit.recordFull(t("Map Properties", "Dialog_MapProperties"), before);
    if (info.name !== r.name) {
        info.name = r.name;
        await saveInfos(list);
    }
    if (api.currentMapId === id) {
        S.cur = edit;
        await ctx.reloadView(edit);
    }
    api.emit("map:changed", { id });
    ctx.updateButtons();
}

function confirm(api, text) {
    return new Promise(resolve => {
        const dlg = api.openDialog({
            title: "RPG Maker MZ",
            width: "420px",
            height: "180px",
            buttons: [{ label: t("Yes", "BasicConstants"), primary: true, onClick: () => resolve(true) }, { label: t("No", "BasicConstants"), onClick: () => resolve(false) }]
        });
        dlg.body.textContent = text;
    });
}

export async function deleteMap(id) {
    const { api, S } = ctx;
    const list = await infos();
    const info = list[id];
    if (!info) { return; }
    if (!(await confirm(api, t("Delete %1?", "MapEditTreeBox", info.name)))) { return; }
    const ids = [id, ...descendants(list, id)];
    for (const d of ids) {
        list[d] = null;
        S.edits.delete(d);
        api.markDirty(mapPath(d), null, { del: true }); // o arquivo some no próximo Salvar
    }
    // o MZ não deixa nulls sobrando no fim de MapInfos
    while (list.length > 1 && list[list.length - 1] === null) { list.pop(); }
    renumber(list);
    await saveInfos(list);
    api.emit("maps:changed", { infos: list, removed: ids });
    api.status(t("Map deleted (%1)", null, ids.length));
    if (ids.includes(api.currentMapId)) {
        const first = list.find(Boolean);
        if (first) { await api.selectMap(first.id); }
    }
}

// Abre o mapa id (selecionando-o) e devolve o MapEdit, para as operações do menu.
async function openForEdit(id) {
    const { api } = ctx;
    if (api.currentMapId !== id) {
        await api.selectMap(id);
    }
    return ctx.S.cur && ctx.S.cur.id === id ? ctx.S.cur : null;
}

// Copiar / Colar mapa (menu de contexto e Editar da barra quando a lista tem o foco).
export async function copyMapToClipboard(id) {
    const { api, S } = ctx;
    if (!id) { return; }
    const list = await infos();
    const map = await api.project.map(id);
    S.mapClipboard = { map: JSON.parse(JSON.stringify(map)), info: { ...list[id] } };
    api.status(t("Map copied"));
}

export function pasteMapFromClipboard(parentId) {
    return ctx.S.mapClipboard ? createMap(parentId, ctx.S.mapClipboard) : Promise.resolve(null);
}

// ---------------- Menu de contexto ----------------

function showTreeMenu(x, y, id) {
    const { api, S } = ctx;
    closeTreeMenu();
    const menu = document.createElement("div");
    menu.id = "mtTreeMenu";
    const sep = () => { const d = document.createElement("div"); d.className = "mtMenuSep"; menu.appendChild(d); };
    const items = [
        [t("Edit", "StandardPopupMenu") + "…", () => editMapProperties(id), !id],
        [t("New", "StandardPopupMenu") + "…", () => createMap(id), false],
        [t("Load", "MainMenu") + "…", async () => {
            const r = await openSampleLoader(api);
            if (r) { await createMap(id, r); }
        }, false],
        null,
        [t("Copy", "BasicConstants"), () => copyMapToClipboard(id), !id],
        [t("Paste", "BasicConstants"), () => pasteMapFromClipboard(id), !S.mapClipboard],
        [t("Delete", "BasicConstants"), () => deleteMap(id), !id],
        null,
        [t("Shift", "MainMenu") + "…", async () => {
            const e = await openForEdit(id);
            if (e) { await openShiftDialog(api, e, ctx.afterBulkEdit); }
        }, !id],
        [t("Generate Dungeon", "MainMenu") + "…", async () => {
            const e = await openForEdit(id);
            if (e) { await openDungeonDialog(api, e, ctx.afterBulkEdit); }
        }, !id],
        [t("Save as Image", "MainMenu") + "…", async () => {
            const e = await openForEdit(id);
            if (e) { await openSaveImageDialog(api, e); }
        }, !id]
    ];
    for (const it of items) {
        if (!it) { sep(); continue; }
        const [label, fn, disabled] = it;
        const b = document.createElement("button");
        b.textContent = label;
        b.disabled = !!disabled;
        b.addEventListener("click", () => { closeTreeMenu(); fn(); });
        menu.appendChild(b);
    }
    document.body.appendChild(menu);
    const r = menu.getBoundingClientRect();
    menu.style.left = Math.max(4, Math.min(x, window.innerWidth - r.width - 4)) + "px";
    menu.style.top = Math.max(4, Math.min(y, window.innerHeight - r.height - 4)) + "px";
    setTimeout(() => document.addEventListener("pointerdown", closeOnOutside, true), 0);
    document.addEventListener("keydown", closeOnEsc, true);
}

function closeOnEsc(e) {
    if (e.key === "Escape" && $("mtTreeMenu")) {
        e.preventDefault();
        e.stopPropagation();
        closeTreeMenu();
    }
}

function closeOnOutside(e) {
    const m = $("mtTreeMenu");
    if (m && !m.contains(e.target)) { closeTreeMenu(); }
}

export function closeTreeMenu() {
    const m = $("mtTreeMenu");
    if (m) { m.remove(); }
    document.removeEventListener("pointerdown", closeOnOutside, true);
    document.removeEventListener("keydown", closeOnEsc, true);
}

// ---------------- Arrastar para reagrupar ----------------

// Move `id` para junto de `targetId`: "before"/"after" = irmão, "inside" = último filho.
// targetId 0 = raiz (vai para o fim da raiz).
export function moveInfo(list, id, targetId, where) {
    const info = list[id];
    if (!info || id === targetId) { return false; }
    if (targetId && descendants(list, id).includes(targetId)) { return false; }
    if (!targetId || where === "inside") {
        info.parentId = targetId || 0;
        info.order = 1e9;
        if (targetId && list[targetId]) { list[targetId].expanded = true; }
    } else {
        const target = list[targetId];
        if (!target) { return false; }
        info.parentId = target.parentId;
        // ordem entre irmãos: coloca logo antes/depois do alvo
        const sibs = list.filter(i => i && i.parentId === target.parentId && i.id !== id).sort((a, b) => a.order - b.order);
        let k = 1;
        for (const s of sibs) {
            if (s.id === targetId && where === "before") { info.order = k++; }
            s.order = k++;
            if (s.id === targetId && where === "after") { info.order = k++; }
        }
    }
    // renumber() só compara "order" entre irmãos, então os números pequenos acima bastam
    renumber(list);
    return true;
}

function bindDrag(tree, sidebar) {
    const { api } = ctx;
    let drag = null;
    const rowAt = (x, y) => {
        const el = document.elementFromPoint(x, y);
        return el && el.closest ? el.closest("#mapTree div[data-id]") : null;
    };
    const clearMarks = () => {
        for (const r of tree.querySelectorAll(".mtDropBefore,.mtDropAfter,.mtDropInside")) {
            r.classList.remove("mtDropBefore", "mtDropAfter", "mtDropInside");
        }
        sidebar.classList.remove("mtDropRoot");
    };
    const where = (row, y) => {
        const r = row.getBoundingClientRect();
        const f = (y - r.top) / r.height;
        return f < 0.25 ? "before" : f > 0.75 ? "after" : "inside";
    };
    const start = (id, e) => {
        closeTreeMenu();
        drag = { id, ghost: document.createElement("div"), pointerId: e.pointerId };
        drag.ghost.className = "mtDragGhost";
        const row = tree.querySelector(`div[data-id="${id}"]`);
        drag.ghost.textContent = row ? row.textContent : "MAP" + pad3(id);
        document.body.appendChild(drag.ghost);
        move(e);
    };
    const move = e => {
        if (!drag) { return; }
        drag.ghost.style.left = e.clientX + 12 + "px";
        drag.ghost.style.top = e.clientY + 8 + "px";
        clearMarks();
        const row = rowAt(e.clientX, e.clientY);
        if (row) {
            const w = where(row, e.clientY);
            row.classList.add(w === "before" ? "mtDropBefore" : w === "after" ? "mtDropAfter" : "mtDropInside");
        } else if (sidebar.contains(document.elementFromPoint(e.clientX, e.clientY))) {
            sidebar.classList.add("mtDropRoot");
        }
    };
    const drop = async e => {
        if (!drag) { return; }
        const d = drag;
        drag = null;
        d.ghost.remove();
        clearMarks();
        const row = rowAt(e.clientX, e.clientY);
        const inSidebar = sidebar.contains(document.elementFromPoint(e.clientX, e.clientY));
        if (!row && !inSidebar) { return; }
        const list = await infos();
        const ok = row ? moveInfo(list, d.id, Number(row.dataset.id), where(row, e.clientY)) : moveInfo(list, d.id, 0, "inside");
        if (ok) {
            await saveInfos(list);
            api.status(t("Map moved"));
        }
    };

    // mouse: arrastar a linha; toque: toque longo abre o menu e, se o dedo andar, vira arrasto
    let pending = null;
    let longTimer = 0;
    sidebar.addEventListener("pointerdown", e => {
        const row = e.target.closest && e.target.closest("#mapTree div[data-id]");
        if (e.button !== 0 && e.pointerType === "mouse") { return; }
        pending = { x: e.clientX, y: e.clientY, id: row ? Number(row.dataset.id) : 0, target: e.target, type: e.pointerType, long: false };
        clearTimeout(longTimer);
        if (e.pointerType !== "mouse") {
            longTimer = setTimeout(() => {
                if (!pending) { return; }
                pending.long = true;
                if (navigator.vibrate) { try { navigator.vibrate(20); } catch (_) { /* ignorado */ } }
                showTreeMenu(pending.x, pending.y, pending.id);
            }, 550);
        }
    });
    sidebar.addEventListener("pointermove", e => {
        if (drag) {
            e.preventDefault();
            move(e);
            return;
        }
        if (!pending) { return; }
        const dist = Math.hypot(e.clientX - pending.x, e.clientY - pending.y);
        if (pending.type === "mouse" && pending.id && dist > 8 && (e.buttons & 1)) {
            const id = pending.id;
            pending = null;
            try { sidebar.setPointerCapture(e.pointerId); } catch (_) { /* ignorado */ }
            start(id, e);
        } else if (pending.type !== "mouse" && dist > 12) {
            clearTimeout(longTimer);
            if (pending.long && pending.id) {
                const id = pending.id;
                pending = null;
                try { sidebar.setPointerCapture(e.pointerId); } catch (_) { /* ignorado */ }
                start(id, e);
            } else {
                pending = null; // rolagem normal da lista
            }
        }
    });
    const end = e => {
        clearTimeout(longTimer);
        pending = null;
        if (drag) { drop(e); }
    };
    sidebar.addEventListener("pointerup", end);
    sidebar.addEventListener("pointercancel", e => {
        clearTimeout(longTimer);
        pending = null;
        if (drag) { drag.ghost.remove(); drag = null; clearMarks(); }
    });
    // durante o arrasto por toque, impede a rolagem da lista
    sidebar.addEventListener("touchmove", e => { if (drag) { e.preventDefault(); } }, { passive: false });
}

export function initMapTree(context) {
    ctx = context;
    const sidebar = $("sidebar");
    const tree = $("mapTree");
    if (!sidebar || !tree) { return; }
    const idOf = target => {
        const row = target.closest && target.closest("#mapTree div[data-id]");
        return row ? Number(row.dataset.id) : 0;
    };
    // abrir qualquer diálogo fecha o menu de contexto (antes ele ficava por cima)
    ctx.api.on("dialog:open", closeTreeMenu);
    sidebar.addEventListener("contextmenu", e => {
        e.preventDefault();
        showTreeMenu(e.clientX, e.clientY, idOf(e.target));
    });
    bindDrag(tree, sidebar);
}

