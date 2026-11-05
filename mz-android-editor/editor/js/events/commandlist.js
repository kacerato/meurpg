// Lista de conteúdo (Contents) de uma página/evento comum: renderização igual ao MZ
// ("◆Text：…", "：　　　：…", recuo por indent), seleção por blocos e edição.

import { CMD, pickCommand } from "./commands.js";
import { clone } from "./data.js";
import { h, actionMenu, alertBox, getApi } from "./ui.js";
import { runEventTest } from "./etest.js";

const E = indent => ({ code: 0, indent, parameters: [] });
const BLOCK_END = { 111: 412, 112: 413, 102: 404, 301: 604 };
const BRANCH_CODES = new Set([402, 403, 404, 411, 412, 413, 601, 602, 603, 604]);
const PARENT_OF = { 402: 102, 403: 102, 404: 102, 411: 111, 412: 111, 413: 112, 601: 301, 602: 301, 603: 301, 604: 301 };
const CONT_CODES = new Set([401, 405, 408, 505, 605, 655, 657]);

let clipboard = null; // comandos copiados (indent relativo a 0), compartilhado entre listas

// ---------- operações sobre a lista ----------
export function ownEnd(list, i) {
    const d = CMD[list[i].code];
    let j = i + 1;
    if (d && d.cont) { while (j < list.length && list[j].code === d.cont) { j++; } }
    return j;
}
export function blockEnd(list, i) {
    const c = list[i];
    const end = BLOCK_END[c.code];
    if (end) {
        for (let j = i + 1; j < list.length; j++) {
            if (list[j].indent === c.indent && list[j].code === end) { return j + 1; }
            if (list[j].indent < c.indent) { break; }
        }
        if (c.code === 301) { return ownEnd(list, i); } // batalha sem ramos
    }
    return ownEnd(list, i);
}
// Unidade selecionável que contém a linha i: [start, end)
export function unitAt(list, i) {
    const c = list[i];
    if (!c) { return [i, i]; }
    if (c.code === 0) { return [i, i + 1]; }
    let head = i;
    if (CONT_CODES.has(c.code)) {
        while (head > 0 && CONT_CODES.has(list[head].code) && list[head].indent === c.indent) { head--; }
    } else if (BRANCH_CODES.has(c.code)) {
        const parent = PARENT_OF[c.code];
        for (let j = i - 1; j >= 0; j--) {
            if (list[j].indent === c.indent && list[j].code === parent) { head = j; break; }
            if (list[j].indent < c.indent) { break; }
        }
    }
    return [head, blockEnd(list, head)];
}

function collectBodies(list, i, end) {
    const ind = list[i].indent;
    const bodies = {};
    let key = null;
    for (let j = i + 1; j < end; j++) {
        const c = list[j];
        if (c.indent === ind && BRANCH_CODES.has(c.code)) {
            key = c.code === 402 ? "c" + c.parameters[0] : String(c.code);
            bodies[key] = [];
            continue;
        }
        if (key) { bodies[key].push(c); }
    }
    for (const k of Object.keys(bodies)) { if (!bodies[k].length) { delete bodies[k]; } }
    return bodies;
}
function choiceBranches(p, ind, bodies) {
    const out = [];
    p[0].forEach((text, k) => { out.push({ code: 402, indent: ind, parameters: [k, text] }, ...(bodies["c" + k] || [E(ind + 1)])); });
    if (p[1] === -2) { out.push({ code: 403, indent: ind, parameters: [6, null] }, ...(bodies["403"] || [E(ind + 1)])); }
    out.push({ code: 404, indent: ind, parameters: [] });
    return out;
}
function battleBranches(p, ind, bodies) {
    if (!p[2] && !p[3]) { return []; }
    const out = [{ code: 601, indent: ind, parameters: [] }, ...(bodies["601"] || [E(ind + 1)])];
    if (p[2]) { out.push({ code: 602, indent: ind, parameters: [] }, ...(bodies["602"] || [E(ind + 1)])); }
    if (p[3]) { out.push({ code: 603, indent: ind, parameters: [] }, ...(bodies["603"] || [E(ind + 1)])); }
    out.push({ code: 604, indent: ind, parameters: [] });
    return out;
}

