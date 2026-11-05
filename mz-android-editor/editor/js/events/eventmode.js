// Modo evento sobre o mapa: sobreposição PIXI com os gráficos dos eventos (1ª página), cursor,
// posições iniciais (moldura azul), seleção por toque, arrastar para mover, menu de contexto
// (toque longo), duplo toque abre o editor, copiar/colar/apagar, Quick Event, Set Starting Position.

import { db, clone, TEMPLATE, mapPath } from "./data.js";
import { h, actionMenu, alertBox, isBigCharacter } from "./ui.js";
import { openEventEditor } from "./eventeditor.js";
import { quickEvent } from "./quick.js";

const T = 48;

// Espera o Bitmap do corescript carregar (sem depender da fila de listeners).
function whenReady(bmp, fn, tries = 0) {
    if (bmp.isReady()) { fn(); return; }
    if (bmp.isError && bmp.isError()) { return; }
    if (tries < 400) { setTimeout(() => whenReady(bmp, fn, tries + 1), 30); }
}

export class EventMode {
    constructor(api) {
        this.api = api;
        this.active = false;
        this.map = null;
        this.mapId = 0;
        this.tileset = null;
        this.cursor = { x: 0, y: 0 };
        this.clip = null;
        this.container = new PIXI.Container();
        this.spriteLayer = new PIXI.Container();
        this.gfx = new PIXI.Graphics();
        this.container.addChild(this.spriteLayer, this.gfx);
        this.container.visible = false;
        this.drag = null;
        this._buildUi();
        this._bindInput();
        api.view.app.ticker.add(this._tick, this);
        api.on("map:selected", ({ id, map, tileset }) => this.setMap(id, map, tileset));
        api.on("map:changed", ({ id }) => { if (id === this.mapId && this.map) { this.refresh(); } });
        api.on("db:changed", ({ file }) => { if (/System|Actors/.test(file || "")) { this.refresh(); } });
    }

    // ---------- estado ----------
    setMap(id, map, tileset) {
        this.mapId = id; this.map = map; this.tileset = tileset;
        this.cursor = { x: 0, y: 0 };
        this.api.view.world.addChild(this.container);
        this.refresh();
    }
    setActive(on) {
        this.active = on;
        this.container.visible = on;
        this.bar.classList.toggle("hidden", !on);
        if (!on) { this.listPanel.classList.add("hidden"); }
        this.refresh();
    }
    eventAt(x, y) {
        const evs = (this.map && this.map.events) || [];
        for (let i = evs.length - 1; i >= 0; i--) { const e = evs[i]; if (e && e.x === x && e.y === y) { return e; } }
        return null;
    }
    get selectedEvent() { return this.map ? this.eventAt(this.cursor.x, this.cursor.y) : null; }

    async save() {
        const evs = this.map.events;
        while (evs.length > 1 && !evs[evs.length - 1]) { evs.pop(); }
        await this.api.project.writeJson(mapPath(this.mapId), this.map);
        this.api.emit("map:changed", { id: this.mapId });
        if (this.api.view && this.api.view._drawOverlay) { this.api.view._drawOverlay(); }
        this.refresh();
    }
    newId() {
        const evs = this.map.events;
        if (!evs.length) { evs.push(null); }
        for (let i = 1; i < evs.length; i++) { if (!evs[i]) { return i; } }
        return evs.length;
    }
    placeEvent(ev, x, y) {
        const id = this.newId();
        ev.id = id; ev.x = x; ev.y = y;
        if (!ev.name || /^EV\d{3}$/.test(ev.name)) { ev.name = "EV" + String(id).padStart(3, "0"); }
        this.map.events[id] = ev;
        return ev;
    }

