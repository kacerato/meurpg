// Abas Skills, Items, Weapons, Armors.
import { el, num, text, area, sel, fld, grp, grid, btn, changed } from "./ui.js";
import { PARAMS, OCCASIONS, HIT_TYPES, DAMAGE_TYPES, ITEM_TYPES, idOptions, typeOptions, decodeScope, encodeScope } from "./common.js";
import { traitsList, effectsList } from "./traits.js";
import { pickIcon, iconCanvas } from "./pickers.js";
import { cols, noteGroup } from "./tabs_actors.js";

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
        const faction = sel(d, "faction", [[0, "None"], [1, "Enemy"], [2, "Ally"], [3, "Enemy & Ally"], [4, "User"]], { number: true, onChange: apply });
        wrap.appendChild(fld("Faction:", faction));
        const numOpts = d.faction === 1 ? [[0, "Single"], [1, "All"], [2, "Random"]] : [[0, "Single"], [1, "All"]];
        if (d.faction === 3) { d.number = 1; }
        if (d.faction === 4) { d.number = 0; }
        const number = sel(d, "number", numOpts, { number: true, onChange: apply, disabled: d.faction === 0 || d.faction >= 3 });
        const parts = [number];
        if (d.faction === 1 && d.number === 2) {
            parts.push(num(d, "random", { min: 1, max: 4, onChange: apply }));
        }
        wrap.appendChild(fld("Number:", parts));
        wrap.appendChild(fld("Status:", sel(d, "status", [[0, "Alive"], [1, "Dead"], [2, "Unconditional"]],
            { number: true, onChange: apply, disabled: d.faction !== 2 })));
    };
    render();
    return wrap;
}

function animationOptions(db, withNormal) {
    return [...(withNormal ? [[-1, "Normal Attack"]] : []), ...idOptions(db.Animations, "None")];
}

function invocationGroup(db, o, isSkill) {
    return grp("Invocation", grid(3,
        fld("Speed:", num(o, "speed", { min: -2000, max: 2000 })),
        fld("Success:", [num(o, "successRate", { min: 0, max: 100 }), "%"]),
        fld("Repeat:", num(o, "repeats", { min: 1, max: 9 })),
        fld("TP Gain:", num(o, "tpGain", { min: 0, max: 100 })),
        fld("Hit Type:", sel(o, "hitType", HIT_TYPES, { number: true })),
        fld("Animation:", sel(o, "animationId", animationOptions(db, true), { number: true }))));
}

function damageGroup(db, o) {
    const d = o.damage;
    const formula = text(d, "formula");
    formula.classList.add("mono");
    const elements = [[-1, "Normal Attack"], ...typeOptions(db.System.elements, "None")];
    const off = () => d.type === 0;
    const controls = [];
    const g = grp("Damage", grid(2,
        fld("Type:", sel(d, "type", DAMAGE_TYPES, { number: true, onChange: () => controls.forEach(c => { c.disabled = off(); }) })),
        fld("Element:", controls[controls.push(sel(d, "elementId", elements, { number: true })) - 1]),
        fld("Formula:", controls[controls.push(formula) - 1], { span: 2 }),
        fld("Variance:", [controls[controls.push(num(d, "variance", { min: 0, max: 100 })) - 1], "%"]),
        fld("Critical Hits:", controls[controls.push(sel(d, "critical", [[true, "Yes"], [false, "No"]])) - 1])));
    controls.forEach(c => { c.disabled = off(); });
    return g;
}

function paramChanges(o) {
    return grp("Parameter Changes", grid(4, ...PARAMS.map((p, i) =>
        fld(p + ":", num(o.params, i, { min: i < 2 ? -5000 : -500, max: i < 2 ? 5000 : 500 })))));
}

// ------------------------------------------------------------------ Skills

