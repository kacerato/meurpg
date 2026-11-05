#!/usr/bin/env node
// Lista chamadas t("...") cujo texto-fonte não existe na tradução oficial nem em extra.<locale>.json.
// Uso: node tools/i18n-check.mjs [arquivos/pastas...]  (padrão: editor/js)  [--locale=pt_BR]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const locale = (args.find(a => a.startsWith("--locale=")) || "--locale=pt_BR").slice(9);
const targets = args.filter(a => !a.startsWith("--"));
if (!targets.length) targets.push(path.join(root, "editor", "js"));
const known = new Set();
const ctxOf = new Map();
const i18nDir = path.join(root, "editor", "i18n");
const dicts = [locale + ".json", "extra." + locale + ".json", ...fs.readdirSync(i18nDir).filter(n => n.startsWith("_extra_"))];
for (const f of dicts) {
    const p = path.join(i18nDir, f);
    if (!fs.existsSync(p)) continue;
    for (const [c, e] of Object.entries(JSON.parse(fs.readFileSync(p, "utf8")))) for (const s of Object.keys(e)) {
        known.add(s); known.add(s.replace(/&(&?)/g, (m, a) => a ? "&" : ""));
        if (!ctxOf.has(c)) ctxOf.set(c, new Set()); ctxOf.get(c).add(s);
    }
}
const files = [];
const walk = p => { const st = fs.statSync(p); if (st.isDirectory()) for (const n of fs.readdirSync(p)) walk(path.join(p, n)); else if (/\.(js|mjs|html)$/.test(p)) files.push(p); };
targets.forEach(walk);
// t("..."), t('...'), t(`...` sem ${}) ; também data-i18n="..."
const rx = /(?<![\w$.])t\(\s*(?:"((?:[^"\]|\.)*)"|'((?:[^'\]|\.)*)'|`([^`$\]*)`)\s*(?:,\s*"([^"]*)")?|data-i18n(?:-title)?="([^"]*)"/g;
let missing = 0, total = 0, badCtx = 0;
for (const f of files) {
    const src = fs.readFileSync(f, "utf8");
    for (const m of src.matchAll(rx)) {
        const raw = m[1] ?? m[2] ?? m[3] ?? m[5];
        let s; try { s = JSON.parse('"' + raw.replace(/\'/g, "'").replace(/"/g, '\\"').replace(/\\\\"/g, '\\"') + '"'); } catch { s = raw; }
        total++;
        const line = src.slice(0, m.index).split("\n").length;
        if (!known.has(s)) { missing++; console.log(`${path.relative(root, f)}:${line}  ${JSON.stringify(s)}`); }
        else if (m[4] && !(ctxOf.get(m[4])?.has(s))) { badCtx++; console.log(`${path.relative(root, f)}:${line}  contexto ${m[4]} não tem ${JSON.stringify(s)}`); }
    }
}
console.log(`\n${total} chamadas, ${missing} sem tradução, ${badCtx} com contexto errado (${locale})`);
process.exitCode = missing || badCtx ? 1 : 0;