    // ---------- ações ----------
    async editAt(x, y) {
        if (!this.map) { return; }
        this.cursor = { x, y };
        const existing = this.eventAt(x, y);
        const ev = existing || TEMPLATE.event(this.newId(), x, y);
        const r = await openEventEditor({ map: this.map, mapId: this.mapId, event: ev, tileset: this.tileset });
        if (!r) { this.refresh(); return; }
        if (existing) { this.map.events[existing.id] = r; } else { this.placeEvent(r, x, y); }
        await this.save();
    }
    async openEvent(id, page, row) {
        const ev = this.map && this.map.events[id];
        if (!ev) { return; }
        this.cursor = { x: ev.x, y: ev.y };
        this.centerOn(ev.x, ev.y);
        this.refresh();
        const r = await openEventEditor({ map: this.map, mapId: this.mapId, event: ev, tileset: this.tileset, page, row });
        if (r) { this.map.events[id] = r; await this.save(); }
    }
    copy() { const e = this.selectedEvent; if (e) { this.clip = clone(e); try { localStorage.setItem("mzEventsEventClip", JSON.stringify(this.clip)); } catch (err) { /* ignora */ } } }
    async cut() { if (this.selectedEvent) { this.copy(); await this.del(); } }
    async paste() {
        let clip = this.clip;
        if (!clip) { try { clip = JSON.parse(localStorage.getItem("mzEventsEventClip") || "null"); } catch (e) { clip = null; } }
        if (!clip || !this.map) { return; }
        if (this.selectedEvent) { this.api.status("Já existe um evento neste tile."); return; }
        this.placeEvent(clone(clip), this.cursor.x, this.cursor.y);
        await this.save();
    }
    async del() {
        const e = this.selectedEvent;
        if (!e) { return; }
        this.map.events[e.id] = null;
        await this.save();
    }
    async quick(kind) {
        if (!this.map) { return; }
        if (this.selectedEvent) { this.api.status("Já existe um evento neste tile."); return; }
        const ev = await quickEvent(kind, { mapId: this.mapId, x: this.cursor.x, y: this.cursor.y, tileset: this.tileset });
        if (!ev) { return; }
        this.placeEvent(ev, this.cursor.x, this.cursor.y);
        await this.save();
    }
    async setStart(kind) {
        const sys = db.system;
        const { x, y } = this.cursor;
        if (kind === "player") { sys.startMapId = this.mapId; sys.startX = x; sys.startY = y; }
        else { Object.assign(sys[kind], { startMapId: this.mapId, startX: x, startY: y }); }
        await this.api.project.writeJson("data/System.json", sys);
        this.api.emit("db:changed", { file: "data/System.json" });
        this.refresh();
    }
    async moveEvent(ev, x, y) {
        if (x === ev.x && y === ev.y) { return; }
        if (x < 0 || y < 0 || x >= this.map.width || y >= this.map.height || this.eventAt(x, y)) { return; }
        ev.x = x; ev.y = y;
        this.cursor = { x, y };
        await this.save();
    }
    contextMenu(cx, cy) {
        const has = !!this.selectedEvent;
        const startItems = [["Player", "player"], ["Boat", "boat"], ["Ship", "ship"], ["Airship", "airship"]].map(([l, k]) => ({ label: l, action: () => this.setStart(k) }));
        return actionMenu([
            { label: has ? "Edit…" : "New…", action: () => this.editAt(this.cursor.x, this.cursor.y) },
            "-",
            { label: "Cut", disabled: !has, action: () => this.cut() },
            { label: "Copy", disabled: !has, action: () => this.copy() },
            { label: "Paste", disabled: has, action: () => this.paste() },
            { label: "Delete", disabled: !has, action: () => this.del() },
            "-",
            { label: "Quick Event Creation", disabled: has, items: [
                { label: "Transfer…", action: () => this.quick("transfer") }, { label: "Door…", action: () => this.quick("door") },
                { label: "Treasure…", action: () => this.quick("treasure") }, { label: "Inn…", action: () => this.quick("inn") }] },
            { label: "Set Starting Position", items: startItems }
        ], { x: cx, y: cy, title: `(${this.cursor.x},${this.cursor.y})` + (has ? " " + this.selectedEvent.name : "") });
    }
    centerOn(x, y) {
        const v = this.api.view;
        v.scrollX = (x + 0.5) * T * v.zoom - v.app.renderer.width / 2;
        v.scrollY = (y + 0.5) * T * v.zoom - v.app.renderer.height / 2;
        v._applyView();
    }

