// Traits (Game_BattlerBase.TRAIT_*) e Effects (Game_Action.EFFECT_*): listas e diálogos.
import { el, num, sel, tabs, tableList, modal } from "./ui.js";
import { PARAMS, XPARAMS, SPARAMS, SPECIAL_FLAGS, COLLAPSE, PARTY_ABILITY, idOptions, typeOptions, nameOf } from "./common.js";

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
        slot: () => [[1, "Dual Wield"]],
        special: () => SPECIAL_FLAGS.map((n, i) => [i, n]),
        collapse: () => COLLAPSE.map((n, i) => [i, n]),
        party: () => PARTY_ABILITY.map((n, i) => [i, n]),
        commons: () => idOptions(db.CommonEvents),
        escape: () => [[0, "Escape"]],
        statesAtk: () => [[0, "Normal Attack"], ...idOptions(db.States)]
    };
}

// value: "rate" (×%, 0..1000), "plus" (+%, -100..100), "plus1000" (+%, 0..1000), "int", "pct100" (%, 0..100)
const TRAIT_TABS = [
    ["Rate", [[11, "Element Rate", "elements", "rate"], [12, "Debuff Rate", "params", "rate"],
        [13, "State Rate", "states", "rate"], [14, "State Resist", "states", null]]],
    ["Param", [[21, "Parameter", "params", "rate"], [22, "Ex-Parameter", "xparams", "plus"], [23, "Sp-Parameter", "sparams", "rate"]]],
    ["Attack", [[31, "Attack Element", "elements", null], [32, "Attack State", "states", "plus1000"],
        [33, "Attack Speed", null, "speed"], [34, "Attack Times +", null, "times"], [35, "Attack Skill", "skills", null]]],
    ["Skill", [[41, "Add Skill Type", "stypes", null], [42, "Seal Skill Type", "stypes", null],
        [43, "Add Skill", "skills", null], [44, "Seal Skill", "skills", null]]],
    ["Equip", [[51, "Equip Weapon", "wtypes", null], [52, "Equip Armor", "atypes", null],
        [53, "Lock Equip", "etypes", null], [54, "Seal Equip", "etypes", null], [55, "Slot Type", "slot", null]]],
    ["Other", [[61, "Action Times +", null, "pct100"], [62, "Special Flag", "special", null],
        [63, "Collapse Effect", "collapse", null], [64, "Party Ability", "party", null]]]
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

export function traitText(db, t) {
    const def = TRAIT_DEF.get(t.code);
    if (!def) { return ["Code " + t.code, `${t.dataId} / ${t.value}`]; }
    const s = db.System;
    const [, label, list, kind] = def;
    let data = "";
    switch (list) {
        case "elements": data = typeName(s.elements, t.dataId); break;
        case "params": data = PARAMS[t.dataId] || ""; break;
        case "xparams": data = XPARAMS[t.dataId] || ""; break;
        case "sparams": data = SPARAMS[t.dataId] || ""; break;
        case "states": data = nameOf(db.States, t.dataId); break;
        case "skills": data = nameOf(db.Skills, t.dataId); break;
        case "stypes": data = typeName(s.skillTypes, t.dataId); break;
        case "wtypes": data = typeName(s.weaponTypes, t.dataId); break;
        case "atypes": data = typeName(s.armorTypes, t.dataId); break;
        case "etypes": data = typeName(s.equipTypes, t.dataId); break;
        case "slot": data = t.dataId === 1 ? "Dual Wield" : "Normal"; break;
        case "special": data = SPECIAL_FLAGS[t.dataId] || ""; break;
        case "collapse": data = COLLAPSE[t.dataId] || ""; break;
        case "party": data = PARTY_ABILITY[t.dataId] || ""; break;
    }
    switch (kind) {
        case "rate": data += ` * ${pct(t.value)}%`; break;
        case "plus": case "plus1000": data += ` + ${pct(t.value)}%`; break;
        case "speed": case "times": data = String(t.value); break;
        case "pct100": data = pct(t.value) + "%"; break;
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
        title: "Traits", tabDefs: TRAIT_TABS, item: trait, opts,
        makeVals: (r, cur) => {
            const first = r[2] ? (opts[r[2]]()[0] || [0])[0] : 0;
            return cur ? { dataId: cur.dataId, value: cur.value } : { dataId: first, value: defaultTraitValue(r[3]) };
        },
        controls: (v, r) => traitValueControl(v, r[3])
    }).then(r => r && ({ code: r.code, dataId: r.dataId, value: r.value }));
}

