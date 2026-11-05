// Núcleo de edição de um mapa: regras de camadas do MZ, autotile, sombra automática,
// traço (stroke) com prévia/rollback e histórico desfazer/refazer por mapa.
// Sem DOM: tudo opera sobre o objeto MapXXX.json (map.data é alterado no lugar, então o
// Tilemap do visualizador, que guarda a mesma referência, só precisa de refresh()).

import * as T from "./autotile.js";

export const LAYER_AUTO = -1;

// Pincel: grade w×h. kind "palette": cada célula é um tileId (ou região na aba R).
// kind "map": cada célula traz as 6 camadas copiadas do mapa (colar / conta-gotas em área).
export function paletteBrush(w, h, cells, region = false) {
    return { kind: "palette", w, h, cells, region };
}

export class MapEdit {
    constructor(id, map, tileset) {
        this.id = id;
        this.map = map;
        this.tileset = tileset;
        this.grid = new T.MapGrid(map);
        this.undoStack = [];
        this.redoStack = [];
        this.stroke = null;
        this.modified = false;
    }

    get w() { return this.map.width; }
    get h() { return this.map.height; }

    // ----- baixo nível -----
    get(x, y, z) { return this.grid.get(x, y, z); }

    set(x, y, z, v) {
        if (!this.grid.inside(x, y)) {
            return;
        }
        const i = this.grid.index(x, y, z);
        const data = this.map.data;
        const old = data[i] || 0;
        if (old === v) {
            return;
        }
        if (this.stroke && !this.stroke.old.has(i)) {
            this.stroke.old.set(i, old);
        }
        data[i] = v;
        if (this.stroke && z <= 1) {
            this.stroke.lower.add(y * this.w + x);
        }
    }

    // ----- traço -----
    begin(label) {
        this.stroke = { label, old: new Map(), lower: new Set() };
    }

    // Desfaz o que o traço atual escreveu (prévia de retângulo/elipse, cancelamento).
    rollback() {
        if (!this.stroke) {
            return;
        }
        const data = this.map.data;
        for (const [i, old] of this.stroke.old) {
            data[i] = old;
        }
        this.stroke.old.clear();
        this.stroke.lower.clear();
    }

    cancel() {
        this.rollback();
        this.stroke = null;
    }

    commit() {
        const s = this.stroke;
        this.stroke = null;
        if (!s || s.old.size === 0) {
            return false;
        }
        const data = this.map.data;
        const changes = [];
        for (const [i, old] of s.old) {
            const now = data[i] || 0;
            if (now !== old) {
                changes.push([i, old, now]);
            }
        }
        if (!changes.length) {
            return false;
        }
        this.pushRecord({ label: s.label, changes });
        return true;
    }

    pushRecord(rec) {
        this.undoStack.push(rec);
        if (this.undoStack.length > 200) {
            this.undoStack.shift();
        }
        this.redoStack.length = 0;
        this.modified = true;
    }

    undo() {
        const rec = this.undoStack.pop();
        if (!rec) {
            return null;
        }
        this.applyRecord(rec, false);
        this.redoStack.push(rec);
        this.modified = true;
        return rec;
    }

    redo() {
        const rec = this.redoStack.pop();
        if (!rec) {
            return null;
        }
        this.applyRecord(rec, true);
        this.undoStack.push(rec);
        this.modified = true;
        return rec;
    }

    applyRecord(rec, forward) {
        if (rec.full) {
            const snap = forward ? rec.after : rec.before;
            Object.assign(this.map, JSON.parse(JSON.stringify(snap)));
            this.grid = new T.MapGrid(this.map);
            return;
        }
        const data = this.map.data;
        for (const [i, old, now] of rec.changes) {
            data[i] = forward ? now : old;
        }
    }

    // Registro "completo" (propriedades, redimensionar): guarda o mapa inteiro antes/depois.
    recordFull(label, before) {
        const after = JSON.parse(JSON.stringify(this.map));
        this.grid = new T.MapGrid(this.map);
        this.pushRecord({ label, full: true, before, after });
    }

