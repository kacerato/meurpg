// Tabela de parâmetros (árvore por @parent) e editores de valor por @type, como no MZ.
// Todos os valores são strings; struct e arrays são JSON string (arrays de strings, e
// elementos struct também como JSON string, igual ao editor original).

import { typeInfo, defaultsOf, DATABASE_TYPES } from "./parser.js";
import { el, promptDialog, touchList } from "./ui.js";
import { pickDatabase, pickFile, pickColor, pickIcon, pickAnimation } from "./pickers.js";
import { t } from "../i18n.js";

const label = def => def.text || def.name;

function parseJson(v, fallback) {
    try {
        return JSON.parse(v);
    } catch {
        return fallback;
    }
}

// Nomes do banco/switches/variáveis para a coluna Valor (carregados uma vez por sessão do diálogo).
const nameCache = new Map();
function lookupName(api, kind, id, onLoaded) {
    if (!api || !api.project) {
        return undefined;
    }
    let entry = nameCache.get(kind);
    if (!entry) {
        const file = kind === "switch" || kind === "variable" ? "data/System.json" : DATABASE_TYPES[kind];
        entry = { names: null, waiting: new Set() };
        nameCache.set(kind, entry);
        api.project.readJson(file, { fresh: true }).then(data => {
            entry.names = kind === "switch" ? data.switches || [] : kind === "variable" ? data.variables || []
                : (data || []).map(d => (d ? d.name || "" : ""));
        }).catch(() => { entry.names = []; }).finally(() => {
            setTimeout(() => nameCache.delete(kind), 2000);
            entry.waiting.forEach(fn => fn());
            entry.waiting.clear();
        });
    }
    if (!entry.names) {
        if (onLoaded) { entry.waiting.add(onLoaded); }
        return undefined;
    }
    return entry.names[id];
}

// Texto exibido na coluna Valor, numa linha. Como no MZ, select mostra o texto da @option,
// boolean o @on/@off, e tipos do banco "0001 Nome"; o que não casar aparece cru (ex.: \V[5]).
// lookup(kind, id) → nome (opcional; sem ele, ids aparecem como número).
export function displayValue(def, value, lookup) {
    const v = value == null ? "" : String(value);
    const ti = typeInfo(def.type);
    if (ti.kind === "select") {
        const o = (def.options || []).find(x => x.value === v);
        if (o) { return o.text; }
    } else if (ti.kind === "boolean") {
        if (v === "true") { return def.on || t("ON", "Constants"); }
        if (v === "false") { return def.off || t("OFF", "Constants"); }
    } else if ((DATABASE_TYPES[ti.kind] || ti.kind === "switch" || ti.kind === "variable") && /^\d+$/.test(v)) {
        const id = Number(v);
        if (id === 0) { return "(" + t("None", "Constants") + ")"; }
        const name = lookup ? lookup(ti.kind, id) : undefined;
        return name === undefined ? v : `${String(id).padStart(4, "0")} ${name}`;
    }
    return v.replace(/\r?\n/g, " ↵ ");
}

// --- Tabela -----------------------------------------------------------------------------

// Monta a árvore {def, children} a partir de @parent (pai inexistente = raiz).
function buildTree(defs) {
    const nodes = defs.map(def => ({ def, children: [] }));
    const byName = new Map(nodes.map(n => [n.def.name, n]));
    const inCycle = name => {
        const seen = new Set();
        let q = name;
        while (q && byName.has(q)) {
            if (seen.has(q)) {
                return true;
            }
            seen.add(q);
            q = byName.get(q).def.parent;
        }
        return false;
    };
    const roots = [];
    for (const n of nodes) {
        const p = n.def.parent;
        if (p && byName.has(p) && byName.get(p) !== n && !inCycle(n.def.name)) {
            byName.get(p).children.push(n);
        } else {
            roots.push(n);
        }
    }
    return roots;
}

// Tabela de parâmetros: colunas Nome / Valor. Tocar seleciona (mostra @desc);
// tocar no selecionado abre o editor do tipo.
export class ParamTable {
    constructor(api, { defs, values, structs, onChange, onSelect }) {
        this.api = api;
        this.defs = defs;
        this.values = values;
        this.structs = structs || {};
        this.onChange = onChange;
        this.onSelect = onSelect;
        this.collapsed = new Set();
        this.selected = null;
        this.root = el("div", { class: "pgTable" });
        let pending = false;
        this.lookup = (kind, id) => lookupName(api, kind, id, () => {
            if (!pending) { pending = true; requestAnimationFrame(() => { pending = false; this.render(); }); }
        });
        this.render();
    }

