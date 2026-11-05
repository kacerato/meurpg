// Módulo maptools: paleta de tiles, ferramentas de desenho com autotile, seleção,
// recortar/copiar/colar/excluir, desfazer/refazer por mapa, propriedades do mapa,
// novo mapa e gravação. Fiel ao RPG Maker MZ 1.1.1 (ver NOTES.md).

import * as T from "./autotile.js";
import { MapEdit, LAYER_AUTO, resizeMapData } from "./editops.js";
import { Palette } from "./palette.js";
import { regionColor } from "./render.js";
import { openMapProperties, newMapData } from "./properties.js";

const TILE = 48;
const TOOLS = { btnPencil: "pencil", btnRect: "rect", btnEllipse: "ellipse", btnFill: "fill", btnShadow: "shadow" };
const pad3 = n => String(n).padStart(3, "0");
const mapPath = id => `data/Map${pad3(id)}.json`;

let api;
const S = {
    tool: null,          // pencil | rect | ellipse | fill | shadow | select | null (rolar)
    brush: { kind: "palette", w: 1, h: 1, cells: [T.makeAutotileId(16, 0)], region: false },
    layer: LAYER_AUTO,
    autotileOff: false,
    edits: new Map(),    // id -> MapEdit
    cur: null,
    selection: null,     // {x0,y0,x1,y1}
    clipboard: null,     // pincel "map"
    mapClipboard: null,  // {map, info}
    infos: null,
    infosModified: false,
    palette: null,
    hover: null,
    gesture: null
};

function $(id) { return document.getElementById(id); }

function injectCss() {
    if (document.querySelector("link[data-maptools]")) {
        return;
    }
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = new URL("../../css/maptools.css", import.meta.url).href;
    link.dataset.maptools = "1";
    document.head.appendChild(link);
}

function isEventMode() {
    const b = $("btnModeEvent");
    return !!(b && b.classList.contains("on"));
}

function dialogOpen() {
    return !!document.querySelector(".mzDialogBackdrop");
}

// ---------------- Painel (paleta + faixa de ferramentas) ----------------

function buildPanel() {
    const panel = document.createElement("aside");
    panel.id = "mtPanel";
    const strip = document.createElement("div");
    strip.className = "mtStrip";
    const mk = (cls, title, html, onClick) => {
        const b = document.createElement("button");
        b.className = "mtTool " + cls;
        b.title = title;
        b.innerHTML = html;
        b.addEventListener("click", onClick);
        strip.appendChild(b);
        return b;
    };
    S.ui = {};
    S.ui.select = mk("toggle", "Selecionar área (para Recortar/Copiar/Excluir)", '<span class="mtMarquee"></span>', () => setTool(S.tool === "select" ? null : "select"));
    S.ui.undo = mk("", "Desfazer (Ctrl+Z)", '<img src="img/toolbar/edit-undo.png" alt="">', () => doUndo());
    S.ui.redo = mk("", "Refazer (Ctrl+Y)", '<img src="img/toolbar/edit-redo.png" alt="">', () => doRedo());
    S.ui.auto = mk("toggle", "Sem autotile (o mesmo que segurar Shift)", '<span class="mtNoAuto">A</span>', () => {
        S.autotileOff = !S.autotileOff;
        S.ui.auto.classList.toggle("on", S.autotileOff);
    });
    const layer = document.createElement("select");
    layer.className = "mtLayer";
    layer.title = "Camada";
    [["-1", "Automático"], ["0", "Camada 1"], ["1", "Camada 2"], ["2", "Camada 3"], ["3", "Camada 4"]].forEach(([v, t]) => {
        const o = document.createElement("option");
        o.value = v;
        o.textContent = t;
        layer.appendChild(o);
    });
    layer.addEventListener("change", () => { S.layer = Number(layer.value); drawOverlay(); });
    strip.appendChild(layer);
    S.ui.layer = layer;
    mk("", "Tiles menores", "−", () => S.palette.setCellSize(Math.max(16, S.palette.cell - 8)));
    mk("", "Tiles maiores", "+", () => S.palette.setCellSize(Math.min(48, S.palette.cell + 8)));

    const pal = document.createElement("div");
    panel.append(strip, pal);
    const main = $("main");
    const sidebar = $("sidebar");
    main.insertBefore(panel, sidebar ? sidebar.nextSibling : main.firstChild);
    S.palette = new Palette(pal, {
        onSelect: brush => {
            S.brush = brush;
            drawOverlay();
        }
    });
    S.palette.setCellSize(window.innerWidth < 1000 ? 24 : 32);

    // botão para mostrar/ocultar a paleta (gaveta no toque)
    const toggle = document.createElement("button");
    toggle.id = "mtBtnPalette";
    toggle.className = "tb toggle on";
    toggle.title = "Mostrar/ocultar paleta de tiles";
    toggle.innerHTML = '<span class="mtPalIcon"></span>';
    toggle.addEventListener("click", () => {
        panel.classList.toggle("hidden");
        toggle.classList.toggle("on", !panel.classList.contains("hidden"));
    });
    const maps = $("btnMaps");
    if (maps && maps.parentNode) {
        maps.parentNode.insertBefore(toggle, maps.nextSibling);
    }
    if (window.matchMedia("(max-width: 700px)").matches) {
        panel.classList.add("hidden");
        toggle.classList.remove("on");
    }
    S.panel = panel;
}

