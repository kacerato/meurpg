// "Exclude unused files": decide quais arquivos de img/, audio/ e effects/ o jogo usa.
//
// Como o MZ, a decisão parte das referências por nome nos dados do jogo:
//  - todas as strings de data/*.json (atores, mapas, eventos, eventos comuns, animações,
//    tilesets, System.json ...), incluindo JSON aninhado em strings (parâmetros de plugin)
//    e literais entre aspas dentro de scripts (comandos 355/655, fórmulas);
//  - valores de tags <tag:valor> nas notas (convenção de @noteParam/@noteDir);
//  - parâmetros dos plugins ATIVOS em js/plugins.js;
//  - anotações @requiredAssets dos plugins ativos (caminhos mantidos como estão);
//  - parâmetros "@type file" com "@require 1" dos plugins ativos (<@dir>/<valor>, como o MZ);
//  - "@noteParam"/"@noteDir" (+ @noteType file, @noteData, @noteRequire) dos plugins ativos:
//    <noteParam:valor> nas notas dos dados indicados mantém <noteDir>/<valor>;
//  - literais de string do runtime (js/rmmz_*.js) e dos plugins ativos: cobre os nomes fixos
//    no código, como fundos de batalha automáticos ("Grassland", "Ship"...), "IconSet" etc.;
//  - para efeitos .efkefc usados, as texturas/modelos que o arquivo referencia (UTF-16).
// img/system/ é sempre mantido. Pastas fora de img/audio/effects nunca são excluídas.
// Erra para o lado de MANTER: um nome citado em qualquer lugar mantém o arquivo.

import { t } from "../i18n.js";