    // ---------- desenho ----------
    refresh() {
        for (const c of this.spriteLayer.removeChildren()) { c.destroy(); }
        this.gfx.clear();
        if (!this.map) { this._updateBar(); return; }
        if (this.active) {
            for (const ev of this.map.events || []) {
                if (ev && ev.pages && ev.pages[0]) { this._addImage(ev.pages[0].image, ev.x, ev.y, ev === (this.drag && this.drag.ev) ? 0.4 : 1); }
            }
            this._drawStarts();
        }
        this._drawFrames();
        this._updateBar();
        this._renderList();
    }
    _addImage(image, x, y, alpha = 1) {
        if (!image) { return; }
        const sprite = new PIXI.Sprite();
        sprite.alpha = alpha;
        this.spriteLayer.addChild(sprite);
        const place = (tex, w, hh) => {
            if (sprite.destroyed) { return; }
            sprite.texture = tex;
            const s = Math.min(1, T / w, T / hh);
            sprite.scale.set(s, s);
            sprite.anchor.set(0.5, 1);
            sprite.position.set(x * T + T / 2, y * T + T - (hh * s < T ? (T - hh * s) / 2 : 0));
        };
        if (image.tileId > 0 && this.tileset) {
            const set = Math.floor(image.tileId / 256), n = image.tileId % 256;
            const name = this.tileset.tilesetNames[5 + set];
            if (!name) { return; }
            const bmp = ImageManager.loadTileset(name);
            whenReady(bmp, () => {
                const sx = ((Math.floor(n / 128) % 2) * 8 + (n % 8)) * T, sy = (Math.floor(n / 8) % 16) * T;
                place(new PIXI.Texture(bmp.baseTexture, new PIXI.Rectangle(sx, sy, T, T)), T, T);
            });
        } else if (image.characterName) {
            const bmp = ImageManager.loadCharacter(image.characterName);
            whenReady(bmp, () => {
                if (!bmp.width) { return; }
                const big = isBigCharacter(image.characterName);
                const pw = bmp.width / (big ? 3 : 12), ph = bmp.height / (big ? 4 : 8);
                const bx = big ? 0 : (image.characterIndex % 4) * 3, by = big ? 0 : Math.floor(image.characterIndex / 4) * 4;
                const fx = (bx + (image.pattern || 0)) * pw, fy = (by + Math.max(0, ((image.direction || 2) - 2) / 2)) * ph;
                place(new PIXI.Texture(bmp.baseTexture, new PIXI.Rectangle(fx, fy, pw, ph)), pw, ph);
            });
        }
    }
    _starts() {
        const sys = db.system || {};
        const out = [];
        if (sys.startMapId === this.mapId) {
            const leader = db.actors[(sys.partyMembers || [])[0]];
            out.push({ kind: "player", x: sys.startX, y: sys.startY, image: leader ? { characterName: leader.characterName, characterIndex: leader.characterIndex, direction: 2, pattern: 1, tileId: 0 } : null });
        }
        for (const k of ["boat", "ship", "airship"]) {
            const v = sys[k];
            if (v && v.startMapId === this.mapId) { out.push({ kind: k, x: v.startX, y: v.startY, image: { characterName: v.characterName, characterIndex: v.characterIndex, direction: 2, pattern: 1, tileId: 0 } }); }
        }
        return out;
    }
    _drawStarts() {
        for (const s of this._starts()) { this._addImage(s.image, s.x, s.y); }
    }
    _drawFrames() {
        const g = this.gfx;
        if (!this.active || !this.map) { return; }
        g.lineStyle(2, 0xffffff, 0.95);
        for (const ev of this.map.events || []) { if (ev) { g.drawRect(ev.x * T + 2, ev.y * T + 2, T - 4, T - 4); } }
        g.lineStyle(3, 0x2a6cff, 1);
        for (const s of this._starts()) { g.drawRect(s.x * T + 3, s.y * T + 3, T - 6, T - 6); }
        // cursor do MZ: moldura dupla preta/branca
        const { x, y } = this.drag && this.drag.target ? this.drag.target : this.cursor;
        g.lineStyle(4, 0x000000, 1).drawRect(x * T + 1, y * T + 1, T - 2, T - 2);
        g.lineStyle(2, 0xffffff, 1).drawRect(x * T + 1, y * T + 1, T - 2, T - 2);
    }
    _tick() {
        const v = this.api.view;
        if (!v) { return; }
        this.container.position.set(-v.scrollX / v.zoom, -v.scrollY / v.zoom);
        const w = v.world;
        if (w.children[w.children.length - 1] !== this.container) { w.addChild(this.container); }
    }