function setTool(tool) {
    S.tool = tool;
    for (const [id, t] of Object.entries(TOOLS)) {
        const b = $(id);
        if (b) { b.classList.toggle("on", t === tool); }
    }
    if (S.ui) { S.ui.select.classList.toggle("on", tool === "select"); }
    if (tool !== "select") {
        // a seleção continua visível para colar/excluir até trocar de mapa
    }
    const vp = $("viewport");
    if (vp) { vp.classList.toggle("mtPainting", !!tool); }
    drawOverlay();
}

// ---------------- Estado do mapa ----------------

function currentEdit() {
    return S.cur && api.view && api.view.mapData === S.cur.map ? S.cur : null;
}

function onMapSelected({ id, map, tileset }) {
    let edit = S.edits.get(id);
    if (!edit || edit.map !== map) {
        edit = new MapEdit(id, map, tileset);
        S.edits.set(id, edit);
    }
    edit.tileset = tileset;
    S.cur = edit;
    S.selection = null;
    if (S.palette.tileset !== tileset) {
        S.palette.setTileset(tileset);
    }
    attachOverlay();
    updateButtons();
}

function refreshView() {
    const v = api.view;
    if (v && v.tilemap) {
        v.tilemap.refresh();
    }
    drawOverlay();
    updateButtons();
}

async function reloadView(edit) {
    const tilesets = await api.project.tilesets();
    const tileset = tilesets[edit.map.tilesetId];
    if (!tileset) {
        return;
    }
    edit.tileset = tileset;
    const v = api.view;
    const sx = v.scrollX, sy = v.scrollY;
    v.load(edit.map, tileset);
    v.scrollBy(sx, sy);
    if (S.palette.tileset !== tileset) {
        S.palette.setTileset(tileset);
    }
    attachOverlay();
    updateStatusMap(edit.id, edit.map, tileset);
    api.emit("map:selected", { id: edit.id, map: edit.map, tileset });
}

function anyModified() {
    if (S.infosModified) {
        return true;
    }
    for (const e of S.edits.values()) {
        if (e.modified) {
            return true;
        }
    }
    return false;
}

function updateButtons() {
    const e = currentEdit();
    const undo = $("btnUndo");
    if (undo) { undo.disabled = !(e && e.undoStack.length); }
    if (S.ui) {
        S.ui.undo.disabled = !(e && e.undoStack.length);
        S.ui.redo.disabled = !(e && e.redoStack.length);
    }
    // no modo evento os botões de edição pertencem ao módulo de eventos: ficam habilitados
    const ev = isEventMode();
    const hasSel = !!S.selection;
    for (const id of ["btnCut", "btnCopy", "btnDelete"]) {
        const b = $(id);
        if (b) { b.disabled = !ev && !hasSel; }
    }
    const paste = $("btnPaste");
    if (paste) { paste.disabled = !ev && !S.clipboard; }
    const mod = anyModified();
    const save = $("btnSave");
    if (save) { save.classList.toggle("mtModified", mod); }
    const ind = $("mtModifiedFlag");
    if (ind) {
        ind.textContent = mod ? "● Modificado" : "";
    }
}

// ---------------- Desfazer / refazer ----------------

function afterHistory(rec, edit) {
    if (!rec) {
        return;
    }
    if (rec.full) {
        reloadView(edit);
        updateMapTreeRow(edit.id);
    } else {
        refreshView();
    }
    api.status((rec === edit.redoStack[edit.redoStack.length - 1] ? "Desfazer: " : "Refazer: ") + (rec.label || ""));
    updateButtons();
}

function doUndo() {
    const e = currentEdit();
    if (!e || isEventMode()) { return; }
    afterHistory(e.undo(), e);
}

function doRedo() {
    const e = currentEdit();
    if (!e || isEventMode()) { return; }
    afterHistory(e.redo(), e);
}

// ---------------- Seleção / área de transferência ----------------

function selRect() {
    const s = S.selection;
    return s ? [Math.min(s.x0, s.x1), Math.min(s.y0, s.y1), Math.max(s.x0, s.x1), Math.max(s.y0, s.y1)] : null;
}

function doCopy() {
    const e = currentEdit();
    const r = selRect();
    if (!e || !r || isEventMode()) { return false; }
    S.clipboard = e.copyArea(...r);
    api.status(`Copiado ${S.clipboard.w}×${S.clipboard.h}`);
    updateButtons();
    return true;
}

