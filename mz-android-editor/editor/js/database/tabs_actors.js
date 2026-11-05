// Abas Actors e Classes.
import { el, num, text, area, sel, fld, grp, grid, btn, tableList, modal, tabs, changed } from "./ui.js";
import { PARAMS, idOptions, nameOf, expForLevel, generateCurve, quickCurve, PARAM_MIN, PARAM_MAX, PARAM_GRAPH_MAX, GROWTH_MIN, GROWTH_NORMAL, GROWTH_MAX } from "./common.js";
import { traitsList } from "./traits.js";
import { openPluginHelp } from "./pluginhelp.js";
import { pickSheet, pickImage, faceThumb, charThumb, svThumb } from "./pickers.js";
import { t } from "../i18n.js";

export function cols(host) {
    const left = el("div", { class: "dbCol" });
    const right = el("div", { class: "dbCol" });
    host.appendChild(el("div", { class: "dbCols" }, left, right));
    return [left, right];
}

export function noteGroup(obj, rows = 5) {
    const ta = area(obj, "note", { rows });
    return grp(t("Note", "Constants"), ta, el("div", { class: "dbRow" }, btn(t("Plugin Help", "TextEditPopupMenuEx") + "...", () => openPluginHelp(obj, "note", ta), "small")));
}

// Caixa de imagem tocável (rótulo + miniatura).
export function imageBox(label, makeThumb, onPick) {
    const holder = el("button", { class: "dbImgBox", type: "button" });
    const paint = () => { holder.innerHTML = ""; holder.appendChild(makeThumb()); };
    paint();
    holder.addEventListener("click", async () => { if (await onPick()) { changed(); paint(); } });
    return el("div", { class: "dbImgField" }, el("div", { class: "dbLabel", text: label }), holder);
}

// ------------------------------------------------------------------ Actors

function hasDualWield(...owners) {
    return owners.some(o => o && (o.traits || []).some(tr => tr.code === 55 && tr.dataId === 1));
}
function allowed(owners, code) {
    const s = new Set();
    for (const o of owners) { for (const tr of (o && o.traits) || []) { if (tr.code === code) { s.add(tr.dataId); } } }
    return s;
}

function equipmentGroup(db, a) {
    const sys = db.System;
    const box = el("div", { class: "dbEquip" });
    const render = () => {
        box.innerHTML = "";
        const cls = db.Classes[a.classId];
        const owners = [a, cls];
        const dual = hasDualWield(a, cls);
        const wOk = allowed(owners, 51), aOk = allowed(owners, 52);
        const nSlots = Math.max(1, sys.equipTypes.length - 1);
        while (a.equips.length < nSlots) { a.equips.push(0); }
        for (let i = 0; i < nSlots; i++) {
            const etype = dual && i === 1 ? 1 : i + 1;
            let opts;
            if (etype === 1) {
                opts = idOptions(db.Weapons, t("None", "Constants")).filter(([id]) => !id || id === a.equips[i] || wOk.has(db.Weapons[id]?.wtypeId));
            } else {
                opts = idOptions(db.Armors, t("None", "Constants")).filter(([id]) => !id || id === a.equips[i] ||
                    (db.Armors[id] && db.Armors[id].etypeId === etype && aOk.has(db.Armors[id].atypeId)));
            }
            box.appendChild(el("div", { class: "dbEquipRow" },
                el("div", { class: "dbEquipType", text: sys.equipTypes[etype] || "" }),
                sel(a.equips, i, opts, { number: true })));
        }
    };
    render();
    box.refresh = render;
    return box;
}

