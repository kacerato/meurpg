// Abas Skills, Items, Weapons, Armors.
import { el, num, text, area, sel, fld, grp, grid, btn, changed, modal, radios } from "./ui.js";
import { PARAMS, OCCASIONS, HIT_TYPES, DAMAGE_TYPES, ITEM_TYPES, idOptions, typeOptions, decodeScope, encodeScope } from "./common.js";
import { traitsList, effectsList } from "./traits.js";
import { pickIcon, iconCanvas } from "./pickers.js";
import { cols, noteGroup } from "./tabs_actors.js";
import { t } from "../i18n.js";

export function iconField(obj) {
    const b = el("button", { class: "dbBtn dbIconBtn", type: "button" });
    const paint = () => { b.innerHTML = ""; b.append(iconCanvas(obj.iconIndex, 32), el("span", { text: String(obj.iconIndex) })); };
    paint();
    b.addEventListener("click", async () => {
        const r = await pickIcon(obj.iconIndex);
        if (r !== null) { obj.iconIndex = r; changed(); paint(); }
    });
    return b;
}

// Escopo no formato do MZ: Faction / Number / Status (Status só para aliados).
export function scopeField(obj) {
    const d = decodeScope(obj.scope);
    const wrap = el("div", { class: "dbScope" });
    const render = () => {
        wrap.innerHTML = "";
        const apply = () => { obj.scope = encodeScope(d); changed(); render(); };
        const faction = sel(d, "faction", [[0, t("None", "Dialog_ItemScope")], [1, t("Enemy", "Dialog_ItemScope")], [2, t("Ally", "Dialog_ItemScope")], [3, t("Enemy & Ally", "Dialog_ItemScope")], [4, t("User", "Dialog_ItemScope")]], { number: true, onChange: apply });
        wrap.appendChild(fld(t("Side", "Dialog_ItemScope") + ":", faction));
        const numOpts = d.faction === 1 ? [[0, t("One", "Dialog_ItemScope")], [1, t("All", "Dialog_ItemScope")], [2, t("Random", "Dialog_ItemScope")]] : [[0, t("One", "Dialog_ItemScope")], [1, t("All", "Dialog_ItemScope")]];
        if (d.faction === 3) { d.number = 1; }
        if (d.faction === 4) { d.number = 0; }
        const number = sel(d, "number", numOpts, { number: true, onChange: apply, disabled: d.faction === 0 || d.faction >= 3 });
        const parts = [number];
        if (d.faction === 1 && d.number === 2) {
            parts.push(num(d, "random", { min: 1, max: 4, onChange: apply }));
        }
        wrap.appendChild(fld(t("Number", "Dialog_ItemScope") + ":", parts));
        wrap.appendChild(fld(t("Status", "Dialog_ItemScope") + ":", sel(d, "status", [[0, t("Alive", "Dialog_ItemScope")], [1, t("Dead", "Dialog_ItemScope")], [2, t("Unconditional", "Dialog_ItemScope")]],
            { number: true, onChange: apply, disabled: d.faction !== 2 })));
    };
    render();
    return wrap;
}

function animationOptions(db, withNormal) {
    return [...(withNormal ? [[-1, t("Normal Attack", "Group_Invocation")]] : []), ...idOptions(db.Animations, t("None", "Constants"))];
}

function invocationGroup(db, o, isSkill) {
    return grp(t("Invocation", "Group_Invocation"), grid(3,
        fld(t("Speed", "Group_Invocation") + ":", num(o, "speed", { min: -2000, max: 2000 })),
        fld(t("Success", "Group_Invocation") + ":", [num(o, "successRate", { min: 0, max: 100 }), "%"]),
        fld(t("Repeat", "Group_Invocation") + ":", num(o, "repeats", { min: 1, max: 9 })),
        fld(t("TP Gain", "Group_Invocation") + ":", num(o, "tpGain", { min: 0, max: 100 })),
        fld(t("Hit Type", "Group_Invocation") + ":", sel(o, "hitType", HIT_TYPES, { number: true })),
        fld(t("Animation", "Constants") + ":", sel(o, "animationId", animationOptions(db, true), { number: true }))));
}