export const skillsTab = {
    id: "skills", label: "Skills", file: "Skills", max: 2000,
    form(ctx, s, host) {
        const db = ctx.db, sys = db.System;
        const [left, right] = cols(host);
        left.appendChild(grp("General Settings", grid(2,
            fld("Name:", text(s, "name", { onInput: () => ctx.refreshRow() })),
            fld("Icon:", iconField(s)),
            fld("Description:", area(s, "description", { rows: 2 }), { span: 2 }),
            fld("Skill Type:", sel(s, "stypeId", typeOptions(sys.skillTypes, "None"), { number: true })),
            el("div", { class: "dbInline2" },
                fld("MP Cost:", num(s, "mpCost", { min: 0, max: 9999 })),
                fld("TP Cost:", num(s, "tpCost", { min: 0, max: 100 }))),
            fld("Scope:", scopeField(s), { span: 2 }),
            fld("Occasion:", sel(s, "occasion", OCCASIONS, { number: true })))));
        left.appendChild(invocationGroup(db, s, true));
        const m1 = text(s, "message1");
        const tmpl = (label, msg) => btn(label, () => { s.message1 = msg; m1.refresh(); changed(); }, "small");
        left.appendChild(grp("Message",
            el("div", { class: "dbRow" }, el("span", { text: "(User Name)" }), m1),
            el("div", { class: "dbRow" }, text(s, "message2")),
            el("div", { class: "dbRow" }, tmpl("casts *!", "%1 casts %2!"), tmpl("does *!", "%1 does %2!"), tmpl("uses *!", "%1 uses %2!"))));
        left.appendChild(grp("Required Weapon", grid(2,
            fld("Weapon Type 1:", sel(s, "requiredWtypeId1", typeOptions(sys.weaponTypes, "None"), { number: true })),
            fld("Weapon Type 2:", sel(s, "requiredWtypeId2", typeOptions(sys.weaponTypes, "None"), { number: true })))));
        right.appendChild(damageGroup(db, s));
        right.appendChild(grp("Effects", effectsList(db, s)));
        right.appendChild(noteGroup(s, 4));
    }
};

// ------------------------------------------------------------------ Items

export const itemsTab = {
    id: "items", label: "Items", file: "Items", max: 2000,
    form(ctx, it, host) {
        const db = ctx.db;
        const [left, right] = cols(host);
        left.appendChild(grp("General Settings", grid(2,
            fld("Name:", text(it, "name", { onInput: () => ctx.refreshRow() })),
            fld("Icon:", iconField(it)),
            fld("Description:", area(it, "description", { rows: 2 }), { span: 2 }),
            fld("Item Type:", sel(it, "itypeId", ITEM_TYPES, { number: true })),
            el("div", { class: "dbInline2" },
                fld("Price:", num(it, "price", { min: 0, max: 999999 })),
                fld("Consumable:", sel(it, "consumable", [[true, "Yes"], [false, "No"]]))),
            fld("Scope:", scopeField(it), { span: 2 }),
            fld("Occasion:", sel(it, "occasion", OCCASIONS, { number: true })))));
        left.appendChild(invocationGroup(db, it, false));
        right.appendChild(damageGroup(db, it));
        right.appendChild(grp("Effects", effectsList(db, it)));
        right.appendChild(noteGroup(it, 4));
    }
};

// ------------------------------------------------------------------ Weapons / Armors

export const weaponsTab = {
    id: "weapons", label: "Weapons", file: "Weapons", max: 2000,
    form(ctx, w, host) {
        const db = ctx.db, sys = db.System;
        const [left, right] = cols(host);
        left.appendChild(grp("General Settings", grid(2,
            fld("Name:", text(w, "name", { onInput: () => ctx.refreshRow() })),
            fld("Icon:", iconField(w)),
            fld("Description:", area(w, "description", { rows: 2 }), { span: 2 }),
            fld("Weapon Type:", sel(w, "wtypeId", typeOptions(sys.weaponTypes, "None"), { number: true })),
            fld("Price:", num(w, "price", { min: 0, max: 999999 })),
            fld("Attack Animation:", sel(w, "animationId", animationOptions(db, false), { number: true })))));
        left.appendChild(paramChanges(w));
        right.appendChild(grp("Traits", traitsList(db, w)));
        right.appendChild(noteGroup(w));
    }
};

export const armorsTab = {
    id: "armors", label: "Armors", file: "Armors", max: 1000,
    form(ctx, a, host) {
        const db = ctx.db, sys = db.System;
        const [left, right] = cols(host);
        left.appendChild(grp("General Settings", grid(2,
            fld("Name:", text(a, "name", { onInput: () => ctx.refreshRow() })),
            fld("Icon:", iconField(a)),
            fld("Description:", area(a, "description", { rows: 2 }), { span: 2 }),
            fld("Armor Type:", sel(a, "atypeId", typeOptions(sys.armorTypes, "None"), { number: true })),
            fld("Price:", num(a, "price", { min: 0, max: 999999 })),
            fld("Equipment Type:", sel(a, "etypeId", typeOptions(sys.equipTypes).filter(([id]) => id !== 1), { number: true })))));
        left.appendChild(paramChanges(a));
        right.appendChild(grp("Traits", traitsList(db, a)));
        right.appendChild(noteGroup(a));
    }
};