export const actorsTab = {
    id: "actors", label: t("Actors", "DatabaseMain"), desc: t("Data for player-controlled party members.", "DatabaseMain"), file: "Actors", max: 1000,
    form(ctx, a, host) {
        const db = ctx.db;
        const [left, right] = cols(host);
        const equip = equipmentGroup(db, a);
        left.appendChild(grp(t("General Settings", "Constants"), grid(2,
            fld(t("Name", "Constants") + ":", text(a, "name", { onInput: () => ctx.refreshRow() })),
            fld(t("Nickname", "Edit_Actors") + ":", text(a, "nickname")),
            fld(t("Class", "Constants") + ":", sel(a, "classId", idOptions(db.Classes), { number: true, onChange: () => equip.refresh() })),
            el("div", { class: "dbInline2" },
                fld(t("Initial Level", "Edit_Actors") + ":", num(a, "initialLevel", { min: 1, max: 99 })),
                fld(t("Max Level", "Edit_Actors") + ":", num(a, "maxLevel", { min: 1, max: 99 }))),
            fld(t("Profile", "Edit_Actors") + ":", area(a, "profile", { rows: 2 }), { span: 2 }))));
        left.appendChild(grp(t("Images", "Edit_Actors"), el("div", { class: "dbImgRow" },
            imageBox(t("Face", "Constants") + ":", () => faceThumb(a.faceName, a.faceIndex, 96), async () => {
                const r = await pickSheet({ kind: "face", name: a.faceName, index: a.faceIndex });
                if (r) { a.faceName = r.name; a.faceIndex = r.index; return true; }
            }),
            imageBox(t("Character", "Constants") + ":", () => charThumb(a.characterName, a.characterIndex, 96), async () => {
                const r = await pickSheet({ kind: "character", name: a.characterName, index: a.characterIndex });
                if (r) { a.characterName = r.name; a.characterIndex = r.index; return true; }
            }),
            imageBox(t("[SV] Battler", "Constants") + ":", () => svThumb(a.battlerName, 96), async () => {
                const r = await pickImage({ folder: "sv_actors", current: a.battlerName });
                if (r) { a.battlerName = r.name; return true; }
            }))));
        left.appendChild(grp(t("Initial Equipment", "Edit_Actors"), equip));
        const traits = traitsList(db, a, { onChange: () => equip.refresh() });
        right.appendChild(grp(t("Traits", "Group_Traits"), traits));
        right.appendChild(noteGroup(a));
    }
};

// ------------------------------------------------------------------ Classes

const PARAM_COLORS = ["#e8903c", "#3c78e8", "#d84040", "#c8a020", "#a040d0", "#38a048", "#30a8c8", "#d860a0"];

function drawCurve(cv, values, color, max, selLevel) {
    const ctx = cv.getContext("2d");
    const W = cv.width, H = cv.height;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, W, H);
    const top = max;
    const bw = W / 99;
    ctx.fillStyle = color;
    for (let lv = 1; lv <= 99; lv++) {
        const h = (values[lv] || 0) / top * (H - 2);
        ctx.fillRect((lv - 1) * bw, H - h, Math.ceil(bw), h);
    }
    if (selLevel) {
        ctx.fillStyle = "rgba(0,0,0,.55)";
        ctx.fillRect((selLevel - 1) * bw, 0, Math.max(1, Math.ceil(bw)), H);
    }
}

function curveThumb(c, i) {
    const cv = el("canvas", { class: "dbCurve" });
    cv.width = 198; cv.height = 70;
    drawCurve(cv, c.params[i], PARAM_COLORS[i], PARAM_GRAPH_MAX[i]);
    return el("div", { class: "dbCurveBox" }, el("div", { class: "dbLabel", text: PARAMS[i] }), cv);
}

