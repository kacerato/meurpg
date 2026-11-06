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
// Autotiles A com bordas transparentes, que o MZ sempre põe na camada 1 sobre uma base.
// Regra medida nos ~100 mapas oficiais (RPG/samplemaps): nenhum destes aparece na camada 0.
//  - A1 tipos 1–3 (água profunda, pedras, icebergs): sobre água rasa (tipo 0).
//  - A2 colunas 5–8 (árvores, montanhas…): sobre o chão que já estiver ali.
//  - Tileset tipo campo (mode 0), A2 colunas 2 e 4 (gramas/terrenos com borda transparente):
//    sobre a coluna 1 e 3 da mesma linha, respectivamente.
// mode: Tilesets[n].mode (0 campo, 1 área, 2 compatível com VX). Sem mode, assume campo.
export function isDecorationA(id, mode = 0) {
    if (isA1(id)) {
        const k = kindOf(id);
        return k === 1 || k === 2 || k === 3;
    }
    if (isA2(id)) {
        const col = (kindOf(id) - 16) % 8;
        return col >= 4 || (mode === 0 && (col === 1 || col === 3));
    }
    return false;
}

// Tipo de autotile que a decoração exige na camada 0 (ou null: qualquer chão serve).
export function decorationBaseKind(id, mode = 0) {
    if (isA1(id)) {
        return 0;
    }
    if (isA2(id) && mode === 0) {
        const col = (kindOf(id) - 16) % 8;
        if (col === 1 || col === 3) {
            return kindOf(id) - 1;
        }
    }
    return null;
}

// Chão padrão para uma decoração A2 (colunas 5–8) sem chão válido: coluna 1 da mesma linha.
export function defaultGroundKind(id) {
    return isA2(id) ? 16 + Math.floor((kindOf(id) - 16) / 8) * 8 : 0;
}

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
// ===========================================================================
// Algoritmo do editor original (RPG.exe 1.1.1, classe C++ MapEditorBody do módulo
// Tkool.core; endereços do executável x64 entre parênteses). Ver NOTES.md, seção
// "Fidelidade do autotile".
//
// Cada autotile guarda, implicitamente, 8 bits de "borda" — um por vizinho:
//   1 = cima-esq., 2 = cima-dir., 4 = baixo-dir., 8 = baixo-esq.,
//   0x10 = esquerda, 0x20 = cima, 0x40 = direita, 0x80 = baixo.
// Bit ligado = o vizinho é "diferente" (desenha a borda). O editor converte forma <-> bits
// por duas tabelas (0x140079510 e 0x1400795d0) e, ao atualizar um tile, só recalcula os
// bits das direções pedidas na máscara (mask); os demais vêm da forma que já estava lá.
// ===========================================================================

// Forma (0–47) -> bits de borda do piso (0x140079510). A forma 47 (tile isolado da paleta)
// vale 0: o tile recém-pintado começa "sem bordas" nas direções não recalculadas.
export const FLOOR_SHAPE_TO_BITS = [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 25, 27, 29, 31, 35, 39, 43, 47,
    70, 78, 71, 79, 140, 141, 142, 143, 95, 175, 59, 63, 103, 111, 206, 207, 157, 159, 127,
    191, 223, 239, 255, 0
];
// Bits de borda -> forma do piso (0x1400795d0, 256 entradas).
export const FLOOR_BITS_TO_SHAPE = (() => {
    const t = [];
    for (let i = 0; i < 16; i++) { t.push(i); }
    const rest = [
        16, 16, 17, 17, 18, 18, 19, 19, 16, 16, 17, 17, 18, 18, 19, 19, 20, 20, 20, 20, 21, 21, 21, 21,
        22, 22, 22, 22, 23, 23, 23, 23, 34, 34, 34, 34, 35, 35, 35, 35, 34, 34, 34, 34, 35, 35, 35, 35,
        24, 26, 24, 26, 24, 26, 24, 26, 25, 27, 25, 27, 25, 27, 25, 27, 32, 32, 32, 32, 32, 32, 32, 32,
        32, 32, 32, 32, 32, 32, 32, 32, 36, 36, 36, 36, 36, 36, 36, 36, 37, 37, 37, 37, 37, 37, 37, 37,
        42, 42, 42, 42, 42, 42, 42, 42, 42, 42, 42, 42, 42, 42, 42, 42, 28, 29, 30, 31, 28, 29, 30, 31,
        28, 29, 30, 31, 28, 29, 30, 31, 40, 40, 41, 41, 40, 40, 41, 41, 40, 40, 41, 41, 40, 40, 41, 41,
        33, 33, 33, 33, 33, 33, 33, 33, 33, 33, 33, 33, 33, 33, 33, 33, 43, 43, 43, 43, 43, 43, 43, 43,
        43, 43, 43, 43, 43, 43, 43, 43, 38, 39, 38, 39, 38, 39, 38, 39, 38, 39, 38, 39, 38, 39, 38, 39
    ];
    for (const v of rest) { t.push(v); }
    for (const v of [44, 45, 46]) { for (let i = 0; i < 16; i++) { t.push(v); } }
    return t;
})();

