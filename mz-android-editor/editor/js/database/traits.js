// Traits (Game_BattlerBase.TRAIT_*) e Effects (Game_Action.EFFECT_*): listas e diálogos.
import { el, num, sel, tabs, tableList, modal } from "./ui.js";
import { PARAMS, XPARAMS, SPARAMS, SPECIAL_FLAGS, COLLAPSE, PARTY_ABILITY, idOptions, typeOptions, nameOf } from "./common.js";
import { t } from "../i18n.js";

const pct = v => Math.round(v * 100 * 100) / 100;
const typeName = (list, i) => (list && list[i]) || "";

function optionLists(db) {
    const s = db.System;
    return {
        elements: () => typeOptions(s.elements),
        params: () => PARAMS.map((n, i) => [i, n]),
        xparams: () => XPARAMS.map((n, i) => [i, n]),
        sparams: () => SPARAMS.map((n, i) => [i, n]),
        states: () => idOptions(db.States),
        skills: () => idOptions(db.Skills),
        stypes: () => typeOptions(s.skillTypes),
        wtypes: () => typeOptions(s.weaponTypes),
        atypes: () => typeOptions(s.armorTypes),
        etypes: () => typeOptions(s.equipTypes),
        slot: () => [[1, t("Dual Wield", "Constants")]],
        special: () => SPECIAL_FLAGS.map((n, i) => [i, n]),
        collapse: () => COLLAPSE.map((n, i) => [i, n]),
        party: () => PARTY_ABILITY.map((n, i) => [i, n]),
        commons: () => idOptions(db.CommonEvents),
        escape: () => [[0, t("Escape", "Constants")]],
        statesAtk: () => [[0, t("Normal Attack", "Dialog_Effects")], ...idOptions(db.States)]
    };
}

// value: "rate" (×%, 0..1000), "plus" (+%, -100..100), "plus1000" (+%, 0..1000), "int", "pct100" (%, 0..100)
// linha: [code, rótulo no diálogo, lista, tipo, rótulo na lista]
const TRAIT_TABS = [
    [t("Rates", "Dialog_Traits"), [
        [11, t("Element Rate", "Dialog_Traits"), "elements", "rate", t("Element Rate", "Group_Traits")],
        [12, t("Debuff Rate", "Dialog_Traits"), "params", "rate", t("Debuff Rate", "Group_Traits")],
        [13, t("State Rate", "Dialog_Traits"), "states", "rate", t("State Rate", "Group_Traits")],
        [14, t("State Resist", "Dialog_Traits"), "states", null, t("State Resist", "Group_Traits")]]],
    [t("Param", "Dialog_Traits"), [
        [21, t("Parameter", "Dialog_Traits"), "params", "rate", t("Parameter", "Group_Traits")],
        [22, t("Ex-Parameter", "Dialog_Traits"), "xparams", "plus", t("Ex-Parameter", "Group_Traits")],
        [23, t("Sp-Parameter", "Dialog_Traits"), "sparams", "rate", t("Sp-Parameter", "Group_Traits")]]],
    [t("Attack", "Dialog_Traits"), [
        [31, t("Attack Element", "Dialog_Traits"), "elements", null, t("Attack Element", "Group_Traits")],
        [32, t("Attack State", "Dialog_Traits"), "states", "plus1000", t("Attack State", "Group_Traits")],
        [33, t("Attack Speed", "Dialog_Traits"), null, "speed", t("Attack Speed", "Group_Traits")],
        [34, t("Attack Times +", "Dialog_Traits"), null, "times", t("Attack Times +", "Group_Traits")],
        [35, t("Attack Skill", "Dialog_Traits"), "skills", null, t("Attack Skill", "Group_Traits")]]],
    [t("Skill", "Constants"), [
        [41, t("Add Skill Type", "Dialog_Traits"), "stypes", null, t("Add Skill Type", "Group_Traits")],
        [42, t("Seal Skill Type", "Dialog_Traits"), "stypes", null, t("Seal Skill Type", "Group_Traits")],
        [43, t("Add Skill", "Dialog_Traits"), "skills", null, t("Add Skill", "Group_Traits")],
        [44, t("Seal Skill", "Dialog_Traits"), "skills", null, t("Seal Skill", "Group_Traits")]]],
    [t("Equip", "Dialog_Traits"), [
        [51, t("Equip Weapon", "Dialog_Traits"), "wtypes", null, t("Equip Weapon", "Group_Traits")],
        [52, t("Equip Armor", "Dialog_Traits"), "atypes", null, t("Equip Armor", "Group_Traits")],
        [53, t("Lock Equip", "Dialog_Traits"), "etypes", null, t("Lock Equip", "Group_Traits")],
        [54, t("Seal Equip", "Dialog_Traits"), "etypes", null, t("Seal Equip", "Group_Traits")],
        [55, t("Slot Type", "Dialog_Traits"), "slot", null, t("Slot Type", "Group_Traits")]]],
    [t("Other", "Dialog_Traits"), [
        [61, t("Action Times +", "Dialog_Traits"), null, "pct100", t("Action Times +", "Group_Traits")],
        [62, t("Special Flag", "Dialog_Traits"), "special", null, t("Special Flag", "Group_Traits")],
        [63, t("Collapse Effect", "Dialog_Traits"), "collapse", null, t("Collapse Effect", "Group_Traits")],
        [64, t("Party Ability", "Dialog_Traits"), "party", null, t("Party Ability", "Group_Traits")]]]
];
const TRAIT_DEF = new Map(TRAIT_TABS.flatMap(([, rows]) => rows.map(r => [r[0], r])));