const QUOTED = /(["'`])((?:\\.|(?!\1)[^\\\n]){1,200})\1/g;
const NOTE_TAG = /<([^<>:\n]+):([^<>\n]+)>/g;

function addString(set, s) {
    if (typeof s !== "string" || !s) {
        return;
    }
    const t = s.trim();
    set.add(t);
    set.add(t.replace(/\\/g, "/"));
    if ((t.startsWith("{") || t.startsWith("[") || t.startsWith("\"")) && t.length < 2_000_000) {
        try {
            addValue(set, JSON.parse(t));
        } catch (_) { /* não é JSON */ }
    }
    if (t.includes("<")) {
        for (const m of t.matchAll(NOTE_TAG)) {
            for (const v of m[2].split(",")) {
                set.add(v.trim());
            }
        }
    }
    if (/["'`]/.test(t)) {
        for (const m of t.matchAll(QUOTED)) {
            set.add(m[2].trim());
        }
    }
    if (t.includes("\n")) {
        for (const line of t.split("\n")) {
            set.add(line.trim());
        }
    }
}

function addValue(set, v) {
    if (typeof v === "string") {
        addString(set, v);
    } else if (Array.isArray(v)) {
        for (const x of v) {
            addValue(set, x);
        }
    } else if (v && typeof v === "object") {
        for (const x of Object.values(v)) {
            addValue(set, x);
        }
    }
}

function addSourceLiterals(set, src) {
    for (const m of src.matchAll(QUOTED)) {
        set.add(m[2].trim());
    }
}

export function parsePluginsJs(text) {
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");
    if (start < 0 || end < start) {
        return [];
    }
    try {
        return JSON.parse(text.slice(start, end + 1));
    } catch (_) {
        return [];
    }
}

// Texturas/modelos citados num .efkefc (caminhos relativos ao arquivo, em UTF-16LE).
export function efkefcResources(bytes) {
    const text = new TextDecoder("utf-16le").decode(bytes.length % 2 ? bytes.subarray(0, bytes.length - 1) : bytes);
    const out = new Set();
    for (const m of text.matchAll(/[A-Za-z0-9_\-./ ()]+\.(?:png|jpe?g|dds|tga|efkmodel|efkmat|efkmatd|mqo)/gi)) {
        out.add(m[0].replace(/^[./]+/, ""));
    }
    return out;
}

const stripExt = p => p.replace(/\.[^./]+$/, "");

// Lê do cabeçalho de um plugin os parâmetros de arquivo (@param/@type file/@dir/@require/@default)
// e as anotações de nota (@noteParam/@noteDir/@noteType/@noteData/@noteRequire).
export function pluginAssetSpecs(code) {
    const params = new Map();
    const notes = [];
    let curP = null;
    let curN = null;
    const yes = v => v === "1" || v.toLowerCase() === "true";
    for (const line of code.split(/\r?\n/)) {
        const m = /^\s*\*?\s*@(\w+)\s*(.*?)\s*$/.exec(line);
        if (!m) {
            continue;
        }
        const [, tag, val] = m;
        if (tag === "param") {
            curN = null;
            curP = params.get(val) || { name: val, type: "", dir: "", require: false, def: "" };
            params.set(val, curP);
        } else if (tag === "command" || tag === "arg" || tag === "help" || tag === "plugindesc") {
            curP = null;
            curN = null;
        } else if (tag === "noteParam") {
            curP = null;
            curN = { name: val, dir: "", type: "", data: "", require: false };
            notes.push(curN);
        } else if (curN && tag === "noteDir") { curN.dir = val; }
        else if (curN && tag === "noteType") { curN.type = val; }
        else if (curN && tag === "noteData") { curN.data = val; }
        else if (curN && tag === "noteRequire") { curN.require = yes(val); }
        else if (curP && tag === "type") { curP.type = val; }
        else if (curP && tag === "dir") { curP.dir = val; }
        else if (curP && tag === "require") { curP.require = yes(val); }
        else if (curP && tag === "default") { curP.def = val; }
    }
    return { params: [...params.values()], notes };
}

const joinDir = (dir, name) => (dir.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "") + "/" + String(name).replace(/^\/+/, "")).replace(/^\/+/, "");

// @noteData → arquivos de data/ cujas notas valem ("maps" = mapas, "events" = eventos dos mapas).
const NOTE_DATA = {
    actors: ["Actors"], classes: ["Classes"], skills: ["Skills"], items: ["Items"], weapons: ["Weapons"],
    armors: ["Armors"], enemies: ["Enemies"], states: ["States"], tilesets: ["Tilesets"]
};

function collectNotes(value, out) {
    if (Array.isArray(value)) {
        for (const v of value) { collectNotes(v, out); }
    } else if (value && typeof value === "object") {
        if (typeof value.note === "string") { out.push(value.note); }
        if (Array.isArray(value.events)) { collectNotes(value.events, out); }
    }
}

// files: caminhos relativos do projeto. readText/readBytes: leitores do projeto.
// Devolve { keep: Set<caminho>, removed: [caminhos] }.
export async function findUsedFiles(files, { readText, readBytes, log }) {
    const refs = new Set();
    const required = new Set();
    // 1) dados
    const dataFiles = files.filter(f => f.startsWith("data/") && f.toLowerCase().endsWith(".json"));
    const parsed = new Map();
    for (const f of dataFiles) {
        try {
            const v = JSON.parse(await readText(f));
            parsed.set(f, v);
            addValue(refs, v);
        } catch (e) {
            log(t("warning: could not read %1: %2", null, f, e.message));
        }
    }
    // 2) plugins ativos
    let plugins = [];
    if (files.includes("js/plugins.js")) {
        plugins = parsePluginsJs(await readText("js/plugins.js")).filter(p => p && p.status);
    }
    for (const p of plugins) {
        addValue(refs, p.parameters || {});
        const src = `js/plugins/${p.name}.js`;
        if (!files.includes(src)) {
            continue;
        }
        const code = await readText(src);
        for (const m of code.matchAll(/@requiredAssets\s+(\S+)/g)) {
            required.add(m[1].replace(/^\/+/, ""));
        }
        const specs = pluginAssetSpecs(code);
        for (const prm of specs.params) {
            if (prm.type !== "file" || !prm.require || !prm.dir) {
                continue;
            }
            const params = p.parameters || {};
            const v = Object.prototype.hasOwnProperty.call(params, prm.name) ? params[prm.name] : prm.def;
            if (v) {
                required.add(joinDir(prm.dir, v));
            }
        }
        for (const n of specs.notes) {
            if (!n.name || !n.dir || (n.type && n.type !== "file")) {
                continue;
            }
            const kinds = n.data ? n.data.split(/[,\s]+/).filter(Boolean) : null;
            const targets = dataFiles.filter(f => {
                const base = f.slice(5, -5);
                if (!kinds) { return true; }
                return kinds.some(k => (NOTE_DATA[k.toLowerCase()] || []).includes(base)
                    || ((k === "maps" || k === "events") && /^Map\d+$/.test(base)));
            });
            const tag = new RegExp("<" + n.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*:\\s*([^<>\\n]+?)\\s*>", "g");
            for (const f of targets) {
                const notes = [];
                collectNotes(parsed.get(f), notes);
                for (const note of notes) {
                    for (const m of note.matchAll(tag)) {
                        required.add(joinDir(n.dir, m[1]));
                    }
                }
            }
        }
        addSourceLiterals(refs, code);
    }
    // 3) runtime (nomes fixos no código)
    for (const f of files) {
        if (/^js\/rmmz_[a-z]+\.js$/.test(f)) {
            addSourceLiterals(refs, await readText(f));
        }
    }
    log(t("%1 referenced names (data, %2 active plugin(s), runtime)", null, refs.size, plugins.length));

    const isReferenced = f => {
        const noExt = stripExt(f);
        const parts = noExt.split("/");
        // img/pictures/sub/Foo -> "Foo", "sub/Foo", "pictures/sub/Foo", "img/pictures/sub/Foo"
        for (let i = 0; i < parts.length; i++) {
            if (refs.has(parts.slice(i).join("/"))) {
                return true;
            }
        }
        return refs.has(f) || required.has(f) || required.has(noExt);
    };

    const keep = new Set();
    const removed = [];
    const effectRes = new Set();
    let effectsUnknown = false;
    for (const f of files) {
        const low = f.toLowerCase();
        if (low.startsWith("img/system/")) {
            keep.add(f);
        } else if (low.startsWith("img/") || low.startsWith("audio/")) {
            (isReferenced(f) ? keep.add(f) : removed.push(f));
        } else if (low.startsWith("effects/") && low.endsWith(".efkefc")) {
            if (isReferenced(f)) {
                keep.add(f);
                try {
                    const res = efkefcResources(await readBytes(f));
                    if (!res.size) {
                        effectsUnknown = true;
                    }
                    const dir = f.slice(0, f.lastIndexOf("/") + 1);
                    for (const r of res) {
                        effectRes.add((dir + r).toLowerCase());
                    }
                } catch (_) {
                    effectsUnknown = true;
                }
            } else {
                removed.push(f);
            }
        } else if (!low.startsWith("effects/")) {
            keep.add(f);
        }
    }
    // recursos dos efeitos (texturas, modelos)
    for (const f of files) {
        const low = f.toLowerCase();
        if (low.startsWith("effects/") && !low.endsWith(".efkefc")) {
            (effectsUnknown || effectRes.has(low) || isReferenced(f) ? keep.add(f) : removed.push(f));
        }
    }
    return { keep, removed };
}
