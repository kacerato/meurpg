// Widgets de formulário do Banco de dados (toque, ≥36px). Sem frameworks.
// Todos os widgets ligados a dados escrevem direto no objeto e chamam `changed()`,
// que o index.js aponta para "marcar o arquivo da aba atual como alterado".
import { t } from "../i18n.js";

let changedHook = () => {};
let apiRef = null;

export function setChangedHook(fn) { changedHook = fn; }
export function changed() { changedHook(); }
export function setApi(api) { apiRef = api; }
export function getApi() { return apiRef; }

export function el(tag, props, ...kids) {
    const e = document.createElement(tag);
    if (props) {
        for (const [k, v] of Object.entries(props)) {
            if (v === undefined || v === null) { continue; }
            if (k === "class") { e.className = v; }
            else if (k === "text") { e.textContent = v; }
            else if (k === "html") { e.innerHTML = v; }
            else if (k === "style" && typeof v === "object") { Object.assign(e.style, v); }
            else if (k.startsWith("on") && typeof v === "function") { e.addEventListener(k.slice(2).toLowerCase(), v); }
            else if (k in e && typeof v !== "string") { e[k] = v; }
            else { e.setAttribute(k, v); }
        }
    }
    for (const kid of kids.flat(Infinity)) {
        if (kid === null || kid === undefined || kid === false) { continue; }
        e.appendChild(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    }
    return e;
}

export const pad = (n, w = 4) => String(n).padStart(w, "0");

// ---------------------------------------------------------------- campos ligados a dados

// número inteiro/decimal. scale: valor exibido = valor guardado * scale (ex.: 0.95 -> 95 %).
export function num(obj, key, o = {}) {
    const scale = o.scale || 1;
    const input = el("input", { type: "number", class: "dbNum", inputmode: o.float ? "decimal" : "numeric" });
    if (o.min !== undefined) { input.min = o.min; }
    if (o.max !== undefined) { input.max = o.max; }
    input.step = o.step || (o.float ? "any" : 1);
    if (o.width) { input.style.width = o.width; }
    const show = () => {
        const v = (obj[key] ?? 0) * scale;
        input.value = o.float ? String(Math.round(v * 1000) / 1000) : String(Math.round(v));
    };
    show();
    const commit = () => {
        let v = Number(input.value);
        if (!Number.isFinite(v)) { v = o.min ?? 0; }
        if (!o.float) { v = Math.round(v); }
        if (o.min !== undefined) { v = Math.max(o.min, v); }
        if (o.max !== undefined) { v = Math.min(o.max, v); }
        const stored = scale === 1 ? v : Math.round(v / scale * 1e6) / 1e6;
        if (obj[key] !== stored) {
            obj[key] = stored;
            changed();
            o.onChange && o.onChange(stored);
        }
        show();
    };
    input.addEventListener("change", commit);
    input.refresh = show;
    if (o.disabled) { input.disabled = true; }
    return input;
}

export function text(obj, key, o = {}) {
    const input = el("input", { type: "text", class: "dbText", value: obj[key] ?? "" });
    if (o.placeholder) { input.placeholder = o.placeholder; }
    input.addEventListener("input", () => {
        obj[key] = input.value;
        changed();
        o.onInput && o.onInput(input.value);
    });
    input.addEventListener("change", () => o.onChange && o.onChange(input.value));
    input.refresh = () => { input.value = obj[key] ?? ""; };
    return input;
}

export function area(obj, key, o = {}) {
    const ta = el("textarea", { class: "dbArea", rows: o.rows || 3 });
    ta.value = obj[key] ?? "";
    if (o.mono) { ta.classList.add("mono"); }
    ta.addEventListener("input", () => { obj[key] = ta.value; changed(); o.onInput && o.onInput(ta.value); });
    ta.refresh = () => { ta.value = obj[key] ?? ""; };
    return ta;
}

// options: [[valor, rótulo], ...]. Valores numéricos são preservados como número.
export function sel(obj, key, options, o = {}) {
    const s = el("select", { class: "dbSel" });
    const fill = opts => {
        s.innerHTML = "";
        let found = false;
        for (const [v, label] of opts) {
            const op = el("option", { text: label });
            op.value = String(v);
            if (String(v) === String(obj[key])) { found = true; }
            s.appendChild(op);
        }
        if (!found && obj[key] !== undefined) {
            const op = el("option", { text: `(${obj[key]})` });
            op.value = String(obj[key]);
            s.appendChild(op);
        }
        s.value = String(obj[key]);
    };
    fill(options);
    s.addEventListener("change", () => {
        const raw = s.value;
        const v = typeof obj[key] === "number" || o.number ? Number(raw) : (typeof obj[key] === "boolean" ? raw === "true" : raw);
        obj[key] = v;
        changed();
        o.onChange && o.onChange(v);
    });
    s.refill = opts => fill(opts);
    s.refresh = () => { s.value = String(obj[key]); };
    if (o.disabled) { s.disabled = true; }
    return s;
}

export function chk(obj, key, label, o = {}) {
    const box = el("input", { type: "checkbox", checked: !!obj[key] });
    box.addEventListener("change", () => {
        obj[key] = o.invert ? !box.checked : box.checked;
        changed();
        o.onChange && o.onChange(obj[key]);
    });
    if (o.invert) { box.checked = !obj[key]; }
    const lab = el("label", { class: "dbChk" }, box, el("span", { text: label }));
    lab.input = box;
    return lab;
}

// grupo de rádios ligados a um valor numérico
export function radios(obj, key, options, o = {}) {
    const name = "r" + Math.random().toString(36).slice(2);
    const wrap = el("div", { class: "dbRadios" + (o.vertical ? " vertical" : "") });
    for (const [v, label] of options) {
        const r = el("input", { type: "radio", name, checked: obj[key] === v });
        r.addEventListener("change", () => {
            if (r.checked) { obj[key] = v; changed(); o.onChange && o.onChange(v); }
        });
        wrap.appendChild(el("label", { class: "dbChk" }, r, el("span", { text: label })));
    }
    return wrap;
}

// ---------------------------------------------------------------- layout

export function fld(label, control, o = {}) {
    const f = el("div", { class: "dbField" + (o.wide ? " wide" : "") + (o.cls ? " " + o.cls : "") });
    if (o.span) { f.style.gridColumn = "span " + o.span; }
    f.appendChild(el("div", { class: "dbLabel", text: label }));
    if (Array.isArray(control)) {
        f.appendChild(el("div", { class: "dbInline" }, control));
    } else if (control) {
        f.appendChild(control);
    }
    return f;
}

export function grp(title, ...kids) {
    return el("fieldset", { class: "dbGroup" }, el("legend", { text: title }), ...kids);
}

export function grid(cols, ...kids) {
    const g = el("div", { class: "dbGrid" }, ...kids);
    g.style.gridTemplateColumns = typeof cols === "number" ? `repeat(${cols}, minmax(0, 1fr))` : cols;
    return g;
}

export function row(...kids) { return el("div", { class: "dbRow" }, ...kids); }

export function btn(label, onClick, cls) {
    return el("button", { class: "dbBtn" + (cls ? " " + cls : ""), text: label, onclick: onClick, type: "button" });
}

// ---------------------------------------------------------------- diálogos

// Abre um diálogo modal (via api.openDialog) e devolve Promise<boolean>.
// build(body) monta o conteúdo; validate() pode devolver false para manter aberto.
export function modal({ title, width, height, build, validate, okLabel = t("OK", "BasicConstants"), cancelLabel = t("Cancel", "BasicConstants"), extraButtons }) {
    return new Promise(resolve => {
        let done = false;
        const finish = v => { if (!done) { done = true; resolve(v); } };
        const buttons = [...(extraButtons || []),
            { label: okLabel, primary: true, onClick: () => { if (validate && validate() === false) { return false; } finish(true); } },
            { label: cancelLabel, onClick: () => finish(false) }];
        if (cancelLabel === null) { buttons.pop(); }
        const dlg = apiRef.openDialog({ title, width: width || "520px", height: height || "auto", buttons });
        dlg.root.classList.add("dbModalRoot");
        dlg.body.classList.add("dbModalBody");
        // fechado por "voltar" do Android (closeTopDialog) => cancela
        const obs = new MutationObserver(() => {
            if (!dlg.root.isConnected) { obs.disconnect(); finish(false); }
        });
        obs.observe(document.body, { childList: true });
        build(dlg.body, dlg);
    });
}

export function alertBox(message, title = "MZ Editor") {
    return modal({ title, width: "420px", cancelLabel: null, build: b => b.appendChild(el("div", { class: "dbMsg", text: message })) });
}

export function confirmBox(message, title = "MZ Editor") {
    return modal({ title, width: "440px", build: b => b.appendChild(el("div", { class: "dbMsg", text: message })) });
}

// Pergunta um número. Devolve o número ou null.
export async function askNumber(title, label, value, min, max) {
    const o = { v: value };
    const ok = await modal({ title, width: "360px", build: b => b.appendChild(fld(label, num(o, "v", { min, max }))) });
    return ok ? o.v : null;
}

// ---------------------------------------------------------------- listas editáveis

// Lista em tabela (Traits, Effects, Learnings, Action Patterns, timings...).
// o: { columns:[{title, width}], items:Array (referência), cells(item,i) => [..],
//      create():Promise<item|null>, edit(item):Promise<item|null>, clipKey, height, onChange }
// Clipboards do banco (lista de dados, linhas de tabela, páginas de Tropas) sobrevivem a recarregar,
// como a área de transferência do MZ: ficam no localStorage (falha silenciosa sem espaço).
const CLIP_KEY = "mzEditor.dbClipboard";
function readClips() { try { return JSON.parse(localStorage.getItem(CLIP_KEY) || "{}") || {}; } catch (e) { return {}; } }
export function getClip(key) { const v = readClips()[key]; return v === undefined ? null : v; }
export function setClip(key, value) {
    const all = readClips(); all[key] = value;
    try { localStorage.setItem(CLIP_KEY, JSON.stringify(all)); } catch (e) { memClips.set(key, value); }
}
const memClips = new Map();
const clip = { get: k => getClip("table:" + k) ?? memClips.get("table:" + k), set: (k, v) => setClip("table:" + k, v) };

export function tableList(o) {
    const wrap = el("div", { class: "dbTable" });
    if (o.height) { wrap.style.setProperty("--tbl-h", o.height); }
    const head = el("div", { class: "dbTHead" });
    const body = el("div", { class: "dbTBody" });
    const cols = o.columns.map(c => c.width || "1fr").join(" ");
    head.style.gridTemplateColumns = cols;
    for (const c of o.columns) { head.appendChild(el("div", { text: c.title })); }
    let selected = -1;
    let lastTap = { i: -2, t: 0 };

    const notify = () => { changed(); o.onChange && o.onChange(); };
    const edit = async i => {
        if (i >= o.items.length) {
            const item = await o.create();
            if (item) { o.items.push(item); selected = o.items.length - 1; notify(); render(); }
        } else if (o.edit) {
            const copy = structuredClone(o.items[i]);
            const item = await o.edit(copy, i);
            if (item) { o.items[i] = item; notify(); render(); }
        }
    };
    const render = () => {
        body.innerHTML = "";
        o.items.forEach((item, i) => {
            const r = el("div", { class: "dbTRow" + (i === selected ? " sel" : "") });
            r.style.gridTemplateColumns = cols;
            for (const c of o.cells(item, i)) {
                r.appendChild(c instanceof Node ? el("div", null, c) : el("div", { text: c ?? "" }));
            }
            r.addEventListener("click", () => {
                const now = Date.now();
                if (lastTap.i === i && now - lastTap.t < 450) { edit(i); lastTap = { i: -2, t: 0 }; return; }
                lastTap = { i, t: now };
                selected = i;
                render();
            });
            body.appendChild(r);
        });
        if (!o.fixed) {
            const empty = el("div", { class: "dbTRow empty" + (selected === o.items.length ? " sel" : "") });
            empty.style.gridTemplateColumns = cols;
            empty.appendChild(el("div", { text: "" }));
            empty.addEventListener("click", () => { selected = o.items.length; render(); edit(o.items.length); });
            body.appendChild(empty);
        }
    };
    const tools = el("div", { class: "dbTTools" });
    const tool = (label, fn) => tools.appendChild(btn(label, fn, "small"));
    if (!o.fixed) { tool(t("New", "StandardPopupMenu"), () => edit(o.items.length)); }
    tool(t("Edit", "StandardPopupMenu"), () => { if (selected >= 0) { edit(selected); } });
    if (!o.fixed) {
        tool(t("Copy", "BasicConstants"), () => { if (selected >= 0 && selected < o.items.length) { clip.set(o.clipKey || "x", structuredClone(o.items[selected])); } });
        tool(t("Paste", "BasicConstants"), () => {
            const c = clip.get(o.clipKey || "x");
            if (c) {
                const at = selected >= 0 && selected <= o.items.length ? selected : o.items.length;
                o.items.splice(at, 0, structuredClone(c));
                selected = at; notify(); render();
            }
        });
        tool(t("Delete", "BasicConstants"), () => {
            if (selected >= 0 && selected < o.items.length) {
                o.items.splice(selected, 1);
                selected = Math.min(selected, o.items.length - 1); notify(); render();
            }
        });
        tool("▲", () => {
            if (selected > 0 && selected < o.items.length) {
                [o.items[selected - 1], o.items[selected]] = [o.items[selected], o.items[selected - 1]];
                selected--; notify(); render();
            }
        });
        tool("▼", () => {
            if (selected >= 0 && selected < o.items.length - 1) {
                [o.items[selected + 1], o.items[selected]] = [o.items[selected], o.items[selected + 1]];
                selected++; notify(); render();
            }
        });
    }
    if (o.extraTools) { o.extraTools(tools, () => selected, render); }
    wrap.append(head, body, tools);
    wrap.refresh = render;
    render();
    return wrap;
}

// Abas simples (usadas em diálogos: Traits, Effects, Parameter Curves...).
export function tabs(defs, o = {}) {
    const bar = el("div", { class: "dbTabs small" });
    const page = el("div", { class: "dbTabPage" });
    let cur = o.initial || 0;
    const show = i => {
        cur = i;
        [...bar.children].forEach((b, j) => b.classList.toggle("on", j === i));
        page.innerHTML = "";
        defs[i].build(page);
        o.onShow && o.onShow(i);
    };
    defs.forEach((d, i) => bar.appendChild(btn(d.title, () => show(i))));
    const wrap = el("div", { class: "dbTabWrap" }, bar, page);
    wrap.show = show;
    wrap.current = () => cur;
    show(cur);
    return wrap;
}
