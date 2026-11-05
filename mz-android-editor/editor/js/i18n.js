// Internacionalização do MZ Editor com a tradução oficial do RPG Maker MZ.
// Dicionários em editor/i18n/<locale>.json, gerados de rea-extract/qrc/translations/*.qm por
// tools/qm2json.mjs: { "<contexto Qt>": { "<texto-fonte em inglês>": "<tradução>" } }.
// Textos exclusivos do port ficam em editor/i18n/extra.<locale>.json, contexto "MZEditor".
// O inglês não tem arquivo: é o próprio texto-fonte.
//
// Uso:  import { t, fmt } from "../i18n.js";
//       t("Database")                       → "Banco de Dados"
//       t("Edit", "StandardPopupMenu")      → procura primeiro nesse contexto
//       t("Delete %1?", "MapEditTreeBox", "MAP001")  → argumentos extras substituem %1, %2…
//
// Este módulo usa top-level await: quem o importa só roda depois do dicionário carregado,
// então constantes de módulo como `const NAMES = [t("Actors"), …]` já saem traduzidas.

const OPTIONS_KEY = "mzEditor.options";
export const DEFAULT_LANGUAGE = "pt_BR";
// Idiomas oferecidos nas Opções (os mesmos .qm do editor original).
export const LANGUAGES = [
    ["pt_BR", "Português (Brasil)"],
    ["en", "English"],
    ["ja_JP", "日本語"],
    ["zh_CN", "简体中文"],
    ["zh_TW", "繁體中文"],
    ["ko_KR", "한국어"],
    ["de_DE", "Deutsch"],
    ["es_ES", "Español"],
    ["fr_FR", "Français"],
    ["it_IT", "Italiano"],
    ["ru_RU", "Русский"],
];
const ALIASES = { ja: "ja_JP", zh: "zh_CN", "pt-BR": "pt_BR", pt: "pt_BR", ko: "ko_KR", de: "de_DE", es: "es_ES", fr: "fr_FR", it: "it_IT", ru: "ru_RU", en_US: "en" };
const HTML_LANG = { pt_BR: "pt-BR", en: "en", ja_JP: "ja", zh_CN: "zh-CN", zh_TW: "zh-TW", ko_KR: "ko", de_DE: "de", es_ES: "es", fr_FR: "fr", it_IT: "it", ru_RU: "ru" };

export function normalizeLanguage(lang) {
    lang = ALIASES[lang] || lang;
    return LANGUAGES.some(([k]) => k === lang) ? lang : DEFAULT_LANGUAGE;
}

function readOptions() {
    try { return JSON.parse(localStorage.getItem(OPTIONS_KEY) || "{}") || {}; } catch { return {}; }
}

let language = normalizeLanguage(new URLSearchParams(location.search).get("lang") || readOptions().lang || readOptions().language || DEFAULT_LANGUAGE);
let byContext = {};          // contexto → { fonte → tradução }
let anyContext = new Map();  // fonte → tradução (primeira encontrada, contexto "MZEditor" tem prioridade)

// Remove aceleradores do Qt: "(&F)" (estilo japonês/chinês) e "&" isolado ("&&" vira "&").
function stripMnemonic(s) {
    return s.replace(/\s*\(&[^)]\)/g, "").replace(/&(&?)/g, (m, a) => a ? "&" : "");
}

async function fetchJson(url) {
    try {
        const r = await fetch(url, { cache: "no-cache" });
        return r.ok ? await r.json() : {};
    } catch { return {}; }
}

function index(dict, priority) {
    for (const [ctx, entries] of Object.entries(dict || {})) {
        const target = (byContext[ctx] ||= {});
        for (const [src, tr] of Object.entries(entries)) {
            if (typeof tr !== "string" || tr === "") { continue; }
            const clean = stripMnemonic(tr);
            target[src] = clean;
            const key = src.includes("&") ? stripMnemonic(src) : src;
            if (key !== src) { target[key] ??= clean; }
            if (priority || !anyContext.has(src)) { anyContext.set(src, clean); }
            if (key !== src && (priority || !anyContext.has(key))) { anyContext.set(key, clean); }
        }
    }
}

async function load(lang) {
    byContext = {};
    anyContext = new Map();
    if (lang === "en") { return; }
    const base = new URL("../i18n/", import.meta.url);
    const [main, extra] = await Promise.all([
        fetchJson(new URL(lang + ".json", base)),
        fetchJson(new URL("extra." + lang + ".json", base)),
    ]);
    index(extra, true);
    index(main, false);
}

function format(s, args) {
    if (!args.length) { return s; }
    return s.replace(/%(\d+)/g, (m, n) => (n - 1 < args.length ? String(args[n - 1]) : m));
}

/** Traduz `source` (texto-fonte em inglês, exatamente como no editor original). */
export function t(source, context, ...args) {
    if (source == null) { return ""; }
    source = String(source);
    let tr = context ? byContext[context]?.[source] : undefined;
    if (tr === undefined) { tr = anyContext.get(source); }
    if (tr === undefined) { tr = source.includes("&") ? stripMnemonic(source) : source; }
    return format(tr, args);
}

/** Substitui %1, %2… num texto já traduzido. */
export function fmt(s, ...args) { return format(String(s), args); }

/** true se existe tradução para `source` no idioma atual (inglês: sempre false). */
export function has(source, context) {
    return context ? !!byContext[context]?.[source] : anyContext.has(source);
}

export function currentLanguage() { return language; }

/** Troca o idioma: grava nas Opções e recarrega a página (os módulos montam a UI uma vez só). */
export function setLanguage(lang, { reload = true } = {}) {
    lang = normalizeLanguage(lang);
    const opts = readOptions();
    if (opts.lang !== lang) {
        opts.lang = lang;
        try { localStorage.setItem(OPTIONS_KEY, JSON.stringify(opts)); } catch { /* sem storage */ }
    }
    if (lang !== language && reload) { location.reload(); }
}

/** Traduz os atributos data-i18n / data-i18n-title do HTML estático (index.html). */
export function translateDom(root = document) {
    for (const n of root.querySelectorAll("[data-i18n]")) { n.textContent = t(n.dataset.i18n, n.dataset.i18nCtx); }
    for (const n of root.querySelectorAll("[data-i18n-title]")) { n.title = t(n.dataset.i18nTitle, n.dataset.i18nCtx); }
}

/** Liga ao evento options:changed do módulo tools: mudou o idioma → recarrega. */
export function bindOptions(api) {
    api.on?.("options:changed", opts => {
        const lang = normalizeLanguage(opts?.lang || opts?.language || DEFAULT_LANGUAGE);
        if (lang !== language) { location.reload(); }
    });
}

await load(language);
document.documentElement.lang = HTML_LANG[language] || "pt-BR";