    snapshot() {
        return JSON.parse(JSON.stringify(this.map));
    }

    // ----- regras de camadas do MZ -----

    // Coloca um tile do pincel de paleta em (x,y). layer: LAYER_AUTO ou 0..3.
    placeTile(x, y, tileId, layer, opts = {}) {
        if (!this.grid.inside(x, y)) {
            return;
        }
        if (opts.region) {
            this.set(x, y, 5, tileId);
            return;
        }
        if (layer !== LAYER_AUTO) {
            this.set(x, y, layer, tileId);
            return;
        }
        if (T.isUpper(tileId)) {
            // B–E: até dois tiles empilhados nas camadas 2/3; o 3º empurra o 1º para fora.
            // O tile transparente do canto superior esquerdo de B apaga os dois.
            if (tileId === 0) {
                this.set(x, y, 2, 0);
                this.set(x, y, 3, 0);
                return;
            }
            const top = this.get(x, y, 3);
            if (top === tileId) {
                return;
            }
            if (top) {
                this.set(x, y, 2, top);
            }
            this.set(x, y, 3, tileId);
            return;
        }
        if (T.isDecorationA(tileId)) {
            // A2 colunas 5–8 / A1 pedras e icebergs: decoração na camada 1 sobre a base.
            this.set(x, y, 1, tileId);
            const base = this.get(x, y, 0);
            if (this.tileset && this.tileset.mode === 0 && T.isA2(tileId) && T.isA2(base) && !T.isDecorationA(base)) {
                // Tipo campo: decoração sobre a base da 2ª/4ª coluna troca a base pela 1ª/3ª.
                const col = (T.kindOf(base) - 16) % 8;
                if (col === 1 || col === 3) {
                    this.set(x, y, 0, T.makeAutotileId(T.kindOf(base) - 1, T.shapeOf(base)));
                }
            }
            return;
        }
        this.set(x, y, 0, tileId);
        this.set(x, y, 1, 0);
    }

    // Escreve uma célula copiada do mapa (6 camadas). layer: LAYER_AUTO = todas.
    placeCell(x, y, cell, layer, regionOnly) {
        if (regionOnly) {
            this.set(x, y, 5, cell[5] || 0);
            return;
        }
        if (layer !== LAYER_AUTO) {
            this.set(x, y, layer, cell[layer] || 0);
            return;
        }
        for (let z = 0; z < 6; z++) {
            this.set(x, y, z, cell[z] || 0);
        }
    }

    // Aplica a célula (bx,by) do pincel no tile (x,y).
    applyBrushCell(brush, bx, by, x, y, layer, regionTab) {
        const cell = brush.cells[by * brush.w + bx];
        if (brush.kind === "map") {
            this.placeCell(x, y, cell, layer, regionTab);
        } else {
            this.placeTile(x, y, cell, layer, { region: brush.region });
        }
    }

    // Célula do pincel para (x,y) num padrão ancorado em (ax,ay).
    brushCellAt(brush, ax, ay, x, y) {
        const bx = ((x - ax) % brush.w + brush.w) % brush.w;
        const by = ((y - ay) % brush.h + brush.h) % brush.h;
        return [bx, by];
    }

