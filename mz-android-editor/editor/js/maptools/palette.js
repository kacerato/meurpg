// Paleta de tiles do MZ: abas A, B, C, D, E e R (regiões) na parte de baixo, grade de 8
// colunas. A aba A mostra A1–A5 empilhados (um tile por autotile, A1 animado).
// Seleção de vários tiles arrastando (mouse) ou com toque longo + arrastar (toque).

import * as T from "./autotile.js";
import { drawTile, loadTilesetBitmaps, whenBitmapsReady, paletteShape, regionColor } from "./render.js";
import { paletteBrush } from "./editops.js";
import { t } from "../i18n.js";

const COLS = 8;
export const TABS = ["A", "B", "C", "D", "E", "R"];

export class Palette {
    constructor(container, { onSelect }) {
        this.container = container;
        this.onSelect = onSelect;
        this.tab = "A";
        this.cell = 32;
        this.tileset = null;
        this.bitmaps = [];
        this.items = []; // por índice de célula: tileId (ou -1 vazio)
        this.sel = { x: 0, y: 0, w: 1, h: 1 };
        this.frame = 0;
        this._build();
        this._timer = setInterval(() => this._animate(), 500);
    }

    _build() {
        const root = this.container;
        root.classList.add("mtPalette");
        this.scroller = document.createElement("div");
        this.scroller.className = "mtPaletteScroll";
        this.canvas = document.createElement("canvas");
        this.canvas.className = "mtPaletteCanvas";
        this.scroller.appendChild(this.canvas);
        this.tabBar = document.createElement("div");
        this.tabBar.className = "mtTabs";
        this.tabButtons = {};
        for (const tab of TABS) {
            const b = document.createElement("button");
            b.textContent = tab;
            b.title = tab === "R" ? t("Regions") : t("Tiles %1", null, tab);
            b.addEventListener("click", () => this.setTab(tab));
            this.tabBar.appendChild(b);
            this.tabButtons[tab] = b;
        }
        root.append(this.scroller, this.tabBar);
        this._bindInput();
    }

    async setTileset(tileset) {
        this.tileset = tileset;
        this.bitmaps = loadTilesetBitmaps(tileset);
        if (this.tabButtons[this.tab].disabled) {
            this.tab = "A";
        }
        this._updateTabs();
        this._layout();
        const s = this.sel;
        if (!s.w || (s.y + s.h) * COLS > this.items.length) {
            this.sel = { x: 0, y: 0, w: 1, h: 1 };
        }
        this.draw();
        this._emit();
        await whenBitmapsReady(this.bitmaps);
        if (this.tileset === tileset) {
            this.draw();
        }
    }

    _hasSheet(i) {
        return !!(this.tileset && this.tileset.tilesetNames[i]);
    }

    _updateTabs() {
        const map = { A: [0, 1, 2, 3, 4], B: [5], C: [6], D: [7], E: [8] };
        for (const t of TABS) {
            const enabled = t === "R" || (map[t] || []).some(i => this._hasSheet(i));
            this.tabButtons[t].disabled = !enabled;
            this.tabButtons[t].classList.toggle("on", t === this.tab);
        }
    }

    setTab(t) {
        if (this.tabButtons[t].disabled) {
            return;
        }
        this.tab = t;
        this._updateTabs();
        this._layout();
        this.sel = { x: 0, y: 0, w: 1, h: 1 };
        this.scroller.scrollTop = 0;
        this.draw();
        this._emit();
    }

    get isRegion() {
        return this.tab === "R";
    }

