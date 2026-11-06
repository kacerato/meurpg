// Confere o algoritmo de autotile/sombra contra mapas feitos no editor oficial.
// Uso (Node 18+): node editor/js/maptools/test-autotile.mjs <pasta com MapXXX.json> [-v]
// Ex.: node editor/js/maptools/test-autotile.mjs "../RPG/samplemaps"
//
// 1. Simulação: pinta centenas de retângulos aleatórios num mapa pelo MapEdit (editops.js)
//    e confere que piso/cachoeira/sombra ficam iguais ao recálculo completo — propriedade
//    do algoritmo do MZ (sem Shift, cada bit de borda é refeito sempre que o vizinho daquela
//    direção muda). Precisa dar 100%.
// 2. Mapas oficiais: recalcula cada autotile das camadas 0–3 com todas as direções e
//    compara com o gravado; os restos são classificados (ver NOTES.md):
//    - "borda fora do mapa": a forma gravada tem borda virada para fora do mapa, o que o
//      MZ nunca produz (fora conta como igual) — mapa redimensionado/deslocado ou Shift;
//    - piso/cachoeira, demais: só Shift (pintura sem autotile) explica;
//    - parede, só esquerda/direita: pode ser Shift ou coluna vizinha que mudou de altura
//      depois (o MZ não atualiza a coluna inteira);
//    - parede, cima/baixo: Shift.
//    Sombra: o MZ grava 0 ou 5; outros valores são da caneta de sombra.

import fs from "node:fs";
import path from "node:path";
import * as A from "./autotile.js";
import { MapEdit } from "./editops.js";

const dir = process.argv[2];
const verbose = process.argv.includes("-v");
if (!dir) {
    console.error("informe a pasta dos mapas");
    process.exit(1);
}

// ---------- 1. simulação ----------
function simulate() {
    const W = 40, H = 30;
    const map = { width: W, height: H, data: new Array(W * H * 6).fill(0) };
    const ed = new MapEdit(1, map, { mode: 1 });
    const pal = [
        A.makeAutotileId(16, 47), A.makeAutotileId(18, 47), A.makeAutotileId(0, 47), A.makeAutotileId(1, 47),
        A.makeAutotileId(4, 47), A.makeAutotileId(5, 3), A.makeAutotileId(7, 3), A.makeAutotileId(56, 15),
        A.makeAutotileId(48, 15), A.makeAutotileId(80, 47), A.makeAutotileId(88, 15), A.makeAutotileId(81, 47), 1540, 1600
    ];
    let seed = 12345;
    const rnd = n => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
    ed.begin("base");
    for (let y = 0; y < H; y++) { for (let x = 0; x < W; x++) { ed.placeTile(x, y, pal[0], -1); } }
    ed.fixup(true);
    ed.commit();
    for (let i = 0; i < 1500; i++) {
        const id = pal[rnd(pal.length)];
        const x0 = rnd(W) - 1, y0 = rnd(H) - 1, w = 1 + rnd(5), h = 1 + rnd(5);
        ed.begin("p");
        if (rnd(4) === 0) {
            ed.fillRect({ kind: "palette", w: 1, h: 1, cells: [id] }, x0, y0, x0 + w, y0 + h, -1, false, true);
        } else {
            for (let y = y0; y < y0 + h; y++) { for (let x = x0; x < x0 + w; x++) { ed.placeTile(x, y, id, -1); } }
        }
        ed.fixup(true);
        ed.commit();
    }
    const g = new A.MapGrid(map);
    let t = 0, bad = 0, sh = 0;
    for (let z = 0; z < 2; z++) {
        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                const id = g.get(x, y, z);
                if (A.isAutotile(id) && A.autotileType(id) !== "wall") {
                    t++;
                    if (A.computeAutotile(g, x, y, z) !== id) { bad++; }
                }
                if (z === 0 && A.autoShadow(g, x, y) !== g.get(x, y, 4)) { sh++; }
            }
        }
    }
    console.log(`simulação (MapEdit, 1500 traços): piso/cachoeira ${t - bad}/${t} iguais ao recálculo, sombra diferente em ${sh}`);
    return bad === 0 && sh === 0;
}
const simOk = simulate();

