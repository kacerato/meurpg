// Definições de TODOS os comandos de evento do RPG Maker MZ: nome, texto na lista de conteúdo,
// diálogo de parâmetros e referências (para o Event Searcher). Formato dos parâmetros conforme
// Game_Interpreter.prototype.commandXXX em js/rmmz_objects.js.

import { db, clone, TEMPLATE } from "./data.js";
import {
    h, dialog, field, row, col, group, num, txt, area, sel, chk, radios, radioName, pickBtn, listDialog,
    dataPick, switchPick, varPick, imagePick, audioPick, audioText, facePick, charIndexPick, tonePick,
    locationPick, tabs, slider, listFiles, alertBox, imgUrl, loadImage, audioDialog, drawFace
} from "./ui.js";
import { moveRouteDialog, routeText } from "./moveroute.js";
import { getEnabledPluginsWithCommands, getPluginCommands, defaultArgs } from "../plugins/commands.js";
import { ParamTable } from "../plugins/params.js";
import { listPluginFiles } from "../plugins/store.js";

// ---------- textos auxiliares ----------
const P = n => db.pad(n);
const SW = id => `#${P(id)} ${db.switchName(id)}`;
const VR = id => `#${P(id)} ${db.variableName(id)}`;
const NM = (list, id) => db.name(list, id) || P(id);
const DIRS = { 0: "Retain", 2: "Down", 4: "Left", 6: "Right", 8: "Up" };
const VEHICLES = ["Boat", "Ship", "Airship"];
const SELF = ["A", "B", "C", "D"];
const ONOFF = ["ON", "OFF"];
const BACKGROUNDS = ["Window", "Dim", "Transparent"];
const POSITIONS = ["Top", "Middle", "Bottom"];
const PARAMS = () => (db.system.terms && db.system.terms.params) || ["Max HP", "Max MP", "Attack", "Defense", "M.Attack", "M.Defense", "Agility", "Luck"];

function evName(ctx, id) {
    const ev = ctx && ctx.map && ctx.map.events && ctx.map.events[id];
    return ev ? ev.name : "EV" + String(id).padStart(3, "0");
}
function charText(ctx, id) { return id < 0 ? "Player" : id === 0 ? "This Event" : evName(ctx, id); }
function operandText(op, type, val) { return (op === 0 ? "+ " : "- ") + (type === 0 ? val : `{${VR(val)}}`); }
function actorText(kind, id) {
    if (kind === 0) { return id === 0 ? "Entire Party" : NM("actors", id); }
    return `{${VR(id)}}`;
}
function enemyText(i) { return i < 0 ? "Entire Troop" : "#" + (i + 1); }
function wait(b) { return b ? " (Wait)" : ""; }
function toneText(t) { return `(${t.join(",")})`; }

// ---------- utilidades de diálogo ----------
function form(title, build, { width = "560px" } = {}) {
    let get;
    return dialog({ title, width, height: "auto", build: (b, d) => { get = build(b, d); }, onOk: () => { const v = get(); return v === false ? false : { v }; } })
        .then(r => r ? r.v : null);
}

function charOptions(ctx, { player = true, thisEvent = true } = {}) {
    const out = [];
    if (player) { out.push({ value: -1, label: "Player" }); }
    if (thisEvent) { out.push({ value: 0, label: "This Event" }); }
    const evs = (ctx && ctx.map && ctx.map.events) || [];
    for (const e of evs) { if (e) { out.push({ value: e.id, label: `${P(e.id)}:${e.name}` }); } }
    return out;
}
function enemyOptions(entire = true) {
    const out = entire ? [{ value: -1, label: "Entire Troop" }] : [];
    for (let i = 0; i < 8; i++) { out.push({ value: i, label: "#" + (i + 1) }); }
    return out;
}

// Operando "Constant / Variable" (operateValue).
function operandUI(op, type, val, { opLabels = ["Increase", "Decrease"], min = 1, max = 9999999 } = {}) {
    const opR = radios(opLabels.map((l, i) => ({ label: l, value: i })), op || 0, { inline: true });
    const c = num(type === 0 && val !== undefined ? val : min, { min: type === 0 ? Math.min(min, 0) : min, max });
    const v = varPick(type === 1 ? val : 1);
    const tR = radios([{ label: "Constant", value: 0, controls: [c] }, { label: "Variable", value: 1, controls: [v] }], type || 0);
    return {
        el: col(group("Operation", opR), group("Operand", tR)),
        get: () => [opR.get(), tR.get(), tR.get() === 0 ? c.get() : v.get()]
    };
}
// Alvo ator: Fixed (com Entire Party) / Variable.
function actorTargetUI(kind, id, { party = true } = {}) {
    const a = sel(db.options("actors", { none: party, noneLabel: "Entire Party" }), kind === 0 ? id : (party ? 0 : 1));
    const v = varPick(kind === 1 ? id : 1);
    const r = radios([{ label: "Fixed", value: 0, controls: [a] }, { label: "Variable", value: 1, controls: [v] }], kind || 0);
    return { el: group("Actor", r), get: () => [r.get(), r.get() === 0 ? a.get() : v.get()] };
}
// Designação direta / por variáveis de (mapa,) x, y.
function designationUI(kind, a, b, c, { withMap = true, allowMapChange = true } = {}) {
    const loc = locationPick(withMap ? (kind === 0 ? a : 0) || 1 : (db.api && db.api.currentMapId) || 1, kind === 0 ? (withMap ? b : a) || 0 : 0, kind === 0 ? (withMap ? c : b) || 0 : 0, { allowMapChange });
    const vm = varPick(kind === 1 && withMap ? a : 1), vx = varPick(kind === 1 ? (withMap ? b : a) : 1), vy = varPick(kind === 1 ? (withMap ? c : b) : 1);
    const varBox = col(withMap ? field("Map ID:", vm) : null, field("X:", vx), field("Y:", vy));
    varBox.enable = on => { for (const x of [vm, vx, vy]) { x.enable(on); } };
    const r = radios([{ label: "Direct designation", value: 0, controls: [loc] }, { label: "Designation with variables", value: 1, controls: [varBox] }], kind || 0);
    return {
        el: group("Location", r),
        get: () => {
            if (r.get() === 0) { const l = loc.get(); return withMap ? [0, l.mapId, l.x, l.y] : [0, l.x, l.y]; }
            return withMap ? [1, vm.get(), vx.get(), vy.get()] : [1, vx.get(), vy.get()];
        }
    };
}
function dirSel(v, { retain = true } = {}) {
    const opts = [];
    if (retain) { opts.push({ value: 0, label: "Retain" }); }
    for (const d of [2, 4, 6, 8]) { opts.push({ value: d, label: DIRS[d] }); }
    return sel(opts, v || (retain ? 0 : 2));
}
function waitChk(v) { return chk("Wait for Completion", v); }
function durationField(v, { max = 999 } = {}) { const n = num(v === undefined ? 60 : v, { min: 1, max }); return { n, el: field("Duration:", n, " frames (1/60 sec)") }; }
function audioCmd(folder, title) {
    return {
        text: p => [title.replace("Play ", "Play "), audioText(p[0])],
        async edit(p) {
            const a = clone(p ? p[0] : TEMPLATE.audio(""));
            const r = await audioDialog(folder, a);
            return r ? { p: [r] } : null;
        }
    };
}
function textEditor(lines, rows = 8) {
    return area((lines || []).join("\n"), { rows, mono: true });
}

// ---------- Texto da mensagem com guia de largura real ----------
// Largura útil da janela de mensagem como no runtime: Graphics.boxWidth = uiAreaWidth - 8,
// innerWidth = boxWidth - padding(12)*2; o texto começa em 4px, ou em faceWidth(144)+20 com rosto
// (Window_Message.newLineX). A fonte é a mainFontFilename do projeto no tamanho advanced.fontSize.
let gameFont = null;
function loadGameFont() {
    if (!gameFont) {
        const adv = (db.system && db.system.advanced) || {};
        const file = adv.mainFontFilename || "mplus-1m-regular.woff";
        const ff = new FontFace("evGameFont", `url("/project/fonts/${encodeURIComponent(file)}")`);
        gameFont = ff.load().then(f => { document.fonts.add(f); return true; }).catch(() => false);
    }
    return gameFont;
}
function msgMetrics(hasFace) {
    const adv = (db.system && db.system.advanced) || {};
    const inner = (adv.uiAreaWidth || 816) - 8 - 24;
    return { inner, avail: inner - (hasFace ? 164 : 4), fontSize: adv.fontSize || 26, fallback: adv.fallbackFonts || "Verdana, sans-serif" };
}
// Mede uma linha como Window_Base.processAllText (códigos de controle não ocupam espaço;
// \I[n] = 36px; \{ \} mudam o tamanho em 12; \FS[n]; \PX[n] reposiciona). Devolve, para cada
// caractere do texto bruto, o x final (para achar onde passa da janela).
function measureMessageLine(ctx, line, m) {
    let fs = m.fontSize, x = 0;
    const setFont = () => { ctx.font = `${fs}px evGameFont, ${m.fallback}`; };
    setFont();
    const ends = new Array(line.length).fill(0);
    let i = 0;
    const expand = t => t.replace(/\\V\[(\d+)\]/gi, "0").replace(/\\N\[(\d+)\]/gi, (a, n) => db.name("actors", Number(n)))
        .replace(/\\P\[(\d+)\]/gi, (a, n) => db.name("actors", (db.system.partyMembers || [])[Number(n) - 1])).replace(/\\G/gi, db.system.currencyUnit || "G");
    while (i < line.length) {
        const rest = line.slice(i);
        let mm;
        if ((mm = /^\\(V|N|P)\[(\d+)\]|^\\G/i.exec(rest))) { x += ctx.measureText(expand(mm[0])).width; }
        else if ((mm = /^\\I\[(\d+)\]/i.exec(rest))) { x += 36; }
        else if ((mm = /^\\FS\[(\d+)\]/i.exec(rest))) { fs = Number(mm[1]); setFont(); }
        else if ((mm = /^\\PX\[(\d+)\]/i.exec(rest))) { x = Number(mm[1]); }
        else if ((mm = /^\\\{/.exec(rest))) { if (fs <= 96) { fs += 12; setFont(); } }
        else if ((mm = /^\\\}/.exec(rest))) { if (fs >= 24) { fs -= 12; setFont(); } }
        else if ((mm = /^\\(C|PY)\[\d+\]|^\\[$.|!><^]/i.exec(rest))) { /* sem largura */ }
        else if ((mm = /^\\\\/.exec(rest))) { x += ctx.measureText("\\").width; }
        else { mm = [line[i]]; x += ctx.measureText(line[i]).width; }
        for (let k = 0; k < mm[0].length; k++) { ends[i + k] = x; }
        i += mm[0].length;
    }
    return { width: x, ends };
}
function messageTextEditor(lines, hasFace) {
    const ta = h("textarea", { class: "evArea evMsgText", rows: 5, spellcheck: "false", wrap: "off" });
    ta.value = (lines || []).join("\n");
    const mirror = h("div", { class: "evMsgMirror" });
    const gauge = h("div", { class: "evMsgGauge" });
    const wrap = h("div", { class: "evMsgWrap" }, mirror, ta);
    const el = h("div", { class: "evMsgEditor" }, wrap, gauge);
    const cv = document.createElement("canvas").getContext("2d");
    const refresh = () => {
        const m = msgMetrics(hasFace());
        const pad = 6;
        const k = Math.max(0.4, (wrap.clientWidth - pad * 2 - 20) / m.inner);
        const fsz = m.fontSize * k;
        for (const e of [ta, mirror]) {
            e.style.fontFamily = `evGameFont, ${m.fallback}`;
            e.style.fontSize = fsz + "px";
            e.style.lineHeight = Math.round(fsz * 1.45) + "px";
            e.style.padding = `4px ${pad}px`;
        }
        // guia vertical: onde termina a área útil da janela (para texto sem códigos de controle)
        const gx = pad + m.avail * k;
        mirror.style.backgroundImage = `linear-gradient(90deg, transparent ${gx - 1}px, #d04040 ${gx - 1}px, #d04040 ${gx + 1}px, transparent ${gx + 1}px)`;
        mirror.innerHTML = "";
        gauge.innerHTML = "";
        ta.value.split("\n").forEach((line, n) => {
            const r = measureMessageLine(cv, line, m);
            const cut = r.ends.findIndex(e => e > m.avail);
            const div = document.createElement("div");
            div.className = "evMirrorLine";
            if (cut >= 0) {
                div.append(document.createTextNode(line.slice(0, cut)), h("span", { class: "evOverflow" }, line.slice(cut)));
            } else { div.textContent = line || " "; }
            mirror.append(div);
            const over = r.width > m.avail;
            gauge.append(h("div", { class: "evGaugeRow" + (over ? " over" : "") + (n >= 4 ? " extra" : "") },
                `${n + 1}: ${Math.round(r.width)}/${m.avail}px`));
        });
        mirror.scrollTop = ta.scrollTop; mirror.scrollLeft = ta.scrollLeft;
    };
    ta.addEventListener("input", refresh);
    ta.addEventListener("scroll", () => { mirror.scrollTop = ta.scrollTop; mirror.scrollLeft = ta.scrollLeft; });
    new ResizeObserver(() => refresh()).observe(wrap);
    loadGameFont().then(() => document.fonts.ready).then(refresh);
    return { el, ta, refresh, get: () => ta.value, set: v => { ta.value = v; refresh(); } };
}

