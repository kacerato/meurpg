// Módulo maptools: paleta de tiles, ferramentas de desenho com autotile, seleção,
// recortar/copiar/colar/excluir, desfazer/refazer por mapa, propriedades do mapa,
// novo mapa e gravação. Fiel ao RPG Maker MZ 1.1.1 (ver NOTES.md).

import * as T from "./autotile.js";
import { MapEdit, LAYER_AUTO } from "./editops.js";
import { Palette } from "./palette.js";
import { regionColor } from "./render.js";
import { initMapTree } from "./maptree.js";
import { t } from "../i18n.js";

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
    return api.mode === "event";
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
    S.ui.select = mk("toggle", t("Select area (for Cut/Copy/Delete)"), '<span class="mtMarquee"></span>', () => setTool(S.tool === "select" ? null : "select"));
    S.ui.undo = mk("", t("Undo", "BasicConstants") + " (Ctrl+Z)", '<img src="img/toolbar/edit-undo.png" alt="">', () => doUndo());
    S.ui.redo = mk("", t("Redo", "BasicConstants") + " (Ctrl+Y)", '<img src="img/toolbar/edit-redo.png" alt="">', () => doRedo());
    S.ui.auto = mk("toggle", t("No autotile (same as holding Shift)"), '<span class="mtNoAuto">A</span>', () => {
        S.autotileOff = !S.autotileOff;
        S.ui.auto.classList.toggle("on", S.autotileOff);
    });
    const layer = document.createElement("select");
    layer.className = "mtLayer";
    layer.title = t("Layer", "MainMenu");
    [["-1", t("Automatic", "MainMenu")], ...[0, 1, 2, 3].map(z => [String(z), t("Layer %1", "MainMenu", z + 1)])].forEach(([v, text]) => {
        const o = document.createElement("option");
        o.value = v;
        o.textContent = text;
        layer.appendChild(o);
    });
    layer.addEventListener("change", () => { S.layer = Number(layer.value); rebuildLayerView(); drawOverlay(); });
    strip.appendChild(layer);
    S.ui.layer = layer;
    mk("", t("Smaller tiles"), "−", () => S.palette.setCellSize(Math.max(16, S.palette.cell - 8)));
    mk("", t("Larger tiles"), "+", () => S.palette.setCellSize(Math.min(48, S.palette.cell + 8)));

    const pal = document.createElement("div");
    panel.append(strip, pal);
    const main = $("main");
    const sidebar = $("sidebar");
    main.insertBefore(panel, sidebar ? sidebar.nextSibling : main.firstChild);
    S.palette = new Palette(pal, {
        onSelect: brush => {
            S.brush = brush;
            rebuildLayerView();
            drawOverlay();
        }
    });
    S.palette.setCellSize(window.innerWidth < 1000 ? 24 : 32);

    // botão para mostrar/ocultar a paleta (gaveta no toque)
    const toggle = document.createElement("button");
    toggle.id = "mtBtnPalette";
    toggle.className = "tb toggle on";
    toggle.title = t("Show/hide tile palette");
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
    for (const [id, name] of Object.entries(TOOLS)) {
        const b = $(id);
        if (b) { b.classList.toggle("on", name === tool); }
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
    rebuildLayerView();
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
    api.emit("map:changed", { id: edit.id }); // app.js atualiza a barra de status
    api.emit("map:selected", { id: edit.id, map: edit.map, tileset });
}

function anyModified() {
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
        ind.textContent = mod ? "● " + t("Modified") : "";
    }
}

// ---------------- Desfazer / refazer ----------------

function afterHistory(rec, edit) {
    if (!rec) {
        return;
    }
    if (rec.full) {
        reloadView(edit);
    } else {
        refreshView();
    }
    api.status((rec === edit.redoStack[edit.redoStack.length - 1] ? t("Undo", "BasicConstants") : t("Redo", "BasicConstants")) + ": " + (rec.label || ""));
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
    api.status(t("Copied %1×%2", null, S.clipboard.w, S.clipboard.h));
    updateButtons();
    return true;
}

