// Confere o algoritmo de autotile/sombra contra mapas feitos no editor oficial.
// Uso (Node 18+): node editor/js/maptools/test-autotile.mjs <pasta com MapXXX.json>
// Ex.: node editor/js/maptools/test-autotile.mjs "../RPG/samplemaps"
// Para cada autotile das camadas 0–3 recalcula a forma a partir dos vizinhos e compara
// com a gravada. Os mapas oficiais têm ajustes manuais (Shift), então 100% não é esperado.

import fs from "node:fs";
import path from "node:path";
import * as A from "./autotile.js";

const dir = process.argv[2];
if (!dir) {
    console.error("informe a pasta dos mapas");
    process.exit(1);
}
const stats = {};
let total = 0, bad = 0, shTotal = 0, shBad = 0;
for (const f of fs.readdirSync(dir).filter(n => /^Map\d+\.json$/.test(n))) {
    const map = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    const g = new A.MapGrid(map);
    for (let z = 0; z < 4; z++) {
        for (let y = 0; y < map.height; y++) {
            for (let x = 0; x < map.width; x++) {
                const id = g.get(x, y, z);
                if (!A.isAutotile(id)) { continue; }
                const sheet = A.isA1(id) ? "A1" : A.isA2(id) ? "A2" : A.isA3(id) ? "A3" : "A4";
                const key = `${A.autotileType(id)} ${sheet} camada ${z}`;
                const s = stats[key] || (stats[key] = [0, 0]);
                s[0]++; total++;
                if (A.computeAutotile(g, x, y, z) !== id) { s[1]++; bad++; }
            }
        }
    }
    for (let y = 0; y < map.height; y++) {
        for (let x = 0; x < map.width; x++) {
            const s = g.get(x, y, 4) & 15;
            const p = A.autoShadow(g, x, y);
            if (s === 5 || p) { shTotal++; if (s !== p) { shBad++; } }
        }
    }
}
for (const [k, [t, b]] of Object.entries(stats).sort()) {
    console.log(`${k.padEnd(26)} ${String(t).padStart(7)}  iguais ${(100 * (t - b) / t).toFixed(1)}%`);
}
console.log(`total ${total}, iguais ${(100 * (total - bad) / total).toFixed(1)}%`);
console.log(`sombra automática (5): ${shTotal} casos, iguais ${(100 * (shTotal - shBad) / Math.max(1, shTotal)).toFixed(1)}%`);