    setData(defs, values, structs) {
        this.defs = defs;
        this.values = values;
        this.structs = structs || {};
        this.selected = null;
        this.render();
    }

    render() {
        const r = this.root;
        r.textContent = "";
        r.appendChild(el("div", { class: "pgTHead" },
            el("span", { class: "pgCName", text: t("Name", "Constants") }),
            el("span", { class: "pgCValue", text: t("Value", "PluginSettingBox") })));
        const body = el("div", { class: "pgTBody" });
        r.appendChild(body);
        if (!this.defs.length) {
            body.appendChild(el("div", { class: "pgEmpty", text: t("(no parameters)") }));
            return;
        }
        const walk = (nodes, depth) => {
            for (const n of nodes) {
                const def = n.def;
                const has = n.children.length > 0;
                const open = !this.collapsed.has(def.name);
                const tog = el("span", { class: "pgToggle" + (has ? "" : " none"), text: has ? (open ? "▾" : "▸") : "" });
                const row = el("div", { class: "pgTRow" + (this.selected === def.name ? " selected" : "") },
                    el("span", { class: "pgCName", style: { paddingLeft: 4 + depth * 18 + "px" } }, tog,
                        el("span", { text: label(def) })),
                    el("span", { class: "pgCValue", text: displayValue(def, this.values[def.name], this.lookup) }));
                if (has) {
                    tog.addEventListener("click", ev => {
                        ev.stopPropagation();
                        if (open) {
                            this.collapsed.add(def.name);
                        } else {
                            this.collapsed.delete(def.name);
                        }
                        this.render();
                    });
                }
                row.addEventListener("click", () => {
                    if (this.selected === def.name) {
                        this.edit(def);
                        return;
                    }
                    this.selected = def.name;
                    [...body.querySelectorAll(".pgTRow")].forEach(x => x.classList.remove("selected"));
                    row.classList.add("selected");
                    if (this.onSelect) {
                        this.onSelect(def);
                    }
                });
                body.appendChild(row);
                if (has && open) {
                    walk(n.children, depth + 1);
                }
            }
        };
        walk(buildTree(this.defs), 0);
    }

    get selectedDef() {
        return this.defs.find(d => d.name === this.selected) || null;
    }

    async edit(def = this.selectedDef) {
        if (!def) {
            return;
        }
        const v = await editValue(this.api, def, this.values[def.name] ?? "", { structs: this.structs });
        if (v != null && v !== this.values[def.name]) {
            this.values[def.name] = v;
            this.render();
            if (this.onChange) {
                this.onChange(def, v);
            }
        }
    }
}

// Diálogo com uma tabela de parâmetros (usado por struct<...> e pelos argumentos de
// Plugin Command). Devolve Promise<objeto|null>.
export function editParamSet(api, { title, defs, values, structs, desc }) {
    const work = { ...values };
    return promptDialog(api, {
        title, width: "900px", height: "560px",
        build(body) {
            body.classList.add("pgCol");
            const help = el("div", { class: "pgDesc", text: desc || "" });
            const table = new ParamTable(api, {
                defs, values: work, structs,
                onSelect: def => { help.textContent = def.desc || ""; }
            });
            body.append(table.root, help);
        },
        onOk: () => work
    });
}

// --- Editores ---------------------------------------------------------------------------

// Campo de texto com as ações do menu de contexto do MZ (TextEditPopupMenuEx): Insira Índice de
// Ícone / de Cor. No toque, viram botões abaixo do campo. Inserem o número no cursor.
function insertTools(api, input) {
    const insert = s => {
        const a = input.selectionStart ?? input.value.length, b = input.selectionEnd ?? a;
        input.value = input.value.slice(0, a) + s + input.value.slice(b);
        input.focus();
        input.setSelectionRange(a + s.length, a + s.length);
        input.dispatchEvent(new Event("input"));
    };
    const iconLabel = t("Insert Icon Index", "TextEditPopupMenuEx");
    const colorLabel = t("Insert Color Index", "TextEditPopupMenuEx");
    return el("div", { class: "pgBar pgInsertBar" },
        el("button", { class: "pgBtn", text: iconLabel + "...", onclick: async () => { const n = await pickIcon(api, null, "0", iconLabel); if (n != null) { insert(n); } } }),
        el("button", { class: "pgBtn", text: colorLabel + "...", onclick: async () => { const n = await pickColor(api, null, "0", colorLabel); if (n != null) { insert(n); } } }));
}