function defaultTraitValue(kind) {
    return kind === "rate" ? 1 : kind === "pct100" ? 1 : 0;
}

function traitValueControl(v, kind) {
    switch (kind) {
        case "rate": return ["* ", num(v, "value", { scale: 100, min: 0, max: 1000, float: true }), " %"];
        case "plus": return ["+ ", num(v, "value", { scale: 100, min: -100, max: 100, float: true }), " %"];
        case "plus1000": return ["+ ", num(v, "value", { scale: 100, min: 0, max: 1000, float: true }), " %"];
        case "speed": return [num(v, "value", { min: -999, max: 999 })];
        case "times": return [num(v, "value", { min: 0, max: 9 })];
        case "pct100": return [num(v, "value", { scale: 100, min: 0, max: 100, float: true }), " %"];
        default: return [];
    }
}

export function traitText(db, tr) {
    const def = TRAIT_DEF.get(tr.code);
    if (!def) { return [t("Code %1", "MZEditor", tr.code), `${tr.dataId} / ${tr.value}`]; }
    const s = db.System;
    const [, , list, kind, label] = def;
    let data = "";
    switch (list) {
        case "elements": data = typeName(s.elements, tr.dataId); break;
        case "params": data = PARAMS[tr.dataId] || ""; break;
        case "xparams": data = XPARAMS[tr.dataId] || ""; break;
        case "sparams": data = SPARAMS[tr.dataId] || ""; break;
        case "states": data = nameOf(db.States, tr.dataId); break;
        case "skills": data = nameOf(db.Skills, tr.dataId); break;
        case "stypes": data = typeName(s.skillTypes, tr.dataId); break;
        case "wtypes": data = typeName(s.weaponTypes, tr.dataId); break;
        case "atypes": data = typeName(s.armorTypes, tr.dataId); break;
        case "etypes": data = typeName(s.equipTypes, tr.dataId); break;
        case "slot": data = tr.dataId === 1 ? t("Dual Wield", "Constants") : t("Normal", "Constants"); break;
        case "special": data = SPECIAL_FLAGS[tr.dataId] || ""; break;
        case "collapse": data = COLLAPSE[tr.dataId] || ""; break;
        case "party": data = PARTY_ABILITY[tr.dataId] || ""; break;
    }
    switch (kind) {
        case "rate": data += ` * ${pct(tr.value)}%`; break;
        case "plus": case "plus1000": data += ` + ${pct(tr.value)}%`; break;
        case "speed": case "times": data = String(tr.value); break;
        case "pct100": data = pct(tr.value) + "%"; break;
    }
    return [label, data.trim()];
}

