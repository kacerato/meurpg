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
import { t } from "../i18n.js";

// ---------- textos auxiliares ----------
const P = n => db.pad(n);
const SW = id => `#${P(id)} ${db.switchName(id)}`;
const VR = id => `#${P(id)} ${db.variableName(id)}`;
const NM = (list, id) => db.name(list, id) || P(id);
const DIRS = { 0: t("Retain", "Constants"), 2: t("Down", "Constants"), 4: t("Left", "Constants"), 6: t("Right", "Constants"), 8: t("Up", "Constants") };
const VEHICLES = [t("Boat", "Constants"), t("Ship", "Constants"), t("Airship", "Constants")];
const SELF = ["A", "B", "C", "D"];
const ONOFF = [t("ON", "Constants"), t("OFF", "Constants")];
const BACKGROUNDS = [t("Window", "Constants"), t("Dim", "Constants"), t("Transparent", "Constants")];
const POSITIONS = [t("Top", "Constants"), t("Middle", "Constants"), t("Bottom", "Constants")];
const LMR = [t("Left", "Constants"), t("Middle", "Constants"), t("Right", "Constants")];
const CHOICE_N = [t("Choice #1", "Constants"), t("Choice #2", "Constants"), t("Choice #3", "Constants"), t("Choice #4", "Constants"), t("Choice #5", "Constants"), t("Choice #6", "Constants")];
const PARAMS = () => (db.system.terms && db.system.terms.params) || [t("Max HP", "Constants"), t("Max MP", "Constants"), t("Attack", "Constants"), t("Defense", "Constants"), t("M.Attack", "Constants"), t("M.Defense", "Constants"), t("Agility", "Constants"), t("Luck", "Constants")];
const NONE = () => t("None", "Constants");
const FR = n => (n === 1 ? t("%1 frame", "Constants", n) : t("%1 frames", "Constants", n));
const SEC = n => (n === 1 ? t("%1 second", "Constants", n) : t("%1 seconds", "Constants", n));

function evName(ctx, id) {
    const ev = ctx && ctx.map && ctx.map.events && ctx.map.events[id];
    return ev ? ev.name : "EV" + String(id).padStart(3, "0");
}
function charText(ctx, id) { return id < 0 ? t("Player", "Constants") : id === 0 ? t("This Event", "Constants") : evName(ctx, id); }
function operandText(op, type, val) { return (op === 0 ? "+ " : "- ") + (type === 0 ? val : `{${VR(val)}}`); }
function actorText(kind, id) {
    if (kind === 0) { return id === 0 ? t("Entire Party", "EventCommandTexts") : NM("actors", id); }
    return `{${VR(id)}}`;
}
function enemyText(i) { return i < 0 ? t("Entire Troop", "EventCommandTexts") : "#" + (i + 1); }
function wait(b) { return b ? ` (${t("Wait", "EventCommandTexts")})` : ""; }
function toneText(tone) { return `(${tone.join(",")})`; }

// ---------- utilidades de diálogo ----------
function form(title, build, { width = "560px" } = {}) {
    let get;
    return dialog({ title, width, height: "auto", build: (b, d) => { get = build(b, d); }, onOk: () => { const v = get(); return v === false ? false : { v }; } })
        .then(r => r ? r.v : null);
}

function charOptions(ctx, { player = true, thisEvent = true } = {}) {
    const out = [];
    if (player) { out.push({ value: -1, label: t("Player", "Constants") }); }
    if (thisEvent) { out.push({ value: 0, label: t("This Event", "Constants") }); }
    const evs = (ctx && ctx.map && ctx.map.events) || [];
    for (const e of evs) { if (e) { out.push({ value: e.id, label: `${P(e.id)}:${e.name}` }); } }
    return out;
}
function enemyOptions(entire = true) {
    const out = entire ? [{ value: -1, label: t("Entire Troop", "EventCommandTexts") }] : [];
    for (let i = 0; i < 8; i++) { out.push({ value: i, label: "#" + (i + 1) }); }
    return out;
}