function textInput(value, multiline) {
    const input = multiline
        ? el("textarea", { class: "pgTextarea", spellcheck: "false" })
        : el("input", { type: "text", class: "pgInput" });
    input.value = value;
    return input;
}

function textEditor(api, def, value, title, multiline) {
    let input;
    return promptDialog(api, {
        title, width: multiline ? "820px" : "640px", height: multiline ? "520px" : "auto",
        build(body) {
            body.classList.add("pgCol");
            if (def.desc) {
                body.appendChild(el("div", { class: "pgDesc", text: def.desc }));
            }
            input = textInput(value, multiline);
            body.append(input, insertTools(api, input));
            setTimeout(() => input.focus(), 0);
        },
        onOk: () => input.value
    });
}

// Dialog_PluginParameter: editor do tipo numa aba ([Número], [Booleano], [Opção]…) e a aba
// [Texto], que aceita qualquer texto (ex.: \V[n], usado por PluginCommonBase e companhia).
// o.build(page, accept, value) monta a aba do tipo e devolve () => valor atual.
// o.fits(value): o valor cabe no editor do tipo? Se não, abre direto na aba Texto.
function typedDialog(api, def, value, title, o) {
    let mode = -1, cur = value, getTyped = null, text = null;
    return promptDialog(api, {
        title, width: o.width || "640px", height: o.height || "auto",
        build(body, ctx) {
            body.classList.add("pgCol");
            if (def.desc) {
                body.appendChild(el("div", { class: "pgDesc", text: def.desc }));
            }
            const bar = el("div", { class: "pgTabs" });
            const page = el("div", { class: "pgCol pgTabPage" });
            const show = m => {
                if (m === mode) {
                    return;
                }
                if (mode === 0) { cur = getTyped(); } else if (mode === 1) { cur = text.value; }
                mode = m;
                [...bar.children].forEach((b, i) => b.classList.toggle("on", i === m));
                page.textContent = "";
                if (m === 0) {
                    getTyped = o.build(page, v => ctx.accept(v), cur);
                } else {
                    text = textInput(cur, false);
                    page.append(text, insertTools(api, text));
                    setTimeout(() => text.focus(), 0);
                }
            };
            [o.label, t("Text", "Dialog_PluginParameter")].forEach((name, i) =>
                bar.appendChild(el("button", { class: "pgTab", text: name, onclick: () => show(i) })));
            body.append(bar, page);
            show(o.fits(value) ? 0 : 1);
        },
        onOk: () => (mode === 0 ? getTyped() : text.value)
    });
}

function numberEditor(api, def, value, title) {
    const dec = def.decimals || 0;
    const min = def.min == null || isNaN(def.min) ? -Infinity : def.min;
    const max = def.max == null || isNaN(def.max) ? Infinity : def.max;
    const norm = raw => {
        let n = Number(String(raw).trim());
        if (!isFinite(n)) {
            n = 0;
        }
        n = Math.min(max, Math.max(min, n));
        return dec > 0 ? n.toFixed(dec) : String(Math.round(n));
    };
    return typedDialog(api, def, value, title, {
        label: t("Number", "Dialog_PluginParameter"),
        fits: v => String(v).trim() === "" || isFinite(Number(String(v).trim())),
        build(page, accept, v) {
            const input = el("input", { type: "number", class: "pgInput pgNumber", step: dec ? String(Math.pow(10, -dec)) : "1" });
            if (isFinite(min)) { input.min = String(min); }
            if (isFinite(max)) { input.max = String(max); }
            input.value = String(v).trim() !== "" && isFinite(Number(v)) ? v : "";
            const step = d => {
                const n = Number(input.value) || 0;
                input.value = norm(n + d * Math.pow(10, -dec));
            };
            const minus = el("button", { class: "pgBtn pgSpin", text: "−", onclick: () => step(-1) });
            const plus = el("button", { class: "pgBtn pgSpin", text: "+", onclick: () => step(1) });
            const range = [isFinite(min) ? t("min. %1", null, min) : "", isFinite(max) ? t("max. %1", null, max) : "",
                dec ? t("%1 decimal places", null, dec) : ""].filter(Boolean).join(" · ");
            page.append(el("div", { class: "pgSpinRow" }, minus, input, plus),
                range ? el("div", { class: "pgHint", text: range }) : "");
            setTimeout(() => input.focus(), 0);
            return () => norm(input.value);
        }
    });
}