// Fórmula: o runtime faz eval(formula) com item, a, b, v e sign no escopo (Game_Action.evalDamageFormula).
// Aqui só se confere a sintaxe; erros de execução (a.xyz) aparecem no jogo, como no MZ.
export function formulaError(f) {
    try { new Function("item", "a", "b", "v", "sign", "return (" + String(f || "0") + "\n);"); return ""; }
    catch (e) { return e.message; }
}
const FORMULA_REFS = () => [["atk", PARAMS[2]], ["def", PARAMS[3]], ["mat", PARAMS[4]], ["mdf", PARAMS[5]], ["agi", PARAMS[6]],
    ["luk", PARAMS[7]], ["mhp", PARAMS[0]], ["mmp", PARAMS[1]], ["hp", t("HP", "Constants")], ["mp", t("MP", "Constants")],
    ["tp", t("TP", "Constants")], ["level", t("Level", "Constants")]];

function formulaField(d) {
    const formula = text(d, "formula", { onInput: () => check() });
    formula.classList.add("mono");
    formula.title = t("Formula for calculating basic damage. The attacker is expressed with [a], the target with [b]. Both are followed by a dot[.] to enable referancing of the statuses shown below. For example, [a.atk] is referancing the [Attack Power] parameter of the user.", "Group_Damage");
    const warn = el("div", { class: "dbFormulaErr" });
    const check = () => {
        const err = formulaError(d.formula);
        warn.textContent = err ? t("Syntax error: %1", "MZEditor", err) : "";
        formula.classList.toggle("bad", !!err);
    };
    const insert = s => {
        const a = formula.selectionStart ?? formula.value.length, b = formula.selectionEnd ?? a;
        formula.value = formula.value.slice(0, a) + s + formula.value.slice(b);
        formula.focus();
        formula.setSelectionRange(a + s.length, a + s.length);
        formula.dispatchEvent(new Event("input"));
    };
    const help = btn("?", async () => {
        const who = { v: "a" };
        await modal({
            title: t("Formula", "Group_Damage"), width: "620px", cancelLabel: null,
            build: b => {
                b.appendChild(el("div", { class: "dbMsg", text: formula.title }));
                b.appendChild(radios(who, "v", [["a", "a"], ["b", "b"]]));
                const g = el("div", { class: "dbFormulaRefs" });
                for (const [k, label] of FORMULA_REFS()) {
                    g.appendChild(btn(`x.${k}  ${label}`, () => insert(`${who.v}.${k}`), "small"));
                }
                g.appendChild(btn(`v[n]  ${t("Variable", "Constants")}`, () => insert("v[1]"), "small"));
                b.appendChild(g);
            }
        });
    }, "small");
    check();
    const wrap = el("div", { class: "dbFormula" }, el("div", { class: "dbInline" }, formula, help), warn);
    wrap.controls = [formula, help];
    return wrap;
}

function damageGroup(db, o) {
    const d = o.damage;
    const formulaBox = formulaField(d);
    const formula = formulaBox.controls[0];
    const elements = [[-1, t("Normal Attack", "Group_Damage")], ...typeOptions(db.System.elements, t("None", "Constants"))];
    const off = () => d.type === 0;
    const controls = [];
    const g = grp(t("Damage", "Group_Damage"), grid(2,
        fld(t("Type", "Constants") + ":", sel(d, "type", DAMAGE_TYPES, { number: true, onChange: () => controls.forEach(c => { c.disabled = off(); }) })),
        fld(t("Element", "Group_Damage") + ":", controls[controls.push(sel(d, "elementId", elements, { number: true })) - 1]),
        fld(t("Formula", "Group_Damage") + ":", (controls.push(formula, formulaBox.controls[1]), formulaBox), { span: 2 }),
        fld(t("Variance", "Group_Damage") + ":", [controls[controls.push(num(d, "variance", { min: 0, max: 100 })) - 1], "%"]),
        fld(t("Critical Hits", "Group_Damage") + ":", controls[controls.push(sel(d, "critical", [[true, t("Yes", "BasicConstants")], [false, t("No", "BasicConstants")]])) - 1])));
    controls.forEach(c => { c.disabled = off(); });
    return g;
}