function doDelete(label = "Excluir") {
    const e = currentEdit();
    const r = selRect();
    if (!e || !r || isEventMode()) { return; }
    e.begin(label);
    e.clearArea(...r, S.layer, S.palette.isRegion);
    e.fixup(!S.autotileOff);
    e.commit();
    refreshView();
}

function doCut() {
    if (doCopy()) {
        doDelete("Recortar");
    }
}

function doPaste() {
    if (!S.clipboard || isEventMode()) { return; }
    S.brush = S.clipboard;
    S.palette.clearSelectionMark();
    if (S.tool !== "pencil") {
        setTool("pencil");
    }
    api.status("Colar: toque no mapa para posicionar");
    drawOverlay();
}

// ---------------- Gravação ----------------

async function doSave() {
    try {
        let n = 0;
        for (const e of S.edits.values()) {
            if (e.modified) {
                await api.project.writeJson(mapPath(e.id), e.map);
                e.modified = false;
                n++;
                api.emit("map:changed", { id: e.id });
            }
        }
        if (S.infosModified && S.infos) {
            await api.project.writeJson("data/MapInfos.json", S.infos);
            S.infosModified = false;
            api.emit("maps:changed", { infos: S.infos });
        }
        api.status(n ? `Projeto salvo (${n} mapa${n > 1 ? "s" : ""})` : "Projeto salvo");
    } catch (err) {
        console.error(err);
        api.status("Falha ao salvar: " + (err.message || err));
    }
    updateButtons();
}

// ---------------- Sobreposição no mapa (cursor, seleção, regiões) ----------------

function attachOverlay() {
    const v = api.view;
    if (!v) { return; }
    if (!S.layerC) {
        S.layerC = new PIXI.Container();
        S.regionC = new PIXI.Container();
        S.gfx = new PIXI.Graphics();
        S.layerC.addChild(S.regionC, S.gfx);
        S.regionTex = new Map();
        S.regionPool = [];
        v.app.ticker.add(tick);
    }
    v.world.addChild(S.layerC); // por cima do tilemap e da moldura de eventos
    S.regionKey = "";
    drawOverlay();
}

function regionTexture(id) {
    let tex = S.regionTex.get(id);
    if (!tex) {
        const c = document.createElement("canvas");
        c.width = c.height = TILE;
        const g = c.getContext("2d");
        g.fillStyle = regionColor(id, 0.5);
        g.fillRect(0, 0, TILE, TILE);
        g.font = 'bold 20px "M+ 1p", sans-serif';
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.lineWidth = 3;
        g.strokeStyle = "rgba(0,0,0,.7)";
        g.strokeText(String(id), TILE / 2, TILE / 2);
        g.fillStyle = "#fff";
        g.fillText(String(id), TILE / 2, TILE / 2);
        tex = PIXI.Texture.from(c);
        S.regionTex.set(id, tex);
    }
    return tex;
}

S.regionVersion = 0;

function drawRegions() {
    const v = api.view;
    const e = currentEdit();
    const show = e && S.palette.isRegion;
    if (!show) {
        if (S.regionC.visible) { S.regionC.visible = false; }
        return;
    }
    const z = v.zoom;
    const x0 = Math.max(0, Math.floor(v.scrollX / z / TILE));
    const y0 = Math.max(0, Math.floor(v.scrollY / z / TILE));
    const x1 = Math.min(e.w - 1, Math.ceil((v.scrollX + v.app.renderer.width) / z / TILE));
    const y1 = Math.min(e.h - 1, Math.ceil((v.scrollY + v.app.renderer.height) / z / TILE));
    const key = [x0, y0, x1, y1, S.regionVersion, e.id, e.undoStack.length, e.redoStack.length].join(",");
    S.regionC.visible = true;
    if (key === S.regionKey) {
        return;
    }
    S.regionKey = key;
    let n = 0;
    for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
            const r = e.get(x, y, 5);
            if (!r) { continue; }
            let sp = S.regionPool[n];
            if (!sp) {
                sp = new PIXI.Sprite();
                S.regionPool.push(sp);
                S.regionC.addChild(sp);
            }
            sp.texture = regionTexture(r);
            sp.position.set(x * TILE, y * TILE);
            sp.visible = true;
            n++;
        }
    }
    for (let i = n; i < S.regionPool.length; i++) {
        S.regionPool[i].visible = false;
    }
}

function tick() {
    const v = api.view;
    if (!v || !S.layerC) { return; }
    S.layerC.position.copyFrom(v.overlay.position);
    drawRegions();
}

