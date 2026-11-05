// Desenho de tiles em canvas 2D (paleta e prévia do pincel), com a mesma matemática de
// Tilemap.prototype._addNormalTile/_addAutotile do rmmz_core.js, a partir dos mesmos
// Bitmaps (ImageManager.loadTileset) que o Tilemap do visualizador usa.

import * as T from "./autotile.js";

const SRC = 48; // tamanho do tile nas imagens do MZ

// Fonte desenhável de um Bitmap do runtime (imagem carregada ou canvas).
export function bitmapSource(bitmap) {
    if (!bitmap || !bitmap.isReady || !bitmap.isReady()) {
        return null;
    }
    return bitmap._canvas || bitmap._image || null;
}

export function loadTilesetBitmaps(tileset) {
    return tileset.tilesetNames.map(name => (name ? ImageManager.loadTileset(name) : null));
}

export function whenBitmapsReady(bitmaps) {
    return Promise.all(bitmaps.map(b => new Promise(resolve => {
        if (!b || b.isReady() || b.isError()) {
            resolve();
        } else {
            b.addLoadListener(() => resolve());
            // erro de carga também libera
            setTimeout(resolve, 8000);
        }
    })));
}

// Desenha tileId em (dx,dy) com tamanho size. frame = quadro de animação (como Tilemap.animationFrame).
export function drawTile(ctx, bitmaps, tileId, dx, dy, size, frame = 0) {
    if (!(tileId > 0 && tileId < T.TILE_ID_MAX)) {
        return;
    }
    if (T.isAutotile(tileId)) {
        drawAutotile(ctx, bitmaps, tileId, dx, dy, size, frame);
    } else {
        drawNormalTile(ctx, bitmaps, tileId, dx, dy, size);
    }
}

function drawNormalTile(ctx, bitmaps, tileId, dx, dy, size) {
    const setNumber = T.isA5(tileId) ? 4 : 5 + Math.floor(tileId / 256);
    const src = bitmapSource(bitmaps[setNumber]);
    if (!src) {
        return;
    }
    const sx = ((Math.floor(tileId / 128) % 2) * 8 + (tileId % 8)) * SRC;
    const sy = (Math.floor((tileId % 256) / 8) % 16) * SRC;
    ctx.drawImage(src, sx, sy, SRC, SRC, dx, dy, size, size);
}

const WALL_TABLE = [
    [[2, 2], [1, 2], [2, 1], [1, 1]], [[0, 2], [1, 2], [0, 1], [1, 1]], [[2, 0], [1, 0], [2, 1], [1, 1]], [[0, 0], [1, 0], [0, 1], [1, 1]],
    [[2, 2], [3, 2], [2, 1], [3, 1]], [[0, 2], [3, 2], [0, 1], [3, 1]], [[2, 0], [3, 0], [2, 1], [3, 1]], [[0, 0], [3, 0], [0, 1], [3, 1]],
    [[2, 2], [1, 2], [2, 3], [1, 3]], [[0, 2], [1, 2], [0, 3], [1, 3]], [[2, 0], [1, 0], [2, 3], [1, 3]], [[0, 0], [1, 0], [0, 3], [1, 3]],
    [[2, 2], [3, 2], [2, 3], [3, 3]], [[0, 2], [3, 2], [0, 3], [3, 3]], [[2, 0], [3, 0], [2, 3], [3, 3]], [[0, 0], [3, 0], [0, 3], [3, 3]]
];
const WATERFALL_TABLE = [
    [[2, 0], [1, 0], [2, 1], [1, 1]], [[0, 0], [1, 0], [0, 1], [1, 1]],
    [[2, 0], [3, 0], [2, 1], [3, 1]], [[0, 0], [3, 0], [0, 1], [3, 1]]
];

function drawAutotile(ctx, bitmaps, tileId, dx, dy, size, frame) {
    const kind = T.kindOf(tileId);
    const shape = T.shapeOf(tileId);
    const tx = kind % 8;
    const ty = Math.floor(kind / 8);
    let setNumber = 0;
    let bx = 0;
    let by = 0;
    let table = T.FLOOR_AUTOTILE_TABLE;
    if (T.isA1(tileId)) {
        const waterSurfaceIndex = [0, 1, 2, 1][frame % 4];
        setNumber = 0;
        if (kind === 0) {
            bx = waterSurfaceIndex * 2; by = 0;
        } else if (kind === 1) {
            bx = waterSurfaceIndex * 2; by = 3;
        } else if (kind === 2) {
            bx = 6; by = 0;
        } else if (kind === 3) {
            bx = 6; by = 3;
        } else {
            bx = Math.floor(tx / 4) * 8;
            by = ty * 6 + (Math.floor(tx / 2) % 2) * 3;
            if (kind % 2 === 0) {
                bx += waterSurfaceIndex * 2;
            } else {
                bx += 6;
                table = WATERFALL_TABLE;
                by += frame % 3;
            }
        }
    } else if (T.isA2(tileId)) {
        setNumber = 1;
        bx = tx * 2;
        by = (ty - 2) * 3;
    } else if (T.isA3(tileId)) {
        setNumber = 2;
        bx = tx * 2;
        by = (ty - 6) * 2;
        table = WALL_TABLE;
    } else if (T.isA4(tileId)) {
        setNumber = 3;
        bx = tx * 2;
        by = Math.floor((ty - 10) * 2.5 + (ty % 2 === 1 ? 0.5 : 0));
        if (ty % 2 === 1) {
            table = WALL_TABLE;
        }
    }
    const src = bitmapSource(bitmaps[setNumber]);
    if (!src) {
        return;
    }
    const q = table[shape] || table[0];
    const h = SRC / 2;
    const d = size / 2;
    for (let i = 0; i < 4; i++) {
        const sx = (bx * 2 + q[i][0]) * h;
        const sy = (by * 2 + q[i][1]) * h;
        ctx.drawImage(src, sx, sy, h, h, dx + (i % 2) * d, dy + Math.floor(i / 2) * d, d, d);
    }
}

// Forma usada para mostrar um autotile na paleta (como o MZ: o tile de amostra do bloco).
export function paletteShape(kindTileId) {
    const type = T.autotileType(kindTileId);
    if (type === "waterfall") { return 3; }
    if (type === "wall") { return 15; }
    return 47;
}

// Cores das regiões (aba R). O MZ pinta cada ID com um matiz próprio e escreve o número.
export function regionColor(id, alpha = 0.55) {
    const hue = (id * 47) % 360;
    const light = 45 + (Math.floor(id / 8) % 3) * 10;
    return `hsla(${hue}, 80%, ${light}%, ${alpha})`;
}