function paramChanges(o) {
    return grp(t("Parameter Changes", "Group_ParameterChanges"), grid(4, ...PARAMS.map((p, i) =>
        fld(p + ":", num(o.params, i, { min: i < 2 ? -5000 : -500, max: i < 2 ? 5000 : 500 })))));
}

// ------------------------------------------------------------------ Skills

export const skillsTab = {
    id: "skills", label: t("Skills", "DatabaseMain"), desc: t("Data for actions that produce special effects by consuming MP or TP.", "DatabaseMain"), file: "Skills", max: 2000,
    form(ctx, s, host) {
        const db = ctx.db, sys = db.System;
        const [left, right] = cols(host);
        left.appendChild(grp(t("General Settings", "Constants"), grid(2,
            fld(t("Name", "Constants") + ":", text(s, "name", { onInput: () => ctx.refreshRow() })),
            fld(t("Icon", "Constants") + ":", iconField(s)),
            fld(t("Description", "Constants") + ":", area(s, "description", { rows: 2 }), { span: 2 }),
            fld(t("Skill Type", "Edit_Skills") + ":", sel(s, "stypeId", typeOptions(sys.skillTypes, t("None", "Constants")), { number: true })),
            el("div", { class: "dbInline2" },
                fld(t("MP Cost", "Edit_Skills") + ":", num(s, "mpCost", { min: 0, max: 999 })),
                fld(t("TP Cost", "Edit_Skills") + ":", num(s, "tpCost", { min: 0, max: 100 }))),
            fld(t("Scope", "Constants") + ":", scopeField(s), { span: 2 }),
            fld(t("Occasion", "Edit_Skills") + ":", sel(s, "occasion", OCCASIONS, { number: true })))));
        left.appendChild(invocationGroup(db, s, true));
        const m1 = text(s, "message1");
        const tmpl = (label, msg) => btn(label, () => { s.message1 = msg; m1.refresh(); changed(); }, "small");
        left.appendChild(grp(t("Message", "Edit_Skills"),
            el("div", { class: "dbRow" }, el("span", { text: t("(User Name)", "MZEditor") }), m1),
            el("div", { class: "dbRow" }, text(s, "message2")),
            el("div", { class: "dbRow" }, tmpl(t("\"casts *!\"", "Edit_Skills"), t("%1 casts %2!", "Edit_Skills")), tmpl(t("\"does *!\"", "Edit_Skills"), t("%1 does %2!", "Edit_Skills")), tmpl(t("\"uses *!\"", "Edit_Skills"), t("%1 uses %2!", "Edit_Skills")))));
        left.appendChild(grp(t("Required Weapon", "Edit_Skills"), grid(2,
            fld(t("Weapon Type 1", "Edit_Skills") + ":", sel(s, "requiredWtypeId1", typeOptions(sys.weaponTypes, t("None", "Constants")), { number: true })),
            fld(t("Weapon Type 2", "Edit_Skills") + ":", sel(s, "requiredWtypeId2", typeOptions(sys.weaponTypes, t("None", "Constants")), { number: true })))));
        right.appendChild(damageGroup(db, s));
        right.appendChild(grp(t("Effects", "Group_Effects"), effectsList(db, s)));
        right.appendChild(noteGroup(s, 4));
    }
};

// ------------------------------------------------------------------ Items