export function buildNew(code, res, ind) {
    const d = CMD[code];
    const out = [];
    for (const r of res.split || [res]) {
        out.push({ code, indent: ind, parameters: r.p || [] });
        if (d && d.cont) { for (const c of r.conts || []) { out.push({ code: d.cont, indent: ind, parameters: c }); } }
    }
    switch (code) {
        case 111:
            out.push(E(ind + 1));
            if (res.else) { out.push({ code: 411, indent: ind, parameters: [] }, E(ind + 1)); }
            out.push({ code: 412, indent: ind, parameters: [] });
            break;
        case 112: out.push(E(ind + 1), { code: 413, indent: ind, parameters: [] }); break;
        case 102: out.push(...choiceBranches(res.p, ind, {})); break;
        case 301: out.push(...battleBranches(res.p, ind, {})); break;
    }
    return out;
}

export function applyEdit(list, i, res) {
    const c = list[i];
    const ind = c.indent;
    if (c.code === 111) {
        c.parameters = res.p;
        const end = blockEnd(list, i);
        let elseAt = -1;
        for (let j = i + 1; j < end; j++) { if (list[j].indent === ind && list[j].code === 411) { elseAt = j; break; } }
        if (res.else && elseAt < 0) { list.splice(end - 1, 0, { code: 411, indent: ind, parameters: [] }, E(ind + 1)); }
        if (!res.else && elseAt >= 0) { list.splice(elseAt, end - 1 - elseAt); }
        return;
    }
    if (c.code === 102 || c.code === 301) {
        const end = blockEnd(list, i);
        const bodies = collectBodies(list, i, end);
        const head = { code: c.code, indent: ind, parameters: res.p };
        const br = c.code === 102 ? choiceBranches(res.p, ind, bodies) : battleBranches(res.p, ind, bodies);
        list.splice(i, end - i, head, ...br);
        return;
    }
    const end = ownEnd(list, i);
    list.splice(i, end - i, ...buildNew(c.code, res, ind));
}

function reindent(cmds, delta) { return cmds.map(c => ({ ...clone(c), indent: c.indent + delta })); }

// ---------- texto ----------
export function rowParts(list, i, ctx) {
    const c = list[i];
    const d = CMD[c.code];
    if (c.code === 0) { return { mark: "◆", label: "", value: "" }; }
    if (CONT_CODES.has(c.code)) {
        let head = i;
        while (head > 0 && CONT_CODES.has(list[head].code)) { head--; }
        const hd = CMD[list[head].code];
        const [label] = hd ? safeText(hd, list[head], ctx) : [""];
        const ownDef = hd && hd.cont === c.code ? hd : null;
        return { mark: "：", label, hidden: true, value: ownDef && ownDef.contText ? ownDef.contText(c.parameters) : String(c.parameters[0]), cat: hd ? hd.cat : "" };
    }
    if (!d) { return { mark: "◆", label: "Unknown Command", value: String(c.code) + " " + JSON.stringify(c.parameters) }; }
    const [label, value] = safeText(d, c, ctx);
    if (d.branch) { return { mark: "：", label: value ? label + " " + value : label, value: "", cat: d.cat, branch: true }; }
    return { mark: "◆", label, value, cat: d.cat };
}
function safeText(d, c, ctx) {
    try { return d.text(c.parameters || [], ctx); } catch (e) { return [d.name, "?"]; }
}
export function rowText(list, i, ctx) {
    const r = rowParts(list, i, ctx);
    const pad = "  ".repeat(list[i].indent);
    if (r.hidden) { return pad + r.mark + "　".repeat(Math.max(1, Math.ceil(r.label.length / 2))) + "：" + r.value; }
    return pad + r.mark + r.label + (r.value ? "：" + r.value : "");
}