    // Monta a lista de itens da aba atual (linhas de 8).
    _layout() {
        const items = [];
        const pushRow = arr => {
            for (let i = 0; i < COLS; i++) {
                items.push(arr[i] === undefined ? -1 : arr[i]);
            }
        };
        if (this.tab === "A") {
            // A1: 16 tipos (2 linhas), A2: 32 (4), A3: 32 (4), A4: 48 (6), A5: 128 tiles (16)
            const sections = [
                [0, 0, 16], [1, 16, 32], [2, 48, 32], [3, 80, 48]
            ];
            for (const [sheet, firstKind, count] of sections) {
                if (!this._hasSheet(sheet)) {
                    continue;
                }
                for (let r = 0; r < count / COLS; r++) {
                    const row = [];
                    for (let c = 0; c < COLS; c++) {
                        row.push(T.makeAutotileId(firstKind + r * COLS + c, 0));
                    }
                    pushRow(row);
                }
            }
            if (this._hasSheet(4)) {
                for (let r = 0; r < 16; r++) {
                    const row = [];
                    for (let c = 0; c < COLS; c++) {
                        row.push(T.TILE_ID_A5 + r * COLS + c);
                    }
                    pushRow(row);
                }
            }
        } else if (this.tab === "R") {
            for (let r = 0; r < 32; r++) {
                const row = [];
                for (let c = 0; c < COLS; c++) {
                    row.push(r * COLS + c);
                }
                pushRow(row);
            }
        } else {
            const base = { B: T.TILE_ID_B, C: T.TILE_ID_C, D: T.TILE_ID_D, E: T.TILE_ID_E }[this.tab];
            for (let r = 0; r < 32; r++) {
                const row = [];
                for (let c = 0; c < COLS; c++) {
                    row.push(base + r * COLS + c);
                }
                pushRow(row);
            }
        }
        this.items = items;
        this.rows = Math.ceil(items.length / COLS);
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = COLS * this.cell * dpr;
        this.canvas.height = Math.max(1, this.rows * this.cell * dpr);
        this.canvas.style.width = COLS * this.cell + "px";
        this.canvas.style.height = this.rows * this.cell + "px";
    }

    draw(onlyAnimated = false) {
        const ctx = this.canvas.getContext("2d");
        const dpr = window.devicePixelRatio || 1;
        const size = this.cell;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.imageSmoothingEnabled = false;
        for (let i = 0; i < this.items.length; i++) {
            const id = this.items[i];
            if (onlyAnimated && !(id >= 0 && T.isA1(id))) {
                continue;
            }
            const x = (i % COLS) * size;
            const y = Math.floor(i / COLS) * size;
            this._drawCell(ctx, id, x, y, size);
        }
        this._drawSelection(ctx);
    }