// ---------- Comandos ----------
export const CMD = {};
function def(code, d) { CMD[code] = Object.assign({ code }, d); }

// ===== Message =====
def(101, {
    name: "Show Text", cat: "msg", cont: 401,
    text: p => ["Text", [p[0] ? `${p[0]}(${p[1]})` : "None", BACKGROUNDS[p[2]] || "Window", POSITIONS[p[3]] || "Bottom", p[4] ? p[4] : null].filter(x => x !== null).join(", ")],
    contText: p => p[0],
    async edit(p, ctx, conts) {
        p = p || ["", 0, 0, 2, ""];
        return form("Show Text", body => {
            const face = facePick(p[0], p[1]);
            const name = txt(p[4] || "", { width: "220px" });
            const bg = sel(BACKGROUNDS.map((l, i) => ({ value: i, label: l })), p[2]);
            const pos = sel(POSITIONS.map((l, i) => ({ value: i, label: l })), p[3]);
            const text = messageTextEditor((conts || []).map(c => c[0]), () => face.get().name !== "");
            face.onChange(() => text.refresh());
            const batch = chk("Batch Entry", false);
            const insertAt = s => { const t = text.ta; const a = t.selectionStart; t.setRangeText(s, a, t.selectionEnd, "end"); t.focus(); text.refresh(); };
            const tools = row(
                h("button", { type: "button", class: "evBtn", onclick: async () => { const n = await colorPicker(); if (n !== null) { insertAt(`\\C[${n}]`); } } }, "Color…"),
                h("button", { type: "button", class: "evBtn", onclick: async () => { const n = await iconPicker(); if (n !== null) { insertAt(`\\I[${n}]`); } } }, "Icon…"),
                ...["\\V[1]", "\\N[1]", "\\P[1]", "\\G", "\\{", "\\}", "\\$", "\\.", "\\|", "\\!", "\\>", "\\<", "\\^"].map(c => h("button", { type: "button", class: "evBtn evCode", onclick: () => insertAt(c) }, c)),
                h("button", { type: "button", class: "evBtn", onclick: () => dialog({ title: "Preview", width: "900px", height: "auto", noCancel: true, build: pb => { const pv = h("div", { class: "evMsgPreview" }); pb.append(pv); renderMessagePreview(pv, face.get(), name.get(), text.get().split("\n")); } }) }, "Preview…"));
            body.append(h("div", { class: "evShowText" },
                col(h("div", null, "Face:"), face),
                col(row(field("Name:", name), field("Background:", bg), field("Window Position:", pos)), field("Text:", text), tools, batch)));
            setTimeout(() => text.ta.focus(), 50);
            return () => {
                const f = face.get();
                const lines = text.get().split("\n");
                while (lines.length > 1 && lines[lines.length - 1] === "") { lines.pop(); }
                const params = [f.name, f.index, bg.get(), pos.get(), name.get()];
                if (batch.get() && lines.length > 4) {
                    const split = [];
                    for (let i = 0; i < lines.length; i += 4) { split.push({ p: clone(params), conts: lines.slice(i, i + 4).map(l => [l]) }); }
                    return { p: params, conts: split[0].conts, split };
                }
                return { p: params, conts: lines.map(l => [l]) };
            };
        }, { width: "1060px" });
    },
    refs: () => []
});
def(102, {
    name: "Show Choices", cat: "msg",
    text: p => {
        const cancel = p[1] === -2 ? "Branch" : p[1] === -1 ? "Disallow" : "#" + (p[1] + 1);
        const def_ = p[2] === -1 ? "None" : "#" + ((p[2] || 0) + 1);
        return ["Show Choices", `${p[0].join(", ")} (${BACKGROUNDS[p[4] || 0]}, ${["Left", "Middle", "Right"][p[3] === undefined ? 2 : p[3]]}, ${def_}, ${cancel})`];
    },
    async edit(p) {
        p = p || [["Yes", "No"], 1, 0, 2, 0];
        return form("Show Choices", body => {
            const ch = [];
            for (let i = 0; i < 6; i++) { ch.push(txt(p[0][i] || "", { width: "100%" })); }
            const bg = sel(BACKGROUNDS.map((l, i) => ({ value: i, label: l })), p[4] || 0);
            const pos = sel(["Left", "Middle", "Right"].map((l, i) => ({ value: i, label: l })), p[3] === undefined ? 2 : p[3]);
            const defOpts = [{ value: -1, label: "None" }, ...[0, 1, 2, 3, 4, 5].map(i => ({ value: i, label: "Choice #" + (i + 1) }))];
            const cancelOpts = [{ value: -2, label: "Branch" }, { value: -1, label: "Disallow" }, ...[0, 1, 2, 3, 4, 5].map(i => ({ value: i, label: "Choice #" + (i + 1) }))];
            const df = sel(defOpts, p[2] === undefined ? 0 : p[2]);
            const cn = sel(cancelOpts, p[1]);
            body.append(h("div", { class: "evTwoCol" },
                group("Choices", ...ch.map((c, i) => field("#" + (i + 1) + ":", c))),
                col(field("Background:", bg), field("Window Position:", pos), field("Default:", df), field("Cancel:", cn))));
            return () => {
                const list = ch.map(c => c.get());
                while (list.length && list[list.length - 1] === "") { list.pop(); }
                if (!list.length) { list.push(""); }
                let cancel = cn.get();
                if (cancel >= list.length) { cancel = -1; }
                let d = df.get();
                if (d >= list.length) { d = -1; }
                return { p: [list, cancel, d, pos.get(), bg.get()] };
            };
        }, { width: "760px" });
    }
});
def(402, { name: "When", cat: "msg", text: p => ["When", p[1]], branch: true });
def(403, { name: "When Cancel", cat: "msg", text: () => ["When Cancel", ""], branch: true });
def(404, { name: "End", cat: "msg", text: () => ["End", ""], branch: true });
def(103, {
    name: "Input Number", cat: "msg",
    text: p => ["Input Number", `${VR(p[0])}, ${p[1]} digits`],
    async edit(p) {
        p = p || [1, 1];
        return form("Input Number", b => {
            const v = varPick(p[0]); const d = num(p[1], { min: 1, max: 8 });
            b.append(field("Variable:", v), field("Digits:", d));
            return () => ({ p: [v.get(), d.get()] });
        });
    },
    refs: p => [["variable", p[0]]]
});
const ITEM_TYPES = { 1: "Regular Item", 2: "Key Item", 3: "Hidden Item A", 4: "Hidden Item B" };
def(104, {
    name: "Select Item", cat: "msg",
    text: p => ["Select Item", `${VR(p[0])}, ${ITEM_TYPES[p[1] || 2]}`],
    async edit(p) {
        p = p || [1, 2];
        return form("Select Item", b => {
            const v = varPick(p[0]);
            const t = sel(Object.entries(ITEM_TYPES).map(([k, l]) => ({ value: Number(k), label: l })), p[1] || 2);
            b.append(field("Variable:", v), field("Item Type:", t));
            return () => ({ p: [v.get(), t.get()] });
        });
    },
    refs: p => [["variable", p[0]]]
});
def(105, {
    name: "Show Scrolling Text", cat: "msg", cont: 405,
    text: p => ["Text (S)", `Speed ${p[0]}${p[1] ? ", No Fast Forward" : ""}`],
    contText: p => p[0],
    async edit(p, ctx, conts) {
        p = p || [2, false];
        return form("Show Scrolling Text", b => {
            const t = textEditor((conts || []).map(c => c[0]), 12);
            const s = num(p[0], { min: 1, max: 8 }); const nf = chk("No Fast Forward", p[1]);
            b.append(field("Text:", t), row(field("Speed:", s), nf));
            return () => ({ p: [s.get(), nf.get()], conts: t.get().split("\n").map(l => [l]) });
        }, { width: "760px" });
    }
});