function doDelete(label = t("Delete", "BasicConstants")) {
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
        doDelete(t("Cut", "BasicConstants"));
    }
}

function doPaste() {
    if (!S.clipboard || isEventMode()) { return; }
    S.brush = S.clipboard;
    S.palette.clearSelectionMark();
    if (S.tool !== "pencil") {
        setTool("pencil");
    }
    api.status(t("Paste: tap the map to place it"));
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
        api.status(n > 1 ? t("Project saved (%1 maps)", null, n) : n ? t("Project saved (%1 map)", null, n) : t("Project saved"));
    } catch (err) {
        console.error(err);
        api.status(t("Failed to save: %1", null, err.message || err));
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
    if (!S.layerView) {
        S.layerView = new PIXI.Container();   // destaque de camada: Tilemap só com a camada escolhida
        S.layerDim = new PIXI.Graphics();     // véu escuro sobre as outras camadas
        S.layerDimC = new PIXI.Container();
        S.layerDimC.addChild(S.layerDim);
    }
    v.world.addChild(S.layerDimC, S.layerView);
    S.layerTmKey = "";
    v.world.addChild(S.layerC); // por cima do tilemap e da moldura de eventos
    S.regionKey = "";
    rebuildLayerView();
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
    syncLayerView();
}

// ---------------- Destaque da camada escolhida (menu Camada do MZ) ----------------

function layerHighlightOn() {
    return S.layer !== LAYER_AUTO && !S.palette.isRegion && !!currentEdit() && !isEventMode();
}

// Recria/atualiza o Tilemap que mostra só a camada escolhida.
function rebuildLayerView() {
    const v = api.view;
    const e = currentEdit();
    if (!S.layerView || !v || !v.tilemap) { return; }
    if (!layerHighlightOn()) {
        S.layerView.visible = false;
        S.layerDimC.visible = false;
        return;
    }
    const key = `${e.id}:${e.w}x${e.h}:${e.map.tilesetId}`;
    if (!S.layerTm || S.layerTmKey !== key) {
        if (S.layerTm) {
            S.layerView.removeChild(S.layerTm);
            S.layerTm.destroy();
        }
        const tm = new Tilemap();
        tm.tileWidth = TILE;
        tm.tileHeight = TILE;
        S.layerData = new Array(e.w * e.h * 6).fill(0);
        tm.setData(e.w, e.h, S.layerData);
        tm.setBitmaps(e.tileset.tilesetNames.map(n => ImageManager.loadTileset(n)));
        tm.flags = e.tileset.flags;
        tm.horizontalWrap = v.tilemap.horizontalWrap;
        tm.verticalWrap = v.tilemap.verticalWrap;
        S.layerView.addChild(tm);
        S.layerTm = tm;
        S.layerTmKey = key;
    }
    const n = e.w * e.h;
    const z = S.layer;
    const src = e.map.data;
    S.layerData.fill(0);
    for (let i = 0; i < n; i++) {
        S.layerData[z * n + i] = src[z * n + i] || 0;
    }
    S.layerDim.clear().beginFill(0x000000, 0.55).drawRect(0, 0, e.w * TILE, e.h * TILE).endFill();
    S.layerView.visible = true;
    S.layerDimC.visible = true;
    S.layerSync = "";
    S.layerTm.refresh();
}