function drawOverlay() {
    if (!S.gfx) { return; }
    const g = S.gfx;
    g.clear();
    const e = currentEdit();
    if (!e) { return; }
    S.regionVersion++;
    const r = selRect();
    if (r) {
        const [x0, y0, x1, y1] = r;
        const w = (x1 - x0 + 1) * TILE, h = (y1 - y0 + 1) * TILE;
        g.lineStyle(4, 0x000000, 0.8).drawRect(x0 * TILE, y0 * TILE, w, h);
        g.lineStyle(2, 0xffffff, 1).drawRect(x0 * TILE, y0 * TILE, w, h);
        g.beginFill(0x3c82e6, 0.18).lineStyle(0).drawRect(x0 * TILE, y0 * TILE, w, h).endFill();
    }
    const hov = S.hover;
    if (hov && S.tool && S.tool !== "select") {
        let w = TILE, h = TILE, x = hov.x * TILE, y = hov.y * TILE;
        if (S.tool === "shadow") {
            w = h = TILE / 2;
            x += hov.qx * w;
            y += hov.qy * h;
        } else if (S.tool === "pencil") {
            w = S.brush.w * TILE;
            h = S.brush.h * TILE;
        }
        g.lineStyle(3, 0x000000, 0.7).drawRect(x, y, w, h);
        g.lineStyle(1.5, 0xffffff, 1).drawRect(x, y, w, h);
    }
}

// ---------------- Entrada no mapa ----------------

function tileFromEvent(e) {
    const v = api.view;
    const rect = v.viewport.getBoundingClientRect();
    const z = v.zoom;
    const fx = (e.clientX - rect.left - v.world.position.x + v.scrollX) / (TILE * z);
    const fy = (e.clientY - rect.top - v.world.position.y + v.scrollY) / (TILE * z);
    const x = Math.floor(fx), y = Math.floor(fy);
    return { x, y, qx: fx - x >= 0.5 ? 1 : 0, qy: fy - y >= 0.5 ? 1 : 0 };
}

function linePoints(x0, y0, x1, y1) {
    const pts = [];
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
        pts.push([x0, y0]);
        if (x0 === x1 && y0 === y1) { break; }
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
    }
    return pts;
}

function strokeStart(g, t, shift) {
    const e = g.edit;
    const region = S.palette.isRegion;
    g.auto = !(shift || S.autotileOff) && !region;
    g.last = t;
    g.anchor = t;
    const brush = S.brush;
    switch (g.tool) {
        case "pencil":
            e.begin("Lápis");
            e.stamp(brush, t.x, t.y, t.x, t.y, S.layer, region);
            break;
        case "rect":
        case "ellipse":
            e.begin(g.tool === "rect" ? "Retângulo" : "Elipse");
            e.fillRect(brush, t.x, t.y, t.x, t.y, S.layer, region, g.tool === "ellipse");
            break;
        case "fill":
            e.begin("Preenchimento");
            e.floodFill(brush, t.x, t.y, S.layer, region);
            break;
        case "shadow": {
            e.begin("Sombra");
            const bit = 1 << (t.qy * 2 + t.qx);
            g.shadowOn = !(e.get(t.x, t.y, 4) & bit);
            e.shadowQuarter(t.x, t.y, bit, g.shadowOn);
            g.lastQ = `${t.x},${t.y},${bit}`;
            break;
        }
        case "select":
            S.selection = { x0: t.x, y0: t.y, x1: t.x, y1: t.y };
            break;
    }
    if (g.tool !== "select" && g.tool !== "shadow") {
        e.fixup(g.auto);
    }
    refreshView();
}

function strokeMove(g, t) {
    const e = g.edit;
    const region = S.palette.isRegion;
    const brush = S.brush;
    switch (g.tool) {
        case "pencil": {
            if (t.x === g.last.x && t.y === g.last.y) { return; }
            for (const [x, y] of linePoints(g.last.x, g.last.y, t.x, t.y).slice(1)) {
                e.stamp(brush, g.anchor.x, g.anchor.y, x, y, S.layer, region);
            }
            e.fixup(g.auto);
            break;
        }
        case "rect":
        case "ellipse":
            if (t.x === g.last.x && t.y === g.last.y) { return; }
            e.rollback();
            e.fillRect(brush, g.anchor.x, g.anchor.y, t.x, t.y, S.layer, region, g.tool === "ellipse");
            e.fixup(g.auto);
            break;
        case "shadow": {
            const bit = 1 << (t.qy * 2 + t.qx);
            const k = `${t.x},${t.y},${bit}`;
            if (k === g.lastQ) { return; }
            g.lastQ = k;
            e.shadowQuarter(t.x, t.y, bit, g.shadowOn);
            break;
        }
        case "select":
            S.selection.x1 = Math.max(0, Math.min(e.w - 1, t.x));
            S.selection.y1 = Math.max(0, Math.min(e.h - 1, t.y));
            break;
        default:
            return;
    }
    g.last = t;
    refreshView();
}

function strokeEnd(g) {
    if (g.tool === "select") {
        const r = selRect();
        if (r && r[0] === r[2] && r[1] === r[3] && g.tapOnly) {
            // toque simples fora de uma área: limpa a seleção
            S.selection = null;
        }
        refreshView();
        return;
    }
    if (g.edit.stroke) {
        g.edit.commit();
    }
    refreshView();
}