async function generateCurveDialog(i, values) {
    const o = { v1: values[1], v99: values[99], g: GROWTH_NORMAL };
    const ok = await modal({
        title: t("Generate Curve", "Dialog_GenerateCurve"), width: "460px",
        build: b => {
            b.appendChild(grid(2,
                fld(t("Level 1", "Dialog_GenerateCurve") + ":", num(o, "v1", { min: PARAM_MIN[i], max: PARAM_MAX[i] })),
                fld(t("Level 99", "Dialog_GenerateCurve") + ":", num(o, "v99", { min: PARAM_MIN[i], max: PARAM_MAX[i] }))));
            const s = el("input", { type: "range", min: GROWTH_MIN, max: GROWTH_MAX, step: 1, value: o.g, class: "dbRange" });
            s.addEventListener("input", () => { o.g = Number(s.value); });
            b.appendChild(grp(t("Growth Type", "Dialog_GenerateCurve"), s, el("div", { class: "dbGrowthLabels" },
                el("span", { text: t("Fast", "Dialog_GenerateCurve") }), el("span", { text: t("Normal", "Dialog_GenerateCurve") }), el("span", { text: t("Slow", "Dialog_GenerateCurve") }))));
        }
    });
    return ok ? generateCurve(o.v1, o.v99, o.g, values) : null;
}

async function editParamCurves(c, initial) {
    const params = structuredClone(c.params);
    const state = { level: 1 };
    const ok = await modal({
        title: t("Parameter Curves", "Dialog_ParameterCurves"), width: "780px", height: "560px",
        build: body => {
            body.appendChild(tabs(PARAMS.map((name, i) => ({
                title: name,
                build: page => {
                    const cv = el("canvas", { class: "dbCurveBig" });
                    cv.width = 594; cv.height = 260;
                    const lv = { v: state.level };
                    const val = { v: params[i][state.level] };
                    const valInput = num(val, "v", { min: PARAM_MIN[i], max: PARAM_MAX[i], onChange: v => {
                        params[i][lv.v] = v; redraw();
                    } });
                    const lvInput = num(lv, "v", { min: 1, max: 99, onChange: v => { state.level = v; val.v = params[i][v]; valInput.refresh(); redraw(); } });
                    const redraw = () => drawCurve(cv, params[i], PARAM_COLORS[i], PARAM_GRAPH_MAX[i], lv.v);
                    const pick = e => {
                        const r = cv.getBoundingClientRect();
                        lv.v = Math.max(1, Math.min(99, Math.floor((e.clientX - r.left) / r.width * 99) + 1));
                        state.level = lv.v;
                        val.v = params[i][lv.v];
                        lvInput.refresh(); valInput.refresh(); redraw();
                    };
                    cv.addEventListener("pointerdown", e => { cv.setPointerCapture(e.pointerId); pick(e); });
                    cv.addEventListener("pointermove", e => { if (e.buttons) { pick(e); } });
                    const quick = el("div", { class: "dbRow" }, el("span", { text: t("Quick Setting", "Dialog_ParameterCurves") + ":" }),
                        ...["A", "B", "C", "D", "E"].map((L, k) => btn(L, () => {
                            params[i] = quickCurve(i, k, params[i]);
                            val.v = params[i][lv.v]; valInput.refresh(); redraw();
                        }, "small")));
                    page.append(quick,
                        el("div", { class: "dbCurveWrap" }, cv),
                        el("div", { class: "dbRow" }, fld(t("Level", "Constants") + ":", lvInput), fld(t("Value", "Dialog_ParameterCurves") + ":", valInput),
                            btn(t("Generate Curve", "Dialog_ParameterCurves") + "...", async () => {
                                const r = await generateCurveDialog(i, params[i]);
                                if (r) { params[i] = r; val.v = params[i][lv.v]; valInput.refresh(); redraw(); }
                            })));
                    redraw();
                }
            })), { initial }));
        }
    });
    if (ok) { c.params = params; changed(); }
    return ok;
}