export const itemsTab = {
    id: "items", label: t("Items", "DatabaseMain"), desc: t("Data for non-equipment items, such as recovery and event items.", "DatabaseMain"), file: "Items", max: 2000,
    form(ctx, it, host) {
        const db = ctx.db;
        const [left, right] = cols(host);
        left.appendChild(grp(t("General Settings", "Constants"), grid(2,
            fld(t("Name", "Constants") + ":", text(it, "name", { onInput: () => ctx.refreshRow() })),
            fld(t("Icon", "Constants") + ":", iconField(it)),
            fld(t("Description", "Constants") + ":", area(it, "description", { rows: 2 }), { span: 2 }),
            fld(t("Item Type", "Edit_Items") + ":", sel(it, "itypeId", ITEM_TYPES, { number: true })),
            el("div", { class: "dbInline2" },
                fld(t("Price", "Edit_Items") + ":", num(it, "price", { min: 0, max: 999999 })),
                fld(t("Consumable", "Edit_Items") + ":", sel(it, "consumable", [[true, t("Yes", "BasicConstants")], [false, t("No", "BasicConstants")]]))),
            fld(t("Scope", "Constants") + ":", scopeField(it), { span: 2 }),
            fld(t("Occasion", "Edit_Items") + ":", sel(it, "occasion", OCCASIONS, { number: true })))));
        left.appendChild(invocationGroup(db, it, false));
        right.appendChild(damageGroup(db, it));
        right.appendChild(grp(t("Effects", "Group_Effects"), effectsList(db, it)));
        right.appendChild(noteGroup(it, 4));
    }
};

// ------------------------------------------------------------------ Weapons / Armors

export const weaponsTab = {
    id: "weapons", label: t("Weapons", "DatabaseMain"), desc: t("Data for weapon items that mainly increase attack power.", "DatabaseMain"), file: "Weapons", max: 2000,
    form(ctx, w, host) {
        const db = ctx.db, sys = db.System;
        const [left, right] = cols(host);
        left.appendChild(grp(t("General Settings", "Constants"), grid(2,
            fld(t("Name", "Constants") + ":", text(w, "name", { onInput: () => ctx.refreshRow() })),
            fld(t("Icon", "Constants") + ":", iconField(w)),
            fld(t("Description", "Constants") + ":", area(w, "description", { rows: 2 }), { span: 2 }),
            fld(t("Weapon Type", "Edit_Weapons") + ":", sel(w, "wtypeId", typeOptions(sys.weaponTypes, t("None", "Constants")), { number: true })),
            fld(t("Price", "Edit_Items") + ":", num(w, "price", { min: 0, max: 999999 })),
            fld(t("Animation", "Constants") + ":", sel(w, "animationId", animationOptions(db, false), { number: true })))));
        left.appendChild(paramChanges(w));
        right.appendChild(grp(t("Traits", "Group_Traits"), traitsList(db, w)));
        right.appendChild(noteGroup(w));
    }
};

export const armorsTab = {
    id: "armors", label: t("Armors", "DatabaseMain"), desc: t("Data for armor items that mainly increase defense power.", "DatabaseMain"), file: "Armors", max: 1000,
    form(ctx, a, host) {
        const db = ctx.db, sys = db.System;
        const [left, right] = cols(host);
        left.appendChild(grp(t("General Settings", "Constants"), grid(2,
            fld(t("Name", "Constants") + ":", text(a, "name", { onInput: () => ctx.refreshRow() })),
            fld(t("Icon", "Constants") + ":", iconField(a)),
            fld(t("Description", "Constants") + ":", area(a, "description", { rows: 2 }), { span: 2 }),
            fld(t("Armor Type", "Edit_Armors") + ":", sel(a, "atypeId", typeOptions(sys.armorTypes, t("None", "Constants")), { number: true })),
            fld(t("Price", "Edit_Items") + ":", num(a, "price", { min: 0, max: 999999 })),
            fld(t("Equipment Type", "Edit_Armors") + ":", sel(a, "etypeId", typeOptions(sys.equipTypes).filter(([id]) => id !== 1), { number: true })))));
        left.appendChild(paramChanges(a));
        right.appendChild(grp(t("Traits", "Group_Traits"), traitsList(db, a)));
        right.appendChild(noteGroup(a));
    }
};