// Diálogo genérico de "radio + controles" em abas. rows: [code, label, listKey, kind]
async function codeDialog({ title, tabDefs, item, makeVals, controls, opts }) {
    const vals = new Map();
    for (const [, rows] of tabDefs) {
        for (const r of rows) { vals.set(r[0], makeVals(r, item && item.code === r[0] ? item : null)); }
    }
    let code = item ? item.code : tabDefs[0][1][0][0];
    const radioName = "c" + Math.random().toString(36).slice(2);
    const initialTab = Math.max(0, tabDefs.findIndex(([, rows]) => rows.some(r => r[0] === code)));
    const ok = await modal({
        title, width: "640px", height: "500px",
        build: body => {
            body.appendChild(tabs(tabDefs.map(([tabTitle, rows]) => ({
                title: tabTitle,
                build: page => {
                    for (const r of rows) {
                        const v = vals.get(r[0]);
                        const radio = el("input", { type: "radio", name: radioName, checked: code === r[0] });
                        radio.addEventListener("change", () => { if (radio.checked) { code = r[0]; } });
                        const line = el("div", { class: "dbCodeRow" },
                            el("label", { class: "dbChk dbCodeLabel" }, radio, el("span", { text: r[1] })),
                            el("div", { class: "dbInline" }, r[2] ? sel(v, "dataId", opts[r[2]](), { number: true }) : null, controls(v, r)));
                        line.addEventListener("pointerdown", () => { radio.checked = true; code = r[0]; }, true);
                        page.appendChild(line);
                    }
                }
            })), { initial: initialTab }));
        }
    });
    if (!ok) { return null; }
    return { code, ...vals.get(code) };
}

export function editTrait(db, trait) {
    const opts = optionLists(db);
    return codeDialog({
        title: t("Traits", "Dialog_Traits"), tabDefs: TRAIT_TABS, item: trait, opts,
        makeVals: (r, cur) => {
            const first = r[2] ? (opts[r[2]]()[0] || [0])[0] : 0;
            return cur ? { dataId: cur.dataId, value: cur.value } : { dataId: first, value: defaultTraitValue(r[3]) };
        },
        controls: (v, r) => traitValueControl(v, r[3])
    }).then(r => r && ({ code: r.code, dataId: r.dataId, value: r.value }));
}

export function traitsList(db, owner, o = {}) {
    return tableList({
        columns: [{ title: t("Type", "Constants"), width: "42%" }, { title: t("Content", "Group_Traits"), width: "1fr" }],
        items: owner.traits,
        cells: tr => traitText(db, tr),
        create: () => editTrait(db, null),
        edit: tr => editTrait(db, tr),
        clipKey: "trait",
        height: o.height,
        onChange: o.onChange
    });
}

// ------------------------------------------------------------------- Effects

const EFFECT_TABS = [
    [t("Recover", "Dialog_Effects"), [
        [11, t("Recover HP", "Dialog_Effects"), null, "hp", t("Recover HP", "Group_Effects")],
        [12, t("Recover MP", "Dialog_Effects"), null, "mp", t("Recover MP", "Group_Effects")],
        [13, t("Gain TP", "Dialog_Effects"), null, "tp", t("Gain TP", "Group_Effects")]]],
    [t("State", "Constants"), [
        [21, t("Add State", "Dialog_Effects"), "statesAtk", "rate", t("Add State", "Group_Effects")],
        [22, t("Remove State", "Dialog_Effects"), "states", "rate", t("Remove State", "Group_Effects")]]],
    [t("Param", "Dialog_Effects"), [
        [31, t("Add Buff", "Dialog_Effects"), "params", "turns", t("Add Buff", "Group_Effects")],
        [32, t("Add Debuff", "Dialog_Effects"), "params", "turns", t("Add Debuff", "Group_Effects")],
        [33, t("Remove Buff", "Dialog_Effects"), "params", null, t("Remove Buff", "Group_Effects")],
        [34, t("Remove Debuff", "Dialog_Effects"), "params", null, t("Remove Debuff", "Group_Effects")]]],
    [t("Other", "Dialog_Effects"), [
        [41, t("Special Effect", "Dialog_Effects"), "escape", null, t("Special Effect", "Group_Effects")],
        [42, t("Grow", "Dialog_Effects"), "params", "grow", t("Grow", "Group_Effects")],
        [43, t("Learn Skill", "Dialog_Effects"), "skills", null, t("Learn Skill", "Group_Effects")],
        [44, t("Common Event", "Constants"), "commons", null, t("Common Event", "Constants")]]]
];
const EFFECT_DEF = new Map(EFFECT_TABS.flatMap(([, rows]) => rows.map(r => [r[0], r])));