async function editExpCurve(c) {
    const p = { base: c.expParams[0], extra: c.expParams[1], a: c.expParams[2], b: c.expParams[3] };
    let mode = 0;
    const table = el("div", { class: "dbExpTable" });
    const render = () => {
        const arr = [p.base, p.extra, p.a, p.b];
        table.innerHTML = "";
        for (let lv = 1; lv < 100; lv++) {
            const v = mode === 0 ? (lv < 99 ? expForLevel(arr, lv + 1) - expForLevel(arr, lv) : 0) : expForLevel(arr, lv);
            table.appendChild(el("div", { class: "dbExpCell" }, el("b", { text: "L" + lv + ": " }), String(v)));
        }
    };
    const ok = await modal({
        title: t("EXP Curve", "Dialog_ExpCurve"), width: "760px", height: "560px",
        build: b => {
            b.appendChild(tabs([{ title: t("To Next Level", "Dialog_ExpCurve"), build: pg => { mode = 0; render(); pg.appendChild(table); } },
                { title: t("Total", "Dialog_ExpCurve"), build: pg => { mode = 1; render(); pg.appendChild(table); } }]));
            b.appendChild(grid(4,
                fld(t("Base Value", "Dialog_ExpCurve") + ":", num(p, "base", { min: 10, max: 50, onChange: render })),
                fld(t("Extra Value", "Dialog_ExpCurve") + ":", num(p, "extra", { min: 0, max: 40, onChange: render })),
                fld(t("Acceleration A", "Dialog_ExpCurve") + ":", num(p, "a", { min: 10, max: 50, onChange: render })),
                fld(t("Acceleration B", "Dialog_ExpCurve") + ":", num(p, "b", { min: 10, max: 50, onChange: render }))));
        }
    });
    if (ok) { c.expParams = [p.base, p.extra, p.a, p.b]; changed(); }
    return ok;
}

async function editLearning(db, l) {
    const o = l ? { ...l } : { level: 1, note: "", skillId: 1 };
    const ok = await modal({
        title: t("Learnable Skills", "Dialog_SkillsToLearn"), width: "520px",
        build: b => b.appendChild(grid(2,
            fld(t("Level", "Constants") + ":", num(o, "level", { min: 1, max: 99 })),
            fld(t("Skill", "Constants") + ":", sel(o, "skillId", idOptions(db.Skills), { number: true })),
            fld(t("Note", "Constants") + ":", text(o, "note"), { span: 2 })))
    });
    return ok ? o : null;
}

export const classesTab = {
    id: "classes", label: t("Classes", "DatabaseMain"), desc: t("Data that determines roles of actors within the party.", "DatabaseMain"), file: "Classes", max: 1000,
    form(ctx, c, host) {
        const db = ctx.db;
        const [left, right] = cols(host);
        const expText = () => `${c.expParams.join(", ")}`;
        const expBtn = btn("", async () => { if (await editExpCurve(c)) { expBtn.textContent = expText(); } }, "dbPickBtn");
        expBtn.textContent = expText();
        left.appendChild(grp(t("General Settings", "Constants"), grid(2,
            fld(t("Name", "Constants") + ":", text(c, "name", { onInput: () => ctx.refreshRow() })),
            fld(t("EXP Curve", "Edit_Classes") + ":", expBtn))));
        const curves = el("div", { class: "dbCurves" });
        const paintCurves = () => {
            curves.innerHTML = "";
            PARAMS.forEach((_, i) => {
                const box = curveThumb(c, i);
                box.addEventListener("click", async () => { if (await editParamCurves(c, i)) { paintCurves(); } });
                curves.appendChild(box);
            });
        };
        paintCurves();
        left.appendChild(grp(t("Parameter Curves", "Edit_Classes"), curves));
        left.appendChild(grp(t("Learnable Skills", "Group_SkillsToLearn"), tableList({
            columns: [{ title: t("Level", "Constants"), width: "70px" }, { title: t("Skill", "Constants"), width: "1fr" }, { title: t("Note", "Constants"), width: "1fr" }],
            items: c.learnings,
            cells: l => [t("Lv", "NewDataMaker") + " " + String(l.level).padStart(2, " "), nameOf(db.Skills, l.skillId), l.note],
            create: () => editLearning(db, null),
            edit: l => editLearning(db, l),
            clipKey: "learning"
        })));
        right.appendChild(grp(t("Traits", "Group_Traits"), traitsList(db, c)));
        right.appendChild(noteGroup(c));
    }
};