    _drawCell(ctx, id, x, y, size) {
        // fundo xadrez como o MZ para áreas transparentes
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(x, y, size, size);
        ctx.fillStyle = "#e4e4e4";
        const h = size / 2;
        ctx.fillRect(x, y, h, h);
        ctx.fillRect(x + h, y + h, h, h);
        if (id < 0) {
            return;
        }
        if (this.tab === "R") {
            if (id > 0) {
                ctx.fillStyle = regionColor(id, 0.8);
                ctx.fillRect(x, y, size, size);
            }
            ctx.fillStyle = id > 0 ? "#fff" : "#606060";
            ctx.font = `bold ${Math.round(size * 0.4)}px "M+ 1p", sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.lineWidth = 3;
            ctx.strokeStyle = "rgba(0,0,0,.6)";
            if (id > 0) {
                ctx.strokeText(String(id), x + size / 2, y + size / 2);
            }
            ctx.fillText(String(id), x + size / 2, y + size / 2);
            return;
        }
        const shown = T.isAutotile(id) ? T.makeAutotileId(T.kindOf(id), paletteShape(id)) : id;
        drawTile(ctx, this.bitmaps, shown, x, y, size, this.frame);
    }

    _drawSelection(ctx) {
        const s = this.sel;
        const size = this.cell;
        if (!s.w || !s.h) {
            return;
        }
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#000";
        ctx.strokeRect(s.x * size + 1.5, s.y * size + 1.5, s.w * size - 3, s.h * size - 3);
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#fff";
        ctx.strokeRect(s.x * size + 2, s.y * size + 2, s.w * size - 4, s.h * size - 4);
    }

    _animate() {
        if (this.tab !== "A" || !this._hasSheet(0)) {
            return;
        }
        this.frame++;
        this.draw(true);
    }

    _cellAt(e) {
        const r = this.canvas.getBoundingClientRect();
        const x = Math.floor((e.clientX - r.left) / this.cell);
        const y = Math.floor((e.clientY - r.top) / this.cell);
        return [Math.max(0, Math.min(COLS - 1, x)), Math.max(0, Math.min(this.rows - 1, y))];
    }

    _bindInput() {
        const c = this.canvas;
        let anchor = null;
        let selecting = false;
        let longTimer = 0;
        let downPos = null;
        const update = (x, y) => {
            this.sel = {
                x: Math.min(anchor[0], x), y: Math.min(anchor[1], y),
                w: Math.abs(anchor[0] - x) + 1, h: Math.abs(anchor[1] - y) + 1
            };
            this.draw();
        };
        c.addEventListener("contextmenu", e => e.preventDefault());
        c.addEventListener("pointerdown", e => {
            anchor = this._cellAt(e);
            downPos = { x: e.clientX, y: e.clientY };
            if (e.pointerType === "mouse") {
                selecting = true;
                c.setPointerCapture(e.pointerId);
                update(...anchor);
            } else {
                // toque: toque simples seleciona; toque longo + arrastar seleciona área
                selecting = false;
                clearTimeout(longTimer);
                longTimer = setTimeout(() => {
                    selecting = true;
                    try { c.setPointerCapture(e.pointerId); } catch (_) { /* ignorado */ }
                    update(...anchor);
                    if (navigator.vibrate) { navigator.vibrate(15); }
                }, 350);
            }
        });
        c.addEventListener("pointermove", e => {
            if (selecting && anchor) {
                update(...this._cellAt(e));
            } else if (downPos && Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y) > 8) {
                clearTimeout(longTimer);
                downPos = null;
                anchor = null;
            }
        });
        const end = e => {
            clearTimeout(longTimer);
            if (!anchor) {
                return;
            }
            if (!selecting && e.type === "pointerup") {
                update(...anchor);
            }
            selecting = false;
            anchor = null;
            downPos = null;
            if (e.type === "pointerup") {
                this._emit();
            }
        };
        c.addEventListener("pointerup", end);
        c.addEventListener("pointercancel", end);
        // durante a seleção por toque longo, impede que o navegador role a paleta
        c.addEventListener("touchmove", e => {
            if (selecting) {
                e.preventDefault();
            }
        }, { passive: false });
    }

    currentBrush() {
        const s = this.sel;
        const cells = [];
        for (let y = s.y; y < s.y + s.h; y++) {
            for (let x = s.x; x < s.x + s.w; x++) {
                const id = this.items[y * COLS + x];
                cells.push(id === undefined || id < 0 ? 0 : id);
            }
        }
        return paletteBrush(s.w, s.h, cells, this.isRegion);
    }

    _emit() {
        if (this.onSelect) {
            this.onSelect(this.currentBrush());
        }
    }

    // Seleciona na paleta o tile pego pelo conta-gotas (troca de aba se preciso).
    selectTile(id, region) {
        let tab;
        if (region) {
            tab = "R";
        } else if (id >= T.TILE_ID_A5) {
            tab = "A";
        } else {
            tab = TABS[1 + Math.floor(id / 256)];
        }
        if (tab !== this.tab && !this.tabButtons[tab].disabled) {
            this.tab = tab;
            this._updateTabs();
            this._layout();
        }
        const norm = T.isAutotile(id) ? T.makeAutotileId(T.kindOf(id), 0) : id;
        const i = this.items.indexOf(norm);
        if (i >= 0) {
            this.sel = { x: i % COLS, y: Math.floor(i / COLS), w: 1, h: 1 };
            const top = this.sel.y * this.cell;
            if (top < this.scroller.scrollTop || top > this.scroller.scrollTop + this.scroller.clientHeight - this.cell) {
                this.scroller.scrollTop = top - this.scroller.clientHeight / 2;
            }
        }
        this.draw();
    }

    // Marca uma área sem tile correspondente (pincel copiado do mapa)
    clearSelectionMark() {
        this.sel = { x: 0, y: 0, w: 0, h: 0 };
        this.draw();
    }

    setCellSize(px) {
        this.cell = px;
        // o painel acompanha a largura da grade (8 colunas + barra de rolagem)
        const panel = this.container.closest("#mtPanel");
        if (panel) {
            panel.style.width = (COLS * px + 14) + "px";
        }
        this._layout();
        this.draw();
    }
}
