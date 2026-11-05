// Cálculo de formas de autotile e de sombra automática, como o editor RPG Maker MZ.
// Sem dependência de DOM: funciona no navegador e em Node (para os testes contra os
// mapas de exemplo oficiais, ver NOTES.md). As constantes e predicados são os mesmos de
// Tilemap em rmmz_core.js.

export const TILE_ID_B = 0;
export const TILE_ID_C = 256;
export const TILE_ID_D = 512;
export const TILE_ID_E = 768;
export const TILE_ID_A5 = 1536;
export const TILE_ID_A1 = 2048;
export const TILE_ID_A2 = 2816;
export const TILE_ID_A3 = 4352;
export const TILE_ID_A4 = 5888;
export const TILE_ID_MAX = 8192;

export const isAutotile = id => id >= TILE_ID_A1;
export const kindOf = id => Math.floor((id - TILE_ID_A1) / 48);
export const shapeOf = id => (id - TILE_ID_A1) % 48;
export const makeAutotileId = (kind, shape) => TILE_ID_A1 + kind * 48 + shape;
export const isA1 = id => id >= TILE_ID_A1 && id < TILE_ID_A2;
export const isA2 = id => id >= TILE_ID_A2 && id < TILE_ID_A3;
export const isA3 = id => id >= TILE_ID_A3 && id < TILE_ID_A4;
export const isA4 = id => id >= TILE_ID_A4 && id < TILE_ID_MAX;
export const isA5 = id => id >= TILE_ID_A5 && id < TILE_ID_A1;
export const isUpper = id => id >= 0 && id < TILE_ID_A5;
export const isWaterfall = id => id >= TILE_ID_A1 + 192 && id < TILE_ID_A2 && kindOf(id) % 2 === 1;
export const isRoof = id => isA3(id) && kindOf(id) % 16 < 8;
export const isWallTop = id => isA4(id) && kindOf(id) % 16 < 8;
export const isWallSide = id => (isA3(id) || isA4(id)) && kindOf(id) % 16 >= 8;
export const isShadowing = id => isA3(id) || isA4(id);
export const sameKind = (a, b) => (isAutotile(a) && isAutotile(b)) ? kindOf(a) === kindOf(b) : a === b;

export function autotileType(id) {
    if (!isAutotile(id)) { return "none"; }
    if (isWaterfall(id)) { return "waterfall"; }
    if (isRoof(id) || isWallSide(id)) { return "wall"; }
    return "floor";
}

// Tile "de decoração" da camada A: vai para a camada 1 por cima da base.
// A1: tipos 2 e 3 (pedras/icebergs sobre o mar); A2: colunas 5–8 (metade direita).
export function isDecorationA(id) {
    if (isA1(id)) {
        // Água profunda (1), pedras (2) e icebergs (3) têm bordas transparentes: nos mapas
        // oficiais ficam sempre na camada 1 sobre a água rasa (tipo 0) na camada 0.
        const k = kindOf(id);
        return k === 1 || k === 2 || k === 3;
    }
    if (isA2(id)) {
        return (kindOf(id) - 16) % 8 >= 4;
    }
    return false;
}