// Parede/telhado (0–15): bit 1 esq., 2 cima, 4 dir., 8 baixo (0x140019f50 / 0x140019f10).
export const wallShapeToBits = s => ((s & 1) ? 0x10 : 0) | ((s & 2) ? 0x20 : 0) | ((s & 4) ? 0x40 : 0) | ((s & 8) ? 0x80 : 0);
export const wallBitsToShape = b => ((b & 0x10) ? 1 : 0) | ((b & 0x20) ? 2 : 0) | ((b & 0x40) ? 4 : 0) | ((b & 0x80) ? 8 : 0);
// Cachoeira (0–3): bit 1 esq., 2 dir. (0x140019fb0 / 0x140019f90).
export const waterfallShapeToBits = s => ((s & 1) ? 0x10 : 0) | ((s & 2) ? 0x40 : 0);
export const waterfallBitsToShape = b => ((b & 0x10) ? 1 : 0) | ((b & 0x40) ? 2 : 0);

// Direções: [bit, dx, dy].
const DIRS = [[1, -1, -1], [2, 1, -1], [4, 1, 1], [8, -1, 1], [0x10, -1, 0], [0x20, 0, -1], [0x40, 1, 0], [0x80, 0, 1]];

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
    // Como o editor (0x140013030): fora do mapa devolve −1.
    raw(x, y, z) {
        return this.inside(x, y) ? (this.map.data[this.index(x, y, z)] || 0) : -1;
    }
}

// A1 "água/cachoeira" para a regra de emenda: tipos 0, 1 e 4–15 (não 2 e 3).
const inWaterGroup = id => (id >= TILE_ID_A1 && id < TILE_ID_A1 + 96) || (id >= TILE_ID_A1 + 192 && id < TILE_ID_A2);

// O vizinho o é "diferente" do autotile c? (0x140019e20)
// Fora do mapa (−1) nunca é diferente. Não-autotile é sempre diferente. Entre água A1
// (tipos 0, 1, 4–15) e cachoeira, qualquer cachoeira emenda; no resto compara o tipo.
export function isDifferent(c, o) {
    if (o < 0 || c < TILE_ID_A1) { return false; }
    if (o < TILE_ID_A1) { return true; }
    if (inWaterGroup(c) && inWaterGroup(o) && (isWaterfall(c) || isWaterfall(o))) {
        return false;
    }
    return kindOf(c) !== kindOf(o);
}

// Mesmo tipo (0x140019a30): entre autotiles compara o tipo; senão, o id exato (−1 ≠ tudo).
export const sameKindRaw = (a, b) => (a >= TILE_ID_A1 && b >= TILE_ID_A1) ? kindOf(a) === kindOf(b) : a === b;

// Bits de borda de piso (0x140014b30).
function floorBits(grid, x, y, z, c, mask, oldBits) {
    let bits = oldBits & ~mask;
    for (const [bit, dx, dy] of DIRS) {
        if ((mask & bit) && isDifferent(c, grid.raw(x + dx, y + dy, z))) {
            bits |= bit;
        }
    }
    return bits;
}

// Bits de borda de parede/telhado (0x140014f90). Esquerda/direita são sempre recalculadas:
// a coluna vizinha só emenda se tiver a mesma extensão vertical (mesmo topo e mesma base)
// do mesmo tipo; numa face de parede (A3/A4 tipo >= 8 na linha) também emenda se os mesmos
// 5 pontos da coluna vizinha (linha atual, topo, acima do topo, base, abaixo da base) forem
// quaisquer A3/A4. Cima/baixo: borda se o vizinho for diferente ou estiver fora do mapa.
function wallBits(grid, x, y, z, c, mask, oldBits) {
    let bits = oldBits & ~mask;
    const same = (xx, yy) => sameKindRaw(grid.raw(xx, yy, z), c);
    let top = y;
    while (same(x, top - 1)) { top--; }
    let bottom = y;
    while (same(x, bottom + 1)) { bottom++; }
    const joined = nx => same(nx, y) && same(nx, bottom) && !same(nx, bottom + 1) &&
        same(nx, top) && !same(nx, top - 1);
    let left = joined(x - 1);
    let right = joined(x + 1);
    if (isWallSide(c)) {
        const anyWall = (xx, yy) => isShadowing(grid.raw(xx, yy, z));
        const wide = nx => anyWall(nx, y) && anyWall(nx, bottom) && anyWall(nx, bottom + 1) &&
            anyWall(nx, top) && anyWall(nx, top - 1);
        left = left || wide(x - 1);
        right = right || wide(x + 1);
    }
    bits = left ? bits & ~0x10 : bits | 0x10;
    bits = right ? bits & ~0x40 : bits | 0x40;
    for (const [bit, dy] of [[0x20, -1], [0x80, 1]]) {
        if (mask & bit) {
            const o = grid.raw(x, y + dy, z);
            if (o < 0 || isDifferent(c, o)) {
                bits |= bit;
            }
        }
    }
    return bits;
}