// Conta-gotas (clique direito / toque longo). Área (arrastar) = copia como pincel.
function eyedrop(g, t0, t1, exact) {
    const e = g.edit;
    const region = S.palette.isRegion;
    if (t1 && (t0.x !== t1.x || t0.y !== t1.y)) {
        const b = e.copyArea(t0.x, t0.y, t1.x, t1.y);
        S.brush = b;
        S.palette.clearSelectionMark();
        api.status(`Pincel ${b.w}×${b.h} copiado do mapa`);
    } else {
        const p = e.pick(t0.x, t0.y, S.layer, region, exact);
        if (!p) { return; }
        S.palette.selectTile(p.id, p.region);
        S.brush = { kind: "palette", w: 1, h: 1, cells: [p.id], region: p.region };
    }
    drawOverlay();
}

function bindViewport() {
    const vp = $("viewport");
    let handingOver = false;
    const LONG_MS = 500;

    vp.addEventListener("contextmenu", e => {
        if (currentEdit() && !isEventMode()) { e.preventDefault(); }
    });

    vp.addEventListener("pointerdown", e => {
        if (handingOver) { return; }
        const edit = currentEdit();
        const g = S.gesture;
        // segundo dedo durante um traço: cancela o traço e devolve os dois dedos ao visualizador
        if (g && e.pointerId !== g.pointerId && e.pointerType !== "mouse") {
            clearTimeout(g.longTimer);
            if (g.edit.stroke) { g.edit.cancel(); }
            if (g.tool === "select" && g.prevSel !== undefined) { S.selection = g.prevSel; }
            S.gesture = null;
            refreshView();
            try { vp.releasePointerCapture(g.pointerId); } catch (_) { /* ignorado */ }
            handingOver = true;
            vp.dispatchEvent(new PointerEvent("pointerdown", {
                pointerId: g.pointerId, pointerType: e.pointerType, isPrimary: true,
                clientX: g.lastX, clientY: g.lastY, bubbles: true, cancelable: true, buttons: 1
            }));
            handingOver = false;
            return; // este evento segue para o visualizador (pinça)
        }
        if (!edit || isEventMode() || dialogOpen()) { return; }
        const t = tileFromEvent(e);
        const isMouse = e.pointerType === "mouse";
        if (isMouse && e.button === 2) {
            // conta-gotas / cópia de área com o botão direito
            e.stopPropagation();
            e.preventDefault();
            vp.setPointerCapture(e.pointerId);
            S.gesture = { pointerId: e.pointerId, edit, mode: "pick", t0: t, t1: t, exact: e.shiftKey, lastX: e.clientX, lastY: e.clientY };
            return;
        }
        if (isMouse && e.button !== 0) { return; }
        if (!S.tool) { return; } // sem ferramenta: o visualizador rola/arrasta
        if (!edit.grid.inside(t.x, t.y) && S.tool !== "select") { return; }
        e.stopPropagation();
        e.preventDefault();
        if (isMouse) { vp.setPointerCapture(e.pointerId); }
        const gg = {
            pointerId: e.pointerId, edit, tool: S.tool, mode: "draw", tapOnly: true,
            startX: e.clientX, startY: e.clientY, lastX: e.clientX, lastY: e.clientY, t0: t,
            prevSel: S.selection
        };
        S.gesture = gg;
        strokeStart(gg, t, e.shiftKey);
        if (!isMouse) {
            // toque longo parado = conta-gotas (desfaz o que o toque desenhou)
            gg.longTimer = setTimeout(() => {
                if (S.gesture !== gg || !gg.tapOnly) { return; }
                if (gg.edit.stroke) { gg.edit.cancel(); }
                if (gg.tool === "select") { S.selection = gg.prevSel; }
                gg.mode = "pick";
                gg.t1 = gg.t0;
                if (navigator.vibrate) { navigator.vibrate(20); }
                refreshView();
                api.status("Conta-gotas: solte para pegar o tile, arraste para copiar uma área");
            }, LONG_MS);
        }
    }, { capture: true });

    vp.addEventListener("pointermove", e => {
        const edit = currentEdit();
        if (edit && S.tool && !isEventMode()) {
            const t = tileFromEvent(e);
            const h = S.hover;
            if (!h || h.x !== t.x || h.y !== t.y || h.qx !== t.qx || h.qy !== t.qy) {
                S.hover = t;
                drawOverlay();
            }
        }
        const g = S.gesture;
        if (!g || e.pointerId !== g.pointerId) { return; }
        g.lastX = e.clientX;
        g.lastY = e.clientY;
        const t = tileFromEvent(e);
        if (g.mode === "pick") {
            g.t1 = t;
            S.selection = { x0: g.t0.x, y0: g.t0.y, x1: t.x, y1: t.y };
            drawOverlay();
            return;
        }
        if (Math.hypot(e.clientX - g.startX, e.clientY - g.startY) > 10) {
            g.tapOnly = false;
            clearTimeout(g.longTimer);
        }
        strokeMove(g, t);
    }, { capture: true });

    const up = e => {
        const g = S.gesture;
        if (!g || e.pointerId !== g.pointerId) { return; }
        clearTimeout(g.longTimer);
        S.gesture = null;
        if (g.mode === "pick") {
            S.selection = g.prevSel === undefined ? null : g.prevSel;
            if (e.type === "pointerup") {
                eyedrop(g, g.t0, g.t1, g.exact || e.shiftKey);
            }
            refreshView();
            return;
        }
        if (e.type === "pointercancel") {
            if (g.edit.stroke) { g.edit.cancel(); }
            refreshView();
            return;
        }
        strokeEnd(g);
    };
    vp.addEventListener("pointerup", up, { capture: true });
    vp.addEventListener("pointercancel", up, { capture: true });
    vp.addEventListener("pointerleave", () => { S.hover = null; drawOverlay(); });
}

