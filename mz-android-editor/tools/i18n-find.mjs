#!/usr/bin/env node
// Procura textos na tradução oficial. Uso:
//   node tools/i18n-find.mjs <regex> [locale=pt_BR]   (casa contra texto-fonte E tradução, sem diferenciar maiúsculas)
// Saída: contexto | texto-fonte | tradução
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "editor", "i18n");
const [re, locale = "pt_BR"] = process.argv.slice(2);
if (!re) { console.error("uso: node tools/i18n-find.mjs <regex> [locale]"); process.exit(1); }
const rx = new RegExp(re, "i");
for (const f of [locale + ".json", "extra." + locale + ".json"]) {
    const p = path.join(dir, f);
    if (!fs.existsSync(p)) continue;
    const d = JSON.parse(fs.readFileSync(p, "utf8"));
    for (const [c, e] of Object.entries(d)) for (const [s, tr] of Object.entries(e))
        if (rx.test(s) || rx.test(tr)) console.log(`${c} | ${JSON.stringify(s)} | ${JSON.stringify(tr)}`);
}