// Bits de borda de cachoeira (inline em 0x1400144d0): só esquerda e direita.
function waterfallBits(grid, x, y, z, c, mask, oldBits) {
    let bits = oldBits & ~mask;
    for (const [bit, dx] of [[0x10, -1], [0x40, 1]]) {
        if ((mask & bit) && isDifferent(c, grid.raw(x + dx, y, z))) {
            bits |= bit;
        }
    }
    return bits & 0x50;
}

// Novo id do autotile em (x,y,z) recalculando só as direções de mask (0x1400144d0).
// mask = 0xff recalcula tudo (o que o MZ faz no tile pintado).
export function updateAutotileId(grid, x, y, z, mask = 0xff) {
    const c = grid.raw(x, y, z);
    if (c < TILE_ID_A1) {
        return c;
    }
    const kind = kindOf(c);
    const shape = shapeOf(c);
    const type = autotileType(c);
    if (type === "waterfall") {
        return makeAutotileId(kind, waterfallBitsToShape(waterfallBits(grid, x, y, z, c, mask, waterfallShapeToBits(shape))));
    }
    if (type === "wall") {
        return makeAutotileId(kind, wallBitsToShape(wallBits(grid, x, y, z, c, mask, wallShapeToBits(shape))));
    }
    return makeAutotileId(kind, FLOOR_BITS_TO_SHAPE[floorBits(grid, x, y, z, c, mask, FLOOR_SHAPE_TO_BITS[shape])]);
}

// Recalcula a forma do autotile em (x,y,z) a partir de todos os vizinhos (máscara 0xff).
export function computeAutotile(grid, x, y, z) {
    const id = grid.get(x, y, z);
    if (!isAutotile(id)) {
        return id;
    }
    return updateAutotileId(grid, x, y, z, 0xff);
}

// Sombra automática (camada 4), recalculada pelo MZ junto com o tile da camada 0 sempre
// que a máscara inclui uma direção do lado esquerdo (mask & 0x19): vale 5 (metade esquerda)
// se o tile da camada 0 é A1, A2 ou A5 e os tiles à esquerda e acima-à-esquerda (camada 0)
// são A3 ou A4; senão 0 (apaga a sombra que estiver lá, inclusive a da caneta).
export function autoShadow(grid, x, y) {
    const c = grid.raw(x, y, 0);
    const ground = (c >= TILE_ID_A5 && c < TILE_ID_A1) || (c >= TILE_ID_A1 && c < TILE_ID_A3);
    if (!ground) {
        return 0;
    }
    return isShadowing(grid.raw(x - 1, y, 0)) && isShadowing(grid.raw(x - 1, y - 1, 0)) ? 5 : 0;
}

// Máscara que o MZ usa para atualizar a célula (x,y) quando o retângulo r ({x, y, w, h})
// mudou (0x140014780): dentro, 0xff; na moldura de 1 tile em volta, só as direções que
// apontam para dentro do retângulo.
export function rectUpdateMask(r, x, y) {
    let m = 0xff;
    if (x === r.x + r.w) { m = 0x19; } else if (x === r.x - 1) { m = 0x46; }
    if (y === r.y + r.h) { m &= 0x23; } else if (y === r.y - 1) { m &= 0x8c; }
    return m;
}

// Uma chamada de 0x1400144d0: autotile da camada z e, na camada 0, a sombra automática.
// set(x, y, z, id) grava.
export function updateCell(grid, x, y, z, mask, set) {
    const id = grid.raw(x, y, z);
    if (id >= TILE_ID_A1) {
        const n = updateAutotileId(grid, x, y, z, mask);
        if (n !== id) { set(x, y, z, n); }
    }
    if (z === 0 && (mask & 0x19)) {
        const s = autoShadow(grid, x, y);
        if (s !== grid.get(x, y, 4)) { set(x, y, 4, s); }
    }
}

// Atualiza autotiles e sombra de um retângulo alterado, como o MZ (0x140014780): percorre o
// retângulo expandido em 1, linha a linha, com a máscara de rectUpdateMask.
export function updateRect(grid, r, z, set) {
    for (let y = r.y - 1; y <= r.y + r.h; y++) {
        for (let x = r.x - 1; x <= r.x + r.w; x++) {
            if (grid.inside(x, y)) {
                updateCell(grid, x, y, z, rectUpdateMask(r, x, y), set);
            }
        }
    }
}
