// "Gerar Masmorra" (Dialog_GenerateDungeon do MZ). Os scripts originais (Dungeon*.js) estão
// compilados no editor; este é um gerador equivalente seguindo o manual:
// Tipo Salas (salas ligadas por passagens) ou Labirinto (só passagens); Opções Adic. Margens
// e Passagens Largas; Parede = um teto A4 (a face usa o tipo correspondente, 2 tiles de
// altura como nos mapas de exemplo); Piso = um tile A5. O mapa inteiro é substituído
// (camadas 0–4; regiões e eventos ficam) e a operação entra no desfazer.

import * as T from "./autotile.js";
import { drawTile, loadTilesetBitmaps, whenBitmapsReady, paletteShape } from "./render.js";

const WALL_H = 2;

function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => {
        s ^= s << 13; s >>>= 0;
        s ^= s >> 17;
        s ^= s << 5; s >>>= 0;
        return s / 4294967296;
    };
}

// Devolve uma grade booleana "chão" (true) do tamanho do mapa.
export function generateLayout(w, h, { type = "rooms", margins = false, wide = false, seed = Date.now() } = {}) {
    const rand = rng(seed);
    const ri = (a, b) => a + Math.floor(rand() * (b - a + 1));
    const floor = new Uint8Array(w * h);
    const m = margins ? 2 : 0;
    const cw = wide ? 2 : 1;
    // área útil: 1 tile de teto nas laterais/base, teto + parede no topo
    const ax0 = m + 1, ay0 = m + 1 + WALL_H, ax1 = w - m - 2, ay1 = h - m - 2;
    const carve = (x0, y0, ww, hh) => {
        for (let y = y0; y < y0 + hh; y++) {
            for (let x = x0; x < x0 + ww; x++) {
                if (x >= ax0 && x <= ax1 && y >= ay0 && y <= ay1) {
                    floor[y * w + x] = 1;
                }
            }
        }
    };
    if (ax1 - ax0 < 2 || ay1 - ay0 < 2) {
        return floor;
    }
    if (type === "maze") {
        const px = cw + 1, py = cw + 1 + WALL_H;
        const nx = Math.floor((ax1 - ax0 + 1 - cw) / px) + 1;
        const ny = Math.floor((ay1 - ay0 + 1 - cw) / py) + 1;
        if (nx < 1 || ny < 1) { return floor; }
        const cellX = i => ax0 + i * px, cellY = j => ay0 + j * py;
        const seen = new Uint8Array(nx * ny);
        const stack = [[ri(0, nx - 1), ri(0, ny - 1)]];
        seen[stack[0][1] * nx + stack[0][0]] = 1;
        carve(cellX(stack[0][0]), cellY(stack[0][1]), cw, cw);
        const link = (i, j, ni, nj) => {
            if (ni !== i) {
                const a = Math.min(i, ni);
                carve(cellX(a) + cw, cellY(j), px - cw, cw);
            } else {
                const b = Math.min(j, nj);
                carve(cellX(i), cellY(b) + cw, cw, py - cw);
            }
        };
        while (stack.length) {
            const [i, j] = stack[stack.length - 1];
            const opts = [[1, 0], [-1, 0], [0, 1], [0, -1]]
                .map(([dx, dy]) => [i + dx, j + dy])
                .filter(([a, b]) => a >= 0 && b >= 0 && a < nx && b < ny && !seen[b * nx + a]);
            if (!opts.length) { stack.pop(); continue; }
            const [ni, nj] = opts[Math.floor(rand() * opts.length)];
            seen[nj * nx + ni] = 1;
            carve(cellX(ni), cellY(nj), cw, cw);
            link(i, j, ni, nj);
            stack.push([ni, nj]);
        }
        // alguns atalhos para não ficar um labirinto perfeito
        const extra = Math.floor(nx * ny * 0.08);
        for (let k = 0; k < extra; k++) {
            const i = ri(0, nx - 1), j = ri(0, ny - 1);
            if (rand() < 0.5 && i + 1 < nx) { link(i, j, i + 1, j); } else if (j + 1 < ny) { link(i, j, i, j + 1); }
        }
        return floor;
    }
    // Salas
    const rooms = [];
    const areaW = ax1 - ax0 + 1, areaH = ay1 - ay0 + 1;
    const target = Math.max(2, Math.floor((areaW * areaH) / 90));
    for (let tries = 0; tries < target * 30 && rooms.length < target; tries++) {
        const rw = ri(3, Math.max(3, Math.min(9, areaW - 1)));
        const rh = ri(3, Math.max(3, Math.min(6, areaH - 1)));
        const x = ri(ax0, Math.max(ax0, ax1 - rw + 1));
        const y = ri(ay0, Math.max(ay0, ay1 - rh + 1));
        // folga: 2 tiles na lateral, teto + parede entre salas empilhadas
        const ok = rooms.every(r => x + rw + 2 <= r.x || r.x + r.w + 2 <= x ||
            y + rh + 1 + WALL_H <= r.y || r.y + r.h + 1 + WALL_H <= y);
        if (ok) { rooms.push({ x, y, w: rw, h: rh }); }
    }
    for (const r of rooms) { carve(r.x, r.y, r.w, r.h); }
    // liga as salas com uma árvore geradora mínima (Prim) + um ou dois ciclos
    const center = r => [r.x + Math.floor(r.w / 2), r.y + Math.floor(r.h / 2)];
    const corridor = (a, b) => {
        const [x0, y0] = center(a), [x1, y1] = center(b);
        const hx = rand() < 0.5;
        if (hx) {
            carve(Math.min(x0, x1), y0, Math.abs(x1 - x0) + cw, cw);
            carve(x1, Math.min(y0, y1), cw, Math.abs(y1 - y0) + cw);
        } else {
            carve(x0, Math.min(y0, y1), cw, Math.abs(y1 - y0) + cw);
            carve(Math.min(x0, x1), y1, Math.abs(x1 - x0) + cw, cw);
        }
    };
    if (rooms.length > 1) {
        const inTree = [0];
        const left = new Set(rooms.map((_, i) => i).slice(1));
        const dist = (a, b) => { const [ax, ay] = center(rooms[a]), [bx, by] = center(rooms[b]); return Math.abs(ax - bx) + Math.abs(ay - by); };
        while (left.size) {
            let best = null;
            for (const a of inTree) {
                for (const b of left) {
                    const d = dist(a, b);
                    if (!best || d < best[2]) { best = [a, b, d]; }
                }
            }
            corridor(rooms[best[0]], rooms[best[1]]);
            inTree.push(best[1]);
            left.delete(best[1]);
        }
        if (rooms.length > 3) {
            corridor(rooms[ri(0, rooms.length - 1)], rooms[ri(0, rooms.length - 1)]);
        }
    }
    return floor;
}

