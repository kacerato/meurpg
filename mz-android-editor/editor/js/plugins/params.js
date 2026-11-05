// Tabela de parâmetros (árvore por @parent) e editores de valor por @type, como no MZ.
// Todos os valores são strings; struct e arrays são JSON string (arrays de strings, e
// elementos struct também como JSON string, igual ao editor original).

import { typeInfo, defaultsOf, DATABASE_TYPES } from "./parser.js";
import { el, promptDialog, touchList } from "./ui.js";
import { pickDatabase, pickFile, pickColor, pickIcon } from "./pickers.js";
import { t } from "../i18n.js";

const label = def => def.text || def.name;

function parseJson(v, fallback) {
    try {
        return JSON.parse(v);
    } catch {
        return fallback;
    }
}

// Texto exibido na coluna Valor (o valor gravado, numa linha).
export function displayValue(def, value) {
    const v = value == null ? "" : String(value);
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
                    el("span", { class: "pgCValue", text: displayValue(def, this.values[def.name]) }));
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

function textEditor(api, def, value, title, multiline) {
    let input;
    return promptDialog(api, {
        title, width: multiline ? "820px" : "640px", height: multiline ? "520px" : "auto",
        build(body) {
            body.classList.add("pgCol");
            if (def.desc) {
                body.appendChild(el("div", { class: "pgDesc", text: def.desc }));
            }
            input = multiline
                ? el("textarea", { class: "pgTextarea", spellcheck: "false" })
                : el("input", { type: "text", class: "pgInput" });
            input.value = value;
            body.appendChild(input);
            setTimeout(() => input.focus(), 0);
        },
        onOk: () => input.value
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
    let input;
    return promptDialog(api, {
        title, width: "560px", height: "auto",
        build(body) {
            body.classList.add("pgCol");
            if (def.desc) {
                body.appendChild(el("div", { class: "pgDesc", text: def.desc }));
            }
            input = el("input", { type: "number", class: "pgInput pgNumber", step: dec ? String(Math.pow(10, -dec)) : "1" });
            if (isFinite(min)) { input.min = String(min); }
            if (isFinite(max)) { input.max = String(max); }
            input.value = value === "" ? "" : value;
            const step = d => {
                const n = Number(input.value) || 0;
                input.value = norm(n + d * Math.pow(10, -dec));
            };
            const minus = el("button", { class: "pgBtn pgSpin", text: "−", onclick: () => step(-1) });
            const plus = el("button", { class: "pgBtn pgSpin", text: "+", onclick: () => step(1) });
            const range = [isFinite(min) ? t("min. %1", null, min) : "", isFinite(max) ? t("max. %1", null, max) : "",
                dec ? t("%1 decimal places", null, dec) : ""].filter(Boolean).join(" · ");
            body.append(el("div", { class: "pgSpinRow" }, minus, input, plus),
                range ? el("div", { class: "pgHint", text: range }) : "");
            setTimeout(() => input.focus(), 0);
        },
        onOk: () => norm(input.value)
    });
}

function choiceEditor(api, def, value, title, choices) {
    let current = value;
    return promptDialog(api, {
        title, width: "640px", height: choices.length > 6 ? "560px" : "auto",
        build(body, ctx) {
            body.classList.add("pgCol");
            if (def.desc) {
                body.appendChild(el("div", { class: "pgDesc", text: def.desc }));
            }
            let sel = choices.findIndex(c => c.value === value);
            const items = choices.slice();
            if (sel < 0 && value !== "") {
                items.push({ label: value, value, className: "pgUnknown" });
                sel = items.length - 1;
            }
            const list = touchList({
                items, selected: sel,
                onSelect: it => { current = it.value; },
                onActivate: it => ctx.accept(it.value)
            });
            body.appendChild(list.root);
            requestAnimationFrame(() => list.select(sel, true));
        },
        onOk: () => current
    });
}

function booleanEditor(api, def, value, title) {
    let current = value === "true" ? "true" : value === "false" ? "false" : value;
    return promptDialog(api, {
        title, width: "560px", height: "auto",
        build(body, ctx) {
            body.classList.add("pgCol");
            if (def.desc) {
                body.appendChild(el("div", { class: "pgDesc", text: def.desc }));
            }
            const mk = (v, text) => {
                const b = el("button", { class: "pgRadio" + (current === v ? " on" : ""), text });
                b.addEventListener("click", () => {
                    if (current === v) {
                        ctx.accept(v);
                        return;
                    }
                    current = v;
                    row.querySelectorAll(".pgRadio").forEach(x => x.classList.remove("on"));
                    b.classList.add("on");
                });
                return b;
            };
            const row = el("div", { class: "pgRadioRow" }, mk("true", def.on || t("ON", "Constants")), mk("false", def.off || t("OFF", "Constants")));
            body.appendChild(row);
        },
        onOk: () => current
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
            const items = def.options.map(o => ({ label: o.text, value: o.text }));
            const list = touchList({
                items, selected: items.findIndex(i => i.value === value),
                onSelect: it => { input.value = it.value; },
                onActivate: it => ctx.accept(it.value)
            });
            body.append(input, list.root);
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
        list.setItems(items.map((v, i) => ({ label: displayValue(elemDef, v) || " ", sub: String(i + 1), value: v })), sel);
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
