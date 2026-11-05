// Parser das anotações de plugin do RPG Maker MZ.
// Lê os blocos de comentário `/*: ... */` (cabeçalho do plugin) e `/*~struct~Nome: ... */`
// (estruturas), escolhendo o bloco do idioma da interface (`:ja`, `:pt`…, depois sem sufixo,
// depois `:en`, depois qualquer um) e preferindo os blocos marcados com `@target MZ`.

import { currentLanguage } from "../i18n.js";

const PLUGIN_TAGS = new Set(["plugindesc", "author", "help", "url", "target"]);
const LIST_TAGS = new Set(["base", "orderAfter", "orderBefore"]);
const ITEM_TAGS = new Set(["text", "desc", "type", "default", "parent", "min", "max",
    "decimals", "on", "off", "dir", "require"]);

// Divide o texto em blocos {kind: "plugin"|"struct", struct, lang, body}.
export function splitBlocks(text) {
    const blocks = [];
    const re = /\/\*(~struct~([A-Za-z0-9_$]+))?:([A-Za-z_-]*)([\s\S]*?)\*\//g;
    let m;
    while ((m = re.exec(text))) {
        blocks.push({
            kind: m[1] ? "struct" : "plugin",
            struct: m[2] || "",
            lang: m[3] || "",
            body: m[4]
        });
    }
    return blocks;
}

// Tokeniza o corpo de um bloco em [{tag, value}] (o valor continua nas linhas seguintes até
// a próxima linha que começa com @).
function tokenize(body) {
    const tokens = [];
    let cur = null;
    for (const raw of body.replace(/\r\n?/g, "\n").split("\n")) {
        const line = /^\s*\*/.test(raw) ? raw.replace(/^\s*\* ?/, "") : raw.replace(/^\s+/, "");
        const m = /^\s*@(\w+)\s?(.*)$/.exec(line);
        if (m) {
            cur = { tag: m[1], lines: [m[2]] };
            tokens.push(cur);
        } else if (cur) {
            cur.lines.push(line);
        }
    }
    return tokens.map(t => {
        const lines = t.lines.slice();
        while (lines.length > 1 && lines[lines.length - 1].trim() === "") {
            lines.pop();
        }
        const value = t.tag === "help" ? lines.join("\n").replace(/\s+$/, "")
            : lines.map(s => s.trimEnd()).join("\n").trim();
        return { tag: t.tag, value };
    });
}

function newItem(name) {
    return {
        name, text: "", desc: "", type: "string", default: "", parent: "",
        min: null, max: null, decimals: 0, on: "", off: "", dir: "", require: false,
        options: []
    };
}

function applyItemTag(item, tag, value) {
    switch (tag) {
        case "type": item.type = value.split(/\s+/)[0] || "string"; break;
        case "min": item.min = value === "" ? null : Number(value); break;
        case "max": item.max = value === "" ? null : Number(value); break;
        case "decimals": item.decimals = Math.max(0, parseInt(value, 10) || 0); break;
        case "require": item.require = value !== "0" && value !== "false"; break;
        case "parent": item.parent = value.split(/\s+/)[0] || ""; break;
        default: item[tag] = value;
    }
}

function applyOption(item, tag, value) {
    if (tag === "option") {
        item.options.push({ text: value, value });
    } else if (tag === "value" && item.options.length) {
        item.options[item.options.length - 1].value = value;
    }
}

// Interpreta um bloco de cabeçalho de plugin.
export function parsePluginBlock(body) {
    const info = {
        target: "", plugindesc: "", author: "", help: "", url: "",
        base: [], orderAfter: [], orderBefore: [],
        params: [], commands: []
    };
    let ctx = null;          // item corrente (param, command ou arg)
    let command = null;
    for (const { tag, value } of tokenize(body)) {
        if (tag === "param") {
            ctx = newItem(value.split(/\s+/)[0]);
            info.params.push(ctx);
            command = null;
        } else if (tag === "command") {
            command = { name: value.split(/\s+/)[0], text: "", desc: "", args: [] };
            info.commands.push(command);
            ctx = command;
        } else if (tag === "arg") {
            if (!command) {
                continue;
            }
            ctx = newItem(value.split(/\s+/)[0]);
            command.args.push(ctx);
        } else if (PLUGIN_TAGS.has(tag)) {
            info[tag] = tag === "target" ? value.split(/\s+/).filter(Boolean).join(" ") : value;
        } else if (LIST_TAGS.has(tag)) {
            info[tag].push(...value.split(/\s+/).filter(Boolean));
        } else if (ctx && (tag === "text" || tag === "desc") && ctx === command) {
            command[tag] = value;
        } else if (ctx && ctx !== command && ITEM_TAGS.has(tag)) {
            applyItemTag(ctx, tag, value);
        } else if (ctx && ctx !== command && (tag === "option" || tag === "value")) {
            applyOption(ctx, tag, value);
        }
    }
    return info;
}