    // Recalcula autotiles (camadas 0 e 1) e sombra automática ao redor do que mudou.
    fixup(autotile = true) {
        if (!this.stroke || !autotile || this.stroke.lower.size === 0) {
            return;
        }
        const w = this.w;
        const cells = new Set();
        for (const key of this.stroke.lower) {
            const x = key % w;
            const y = Math.floor(key / w);
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    if (this.grid.inside(x + dx, y + dy)) {
                        cells.add((y + dy) * w + x + dx);
                    }
                }
            }
            // paredes: a forma depende da coluna inteira abaixo
            for (let dx = -1; dx <= 1; dx++) {
                for (let yy = y + 2; yy < this.h; yy++) {
                    const id = this.get(x + dx, yy, 0);
                    if (T.autotileType(id) !== "wall") {
                        break;
                    }
                    cells.add(yy * w + x + dx);
                }
            }
        }
        const saved = this.stroke.lower;
        for (const key of cells) {
            const x = key % w;
            const y = Math.floor(key / w);
            for (let z = 0; z <= 1; z++) {
                const id = this.get(x, y, z);
                if (T.isAutotile(id)) {
                    const n = T.computeAutotile(this.grid, x, y, z);
                    if (n !== id) {
                        this.set(x, y, z, n);
                    }
                }
            }
        }
        // sombra automática: (x,y) depende de (x-1,y) e (x-1,y-1)
        const shadowCells = new Set();
        for (const key of saved) {
            const x = key % w;
            const y = Math.floor(key / w);
            for (const [dx, dy] of [[0, 0], [1, 0], [1, 1]]) {
                if (this.grid.inside(x + dx, y + dy)) {
                    shadowCells.add((y + dy) * w + x + dx);
                }
            }
        }
        for (const key of shadowCells) {
            const x = key % w;
            const y = Math.floor(key / w);
            const cur = this.get(x, y, 4);
            if (cur !== 0 && cur !== 5) {
                continue; // sombra desenhada à mão com a caneta: preserva
            }
            const s = T.autoShadow(this.grid, x, y);
            if (s !== cur) {
                this.set(x, y, 4, s);
            }
        }
        this.stroke.lower = saved;
    }

    // ----- ferramentas -----

    stamp(brush, ax, ay, px, py, layer, regionTab) {
        // carimba o pincel inteiro com o canto em (px,py), padrão ancorado em (ax,ay)
        for (let j = 0; j < brush.h; j++) {
            for (let i = 0; i < brush.w; i++) {
                const x = px + i;
                const y = py + j;
                if (!this.grid.inside(x, y)) {
                    continue;
                }
                const [bx, by] = this.brushCellAt(brush, ax, ay, x, y);
                this.applyBrushCell(brush, bx, by, x, y, layer, regionTab);
            }
        }
    }

    fillRect(brush, x0, y0, x1, y1, layer, regionTab, ellipse = false) {
        const left = Math.min(x0, x1), right = Math.max(x0, x1);
        const top = Math.min(y0, y1), bottom = Math.max(y0, y1);
        const cx = (left + right + 1) / 2, cy = (top + bottom + 1) / 2;
        const rx = (right - left + 1) / 2, ry = (bottom - top + 1) / 2;
        for (let y = top; y <= bottom; y++) {
            for (let x = left; x <= right; x++) {
                if (ellipse) {
                    const nx = (x + 0.5 - cx) / rx;
                    const ny = (y + 0.5 - cy) / ry;
                    if (nx * nx + ny * ny > 1.0001) {
                        continue;
                    }
                }
                if (!this.grid.inside(x, y)) {
                    continue;
                }
                const [bx, by] = this.brushCellAt(brush, left, top, x, y);
                this.applyBrushCell(brush, bx, by, x, y, layer, regionTab);
            }
        }
    }

    // Chave de comparação do preenchimento: o que seria substituído pelo pincel.
    _fillKey(x, y, brush, layer, regionTab) {
        if (regionTab || brush.region) {
            return String(this.get(x, y, 5));
        }
        const kindKey = id => (T.isAutotile(id) ? "k" + T.kindOf(id) : String(id));
        if (layer !== LAYER_AUTO) {
            return kindKey(this.get(x, y, layer));
        }
        const sample = brush.kind === "palette" ? brush.cells[0] : null;
        if (sample !== null && T.isUpper(sample)) {
            return this.get(x, y, 2) + "," + this.get(x, y, 3);
        }
        if (sample !== null && T.isDecorationA(sample)) {
            return kindKey(this.get(x, y, 0)) + "," + kindKey(this.get(x, y, 1));
        }
        return kindKey(this.get(x, y, 0)) + "," + kindKey(this.get(x, y, 1)) +
            (brush.kind === "map" ? "," + this.get(x, y, 2) + "," + this.get(x, y, 3) : "");
    }

    floodFill(brush, sx, sy, layer, regionTab) {
        if (!this.grid.inside(sx, sy)) {
            return;
        }
        const key = this._fillKey(sx, sy, brush, layer, regionTab);
        const w = this.w;
        const seen = new Uint8Array(w * this.h);
        const stack = [[sx, sy]];
        const cells = [];
        seen[sy * w + sx] = 1;
        while (stack.length) {
            const [x, y] = stack.pop();
            cells.push([x, y]);
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const nx = x + dx, ny = y + dy;
                if (!this.grid.inside(nx, ny) || seen[ny * w + nx]) {
                    continue;
                }
                seen[ny * w + nx] = 1;
                if (this._fillKey(nx, ny, brush, layer, regionTab) === key) {
                    stack.push([nx, ny]);
                }
            }
        }
        for (const [x, y] of cells) {
            const [bx, by] = this.brushCellAt(brush, sx, sy, x, y);
            this.applyBrushCell(brush, bx, by, x, y, layer, regionTab);
        }
    }

    // Caneta de sombra: liga/desliga um quarto de tile (bits 1,2,4,8 = sup.esq, sup.dir, inf.esq, inf.dir).
    shadowQuarter(x, y, bit, on) {
        const cur = this.get(x, y, 4);
        const next = on ? (cur | bit) : (cur & ~bit);
        this.set(x, y, 4, next);
    }

    // Copia uma área (6 camadas) como pincel do tipo "map".
    copyArea(x0, y0, x1, y1) {
        const left = Math.max(0, Math.min(x0, x1)), right = Math.min(this.w - 1, Math.max(x0, x1));
        const top = Math.max(0, Math.min(y0, y1)), bottom = Math.min(this.h - 1, Math.max(y0, y1));
        const cells = [];
        for (let y = top; y <= bottom; y++) {
            for (let x = left; x <= right; x++) {
                const cell = [];
                for (let z = 0; z < 6; z++) {
                    cell.push(this.get(x, y, z));
                }
                cells.push(cell);
            }
        }
        return { kind: "map", w: right - left + 1, h: bottom - top + 1, cells };
    }

    clearArea(x0, y0, x1, y1, layer, regionTab) {
        for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) {
            for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) {
                if (regionTab) {
                    this.set(x, y, 5, 0);
                } else if (layer !== LAYER_AUTO) {
                    this.set(x, y, layer, 0);
                } else {
                    for (let z = 0; z < 6; z++) {
                        this.set(x, y, z, 0);
                    }
                }
            }
        }
    }

    // Conta-gotas: o tile visível mais alto (ou da camada escolhida / região).
    pick(x, y, layer, regionTab, exact) {
        if (!this.grid.inside(x, y)) {
            return null;
        }
        if (regionTab) {
            return { region: true, id: this.get(x, y, 5) };
        }
        let id = 0;
        if (layer !== LAYER_AUTO) {
            id = this.get(x, y, layer);
        } else {
            for (const z of [3, 2, 1, 0]) {
                id = this.get(x, y, z);
                if (id) {
                    break;
                }
            }
        }
        if (T.isAutotile(id) && !exact) {
            id = T.makeAutotileId(T.kindOf(id), 0);
        }
        return { region: false, id };
    }
}

// Redimensiona os dados do mapa preservando o conteúdo (canto superior esquerdo fixo).
export function resizeMapData(map, newW, newH) {
    const oldW = map.width, oldH = map.height;
    const data = new Array(newW * newH * 6).fill(0);
    for (let z = 0; z < 6; z++) {
        for (let y = 0; y < Math.min(oldH, newH); y++) {
            for (let x = 0; x < Math.min(oldW, newW); x++) {
                data[(z * newH + y) * newW + x] = map.data[(z * oldH + y) * oldW + x] || 0;
            }
        }
    }
    map.width = newW;
    map.height = newH;
    map.data = data;
    // eventos fora da nova área deixam de existir, como no MZ
    if (Array.isArray(map.events)) {
        for (let i = 0; i < map.events.length; i++) {
            const ev = map.events[i];
            if (ev && (ev.x >= newW || ev.y >= newH)) {
                map.events[i] = null;
            }
        }
    }
}