    // ---------- interface (barra flutuante e lista de eventos) ----------
    _buildUi() {
        const vp = document.getElementById("viewport");
        const b = (label, fn, title) => h("button", { type: "button", class: "evBtn", title, onclick: e => { e.stopPropagation(); fn(e); } }, label);
        this.info = h("span", { class: "evBarInfo" });
        this.btnEdit = b("New…", () => this.editAt(this.cursor.x, this.cursor.y), "Editar/Novo (duplo toque)");
        this.bar = h("div", { class: "evModeBar hidden" },
            this.info, this.btnEdit,
            b("Cut", () => this.cut()), b("Copy", () => this.copy()), b("Paste", () => this.paste()), b("Delete", () => this.del()),
            b("Quick ▸", e => { const r = e.currentTarget.getBoundingClientRect(); actionMenu([
                { label: "Transfer…", action: () => this.quick("transfer") }, { label: "Door…", action: () => this.quick("door") },
                { label: "Treasure…", action: () => this.quick("treasure") }, { label: "Inn…", action: () => this.quick("inn") }], { x: r.left, y: r.top - 200, title: "Quick Event Creation" }); }),
            b("Start ▸", e => { const r = e.currentTarget.getBoundingClientRect(); actionMenu([["Player", "player"], ["Boat", "boat"], ["Ship", "ship"], ["Airship", "airship"]].map(([l, k]) => ({ label: l, action: () => this.setStart(k) })), { x: r.left, y: r.top - 200, title: "Set Starting Position" }); }),
            b("☰ List", () => { this.listPanel.classList.toggle("hidden"); this._renderList(); }, "Event List"));
        this.listPanel = h("div", { class: "evListPanel hidden" });
        for (const el of [this.bar, this.listPanel]) {
            el.addEventListener("pointerdown", e => e.stopPropagation());
            el.addEventListener("wheel", e => e.stopPropagation());
        }
        vp.append(this.bar, this.listPanel);
    }
    _updateBar() {
        const e = this.map ? this.selectedEvent : null;
        this.info.textContent = `(${this.cursor.x},${this.cursor.y})` + (e ? ` ${String(e.id).padStart(3, "0")}:${e.name}` : "");
        this.btnEdit.textContent = e ? "Edit…" : "New…";
    }
    _renderList() {
        if (!this.listPanel || this.listPanel.classList.contains("hidden")) { return; }
        this.listPanel.innerHTML = "";
        this.listPanel.append(h("div", { class: "evListPanelTitle" }, "Event List"));
        const sel = this.selectedEvent;
        let last = { id: -1, t: 0 };
        for (const ev of (this.map && this.map.events) || []) {
            if (!ev) { continue; }
            const it = h("div", { class: "evListItem" + (sel === ev ? " selected" : "") }, `${String(ev.id).padStart(3, "0")}:${ev.name} (${ev.x},${ev.y})`);
            it.addEventListener("click", () => {
                const now = Date.now();
                if (last.id === ev.id && now - last.t < 400) { this.openEvent(ev.id); return; }
                last = { id: ev.id, t: now };
                this.cursor = { x: ev.x, y: ev.y };
                this.centerOn(ev.x, ev.y);
                this.refresh();
            });
            this.listPanel.append(it);
        }
    }