function choiceEditor(api, def, value, title, choices) {
    return typedDialog(api, def, value, title, {
        label: t("Option", "Dialog_PluginParameter"), width: "640px", height: choices.length > 5 ? "560px" : "auto",
        fits: v => v === "" || choices.some(c => c.value === v),
        build(page, accept, v) {
            let current = v;
            let sel = choices.findIndex(c => c.value === v);
            const items = choices.slice();
            if (sel < 0 && v !== "") {
                items.push({ label: v, value: v, className: "pgUnknown" });
                sel = items.length - 1;
            }
            const list = touchList({
                items, selected: sel,
                onSelect: it => { current = it.value; },
                onActivate: it => accept(it.value)
            });
            page.appendChild(list.root);
            requestAnimationFrame(() => list.select(sel, true));
            return () => current;
        }
    });
}

function booleanEditor(api, def, value, title) {
    return typedDialog(api, def, value, title, {
        label: t("Boolean", "Dialog_PluginParameter"),
        fits: v => v === "true" || v === "false" || v === "",
        build(page, accept, v) {
            let current = v === "false" ? "false" : "true";
            const mk = (val, text) => {
                const b = el("button", { class: "pgRadio" + (current === val ? " on" : ""), text });
                b.addEventListener("click", () => {
                    if (current === val) {
                        accept(val);
                        return;
                    }
                    current = val;
                    row.querySelectorAll(".pgRadio").forEach(x => x.classList.remove("on"));
                    b.classList.add("on");
                });
                return b;
            };
            const row = el("div", { class: "pgRadioRow" }, mk("true", def.on || t("ON", "Constants")), mk("false", def.off || t("OFF", "Constants")));
            page.appendChild(row);
            return () => current;
        }
    });
}

function comboEditor(api, def, value, title) {
    let input;
    return promptDialog(api, {
        title, width: "640px", height: "560px",
        build(body, ctx) {
            body.classList.add("pgCol");
            if (def.desc) {
                body.appendChild(el("div", { class: "pgDesc", text: def.desc }));
            }
            input = el("input", { type: "text", class: "pgInput", value });
            const tools = insertTools(api, input);
            const items = def.options.map(o => ({ label: o.text, value: o.text }));
            const list = touchList({
                items, selected: items.findIndex(i => i.value === value),
                onSelect: it => { input.value = it.value; },
                onActivate: it => ctx.accept(it.value)
            });
            body.append(input, tools, list.root);
        },
        onOk: () => input.value
    });
}

async function structEditor(api, def, value, title, ctx, structName) {
    const defs = (ctx.structs || {})[structName];
    if (!defs) {
        // Estrutura não declarada no arquivo: edita o JSON como texto.
        return textEditor(api, def, value, title + " " + t("(struct<%1> not found)", null, structName), true);
    }
    const obj = parseJson(value, null);
    const values = defaultsOf(defs);
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
        for (const k of Object.keys(values)) {
            if (k in obj) {
                values[k] = typeof obj[k] === "string" ? obj[k] : JSON.stringify(obj[k]);
            }
        }
    }
    const res = await editParamSet(api, { title, defs, values, structs: ctx.structs, desc: def.desc });
    if (!res) {
        return null;
    }
    const out = {};
    for (const d of defs) {
        out[d.name] = res[d.name] ?? "";
    }
    return JSON.stringify(out);
}

function newElementValue(elemDef, ctx) {
    const ti = typeInfo(elemDef.type);
    if (ti.kind === "struct" && ctx.structs && ctx.structs[ti.struct]) {
        return JSON.stringify(defaultsOf(ctx.structs[ti.struct]));
    }
    if (ti.kind === "array") {
        return "[]";
    }
    if (ti.kind === "boolean") {
        return "true";
    }
    if (ti.kind === "number" || ti.kind === "color" || ti.kind === "icon" || DATABASE_TYPES[ti.kind] ||
        ti.kind === "switch" || ti.kind === "variable") {
        return ti.kind === "number" && def0(elemDef) ? String(elemDef.min) : "0";
    }
    if (ti.kind === "select" && elemDef.options.length) {
        return elemDef.options[0].value;
    }
    return "";
}

function def0(d) {
    return d.min != null && !isNaN(d.min) && d.min > 0;
}