// ---------------- Teclado ----------------

function bindKeys() {
    document.addEventListener("keydown", e => {
        if (dialogOpen() || isEventMode()) { return; }
        const tag = (e.target && e.target.tagName) || "";
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") { return; }
        const ctrl = e.ctrlKey || e.metaKey;
        const k = e.key.toLowerCase();
        if (ctrl && k === "z" && !e.shiftKey) { e.preventDefault(); doUndo(); }
        else if (ctrl && (k === "y" || (k === "z" && e.shiftKey))) { e.preventDefault(); doRedo(); }
        else if (ctrl && k === "c") { if (S.selection) { e.preventDefault(); doCopy(); } }
        else if (ctrl && k === "x") { if (S.selection) { e.preventDefault(); doCut(); } }
        else if (ctrl && k === "v") { if (S.clipboard) { e.preventDefault(); doPaste(); } }
        else if (ctrl && k === "s") { e.preventDefault(); doSave(); }
        else if (k === "delete") { if (S.selection) { e.preventDefault(); doDelete(); } }
        else if (k === "escape") { if (S.selection) { S.selection = null; refreshView(); } }
    });
}

// ---------------- Árvore de mapas: Editar / Novo / Copiar / Colar / Excluir ----------------

async function loadInfos() {
    if (!S.infos) {
        S.infos = await api.project.mapInfos();
    }
    return S.infos;
}

function treeRow(id) {
    return document.querySelector(`#mapTree div[data-id="${id}"]`);
}

function updateMapTreeRow(id) {
    const info = S.infos && S.infos[id];
    const row = treeRow(id);
    if (info && row) {
        row.textContent = info.name || "MAP" + pad3(id);
    }
}

function updateStatusMap(id, map, tileset) {
    const events = (map.events || []).filter(Boolean).length;
    const sm = $("statusMap");
    if (sm) { sm.textContent = `Mapa ${pad3(id)} · ${map.width}×${map.height} · ${tileset ? tileset.name : "?"} · ${events} eventos`; }
}

async function selectMapLocal(id) {
    try {
        const [map, tilesets] = await Promise.all([api.project.map(id), api.project.tilesets()]);
        const tileset = tilesets[map.tilesetId];
        api.currentMapId = id;
        api.view.load(map, tileset);
        api.emit("map:selected", { id, map, tileset });
        const hint = $("emptyHint");
        if (hint) { hint.classList.add("hidden"); }
        for (const row of document.querySelectorAll("#mapTree div")) {
            row.classList.toggle("selected", Number(row.dataset.id) === id);
        }
        updateStatusMap(id, map, tileset);
    } catch (err) {
        console.error(err);
        api.status(String(err.message || err));
    }
}

function addTreeRow(info) {
    const tree = $("mapTree");
    if (!tree) { return; }
    let parentUl;
    if (info.parentId) {
        const prow = treeRow(info.parentId);
        const li = prow && prow.parentElement;
        if (li) {
            parentUl = li.querySelector(":scope > ul");
            if (!parentUl) {
                parentUl = document.createElement("ul");
                li.appendChild(parentUl);
            }
        }
    }
    if (!parentUl) {
        parentUl = tree.querySelector(":scope > ul") || tree;
    }
    const li = document.createElement("li");
    const row = document.createElement("div");
    row.textContent = info.name;
    row.dataset.id = info.id;
    row.addEventListener("click", () => selectMapLocal(info.id));
    li.appendChild(row);
    // posiciona conforme a ordem
    const siblings = [...parentUl.children];
    const after = siblings.find(s => {
        const r = s.querySelector(":scope > div");
        const o = r && S.infos[Number(r.dataset.id)];
        return o && o.order > info.order;
    });
    parentUl.insertBefore(li, after || null);
}

function descendants(infos, id) {
    const out = [];
    const walk = pid => {
        for (const inf of infos) {
            if (inf && inf.parentId === pid) {
                out.push(inf.id);
                walk(inf.id);
            }
        }
    };
    walk(id);
    return out;
}