    // ---------- entrada ----------
    _tileFromClient(cx, cy) {
        const v = this.api.view;
        const r = v.viewport.getBoundingClientRect();
        const x = Math.floor((cx - r.left - v.world.position.x + v.scrollX) / (T * v.zoom));
        const y = Math.floor((cy - r.top - v.world.position.y + v.scrollY) / (T * v.zoom));
        return { x, y, inside: this.map && x >= 0 && y >= 0 && x < this.map.width && y < this.map.height };
    }
    _bindInput() {
        const vp = this.api.view.viewport;
        const pointers = new Set();
        let g = null; // gesto atual
        let lastTap = { x: -1, y: -1, t: 0 };
        let menuOpen = false;
        const openMenu = async (cx, cy) => {
            if (menuOpen) { return; }
            menuOpen = true;
            try { await this.contextMenu(cx, cy); } finally { menuOpen = false; }
        };
        vp.addEventListener("pointerdown", e => {
            if (!this.active || !this.map || e.target.closest(".evModeBar,.evListPanel")) { return; }
            pointers.add(e.pointerId);
            if (pointers.size > 1) { // pinça: deixa o MapView cuidar
                if (g) { clearTimeout(g.timer); if (g.drag) { this.drag = null; this.refresh(); } }
                g = null;
                return;
            }
            if (e.button === 2) { return; }
            const t = this._tileFromClient(e.clientX, e.clientY);
            if (!t.inside) { return; }
            const ev = this.eventAt(t.x, t.y);
            g = { id: e.pointerId, sx: e.clientX, sy: e.clientY, tile: t, ev, moved: false, drag: false, long: false };
            if (ev) {
                e.stopPropagation(); // não rola o mapa: o toque pode arrastar o evento
                vp.setPointerCapture(e.pointerId);
            }
            // toque longo: o menu abre ao soltar (se não arrastou), para permitir segurar e arrastar
            g.timer = setTimeout(() => {
                if (g && !g.moved) {
                    g.long = true;
                    this.cursor = { x: t.x, y: t.y };
                    this.refresh();
                    if (navigator.vibrate) { try { navigator.vibrate(15); } catch (err) { /* ignora */ } }
                }
            }, 500);
        }, true);
        vp.addEventListener("pointermove", e => {
            if (!g || e.pointerId !== g.id) { return; }
            const d = Math.hypot(e.clientX - g.sx, e.clientY - g.sy);
            if (d > 8) { g.moved = true; clearTimeout(g.timer); g.long = false; }
            if (g.ev && g.moved) {
                e.stopPropagation();
                const t = this._tileFromClient(e.clientX, e.clientY);
                g.drag = true;
                this.drag = { ev: g.ev, target: { x: Math.max(0, Math.min(this.map.width - 1, t.x)), y: Math.max(0, Math.min(this.map.height - 1, t.y)) } };
                this.gfx.clear();
                this._drawFrames();
                this._dragPreview();
            }
        }, true);
        const up = e => {
            pointers.delete(e.pointerId);
            if (!g || e.pointerId !== g.id) { return; }
            const cur = g;
            g = null;
            clearTimeout(cur.timer);
            if (cur.ev) { e.stopPropagation(); }
            if (cur.long && !cur.moved) { openMenu(e.clientX, e.clientY); return; }
            if (cur.drag) {
                const target = this.drag && this.drag.target;
                this.drag = null;
                if (this.dragSprite) { this.dragSprite.destroy(); this.dragSprite = null; }
                if (target) { this.moveEvent(cur.ev, target.x, target.y).then(() => this.refresh()); } else { this.refresh(); }
                return;
            }
            if (cur.moved) { return; }
            const t = cur.tile;
            this.cursor = { x: t.x, y: t.y };
            const now = Date.now();
            if (lastTap.x === t.x && lastTap.y === t.y && now - lastTap.t < 420) {
                lastTap = { x: -1, y: -1, t: 0 };
                this.refresh();
                this.editAt(t.x, t.y);
                return;
            }
            lastTap = { x: t.x, y: t.y, t: now };
            this.refresh();
        };
        vp.addEventListener("pointerup", up, true);
        vp.addEventListener("pointercancel", e => { pointers.delete(e.pointerId); if (g) { clearTimeout(g.timer); } g = null; this.drag = null; this.refresh(); }, true);
        vp.addEventListener("contextmenu", e => {
            if (!this.active || !this.map) { return; }
            e.preventDefault();
            if (g) { return; } // toque longo: tratado no pointerup
            const t = this._tileFromClient(e.clientX, e.clientY);
            if (!t.inside) { return; }
            if (g) { clearTimeout(g.timer); g = null; }
            this.cursor = { x: t.x, y: t.y };
            this.refresh();
            openMenu(e.clientX, e.clientY);
        }, true);
        document.addEventListener("keydown", e => {
            if (!this.active || !this.map || document.querySelector(".mzDialogBackdrop,.evMenuBack")) { return; }
            if (/INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || "")) { return; }
            const mod = e.ctrlKey || e.metaKey;
            const mv = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
            if (mv) {
                e.preventDefault();
                this.cursor = { x: Math.max(0, Math.min(this.map.width - 1, this.cursor.x + mv[0])), y: Math.max(0, Math.min(this.map.height - 1, this.cursor.y + mv[1])) };
                this.refresh();
            } else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); this.editAt(this.cursor.x, this.cursor.y); }
            else if (e.key === "Delete") { this.del(); }
            else if (mod && e.key === "c") { this.copy(); }
            else if (mod && e.key === "x") { this.cut(); }
            else if (mod && e.key === "v") { this.paste(); }
        });
    }
    _dragPreview() {
        if (!this.drag) { return; }
        const { ev, target } = this.drag;
        if (this.dragSprite) { this.dragSprite.destroy(); this.dragSprite = null; }
        const before = this.spriteLayer.children.length;
        this._addImage(ev.pages[0] && ev.pages[0].image, target.x, target.y, 0.7);
        this.dragSprite = this.spriteLayer.children.length > before ? this.spriteLayer.children[this.spriteLayer.children.length - 1] : null;
        this.gfx.lineStyle(2, 0xffff00, 1).drawRect(target.x * T + 4, target.y * T + 4, T - 8, T - 8);
    }
}