// Editor de lista (tipo[]): adicionar / editar / excluir / subir / descer.
async function arrayEditor(api, def, value, title, ctx, elementType) {
    const parsed = parseJson(value, []);
    const items = (Array.isArray(parsed) ? parsed : []).map(x => (typeof x === "string" ? x : JSON.stringify(x)));
    const elemDef = { ...def, type: elementType, default: "" };
    let list;
    const refresh = (sel = list.selected) => {
        const lk = (k, id) => lookupName(api, k, id, () => refresh());
        list.setItems(items.map((v, i) => ({ label: displayValue(elemDef, v, lk) || " ", sub: String(i + 1), value: v })), sel);
    };
    const editAt = async i => {
        const v = await editValue(api, elemDef, items[i], ctx, `${label(def)} [${i + 1}]`);
        if (v != null) {
            items[i] = v;
            refresh(i);
        }
    };
    return promptDialog(api, {
        title, width: "900px", height: "560px",
        build(body) {
            body.classList.add("pgCol");
            if (def.desc) {
                body.appendChild(el("div", { class: "pgDesc", text: def.desc }));
            }
            list = touchList({ onActivate: (it, i) => editAt(i), className: "pgArrayList" });
            const add = async () => {
                const at = list.selected >= 0 ? list.selected + 1 : items.length;
                const v = await editValue(api, elemDef, newElementValue(elemDef, ctx), ctx, `${label(def)} [${at + 1}]`);
                if (v != null) {
                    items.splice(at, 0, v);
                    refresh(at);
                }
            };
            const move = d => {
                const i = list.selected;
                const j = i + d;
                if (i < 0 || j < 0 || j >= items.length) {
                    return;
                }
                [items[i], items[j]] = [items[j], items[i]];
                refresh(j);
            };
            const bar = el("div", { class: "pgBar" },
                el("button", { class: "pgBtn", text: t("Add", "Edit_Troops"), onclick: add }),
                el("button", { class: "pgBtn", text: t("Edit", "StandardPopupMenu"), onclick: () => list.selected >= 0 && editAt(list.selected) }),
                el("button", {
                    class: "pgBtn", text: t("Delete", "BasicConstants"), onclick: () => {
                        const i = list.selected;
                        if (i >= 0) {
                            items.splice(i, 1);
                            refresh(Math.min(i, items.length - 1));
                        }
                    }
                }),
                el("button", { class: "pgBtn", text: "▲ " + t("Up", "Constants"), onclick: () => move(-1) }),
                el("button", { class: "pgBtn", text: "▼ " + t("Down", "Constants"), onclick: () => move(1) }),
                // ParameterEditorList "Editar como texto": a lista inteira como JSON
                el("button", {
                    class: "pgBtn", text: t("Edit as Text", "ParameterEditorList"), onclick: async () => {
                        const r = await textEditor(api, def, JSON.stringify(items), t("Edit as Text", "ParameterEditorList"), true);
                        const arr = r == null ? null : parseJson(r, null);
                        if (Array.isArray(arr)) {
                            items.splice(0, items.length, ...arr.map(x => (typeof x === "string" ? x : JSON.stringify(x))));
                            refresh(-1);
                        }
                    }
                }),
                el("span", { class: "spacer" }),
                el("span", { class: "pgHint", text: elementType }));
            body.append(bar, list.root);
            refresh(-1);
        },
        onOk: () => JSON.stringify(items)
    });
}

// Abre o editor do tipo do parâmetro. Devolve Promise<string|null>.
export async function editValue(api, def, value, ctx = {}, title) {
    const ttl = title || label(def);
    const v = value == null ? "" : String(value);
    const ti = typeInfo(def.type);
    switch (ti.kind) {
        case "array": return arrayEditor(api, def, v, ttl, ctx, ti.element);
        case "struct": return structEditor(api, def, v, ttl, ctx, ti.struct);
        case "multiline_string": return textEditor(api, def, v, ttl, true);
        case "note": {
            const text = parseJson(v, v);
            const r = await textEditor(api, def, typeof text === "string" ? text : v, ttl, true);
            return r == null ? null : JSON.stringify(r);
        }
        case "number": return numberEditor(api, def, v, ttl);
        case "boolean": return booleanEditor(api, def, v, ttl);
        case "select": return choiceEditor(api, def, v, ttl, def.options.map(o => ({ label: o.text, value: o.value })));
        case "combo": return comboEditor(api, def, v, ttl);
        case "file": return pickFile(api, def, v, ttl);
        case "color": return pickColor(api, def, v, ttl);
        case "icon": return pickIcon(api, def, v, ttl);
        case "animation": return pickAnimation(api, def, v, ttl);
        case "switch":
        case "variable":
            return pickDatabase(api, { ...def, kind: ti.kind }, v, ttl);
        default:
            if (DATABASE_TYPES[ti.kind]) {
                return pickDatabase(api, { ...def, kind: ti.kind }, v, ttl);
            }
            return textEditor(api, def, v, ttl, false);
    }
}