function effectControls(v, kind) {
    switch (kind) {
        case "hp": return [num(v, "value1", { scale: 100, min: -100, max: 100, float: true }), " % + ", num(v, "value2", { min: -999999, max: 999999 })];
        case "mp": return [num(v, "value1", { scale: 100, min: -100, max: 100, float: true }), " % + ", num(v, "value2", { min: -9999, max: 9999 })];
        case "tp": return [num(v, "value1", { min: 0, max: 100 })];
        case "rate": return [num(v, "value1", { scale: 100, min: 0, max: 1000, float: true }), " %"];
        case "turns": return [num(v, "value1", { min: 1, max: 1000 }), " " + t("turns", "Dialog_Effects")];
        case "grow": return ["+ ", num(v, "value1", { min: 1, max: 1000 })];
        default: return [];
    }
}

export function effectText(db, e) {
    const def = EFFECT_DEF.get(e.code);
    if (!def) { return [t("Code %1", "MZEditor", e.code), `${e.dataId} / ${e.value1} / ${e.value2}`]; }
    const [, , list, kind, label] = def;
    let data = "";
    if (list === "params") { data = PARAMS[e.dataId] || ""; }
    else if (list === "states" || list === "statesAtk") { data = e.dataId === 0 && list === "statesAtk" ? t("Normal Attack", "Group_Effects") : nameOf(db.States, e.dataId); }
    else if (list === "skills") { data = nameOf(db.Skills, e.dataId); }
    else if (list === "commons") { data = nameOf(db.CommonEvents, e.dataId); }
    else if (list === "escape") { data = t("Escape", "Constants"); }
    switch (kind) {
        case "hp": case "mp": {
            const parts = [];
            if (e.value1) { parts.push(pct(e.value1) + "%"); }
            if (e.value2 || !e.value1) { parts.push(String(e.value2)); }
            data = parts.join(" + ");
            break;
        }
        case "tp": data = String(e.value1); break;
        case "rate": data += ` ${pct(e.value1)}%`; break;
        case "turns": data += ` ${e.value1} ${t("turns", "Group_Effects")}`; break;
        case "grow": data += ` + ${e.value1}`; break;
    }
    return [label, data.trim()];
}

export function editEffect(db, eff) {
    const opts = optionLists(db);
    const defaults = { hp: [0, 0], mp: [0, 0], tp: [0, 0], rate: [1, 0], turns: [5, 0], grow: [1, 0] };
    return codeDialog({
        title: t("Effects", "Dialog_Effects"), tabDefs: EFFECT_TABS, item: eff, opts,
        makeVals: (r, cur) => {
            if (cur) { return { dataId: cur.dataId, value1: cur.value1, value2: cur.value2 }; }
            const d = defaults[r[3]] || [0, 0];
            const first = r[2] ? (opts[r[2]]()[0] || [0])[0] : 0;
            return { dataId: r[2] === "statesAtk" ? 1 : first, value1: d[0], value2: d[1] };
        },
        controls: (v, r) => effectControls(v, r[3])
    }).then(r => r && ({ code: r.code, dataId: r.dataId, value1: r.value1, value2: r.value2 }));
}

export function effectsList(db, owner, o = {}) {
    return tableList({
        columns: [{ title: t("Type", "Constants"), width: "42%" }, { title: t("Content", "Group_Effects"), width: "1fr" }],
        items: owner.effects,
        cells: e => effectText(db, e),
        create: () => editEffect(db, null),
        edit: e => editEffect(db, e),
        clipKey: "effect",
        height: o.height
    });
}
