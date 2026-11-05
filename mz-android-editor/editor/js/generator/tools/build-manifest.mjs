// Gera editor/generator/manifest.json a partir dos arquivos de editor/generator/.
// O navegador não lista pastas estáticas; o MZ faz isso em C++ (CoreAPI.searchFiles).
// Uso: node editor/js/generator/tools/build-manifest.mjs
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../../generator");
const out = {};
for (const type of ["Face", "TV", "TVD", "SV", "Variation"]) {
    for (const gender of ["Male", "Female", "Kid"]) {
        const dir = path.join(root, type, gender);
        if (!fs.existsSync(dir)) {
            continue;
        }
        const files = fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith(".png")).sort();
        (out[gender.toLowerCase()] ??= {})[type.toLowerCase()] = files;
    }
}
fs.writeFileSync(path.join(root, "manifest.json"), JSON.stringify(out));
console.log("manifest.json:", Object.values(out).flatMap(g => Object.values(g)).reduce((s, l) => s + l.length, 0), "arquivos");