// Interpreta um bloco ~struct~ (só @param).
export function parseStructBlock(body) {
    const params = [];
    let ctx = null;
    for (const { tag, value } of tokenize(body)) {
        if (tag === "param") {
            ctx = newItem(value.split(/\s+/)[0]);
            params.push(ctx);
        } else if (ctx && ITEM_TAGS.has(tag)) {
            applyItemTag(ctx, tag, value);
        } else if (ctx && (tag === "option" || tag === "value")) {
            applyOption(ctx, tag, value);
        }
    }
    return params;
}

function isMZ(block) {
    return /(^|\n)\s*\*?\s*@target\s+[^\n]*\bMZ\b/.test(block.body);
}

// Escolhe, entre blocos do mesmo tipo, o do idioma preferido.
function pickBlock(blocks, langs) {
    const mz = blocks.filter(isMZ);
    const pool = mz.length ? mz : blocks;
    for (const lang of langs) {
        const b = pool.find(x => x.lang === lang);
        if (b) {
            return b;
        }
    }
    return pool[0] || null;
}

// Interpreta o arquivo inteiro de um plugin.
// Devolve {name, found, isMZ, plugindesc, author, help, url, base, orderAfter, orderBefore,
//          params, commands, structs: {Nome: [params]}}.
// Idiomas preferidos pelo idioma da interface, como no MZ: "/*:ja" no editor em japonês etc.;
// o bloco padrão "/*:" (inglês por convenção) vem em seguida.
export function preferredLangs(ui = currentLanguage()) {
    const out = [];
    if (ui && ui !== "en") {
        out.push(ui, ui.split("_")[0]);
    }
    out.push("", "en");
    return [...new Set(out)];
}

export function parsePlugin(text, name = "", langs = preferredLangs()) {
    const blocks = splitBlocks(text || "");
    const pluginBlocks = blocks.filter(b => b.kind === "plugin");
    const head = pickBlock(pluginBlocks, langs);
    const info = head ? parsePluginBlock(head.body) : parsePluginBlock("");
    info.name = name;
    info.found = !!head;
    info.isMZ = head ? isMZ(head) : false;
    info.lang = head ? head.lang : "";
    // Estruturas: para cada nome, o bloco do mesmo idioma do cabeçalho, senão o preferido.
    info.structs = {};
    const byName = new Map();
    for (const b of blocks.filter(x => x.kind === "struct")) {
        const list = byName.get(b.struct) || [];
        list.push(b);
        byName.set(b.struct, list);
    }
    const structLangs = head ? [head.lang, ...langs] : langs;
    for (const [sname, list] of byName) {
        let chosen = null;
        for (const lang of structLangs) {
            chosen = list.find(x => x.lang === lang);
            if (chosen) {
                break;
            }
        }
        info.structs[sname] = parseStructBlock((chosen || list[0]).body);
    }
    return info;
}

// --- Tipos -------------------------------------------------------------------------------

export const DATABASE_TYPES = {
    actor: "data/Actors.json",
    class: "data/Classes.json",
    skill: "data/Skills.json",
    item: "data/Items.json",
    weapon: "data/Weapons.json",
    armor: "data/Armors.json",
    enemy: "data/Enemies.json",
    troop: "data/Troops.json",
    state: "data/States.json",
    animation: "data/Animations.json",
    tileset: "data/Tilesets.json",
    common_event: "data/CommonEvents.json"
};

// Normaliza o texto do @type. Devolve {kind, base, struct, element}.
// kind: "array" | "struct" | tipo simples (string, number, boolean, select, ...).
export function typeInfo(type) {
    const t = String(type || "string").trim();
    if (t.endsWith("[]")) {
        return { kind: "array", element: t.slice(0, -2), raw: t };
    }
    const sm = /^struct<\s*([^>]+?)\s*>$/i.exec(t);
    if (sm) {
        return { kind: "struct", struct: sm[1], raw: t };
    }
    const lower = t.toLowerCase();
    const known = ["string", "multiline_string", "note", "number", "boolean", "select", "combo",
        "file", "switch", "variable", "color", "icon", ...Object.keys(DATABASE_TYPES)];
    return { kind: known.includes(lower) ? lower : "string", raw: t };
}

// Valor inicial (string) de um parâmetro, como o MZ grava ao adicionar o plugin.
export function defaultValue(def) {
    return def.default == null ? "" : String(def.default);
}

// Objeto {nome: valor} com os padrões de uma lista de definições, na ordem de declaração.
export function defaultsOf(defs) {
    const out = {};
    for (const d of defs) {
        out[d.name] = defaultValue(d);
    }
    return out;
}