// ---------- 2. mapas oficiais ----------
const stats = {};
const cls = {};
const perMap = [];
let total = 0, bad = 0;
const sh = { auto5: 0, same5: 0, pen: 0, extra5: 0, missing5: 0, same0: 0 };

function classify(g, x, y, z, id, n) {
    const type = A.autotileType(id);
    const sb = bitsOf(type, A.shapeOf(id));
    const cb = bitsOf(type, A.shapeOf(n));
    const diff = sb ^ cb;
    const DIRS = [[1, -1, -1], [2, 1, -1], [4, 1, 1], [8, -1, 1], [0x10, -1, 0], [0x20, 0, -1], [0x40, 1, 0], [0x80, 0, 1]];
    for (const [bit, dx, dy] of DIRS) {
        if ((sb & bit) && !(cb & bit) && !g.inside(x + dx, y + dy) && type !== "wall") {
            return "borda fora do mapa (redimensionado/deslocado ou Shift)";
        }
    }
    if (type === "wall") {
        return (diff & 0xa0) ? "parede: cima/baixo (Shift)" : "parede: só esq./dir. (Shift ou coluna vizinha alterada depois)";
    }
    return `${type}: Shift`;
}
function bitsOf(type, shape) {
    if (type === "wall") { return A.wallShapeToBits(shape); }
    if (type === "waterfall") { return A.waterfallShapeToBits(shape); }
    return A.FLOOR_SHAPE_TO_BITS[shape];
}

for (const f of fs.readdirSync(dir).filter(n => /^Map\d+\.json$/.test(n)).sort()) {
    const map = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    const g = new A.MapGrid(map);
    let mt = 0, mb = 0;
    for (let z = 0; z < 4; z++) {
        for (let y = 0; y < map.height; y++) {
            for (let x = 0; x < map.width; x++) {
                const id = g.get(x, y, z);
                if (!A.isAutotile(id)) { continue; }
                const sheet = A.isA1(id) ? "A1" : A.isA2(id) ? "A2" : A.isA3(id) ? "A3" : "A4";
                const key = `${A.autotileType(id)} ${sheet} camada ${z}`;
                const s = stats[key] || (stats[key] = [0, 0]);
                s[0]++; total++; mt++;
                const n = A.computeAutotile(g, x, y, z);
                if (n !== id) {
                    s[1]++; bad++; mb++;
                    const c = classify(g, x, y, z, id, n);
                    cls[c] = (cls[c] || 0) + 1;
                }
            }
        }
    }
    perMap.push([f, mt, mb]);
    for (let y = 0; y < map.height; y++) {
        for (let x = 0; x < map.width; x++) {
            const s = g.get(x, y, 4) & 15;
            const p = A.autoShadow(g, x, y);
            if (p === 5) { sh.auto5++; }
            if (s !== 0 && s !== 5) { sh.pen++; continue; }
            if (s === p) { if (s === 5) { sh.same5++; } continue; }
            if (s === 5) { sh.extra5++; } else { sh.missing5++; }
        }
    }
}
for (const [k, [t, b]] of Object.entries(stats).sort()) {
    console.log(`${k.padEnd(26)} ${String(t).padStart(7)}  iguais ${(100 * (t - b) / t).toFixed(1)}%`);
}
console.log(`total ${total}, iguais ${(100 * (total - bad) / total).toFixed(1)}%`);
console.log("diferenças por causa provável:");
for (const [k, v] of Object.entries(cls).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(v).padStart(6)}  ${k}`);
}
console.log(`sombra automática: o algoritmo dá 5 em ${sh.auto5} tiles; gravado igual em ${sh.same5} ` +
    `(${(100 * sh.same5 / Math.max(1, sh.auto5)).toFixed(1)}%); gravado 0 onde daria 5: ${sh.missing5} (Shift/caneta); ` +
    `gravado 5 onde daria 0: ${sh.extra5} (caneta); outros valores da caneta: ${sh.pen}`);
const clean = perMap.filter(p => p[2] === 0).length;
console.log(`mapas sem nenhuma diferença: ${clean} de ${perMap.length}`);
if (verbose) {
    perMap.sort((a, b) => b[2] - a[2]);
    for (const [f, t, b] of perMap.slice(0, 20)) { console.log(`  ${f} ${b}/${t}`); }
}
if (!simOk) {
    console.error("FALHA: a simulação de pintura não bateu com o recálculo completo");
    process.exit(1);
}