// Formas de piso (0–47): cada quarto do tile depende de dois vizinhos ortogonais e do
// diagonal. A tabela é derivada da própria FLOOR_AUTOTILE_TABLE do runtime, então a forma
// escolhida é exatamente a que desenha os quartos esperados.
// Estados por quarto: I = interior, C = canto interno, H = borda horizontal (vizinho lateral
// diferente), V = borda vertical (vizinho de cima/baixo diferente), O = canto externo.
const FLOOR_QUARTERS = {
    TL: { I: "2,4", C: "2,0", H: "0,4", V: "2,2", O: "0,2" },
    TR: { I: "1,4", C: "3,0", H: "3,4", V: "1,2", O: "3,2" },
    BL: { I: "2,3", C: "2,1", H: "0,3", V: "2,5", O: "0,5" },
    BR: { I: "1,3", C: "3,1", H: "3,3", V: "1,5", O: "3,5" }
};
export const FLOOR_AUTOTILE_TABLE = [
    [[2, 4], [1, 4], [2, 3], [1, 3]], [[2, 0], [1, 4], [2, 3], [1, 3]], [[2, 4], [3, 0], [2, 3], [1, 3]], [[2, 0], [3, 0], [2, 3], [1, 3]],
    [[2, 4], [1, 4], [2, 3], [3, 1]], [[2, 0], [1, 4], [2, 3], [3, 1]], [[2, 4], [3, 0], [2, 3], [3, 1]], [[2, 0], [3, 0], [2, 3], [3, 1]],
    [[2, 4], [1, 4], [2, 1], [1, 3]], [[2, 0], [1, 4], [2, 1], [1, 3]], [[2, 4], [3, 0], [2, 1], [1, 3]], [[2, 0], [3, 0], [2, 1], [1, 3]],
    [[2, 4], [1, 4], [2, 1], [3, 1]], [[2, 0], [1, 4], [2, 1], [3, 1]], [[2, 4], [3, 0], [2, 1], [3, 1]], [[2, 0], [3, 0], [2, 1], [3, 1]],
    [[0, 4], [1, 4], [0, 3], [1, 3]], [[0, 4], [3, 0], [0, 3], [1, 3]], [[0, 4], [1, 4], [0, 3], [3, 1]], [[0, 4], [3, 0], [0, 3], [3, 1]],
    [[2, 2], [1, 2], [2, 3], [1, 3]], [[2, 2], [1, 2], [2, 3], [3, 1]], [[2, 2], [1, 2], [2, 1], [1, 3]], [[2, 2], [1, 2], [2, 1], [3, 1]],
    [[2, 4], [3, 4], [2, 3], [3, 3]], [[2, 4], [3, 4], [2, 1], [3, 3]], [[2, 0], [3, 4], [2, 3], [3, 3]], [[2, 0], [3, 4], [2, 1], [3, 3]],
    [[2, 4], [1, 4], [2, 5], [1, 5]], [[2, 0], [1, 4], [2, 5], [1, 5]], [[2, 4], [3, 0], [2, 5], [1, 5]], [[2, 0], [3, 0], [2, 5], [1, 5]],
    [[0, 4], [3, 4], [0, 3], [3, 3]], [[2, 2], [1, 2], [2, 5], [1, 5]], [[0, 2], [1, 2], [0, 3], [1, 3]], [[0, 2], [1, 2], [0, 3], [3, 1]],
    [[2, 2], [3, 2], [2, 3], [3, 3]], [[2, 2], [3, 2], [2, 1], [3, 3]], [[2, 4], [3, 4], [2, 5], [3, 5]], [[2, 0], [3, 4], [2, 5], [3, 5]],
    [[0, 4], [1, 4], [0, 5], [1, 5]], [[0, 4], [3, 0], [0, 5], [1, 5]], [[0, 2], [3, 2], [0, 3], [3, 3]], [[0, 2], [1, 2], [0, 5], [1, 5]],
    [[0, 4], [3, 4], [0, 5], [3, 5]], [[2, 2], [3, 2], [2, 5], [3, 5]], [[0, 2], [3, 2], [0, 5], [3, 5]], [[0, 0], [1, 0], [0, 1], [1, 1]]
];
const FLOOR_LOOKUP = new Map();
FLOOR_AUTOTILE_TABLE.forEach((q, shape) => {
    const key = q.map(p => p.join(",")).join("|");
    if (!FLOOR_LOOKUP.has(key)) { FLOOR_LOOKUP.set(key, shape); }
});

function quarterState(side, vert, diag) {
    if (side && vert) { return diag ? "I" : "C"; }
    if (!side && vert) { return "H"; }
    if (side && !vert) { return "V"; }
    return "O";
}

// n: função (dx, dy) => true se o vizinho conta como "mesmo tipo".
export function floorShape(n) {
    const l = n(-1, 0), r = n(1, 0), u = n(0, -1), d = n(0, 1);
    const key = [
        FLOOR_QUARTERS.TL[quarterState(l, u, n(-1, -1))],
        FLOOR_QUARTERS.TR[quarterState(r, u, n(1, -1))],
        FLOOR_QUARTERS.BL[quarterState(l, d, n(-1, 1))],
        FLOOR_QUARTERS.BR[quarterState(r, d, n(1, 1))]
    ].join("|");
    return FLOOR_LOOKUP.has(key) ? FLOOR_LOOKUP.get(key) : 0;
}