// ===== Game Progression =====
def(121, {
    name: "Control Switches", cat: "prog",
    text: p => ["Control Switches", `${p[0] === p[1] ? SW(p[0]) : `#${P(p[0])}..${P(p[1])}`} = ${ONOFF[p[2]]}`],
    async edit(p) {
        p = p || [1, 1, 0];
        return form("Control Switches", b => {
            const s = switchPick(p[0]); const a = num(p[0], { min: 1, max: 9999 }); const z = num(p[1], { min: 1, max: 9999 });
            const range = row(a, " ~ ", z); range.enable = on => { a.enable(on); z.enable(on); };
            const r = radios([{ label: "Single", value: 0, controls: [s] }, { label: "Range", value: 1, controls: [range] }], p[0] === p[1] ? 0 : 1);
            const v = radios([{ label: "ON", value: 0 }, { label: "OFF", value: 1 }], p[2], { inline: true });
            b.append(group("Switch", r), group("Operation", v));
            return () => {
                if (r.get() === 0) { return { p: [s.get(), s.get(), v.get()] }; }
                const x = Math.min(a.get(), z.get()), y = Math.max(a.get(), z.get());
                return { p: [x, y, v.get()] };
            };
        });
    },
    refs: p => { const r = []; for (let i = p[0]; i <= p[1] && r.length < 500; i++) { r.push(["switch", i]); } return r; }
});
const OPS = ["=", "+=", "-=", "*=", "/=", "%="];
const OTHER_DATA = ["Map ID", "Party Members", "Gold", "Steps", "Play Time", "Timer", "Save Count", "Battle Count", "Win Count", "Escape Count"];
const LAST_DATA = ["Last Used Skill ID", "Last Used Item ID", "Last Actor ID to Act", "Last Enemy Index to Act", "Last Target Actor ID", "Last Target Enemy Index"];
const CHAR_DATA = ["Map X", "Map Y", "Direction", "Screen X", "Screen Y"];
function actorDataNames() { return ["Level", "EXP", "HP", "MP", ...PARAMS().slice(0, 8), "TP"]; }
function enemyDataNames() { return ["HP", "MP", ...PARAMS().slice(0, 8), "TP"]; }
function gameDataText(t, a, b, ctx) {
    switch (t) {
        case 0: return `The number of ${NM("items", a)}`;
        case 1: return `The number of ${NM("weapons", a)}`;
        case 2: return `The number of ${NM("armors", a)}`;
        case 3: return `${actorDataNames()[b] || "?"} of ${NM("actors", a)}`;
        case 4: return `${enemyDataNames()[b] || "?"} of #${a + 1}`;
        case 5: return `${CHAR_DATA[b]} of ${charText(ctx, a)}`;
        case 6: return `Actor ID of the party member #${a + 1}`;
        case 7: return OTHER_DATA[a] || "?";
        case 8: return LAST_DATA[a] || "?";
    }
    return "?";
}
async function gameDataDialog(v, ctx) {
    v = v || [0, 1, 0];
    return form("Game Data", b => {
        const name = radioName();
        const it = sel(db.options("items"), v[0] === 0 ? v[1] : 1), wp = sel(db.options("weapons"), v[0] === 1 ? v[1] : 1), ar = sel(db.options("armors"), v[0] === 2 ? v[1] : 1);
        const ac = sel(db.options("actors"), v[0] === 3 ? v[1] : 1), acd = sel(actorDataNames().map((l, i) => ({ value: i, label: l })), v[0] === 3 ? v[2] : 0);
        const en = sel(enemyOptions(false), v[0] === 4 ? v[1] : 0), end = sel(enemyDataNames().map((l, i) => ({ value: i, label: l })), v[0] === 4 ? v[2] : 0);
        const chs = sel(charOptions(ctx), v[0] === 5 ? v[1] : -1), chd = sel(CHAR_DATA.map((l, i) => ({ value: i, label: l })), v[0] === 5 ? v[2] : 0);
        const pm = sel([1, 2, 3, 4, 5, 6, 7, 8].map(i => ({ value: i - 1, label: "Member #" + i })), v[0] === 6 ? v[1] : 0);
        const ot = sel(OTHER_DATA.map((l, i) => ({ value: i, label: l })), v[0] === 7 ? v[1] : 0);
        const ls = sel(LAST_DATA.map((l, i) => ({ value: i, label: l })), v[0] === 8 ? v[1] : 0);
        const r = radios([
            { label: "Item", value: 0, controls: [it] }, { label: "Weapon", value: 1, controls: [wp] }, { label: "Armor", value: 2, controls: [ar] },
            { label: "Actor", value: 3, controls: [ac, acd] }, { label: "Enemy", value: 4, controls: [en, end] }, { label: "Character", value: 5, controls: [chs, chd] },
            { label: "Party", value: 6, controls: [pm] }, { label: "Other", value: 7, controls: [ot] }, { label: "Last", value: 8, controls: [ls] }
        ], v[0], { name });
        b.append(r.el);
        return () => {
            switch (r.get()) {
                case 0: return [0, it.get(), 0]; case 1: return [1, wp.get(), 0]; case 2: return [2, ar.get(), 0];
                case 3: return [3, ac.get(), acd.get()]; case 4: return [4, en.get(), end.get()]; case 5: return [5, chs.get(), chd.get()];
                case 6: return [6, pm.get(), 0]; case 7: return [7, ot.get(), 0]; case 8: return [8, ls.get(), 0];
            }
            return v;
        };
    }, { width: "700px" });
}
def(122, {
    name: "Control Variables", cat: "prog",
    text: (p, ctx) => {
        const target = p[0] === p[1] ? VR(p[0]) : `#${P(p[0])}..${P(p[1])}`;
        let v;
        switch (p[3]) {
            case 0: v = String(p[4]); break;
            case 1: v = VR(p[4]); break;
            case 2: v = `Random ${p[4]}..${p[5]}`; break;
            case 3: v = gameDataText(p[4], p[5], p[6], ctx); break;
            case 4: v = p[4]; break;
        }
        return ["Control Variables", `${target} ${OPS[p[2]]} ${v}`];
    },
    async edit(p, ctx) {
        p = p || [1, 1, 0, 0, 0];
        return form("Control Variables", b => {
            const s = varPick(p[0]); const a = num(p[0], { min: 1, max: 9999 }); const z = num(p[1], { min: 1, max: 9999 });
            const range = row(a, " ~ ", z); range.enable = on => { a.enable(on); z.enable(on); };
            const tgt = radios([{ label: "Single", value: 0, controls: [s] }, { label: "Range", value: 1, controls: [range] }], p[0] === p[1] ? 0 : 1);
            const op = radios(["Set", "Add", "Sub", "Mul", "Div", "Mod"].map((l, i) => ({ label: l, value: i })), p[2], { inline: true });
            const c = num(p[3] === 0 ? p[4] : 0, { min: -99999999, max: 99999999 });
            const vv = varPick(p[3] === 1 ? p[4] : 1);
            const r1 = num(p[3] === 2 ? p[4] : 0, { min: -99999999, max: 99999999 }), r2 = num(p[3] === 2 ? p[5] : 0, { min: -99999999, max: 99999999 });
            const rnd = row(r1, " ~ ", r2); rnd.enable = on => { r1.enable(on); r2.enable(on); };
            let gd = p[3] === 3 ? [p[4], p[5], p[6]] : [0, 1, 0];
            const gdb = pickBtn(gd, x => gameDataText(x[0], x[1], x[2], ctx), cur => gameDataDialog(cur, ctx), { width: "280px" });
            const sc = txt(p[3] === 4 ? p[4] : "", { width: "320px" });
            const opd = radios([
                { label: "Constant", value: 0, controls: [c] }, { label: "Variable", value: 1, controls: [vv] }, { label: "Random", value: 2, controls: [rnd] },
                { label: "Game Data", value: 3, controls: [gdb] }, { label: "Script", value: 4, controls: [sc] }
            ], p[3]);
            b.append(group("Variable", tgt), group("Operation", op), group("Operand", opd));
            return () => {
                let x = s.get(), y = s.get();
                if (tgt.get() === 1) { x = Math.min(a.get(), z.get()); y = Math.max(a.get(), z.get()); }
                const head = [x, y, op.get(), opd.get()];
                switch (opd.get()) {
                    case 0: return { p: [...head, c.get()] };
                    case 1: return { p: [...head, vv.get()] };
                    case 2: return { p: [...head, Math.min(r1.get(), r2.get()), Math.max(r1.get(), r2.get())] };
                    case 3: return { p: [...head, ...gdb.get()] };
                    case 4: return { p: [...head, sc.get()] };
                }
            };
        }, { width: "720px" });
    },
    refs: p => {
        const r = [];
        for (let i = p[0]; i <= p[1] && r.length < 500; i++) { r.push(["variable", i]); }
        if (p[3] === 1) { r.push(["variable", p[4]]); }
        if (p[3] === 3 && p[4] === 0) { r.push(["item", p[5]]); }
        if (p[3] === 3 && p[4] === 1) { r.push(["weapon", p[5]]); }
        if (p[3] === 3 && p[4] === 2) { r.push(["armor", p[5]]); }
        return r;
    }
});
def(123, {
    name: "Control Self Switch", cat: "prog",
    text: p => ["Control Self Switch", `${p[0]} = ${ONOFF[p[1]]}`],
    async edit(p) {
        p = p || ["A", 0];
        return form("Control Self Switch", b => {
            const s = sel(SELF, p[0]); const v = radios([{ label: "ON", value: 0 }, { label: "OFF", value: 1 }], p[1], { inline: true });
            b.append(field("Self Switch:", s), group("Operation", v));
            return () => ({ p: [s.get(), v.get()] });
        });
    }
});
def(124, {
    name: "Control Timer", cat: "prog",
    text: p => ["Control Timer", p[0] === 0 ? `Start, ${Math.floor(p[1] / 60)} min ${p[1] % 60} sec` : "Stop"],
    async edit(p) {
        p = p || [0, 60];
        return form("Control Timer", b => {
            const m = num(Math.floor(p[1] / 60), { min: 0, max: 99 }), s = num(p[1] % 60, { min: 0, max: 59 });
            const t = row(m, " min ", s, " sec"); t.enable = on => { m.enable(on); s.enable(on); };
            const r = radios([{ label: "Start", value: 0, controls: [t] }, { label: "Stop", value: 1 }], p[0]);
            b.append(group("Operation", r));
            return () => ({ p: [r.get(), r.get() === 0 ? m.get() * 60 + s.get() : 0] });
        });
    }
});

// ===== Flow Control =====
const CB_ACTOR = ["In the Party", "Name", "Class", "Skill", "Weapon", "Armor", "State"];
const BUTTONS = [["ok", "OK"], ["cancel", "Cancel"], ["shift", "Shift"], ["down", "Down"], ["left", "Left"], ["right", "Right"], ["up", "Up"], ["pageup", "Pageup"], ["pagedown", "Pagedown"]];
const CMP = ["=", "≥", "≤", ">", "<", "≠"];
function condText(p, ctx) {
    switch (p[0]) {
        case 0: return `${SW(p[1])} is ${ONOFF[p[2]]}`;
        case 1: return `${VR(p[1])} ${CMP[p[4]]} ${p[2] === 0 ? p[3] : VR(p[3])}`;
        case 2: return `Self Switch ${p[1]} is ${ONOFF[p[2]]}`;
        case 3: return `Timer ${p[2] === 0 ? "≥" : "≤"} ${Math.floor(p[1] / 60)} min ${p[1] % 60} sec`;
        case 4: {
            const a = NM("actors", p[1]);
            switch (p[2]) {
                case 0: return `${a} is in the party`;
                case 1: return `Name of ${a} is ${p[3]}`;
                case 2: return `${a} is ${NM("classes", p[3])}`;
                case 3: return `${a} has learned ${NM("skills", p[3])}`;
                case 4: return `${a} has equipped ${NM("weapons", p[3])}`;
                case 5: return `${a} has equipped ${NM("armors", p[3])}`;
                case 6: return `${a} is affected by ${NM("states", p[3])}`;
            }
            break;
        }
        case 5: return p[2] === 0 ? `#${p[1] + 1} is appeared` : `#${p[1] + 1} is affected by ${NM("states", p[3])}`;
        case 6: return `${charText(ctx, p[1])} is facing ${DIRS[p[2]]}`;
        case 7: return `Gold ${["≥", "≤", "<"][p[2]]} ${p[1]}`;
        case 8: return `Party has ${NM("items", p[1])}`;
        case 9: return `Party has ${NM("weapons", p[1])}${p[2] ? " (Include Equipment)" : ""}`;
        case 10: return `Party has ${NM("armors", p[1])}${p[2] ? " (Include Equipment)" : ""}`;
        case 11: { const bt = BUTTONS.find(x => x[0] === p[1]); return `Button [${bt ? bt[1] : p[1]}] is ${["pressed down", "triggered", "repeated"][p[2] || 0]}`; }
        case 12: return `Script：${p[1]}`;
        case 13: return `${VEHICLES[p[1]]} is driven`;
    }
    return "?";
}
def(111, {
    name: "Conditional Branch", cat: "flow",
    text: (p, ctx) => ["If", condText(p, ctx)],
    async edit(p, ctx, conts, extra) {
        p = p || [0, 1, 0];
        const hasElse = extra ? extra.hasElse : false;
        return form("Conditional Branch", b => {
            const name = radioName();
            const t = p[0];
            const g = (k, i) => (t === k ? p[i] : undefined);
            // Aba 1
            const sw = switchPick(g(0, 1) || 1), swv = sel([{ value: 0, label: "ON" }, { value: 1, label: "OFF" }], g(0, 2) || 0);
            const vr = varPick(g(1, 1) || 1), vcmp = sel(["Equal to", "Greater than or Equal to", "Less than or Equal to", "Greater than", "Less than", "Not Equal to"].map((l, i) => ({ value: i, label: l })), g(1, 4) || 0);
            const vc = num(t === 1 && p[2] === 0 ? p[3] : 0, { min: -99999999, max: 99999999 }), vv = varPick(t === 1 && p[2] === 1 ? p[3] : 1);
            const vop = radios([{ label: "Constant", value: 0, controls: [vc] }, { label: "Variable", value: 1, controls: [vv] }], t === 1 ? p[2] : 0);
            const varBox = col(row(vr, vcmp), vop); varBox.enable = on => { vr.enable(on); vcmp.enable(on); vop.enable(on); };
            const ss = sel(SELF, g(2, 1) || "A"), ssv = sel([{ value: 0, label: "ON" }, { value: 1, label: "OFF" }], g(2, 2) || 0);
            const tcmp = sel([{ value: 0, label: "≥" }, { value: 1, label: "≤" }], g(3, 2) || 0), tm = num(t === 3 ? Math.floor(p[1] / 60) : 0, { min: 0, max: 99 }), ts = num(t === 3 ? p[1] % 60 : 0, { min: 0, max: 59 });
            const r1 = radios([
                { label: "Switch", value: 0, controls: [sw, swv] }, { label: "Variable", value: 1, controls: [varBox] },
                { label: "Self Switch", value: 2, controls: [ss, ssv] }, { label: "Timer", value: 3, controls: [tcmp, tm, "min", ts, "sec"] }
            ], t, { name });
            // Aba 2: Actor
            const ac = sel(db.options("actors"), g(4, 1) || 1);
            const an = txt(t === 4 && p[2] === 1 ? p[3] : "", { width: "200px" });
            const acl = sel(db.options("classes"), t === 4 && p[2] === 2 ? p[3] : 1), ask = sel(db.options("skills"), t === 4 && p[2] === 3 ? p[3] : 1);
            const awp = sel(db.options("weapons"), t === 4 && p[2] === 4 ? p[3] : 1), aar = sel(db.options("armors"), t === 4 && p[2] === 5 ? p[3] : 1), ast = sel(db.options("states"), t === 4 && p[2] === 6 ? p[3] : 1);
            const asub = radios([
                { label: "In the Party", value: 0 }, { label: "Name", value: 1, controls: [an] }, { label: "Class", value: 2, controls: [acl] },
                { label: "Skill", value: 3, controls: [ask] }, { label: "Weapon", value: 4, controls: [awp] }, { label: "Armor", value: 5, controls: [aar] },
                { label: "State", value: 6, controls: [ast] }
            ], t === 4 ? p[2] : 0);
            const actorBox = col(ac, asub); actorBox.enable = on => { ac.enable(on); asub.enable(on); };
            const r2 = radios([{ label: "Actor", value: 4, controls: [actorBox] }], t, { name });
            // Aba 3
            const en = sel(enemyOptions(false), g(5, 1) || 0), est = sel(db.options("states"), t === 5 && p[2] === 1 ? p[3] : 1);
            const esub = radios([{ label: "Appeared", value: 0 }, { label: "State", value: 1, controls: [est] }], t === 5 ? p[2] : 0, { inline: true });
            const enBox = col(en, esub); enBox.enable = on => { en.enable(on); esub.enable(on); };
            const chs = sel(charOptions(ctx), t === 6 ? p[1] : -1), chd = dirSel(t === 6 ? p[2] : 2, { retain: false });
            const veh = sel(VEHICLES.map((l, i) => ({ value: i, label: l })), g(13, 1) || 0);
            const r3 = radios([
                { label: "Enemy", value: 5, controls: [enBox] }, { label: "Character", value: 6, controls: [chs, "is facing", chd] },
                { label: "Vehicle", value: 13, controls: [veh, "is driven"] }
            ], t, { name });
            // Aba 4
            const gcmp = sel(["Greater than or equal to", "Less than or equal to", "Less than"].map((l, i) => ({ value: i, label: l })), g(7, 2) || 0), gv = num(g(7, 1) || 0, { min: 0, max: 99999999 });
            const it = sel(db.options("items"), g(8, 1) || 1);
            const wp = sel(db.options("weapons"), g(9, 1) || 1), wpe = chk("Include Equipment", g(9, 2));
            const ar = sel(db.options("armors"), g(10, 1) || 1), are = chk("Include Equipment", g(10, 2));
            const bt = sel(BUTTONS.map(([v, l]) => ({ value: v, label: l })), g(11, 1) || "ok"), btm = sel(["is being pressed", "is being triggered", "is being repeated"].map((l, i) => ({ value: i, label: l })), g(11, 2) || 0);
            const sc = txt(g(12, 1) || "", { width: "380px" });
            const r4 = radios([
                { label: "Gold", value: 7, controls: [gcmp, gv] }, { label: "Item", value: 8, controls: [it] },
                { label: "Weapon", value: 9, controls: [wp, wpe] }, { label: "Armor", value: 10, controls: [ar, are] },
                { label: "Button", value: 11, controls: [bt, btm] }, { label: "Script", value: 12, controls: [sc] }
            ], t, { name });
            const groups = [r1, r2, r3, r4];
            for (const gr of groups) { gr.el.addEventListener("change", () => groups.forEach(x => x.sync())); }
            const tb = tabs([{ label: "1", content: [r1] }, { label: "2", content: [r2] }, { label: "3", content: [r3] }, { label: "4", content: [r4] }],
                t <= 3 ? 0 : t === 4 ? 1 : (t === 5 || t === 6 || t === 13) ? 2 : 3);
            const el = chk("Create Else Branch", hasElse);
            b.append(tb.el, el.el);
            return () => {
                const kind = groups.map(x => x.has() ? x.get() : null).find(x => x !== null);
                let out;
                switch (kind) {
                    case 0: out = [0, sw.get(), swv.get()]; break;
                    case 1: out = [1, vr.get(), vop.get(), vop.get() === 0 ? vc.get() : vv.get(), vcmp.get()]; break;
                    case 2: out = [2, ss.get(), ssv.get()]; break;
                    case 3: out = [3, tm.get() * 60 + ts.get(), tcmp.get()]; break;
                    case 4: {
                        const s = asub.get();
                        const n = [0, an.get(), acl.get(), ask.get(), awp.get(), aar.get(), ast.get()][s];
                        out = [4, ac.get(), s]; if (s > 0) { out.push(n); }
                        break;
                    }
                    case 5: out = [5, en.get(), esub.get()]; if (esub.get() === 1) { out.push(est.get()); } break;
                    case 6: out = [6, chs.get(), chd.get()]; break;
                    case 7: out = [7, gv.get(), gcmp.get()]; break;
                    case 8: out = [8, it.get()]; break;
                    case 9: out = [9, wp.get(), wpe.get()]; break;
                    case 10: out = [10, ar.get(), are.get()]; break;
                    case 11: out = [11, bt.get(), btm.get()]; break;
                    case 12: out = [12, sc.get()]; break;
                    case 13: out = [13, veh.get()]; break;
                    default: out = p;
                }
                return { p: out, else: el.get() };
            };
        }, { width: "820px" });
    },
    refs: p => {
        switch (p[0]) {
            case 0: return [["switch", p[1]]];
            case 1: return p[2] === 1 ? [["variable", p[1]], ["variable", p[3]]] : [["variable", p[1]]];
            case 8: return [["item", p[1]]];
            case 9: return [["weapon", p[1]]];
            case 10: return [["armor", p[1]]];
            case 4: return p[2] === 4 ? [["weapon", p[3]]] : p[2] === 5 ? [["armor", p[3]]] : [];
        }
        return [];
    }
});
def(411, { name: "Else", cat: "flow", text: () => ["Else", ""], branch: true });
def(412, { name: "End", cat: "flow", text: () => ["End", ""], branch: true });
def(112, { name: "Loop", cat: "flow", text: () => ["Loop", ""], noParams: true });
def(413, { name: "Repeat Above", cat: "flow", text: () => ["Repeat Above", ""], branch: true });
def(113, { name: "Break Loop", cat: "flow", text: () => ["Break Loop", ""], noParams: true });
def(115, { name: "Exit Event Processing", cat: "flow", text: () => ["Exit Event Processing", ""], noParams: true });
def(117, {
    name: "Common Event", cat: "flow",
    text: p => ["Common Event", NM("commonEvents", p[0])],
    async edit(p) {
        p = p || [1];
        return form("Common Event", b => { const c = sel(db.options("commonEvents"), p[0]); b.append(field("Common Event:", c)); return () => ({ p: [c.get()] }); });
    },
    refs: p => [["common", p[0]]]
});
def(118, {
    name: "Label", cat: "flow", text: p => ["Label", p[0]],
    async edit(p) { p = p || [""]; return form("Label", b => { const t = txt(p[0], { width: "300px" }); b.append(field("Name:", t)); return () => ({ p: [t.get()] }); }); }
});
def(119, {
    name: "Jump to Label", cat: "flow", text: p => ["Jump to Label", p[0]],
    async edit(p, ctx) {
        p = p || [""];
        const labels = [...new Set((ctx.list || []).filter(c => c.code === 118).map(c => c.parameters[0]))];
        return form("Jump to Label", b => {
            const t = txt(p[0], { width: "300px" });
            const dl = h("datalist", { id: "evLabels" }, ...labels.map(l => h("option", { value: l })));
            t.el.setAttribute("list", "evLabels");
            b.append(field("Name:", t), dl);
            return () => ({ p: [t.get()] });
        });
    }
});
def(108, {
    name: "Comment", cat: "comment", cont: 408,
    text: p => ["Comment", p[0]], contText: p => p[0],
    async edit(p, ctx, conts) {
        const lines = p ? [p[0], ...(conts || []).map(c => c[0])] : [];
        return form("Comment", b => {
            const t = textEditor(lines, 10); b.append(t.el);
            return () => { const l = t.get().split("\n"); return { p: [l[0]], conts: l.slice(1).map(x => [x]) }; };
        }, { width: "760px" });
    }
});

// ===== Party =====
def(125, {
    name: "Change Gold", cat: "party",
    text: p => ["Change Gold", operandText(p[0], p[1], p[2])],
    async edit(p) { p = p || [0, 0, 0]; return form("Change Gold", b => { const o = operandUI(p[0], p[1], p[2]); b.append(o.el); return () => ({ p: o.get() }); }); },
    refs: p => (p[1] === 1 ? [["variable", p[2]]] : [])
});
function changeItemCmd(code, list, title, label, equip) {
    def(code, {
        name: title, cat: "party",
        text: p => [title, `${NM(list, p[0])} ${operandText(p[1], p[2], p[3])}${equip && p[4] ? " (Include Equipment)" : ""}`],
        async edit(p) {
            p = p || [1, 0, 0, 1, false];
            return form(title, b => {
                const it = sel(db.options(list), p[0]); const o = operandUI(p[1], p[2], p[3]);
                const ie = equip ? chk("Include Equipment", p[4]) : null;
                b.append(field(label + ":", it), o.el, ie ? ie.el : null);
                return () => ({ p: equip ? [it.get(), ...o.get(), ie.get()] : [it.get(), ...o.get()] });
            });
        },
        refs: p => [[list.slice(0, -1), p[0]], ...(p[2] === 1 ? [["variable", p[3]]] : [])]
    });
}
changeItemCmd(126, "items", "Change Items", "Item", false);
changeItemCmd(127, "weapons", "Change Weapons", "Weapon", true);
changeItemCmd(128, "armors", "Change Armors", "Armor", true);
def(129, {
    name: "Change Party Member", cat: "party",
    text: p => ["Change Party Member", `${p[1] === 0 ? "Add" : "Remove"} ${NM("actors", p[0])}${p[1] === 0 && p[2] ? " (Initialize)" : ""}`],
    async edit(p) {
        p = p || [1, 0, true];
        return form("Change Party Member", b => {
            const a = sel(db.options("actors"), p[0]); const ini = chk("Initialize", p[2]);
            const o = radios([{ label: "Add", value: 0, controls: [ini] }, { label: "Remove", value: 1 }], p[1]);
            b.append(field("Actor:", a), group("Operation", o));
            return () => ({ p: [a.get(), o.get(), o.get() === 0 ? ini.get() : false] });
        });
    }
});

// ===== Actor =====
function actorValueCmd(code, title, { death = false, levelUp = false, param = false } = {}) {
    def(code, {
        name: title, cat: "actor",
        text: p => {
            if (param) { return [title, `${actorText(p[0], p[1])}, ${PARAMS()[p[2]]} ${operandText(p[3], p[4], p[5])}`]; }
            return [title, `${actorText(p[0], p[1])}, ${operandText(p[2], p[3], p[4])}${(death && p[5]) ? " (Allow Knockout)" : ""}${(levelUp && p[5]) ? " (Show Level Up)" : ""}`];
        },
        async edit(p) {
            p = p || (param ? [0, 1, 0, 0, 0, 1] : [0, 0, 0, 0, 1, false]);
            return form(title, b => {
                const a = actorTargetUI(p[0], p[1]);
                const pr = param ? sel(PARAMS().slice(0, 8).map((l, i) => ({ value: i, label: l })), p[2]) : null;
                const o = param ? operandUI(p[3], p[4], p[5]) : operandUI(p[2], p[3], p[4]);
                const ex = death ? chk("Allow Knockout", p[5]) : levelUp ? chk("Show Level Up", p[5]) : null;
                b.append(a.el, pr ? field("Parameter:", pr) : null, o.el, ex ? ex.el : null);
                return () => {
                    if (param) { return { p: [...a.get(), pr.get(), ...o.get()] }; }
                    const out = [...a.get(), ...o.get()];
                    if (ex) { out.push(ex.get()); }
                    return { p: out };
                };
            });
        },
        refs: p => [...(p[0] === 1 ? [["variable", p[1]]] : []), ...((param ? p[4] : p[3]) === 1 ? [["variable", param ? p[5] : p[4]]] : [])]
    });
}
actorValueCmd(311, "Change HP", { death: true });
actorValueCmd(312, "Change MP");
actorValueCmd(326, "Change TP");
actorValueCmd(315, "Change EXP", { levelUp: true });
actorValueCmd(316, "Change Level", { levelUp: true });
actorValueCmd(317, "Change Parameter", { param: true });
def(313, {
    name: "Change State", cat: "actor",
    text: p => ["Change State", `${actorText(p[0], p[1])}, ${p[2] === 0 ? "+" : "-"} ${NM("states", p[3])}`],
    async edit(p) {
        p = p || [0, 0, 0, 1];
        return form("Change State", b => {
            const a = actorTargetUI(p[0], p[1]); const o = radios([{ label: "Add", value: 0 }, { label: "Remove", value: 1 }], p[2], { inline: true });
            const s = sel(db.options("states"), p[3]);
            b.append(a.el, group("Operation", o), field("State:", s));
            return () => ({ p: [...a.get(), o.get(), s.get()] });
        });
    }
});
def(314, {
    name: "Recover All", cat: "actor", text: p => ["Recover All", actorText(p[0], p[1])],
    async edit(p) { p = p || [0, 0]; return form("Recover All", b => { const a = actorTargetUI(p[0], p[1]); b.append(a.el); return () => ({ p: a.get() }); }); }
});
def(318, {
    name: "Change Skill", cat: "actor",
    text: p => ["Change Skill", `${actorText(p[0], p[1])}, ${p[2] === 0 ? "+" : "-"} ${NM("skills", p[3])}`],
    async edit(p) {
        p = p || [0, 1, 0, 1];
        return form("Change Skill", b => {
            const a = actorTargetUI(p[0], p[1]); const o = radios([{ label: "Learn", value: 0 }, { label: "Forget", value: 1 }], p[2], { inline: true });
            const s = sel(db.options("skills"), p[3]);
            b.append(a.el, group("Operation", o), field("Skill:", s));
            return () => ({ p: [...a.get(), o.get(), s.get()] });
        });
    }
});
def(319, {
    name: "Change Equipment", cat: "actor",
    text: p => ["Change Equipment", `${NM("actors", p[0])}, ${(db.system.equipTypes || [])[p[1]] || p[1]} = ${p[2] ? NM(p[1] === 1 ? "weapons" : "armors", p[2]) : "None"}`],
    async edit(p) {
        p = p || [1, 1, 0];
        return form("Change Equipment", b => {
            const a = sel(db.options("actors"), p[0]);
            const et = sel(db.nameListOptions(db.system.equipTypes || []), p[1]);
            const it = sel([], p[2]);
            const fill = v => {
                const etype = et.get();
                const list = etype === 1 ? "weapons" : "armors";
                const opts = [{ value: 0, label: "None" }];
                (db[list] || []).forEach((o, i) => { if (o && (etype === 1 || o.etypeId === etype)) { opts.push({ value: i, label: P(i) + " " + o.name }); } });
                it.setOptions(opts, v);
            };
            et.onChange(() => fill(0));
            fill(p[2]);
            b.append(field("Actor:", a), field("Equipment Type:", et), field("Equipment Item:", it));
            return () => ({ p: [a.get(), et.get(), it.get()] });
        });
    },
    refs: p => (p[2] ? [[p[1] === 1 ? "weapon" : "armor", p[2]]] : [])
});
function actorTextCmd(code, title, label, idx = 1, multiline = false) {
    def(code, {
        name: title, cat: "actor",
        text: p => [title, `${NM("actors", p[0])}, ${String(p[1]).replace(/\n/g, " ")}`],
        async edit(p) {
            p = p || [1, ""];
            return form(title, b => {
                const a = sel(db.options("actors"), p[0]); const t = multiline ? area(p[1], { rows: 3 }) : txt(p[1], { width: "300px" });
                b.append(field("Actor:", a), field(label + ":", t));
                return () => ({ p: [a.get(), t.get()] });
            });
        }
    });
}
actorTextCmd(320, "Change Name", "Name");
actorTextCmd(324, "Change Nickname", "Nickname");
actorTextCmd(325, "Change Profile", "Profile", 1, true);
def(321, {
    name: "Change Class", cat: "actor",
    text: p => ["Change Class", `${NM("actors", p[0])}, ${NM("classes", p[1])}${p[2] ? " (Save EXP)" : ""}`],
    async edit(p) {
        p = p || [1, 1, false];
        return form("Change Class", b => {
            const a = sel(db.options("actors"), p[0]); const c = sel(db.options("classes"), p[1]); const k = chk("Save EXP", p[2]);
            b.append(field("Actor:", a), field("Class:", c), k.el);
            return () => ({ p: [a.get(), c.get(), k.get()] });
        });
    }
});

// ===== Movement =====
def(201, {
    name: "Transfer Player", cat: "move",
    text: p => {
        const loc = p[0] === 0 ? `${db.mapName(p[1])} (${p[2]},${p[3]})` : `{${VR(p[1])}} ({${VR(p[2])}},{${VR(p[3])}})`;
        const opts = [];
        if (p[4]) { opts.push("Direction: " + DIRS[p[4]]); }
        if (p[5]) { opts.push("Fade: " + ["Black", "White", "None"][p[5]]); }
        return ["Transfer Player", loc + (opts.length ? ` (${opts.join(", ")})` : "")];
    },
    async edit(p) {
        p = p || [0, (db.api && db.api.currentMapId) || 1, 0, 0, 0, 0];
        return form("Transfer Player", b => {
            const d = designationUI(p[0], p[1], p[2], p[3]);
            const dir = dirSel(p[4]); const fade = sel(["Black", "White", "None"].map((l, i) => ({ value: i, label: l })), p[5]);
            b.append(d.el, row(field("Direction:", dir), field("Fade:", fade)));
            return () => ({ p: [...d.get(), dir.get(), fade.get()] });
        }, { width: "640px" });
    },
    refs: p => (p[0] === 1 ? [["variable", p[1]], ["variable", p[2]], ["variable", p[3]]] : [])
});
def(202, {
    name: "Set Vehicle Location", cat: "move",
    text: p => ["Set Vehicle Location", `${VEHICLES[p[0]]}, ${p[1] === 0 ? `${db.mapName(p[2])} (${p[3]},${p[4]})` : `{${VR(p[2])}} ({${VR(p[3])}},{${VR(p[4])}})`}`],
    async edit(p) {
        p = p || [0, 0, (db.api && db.api.currentMapId) || 1, 0, 0];
        return form("Set Vehicle Location", b => {
            const v = sel(VEHICLES.map((l, i) => ({ value: i, label: l })), p[0]);
            const d = designationUI(p[1], p[2], p[3], p[4]);
            b.append(field("Vehicle:", v), d.el);
            return () => ({ p: [v.get(), ...d.get()] });
        }, { width: "640px" });
    },
    refs: p => (p[1] === 1 ? [["variable", p[2]], ["variable", p[3]], ["variable", p[4]]] : [])
});
def(203, {
    name: "Set Event Location", cat: "move",
    text: (p, ctx) => {
        let loc;
        if (p[1] === 0) { loc = `(${p[2]},${p[3]})`; } else if (p[1] === 1) { loc = `({${VR(p[2])}},{${VR(p[3])}})`; } else { loc = `Exchange with ${charText(ctx, p[2])}`; }
        return ["Set Event Location", `${charText(ctx, p[0])}, ${loc}${p[4] ? ` (Direction: ${DIRS[p[4]]})` : ""}`];
    },
    async edit(p, ctx) {
        p = p || [0, 0, 0, 0, 0];
        return form("Set Event Location", b => {
            const ev = sel(charOptions(ctx, { player: false }), p[0]);
            const loc = locationPick((db.api && db.api.currentMapId) || 1, p[1] === 0 ? p[2] : 0, p[1] === 0 ? p[3] : 0, { allowMapChange: false });
            const vx = varPick(p[1] === 1 ? p[2] : 1), vy = varPick(p[1] === 1 ? p[3] : 1);
            const vb = row(field("X:", vx), field("Y:", vy)); vb.enable = on => { vx.enable(on); vy.enable(on); };
            const ex = sel(charOptions(ctx, { player: false }), p[1] === 2 ? p[2] : 0);
            const r = radios([{ label: "Direct designation", value: 0, controls: [loc] }, { label: "Designation with variables", value: 1, controls: [vb] }, { label: "Exchange with another event", value: 2, controls: [ex] }], p[1]);
            const dir = dirSel(p[4]);
            b.append(field("Event:", ev), group("Location", r), field("Direction:", dir));
            return () => {
                const k = r.get();
                if (k === 0) { const l = loc.get(); return { p: [ev.get(), 0, l.x, l.y, dir.get()] }; }
                if (k === 1) { return { p: [ev.get(), 1, vx.get(), vy.get(), dir.get()] }; }
                return { p: [ev.get(), 2, ex.get(), 0, dir.get()] };
            };
        }, { width: "640px" });
    },
    refs: p => (p[1] === 1 ? [["variable", p[2]], ["variable", p[3]]] : [])
});
const SPEED_NAMES = ["", "1: x8 Slower", "2: x4 Slower", "3: x2 Slower", "4: Normal", "5: x2 Faster", "6: x4 Faster"];
def(204, {
    name: "Scroll Map", cat: "move",
    text: p => ["Scroll Map", `${DIRS[p[0]]}, ${p[1]}, ${p[2]}${wait(p[3])}`],
    async edit(p) {
        p = p || [2, 1, 4, true];
        return form("Scroll Map", b => {
            const d = dirSel(p[0], { retain: false }); const n = num(p[1], { min: 1, max: 100 });
            const s = sel(SPEED_NAMES.map((l, i) => ({ value: i, label: l })).slice(1), p[2]); const w = waitChk(p[3]);
            b.append(row(field("Direction:", d), field("Distance:", n), field("Speed:", s)), w.el);
            return () => ({ p: [d.get(), n.get(), s.get(), w.get()] });
        });
    }
});
def(205, {
    name: "Set Movement Route", cat: "move", cont: 505,
    text: (p, ctx) => {
        const o = [];
        if (p[1].repeat) { o.push("Repeat"); } if (p[1].skippable) { o.push("Skip"); } if (p[1].wait) { o.push("Wait"); }
        return ["Set Movement Route", `${charText(ctx, p[0])}${o.length ? " (" + o.join(", ") + ")" : ""}`];
    },
    contText: p => "◇" + routeText(p[0]),
    async edit(p, ctx) {
        p = p || [-1, { list: [{ code: 0, parameters: [] }], repeat: false, skippable: false, wait: true }];
        const r = await moveRouteDialog(p[1], { target: p[0], targets: charOptions(ctx), previewStart: t => routePreviewStart(ctx, t) });
        if (!r) { return null; }
        const route = r.route;
        return { p: [r.target, route], conts: route.list.filter(c => c.code !== 0).map(c => [c]) };
    },
    refs: p => p[1].list.filter(c => c.code === 27 || c.code === 28).map(c => ["switch", c.parameters[0]])
});
// Posição inicial da prévia de rota: evento do mapa (ou "This Event") ou jogador na posição inicial.
function routePreviewStart(ctx, target) {
    if (!ctx || !ctx.map || !ctx.mapId) { return null; }
    if (target < 0) {
        const s = db.system;
        return s.startMapId === ctx.mapId ? { mapId: ctx.mapId, x: s.startX, y: s.startY, d: 2 } : null;
    }
    if (target === 0 && ctx.eventPos) { return { mapId: ctx.mapId, ...ctx.eventPos }; }
    const ev = ctx.map.events[target === 0 ? ctx.eventId : target];
    if (!ev) { return null; }
    const pg = ev.pages[0];
    return { mapId: ctx.mapId, x: ev.x, y: ev.y, d: (pg && pg.image.direction) || 2, directionFix: pg && pg.directionFix };
}
def(206, { name: "Get on/off Vehicle", cat: "move", text: () => ["Get on/off Vehicle", ""], noParams: true });

// ===== Character =====
def(211, {
    name: "Change Transparency", cat: "char", text: p => ["Change Transparency", ONOFF[p[0]]],
    async edit(p) { p = p || [0]; return form("Change Transparency", b => { const r = radios([{ label: "ON", value: 0 }, { label: "OFF", value: 1 }], p[0], { inline: true }); b.append(group("Transparency", r)); return () => ({ p: [r.get()] }); }); }
});
def(216, {
    name: "Change Player Followers", cat: "char", text: p => ["Change Player Followers", ONOFF[p[0]]],
    async edit(p) { p = p || [0]; return form("Change Player Followers", b => { const r = radios([{ label: "ON", value: 0 }, { label: "OFF", value: 1 }], p[0], { inline: true }); b.append(group("Player Followers", r)); return () => ({ p: [r.get()] }); }); }
});
def(217, { name: "Gather Followers", cat: "char", text: () => ["Gather Followers", ""], noParams: true });
def(212, {
    name: "Show Animation", cat: "char",
    text: (p, ctx) => ["Show Animation", `${charText(ctx, p[0])}, ${NM("animations", p[1])}${wait(p[2])}`],
    async edit(p, ctx) {
        p = p || [-1, 1, false];
        return form("Show Animation", b => {
            const c = sel(charOptions(ctx), p[0]); const a = sel(db.options("animations"), p[1]); const w = waitChk(p[2]);
            b.append(field("Character:", c), field("Animation:", a), w.el);
            return () => ({ p: [c.get(), a.get(), w.get()] });
        });
    }
});
const BALLOONS = ["", "Exclamation", "Question", "Music Note", "Heart", "Anger", "Sweat", "Frustration", "Silence", "Light Bulb", "Zzz", "User-defined 1", "User-defined 2", "User-defined 3", "User-defined 4", "User-defined 5"];
def(213, {
    name: "Show Balloon Icon", cat: "char",
    text: (p, ctx) => ["Show Balloon Icon", `${charText(ctx, p[0])}, ${BALLOONS[p[1]]}${wait(p[2])}`],
    async edit(p, ctx) {
        p = p || [-1, 1, false];
        return form("Show Balloon Icon", b => {
            const c = sel(charOptions(ctx), p[0]); const a = sel(BALLOONS.map((l, i) => ({ value: i, label: l })).slice(1), p[1]); const w = waitChk(p[2]);
            b.append(field("Character:", c), field("Balloon Icon:", a), w.el);
            return () => ({ p: [c.get(), a.get(), w.get()] });
        });
    }
});
def(214, { name: "Erase Event", cat: "char", text: () => ["Erase Event", ""], noParams: true });

// ===== Picture =====
const ORIGINS = ["Upper Left", "Center"];
const BLENDS = ["Normal", "Additive", "Multiply", "Screen"];
const EASING = ["Constant speed", "Slow start", "Slow end", "Slow start and end"];
function pictureUI(p, move) {
    const nm = move ? null : imagePick("pictures", p[1]);
    const org = sel(ORIGINS.map((l, i) => ({ value: i, label: l })), p[2]);
    const x = num(p[3] === 0 ? p[4] : 0, { min: -9999, max: 9999 }), y = num(p[3] === 0 ? p[5] : 0, { min: -9999, max: 9999 });
    const vx = varPick(p[3] === 1 ? p[4] : 1), vy = varPick(p[3] === 1 ? p[5] : 1);
    const db1 = row("X:", x, "Y:", y); db1.enable = on => { x.enable(on); y.enable(on); };
    const db2 = row("X:", vx, "Y:", vy); db2.enable = on => { vx.enable(on); vy.enable(on); };
    const pos = radios([{ label: "Direct designation", value: 0, controls: [db1] }, { label: "Designation with variables", value: 1, controls: [db2] }], p[3]);
    const sw = num(p[6], { min: -2000, max: 2000 }), sh = num(p[7], { min: -2000, max: 2000 });
    const op = num(p[8], { min: 0, max: 255 }); const bl = sel(BLENDS.map((l, i) => ({ value: i, label: l })), p[9]);
    return {
        nm,
        el: col(nm ? field("Image:", nm) : null, group("Position", field("Origin:", org), pos), row(group("Scale", field("Width:", sw, "%"), field("Height:", sh, "%")), group("Blend", field("Opacity:", op), field("Mode:", bl)))),
        get: () => [org.get(), pos.get(), pos.get() === 0 ? x.get() : vx.get(), pos.get() === 0 ? y.get() : vy.get(), sw.get(), sh.get(), op.get(), bl.get()]
    };
}
function picPos(p) { return p[3] === 0 ? `(${p[4]},${p[5]})` : `({${VR(p[4])}},{${VR(p[5])}})`; }
def(231, {
    name: "Show Picture", cat: "pic",
    text: p => ["Show Picture", `#${p[0]}, ${p[1] || "None"}, ${ORIGINS[p[2]]} ${picPos(p)}, (${p[6]}%,${p[7]}%), ${p[8]}, ${BLENDS[p[9]]}`],
    async edit(p) {
        p = p || [1, "", 0, 0, 0, 0, 100, 100, 255, 0];
        return form("Show Picture", b => {
            const n = num(p[0], { min: 1, max: 100 }); const ui = pictureUI(p, false);
            b.append(field("Number:", n), ui.el);
            return () => { const v = ui.get(); return { p: [n.get(), ui.nm.get(), ...v] }; };
        }, { width: "760px" });
    }
});
def(232, {
    name: "Move Picture", cat: "pic",
    text: p => ["Move Picture", `#${p[0]}, ${ORIGINS[p[2]]} ${picPos(p)}, (${p[6]}%,${p[7]}%), ${p[8]}, ${BLENDS[p[9]]}, ${p[10]} frames${wait(p[11])}${p[12] ? ", " + EASING[p[12]] : ""}`],
    async edit(p) {
        p = p || [1, 0, 0, 0, 0, 0, 100, 100, 255, 0, 60, true, 0];
        return form("Move Picture", b => {
            const n = num(p[0], { min: 1, max: 100 }); const ui = pictureUI(p, true);
            const d = durationField(p[10]); const w = waitChk(p[11]); const e = sel(EASING.map((l, i) => ({ value: i, label: l })), p[12] || 0);
            b.append(row(field("Number:", n), field("Easing:", e)), ui.el, row(d.el, w.el));
            return () => { const v = ui.get(); return { p: [n.get(), 0, ...v, d.n.get(), w.get(), e.get()] }; };
        }, { width: "760px" });
    }
});
def(233, {
    name: "Rotate Picture", cat: "pic", text: p => ["Rotate Picture", `#${p[0]}, ${p[1]}`],
    async edit(p) {
        p = p || [1, 10];
        return form("Rotate Picture", b => { const n = num(p[0], { min: 1, max: 100 }); const s = num(p[1], { min: -90, max: 90 }); b.append(field("Number:", n), field("Rotation Speed:", s)); return () => ({ p: [n.get(), s.get()] }); });
    }
});
def(234, {
    name: "Tint Picture", cat: "pic", text: p => ["Tint Picture", `#${p[0]}, ${toneText(p[1])}, ${p[2]} frames${wait(p[3])}`],
    async edit(p) {
        p = p || [1, [0, 0, 0, 0], 60, true];
        return form("Tint Picture", b => {
            const n = num(p[0], { min: 1, max: 100 }); const t = tonePick(p[1]); const d = durationField(p[2]); const w = waitChk(p[3]);
            b.append(field("Number:", n), group("Color Tone", t), row(d.el, w.el));
            return () => ({ p: [n.get(), t.get(), d.n.get(), w.get()] });
        }, { width: "700px" });
    }
});
def(235, {
    name: "Erase Picture", cat: "pic", text: p => ["Erase Picture", `#${p[0]}`],
    async edit(p) { p = p || [1]; return form("Erase Picture", b => { const n = num(p[0], { min: 1, max: 100 }); b.append(field("Number:", n)); return () => ({ p: [n.get()] }); }); }
});

// ===== Timing / Screen =====
def(230, {
    name: "Wait", cat: "time", text: p => ["Wait", `${p[0]} frames`],
    async edit(p) { p = p || [60]; return form("Wait", b => { const d = durationField(p[0]); b.append(d.el); return () => ({ p: [d.n.get()] }); }); }
});
def(221, { name: "Fadeout Screen", cat: "screen", text: () => ["Fadeout Screen", ""], noParams: true });
def(222, { name: "Fadein Screen", cat: "screen", text: () => ["Fadein Screen", ""], noParams: true });
def(223, {
    name: "Tint Screen", cat: "screen", text: p => ["Tint Screen", `${toneText(p[0])}, ${p[1]} frames${wait(p[2])}`],
    async edit(p) {
        p = p || [[0, 0, 0, 0], 60, true];
        return form("Tint Screen", b => { const t = tonePick(p[0]); const d = durationField(p[1]); const w = waitChk(p[2]); b.append(group("Color Tone", t), row(d.el, w.el)); return () => ({ p: [t.get(), d.n.get(), w.get()] }); }, { width: "700px" });
    }
});
def(224, {
    name: "Flash Screen", cat: "screen", text: p => ["Flash Screen", `${toneText(p[0])}, ${p[1]} frames${wait(p[2])}`],
    async edit(p) {
        p = p || [[255, 255, 255, 170], 60, true];
        return form("Flash Screen", b => { const t = tonePick(p[0], { color: true }); const d = durationField(p[1]); const w = waitChk(p[2]); b.append(group("Flash Color", t), row(d.el, w.el)); return () => ({ p: [t.get(), d.n.get(), w.get()] }); }, { width: "700px" });
    }
});
def(225, {
    name: "Shake Screen", cat: "screen", text: p => ["Shake Screen", `${p[0]}, ${p[1]}, ${p[2]} frames${wait(p[3])}`],
    async edit(p) {
        p = p || [5, 5, 60, true];
        return form("Shake Screen", b => {
            const pw = slider(p[0], 1, 9), sp = slider(p[1], 1, 9); const d = durationField(p[2]); const w = waitChk(p[3]);
            b.append(field("Power:", pw), field("Speed:", sp), row(d.el, w.el));
            return () => ({ p: [pw.get(), sp.get(), d.n.get(), w.get()] });
        });
    }
});
const WEATHER = [["none", "None"], ["rain", "Rain"], ["storm", "Storm"], ["snow", "Snow"]];
def(236, {
    name: "Set Weather Effect", cat: "screen",
    text: p => ["Set Weather Effect", `${(WEATHER.find(w => w[0] === p[0]) || [0, p[0]])[1]}, ${p[1]}, ${p[2]} frames${wait(p[3])}`],
    async edit(p) {
        p = p || ["none", 5, 60, true];
        return form("Set Weather Effect", b => {
            const t = radios(WEATHER.map(([v, l]) => ({ label: l, value: v })), p[0], { inline: true }); const pw = slider(p[1], 1, 9);
            const d = durationField(p[2]); const w = waitChk(p[3]);
            b.append(group("Weather", t), field("Power:", pw), row(d.el, w.el));
            return () => ({ p: [t.get(), pw.get(), d.n.get(), w.get()] });
        });
    }
});

// ===== Audio & Video =====
def(241, Object.assign({ name: "Play BGM", cat: "audio" }, audioCmd("bgm", "Play BGM")));
def(242, {
    name: "Fadeout BGM", cat: "audio", text: p => ["Fadeout BGM", `${p[0]} sec.`],
    async edit(p) { p = p || [10]; return form("Fadeout BGM", b => { const n = num(p[0], { min: 1, max: 60 }); b.append(field("Duration:", n, " seconds")); return () => ({ p: [n.get()] }); }); }
});
def(243, { name: "Save BGM", cat: "audio", text: () => ["Save BGM", ""], noParams: true });
def(244, { name: "Replay BGM", cat: "audio", text: () => ["Replay BGM", ""], noParams: true });
def(245, Object.assign({ name: "Play BGS", cat: "audio" }, audioCmd("bgs", "Play BGS")));
def(246, {
    name: "Fadeout BGS", cat: "audio", text: p => ["Fadeout BGS", `${p[0]} sec.`],
    async edit(p) { p = p || [10]; return form("Fadeout BGS", b => { const n = num(p[0], { min: 1, max: 60 }); b.append(field("Duration:", n, " seconds")); return () => ({ p: [n.get()] }); }); }
});
def(249, Object.assign({ name: "Play ME", cat: "audio" }, audioCmd("me", "Play ME")));
def(250, Object.assign({ name: "Play SE", cat: "audio" }, audioCmd("se", "Play SE")));
def(251, { name: "Stop SE", cat: "audio", text: () => ["Stop SE", ""], noParams: true });
def(261, {
    name: "Play Movie", cat: "audio", text: p => ["Play Movie", p[0] || "None"],
    async edit(p) {
        p = p || [""];
        const files = await listFiles("movies", ["webm", "mp4"]);
        return form("Play Movie", b => {
            const s = sel([{ value: "", label: "(None)" }, ...files.map(f => ({ value: f, label: f }))], p[0]);
            b.append(field("Movie:", s));
            return () => ({ p: [s.get()] });
        });
    }
});

// ===== Scene Control =====
def(301, {
    name: "Battle Processing", cat: "scene",
    text: p => ["Battle Processing", p[0] === 0 ? NM("troops", p[1]) : p[0] === 1 ? `{${VR(p[1])}}` : "Same as Random Encounter"],
    async edit(p) {
        p = p || [0, 1, false, false];
        return form("Battle Processing", b => {
            const t = sel(db.options("troops"), p[0] === 0 ? p[1] : 1); const v = varPick(p[0] === 1 ? p[1] : 1);
            const r = radios([{ label: "Direct designation", value: 0, controls: [t] }, { label: "Designation with a variable", value: 1, controls: [v] }, { label: "Same as Random Encounters", value: 2 }], p[0]);
            const e = chk("Can Escape", p[2]); const l = chk("Can Lose", p[3]);
            b.append(group("Troop", r), e.el, l.el);
            return () => ({ p: [r.get(), r.get() === 0 ? t.get() : r.get() === 1 ? v.get() : 0, e.get(), l.get()] });
        });
    },
    refs: p => (p[0] === 1 ? [["variable", p[1]]] : [])
});
def(601, { name: "If Win", cat: "scene", text: () => ["If Win", ""], branch: true });
def(602, { name: "If Escape", cat: "scene", text: () => ["If Escape", ""], branch: true });
def(603, { name: "If Lose", cat: "scene", text: () => ["If Lose", ""], branch: true });
def(604, { name: "End", cat: "scene", text: () => ["End", ""], branch: true });
const GOODS_LIST = ["items", "weapons", "armors"];
def(302, {
    name: "Shop Processing", cat: "scene", cont: 605,
    text: p => ["Shop Processing", NM(GOODS_LIST[p[0]], p[1]) + (p[4] ? " (Purchase Only)" : "")],
    contText: p => NM(GOODS_LIST[p[0]], p[1]),
    async edit(p, ctx, conts) {
        const goods = p ? [p.slice(0, 4), ...(conts || [])].map(g => g.slice(0, 4)) : [];
        let purchaseOnly = p ? !!p[4] : false;
        return form("Shop Processing", b => {
            const list = h("div", { class: "evList evGoods" });
            let selIdx = -1;
            const render = () => {
                list.innerHTML = "";
                list.append(h("div", { class: "evListHead" }, h("span", null, "Merchandise"), h("span", null, "Price")));
                [...goods, null].forEach((g, i) => {
                    const it = h("div", { class: "evListItem evGoodsRow" + (i === selIdx ? " selected" : "") },
                        h("span", null, g ? NM(GOODS_LIST[g[0]], g[1]) : ""), h("span", null, g ? (g[2] === 0 ? String((db[GOODS_LIST[g[0]]][g[1]] || {}).price || 0) : String(g[3])) : ""));
                    it.addEventListener("click", () => { selIdx = i; render(); });
                    it.addEventListener("dblclick", () => editGood(i));
                    list.append(it);
                });
            };
            const editGood = async i => {
                const g = goods[i] || [0, 1, 0, 0];
                const r = await form("Merchandise", bb => {
                    const it = sel(db.options("items"), g[0] === 0 ? g[1] : 1), wp = sel(db.options("weapons"), g[0] === 1 ? g[1] : 1), ar = sel(db.options("armors"), g[0] === 2 ? g[1] : 1);
                    const k = radios([{ label: "Item", value: 0, controls: [it] }, { label: "Weapon", value: 1, controls: [wp] }, { label: "Armor", value: 2, controls: [ar] }], g[0]);
                    const pr = num(g[3], { min: 0, max: 999999 });
                    const pt = radios([{ label: "Standard", value: 0 }, { label: "Specify", value: 1, controls: [pr] }], g[2]);
                    bb.append(group("Merchandise", k), group("Price", pt));
                    return () => [k.get(), [it, wp, ar][k.get()].get(), pt.get(), pt.get() === 1 ? pr.get() : 0];
                });
                if (r) { goods[i] = r; selIdx = i; render(); }
            };
            const po = chk("Purchase Only", purchaseOnly);
            b.append(list, row(
                h("button", { type: "button", class: "evBtn", onclick: () => editGood(selIdx < 0 ? goods.length : selIdx) }, "Edit…"),
                h("button", { type: "button", class: "evBtn", onclick: () => editGood(goods.length) }, "Add…"),
                h("button", { type: "button", class: "evBtn", onclick: () => { if (selIdx >= 0 && selIdx < goods.length) { goods.splice(selIdx, 1); render(); } } }, "Delete")), po.el);
            render();
            return () => {
                if (!goods.length) { alertBox("Add at least one item."); return false; }
                return { p: [...goods[0], po.get()], conts: goods.slice(1) };
            };
        }, { width: "640px" });
    },
    refs: p => [[GOODS_LIST[p[0]].slice(0, -1), p[1]]]
});
def(303, {
    name: "Name Input Processing", cat: "scene", text: p => ["Name Input Processing", `${NM("actors", p[0])}, ${p[1]} characters`],
    async edit(p) {
        p = p || [1, 8];
        return form("Name Input Processing", b => { const a = sel(db.options("actors"), p[0]); const n = num(p[1], { min: 1, max: 16 }); b.append(field("Actor:", a), field("Max Characters:", n)); return () => ({ p: [a.get(), n.get()] }); });
    }
});
def(351, { name: "Open Menu Screen", cat: "scene", text: () => ["Open Menu Screen", ""], noParams: true });
def(352, { name: "Open Save Screen", cat: "scene", text: () => ["Open Save Screen", ""], noParams: true });
def(353, { name: "Game Over", cat: "scene", text: () => ["Game Over", ""], noParams: true });
def(354, { name: "Return to Title Screen", cat: "scene", text: () => ["Return to Title Screen", ""], noParams: true });

// ===== System Settings =====
def(132, Object.assign({ name: "Change Battle BGM", cat: "system" }, audioCmd("bgm", "Change Battle BGM")));
def(133, Object.assign({ name: "Change Victory ME", cat: "system" }, audioCmd("me", "Change Victory ME")));
def(139, Object.assign({ name: "Change Defeat ME", cat: "system" }, audioCmd("me", "Change Defeat ME")));
def(140, {
    name: "Change Vehicle BGM", cat: "system", text: p => ["Change Vehicle BGM", `${VEHICLES[p[0]]}, ${audioText(p[1])}`],
    async edit(p) {
        p = p || [0, TEMPLATE.audio("")];
        return form("Change Vehicle BGM", b => { const v = sel(VEHICLES.map((l, i) => ({ value: i, label: l })), p[0]); const a = audioPick("bgm", p[1]); b.append(field("Vehicle:", v), field("BGM:", a)); return () => ({ p: [v.get(), a.get()] }); });
    }
});
function accessCmd(code, title) {
    def(code, {
        name: title, cat: "system", text: p => [title, p[0] === 0 ? "Disable" : "Enable"],
        async edit(p) { p = p || [0]; return form(title, b => { const r = radios([{ label: "Disable", value: 0 }, { label: "Enable", value: 1 }], p[0], { inline: true }); b.append(r.el); return () => ({ p: [r.get()] }); }); }
    });
}
accessCmd(134, "Change Save Access");
accessCmd(135, "Change Menu Access");
accessCmd(136, "Change Encounter");
accessCmd(137, "Change Formation Access");
def(138, {
    name: "Change Window Color", cat: "system", text: p => ["Change Window Color", toneText(p[0])],
    async edit(p) { p = p || [clone(db.system.windowTone || [0, 0, 0, 0])]; return form("Change Window Color", b => { const t = tonePick(p[0], { gray: false }); b.append(t.el); return () => { const v = t.get(); v[3] = 0; return { p: [v] }; }; }, { width: "640px" }); }
});
def(322, {
    name: "Change Actor Images", cat: "system", text: p => ["Change Actor Images", `${NM("actors", p[0])}, ${p[1] || "None"}(${p[2]}), ${p[3] || "None"}(${p[4]}), ${p[5] || "None"}`],
    async edit(p) {
        if (!p) { const a = db.actors[1] || {}; p = [1, a.characterName || "", a.characterIndex || 0, a.faceName || "", a.faceIndex || 0, a.battlerName || ""]; }
        return form("Change Actor Images", b => {
            const a = sel(db.options("actors"), p[0]); const c = charIndexPick(p[1], p[2]); const f = facePick(p[3], p[4]); const bt = imagePick("sv_actors", p[5]);
            b.append(field("Actor:", a), row(group("Face", f), col(group("Character", c), group("[SV] Battler", bt))));
            return () => { const cv = c.get(), fv = f.get(); return { p: [a.get(), cv.name, cv.index, fv.name, fv.index, bt.get()] }; };
        }, { width: "700px" });
    }
});
def(323, {
    name: "Change Vehicle Image", cat: "system", text: p => ["Change Vehicle Image", `${VEHICLES[p[0]]}, ${p[1] || "None"}(${p[2]})`],
    async edit(p) {
        p = p || [0, "", 0];
        return form("Change Vehicle Image", b => { const v = sel(VEHICLES.map((l, i) => ({ value: i, label: l })), p[0]); const c = charIndexPick(p[1], p[2]); b.append(field("Vehicle:", v), field("Image:", c)); return () => { const cv = c.get(); return { p: [v.get(), cv.name, cv.index] }; }; });
    }
});

// ===== Map =====
def(281, {
    name: "Change Map Name Display", cat: "map", text: p => ["Change Map Name Display", ONOFF[p[0]]],
    async edit(p) { p = p || [0]; return form("Change Map Name Display", b => { const r = radios([{ label: "ON", value: 0 }, { label: "OFF", value: 1 }], p[0], { inline: true }); b.append(r.el); return () => ({ p: [r.get()] }); }); }
});
def(282, {
    name: "Change Tileset", cat: "map", text: p => ["Change Tileset", NM("tilesets", p[0])],
    async edit(p) { p = p || [1]; return form("Change Tileset", b => { const s = sel(db.options("tilesets"), p[0]); b.append(field("Tileset:", s)); return () => ({ p: [s.get()] }); }); }
});
def(283, {
    name: "Change Battle Background", cat: "map", text: p => ["Change Battle Background", `${p[0] || "None"} & ${p[1] || "None"}`],
    async edit(p) { p = p || ["", ""]; return form("Change Battle Background", b => { const a = imagePick("battlebacks1", p[0]); const c = imagePick("battlebacks2", p[1]); b.append(field("Battlebacks 1:", a), field("Battlebacks 2:", c)); return () => ({ p: [a.get(), c.get()] }); }); }
});
def(284, {
    name: "Change Parallax", cat: "map", text: p => ["Change Parallax", `${p[0] || "None"}${p[1] ? ` (Loop Horizontally: ${p[3]})` : ""}${p[2] ? ` (Loop Vertically: ${p[4]})` : ""}`],
    async edit(p) {
        p = p || ["", false, false, 0, 0];
        return form("Change Parallax", b => {
            const im = imagePick("parallaxes", p[0]); const lx = chk("Loop Horizontally", p[1]); const ly = chk("Loop Vertically", p[2]);
            const sx = num(p[3], { min: -32, max: 32 }), sy = num(p[4], { min: -32, max: 32 });
            b.append(field("Image:", im), row(lx.el, field("Scroll:", sx)), row(ly.el, field("Scroll:", sy)));
            return () => ({ p: [im.get(), lx.get(), ly.get(), lx.get() ? sx.get() : 0, ly.get() ? sy.get() : 0] });
        });
    }
});
const LOC_INFO = ["Terrain Tag", "Event ID", "Tile ID (Layer 1)", "Tile ID (Layer 2)", "Tile ID (Layer 3)", "Tile ID (Layer 4)", "Region ID"];
def(285, {
    name: "Get Location Info", cat: "map",
    text: (p, ctx) => ["Get Location Info", `${VR(p[0])}, ${LOC_INFO[p[1]]}, ${p[2] === 0 ? `(${p[3]},${p[4]})` : p[2] === 1 ? `({${VR(p[3])}},{${VR(p[4])}})` : charText(ctx, p[3])}`],
    async edit(p, ctx) {
        p = p || [1, 0, 0, 0, 0];
        return form("Get Location Info", b => {
            const v = varPick(p[0]); const t = sel(LOC_INFO.map((l, i) => ({ value: i, label: l })), p[1]);
            const loc = locationPick((db.api && db.api.currentMapId) || 1, p[2] === 0 ? p[3] : 0, p[2] === 0 ? p[4] : 0, { allowMapChange: false });
            const vx = varPick(p[2] === 1 ? p[3] : 1), vy = varPick(p[2] === 1 ? p[4] : 1);
            const vb = row("X:", vx, "Y:", vy); vb.enable = on => { vx.enable(on); vy.enable(on); };
            const ch = sel(charOptions(ctx), p[2] === 2 ? p[3] : -1);
            const r = radios([{ label: "Direct designation", value: 0, controls: [loc] }, { label: "Designation with variables", value: 1, controls: [vb] }, { label: "Designation by a character", value: 2, controls: [ch] }], p[2]);
            b.append(field("Variable:", v), field("Info Type:", t), group("Location", r));
            return () => {
                const k = r.get();
                if (k === 0) { const l = loc.get(); return { p: [v.get(), t.get(), 0, l.x, l.y] }; }
                if (k === 1) { return { p: [v.get(), t.get(), 1, vx.get(), vy.get()] }; }
                return { p: [v.get(), t.get(), 2, ch.get(), 0] };
            };
        }, { width: "640px" });
    },
    refs: p => [["variable", p[0]], ...(p[2] === 1 ? [["variable", p[3]], ["variable", p[4]]] : [])]
});

// ===== Battle =====
function enemyValueCmd(code, title, death) {
    def(code, {
        name: title, cat: "battle",
        text: p => [title, `${enemyText(p[0])}, ${operandText(p[1], p[2], p[3])}${death && p[4] ? " (Allow Knockout)" : ""}`],
        async edit(p) {
            p = p || [-1, 0, 0, 1, false];
            return form(title, b => {
                const e = sel(enemyOptions(), p[0]); const o = operandUI(p[1], p[2], p[3]); const k = death ? chk("Allow Knockout", p[4]) : null;
                b.append(field("Enemy:", e), o.el, k ? k.el : null);
                return () => ({ p: death ? [e.get(), ...o.get(), k.get()] : [e.get(), ...o.get()] });
            });
        },
        refs: p => (p[2] === 1 ? [["variable", p[3]]] : [])
    });
}
enemyValueCmd(331, "Change Enemy HP", true);
enemyValueCmd(332, "Change Enemy MP", false);
enemyValueCmd(342, "Change Enemy TP", false);
def(333, {
    name: "Change Enemy State", cat: "battle", text: p => ["Change Enemy State", `${enemyText(p[0])}, ${p[1] === 0 ? "+" : "-"} ${NM("states", p[2])}`],
    async edit(p) {
        p = p || [-1, 0, 1];
        return form("Change Enemy State", b => { const e = sel(enemyOptions(), p[0]); const o = radios([{ label: "Add", value: 0 }, { label: "Remove", value: 1 }], p[1], { inline: true }); const s = sel(db.options("states"), p[2]); b.append(field("Enemy:", e), group("Operation", o), field("State:", s)); return () => ({ p: [e.get(), o.get(), s.get()] }); });
    }
});
def(334, {
    name: "Enemy Recover All", cat: "battle", text: p => ["Enemy Recover All", enemyText(p[0])],
    async edit(p) { p = p || [-1]; return form("Enemy Recover All", b => { const e = sel(enemyOptions(), p[0]); b.append(field("Enemy:", e)); return () => ({ p: [e.get()] }); }); }
});
def(335, {
    name: "Enemy Appear", cat: "battle", text: p => ["Enemy Appear", enemyText(p[0])],
    async edit(p) { p = p || [0]; return form("Enemy Appear", b => { const e = sel(enemyOptions(false), p[0]); b.append(field("Enemy:", e)); return () => ({ p: [e.get()] }); }); }
});
def(336, {
    name: "Enemy Transform", cat: "battle", text: p => ["Enemy Transform", `${enemyText(p[0])}, ${NM("enemies", p[1])}`],
    async edit(p) { p = p || [0, 1]; return form("Enemy Transform", b => { const e = sel(enemyOptions(false), p[0]); const t = sel(db.options("enemies"), p[1]); b.append(field("Enemy:", e), field("Transform to:", t)); return () => ({ p: [e.get(), t.get()] }); }); }
});
def(337, {
    name: "Show Battle Animation", cat: "battle", text: p => ["Show Battle Animation", `${p[2] ? "Entire Troop" : enemyText(p[0])}, ${NM("animations", p[1])}`],
    async edit(p) {
        p = p || [0, 1, false];
        return form("Show Battle Animation", b => {
            const e = sel(enemyOptions(false), Math.max(0, p[0])); const all = chk("Target All Enemies in the Troop", p[2]); const a = sel(db.options("animations"), p[1]);
            b.append(field("Enemy:", e), all.el, field("Animation:", a));
            return () => ({ p: [e.get(), a.get(), all.get()] });
        });
    }
});
const FORCE_TARGET = [{ value: -2, label: "Last Target" }, { value: -1, label: "Random" }, ...[1, 2, 3, 4, 5, 6, 7, 8].map(i => ({ value: i - 1, label: "Index " + i }))];
def(339, {
    name: "Force Action", cat: "battle",
    text: p => ["Force Action", `${p[0] === 0 ? "#" + (p[1] + 1) : NM("actors", p[1])}, ${NM("skills", p[2])}, ${(FORCE_TARGET.find(t => t.value === p[3]) || {}).label}`],
    async edit(p) {
        p = p || [0, 0, 1, -2];
        return form("Force Action", b => {
            const e = sel(enemyOptions(false), p[0] === 0 ? p[1] : 0); const a = sel(db.options("actors"), p[0] === 1 ? p[1] : 1);
            const r = radios([{ label: "Enemy", value: 0, controls: [e] }, { label: "Actor", value: 1, controls: [a] }], p[0]);
            const s = sel(db.options("skills"), p[2]); const t = sel(FORCE_TARGET, p[3]);
            b.append(group("Subject", r), field("Skill:", s), field("Target:", t));
            return () => ({ p: [r.get(), r.get() === 0 ? e.get() : a.get(), s.get(), t.get()] });
        });
    }
});
def(340, { name: "Abort Battle", cat: "battle", text: () => ["Abort Battle", ""], noParams: true });

// ===== Advanced =====
def(355, {
    name: "Script", cat: "adv", cont: 655,
    text: p => ["Script", p[0]], contText: p => p[0],
    async edit(p, ctx, conts) {
        const lines = p ? [p[0], ...(conts || []).map(c => c[0])] : [];
        return form("Script", b => {
            const t = textEditor(lines, 14); b.append(t.el);
            return () => { const l = t.get().split("\n"); return { p: [l[0]], conts: l.slice(1).map(x => [x]) }; };
        }, { width: "860px" });
    }
});
def(356, { name: "Plugin Command (MV)", cat: "adv", text: p => ["Plugin Command", p[0]],
    async edit(p) { p = p || [""]; return form("Plugin Command (MV)", b => { const t = txt(p[0], { width: "420px" }); b.append(field("Command:", t)); return () => ({ p: [t.get()] }); }); } });
// Plugin Command (MZ): lista os plugins ativos com @command (mesma fonte do Gerenciador de plugins),
// argumentos editados pela tabela/editores do módulo plugins (struct<…>, arrays, @parent, @dir...).
async function pluginCommandSources(current) {
    const api = db.api;
    const enabled = await getEnabledPluginsWithCommands().catch(() => []);
    const out = enabled.map(p => ({ name: p.name, label: p.name, commands: p.commands }));
    // Plugin já usado pelo comando mas desativado/ausente da lista: mantém para não perder dados.
    const extra = new Set(current ? [current] : []);
    if (!out.length) { for (const n of await listPluginFiles(api)) { extra.add(n); } }
    for (const n of extra) {
        if (out.some(o => o.name === n)) { continue; }
        const cmds = await getPluginCommands(n).catch(() => []);
        if (cmds.length) { out.push({ name: n, label: n + " (OFF)", commands: cmds }); }
    }
    return out;
}
def(357, {
    name: "Plugin Command", cat: "adv", cont: 657,
    text: p => ["Plugin Command", `${p[0]}, ${p[2] || p[1]}`], contText: p => p[0],
    async edit(p) {
        ensurePluginsCss();
        const sources = await pluginCommandSources(p ? p[0] : "");
        p = p || [sources[0] ? sources[0].name : "", "", "", {}];
        let values = clone(p[3]) || {};
        let cmdInfo = null;
        return form("Plugin Command", b => {
            const pl = sel(sources.map(x => ({ value: x.name, label: x.label })), p[0]);
            const cm = sel([], p[1]);
            const desc = h("div", { class: "evDesc" });
            const argHelp = h("div", { class: "evDesc" });
            const table = new ParamTable(db.api, { defs: [], values, structs: {}, onSelect: def => { argHelp.textContent = def.desc || ""; } });
            table.root.classList.add("evArgTable");
            const fillCmds = keep => {
                const src = sources.find(x => x.name === pl.get());
                const cmds = src ? src.commands : [];
                cm.setOptions(cmds.map(c => ({ value: c.name, label: c.text || c.name })), keep ? p[1] : (cmds[0] ? cmds[0].name : ""));
                fillArgs(keep);
            };
            const fillArgs = keep => {
                const src = sources.find(x => x.name === pl.get());
                cmdInfo = src ? src.commands.find(c => c.name === cm.get()) : null;
                desc.textContent = cmdInfo ? cmdInfo.desc : (sources.length ? "" : "Nenhum plugin com @command em js/plugins/.");
                argHelp.textContent = "";
                if (!keep) { values = {}; }
                values = cmdInfo ? { ...defaultArgs(cmdInfo), ...values } : values;
                table.setData(cmdInfo ? cmdInfo.args : [], values, cmdInfo ? cmdInfo.structs : {});
            };
            pl.onChange(() => fillCmds(false));
            cm.onChange(() => fillArgs(false));
            fillCmds(true);
            const editBtn = h("button", { type: "button", class: "evBtn", onclick: () => table.edit() }, "Edit Argument…");
            b.append(row(field("Plugin Name:", pl), field("Command Name:", cm)), desc,
                group("Arguments", table.root, row(editBtn, h("span", { class: "evDesc" }, "Toque no argumento selecionado para editar.")), argHelp));
            return () => {
                if (!pl.get() || !cm.get()) { alertBox("Selecione um plugin e um comando."); return false; }
                const args = {};
                const conts = [];
                for (const a of cmdInfo ? cmdInfo.args : []) {
                    const v = values[a.name] === undefined ? "" : String(values[a.name]);
                    args[a.name] = v;
                    conts.push([`${a.text || a.name} = ${v}`]);
                }
                return { p: [pl.get(), cm.get(), cmdInfo ? cmdInfo.text : cm.get(), args], conts };
            };
        }, { width: "900px" });
    }
});

function ensurePluginsCss() {
    if (document.getElementById("pluginsCss")) { return; }
    const link = document.createElement("link");
    link.id = "pluginsCss";
    link.rel = "stylesheet";
    link.href = new URL("../../css/plugins.css", import.meta.url).href;
    document.head.appendChild(link);
}

// ---------- Paleta "Event Commands" (3 abas como no MZ) ----------
export const PALETTE = [
    [["Message", [101, 102, 103, 104, 105]], ["Game Progression", [121, 122, 123, 124]], ["Flow Control", [111, 112, 113, 115, 117, 118, 119, 108]],
        ["Party", [125, 126, 127, 128, 129]], ["Actor", [311, 312, 326, 313, 314, 315, 316, 317, 318, 319, 320, 321, 324, 325]]],
    [["Movement", [201, 202, 203, 204, 205, 206]], ["Character", [211, 216, 217, 212, 213, 214]], ["Picture", [231, 232, 233, 234, 235]], ["Timing", [230]],
        ["Screen", [221, 222, 223, 224, 225, 236]], ["Audio & Video", [241, 242, 243, 244, 245, 246, 249, 250, 251, 261]]],
    [["Scene Control", [301, 302, 303, 351, 352, 353, 354]], ["System Settings", [132, 133, 139, 140, 134, 135, 136, 137, 138, 322, 323]],
        ["Map", [281, 282, 283, 284, 285]], ["Battle", [331, 332, 342, 333, 334, 335, 336, 337, 339, 340]], ["Advanced", [355, 357]]]
];

export function pickCommand() {
    return new Promise(resolve => {
        let chosen = null;
        dialog({
            title: "Event Commands", width: "1240px", height: "96vh", okLabel: "Close", noCancel: true,
            build: (body, dlg) => {
                const t = tabs(PALETTE.map((tab, i) => ({
                    label: String(i + 1),
                    content: [h("div", { class: "evPalette" }, ...tab.map(([title, codes]) => h("div", { class: "evPalGroup" + (codes.length > 8 ? " wide" : "") },
                        h("div", { class: "evPalTitle" }, title),
                        h("div", { class: "evPalBtns" }, ...codes.map(code => h("button", { type: "button", class: "evBtn evPalBtn cat-" + CMD[code].cat, onclick: () => { chosen = code; dlg.close(); } },
                            CMD[code].name + (CMD[code].noParams ? "" : "…")))))))]
                })), pickCommand.lastTab || 0);
                t.el.addEventListener("click", () => { pickCommand.lastTab = t.active; });
                body.append(t.el);
            }
        }).then(() => resolve(chosen));
    });
}

// ---------- Prévia da janela de mensagem e seletores de cor/ícone ----------
let windowSkin = null, iconSet = null;
async function skin() { if (!windowSkin) { windowSkin = await loadImage(imgUrl("system", "Window")); } return windowSkin; }
async function icons() { if (!iconSet) { iconSet = await loadImage(imgUrl("system", "IconSet")); } return iconSet; }
async function textColors() {
    const im = await skin();
    const c = document.createElement("canvas"); c.width = im.width; c.height = im.height;
    const ctx = c.getContext("2d"); ctx.drawImage(im, 0, 0);
    const out = [];
    for (let n = 0; n < 32; n++) {
        const px = 96 + (n % 8) * 12 + 6, py = 144 + Math.floor(n / 8) * 12 + 6;
        const d = ctx.getImageData(px, py, 1, 1).data;
        out.push(`rgb(${d[0]},${d[1]},${d[2]})`);
    }
    return out;
}
async function colorPicker() {
    const colors = await textColors();
    return form("Insert Color Number", b => {
        let cur = 0;
        const grid = h("div", { class: "evColorGrid" });
        colors.forEach((c, i) => {
            const cell = h("button", { type: "button", class: "evColorCell" + (i === 0 ? " on" : ""), style: { background: c } }, String(i));
            cell.addEventListener("click", () => { cur = i; for (const x of grid.children) { x.classList.toggle("on", x === cell); } });
            grid.append(cell);
        });
        b.append(grid);
        return () => cur;
    }, { width: "520px" });
}
async function iconPicker() {
    const im = await icons();
    return form("Insert Icon Number", b => {
        let cur = 0;
        const cv = h("canvas", { class: "evIconCanvas" });
        cv.width = im.width; cv.height = im.height;
        const ctx = cv.getContext("2d");
        const draw = () => { ctx.clearRect(0, 0, cv.width, cv.height); ctx.drawImage(im, 0, 0); ctx.strokeStyle = "#f00"; ctx.lineWidth = 3; ctx.strokeRect((cur % 16) * 32 + 1.5, Math.floor(cur / 16) * 32 + 1.5, 29, 29); info.textContent = "Icon " + cur; };
        const info = h("div", { class: "evDesc" });
        cv.addEventListener("click", e => { const r = cv.getBoundingClientRect(); cur = Math.floor((e.clientX - r.left) / r.width * 16) + Math.floor((e.clientY - r.top) / r.height * (im.height / 32)) * 16; draw(); });
        b.append(info, h("div", { class: "evIconWrap" }, cv));
        draw();
        return () => cur;
    }, { width: "640px" });
}
async function renderMessagePreview(el, face, name, lines) {
    el.innerHTML = "";
    const colors = await textColors().catch(() => []);
    const ic = await icons().catch(() => null);
    const box = h("div", { class: "evMsgWin" });
    if (face && face.name) { const c = h("canvas", { class: "evMsgFace" }); box.append(c); drawFace(c, face.name, face.index, 144); }
    const tx = h("div", { class: "evMsgLines" });
    for (const line of lines.slice(0, 4)) {
        const l = h("div", { class: "evMsgLine" });
        let color = colors[0] || "#fff";
        let i = 0;
        let span = h("span", { style: { color } });
        l.append(span);
        const s = line.replace(/\\V\[(\d+)\]/gi, (m, n) => "0").replace(/\\N\[(\d+)\]/gi, (m, n) => db.name("actors", Number(n))).replace(/\\P\[(\d+)\]/gi, (m, n) => { const id = (db.system.partyMembers || [])[Number(n) - 1]; return db.name("actors", id); }).replace(/\\G/gi, db.system.currencyUnit || "G");
        while (i < s.length) {
            const rest = s.slice(i);
            let m;
            if ((m = /^\\C\[(\d+)\]/i.exec(rest))) { color = colors[Number(m[1])] || color; span = h("span", { style: { color } }); l.append(span); i += m[0].length; continue; }
            if ((m = /^\\I\[(\d+)\]/i.exec(rest))) {
                if (ic) { const c = h("canvas", { class: "evMsgIcon" }); c.width = 32; c.height = 32; const n = Number(m[1]); c.getContext("2d").drawImage(ic, (n % 16) * 32, Math.floor(n / 16) * 32, 32, 32, 0, 0, 32, 32); l.append(c); span = h("span", { style: { color } }); l.append(span); }
                i += m[0].length; continue;
            }
            if ((m = /^\\(FS|PX|PY)\[\d+\]|^\\[{}$.|!><^]/i.exec(rest))) { i += m[0].length; continue; }
            if (rest.startsWith("\\\\")) { span.textContent += "\\"; i += 2; continue; }
            span.textContent += s[i]; i++;
        }
        tx.append(l);
    }
    box.append(tx);
    if (name) { el.append(h("div", { class: "evMsgName" }, name)); }
    el.append(box);
}