// Aplica o layout no mapa com o teto/parede e piso escolhidos.
export function applyDungeon(edit, floor, wallTopKind, floorId) {
    const w = edit.w, h = edit.h;
    const isFloor = (x, y) => x >= 0 && y >= 0 && x < w && y < h && floor[y * w + x] === 1;
    const top = T.makeAutotileId(wallTopKind, 0);
    const side = T.makeAutotileId(wallTopKind + 8, 0);
    edit.begin("Gerar Masmorra");
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let id;
            if (isFloor(x, y)) {
                id = floorId;
            } else {
                id = top;
                for (let k = 1; k <= WALL_H; k++) {
                    // face da parede: até WALL_H tiles acima do chão, desde que sólidos
                    let solidBetween = true;
                    for (let j = 1; j < k; j++) { if (isFloor(x, y + j)) { solidBetween = false; } }
                    if (solidBetween && isFloor(x, y + k)) { id = side; break; }
                }
            }
            edit.set(x, y, 0, id);
            for (let z = 1; z <= 4; z++) { edit.set(x, y, z, 0); }
        }
    }
    // marca tudo para recalcular autotile e sombra automática
    for (let i = 0; i < w * h; i++) { edit.stroke.lower.add(i); }
    edit.fixup(true);
    return edit.commit();
}