// Insere um mapa novo como filho de parentId, depois dos descendentes dele, e renumera a ordem.
function insertInfo(infos, parentId, name) {
    let id = 1;
    while (infos[id]) { id++; }
    if (id > 999) { return null; }
    const ordered = infos.filter(Boolean).sort((a, b) => a.order - b.order);
    let pos = ordered.length;
    if (parentId) {
        const sub = new Set([parentId, ...descendants(infos, parentId)]);
        let last = -1;
        ordered.forEach((inf, i) => { if (sub.has(inf.id)) { last = i; } });
        pos = last + 1;
    }
    const info = { id, expanded: false, name: name || "MAP" + pad3(id), order: 0, parentId: parentId || 0, scrollX: 0, scrollY: 0 };
    ordered.splice(pos, 0, info);
    ordered.forEach((inf, i) => { inf.order = i + 1; });
    infos[id] = info;
    return info;
}

async function createMap(parentId, source) {
    const infos = await loadInfos();
    let probe = 1;
    while (infos[probe]) { probe++; }
    if (probe > 999) {
        api.status("Não é possível criar mais mapas.");
        return;
    }
    let map;
    let name = "MAP" + pad3(probe);
    if (source) {
        map = JSON.parse(JSON.stringify(source.map));
        name = source.info.name;
    } else {
        let tilesetId = 1;
        const cur = currentEdit();
        if (cur) { tilesetId = cur.map.tilesetId; }
        map = newMapData(tilesetId);
        const r = await openMapProperties(api, { title: "Propriedades do Mapa", map, info: { name } });
        if (!r) { return; }
        map = r.map;
        resizeMapData(map, r.width, r.height);
        name = r.name;
    }
    const info = insertInfo(infos, parentId, name);
    if (!info) {
        api.status("Não é possível criar mais mapas.");
        return;
    }
    await api.project.writeJson(mapPath(info.id), map);
    await api.project.writeJson("data/MapInfos.json", infos);
    S.infosModified = false;
    addTreeRow(info);
    api.emit("maps:changed", { infos, added: info.id });
    api.emit("map:changed", { id: info.id });
    await selectMapLocal(info.id);
    api.status(`Mapa ${pad3(info.id)} criado`);
}

async function editMapProperties(id) {
    const infos = await loadInfos();
    const info = infos[id];
    if (!info) { return; }
    const map = await api.project.map(id);
    const r = await openMapProperties(api, { map, info });
    if (!r) { return; }
    const tilesets = await api.project.tilesets();
    let edit = S.edits.get(id);
    if (!edit || edit.map !== map) {
        edit = new MapEdit(id, map, tilesets[map.tilesetId]);
        S.edits.set(id, edit);
    }
    const before = edit.snapshot();
    const keepData = map.data;
    Object.assign(map, r.map, { data: keepData, events: map.events, width: map.width, height: map.height });
    if (r.width !== map.width || r.height !== map.height) {
        resizeMapData(map, r.width, r.height);
    }
    edit.recordFull("Propriedades do Mapa", before);
    if (info.name !== r.name) {
        info.name = r.name;
        S.infosModified = true;
        updateMapTreeRow(id);
        api.emit("maps:changed", { infos });
    }
    if (currentEdit() === edit || api.currentMapId === id) {
        S.cur = edit;
        await reloadView(edit);
    }
    api.emit("map:changed", { id });
    updateButtons();
}

async function deleteMap(id) {
    const infos = await loadInfos();
    const info = infos[id];
    if (!info) { return; }
    const ok = await new Promise(resolve => {
        const dlg = api.openDialog({
            title: "RPG Maker MZ",
            width: "420px",
            height: "180px",
            buttons: [{ label: "Sim", primary: true, onClick: () => resolve(true) }, { label: "Não", onClick: () => resolve(false) }]
        });
        dlg.body.textContent = `Deletar ${info.name}?`;
    });
    if (!ok) { return; }
    const ids = [id, ...descendants(infos, id)];
    for (const d of ids) {
        infos[d] = null;
        S.edits.delete(d);
        const row = treeRow(d);
        if (row && row.parentElement) { row.parentElement.remove(); }
    }
    infos.filter(Boolean).sort((a, b) => a.order - b.order).forEach((inf, i) => { inf.order = i + 1; });
    await api.project.writeJson("data/MapInfos.json", infos);
    api.emit("maps:changed", { infos, removed: ids });
    api.status(`Mapa excluído (${ids.length})`);
    if (ids.includes(api.currentMapId)) {
        const first = infos.find(Boolean);
        if (first) { selectMapLocal(first.id); }
    }
}