// Paredes/telhados (0–15): bit 1 = borda esquerda, 2 = topo, 4 = direita, 8 = base.
export function wallShape(n) {
    return (n(-1, 0) ? 0 : 1) | (n(0, -1) ? 0 : 2) | (n(1, 0) ? 0 : 4) | (n(0, 1) ? 0 : 8);
}

// Cachoeira (0–3): bit 1 = borda esquerda, 2 = direita.
export function waterfallShape(n) {
    return (n(-1, 0) ? 0 : 1) | (n(1, 0) ? 0 : 2);
}

// Acesso aos dados do mapa no formato do MZ: data[(z * h + y) * w + x].
export class MapGrid {
    constructor(map) {
        this.map = map;
    }
    get w() { return this.map.width; }
    get h() { return this.map.height; }
    inside(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
    index(x, y, z) { return (z * this.h + y) * this.w + x; }
    get(x, y, z) {
        return this.inside(x, y) ? (this.map.data[this.index(x, y, z)] || 0) : 0;
    }
}

// Primeira linha (de cima) da coluna contínua de parede do mesmo tipo que contém (x,y).
function wallColumnTop(grid, x, y, z, id) {
    let t = y;
    while (t > 0 && sameKind(id, grid.get(x, t - 1, z))) {
        t--;
    }
    return t;
}

// Vizinho "do mesmo tipo" para o tile (x,y,z). As regras foram ajustadas comparando com
// os ~100 mapas de exemplo oficiais (RPG/samplemaps, ver NOTES.md):
// - piso/cachoeira: fora do mapa conta como igual (sem borda na beira do mapa);
// - parede/telhado: fora do mapa conta como diferente; na horizontal, um vizinho do mesmo
//   tipo só "emenda" se a coluna de parede começar na mesma linha, e o teto (A4 de cima)
//   correspondente ao lado da face da parede também emenda.
export function sameNeighbor(grid, x, y, z, id, dx, dy) {
    const nx = x + dx, ny = y + dy;
    const wall = autotileType(id) === "wall";
    if (!grid.inside(nx, ny)) {
        return !wall;
    }
    const other = grid.get(nx, ny, z);
    if (isA1(id) && !isWaterfall(id) && isWaterfall(other)) {
        return true; // a água emenda na cachoeira (sem margem entre elas)
    }
    if (isWaterfall(id) && isA1(other)) {
        return true; // e a cachoeira não tem borda lateral encostada em água
    }
    if (!wall || dy !== 0) {
        return sameKind(id, other);
    }
    if (sameKind(id, other)) {
        return wallColumnTop(grid, x, y, z, id) === wallColumnTop(grid, nx, y, z, id);
    }
    return isA4(id) && isA4(other) && kindOf(other) === kindOf(id) - 8;
}

// Sombra automática (camada 4): o MZ escurece a metade esquerda (bits 1|4 = 5) de um tile
// de chão quando o tile à esquerda e o de cima-à-esquerda são paredes/telhados (A3/A4).
// Também vale para a face de parede encostada num teto (A4 de cima) de outra coluna.
export function autoShadow(grid, x, y) {
    const c = grid.get(x, y, 0);
    const l = grid.get(x - 1, y, 0);
    const ul = grid.get(x - 1, y - 1, 0);
    if (!grid.inside(x - 1, y) || !grid.inside(x - 1, y - 1)) {
        return 0;
    }
    if (!isShadowing(l) || !isShadowing(ul)) {
        return 0;
    }
    const ground = isA1(c) || isA2(c) || isA5(c);
    if (ground || (isWallSide(c) && isWallTop(l))) {
        return 5;
    }
    return 0;
}

// Recalcula a forma do autotile em (x,y,z). Devolve o novo id (ou o mesmo).
export function computeAutotile(grid, x, y, z) {
    const id = grid.get(x, y, z);
    if (!isAutotile(id)) {
        return id;
    }
    const n = (dx, dy) => sameNeighbor(grid, x, y, z, id, dx, dy);
    const type = autotileType(id);
    let shape;
    if (type === "waterfall") {
        shape = waterfallShape(n);
    } else if (type === "wall") {
        shape = wallShape(n);
    } else {
        shape = floorShape(n);
    }
    return makeAutotileId(kindOf(id), shape);
}