function tileButton(bitmaps, id, size = 40) {
    const c = document.createElement("canvas");
    const dpr = window.devicePixelRatio || 1;
    c.width = c.height = size * dpr;
    c.style.width = c.style.height = size + "px";
    const g = c.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.imageSmoothingEnabled = false;
    const shown = T.isAutotile(id) ? T.makeAutotileId(T.kindOf(id), paletteShape(id)) : id;
    drawTile(g, bitmaps, shown, 0, 0, size);
    const b = document.createElement("button");
    b.type = "button";
    b.className = "mtTileBtn";
    b.appendChild(c);
    b.dataset.id = id;
    return b;
}

export async function openDungeonDialog(api, edit, after) {
    const tilesets = await api.project.tilesets();
    const tileset = tilesets[edit.map.tilesetId];
    if (!tileset || !tileset.tilesetNames[3] || !tileset.tilesetNames[4]) {
        api.status("Gerar Masmorra precisa de um tileset com A4 (paredes) e A5 (pisos).");
        return false;
    }
    const bitmaps = loadTilesetBitmaps(tileset);
    await whenBitmapsReady(bitmaps);
    // tetos de A4: linhas pares (tipos 80–87, 96–103, 112–119)
    const walls = [];
    for (const row of [80, 96, 112]) {
        for (let k = 0; k < 8; k++) { walls.push(row + k); }
    }
    const floors = [];
    for (let i = 0; i < 128; i++) { floors.push(T.TILE_ID_A5 + i); }
    return new Promise(resolve => {
        let wallKind = walls[0];
        let floorId = T.TILE_ID_A5 + 8; // segunda linha do A5 costuma ser piso
        const rooms = document.createElement("input");
        rooms.type = "radio"; rooms.name = "mtDgType"; rooms.checked = true;
        const maze = document.createElement("input");
        maze.type = "radio"; maze.name = "mtDgType";
        const margins = document.createElement("input");
        margins.type = "checkbox";
        const wide = document.createElement("input");
        wide.type = "checkbox";
        const lab = (input, text, title) => {
            const l = document.createElement("label");
            l.className = "mtCheck";
            l.title = title;
            l.append(input, " " + text);
            return l;
        };
        const group = (legend, ...kids) => {
            const f = document.createElement("fieldset");
            f.className = "mtGroup";
            const lg = document.createElement("legend");
            lg.textContent = legend;
            f.append(lg, ...kids);
            return f;
        };
        const grid = (ids, isSel, onPick) => {
            const d = document.createElement("div");
            d.className = "mtTileGrid";
            for (const id of ids) {
                const b = tileButton(bitmaps, id);
                b.classList.toggle("sel", isSel(id));
                b.addEventListener("click", () => {
                    onPick(id);
                    for (const x of d.children) { x.classList.toggle("sel", x === b); }
                });
                d.appendChild(b);
            }
            return d;
        };
        const dlg = api.openDialog({
            title: "Gerar Masmorra",
            width: "min(760px, 98vw)",
            height: "min(560px, 96vh)",
            buttons: [
                {
                    label: "Ok", primary: true, onClick: () => {
                        const layout = generateLayout(edit.w, edit.h, {
                            type: maze.checked ? "maze" : "rooms",
                            margins: margins.checked,
                            wide: wide.checked
                        });
                        applyDungeon(edit, layout, wallKind, floorId);
                        after(edit);
                        api.status("Masmorra gerada");
                        resolve(true);
                    }
                },
                { label: "Cancelar", onClick: () => resolve(false) }
            ]
        });
        const left = document.createElement("div");
        left.className = "mtDgLeft";
        left.append(
            group("Tipo",
                lab(rooms, "Salas", "Gera uma masmorra constituída de salas e passagens."),
                lab(maze, "Labirinto", "Gera uma masmorra tipo labirinto que não tem salas.")),
            group("Opções",
                lab(margins, "Adic. Margens", "Adiciona margens em torno da masmorra."),
                lab(wide, "Passagens Largas", "Aumenta a largura das passagens.")));
        const right = document.createElement("div");
        right.className = "mtDgRight";
        right.append(
            group("Parede", grid(walls.map(k => T.makeAutotileId(k, 0)), id => T.kindOf(id) === wallKind, id => { wallKind = T.kindOf(id); })),
            group("Piso", grid(floors, id => id === floorId, id => { floorId = id; })));
        const wrap = document.createElement("div");
        wrap.className = "mtDgDialog";
        wrap.append(left, right);
        dlg.body.appendChild(wrap);
    });
}