function showTreeMenu(x, y, id) {
    closeTreeMenu();
    const menu = document.createElement("div");
    menu.id = "mtTreeMenu";
    const items = [
        ["Editar…", () => editMapProperties(id), !id],
        ["Novo…", () => createMap(id), false],
        ["Copiar", async () => {
            const infos = await loadInfos();
            const map = await api.project.map(id);
            S.mapClipboard = { map: JSON.parse(JSON.stringify(map)), info: { ...infos[id] } };
            api.status("Mapa copiado");
        }, !id],
        ["Colar", () => createMap(id, S.mapClipboard), !S.mapClipboard],
        ["Excluir", () => deleteMap(id), !id]
    ];
    for (const [label, fn, disabled] of items) {
        const b = document.createElement("button");
        b.textContent = label;
        b.disabled = !!disabled;
        b.addEventListener("click", () => { closeTreeMenu(); fn(); });
        menu.appendChild(b);
    }
    document.body.appendChild(menu);
    const r = menu.getBoundingClientRect();
    menu.style.left = Math.min(x, window.innerWidth - r.width - 4) + "px";
    menu.style.top = Math.min(y, window.innerHeight - r.height - 4) + "px";
    setTimeout(() => document.addEventListener("pointerdown", closeOnOutside, true), 0);
}

function closeOnOutside(e) {
    const m = $("mtTreeMenu");
    if (m && !m.contains(e.target)) { closeTreeMenu(); }
}

function closeTreeMenu() {
    const m = $("mtTreeMenu");
    if (m) { m.remove(); }
    document.removeEventListener("pointerdown", closeOnOutside, true);
}

function bindTree() {
    const sidebar = $("sidebar");
    if (!sidebar) { return; }
    const idOf = target => {
        const row = target.closest && target.closest("#mapTree div[data-id]");
        return row ? Number(row.dataset.id) : 0;
    };
    sidebar.addEventListener("contextmenu", e => {
        e.preventDefault();
        showTreeMenu(e.clientX, e.clientY, idOf(e.target));
    });
    // toque longo na árvore = menu de contexto
    let timer = 0, start = null;
    sidebar.addEventListener("pointerdown", e => {
        if (e.pointerType === "mouse") { return; }
        start = { x: e.clientX, y: e.clientY, target: e.target };
        clearTimeout(timer);
        timer = setTimeout(() => {
            if (start) {
                if (navigator.vibrate) { navigator.vibrate(20); }
                showTreeMenu(start.x, start.y, idOf(start.target));
                start = null;
            }
        }, 550);
    });
    sidebar.addEventListener("pointermove", e => {
        if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 10) {
            clearTimeout(timer);
            start = null;
        }
    });
    const cancel = () => { clearTimeout(timer); start = null; };
    sidebar.addEventListener("pointerup", cancel);
    sidebar.addEventListener("pointercancel", cancel);
}

// ---------------- Registro ----------------

export async function register(theApi) {
    api = theApi;
    injectCss();
    buildPanel();

    for (const [id, tool] of Object.entries(TOOLS)) {
        const title = { pencil: "Lápis", rect: "Retângulo", ellipse: "Elipse", fill: "Preenchimento", shadow: "Sombra" }[tool];
        api.bindToolbar(id, () => setTool(S.tool === tool ? null : tool), title);
    }
    api.bindToolbar("btnUndo", doUndo, "Desfazer");
    api.bindToolbar("btnCut", doCut, "Recortar");
    api.bindToolbar("btnCopy", doCopy, "Copiar");
    api.bindToolbar("btnPaste", doPaste, "Colar");
    api.bindToolbar("btnDelete", () => doDelete(), "Excluir");
    api.bindToolbar("btnSave", doSave, "Salvar Projeto");

    // indicador de modificado na barra de status
    const status = $("status");
    const msg = $("statusMsg");
    if (status && !$("mtModifiedFlag")) {
        const flag = document.createElement("span");
        flag.id = "mtModifiedFlag";
        status.insertBefore(flag, msg || null);
    }

    bindViewport();
    bindKeys();
    bindTree();

    api.on("map:selected", onMapSelected);
    // troca de modo mapa/evento (classe "on" de btnModeEvent, controlada pelo módulo events)
    const modeBtn = $("btnModeEvent");
    if (modeBtn && window.MutationObserver) {
        new MutationObserver(() => {
            if (isEventMode()) { S.selection = null; S.hover = null; drawOverlay(); }
            updateButtons();
        }).observe(modeBtn, { attributes: true, attributeFilter: ["class"] });
    }
    // banco de dados alterou tilesets: recarrega a paleta/visualização do mapa atual
    api.on("db:changed", async ({ file } = {}) => {
        if (file && /Tilesets\.json$/.test(file) && S.cur) {
            await reloadView(S.cur);
        }
    });
    window.addEventListener("beforeunload", e => {
        if (anyModified()) {
            e.preventDefault();
            e.returnValue = "";
        }
    });
    // ponto de inspeção para depuração/testes
    window.mzMapTools = { state: S, setTool, save: doSave, undo: doUndo, redo: doRedo };
    loadInfos().catch(() => {});
    setTool(null);
    updateButtons();
}