// ---------- widget ----------
// opts: { list, ctx: {map, mapId, eventId}, onChange }
export function createCommandList(opts) {
    let list = opts.list;
    let sel = [list.length - 1, list.length];
    let anchor = sel[0];
    let multi = false;
    const box = h("div", { class: "evCmdList", tabindex: "0" });
    const ctx = () => Object.assign({ list }, opts.ctx || {});
    const changed = () => { if (opts.onChange) { opts.onChange(list); } render(); };

    const render = () => {
        box.innerHTML = "";
        const c = ctx();
        list.forEach((cmd, i) => {
            const r = rowParts(list, i, c);
            const rowEl = h("div", { class: "evCmdRow" + (i >= sel[0] && i < sel[1] ? " selected" : "") + (r.cat ? " cat-" + r.cat : ""), style: { paddingLeft: (6 + cmd.indent * 22) + "px" } },
                h("span", { class: "evMark" }, r.mark),
                r.label ? h("span", { class: "evCmdLabel" + (r.hidden ? " hiddenLabel" : "") }, r.label) : null,
                r.value !== "" && r.value !== undefined ? h("span", { class: "evSep" }, "：") : null,
                r.value !== "" && r.value !== undefined ? h("span", { class: "evCmdValue" }, r.value) : null);
            rowEl.dataset.i = i;
            box.append(rowEl);
        });
    };
    const select = i => {
        const u = unitAt(list, i);
        if (multi && list[anchor] && list[i].code !== 0) {
            const a = unitAt(list, anchor);
            if (list[a[0]].indent === list[u[0]].indent) {
                sel = [Math.min(a[0], u[0]), Math.max(a[1], u[1])];
                render();
                return;
            }
        }
        sel = u; anchor = u[0];
        render();
    };
    const selected = () => list.slice(sel[0], sel[1]);
    const canModify = () => selected().some(c => c.code !== 0);

    const api = {
        el: box,
        get list() { return list; },
        setList(l) { list = l; sel = [l.length - 1, l.length]; anchor = sel[0]; render(); },
        setMulti(on) { multi = on; },
        selectRow(i) { if (list[i]) { select(i); const r = box.children[i]; if (r) { r.scrollIntoView({ block: "center" }); } } },
        async newCommand() {
            const code = await pickCommand();
            if (!code) { return; }
            const d = CMD[code];
            let res = { p: [] };
            if (!d.noParams) {
                res = await d.edit(null, ctx());
                if (!res) { return; }
            }
            const at = sel[0];
            const ind = list[at].indent;
            const cmds = buildNew(code, res, ind);
            list.splice(at, 0, ...cmds);
            sel = [at + cmds.length, at + cmds.length + 1];
            sel = unitAt(list, sel[0]);
            changed();
        },
        async edit() {
            const i = sel[0];
            const c = list[i];
            if (!c || c.code === 0) { return api.newCommand(); }
            const d = CMD[c.code];
            if (!d || d.noParams || !d.edit) { return; }
            const conts = list.slice(i + 1, ownEnd(list, i)).map(x => clone(x.parameters));
            let extra = null;
            if (c.code === 111) {
                const end = blockEnd(list, i);
                extra = { hasElse: list.slice(i + 1, end).some(x => x.indent === c.indent && x.code === 411) };
            }
            const res = await d.edit(clone(c.parameters), ctx(), conts, extra);
            if (!res) { return; }
            applyEdit(list, i, res);
            sel = unitAt(list, i);
            changed();
        },
        copy() { if (canModify()) { const s = selected(); clipboard = reindent(s, -s[0].indent); try { localStorage.setItem("mzEventsClip", JSON.stringify(clipboard)); } catch (e) { /* ignora */ } } },
        cut() { if (canModify()) { api.copy(); api.del(); } },
        paste() {
            let clip = clipboard;
            if (!clip) { try { clip = JSON.parse(localStorage.getItem("mzEventsClip") || "null"); } catch (e) { clip = null; } }
            if (!clip) { return; }
            const at = sel[0];
            const cmds = reindent(clip, list[at].indent);
            list.splice(at, 0, ...cmds);
            sel = unitAt(list, at + cmds.length);
            changed();
        },
        del() {
            if (!canModify()) { return; }
            const [a, b] = sel;
            list.splice(a, b - a);
            sel = unitAt(list, Math.min(a, list.length - 1));
            changed();
        },
        selectAll() { sel = [0, Math.max(1, list.length - 1)]; render(); },
        copyText() {
            const c = ctx();
            const text = [];
            for (let i = sel[0]; i < sel[1]; i++) { text.push(rowText(list, i, c)); }
            const s = text.join("\n");
            if (navigator.clipboard) { navigator.clipboard.writeText(s).catch(() => alertBox(s, "Copy as Text")); } else { alertBox(s, "Copy as Text"); }
        },
        copyHtml() {
            const c = ctx();
            const text = [];
            for (let i = sel[0]; i < sel[1]; i++) { text.push(rowText(list, i, c).replace(/&/g, "&amp;").replace(/</g, "&lt;")); }
            const s = text.join("<br>\n");
            if (navigator.clipboard) { navigator.clipboard.writeText(s).catch(() => alertBox(s, "Copy as HTML")); }
        },
        // "Test": executa no jogo os comandos selecionados (ou a lista toda se só a linha vazia).
        async test() {
            let cmds = selected();
            if (!cmds.some(c => c.code !== 0)) { cmds = list.slice(); }
            await runEventTest(getApi(), cmds);
        },
        async menu(x, y) {
            const c = list[sel[0]];
            const empty = !c || c.code === 0;
            await actionMenu([
                { label: "New…", action: () => api.newCommand() },
                { label: "Edit…", disabled: empty || (CMD[c.code] && CMD[c.code].noParams), action: () => api.edit() },
                "-",
                { label: "Cut", disabled: empty, action: () => api.cut() },
                { label: "Copy", disabled: empty, action: () => api.copy() },
                { label: "Paste", action: () => api.paste() },
                { label: "Delete", disabled: empty, action: () => api.del() },
                "-",
                { label: "Select All", action: () => api.selectAll() },
                { label: "Copy as Text", action: () => api.copyText() },
                { label: "Copy as HTML Tags", action: () => api.copyHtml() },
                "-",
                { label: "Test", action: () => api.test() }
            ], { x, y });
        },
        render
    };

    // toque: tap = selecionar, duplo-tap = editar/novo, toque longo = menu
    let lastTap = { i: -1, t: 0 };
    let pressTimer = null, pressPos = null, longFired = false;
    const rowIndex = e => { const r = e.target.closest(".evCmdRow"); return r ? Number(r.dataset.i) : -1; };
    box.addEventListener("pointerdown", e => {
        const i = rowIndex(e);
        if (i < 0) { return; }
        longFired = false;
        pressPos = { x: e.clientX, y: e.clientY };
        clearTimeout(pressTimer);
        pressTimer = setTimeout(() => { longFired = true; select(i); api.menu(pressPos.x, pressPos.y); }, 550);
    });
    box.addEventListener("pointermove", e => { if (pressPos && Math.hypot(e.clientX - pressPos.x, e.clientY - pressPos.y) > 10) { clearTimeout(pressTimer); } });
    box.addEventListener("pointerup", e => {
        clearTimeout(pressTimer);
        if (longFired) { return; }
        const i = rowIndex(e);
        if (i < 0 || !pressPos || Math.hypot(e.clientX - pressPos.x, e.clientY - pressPos.y) > 10) { return; }
        const now = Date.now();
        const inSel = i >= sel[0] && i < sel[1];
        if (lastTap.i === i && now - lastTap.t < 400 && inSel) { lastTap = { i: -1, t: 0 }; api.edit(); return; }
        lastTap = { i, t: now };
        select(i);
    });
    box.addEventListener("pointercancel", () => clearTimeout(pressTimer));
    box.addEventListener("contextmenu", e => { e.preventDefault(); const i = rowIndex(e); if (i >= 0) { select(i); } api.menu(e.clientX, e.clientY); });
    box.addEventListener("keydown", e => {
        const mod = e.ctrlKey || e.metaKey;
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); api.edit(); }
        else if (e.key === "Delete") { api.del(); }
        else if (mod && e.key === "c") { api.copy(); }
        else if (mod && e.key === "x") { api.cut(); }
        else if (mod && e.key === "v") { api.paste(); }
        else if (mod && e.key === "a") { e.preventDefault(); api.selectAll(); }
        else if (e.key === "ArrowDown") { e.preventDefault(); select(Math.min(list.length - 1, sel[1])); }
        else if (e.key === "ArrowUp") { e.preventDefault(); select(Math.max(0, sel[0] - 1)); }
    });
    render();
    return api;
}

// Barra de botões de toque para a lista (substitui o menu do botão direito).
export function commandListToolbar(cl) {
    const multiBtn = h("button", { type: "button", class: "evBtn toggle", title: "Selecionar vários (equivale a Shift+clique)" }, "Multi");
    multiBtn.addEventListener("click", () => { multiBtn.classList.toggle("on"); cl.setMulti(multiBtn.classList.contains("on")); });
    const b = (label, fn, title) => h("button", { type: "button", class: "evBtn", title, onclick: fn }, label);
    return h("div", { class: "evRow evListTools" },
        b("New…", () => cl.newCommand()), b("Edit…", () => cl.edit()), b("Cut", () => cl.cut()), b("Copy", () => cl.copy()),
        b("Paste", () => cl.paste()), b("Delete", () => cl.del()), multiBtn, b("Test", () => cl.test(), "Testar os comandos selecionados no jogo"), b("☰", e => { const r = e.currentTarget.getBoundingClientRect(); cl.menu(r.left, r.bottom); }, "Mais"));
}