// Operando "Constant / Variable" (operateValue).
function operandUI(op, type, val, { opLabels = [t("Increase", "Group_Operation"), t("Decrease", "Group_Operation")], min = 1, max = 9999999 } = {}) {
    const opR = radios(opLabels.map((l, i) => ({ label: l, value: i })), op || 0, { inline: true });
    const c = num(type === 0 && val !== undefined ? val : min, { min: type === 0 ? Math.min(min, 0) : min, max });
    const v = varPick(type === 1 ? val : 1);
    const tR = radios([{ label: t("Constant", "Group_Operand"), value: 0, controls: [c] }, { label: t("Variable", "Constants"), value: 1, controls: [v] }], type || 0);
    return {
        el: col(group(t("Operation", "Group_Operation"), opR), group(t("Operand", "Group_Operand"), tR)),
        get: () => [opR.get(), tR.get(), tR.get() === 0 ? c.get() : v.get()]
    };
}
// Alvo ator: Fixed (com Entire Party) / Variable.
function actorTargetUI(kind, id, { party = true } = {}) {
    const a = sel(db.options("actors", { none: party, noneLabel: t("Entire Party", "Group_TargetActor") }), kind === 0 ? id : (party ? 0 : 1));
    const v = varPick(kind === 1 ? id : 1);
    const r = radios([{ label: t("Fixed", "Group_TargetActor"), value: 0, controls: [a] }, { label: t("Variable", "Constants"), value: 1, controls: [v] }], kind || 0);
    return { el: group(t("Actor", "Constants"), r), get: () => [r.get(), r.get() === 0 ? a.get() : v.get()] };
}
// Designação direta / por variáveis de (mapa,) x, y.
function designationUI(kind, a, b, c, { withMap = true, allowMapChange = true } = {}) {
    const loc = locationPick(withMap ? (kind === 0 ? a : 0) || 1 : (db.api && db.api.currentMapId) || 1, kind === 0 ? (withMap ? b : a) || 0 : 0, kind === 0 ? (withMap ? c : b) || 0 : 0, { allowMapChange });
    const vm = varPick(kind === 1 && withMap ? a : 1), vx = varPick(kind === 1 ? (withMap ? b : a) : 1), vy = varPick(kind === 1 ? (withMap ? c : b) : 1);
    const varBox = col(withMap ? field(t("Map ID", "Constants"), vm) : null, field(t("X", "Group_Location"), vx), field(t("Y", "Group_Location"), vy));
    varBox.enable = on => { for (const x of [vm, vx, vy]) { x.enable(on); } };
    const r = radios([{ label: t("Direct designation", "Group_Location"), value: 0, controls: [loc] }, { label: t("Designation with variables", "Group_Location"), value: 1, controls: [varBox] }], kind || 0);
    return {
        el: group(t("Location", "Group_Location"), r),
        get: () => {
            if (r.get() === 0) { const l = loc.get(); return withMap ? [0, l.mapId, l.x, l.y] : [0, l.x, l.y]; }
            return withMap ? [1, vm.get(), vx.get(), vy.get()] : [1, vx.get(), vy.get()];
        }
    };
}
function dirSel(v, { retain = true } = {}) {
    const opts = [];
    if (retain) { opts.push({ value: 0, label: DIRS[0] }); }
    for (const d of [2, 4, 6, 8]) { opts.push({ value: d, label: DIRS[d] }); }
    return sel(opts, v || (retain ? 0 : 2));
}
function waitChk(v) { return chk(t("Wait for Completion", "Group_Duration"), v); }
function durationField(v, { max = 999 } = {}) { const n = num(v === undefined ? 60 : v, { min: 1, max }); return { n, el: field(t("Duration", "Group_Duration"), n, " " + t("frames (1/60 sec)", "Group_Duration")) }; }
function audioCmd(folder, title) {
    return {
        text: p => [t(title, "EventCommands"), audioText(p[0])],
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
    const expand = str => str.replace(/\\V\[(\d+)\]/gi, "0").replace(/\\N\[(\d+)\]/gi, (a, n) => db.name("actors", Number(n)))
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
    text: p => [t("Text", "EventCommands"), [p[0] ? `${p[0]}(${p[1]})` : NONE(), BACKGROUNDS[p[2]] || BACKGROUNDS[0], POSITIONS[p[3]] || POSITIONS[2], p[4] ? p[4] : null].filter(x => x !== null).join(", ")],
    contText: p => p[0],
    async edit(p, ctx, conts) {
        p = p || ["", 0, 0, 2, ""];
        return form(t("Show Text", "EventCommands"), body => {
            const face = facePick(p[0], p[1]);
            const name = txt(p[4] || "", { width: "220px" });
            const bg = sel(BACKGROUNDS.map((l, i) => ({ value: i, label: l })), p[2]);
            const pos = sel(POSITIONS.map((l, i) => ({ value: i, label: l })), p[3]);
            const text = messageTextEditor((conts || []).map(c => c[0]), () => face.get().name !== "");
            face.onChange(() => text.refresh());
            const batch = chk(t("Batch Entry", "EventCommand101"), false);
            const insertAt = s => { const ta = text.ta; const a = ta.selectionStart; ta.setRangeText(s, a, ta.selectionEnd, "end"); ta.focus(); text.refresh(); };
            const tools = row(
                h("button", { type: "button", class: "evBtn", onclick: async () => { const n = await colorPicker(); if (n !== null) { insertAt(`\\C[${n}]`); } } }, t("Color", "Group_AnimationFlash") + "…"),
                h("button", { type: "button", class: "evBtn", onclick: async () => { const n = await iconPicker(); if (n !== null) { insertAt(`\\I[${n}]`); } } }, t("Icon", "Constants") + "…"),
                ...["\\V[1]", "\\N[1]", "\\P[1]", "\\G", "\\{", "\\}", "\\$", "\\.", "\\|", "\\!", "\\>", "\\<", "\\^"].map(c => h("button", { type: "button", class: "evBtn evCode", onclick: () => insertAt(c) }, c)),
                h("button", { type: "button", class: "evBtn", onclick: () => dialog({ title: t("Preview", "Constants"), width: "900px", height: "auto", noCancel: true, build: pb => { const pv = h("div", { class: "evMsgPreview" }); pb.append(pv); renderMessagePreview(pv, face.get(), name.get(), text.get().split("\n")); } }) }, t("Preview", "Constants") + "…"));
            body.append(h("div", { class: "evShowText" },
                col(h("div", null, t("Face", "EventCommand101")), face),
                col(row(field(t("Name", "Constants"), name), field(t("Background", "EventCommand101"), bg), field(t("Window Position", "EventCommand101"), pos)), field(t("Text", "EventCommand101"), text), tools, batch)));
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
        const cancel = p[1] === -2 ? t("Branch", "Constants") : p[1] === -1 ? t("Disallow", "Constants") : "#" + (p[1] + 1);
        const def_ = p[2] === -1 ? NONE() : "#" + ((p[2] || 0) + 1);
        return [t("Show Choices", "EventCommands"), `${p[0].join(", ")} (${BACKGROUNDS[p[4] || 0]}, ${LMR[p[3] === undefined ? 2 : p[3]]}, ${def_}, ${cancel})`];
    },
    async edit(p) {
        p = p || [[t("Yes", "BasicConstants"), t("No", "BasicConstants")], 1, 0, 2, 0];
        return form(t("Show Choices", "EventCommands"), body => {
            const ch = [];
            for (let i = 0; i < 6; i++) { ch.push(txt(p[0][i] || "", { width: "100%" })); }
            const bg = sel(BACKGROUNDS.map((l, i) => ({ value: i, label: l })), p[4] || 0);
            const pos = sel(LMR.map((l, i) => ({ value: i, label: l })), p[3] === undefined ? 2 : p[3]);
            const defOpts = [{ value: -1, label: NONE() }, ...[0, 1, 2, 3, 4, 5].map(i => ({ value: i, label: CHOICE_N[i] }))];
            const cancelOpts = [{ value: -2, label: t("Branch", "Constants") }, { value: -1, label: t("Disallow", "Constants") }, ...[0, 1, 2, 3, 4, 5].map(i => ({ value: i, label: CHOICE_N[i] }))];
            const df = sel(defOpts, p[2] === undefined ? 0 : p[2]);
            const cn = sel(cancelOpts, p[1]);
            body.append(h("div", { class: "evTwoCol" },
                group(t("Choices", "EventCommand102"), ...ch.map((c, i) => field("#" + (i + 1), c))),
                col(field(t("Background", "EventCommand102"), bg), field(t("Window Position", "EventCommand102"), pos), field(t("Default", "EventCommand102"), df), field(t("Cancel", "EventCommand102"), cn))));
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
def(402, { name: "When", cat: "msg", text: p => [t("When %1", "EventCommandTexts", p[1]), ""], branch: true });
def(403, { name: "When Cancel", cat: "msg", text: () => [t("When Cancel", "EventCommands"), ""], branch: true });
def(404, { name: "End", cat: "msg", text: () => [t("End", "EventCommands"), ""], branch: true });
def(103, {
    name: "Input Number", cat: "msg",
    text: p => [t("Input Number", "EventCommands"), `${VR(p[0])}, ${p[1] === 1 ? t("%1 digit", "EventCommandTexts", p[1]) : t("%1 digits", "EventCommandTexts", p[1])}`],
    async edit(p) {
        p = p || [1, 1];
        return form(t("Input Number", "EventCommands"), b => {
            const v = varPick(p[0]); const d = num(p[1], { min: 1, max: 8 });
            b.append(field(t("Variable", "Constants"), v), field(t("Digits", "EventCommand103"), d));
            return () => ({ p: [v.get(), d.get()] });
        });
    },
    refs: p => [["variable", p[0]]]
});
const ITEM_TYPES = { 1: t("Regular Item", "Constants"), 2: t("Key Item", "Constants"), 3: t("Hidden Item A", "Constants"), 4: t("Hidden Item B", "Constants") };
def(104, {
    name: "Select Item", cat: "msg",
    text: p => [t("Select Item", "EventCommands"), `${VR(p[0])}, ${ITEM_TYPES[p[1] || 2]}`],
    async edit(p) {
        p = p || [1, 2];
        return form(t("Select Item", "EventCommands"), b => {
            const v = varPick(p[0]);
            const ty = sel(Object.entries(ITEM_TYPES).map(([k, l]) => ({ value: Number(k), label: l })), p[1] || 2);
            b.append(field(t("Variable", "Constants"), v), field(t("Item Type", "EventCommand104"), ty));
            return () => ({ p: [v.get(), ty.get()] });
        });
    },
    refs: p => [["variable", p[0]]]
});
def(105, {
    name: "Show Scrolling Text", cat: "msg", cont: 405,
    text: p => [t("Text(S)", "EventCommands"), `${t("Speed", "EventCommandTexts")} ${p[0]}${p[1] ? ", " + t("No Fast Forward", "EventCommandTexts") : ""}`],
    contText: p => p[0],
    async edit(p, ctx, conts) {
        p = p || [2, false];
        return form(t("Show Scrolling Text", "EventCommands"), b => {
            const te = textEditor((conts || []).map(c => c[0]), 12);
            const s = num(p[0], { min: 1, max: 8 }); const nf = chk(t("No Fast Forward", "EventCommand105"), p[1]);
            b.append(field(t("Text", "EventCommand105"), te), row(field(t("Speed", "EventCommand105"), s), nf));
            return () => ({ p: [s.get(), nf.get()], conts: te.get().split("\n").map(l => [l]) });
        }, { width: "760px" });
    }
});

// ===== Game Progression =====
def(121, {
    name: "Control Switches", cat: "prog",
    text: p => [t("Control Switches", "EventCommands"), `${p[0] === p[1] ? SW(p[0]) : `#${P(p[0])}..${P(p[1])}`} = ${ONOFF[p[2]]}`],
    async edit(p) {
        p = p || [1, 1, 0];
        return form(t("Control Switches", "EventCommands"), b => {
            const s = switchPick(p[0]); const a = num(p[0], { min: 1, max: 9999 }); const z = num(p[1], { min: 1, max: 9999 });
            const range = row(a, " ~ ", z); range.enable = on => { a.enable(on); z.enable(on); };
            const r = radios([{ label: t("Single", "Group_VariableRange"), value: 0, controls: [s] }, { label: t("Range", "Group_VariableRange"), value: 1, controls: [range] }], p[0] === p[1] ? 0 : 1);
            const v = radios([{ label: ONOFF[0], value: 0 }, { label: ONOFF[1], value: 1 }], p[2], { inline: true });
            b.append(group(t("Switch", "Constants"), r), group(t("Operation", "Group_Operation"), v));
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
const OTHER_DATA = [t("Map ID", "Constants"), t("Party Members", "Constants"), t("Gold", "Constants"), t("Steps", "Constants"), t("Play Time", "Constants"), t("Timer", "Constants"), t("Save Count", "Constants"), t("Battle Count", "Constants"), t("Win Count", "Constants"), t("Escape Count", "Constants")];
const LAST_DATA = [t("Last Used Skill ID", "Constants"), t("Last Used Item ID", "Constants"), t("Last Actor ID to Act", "Constants"), t("Last Enemy Index to Act", "Constants"), t("Last Target Actor ID", "Constants"), t("Last Target Enemy Index", "Constants")];
const CHAR_DATA = [t("Map X", "Constants"), t("Map Y", "Constants"), t("Direction", "Constants"), t("Screen X", "Constants"), t("Screen Y", "Constants")];
function actorDataNames() { return [t("Level", "Constants"), t("EXP", "Constants"), t("HP", "Constants"), t("MP", "Constants"), ...PARAMS().slice(0, 8), t("TP", "Constants")]; }
function enemyDataNames() { return [t("HP", "Constants"), t("MP", "Constants"), ...PARAMS().slice(0, 8), t("TP", "Constants")]; }
function gameDataText(kind, a, b, ctx) {
    switch (kind) {
        case 0: return t("The number of %1", "EventCommandTexts", NM("items", a));
        case 1: return t("The number of %1", "EventCommandTexts", NM("weapons", a));
        case 2: return t("The number of %1", "EventCommandTexts", NM("armors", a));
        case 3: return t("%1 of %2", "EventCommandTexts", actorDataNames()[b] || "?", NM("actors", a));
        case 4: return t("%1 of %2", "EventCommandTexts", enemyDataNames()[b] || "?", "#" + (a + 1));
        case 5: return t("%1 of %2", "EventCommandTexts", CHAR_DATA[b], charText(ctx, a));
        case 6: return t("%1 of %2", "EventCommandTexts", t("Actor ID", "EventCommandTexts"), t("party member #%1", "EventCommandTexts", a + 1));
        case 7: return OTHER_DATA[a] || "?";
        case 8: return LAST_DATA[a] || "?";
    }
    return "?";
}
async function gameDataDialog(v, ctx) {
    v = v || [0, 1, 0];
    return form(t("Game Data", "Dialog_GameData"), b => {
        const name = radioName();
        const it = sel(db.options("items"), v[0] === 0 ? v[1] : 1), wp = sel(db.options("weapons"), v[0] === 1 ? v[1] : 1), ar = sel(db.options("armors"), v[0] === 2 ? v[1] : 1);
        const ac = sel(db.options("actors"), v[0] === 3 ? v[1] : 1), acd = sel(actorDataNames().map((l, i) => ({ value: i, label: l })), v[0] === 3 ? v[2] : 0);
        const en = sel(enemyOptions(false), v[0] === 4 ? v[1] : 0), end = sel(enemyDataNames().map((l, i) => ({ value: i, label: l })), v[0] === 4 ? v[2] : 0);
        const chs = sel(charOptions(ctx), v[0] === 5 ? v[1] : -1), chd = sel(CHAR_DATA.map((l, i) => ({ value: i, label: l })), v[0] === 5 ? v[2] : 0);
        const pm = sel([1, 2, 3, 4, 5, 6, 7, 8].map(i => ({ value: i - 1, label: t("Member #%1", "Dialog_GameData", i) })), v[0] === 6 ? v[1] : 0);
        const ot = sel(OTHER_DATA.map((l, i) => ({ value: i, label: l })), v[0] === 7 ? v[1] : 0);
        const ls = sel(LAST_DATA.map((l, i) => ({ value: i, label: l })), v[0] === 8 ? v[1] : 0);
        const r = radios([
            { label: t("Item", "Constants"), value: 0, controls: [it] }, { label: t("Weapon", "Constants"), value: 1, controls: [wp] }, { label: t("Armor", "Constants"), value: 2, controls: [ar] },
            { label: t("Actor", "Constants"), value: 3, controls: [ac, acd] }, { label: t("Enemy", "Constants"), value: 4, controls: [en, end] }, { label: t("Character", "Constants"), value: 5, controls: [chs, chd] },
            { label: t("Party", "Dialog_GameData"), value: 6, controls: [pm] }, { label: t("Other", "Dialog_GameData"), value: 7, controls: [ot] }, { label: t("Last", "Dialog_GameData"), value: 8, controls: [ls] }
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
            case 2: v = `${t("Random", "Constants")} ${p[4]}..${p[5]}`; break;
            case 3: v = gameDataText(p[4], p[5], p[6], ctx); break;
            case 4: v = p[4]; break;
        }
        return [t("Control Variables", "EventCommands"), `${target} ${OPS[p[2]]} ${v}`];
    },
    async edit(p, ctx) {
        p = p || [1, 1, 0, 0, 0];
        return form(t("Control Variables", "EventCommands"), b => {
            const s = varPick(p[0]); const a = num(p[0], { min: 1, max: 9999 }); const z = num(p[1], { min: 1, max: 9999 });
            const range = row(a, " ~ ", z); range.enable = on => { a.enable(on); z.enable(on); };
            const tgt = radios([{ label: t("Single", "Group_VariableRange"), value: 0, controls: [s] }, { label: t("Range", "Group_VariableRange"), value: 1, controls: [range] }], p[0] === p[1] ? 0 : 1);
            const op = radios([t("Set", "EventCommand122"), t("Add", "EventCommand122"), t("Sub", "EventCommand122"), t("Mul", "EventCommand122"), t("Div", "EventCommand122"), t("Mod", "EventCommand122")].map((l, i) => ({ label: l, value: i })), p[2], { inline: true });
            const c = num(p[3] === 0 ? p[4] : 0, { min: -99999999, max: 99999999 });
            const vv = varPick(p[3] === 1 ? p[4] : 1);
            const r1 = num(p[3] === 2 ? p[4] : 0, { min: -99999999, max: 99999999 }), r2 = num(p[3] === 2 ? p[5] : 0, { min: -99999999, max: 99999999 });
            const rnd = row(r1, " ~ ", r2); rnd.enable = on => { r1.enable(on); r2.enable(on); };
            let gd = p[3] === 3 ? [p[4], p[5], p[6]] : [0, 1, 0];
            const gdb = pickBtn(gd, x => gameDataText(x[0], x[1], x[2], ctx), cur => gameDataDialog(cur, ctx), { width: "280px" });
            const sc = txt(p[3] === 4 ? p[4] : "", { width: "320px" });
            const opd = radios([
                { label: t("Constant", "Group_Operand"), value: 0, controls: [c] }, { label: t("Variable", "Constants"), value: 1, controls: [vv] }, { label: t("Random", "Group_Operand"), value: 2, controls: [rnd] },
                { label: t("Game Data", "Group_Operand"), value: 3, controls: [gdb] }, { label: t("Script", "Group_Operand"), value: 4, controls: [sc] }
            ], p[3]);
            b.append(group(t("Variable", "Constants"), tgt), group(t("Operation", "EventCommand122"), op), group(t("Operand", "EventCommand122"), opd));
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
    text: p => [t("Control Self Switch", "EventCommands"), `${p[0]} = ${ONOFF[p[1]]}`],
    async edit(p) {
        p = p || ["A", 0];
        return form(t("Control Self Switch", "EventCommands"), b => {
            const s = sel(SELF, p[0]); const v = radios([{ label: ONOFF[0], value: 0 }, { label: ONOFF[1], value: 1 }], p[1], { inline: true });
            b.append(field(t("Self Switch", "EventCommand123"), s), group(t("Operation", "Group_Operation"), v));
            return () => ({ p: [s.get(), v.get()] });
        });
    }
});
def(124, {
    name: "Control Timer", cat: "prog",
    text: p => [t("Control Timer", "EventCommands"), p[0] === 0 ? `${t("Start", "EventCommandTexts")}, ${t("%1 min %2 sec", "EventCommandTexts", Math.floor(p[1] / 60), p[1] % 60)}` : t("Stop", "EventCommandTexts")],
    async edit(p) {
        p = p || [0, 60];
        return form(t("Control Timer", "EventCommands"), b => {
            const m = num(Math.floor(p[1] / 60), { min: 0, max: 99 }), s = num(p[1] % 60, { min: 0, max: 59 });
            const tm = row(m, " " + t("min", "EventCommand124") + " ", s, " " + t("sec", "EventCommand124")); tm.enable = on => { m.enable(on); s.enable(on); };
            const r = radios([{ label: t("Start", "EventCommand124"), value: 0, controls: [tm] }, { label: t("Stop", "EventCommand124"), value: 1 }], p[0]);
            b.append(group(t("Operation", "Group_Operation"), r));
            return () => ({ p: [r.get(), r.get() === 0 ? m.get() * 60 + s.get() : 0] });
        });
    }
});

// ===== Flow Control =====
const CB_ACTOR = ["In the Party", "Name", "Class", "Skill", "Weapon", "Armor", "State"];
const BUTTONS = [["ok", t("OK", "Constants")], ["cancel", t("Cancel", "Constants")], ["shift", t("Shift", "Constants")], ["down", t("Down", "Constants")], ["left", t("Left", "Constants")], ["right", t("Right", "Constants")], ["up", t("Up", "Constants")], ["pageup", t("Pageup", "Constants")], ["pagedown", t("Pagedown", "Constants")]];
const BUTTON_STATES = [t("is being pressed", "Constants"), t("is being triggered", "Constants"), t("is being repeated", "Constants")];
const INC_EQUIP = () => ` (${t("Include Equipment", "Constants")})`;
const CMP = ["=", "≥", "≤", ">", "<", "≠"];
function condText(p, ctx) {
    switch (p[0]) {
        case 0: return t("%1 is %2", "EventCommandTexts", SW(p[1]), ONOFF[p[2]]);
        case 1: return `${VR(p[1])} ${CMP[p[4]]} ${p[2] === 0 ? p[3] : VR(p[3])}`;
        case 2: return t("%1 is %2", "EventCommandTexts", `${t("Self Switch", "EventCommandTexts")} ${p[1]}`, ONOFF[p[2]]);
        case 3: return `${t("Timer", "EventCommandTexts")} ${p[2] === 0 ? "≥" : "≤"} ${t("%1 min %2 sec", "EventCommandTexts", Math.floor(p[1] / 60), p[1] % 60)}`;
        case 4: {
            const a = NM("actors", p[1]);
            switch (p[2]) {
                case 0: return t("%1 is in the party", "EventCommandTexts", a);
                case 1: return t("Name of %1 is %2", "EventCommandTexts", a, p[3]);
                case 2: return t("Class of %1 is %2", "EventCommandTexts", a, NM("classes", p[3]));
                case 3: return t("%1 has learned %2", "EventCommandTexts", a, NM("skills", p[3]));
                case 4: return t("%1 has equipped %2", "EventCommandTexts", a, NM("weapons", p[3]));
                case 5: return t("%1 has equipped %2", "EventCommandTexts", a, NM("armors", p[3]));
                case 6: return t("%1 is affected by %2", "EventCommandTexts", a, NM("states", p[3]));
            }
            break;
        }
        case 5: return p[2] === 0 ? t("%1 has appeared", "EventCommandTexts", `#${p[1] + 1}`) : t("%1 is affected by %2", "EventCommandTexts", `#${p[1] + 1}`, NM("states", p[3]));
        case 6: return t("%1 is facing %2", "EventCommandTexts", charText(ctx, p[1]), DIRS[p[2]]);
        case 7: return `${t("Gold", "EventCommandTexts")} ${["≥", "≤", "<"][p[2]]} ${p[1]}`;
        case 8: return t("Party has %1", "EventCommandTexts", NM("items", p[1]));
        case 9: return t("Party has %1", "EventCommandTexts", NM("weapons", p[1])) + (p[2] ? INC_EQUIP() : "");
        case 10: return t("Party has %1", "EventCommandTexts", NM("armors", p[1])) + (p[2] ? INC_EQUIP() : "");
        case 11: { const bt = BUTTONS.find(x => x[0] === p[1]); return t("Button [%1] %2", "EventCommandTexts", bt ? bt[1] : p[1], BUTTON_STATES[p[2] || 0]); }
        case 12: return `${t("Script", "EventCommandTexts")}：${p[1]}`;
        case 13: return t("%1 is being driven", "EventCommandTexts", VEHICLES[p[1]]);
    }
    return "?";
}
def(111, {
    name: "Conditional Branch", cat: "flow",
    text: (p, ctx) => [t("If", "EventCommands"), condText(p, ctx)],
    async edit(p, ctx, conts, extra) {
        p = p || [0, 1, 0];
        const hasElse = extra ? extra.hasElse : false;
        return form(t("Conditional Branch", "EventCommands"), b => {
            const name = radioName();
            const ty = p[0];
            const g = (k, i) => (ty === k ? p[i] : undefined);
            // Aba 1
            const sw = switchPick(g(0, 1) || 1), swv = sel([{ value: 0, label: ONOFF[0] }, { value: 1, label: ONOFF[1] }], g(0, 2) || 0);
            const vr = varPick(g(1, 1) || 1), vcmp = sel(CMP.map((l, i) => ({ value: i, label: l })), g(1, 4) || 0);
            const vc = num(ty === 1 && p[2] === 0 ? p[3] : 0, { min: -99999999, max: 99999999 }), vv = varPick(ty === 1 && p[2] === 1 ? p[3] : 1);
            const vop = radios([{ label: t("Constant", "Tab_ConditionalBranch1"), value: 0, controls: [vc] }, { label: t("Variable", "Constants"), value: 1, controls: [vv] }], ty === 1 ? p[2] : 0);
            const varBox = col(row(vr, vcmp), vop); varBox.enable = on => { vr.enable(on); vcmp.enable(on); vop.enable(on); };
            const ss = sel(SELF, g(2, 1) || "A"), ssv = sel([{ value: 0, label: ONOFF[0] }, { value: 1, label: ONOFF[1] }], g(2, 2) || 0);
            const tcmp = sel([{ value: 0, label: "≥" }, { value: 1, label: "≤" }], g(3, 2) || 0), tm = num(ty === 3 ? Math.floor(p[1] / 60) : 0, { min: 0, max: 99 }), ts = num(ty === 3 ? p[1] % 60 : 0, { min: 0, max: 59 });
            const r1 = radios([
                { label: t("Switch", "Constants"), value: 0, controls: [sw, swv] }, { label: t("Variable", "Constants"), value: 1, controls: [varBox] },
                { label: t("Self Switch", "Tab_ConditionalBranch1"), value: 2, controls: [ss, ssv] }, { label: t("Timer", "Tab_ConditionalBranch1"), value: 3, controls: [tcmp, tm, t("min", "Tab_ConditionalBranch1"), ts, t("sec", "Tab_ConditionalBranch1")] }
            ], ty, { name });
            // Aba 2: Actor
            const ac = sel(db.options("actors"), g(4, 1) || 1);
            const an = txt(ty === 4 && p[2] === 1 ? p[3] : "", { width: "200px" });
            const acl = sel(db.options("classes"), ty === 4 && p[2] === 2 ? p[3] : 1), ask = sel(db.options("skills"), ty === 4 && p[2] === 3 ? p[3] : 1);
            const awp = sel(db.options("weapons"), ty === 4 && p[2] === 4 ? p[3] : 1), aar = sel(db.options("armors"), ty === 4 && p[2] === 5 ? p[3] : 1), ast = sel(db.options("states"), ty === 4 && p[2] === 6 ? p[3] : 1);
            const asub = radios([
                { label: t("Is in the party", "Tab_ConditionalBranch2"), value: 0 }, { label: t("Name", "Constants"), value: 1, controls: [an] }, { label: t("Class", "Constants"), value: 2, controls: [acl] },
                { label: t("Skill", "Constants"), value: 3, controls: [ask] }, { label: t("Weapon", "Constants"), value: 4, controls: [awp] }, { label: t("Armor", "Constants"), value: 5, controls: [aar] },
                { label: t("State", "Constants"), value: 6, controls: [ast] }
            ], ty === 4 ? p[2] : 0);
            const actorBox = col(ac, asub); actorBox.enable = on => { ac.enable(on); asub.enable(on); };
            const r2 = radios([{ label: t("Actor", "Constants"), value: 4, controls: [actorBox] }], ty, { name });
            // Aba 3
            const en = sel(enemyOptions(false), g(5, 1) || 0), est = sel(db.options("states"), ty === 5 && p[2] === 1 ? p[3] : 1);
            const esub = radios([{ label: t("Appeared", "Tab_ConditionalBranch3"), value: 0 }, { label: t("State", "Constants"), value: 1, controls: [est] }], ty === 5 ? p[2] : 0, { inline: true });
            const enBox = col(en, esub); enBox.enable = on => { en.enable(on); esub.enable(on); };
            const chs = sel(charOptions(ctx), ty === 6 ? p[1] : -1), chd = dirSel(ty === 6 ? p[2] : 2, { retain: false });
            const veh = sel(VEHICLES.map((l, i) => ({ value: i, label: l })), g(13, 1) || 0);
            const r3 = radios([
                { label: t("Enemy", "Constants"), value: 5, controls: [enBox] }, { label: t("Character", "Constants"), value: 6, controls: [chs, t("is facing", "Tab_ConditionalBranch3"), chd] },
                { label: t("Vehicle", "Tab_ConditionalBranch3"), value: 13, controls: [veh, t("is being driven", "Tab_ConditionalBranch3")] }
            ], ty, { name });
            // Aba 4
            const gcmp = sel(["≥", "≤", "<"].map((l, i) => ({ value: i, label: l })), g(7, 2) || 0), gv = num(g(7, 1) || 0, { min: 0, max: 99999999 });
            const it = sel(db.options("items"), g(8, 1) || 1);
            const wp = sel(db.options("weapons"), g(9, 1) || 1), wpe = chk(t("Include Equipment", "Constants"), g(9, 2));
            const ar = sel(db.options("armors"), g(10, 1) || 1), are = chk(t("Include Equipment", "Constants"), g(10, 2));
            const bt = sel(BUTTONS.map(([v, l]) => ({ value: v, label: l })), g(11, 1) || "ok"), btm = sel(BUTTON_STATES.map((l, i) => ({ value: i, label: l })), g(11, 2) || 0);
            const sc = txt(g(12, 1) || "", { width: "380px" });
            const r4 = radios([
                { label: t("Gold", "Tab_ConditionalBranch4"), value: 7, controls: [gcmp, gv] }, { label: t("Item", "Constants"), value: 8, controls: [it] },
                { label: t("Weapon", "Constants"), value: 9, controls: [wp, wpe] }, { label: t("Armor", "Constants"), value: 10, controls: [ar, are] },
                { label: t("Button", "Tab_ConditionalBranch4"), value: 11, controls: [bt, btm] }, { label: t("Script", "Tab_ConditionalBranch4"), value: 12, controls: [sc] }
            ], ty, { name });
            const groups = [r1, r2, r3, r4];
            for (const gr of groups) { gr.el.addEventListener("change", () => groups.forEach(x => x.sync())); }
            const tb = tabs([{ label: "1", content: [r1] }, { label: "2", content: [r2] }, { label: "3", content: [r3] }, { label: "4", content: [r4] }],
                ty <= 3 ? 0 : ty === 4 ? 1 : (ty === 5 || ty === 6 || ty === 13) ? 2 : 3);
            const el = chk(t("Create Else Branch", "EventCommand111"), hasElse);
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
def(411, { name: "Else", cat: "flow", text: () => [t("Else", "EventCommands"), ""], branch: true });
def(412, { name: "End", cat: "flow", text: () => [t("End", "EventCommands"), ""], branch: true });
def(112, { name: "Loop", cat: "flow", text: () => [t("Loop", "EventCommands"), ""], noParams: true });
def(413, { name: "Repeat Above", cat: "flow", text: () => [t("Repeat Above", "EventCommands"), ""], branch: true });
def(113, { name: "Break Loop", cat: "flow", text: () => [t("Break Loop", "EventCommands"), ""], noParams: true });
def(115, { name: "Exit Event Processing", cat: "flow", text: () => [t("Exit Event Processing", "EventCommands"), ""], noParams: true });
def(117, {
    name: "Common Event", cat: "flow",
    text: p => [t("Common Event", "EventCommands"), NM("commonEvents", p[0])],
    async edit(p) {
        p = p || [1];
        return form(t("Common Event", "EventCommands"), b => { const c = sel(db.options("commonEvents"), p[0]); b.append(field(t("Common Event", "EventCommands"), c)); return () => ({ p: [c.get()] }); });
    },
    refs: p => [["common", p[0]]]
});
def(118, {
    name: "Label", cat: "flow", text: p => [t("Label", "EventCommands"), p[0]],
    async edit(p) { p = p || [""]; return form(t("Label", "EventCommands"), b => { const lb = txt(p[0], { width: "300px" }); b.append(field(t("Label Name", "EventCommand118"), lb)); return () => ({ p: [lb.get()] }); }); }
});
def(119, {
    name: "Jump to Label", cat: "flow", text: p => [t("Jump to Label", "EventCommands"), p[0]],
    async edit(p, ctx) {
        p = p || [""];
        const labels = [...new Set((ctx.list || []).filter(c => c.code === 118).map(c => c.parameters[0]))];
        return form(t("Jump to Label", "EventCommands"), b => {
            const lb = txt(p[0], { width: "300px" });
            const dl = h("datalist", { id: "evLabels" }, ...labels.map(l => h("option", { value: l })));
            lb.el.setAttribute("list", "evLabels");
            b.append(field(t("Label Name", "EventCommand119"), lb), dl);
            return () => ({ p: [lb.get()] });
        });
    }
});
def(108, {
    name: "Comment", cat: "comment", cont: 408,
    text: p => [t("Comment", "EventCommands"), p[0]], contText: p => p[0],
    async edit(p, ctx, conts) {
        const lines = p ? [p[0], ...(conts || []).map(c => c[0])] : [];
        return form(t("Comment", "EventCommand108"), b => {
            const te = textEditor(lines, 10); b.append(te.el);
            return () => { const l = te.get().split("\n"); return { p: [l[0]], conts: l.slice(1).map(x => [x]) }; };
        }, { width: "760px" });
    }
});

// ===== Party =====
def(125, {
    name: "Change Gold", cat: "party",
    text: p => [t("Change Gold", "EventCommands"), operandText(p[0], p[1], p[2])],
    async edit(p) { p = p || [0, 0, 0]; return form(t("Change Gold", "EventCommands"), b => { const o = operandUI(p[0], p[1], p[2]); b.append(o.el); return () => ({ p: o.get() }); }); },
    refs: p => (p[1] === 1 ? [["variable", p[2]]] : [])
});
function changeItemCmd(code, list, title, label, equip) {
    def(code, {
        name: title, cat: "party",
        text: p => [t(title, "EventCommands"), `${NM(list, p[0])} ${operandText(p[1], p[2], p[3])}${equip && p[4] ? INC_EQUIP() : ""}`],
        async edit(p) {
            p = p || [1, 0, 0, 1, false];
            return form(t(title, "EventCommands"), b => {
                const it = sel(db.options(list), p[0]); const o = operandUI(p[1], p[2], p[3]);
                const ie = equip ? chk(t("Include Equipment", "Constants"), p[4]) : null;
                b.append(field(t(label, "Constants"), it), o.el, ie ? ie.el : null);
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
    text: p => [t("Change Party Member", "EventCommands"), `${p[1] === 0 ? t("Add %1", "EventCommandTexts", NM("actors", p[0])) : t("Remove %1", "EventCommandTexts", NM("actors", p[0]))}${p[1] === 0 && p[2] ? ` (${t("Initialize", "EventCommandTexts")})` : ""}`],
    async edit(p) {
        p = p || [1, 0, true];
        return form(t("Change Party Member", "EventCommands"), b => {
            const a = sel(db.options("actors"), p[0]); const ini = chk(t("Initialize", "EventCommand129"), p[2]);
            const o = radios([{ label: t("Add", "EventCommand129"), value: 0, controls: [ini] }, { label: t("Remove", "EventCommand129"), value: 1 }], p[1]);
            b.append(field(t("Actor", "Constants"), a), group(t("Operation", "Group_Operation"), o));
            return () => ({ p: [a.get(), o.get(), o.get() === 0 ? ini.get() : false] });
        });
    }
});

// ===== Actor =====
function actorValueCmd(code, title, { death = false, levelUp = false, param = false } = {}) {
    def(code, {
        name: title, cat: "actor",
        text: p => {
            if (param) { return [t(title, "EventCommands"), `${actorText(p[0], p[1])}, ${PARAMS()[p[2]]} ${operandText(p[3], p[4], p[5])}`]; }
            return [t(title, "EventCommands"), `${actorText(p[0], p[1])}, ${operandText(p[2], p[3], p[4])}${(death && p[5]) ? ` (${t("Allow Death", "Constants")})` : ""}${(levelUp && p[5]) ? ` (${t("Show Level Up", "Constants")})` : ""}`];
        },
        async edit(p) {
            p = p || (param ? [0, 1, 0, 0, 0, 1] : [0, 0, 0, 0, 1, false]);
            return form(t(title, "EventCommands"), b => {
                const a = actorTargetUI(p[0], p[1]);
                const pr = param ? sel(PARAMS().slice(0, 8).map((l, i) => ({ value: i, label: l })), p[2]) : null;
                const o = param ? operandUI(p[3], p[4], p[5]) : operandUI(p[2], p[3], p[4]);
                const ex = death ? chk(t("Allow Death", "Constants"), p[5]) : levelUp ? chk(t("Show Level Up", "Constants"), p[5]) : null;
                b.append(a.el, pr ? field(t("Parameter", "EventCommand317"), pr) : null, o.el, ex ? ex.el : null);
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
    text: p => [t("Change State", "EventCommands"), `${actorText(p[0], p[1])}, ${p[2] === 0 ? "+" : "-"} ${NM("states", p[3])}`],
    async edit(p) {
        p = p || [0, 0, 0, 1];
        return form(t("Change State", "EventCommands"), b => {
            const a = actorTargetUI(p[0], p[1]); const o = radios([{ label: t("Add", "EventCommand313"), value: 0 }, { label: t("Remove", "EventCommand313"), value: 1 }], p[2], { inline: true });
            const s = sel(db.options("states"), p[3]);
            b.append(a.el, group(t("Operation", "Group_Operation"), o), field(t("State", "Constants"), s));
            return () => ({ p: [...a.get(), o.get(), s.get()] });
        });
    }
});
def(314, {
    name: "Recover All", cat: "actor", text: p => [t("Recover All", "EventCommands"), actorText(p[0], p[1])],
    async edit(p) { p = p || [0, 0]; return form(t("Recover All", "EventCommands"), b => { const a = actorTargetUI(p[0], p[1]); b.append(a.el); return () => ({ p: a.get() }); }); }
});
def(318, {
    name: "Change Skill", cat: "actor",
    text: p => [t("Change Skill", "EventCommands"), `${actorText(p[0], p[1])}, ${p[2] === 0 ? "+" : "-"} ${NM("skills", p[3])}`],
    async edit(p) {
        p = p || [0, 1, 0, 1];
        return form(t("Change Skill", "EventCommands"), b => {
            const a = actorTargetUI(p[0], p[1]); const o = radios([{ label: t("Learn", "EventCommand318"), value: 0 }, { label: t("Forget", "EventCommand318"), value: 1 }], p[2], { inline: true });
            const s = sel(db.options("skills"), p[3]);
            b.append(a.el, group(t("Operation", "Group_Operation"), o), field(t("Skill", "Constants"), s));
            return () => ({ p: [...a.get(), o.get(), s.get()] });
        });
    }
});
def(319, {
    name: "Change Equipment", cat: "actor",
    text: p => [t("Change Equipment", "EventCommands"), `${NM("actors", p[0])}, ${(db.system.equipTypes || [])[p[1]] || p[1]} = ${p[2] ? NM(p[1] === 1 ? "weapons" : "armors", p[2]) : NONE()}`],
    async edit(p) {
        p = p || [1, 1, 0];
        return form(t("Change Equipment", "EventCommands"), b => {
            const a = sel(db.options("actors"), p[0]);
            const et = sel(db.nameListOptions(db.system.equipTypes || []), p[1]);
            const it = sel([], p[2]);
            const fill = v => {
                const etype = et.get();
                const list = etype === 1 ? "weapons" : "armors";
                const opts = [{ value: 0, label: NONE() }];
                (db[list] || []).forEach((o, i) => { if (o && (etype === 1 || o.etypeId === etype)) { opts.push({ value: i, label: P(i) + " " + o.name }); } });
                it.setOptions(opts, v);
            };
            et.onChange(() => fill(0));
            fill(p[2]);
            b.append(field(t("Actor", "Constants"), a), field(t("Equipment Type", "EventCommand319"), et), field(t("Equipment Item", "EventCommand319"), it));
            return () => ({ p: [a.get(), et.get(), it.get()] });
        });
    },
    refs: p => (p[2] ? [[p[1] === 1 ? "weapon" : "armor", p[2]]] : [])
});
function actorTextCmd(code, title, label, idx = 1, multiline = false) {
    def(code, {
        name: title, cat: "actor",
        text: p => [t(title, "EventCommands"), `${NM("actors", p[0])}, ${String(p[1]).replace(/\n/g, " ")}`],
        async edit(p) {
            p = p || [1, ""];
            return form(t(title, "EventCommands"), b => {
                const a = sel(db.options("actors"), p[0]); const tx = multiline ? area(p[1], { rows: 3 }) : txt(p[1], { width: "300px" });
                b.append(field(t("Actor", "Constants"), a), field(label, tx));
                return () => ({ p: [a.get(), tx.get()] });
            });
        }
    });
}
actorTextCmd(320, "Change Name", t("Name", "Constants"));
actorTextCmd(324, "Change Nickname", t("Nickname", "EventCommand324"));
actorTextCmd(325, "Change Profile", t("Profile", "EventCommand325"), 1, true);
def(321, {
    name: "Change Class", cat: "actor",
    text: p => [t("Change Class", "EventCommands"), `${NM("actors", p[0])}, ${NM("classes", p[1])}${p[2] ? ` (${t("Save Level", "EventCommand321")})` : ""}`],
    async edit(p) {
        p = p || [1, 1, false];
        return form(t("Change Class", "EventCommands"), b => {
            const a = sel(db.options("actors"), p[0]); const c = sel(db.options("classes"), p[1]); const k = chk(t("Save Level", "EventCommand321"), p[2]);
            b.append(field(t("Actor", "Constants"), a), field(t("Class", "Constants"), c), k.el);
            return () => ({ p: [a.get(), c.get(), k.get()] });
        });
    }
});

// ===== Movement =====
const FADES = [t("Black", "Constants"), t("White", "Constants"), t("None", "Constants")];
def(201, {
    name: "Transfer Player", cat: "move",
    text: p => {
        const loc = p[0] === 0 ? `${db.mapName(p[1])} (${p[2]},${p[3]})` : `{${VR(p[1])}} ({${VR(p[2])}},{${VR(p[3])}})`;
        const opts = [];
        if (p[4]) { opts.push(t("Direction", "EventCommandTexts") + ": " + DIRS[p[4]]); }
        if (p[5]) { opts.push(t("Fade", "EventCommandTexts") + ": " + FADES[p[5]]); }
        return [t("Transfer Player", "EventCommands"), loc + (opts.length ? ` (${opts.join(", ")})` : "")];
    },
    async edit(p) {
        p = p || [0, (db.api && db.api.currentMapId) || 1, 0, 0, 0, 0];
        return form(t("Transfer Player", "EventCommands"), b => {
            const d = designationUI(p[0], p[1], p[2], p[3]);
            const dir = dirSel(p[4]); const fade = sel(FADES.map((l, i) => ({ value: i, label: l })), p[5]);
            b.append(d.el, row(field(t("Direction", "EventCommand201"), dir), field(t("Fade", "EventCommand201"), fade)));
            return () => ({ p: [...d.get(), dir.get(), fade.get()] });
        }, { width: "640px" });
    },
    refs: p => (p[0] === 1 ? [["variable", p[1]], ["variable", p[2]], ["variable", p[3]]] : [])
});
def(202, {
    name: "Set Vehicle Location", cat: "move",
    text: p => [t("Set Vehicle Location", "EventCommands"), `${VEHICLES[p[0]]}, ${p[1] === 0 ? `${db.mapName(p[2])} (${p[3]},${p[4]})` : `{${VR(p[2])}} ({${VR(p[3])}},{${VR(p[4])}})`}`],
    async edit(p) {
        p = p || [0, 0, (db.api && db.api.currentMapId) || 1, 0, 0];
        return form(t("Set Vehicle Location", "EventCommands"), b => {
            const v = sel(VEHICLES.map((l, i) => ({ value: i, label: l })), p[0]);
            const d = designationUI(p[1], p[2], p[3], p[4]);
            b.append(field(t("Vehicle", "EventCommand202"), v), d.el);
            return () => ({ p: [v.get(), ...d.get()] });
        }, { width: "640px" });
    },
    refs: p => (p[1] === 1 ? [["variable", p[2]], ["variable", p[3]], ["variable", p[4]]] : [])
});
def(203, {
    name: "Set Event Location", cat: "move",
    text: (p, ctx) => {
        let loc;
        if (p[1] === 0) { loc = `(${p[2]},${p[3]})`; } else if (p[1] === 1) { loc = `({${VR(p[2])}},{${VR(p[3])}})`; } else { loc = t("Exchange with %1", "EventCommandTexts", charText(ctx, p[2])); }
        return [t("Set Event Location", "EventCommands"), `${charText(ctx, p[0])}, ${loc}${p[4] ? ` (${t("Direction", "EventCommandTexts")}: ${DIRS[p[4]]})` : ""}`];
    },
    async edit(p, ctx) {
        p = p || [0, 0, 0, 0, 0];
        return form(t("Set Event Location", "EventCommands"), b => {
            const ev = sel(charOptions(ctx, { player: false }), p[0]);
            const loc = locationPick((db.api && db.api.currentMapId) || 1, p[1] === 0 ? p[2] : 0, p[1] === 0 ? p[3] : 0, { allowMapChange: false });
            const vx = varPick(p[1] === 1 ? p[2] : 1), vy = varPick(p[1] === 1 ? p[3] : 1);
            const vb = row(field(t("X", "Group_Location"), vx), field(t("Y", "Group_Location"), vy)); vb.enable = on => { vx.enable(on); vy.enable(on); };
            const ex = sel(charOptions(ctx, { player: false }), p[1] === 2 ? p[2] : 0);
            const r = radios([{ label: t("Direct designation", "Group_Location"), value: 0, controls: [loc] }, { label: t("Designation with variables", "Group_Location"), value: 1, controls: [vb] }, { label: t("Exchange with another event", "Group_Location"), value: 2, controls: [ex] }], p[1]);
            const dir = dirSel(p[4]);
            b.append(field(t("Event", "EventCommand203"), ev), group(t("Location", "Group_Location"), r), field(t("Direction", "EventCommand203"), dir));
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
const SPEED_NAMES = ["", t("1: x8 Slower", "MovementSpeedBox"), t("2: x4 Slower", "MovementSpeedBox"), t("3: x2 Slower", "MovementSpeedBox"), t("4: Normal", "MovementSpeedBox"), t("5: x2 Faster", "MovementSpeedBox"), t("6: x4 Faster", "MovementSpeedBox")];
def(204, {
    name: "Scroll Map", cat: "move",
    text: p => [t("Scroll Map", "EventCommands"), `${DIRS[p[0]]}, ${p[1]}, ${p[2]}${wait(p[3])}`],
    async edit(p) {
        p = p || [2, 1, 4, true];
        return form(t("Scroll Map", "EventCommands"), b => {
            const d = dirSel(p[0], { retain: false }); const n = num(p[1], { min: 1, max: 100 });
            const s = sel(SPEED_NAMES.map((l, i) => ({ value: i, label: l })).slice(1), p[2]); const w = waitChk(p[3]);
            b.append(row(field(t("Direction", "EventCommand204"), d), field(t("Distance", "EventCommand204"), n), field(t("Speed", "EventCommand204"), s)), w.el);
            return () => ({ p: [d.get(), n.get(), s.get(), w.get()] });
        });
    }
});
def(205, {
    name: "Set Movement Route", cat: "move", cont: 505,
    text: (p, ctx) => {
        const o = [];
        if (p[1].repeat) { o.push(t("Repeat", "EventCommandTexts")); } if (p[1].skippable) { o.push(t("Skip", "EventCommandTexts")); } if (p[1].wait) { o.push(t("Wait", "EventCommandTexts")); }
        return [t("Set Movement Route", "EventCommands"), `${charText(ctx, p[0])}${o.length ? " (" + o.join(", ") + ")" : ""}`];
    },
    contText: p => "◇" + routeText(p[0]),
    async edit(p, ctx) {
        p = p || [-1, { list: [{ code: 0, parameters: [] }], repeat: false, skippable: false, wait: true }];
        const r = await moveRouteDialog(p[1], { target: p[0], targets: charOptions(ctx), previewStart: tg => routePreviewStart(ctx, tg) });
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
def(206, { name: "Get on/off Vehicle", cat: "move", text: () => [t("Get on/off Vehicle", "EventCommands"), ""], noParams: true });

// ===== Character =====
def(211, {
    name: "Change Transparency", cat: "char", text: p => [t("Change Transparency", "EventCommands"), ONOFF[p[0]]],
    async edit(p) { p = p || [0]; return form(t("Change Transparency", "EventCommands"), b => { const r = radios([{ label: ONOFF[0], value: 0 }, { label: ONOFF[1], value: 1 }], p[0], { inline: true }); b.append(group(t("Transparency", "EventCommand211"), r)); return () => ({ p: [r.get()] }); }); }
});
def(216, {
    name: "Change Player Followers", cat: "char", text: p => [t("Change Player Followers", "EventCommands"), ONOFF[p[0]]],
    async edit(p) { p = p || [0]; return form(t("Change Player Followers", "EventCommands"), b => { const r = radios([{ label: ONOFF[0], value: 0 }, { label: ONOFF[1], value: 1 }], p[0], { inline: true }); b.append(group(t("Player Followers", "EventCommand216"), r)); return () => ({ p: [r.get()] }); }); }
});
def(217, { name: "Gather Followers", cat: "char", text: () => [t("Gather Followers", "EventCommands"), ""], noParams: true });
def(212, {
    name: "Show Animation", cat: "char",
    text: (p, ctx) => [t("Show Animation", "EventCommands"), `${charText(ctx, p[0])}, ${NM("animations", p[1])}${wait(p[2])}`],
    async edit(p, ctx) {
        p = p || [-1, 1, false];
        return form(t("Show Animation", "EventCommands"), b => {
            const c = sel(charOptions(ctx), p[0]); const a = sel(db.options("animations"), p[1]); const w = waitChk(p[2]);
            b.append(field(t("Character", "Constants"), c), field(t("Animation", "Constants"), a), w.el);
            return () => ({ p: [c.get(), a.get(), w.get()] });
        });
    }
});
const BALLOONS = ["", t("Exclamation", "Constants"), t("Question", "Constants"), t("Music Note", "Constants"), t("Heart", "Constants"), t("Anger", "Constants"), t("Sweat", "Constants"), t("Frustration", "Constants"), t("Silence", "Constants"), t("Light Bulb", "Constants"), t("Zzz", "Constants"), t("User-defined 1", "Constants"), t("User-defined 2", "Constants"), t("User-defined 3", "Constants"), t("User-defined 4", "Constants"), t("User-defined 5", "Constants")];
def(213, {
    name: "Show Balloon Icon", cat: "char",
    text: (p, ctx) => [t("Show Balloon Icon", "EventCommands"), `${charText(ctx, p[0])}, ${BALLOONS[p[1]]}${wait(p[2])}`],
    async edit(p, ctx) {
        p = p || [-1, 1, false];
        return form(t("Show Balloon Icon", "EventCommands"), b => {
            const c = sel(charOptions(ctx), p[0]); const a = sel(BALLOONS.map((l, i) => ({ value: i, label: l })).slice(1), p[1]); const w = waitChk(p[2]);
            b.append(field(t("Character", "Constants"), c), field(t("Balloon Icon", "EventCommand213"), a), w.el);
            return () => ({ p: [c.get(), a.get(), w.get()] });
        });
    }
});
def(214, { name: "Erase Event", cat: "char", text: () => [t("Erase Event", "EventCommands"), ""], noParams: true });

// ===== Picture =====
const ORIGINS = [t("Upper Left", "Constants"), t("Center", "Constants")];
const BLENDS = [t("Normal", "Constants"), t("Additive", "Constants"), t("Multiply", "Constants"), t("Screen", "Constants")];
const EASING = [t("Constant speed", "Constants"), t("Slow start", "Constants"), t("Slow end", "Constants"), t("Slow start and end", "Constants")];
function pictureUI(p, move) {
    const nm = move ? null : imagePick("pictures", p[1]);
    const org = sel(ORIGINS.map((l, i) => ({ value: i, label: l })), p[2]);
    const x = num(p[3] === 0 ? p[4] : 0, { min: -9999, max: 9999 }), y = num(p[3] === 0 ? p[5] : 0, { min: -9999, max: 9999 });
    const vx = varPick(p[3] === 1 ? p[4] : 1), vy = varPick(p[3] === 1 ? p[5] : 1);
    const db1 = row(t("X", "Group_PicturePosition"), x, t("Y", "Group_PicturePosition"), y); db1.enable = on => { x.enable(on); y.enable(on); };
    const db2 = row(t("X", "Group_PicturePosition"), vx, t("Y", "Group_PicturePosition"), vy); db2.enable = on => { vx.enable(on); vy.enable(on); };
    const pos = radios([{ label: t("Direct designation", "Group_PicturePosition"), value: 0, controls: [db1] }, { label: t("Designation with variables", "Group_PicturePosition"), value: 1, controls: [db2] }], p[3]);
    const sw = num(p[6], { min: -2000, max: 2000 }), sh = num(p[7], { min: -2000, max: 2000 });
    const op = num(p[8], { min: 0, max: 255 }); const bl = sel(BLENDS.map((l, i) => ({ value: i, label: l })), p[9]);
    return {
        nm,
        el: col(nm ? field(t("Image", "Group_Picture"), nm) : null, group(t("Position", "Group_PicturePosition"), field(t("Origin", "Group_PicturePosition"), org), pos), row(group(t("Scale", "Group_PictureZoom"), field(t("Width", "Group_PictureZoom"), sw, "%"), field(t("Height", "Group_PictureZoom"), sh, "%")), group(t("Blend", "Group_PictureBlend"), field(t("Opacity", "Group_PictureBlend"), op), field(t("Blend Mode", "Group_PictureBlend"), bl)))),
        get: () => [org.get(), pos.get(), pos.get() === 0 ? x.get() : vx.get(), pos.get() === 0 ? y.get() : vy.get(), sw.get(), sh.get(), op.get(), bl.get()]
    };
}
function picPos(p) { return p[3] === 0 ? `(${p[4]},${p[5]})` : `({${VR(p[4])}},{${VR(p[5])}})`; }
def(231, {
    name: "Show Picture", cat: "pic",
    text: p => [t("Show Picture", "EventCommands"), `#${p[0]}, ${p[1] || NONE()}, ${ORIGINS[p[2]]} ${picPos(p)}, (${p[6]}%,${p[7]}%), ${p[8]}, ${BLENDS[p[9]]}`],
    async edit(p) {
        p = p || [1, "", 0, 0, 0, 0, 100, 100, 255, 0];
        return form(t("Show Picture", "EventCommands"), b => {
            const n = num(p[0], { min: 1, max: 100 }); const ui = pictureUI(p, false);
            b.append(field(t("Number", "Group_Picture"), n), ui.el);
            return () => { const v = ui.get(); return { p: [n.get(), ui.nm.get(), ...v] }; };
        }, { width: "760px" });
    }
});
def(232, {
    name: "Move Picture", cat: "pic",
    text: p => [t("Move Picture", "EventCommands"), `#${p[0]}, ${ORIGINS[p[2]]} ${picPos(p)}, (${p[6]}%,${p[7]}%), ${p[8]}, ${BLENDS[p[9]]}, ${FR(p[10])}${wait(p[11])}${p[12] ? ", " + EASING[p[12]] : ""}`],
    async edit(p) {
        p = p || [1, 0, 0, 0, 0, 0, 100, 100, 255, 0, 60, true, 0];
        return form(t("Move Picture", "EventCommands"), b => {
            const n = num(p[0], { min: 1, max: 100 }); const ui = pictureUI(p, true);
            const d = durationField(p[10]); const w = waitChk(p[11]); const e = sel(EASING.map((l, i) => ({ value: i, label: l })), p[12] || 0);
            b.append(row(field(t("Number", "Group_Picture"), n), field(t("Easing", "EventCommand232"), e)), ui.el, row(d.el, w.el));
            return () => { const v = ui.get(); return { p: [n.get(), 0, ...v, d.n.get(), w.get(), e.get()] }; };
        }, { width: "760px" });
    }
});
def(233, {
    name: "Rotate Picture", cat: "pic", text: p => [t("Rotate Picture", "EventCommands"), `#${p[0]}, ${p[1]}`],
    async edit(p) {
        p = p || [1, 10];
        return form(t("Rotate Picture", "EventCommands"), b => { const n = num(p[0], { min: 1, max: 100 }); const s = num(p[1], { min: -90, max: 90 }); b.append(field(t("Number", "Group_Picture"), n), group(t("Rotation", "EventCommand233"), field(t("Speed", "EventCommand233"), s))); return () => ({ p: [n.get(), s.get()] }); });
    }
});
def(234, {
    name: "Tint Picture", cat: "pic", text: p => [t("Tint Picture", "EventCommands"), `#${p[0]}, ${toneText(p[1])}, ${FR(p[2])}${wait(p[3])}`],
    async edit(p) {
        p = p || [1, [0, 0, 0, 0], 60, true];
        return form(t("Tint Picture", "EventCommands"), b => {
            const n = num(p[0], { min: 1, max: 100 }); const tp = tonePick(p[1]); const d = durationField(p[2]); const w = waitChk(p[3]);
            b.append(field(t("Number", "Group_Picture"), n), group(t("Color Tone", "EventCommand234"), tp), row(d.el, w.el));
            return () => ({ p: [n.get(), tp.get(), d.n.get(), w.get()] });
        }, { width: "700px" });
    }
});
def(235, {
    name: "Erase Picture", cat: "pic", text: p => [t("Erase Picture", "EventCommands"), `#${p[0]}`],
    async edit(p) { p = p || [1]; return form(t("Erase Picture", "EventCommands"), b => { const n = num(p[0], { min: 1, max: 100 }); b.append(field(t("Number", "Group_Picture"), n)); return () => ({ p: [n.get()] }); }); }
});

// ===== Timing / Screen =====
def(230, {
    name: "Wait", cat: "time", text: p => [t("Wait", "EventCommands"), FR(p[0])],
    async edit(p) { p = p || [60]; return form(t("Wait", "EventCommands"), b => { const d = durationField(p[0]); b.append(d.el); return () => ({ p: [d.n.get()] }); }); }
});
def(221, { name: "Fadeout Screen", cat: "screen", text: () => [t("Fadeout Screen", "EventCommands"), ""], noParams: true });
def(222, { name: "Fadein Screen", cat: "screen", text: () => [t("Fadein Screen", "EventCommands"), ""], noParams: true });
def(223, {
    name: "Tint Screen", cat: "screen", text: p => [t("Tint Screen", "EventCommands"), `${toneText(p[0])}, ${FR(p[1])}${wait(p[2])}`],
    async edit(p) {
        p = p || [[0, 0, 0, 0], 60, true];
        return form(t("Tint Screen", "EventCommands"), b => { const tp = tonePick(p[0]); const d = durationField(p[1]); const w = waitChk(p[2]); b.append(group(t("Color Tone", "EventCommand223"), tp), row(d.el, w.el)); return () => ({ p: [tp.get(), d.n.get(), w.get()] }); }, { width: "700px" });
    }
});
def(224, {
    name: "Flash Screen", cat: "screen", text: p => [t("Flash Screen", "EventCommands"), `${toneText(p[0])}, ${FR(p[1])}${wait(p[2])}`],
    async edit(p) {
        p = p || [[255, 255, 255, 170], 60, true];
        return form(t("Flash Screen", "EventCommands"), b => { const tp = tonePick(p[0], { color: true }); const d = durationField(p[1]); const w = waitChk(p[2]); b.append(group(t("Flash Color", "EventCommand224"), tp), row(d.el, w.el)); return () => ({ p: [tp.get(), d.n.get(), w.get()] }); }, { width: "700px" });
    }
});
def(225, {
    name: "Shake Screen", cat: "screen", text: p => [t("Shake Screen", "EventCommands"), `${p[0]}, ${p[1]}, ${FR(p[2])}${wait(p[3])}`],
    async edit(p) {
        p = p || [5, 5, 60, true];
        return form(t("Shake Screen", "EventCommands"), b => {
            const pw = slider(p[0], 1, 9), sp = slider(p[1], 1, 9); const d = durationField(p[2]); const w = waitChk(p[3]);
            b.append(group(t("Shake", "EventCommand225"), field(t("Power", "EventCommand225"), pw), field(t("Speed", "EventCommand225"), sp)), row(d.el, w.el));
            return () => ({ p: [pw.get(), sp.get(), d.n.get(), w.get()] });
        });
    }
});
const WEATHER = [["none", t("None", "Constants")], ["rain", t("Rain", "Constants")], ["storm", t("Storm", "Constants")], ["snow", t("Snow", "Constants")]];
def(236, {
    name: "Set Weather Effect", cat: "screen",
    text: p => [t("Set Weather Effect", "EventCommands"), `${(WEATHER.find(w => w[0] === p[0]) || [0, p[0]])[1]}, ${p[1]}, ${FR(p[2])}${wait(p[3])}`],
    async edit(p) {
        p = p || ["none", 5, 60, true];
        return form(t("Set Weather Effect", "EventCommands"), b => {
            const wt = radios(WEATHER.map(([v, l]) => ({ label: l, value: v })), p[0], { inline: true }); const pw = slider(p[1], 1, 9);
            const d = durationField(p[2]); const w = waitChk(p[3]);
            b.append(group(t("Weather", "EventCommand236"), wt, field(t("Power", "EventCommand236"), pw)), row(d.el, w.el));
            return () => ({ p: [wt.get(), pw.get(), d.n.get(), w.get()] });
        });
    }
});

// ===== Audio & Video =====
def(241, Object.assign({ name: "Play BGM", cat: "audio" }, audioCmd("bgm", "Play BGM")));
def(242, {
    name: "Fadeout BGM", cat: "audio", text: p => [t("Fadeout BGM", "EventCommands"), SEC(p[0])],
    async edit(p) { p = p || [10]; return form(t("Fadeout BGM", "EventCommands"), b => { const n = num(p[0], { min: 1, max: 60 }); b.append(field(t("Duration", "Group_Duration"), n, " " + t("seconds", "EventCommand242"))); return () => ({ p: [n.get()] }); }); }
});
def(243, { name: "Save BGM", cat: "audio", text: () => [t("Save BGM", "EventCommands"), ""], noParams: true });
def(244, { name: "Replay BGM", cat: "audio", text: () => [t("Replay BGM", "EventCommands"), ""], noParams: true });
def(245, Object.assign({ name: "Play BGS", cat: "audio" }, audioCmd("bgs", "Play BGS")));
def(246, {
    name: "Fadeout BGS", cat: "audio", text: p => [t("Fadeout BGS", "EventCommands"), SEC(p[0])],
    async edit(p) { p = p || [10]; return form(t("Fadeout BGS", "EventCommands"), b => { const n = num(p[0], { min: 1, max: 60 }); b.append(field(t("Duration", "Group_Duration"), n, " " + t("seconds", "EventCommand246"))); return () => ({ p: [n.get()] }); }); }
});
def(249, Object.assign({ name: "Play ME", cat: "audio" }, audioCmd("me", "Play ME")));
def(250, Object.assign({ name: "Play SE", cat: "audio" }, audioCmd("se", "Play SE")));
def(251, { name: "Stop SE", cat: "audio", text: () => [t("Stop SE", "EventCommands"), ""], noParams: true });
def(261, {
    name: "Play Movie", cat: "audio", text: p => [t("Play Movie", "EventCommands"), p[0] || NONE()],
    async edit(p) {
        p = p || [""];
        const files = await listFiles("movies", ["webm", "mp4"]);
        return form(t("Play Movie", "EventCommands"), b => {
            const s = sel([{ value: "", label: "(" + NONE() + ")" }, ...files.map(f => ({ value: f, label: f }))], p[0]);
            b.append(field(null, s));
            return () => ({ p: [s.get()] });
        });
    }
});

// ===== Scene Control =====
def(301, {
    name: "Battle Processing", cat: "scene",
    text: p => [t("Battle Processing", "EventCommands"), p[0] === 0 ? NM("troops", p[1]) : p[0] === 1 ? `{${VR(p[1])}}` : t("Same as Random Encounters", "EventCommandTexts")],
    async edit(p) {
        p = p || [0, 1, false, false];
        return form(t("Battle Processing", "EventCommands"), b => {
            const tr = sel(db.options("troops"), p[0] === 0 ? p[1] : 1); const v = varPick(p[0] === 1 ? p[1] : 1);
            const r = radios([{ label: t("Direct designation", "Group_Troop"), value: 0, controls: [tr] }, { label: t("Designation with a variable", "Group_Troop"), value: 1, controls: [v] }, { label: t("Same as Random Encounters", "Group_Troop"), value: 2 }], p[0]);
            const e = chk(t("Can Escape", "EventCommand301"), p[2]); const l = chk(t("Can Lose", "EventCommand301"), p[3]);
            b.append(group(t("Troop", "Constants"), r), e.el, l.el);
            return () => ({ p: [r.get(), r.get() === 0 ? tr.get() : r.get() === 1 ? v.get() : 0, e.get(), l.get()] });
        });
    },
    refs: p => (p[0] === 1 ? [["variable", p[1]]] : [])
});
def(601, { name: "If Win", cat: "scene", text: () => [t("If Win", "EventCommands"), ""], branch: true });
def(602, { name: "If Escape", cat: "scene", text: () => [t("If Escape", "EventCommands"), ""], branch: true });
def(603, { name: "If Lose", cat: "scene", text: () => [t("If Lose", "EventCommands"), ""], branch: true });
def(604, { name: "End", cat: "scene", text: () => [t("End", "EventCommands"), ""], branch: true });
const GOODS_LIST = ["items", "weapons", "armors"];
def(302, {
    name: "Shop Processing", cat: "scene", cont: 605,
    text: p => [t("Shop Processing", "EventCommands"), NM(GOODS_LIST[p[0]], p[1]) + (p[4] ? ` (${t("Purchase Only", "EventCommand302")})` : "")],
    contText: p => NM(GOODS_LIST[p[0]], p[1]),
    async edit(p, ctx, conts) {
        const goods = p ? [p.slice(0, 4), ...(conts || [])].map(g => g.slice(0, 4)) : [];
        let purchaseOnly = p ? !!p[4] : false;
        return form(t("Shop Processing", "EventCommands"), b => {
            const list = h("div", { class: "evList evGoods" });
            let selIdx = -1;
            const render = () => {
                list.innerHTML = "";
                list.append(h("div", { class: "evListHead" }, h("span", null, t("Merchandise", "EventCommand302")), h("span", null, t("Price", "EventCommand302"))));
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
                const r = await form(t("Merchandise", "Dialog_Merchandise"), bb => {
                    const it = sel(db.options("items"), g[0] === 0 ? g[1] : 1), wp = sel(db.options("weapons"), g[0] === 1 ? g[1] : 1), ar = sel(db.options("armors"), g[0] === 2 ? g[1] : 1);
                    const k = radios([{ label: t("Item", "Constants"), value: 0, controls: [it] }, { label: t("Weapon", "Constants"), value: 1, controls: [wp] }, { label: t("Armor", "Constants"), value: 2, controls: [ar] }], g[0]);
                    const pr = num(g[3], { min: 0, max: 999999 });
                    const pt = radios([{ label: t("Standard", "Dialog_Merchandise"), value: 0 }, { label: t("Specify", "Dialog_Merchandise"), value: 1, controls: [pr] }], g[2]);
                    bb.append(group(t("Merchandise", "Dialog_Merchandise"), k), group(t("Price", "Dialog_Merchandise"), pt));
                    return () => [k.get(), [it, wp, ar][k.get()].get(), pt.get(), pt.get() === 1 ? pr.get() : 0];
                });
                if (r) { goods[i] = r; selIdx = i; render(); }
            };
            const po = chk(t("Purchase Only", "EventCommand302"), purchaseOnly);
            b.append(list, row(
                h("button", { type: "button", class: "evBtn", onclick: () => editGood(selIdx < 0 ? goods.length : selIdx) }, t("Edit", "StandardPopupMenu") + "…"),
                h("button", { type: "button", class: "evBtn", onclick: () => editGood(goods.length) }, t("New", "StandardPopupMenu") + "…"),
                h("button", { type: "button", class: "evBtn", onclick: () => { if (selIdx >= 0 && selIdx < goods.length) { goods.splice(selIdx, 1); render(); } } }, t("Delete", "BasicConstants"))), po.el);
            render();
            return () => {
                if (!goods.length) { alertBox(t("Add at least one item.")); return false; }
                return { p: [...goods[0], po.get()], conts: goods.slice(1) };
            };
        }, { width: "640px" });
    },
    refs: p => [[GOODS_LIST[p[0]].slice(0, -1), p[1]]]
});
def(303, {
    name: "Name Input Processing", cat: "scene", text: p => [t("Name Input Processing", "EventCommands"), `${NM("actors", p[0])}, ${p[1] === 1 ? t("%1 character", "EventCommandTexts", p[1]) : t("%1 characters", "EventCommandTexts", p[1])}`],
    async edit(p) {
        p = p || [1, 8];
        return form(t("Name Input Processing", "EventCommands"), b => { const a = sel(db.options("actors"), p[0]); const n = num(p[1], { min: 1, max: 16 }); b.append(field(t("Actor", "Constants"), a), field(t("Max characters", "EventCommand303"), n)); return () => ({ p: [a.get(), n.get()] }); });
    }
});
def(351, { name: "Open Menu Screen", cat: "scene", text: () => [t("Open Menu Screen", "EventCommands"), ""], noParams: true });
def(352, { name: "Open Save Screen", cat: "scene", text: () => [t("Open Save Screen", "EventCommands"), ""], noParams: true });
def(353, { name: "Game Over", cat: "scene", text: () => [t("Game Over", "EventCommands"), ""], noParams: true });
def(354, { name: "Return to Title Screen", cat: "scene", text: () => [t("Return to Title Screen", "EventCommands"), ""], noParams: true });

// ===== System Settings =====
def(132, Object.assign({ name: "Change Battle BGM", cat: "system" }, audioCmd("bgm", "Change Battle BGM")));
def(133, Object.assign({ name: "Change Victory ME", cat: "system" }, audioCmd("me", "Change Victory ME")));
def(139, Object.assign({ name: "Change Defeat ME", cat: "system" }, audioCmd("me", "Change Defeat ME")));
def(140, {
    name: "Change Vehicle BGM", cat: "system", text: p => [t("Change Vehicle BGM", "EventCommands"), `${VEHICLES[p[0]]}, ${audioText(p[1])}`],
    async edit(p) {
        p = p || [0, TEMPLATE.audio("")];
        return form(t("Change Vehicle BGM", "EventCommands"), b => { const v = sel(VEHICLES.map((l, i) => ({ value: i, label: l })), p[0]); const a = audioPick("bgm", p[1]); b.append(field(t("Vehicle", "EventCommand140"), v), field(t("BGM", "EventCommand140"), a)); return () => ({ p: [v.get(), a.get()] }); });
    }
});
function accessCmd(code, title, groupTitle) {
    def(code, {
        name: title, cat: "system", text: p => [t(title, "EventCommands"), p[0] === 0 ? t("Disable", "Constants") : t("Enable", "Constants")],
        async edit(p) { p = p || [0]; return form(t(title, "EventCommands"), b => { const r = radios([{ label: t("Disable", "Constants"), value: 0 }, { label: t("Enable", "Constants"), value: 1 }], p[0], { inline: true }); b.append(group(groupTitle, r)); return () => ({ p: [r.get()] }); }); }
    });
}
accessCmd(134, "Change Save Access", t("Save", "EventCommand134"));
accessCmd(135, "Change Menu Access", t("Menu", "EventCommand135"));
accessCmd(136, "Change Encounter", t("Encounter", "EventCommand136"));
accessCmd(137, "Change Formation Access", t("Formation", "EventCommand137"));
def(138, {
    name: "Change Window Color", cat: "system", text: p => [t("Change Window Color", "EventCommands"), toneText(p[0])],
    async edit(p) { p = p || [clone(db.system.windowTone || [0, 0, 0, 0])]; return form(t("Change Window Color", "EventCommands"), b => { const tp = tonePick(p[0], { gray: false }); b.append(group(t("Window Color", "EventCommand138"), tp)); return () => { const v = tp.get(); v[3] = 0; return { p: [v] }; }; }, { width: "640px" }); }
});
def(322, {
    name: "Change Actor Images", cat: "system", text: p => [t("Change Actor Images", "EventCommands"), `${NM("actors", p[0])}, ${p[1] || NONE()}(${p[2]}), ${p[3] || NONE()}(${p[4]}), ${p[5] || NONE()}`],
    async edit(p) {
        if (!p) { const a = db.actors[1] || {}; p = [1, a.characterName || "", a.characterIndex || 0, a.faceName || "", a.faceIndex || 0, a.battlerName || ""]; }
        return form(t("Change Actor Images", "EventCommands"), b => {
            const a = sel(db.options("actors"), p[0]); const c = charIndexPick(p[1], p[2]); const f = facePick(p[3], p[4]); const bt = imagePick("sv_actors", p[5]);
            b.append(field(t("Actor", "Constants"), a), group(t("Images", "EventCommand322"), row(group(t("Face", "Constants"), f), col(group(t("Character", "Constants"), c), group(t("[SV] Battler", "Constants"), bt)))));
            return () => { const cv = c.get(), fv = f.get(); return { p: [a.get(), cv.name, cv.index, fv.name, fv.index, bt.get()] }; };
        }, { width: "700px" });
    }
});
def(323, {
    name: "Change Vehicle Image", cat: "system", text: p => [t("Change Vehicle Image", "EventCommands"), `${VEHICLES[p[0]]}, ${p[1] || NONE()}(${p[2]})`],
    async edit(p) {
        p = p || [0, "", 0];
        return form(t("Change Vehicle Image", "EventCommands"), b => { const v = sel(VEHICLES.map((l, i) => ({ value: i, label: l })), p[0]); const c = charIndexPick(p[1], p[2]); b.append(field(t("Vehicle", "EventCommand323"), v), field(t("Image", "EventCommand323"), c)); return () => { const cv = c.get(); return { p: [v.get(), cv.name, cv.index] }; }; });
    }
});

// ===== Map =====
def(281, {
    name: "Change Map Name Display", cat: "map", text: p => [t("Change Map Name Display", "EventCommands"), ONOFF[p[0]]],
    async edit(p) { p = p || [0]; return form(t("Change Map Name Display", "EventCommands"), b => { const r = radios([{ label: ONOFF[0], value: 0 }, { label: ONOFF[1], value: 1 }], p[0], { inline: true }); b.append(group(t("Map Name Display", "EventCommand281"), r)); return () => ({ p: [r.get()] }); }); }
});
def(282, {
    name: "Change Tileset", cat: "map", text: p => [t("Change Tileset", "EventCommands"), NM("tilesets", p[0])],
    async edit(p) { p = p || [1]; return form(t("Change Tileset", "EventCommands"), b => { const s = sel(db.options("tilesets"), p[0]); b.append(field(t("Tileset", "Constants"), s)); return () => ({ p: [s.get()] }); }); }
});
def(283, {
    name: "Change Battle Background", cat: "map", text: p => [t("Change Battle Background", "EventCommands"), `${p[0] || NONE()} & ${p[1] || NONE()}`],
    async edit(p) { p = p || ["", ""]; return form(t("Change Battle Background", "EventCommands"), b => { const a = imagePick("battlebacks1", p[0]); const c = imagePick("battlebacks2", p[1]); b.append(group(t("Battle Background", "EventCommand283"), field(null, a), field(null, c))); return () => ({ p: [a.get(), c.get()] }); }); }
});
def(284, {
    name: "Change Parallax", cat: "map", text: p => [t("Change Parallax", "EventCommands"), `${p[0] || NONE()}${p[1] ? ` (${t("Loop Horizontally", "Constants")}: ${p[3]})` : ""}${p[2] ? ` (${t("Loop Vertically", "Constants")}: ${p[4]})` : ""}`],
    async edit(p) {
        p = p || ["", false, false, 0, 0];
        return form(t("Change Parallax", "EventCommands"), b => {
            const im = imagePick("parallaxes", p[0]); const lx = chk(t("Loop Horizontally", "Constants"), p[1]); const ly = chk(t("Loop Vertically", "Constants"), p[2]);
            const sx = num(p[3], { min: -32, max: 32 }), sy = num(p[4], { min: -32, max: 32 });
            b.append(group(t("Parallax Background", "EventCommand284"), field(t("Image", "Layout_ParallaxBack"), im), row(lx.el, field(t("Scroll", "Layout_ParallaxBack"), sx)), row(ly.el, field(t("Scroll", "Layout_ParallaxBack"), sy))));
            return () => ({ p: [im.get(), lx.get(), ly.get(), lx.get() ? sx.get() : 0, ly.get() ? sy.get() : 0] });
        });
    }
});
const LOC_INFO = [t("Terrain Tag", "Constants"), t("Event ID", "Constants"), t("Tile ID (Layer 1)", "Constants"), t("Tile ID (Layer 2)", "Constants"), t("Tile ID (Layer 3)", "Constants"), t("Tile ID (Layer 4)", "Constants"), t("Region ID", "Constants")];
def(285, {
    name: "Get Location Info", cat: "map",
    text: (p, ctx) => [t("Get Location Info", "EventCommands"), `${VR(p[0])}, ${LOC_INFO[p[1]]}, ${p[2] === 0 ? `(${p[3]},${p[4]})` : p[2] === 1 ? `({${VR(p[3])}},{${VR(p[4])}})` : charText(ctx, p[3])}`],
    async edit(p, ctx) {
        p = p || [1, 0, 0, 0, 0];
        return form(t("Get Location Info", "EventCommands"), b => {
            const v = varPick(p[0]); const ty = sel(LOC_INFO.map((l, i) => ({ value: i, label: l })), p[1]);
            const loc = locationPick((db.api && db.api.currentMapId) || 1, p[2] === 0 ? p[3] : 0, p[2] === 0 ? p[4] : 0, { allowMapChange: false });
            const vx = varPick(p[2] === 1 ? p[3] : 1), vy = varPick(p[2] === 1 ? p[4] : 1);
            const vb = row(t("X", "Group_Location"), vx, t("Y", "Group_Location"), vy); vb.enable = on => { vx.enable(on); vy.enable(on); };
            const ch = sel(charOptions(ctx), p[2] === 2 ? p[3] : -1);
            const r = radios([{ label: t("Direct designation", "Group_Location"), value: 0, controls: [loc] }, { label: t("Designation with variables", "Group_Location"), value: 1, controls: [vb] }, { label: t("Designation by a character", "Group_Location"), value: 2, controls: [ch] }], p[2]);
            b.append(field(t("Variable", "Constants"), v), field(t("Info Type", "EventCommand285"), ty), group(t("Location", "Group_Location"), r));
            return () => {
                const k = r.get();
                if (k === 0) { const l = loc.get(); return { p: [v.get(), ty.get(), 0, l.x, l.y] }; }
                if (k === 1) { return { p: [v.get(), ty.get(), 1, vx.get(), vy.get()] }; }
                return { p: [v.get(), ty.get(), 2, ch.get(), 0] };
            };
        }, { width: "640px" });
    },
    refs: p => [["variable", p[0]], ...(p[2] === 1 ? [["variable", p[3]], ["variable", p[4]]] : [])]
});

// ===== Battle =====
function enemyValueCmd(code, title, death) {
    def(code, {
        name: title, cat: "battle",
        text: p => [t(title, "EventCommands"), `${enemyText(p[0])}, ${operandText(p[1], p[2], p[3])}${death && p[4] ? ` (${t("Allow Death", "Constants")})` : ""}`],
        async edit(p) {
            p = p || [-1, 0, 0, 1, false];
            return form(t(title, "EventCommands"), b => {
                const e = sel(enemyOptions(), p[0]); const o = operandUI(p[1], p[2], p[3]); const k = death ? chk(t("Allow Death", "Constants"), p[4]) : null;
                b.append(field(t("Enemy", "Constants"), e), o.el, k ? k.el : null);
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
    name: "Change Enemy State", cat: "battle", text: p => [t("Change Enemy State", "EventCommands"), `${enemyText(p[0])}, ${p[1] === 0 ? "+" : "-"} ${NM("states", p[2])}`],
    async edit(p) {
        p = p || [-1, 0, 1];
        return form(t("Change Enemy State", "EventCommands"), b => { const e = sel(enemyOptions(), p[0]); const o = radios([{ label: t("Add", "EventCommand333"), value: 0 }, { label: t("Remove", "EventCommand333"), value: 1 }], p[1], { inline: true }); const s = sel(db.options("states"), p[2]); b.append(field(t("Enemy", "Constants"), e), group(t("Operation", "Group_Operation"), o), field(t("State", "Constants"), s)); return () => ({ p: [e.get(), o.get(), s.get()] }); });
    }
});
def(334, {
    name: "Enemy Recover All", cat: "battle", text: p => [t("Enemy Recover All", "EventCommands"), enemyText(p[0])],
    async edit(p) { p = p || [-1]; return form(t("Enemy Recover All", "EventCommands"), b => { const e = sel(enemyOptions(), p[0]); b.append(field(t("Enemy", "Constants"), e)); return () => ({ p: [e.get()] }); }); }
});
def(335, {
    name: "Enemy Appear", cat: "battle", text: p => [t("Enemy Appear", "EventCommands"), enemyText(p[0])],
    async edit(p) { p = p || [0]; return form(t("Enemy Appear", "EventCommands"), b => { const e = sel(enemyOptions(false), p[0]); b.append(field(t("Enemy", "Constants"), e)); return () => ({ p: [e.get()] }); }); }
});
def(336, {
    name: "Enemy Transform", cat: "battle", text: p => [t("Enemy Transform", "EventCommands"), `${enemyText(p[0])}, ${NM("enemies", p[1])}`],
    async edit(p) { p = p || [0, 1]; return form(t("Enemy Transform", "EventCommands"), b => { const e = sel(enemyOptions(false), p[0]); const tg = sel(db.options("enemies"), p[1]); b.append(field(t("Enemy", "Constants"), e), field(t("Transform to", "EventCommand336"), tg)); return () => ({ p: [e.get(), tg.get()] }); }); }
});
def(337, {
    name: "Show Battle Animation", cat: "battle", text: p => [t("Show Battle Animation", "EventCommands"), `${p[2] ? t("Entire Troop", "EventCommandTexts") : enemyText(p[0])}, ${NM("animations", p[1])}`],
    async edit(p) {
        p = p || [0, 1, false];
        return form(t("Show Battle Animation", "EventCommands"), b => {
            const e = sel(enemyOptions(false), Math.max(0, p[0])); const all = chk(t("Entire Troop", "ObjTroopMemberBox"), p[2]); const a = sel(db.options("animations"), p[1]);
            b.append(field(t("Enemy", "Constants"), e), all.el, field(t("Animation", "Constants"), a));
            return () => ({ p: [e.get(), a.get(), all.get()] });
        });
    }
});
const FORCE_TARGET = [{ value: -2, label: t("Last Target", "Constants") }, { value: -1, label: t("Random", "Constants") }, ...[1, 2, 3, 4, 5, 6, 7, 8].map(i => ({ value: i - 1, label: t("Index %1", "Constants", i) }))];
def(339, {
    name: "Force Action", cat: "battle",
    text: p => [t("Force Action", "EventCommands"), `${p[0] === 0 ? "#" + (p[1] + 1) : NM("actors", p[1])}, ${NM("skills", p[2])}, ${(FORCE_TARGET.find(x => x.value === p[3]) || {}).label}`],
    async edit(p) {
        p = p || [0, 0, 1, -2];
        return form(t("Force Action", "EventCommands"), b => {
            const e = sel(enemyOptions(false), p[0] === 0 ? p[1] : 0); const a = sel(db.options("actors"), p[0] === 1 ? p[1] : 1);
            const r = radios([{ label: t("Enemy", "Constants"), value: 0, controls: [e] }, { label: t("Actor", "Constants"), value: 1, controls: [a] }], p[0]);
            const s = sel(db.options("skills"), p[2]); const tg = sel(FORCE_TARGET, p[3]);
            b.append(group(t("Subject", "EventCommand339"), r), group(t("Action", "EventCommand339"), field(t("Skill", "Constants"), s), field(t("Target", "EventCommand339"), tg)));
            return () => ({ p: [r.get(), r.get() === 0 ? e.get() : a.get(), s.get(), tg.get()] });
        });
    }
});
def(340, { name: "Abort Battle", cat: "battle", text: () => [t("Abort Battle", "EventCommands"), ""], noParams: true });

// ===== Advanced =====
def(355, {
    name: "Script", cat: "adv", cont: 655,
    text: p => [t("Script", "EventCommands"), p[0]], contText: p => p[0],
    async edit(p, ctx, conts) {
        const lines = p ? [p[0], ...(conts || []).map(c => c[0])] : [];
        return form(t("Script", "EventCommand355"), b => {
            const te = textEditor(lines, 14); b.append(te.el);
            return () => { const l = te.get().split("\n"); return { p: [l[0]], conts: l.slice(1).map(x => [x]) }; };
        }, { width: "860px" });
    }
});
def(356, { name: "Plugin Command (MV)", cat: "adv", text: p => [t("Plugin Command", "EventCommands"), p[0]],
    async edit(p) { p = p || [""]; return form(t("Plugin Command", "EventCommands") + " (MV)", b => { const tx = txt(p[0], { width: "420px" }); b.append(field(t("Plugin Command", "EventCommand356"), tx)); return () => ({ p: [tx.get()] }); }); } });
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
    text: p => [t("Plugin Command", "EventCommands"), `${p[0]}, ${p[2] || p[1]}`], contText: p => p[0],
    async edit(p) {
        ensurePluginsCss();
        const sources = await pluginCommandSources(p ? p[0] : "");
        p = p || [sources[0] ? sources[0].name : "", "", "", {}];
        let values = clone(p[3]) || {};
        let cmdInfo = null;
        return form(t("Plugin Command", "EventCommand357"), b => {
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
                desc.textContent = cmdInfo ? cmdInfo.desc : (sources.length ? "" : t("No plugin with @command in js/plugins/."));
                argHelp.textContent = "";
                if (!keep) { values = {}; }
                values = cmdInfo ? { ...defaultArgs(cmdInfo), ...values } : values;
                table.setData(cmdInfo ? cmdInfo.args : [], values, cmdInfo ? cmdInfo.structs : {});
            };
            pl.onChange(() => fillCmds(false));
            cm.onChange(() => fillArgs(false));
            fillCmds(true);
            const editBtn = h("button", { type: "button", class: "evBtn", onclick: () => table.edit() }, t("Edit", "StandardPopupMenu") + "…");
            b.append(row(field(t("Plugin Name", "EventCommand357"), pl), field(t("Command Name", "EventCommand357"), cm)), desc,
                group(t("Arguments", "EventCommand357"), table.root, row(editBtn, h("span", { class: "evDesc" }, t("Tap the selected argument to edit it."))), argHelp));
            return () => {
                if (!pl.get() || !cm.get()) { alertBox(t("Select a plugin and a command.")); return false; }
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
            title: t("Event Commands", "Dialog_EventCommandSelect"), width: "1240px", height: "96vh", okLabel: t("Close", "BasicConstants"), noCancel: true,
            build: (body, dlg) => {
                const tb = tabs(PALETTE.map((tab, i) => ({
                    label: String(i + 1),
                    content: [h("div", { class: "evPalette" }, ...tab.map(([title, codes]) => h("div", { class: "evPalGroup" + (codes.length > 8 ? " wide" : "") },
                        h("div", { class: "evPalTitle" }, t(title, "Dialog_EventCommandSelect")),
                        h("div", { class: "evPalBtns" }, ...codes.map(code => h("button", { type: "button", class: "evBtn evPalBtn cat-" + CMD[code].cat, onclick: () => { chosen = code; dlg.close(); } },
                            t(CMD[code].name, "EventCommands") + (CMD[code].noParams ? "" : "…")))))))]
                })), pickCommand.lastTab || 0);
                tb.el.addEventListener("click", () => { pickCommand.lastTab = tb.active; });
                body.append(tb.el);
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
    return form(t("Select a Color", "Dialog_ColorSelector"), b => {
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
    return form(t("Select an Icon", "Dialog_IconSelector"), b => {
        let cur = 0;
        const cv = h("canvas", { class: "evIconCanvas" });
        cv.width = im.width; cv.height = im.height;
        const ctx = cv.getContext("2d");
        const draw = () => { ctx.clearRect(0, 0, cv.width, cv.height); ctx.drawImage(im, 0, 0); ctx.strokeStyle = "#f00"; ctx.lineWidth = 3; ctx.strokeRect((cur % 16) * 32 + 1.5, Math.floor(cur / 16) * 32 + 1.5, 29, 29); info.textContent = t("Icon Index", "Dialog_IconSelector") + " " + cur; };
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