function syncLayerView() {
    const v = api.view;
    if (!S.layerTm || !S.layerView || !S.layerView.visible || !v.tilemap) { return; }
    S.layerDimC.position.copyFrom(v.overlay.position);
    const src = v.tilemap, tm = S.layerTm;
    const k = `${src.origin.x},${src.origin.y},${src.width},${src.height}`;
    if (k !== S.layerSync) {
        S.layerSync = k;
        tm.width = src.width;
        tm.height = src.height;
        tm.origin.x = src.origin.x;
        tm.origin.y = src.origin.y;
        tm.refresh();
    }
    tm.update();
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

function strokeStart(g, tile, shift) {
    const e = g.edit;
    const region = S.palette.isRegion;
    g.auto = !(shift || S.autotileOff) && !region;
    g.last = tile;
    g.anchor = tile;
    const brush = S.brush;
    switch (g.tool) {
        case "pencil":
            e.begin(t("Pencil", "MainMenu"));
            e.stamp(brush, tile.x, tile.y, tile.x, tile.y, S.layer, region);
            break;
        case "rect":
        case "ellipse":
            e.begin(g.tool === "rect" ? t("Rectangle", "MainMenu") : t("Ellipse", "MainMenu"));
            e.fillRect(brush, tile.x, tile.y, tile.x, tile.y, S.layer, region, g.tool === "ellipse");
            break;
        case "fill":
            e.begin(t("Flood Fill", "MainMenu"));
            e.floodFill(brush, tile.x, tile.y, S.layer, region);
            break;
        case "shadow": {
            e.begin(t("Shadow Pen", "MainMenu"));
            const bit = 1 << (tile.qy * 2 + tile.qx);
            g.shadowOn = !(e.get(tile.x, tile.y, 4) & bit);
            e.shadowQuarter(tile.x, tile.y, bit, g.shadowOn);
            g.lastQ = `${tile.x},${tile.y},${bit}`;
            break;
        }
        case "select":
            S.selection = { x0: tile.x, y0: tile.y, x1: tile.x, y1: tile.y };
            break;
    }
    if (g.tool !== "select" && g.tool !== "shadow") {
        e.fixup(g.auto);
    }
    refreshView();
}

function strokeMove(g, tile) {
    const e = g.edit;
    const region = S.palette.isRegion;
    const brush = S.brush;
    switch (g.tool) {
        case "pencil": {
            if (tile.x === g.last.x && tile.y === g.last.y) { return; }
            for (const [x, y] of linePoints(g.last.x, g.last.y, tile.x, tile.y).slice(1)) {
                e.stamp(brush, g.anchor.x, g.anchor.y, x, y, S.layer, region);
            }
            e.fixup(g.auto);
            break;
        }
        case "rect":
        case "ellipse":
            if (tile.x === g.last.x && tile.y === g.last.y) { return; }
            e.rollback();
            e.fillRect(brush, g.anchor.x, g.anchor.y, tile.x, tile.y, S.layer, region, g.tool === "ellipse");
            e.fixup(g.auto);
            break;
        case "shadow": {
            const bit = 1 << (tile.qy * 2 + tile.qx);
            const k = `${tile.x},${tile.y},${bit}`;
            if (k === g.lastQ) { return; }
            g.lastQ = k;
            e.shadowQuarter(tile.x, tile.y, bit, g.shadowOn);
            break;
        }
        case "select":
            S.selection.x1 = Math.max(0, Math.min(e.w - 1, tile.x));
            S.selection.y1 = Math.max(0, Math.min(e.h - 1, tile.y));
            break;
        default:
            return;
    }
    g.last = tile;
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
        api.status(t("Brush %1×%2 copied from the map", null, b.w, b.h));
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
        const tile = tileFromEvent(e);
        const isMouse = e.pointerType === "mouse";
        if (isMouse && e.button === 2) {
            // conta-gotas / cópia de área com o botão direito
            e.stopPropagation();
            e.preventDefault();
            vp.setPointerCapture(e.pointerId);
            S.gesture = { pointerId: e.pointerId, edit, mode: "pick", t0: tile, t1: tile, exact: e.shiftKey, lastX: e.clientX, lastY: e.clientY };
            return;
        }
        if (isMouse && e.button !== 0) { return; }
        if (!S.tool) { return; } // sem ferramenta: o visualizador rola/arrasta
        if (!edit.grid.inside(tile.x, tile.y) && S.tool !== "select") { return; }
        e.stopPropagation();
        e.preventDefault();
        if (isMouse) { vp.setPointerCapture(e.pointerId); }
        const gg = {
            pointerId: e.pointerId, edit, tool: S.tool, mode: "draw", tapOnly: true,
            startX: e.clientX, startY: e.clientY, lastX: e.clientX, lastY: e.clientY, t0: tile,
            prevSel: S.selection
        };
        S.gesture = gg;
        strokeStart(gg, tile, e.shiftKey);
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
                api.status(t("Eyedropper: release to pick the tile, drag to copy an area"));
            }, LONG_MS);
        }
    }, { capture: true });

    vp.addEventListener("pointermove", e => {
        const edit = currentEdit();
        if (edit && S.tool && !isEventMode()) {
            const tile = tileFromEvent(e);
            const h = S.hover;
            if (!h || h.x !== tile.x || h.y !== tile.y || h.qx !== tile.qx || h.qy !== tile.qy) {
                S.hover = tile;
                drawOverlay();
            }
        }
        const g = S.gesture;
        if (!g || e.pointerId !== g.pointerId) { return; }
        g.lastX = e.clientX;
        g.lastY = e.clientY;
        const tile = tileFromEvent(e);
        if (g.mode === "pick") {
            g.t1 = tile;
            S.selection = { x0: g.t0.x, y0: g.t0.y, x1: tile.x, y1: tile.y };
            drawOverlay();
            return;
        }
        if (Math.hypot(e.clientX - g.startX, e.clientY - g.startY) > 10) {
            g.tapOnly = false;
            clearTimeout(g.longTimer);
        }
        strokeMove(g, tile);
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

// ---------------- Lista de mapas (maptree.js) ----------------

// MapEdit do mapa id (cria se preciso), usando o mesmo objeto de mapa do cache do projeto.
async function editFor(id, map) {
    map = map || await api.project.map(id);
    let edit = S.edits.get(id);
    if (!edit || edit.map !== map) {
        const tilesets = await api.project.tilesets();
        edit = new MapEdit(id, map, tilesets[map.tilesetId]);
        S.edits.set(id, edit);
    }
    return edit;
}

// Depois de Deslocar / Gerar Masmorra: recarrega se o registro trocou o mapa inteiro.
function afterBulkEdit(edit) {
    const rec = edit.undoStack[edit.undoStack.length - 1];
    if (rec && rec.full && api.currentMapId === edit.id) {
        reloadView(edit);
    } else {
        refreshView();
    }
    api.emit("map:changed", { id: edit.id });
    updateButtons();
}

// ---------------- Registro ----------------

export async function register(theApi) {
    api = theApi;
    injectCss();
    buildPanel();

    for (const [id, tool] of Object.entries(TOOLS)) {
        const title = { pencil: t("Pencil", "MainMenu"), rect: t("Rectangle", "MainMenu"), ellipse: t("Ellipse", "MainMenu"), fill: t("Flood Fill", "MainMenu"), shadow: t("Shadow Pen", "MainMenu") }[tool];
        api.bindToolbar(id, () => setTool(S.tool === tool ? null : tool), title);
    }
    api.bindToolbar("btnUndo", doUndo, t("Undo", "BasicConstants"));
    api.bindToolbar("btnCut", doCut, t("Cut", "BasicConstants"));
    api.bindToolbar("btnCopy", doCopy, t("Copy", "BasicConstants"));
    api.bindToolbar("btnPaste", doPaste, t("Paste", "BasicConstants"));
    api.bindToolbar("btnDelete", () => doDelete(), t("Delete", "BasicConstants"));
    api.bindToolbar("btnSave", doSave, t("Save Project", "MainMenu"));

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
    initMapTree({ api, S, reloadView, updateButtons, editFor, afterBulkEdit });

    api.on("map:selected", onMapSelected);
    // troca de modo mapa/evento (api.mode, controlado pelo módulo events)
    api.on("mode:changed", () => {
        if (isEventMode()) {
            S.selection = null;
            S.hover = null;
            if (S.gesture && S.gesture.edit && S.gesture.edit.stroke) { S.gesture.edit.cancel(); }
            S.gesture = null;
        }
        rebuildLayerView();
        drawOverlay();
        updateButtons();
    });
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
    setTool(null);
    updateButtons();
}