export function traitsList(db, owner, o = {}) {
    return tableList({
        columns: [{ title: "Type", width: "42%" }, { title: "Content", width: "1fr" }],
        items: owner.traits,
        cells: t => traitText(db, t),
        create: () => editTrait(db, null),
        edit: t => editTrait(db, t),
        clipKey: "trait",
        height: o.height,
        onChange: o.onChange
    });
}

// ------------------------------------------------------------------- Effects

const EFFECT_TABS = [
    ["Recover", [[11, "Recover HP", null, "hp"], [12, "Recover MP", null, "mp"], [13, "Gain TP", null, "tp"]]],
    ["State", [[21, "Add State", "statesAtk", "rate"], [22, "Remove State", "states", "rate"]]],
    ["Param", [[31, "Add Buff", "params", "turns"], [32, "Add Debuff", "params", "turns"],
        [33, "Remove Buff", "params", null], [34, "Remove Debuff", "params", null]]],
    ["Other", [[41, "Special Effect", "escape", null], [42, "Grow", "params", "grow"],
        [43, "Learn Skill", "skills", null], [44, "Common Event", "commons", null]]]
];
const EFFECT_DEF = new Map(EFFECT_TABS.flatMap(([, rows]) => rows.map(r => [r[0], r])));

function effectControls(v, kind) {
    switch (kind) {
        case "hp": return [num(v, "value1", { scale: 100, min: -100, max: 100, float: true }), " % + ", num(v, "value2", { min: -999999, max: 999999 })];
        case "mp": return [num(v, "value1", { scale: 100, min: -100, max: 100, float: true }), " % + ", num(v, "value2", { min: -9999, max: 9999 })];
        case "tp": return [num(v, "value1", { min: 0, max: 100 })];
        case "rate": return [num(v, "value1", { scale: 100, min: 0, max: 1000, float: true }), " %"];
        case "turns": return [num(v, "value1", { min: 1, max: 1000 }), " turns"];
        case "grow": return ["+ ", num(v, "value1", { min: 1, max: 1000 })];
        default: return [];
    }
}

export function effectText(db, e) {
    const def = EFFECT_DEF.get(e.code);
    if (!def) { return ["Code " + e.code, `${e.dataId} / ${e.value1} / ${e.value2}`]; }
    const [, label, list, kind] = def;
    let data = "";
    if (list === "params") { data = PARAMS[e.dataId] || ""; }
    else if (list === "states" || list === "statesAtk") { data = e.dataId === 0 && list === "statesAtk" ? "Normal Attack" : nameOf(db.States, e.dataId); }
    else if (list === "skills") { data = nameOf(db.Skills, e.dataId); }
    else if (list === "commons") { data = nameOf(db.CommonEvents, e.dataId); }
    else if (list === "escape") { data = "Escape"; }
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
        case "turns": data += ` ${e.value1} turns`; break;
        case "grow": data += ` + ${e.value1}`; break;
    }
    return [label, data.trim()];
}

export function editEffect(db, eff) {
    const opts = optionLists(db);
    const defaults = { hp: [0, 0], mp: [0, 0], tp: [0, 0], rate: [1, 0], turns: [5, 0], grow: [1, 0] };
    return codeDialog({
        title: "Effects", tabDefs: EFFECT_TABS, item: eff, opts,
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
        columns: [{ title: "Type", width: "42%" }, { title: "Content", width: "1fr" }],
        items: owner.effects,
        cells: e => effectText(db, e),
        create: () => editEffect(db, null),
        edit: e => editEffect(db, e),
        clipKey: "effect",
        height: o.height
    });
}
