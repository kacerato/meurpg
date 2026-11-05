#!/usr/bin/env node
// Converte arquivos Qt .qm (traduções oficiais do RPG Maker MZ) em JSON para o MZ Editor.
// Uso: node tools/qm2json.mjs [pastaComQm] [pastaDeSaida]
// Saída: <saida>/<locale>.json no formato { "<contexto>": { "<texto-fonte>": "<tradução>" } }.
// Formato .qm (Qt qtranslator.cpp): magic de 16 bytes, depois blocos [tag u8][len u32be][dados].
//   0x2f Contexts, 0x42 Hashes, 0x69 Messages, 0x88 NumerusRules, 0x96 Dependencies, 0xa7 Language.
// Dentro de Messages, cada mensagem é uma sequência de subtags até Tag_End:
//   1 End, 2 SourceText16 (obsoleto), 3 Translation (u32 len + UTF-16BE; 0xffffffff = nula),
//   4 Context16 (obsoleto), 5 Obsolete1 (u32 hash), 6 SourceText (u32 len + bytes UTF-8),
//   7 Context (u32 len + UTF-8), 8 Comment (u32 len + UTF-8), 9 Obsolete2 (sem dados).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_IN = "C:/Users/jamaa/Downloads/RPG AUTORIZADO PRO LUCAS/rea-extract/qrc/translations";
const inDir = process.argv[2] || DEFAULT_IN;
const outDir = process.argv[3] || path.join(here, "..", "editor", "i18n");
const MAGIC = Buffer.from("3cb86418caef9c95cd211cbf60a1bddd", "hex");

function utf16be(buf) {
    const sw = Buffer.alloc(buf.length);
    for (let i = 0; i + 1 < buf.length; i += 2) { sw[i] = buf[i + 1]; sw[i + 1] = buf[i]; }
    return sw.toString("utf16le");
}

export function parseQm(buf) {
    if (buf.length < 16 || !buf.subarray(0, 16).equals(MAGIC)) throw new Error("magic .qm inválido");
    let p = 16, messages = null, language = "";
    while (p + 5 <= buf.length) {
        const tag = buf[p], len = buf.readUInt32BE(p + 1);
        const data = buf.subarray(p + 5, p + 5 + len);
        if (tag === 0x69) messages = data;
        else if (tag === 0xa7) language = data.toString("utf8");
        p += 5 + len;
    }
    if (!messages) throw new Error("bloco Messages ausente");
    const out = [];
    let q = 0;
    while (q < messages.length) {
        const m = { context: "", source: "", comment: "", translations: [] };
        for (;;) {
            const t = messages[q++];
            if (t === undefined || t === 1) break;
            if (t === 5) { q += 4; continue; }
            if (t === 9) continue;
            const len = messages.readUInt32BE(q); q += 4;
            if (len === 0xffffffff) { if (t === 3) m.translations.push(null); continue; }
            const d = messages.subarray(q, q + len); q += len;
            if (t === 3) m.translations.push(utf16be(d));
            else if (t === 6) m.source = d.toString("utf8");
            else if (t === 7) m.context = d.toString("utf8");
            else if (t === 8) m.comment = d.toString("utf8");
            else if (t === 2) m.source = utf16be(d);
            else if (t === 4) m.context = utf16be(d);
            else throw new Error("subtag desconhecida " + t + " em " + (q - 5));
        }
        out.push(m);
    }
    return { language, messages: out };
}

function main() {
    fs.mkdirSync(outDir, { recursive: true });
    const files = fs.readdirSync(inDir).filter(f => f.toLowerCase().endsWith(".qm")).sort();
    for (const f of files) {
        const locale = f.replace(/\.qm$/i, "");
        const { messages } = parseQm(fs.readFileSync(path.join(inDir, f)));
        const dict = {};
        let n = 0;
        for (const m of messages) {
            const tr = m.translations.find(x => x != null && x !== "");
            if (!m.source || tr == null) continue;
            const ctx = (dict[m.context] ||= {});
            // Mesmo texto com comentários diferentes: fica a primeira tradução.
            if (!(m.source in ctx)) { ctx[m.source] = tr; n++; }
        }
        const sorted = {};
        for (const c of Object.keys(dict).sort()) {
            sorted[c] = {};
            for (const s of Object.keys(dict[c]).sort()) sorted[c][s] = dict[c][s];
        }
        fs.writeFileSync(path.join(outDir, locale + ".json"), JSON.stringify(sorted, null, 1) + "\n");
        console.log(`${locale}: ${n} textos em ${Object.keys(sorted).length} contextos`);
    }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
