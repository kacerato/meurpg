// Abas Enemies, Troops e States.
import { el, num, text, area, sel, chk, fld, grp, grid, btn, tableList, modal, changed, pad, alertBox } from "./ui.js";
import { PARAMS, RESTRICTIONS, SV_MOTIONS, SV_OVERLAYS, AUTO_REMOVAL, idOptions, nameOf, switchOptions, blankTroopPage, FILES } from "./common.js";
import { traitsList } from "./traits.js";
import { pickImage, imageThumb, imageUrl, loadImage, pickIcon } from "./pickers.js";
import { cols, noteGroup, imageBox } from "./tabs_actors.js";
import { iconField } from "./tabs_items.js";
import { commandList } from "./eventlist.js";

// ------------------------------------------------------------------ Enemies

const COND_TYPES = ["Always", "Turn", "HP", "MP", "State", "Party Level", "Switch"];

function conditionText(db, a) {
    const p1 = a.conditionParam1, p2 = a.conditionParam2;
    switch (a.conditionType) {
        case 1: return `Turn ${p1}+${p2}*X`;
        case 2: return `HP ${Math.round(p1 * 100)}% ~ ${Math.round(p2 * 100)}%`;
        case 3: return `MP ${Math.round(p1 * 100)}% ~ ${Math.round(p2 * 100)}%`;
        case 4: return `State ${nameOf(db.States, p1)}`;
        case 5: return `Party Level ≥ ${p1}`;
        case 6: return `Switch ${pad(p1)}`;
        default: return "Always";
    }
}

async function editAction(db, a) {
    const o = a ? { ...a } : { conditionParam1: 0, conditionParam2: 0, conditionType: 0, rating: 5, skillId: 1 };
    const v = [];
    for (let t = 0; t <= 6; t++) {
        const same = o.conditionType === t;
        const d = [[0, 0], [0, 1], [0, 1], [0, 1], [1, 0], [1, 0], [1, 0]][t];
        v[t] = { p1: same ? o.conditionParam1 : d[0], p2: same ? o.conditionParam2 : d[1] };
    }
    const name = "c" + Math.random().toString(36).slice(2);
    const ok = await modal({
        title: "Action Pattern", width: "600px",
        build: b => {
            b.appendChild(fld("Skill:", sel(o, "skillId", idOptions(db.Skills), { number: true })));
            const controls = [
                [],
                [num(v[1], "p1", { min: 0, max: 9999 }), " + ", num(v[1], "p2", { min: 0, max: 9999 }), " * X"],
                [num(v[2], "p1", { scale: 100, min: 0, max: 100 }), "% ~ ", num(v[2], "p2", { scale: 100, min: 0, max: 100 }), "%"],
                [num(v[3], "p1", { scale: 100, min: 0, max: 100 }), "% ~ ", num(v[3], "p2", { scale: 100, min: 0, max: 100 }), "%"],
                [sel(v[4], "p1", idOptions(db.States), { number: true })],
                ["≥ ", num(v[5], "p1", { min: 1, max: 99 })],
                [sel(v[6], "p1", switchOptions(db.System), { number: true })]
            ];
            const g = el("div", { class: "dbCondGrid" });
            COND_TYPES.forEach((label, t) => {
                const r = el("input", { type: "radio", name, checked: o.conditionType === t });
                r.addEventListener("change", () => { if (r.checked) { o.conditionType = t; } });
                g.append(el("label", { class: "dbChk" }, r, el("span", { text: label })), el("div", { class: "dbInline" }, controls[t]));
            });
            b.appendChild(grp("Condition", g));
            b.appendChild(fld("Rating:", num(o, "rating", { min: 1, max: 9 })));
        }
    });
    if (!ok) { return null; }
    o.conditionParam1 = v[o.conditionType].p1;
    o.conditionParam2 = v[o.conditionType].p2;
    return o;
}

function dropText(db, d) {
    if (!d.kind) { return ["None", ""]; }
    const arr = [null, db.Items, db.Weapons, db.Armors][d.kind];
    return [nameOf(arr, d.dataId), "1/" + d.denominator];
}

async function editDrop(db, d) {
    const o = { ...d };
    const ids = [0, d.kind === 1 ? d.dataId : 1, d.kind === 2 ? d.dataId : 1, d.kind === 3 ? d.dataId : 1];
    const idObj = { 1: ids[1], 2: ids[2], 3: ids[3] };
    const name = "d" + Math.random().toString(36).slice(2);
    const ok = await modal({
        title: "Drop Item", width: "520px",
        build: b => {
            const g = el("div", { class: "dbCondGrid" });
            [["None", null], ["Item", db.Items], ["Weapon", db.Weapons], ["Armor", db.Armors]].forEach(([label, arr], k) => {
                const r = el("input", { type: "radio", name, checked: o.kind === k });
                r.addEventListener("change", () => { if (r.checked) { o.kind = k; } });
                g.append(el("label", { class: "dbChk" }, r, el("span", { text: label })),
                    el("div", null, arr ? sel(idObj, k, idOptions(arr), { number: true }) : ""));
            });
            b.appendChild(g);
            b.appendChild(fld("Probability:", ["1 / ", num(o, "denominator", { min: 1, max: 1000 })]));
        }
    });
    if (!ok) { return null; }
    o.dataId = o.kind ? idObj[o.kind] : d.dataId;
    return o;
}

export const enemiesTab = {
    id: "enemies", label: "Enemies", file: "Enemies", max: 2000,
    form(ctx, e, host) {
        const db = ctx.db;
        const [left, right] = cols(host);
        const folder = () => db.System.optSideView ? "sv_enemies" : "enemies";
        left.appendChild(grp("General Settings",
            fld("Name:", text(e, "name", { onInput: () => ctx.refreshRow() })),
            imageBox("Image:", () => imageThumb(folder(), e.battlerName, 220, 150, e.battlerHue), async () => {
                const r = await pickImage({ folder: folder(), current: e.battlerName, hue: e.battlerHue });
                if (r) { e.battlerName = r.name; e.battlerHue = r.hue; return true; }
            }),
            grid(4, ...PARAMS.map((p, i) => fld(p + ":", num(e.params, i, { min: i === 0 ? 1 : 0, max: i === 0 ? 999999 : i === 1 ? 9999 : 999 }))))));
        left.appendChild(grp("Rewards", grid(2,
            fld("EXP:", num(e, "exp", { min: 0, max: 9999999 })),
            fld("Gold:", num(e, "gold", { min: 0, max: 9999999 })))));
        while (e.dropItems.length < 3) { e.dropItems.push({ dataId: 1, denominator: 1, kind: 0 }); }
        left.appendChild(grp("Drop Items", tableList({
            fixed: true,
            columns: [{ title: "Item", width: "1fr" }, { title: "Probability", width: "110px" }],
            items: e.dropItems,
            cells: d => dropText(db, d),
            edit: d => editDrop(db, d)
        })));
        right.appendChild(grp("Action Patterns", tableList({
            columns: [{ title: "Skill", width: "1fr" }, { title: "Condition", width: "1fr" }, { title: "R", width: "40px" }],
            items: e.actions,
            cells: a => [nameOf(db.Skills, a.skillId), conditionText(db, a), String(a.rating)],
            create: () => editAction(db, null),
            edit: a => editAction(db, a),
            clipKey: "action"
        })));
        right.appendChild(grp("Traits", traitsList(db, e)));
        right.appendChild(noteGroup(e, 4));
    }
};

// ------------------------------------------------------------------ Troops

const SCREEN_W = 816, SCREEN_H = 624;
let pageClip = null;

function autoName(db, t) {
    const counts = new Map();
    for (const m of t.members) {
        const n = nameOf(db.Enemies, m.enemyId, "");
        counts.set(n, (counts.get(n) || 0) + 1);
    }
    return [...counts].map(([n, c]) => c > 1 ? `${n}*${c}` : n).join(", ");
}

function conditionSummary(db, troop, c) {
    const out = [];
    if (c.turnEnding) { out.push("Turn End"); }
    if (c.turnValid) { out.push(`Turn ${c.turnA}+${c.turnB}*X`); }
    if (c.enemyValid) { out.push(`Enemy HP #${c.enemyIndex + 1} ≤ ${c.enemyHp}%`); }
    if (c.actorValid) { out.push(`Actor HP ${nameOf(db.Actors, c.actorId)} ≤ ${c.actorHp}%`); }
    if (c.switchValid) { out.push(`Switch ${pad(c.switchId)}`); }
    return out.length ? out.join(", ") : "Don't Run";
}

async function editConditions(db, troop, page) {
    const c = structuredClone(page.conditions);
    const enemyOpts = [];
    for (let i = 0; i < 8; i++) {
        const m = troop.members[i];
        enemyOpts.push([i, `#${i + 1} ${m ? nameOf(db.Enemies, m.enemyId, "") : ""}`]);
    }
    const ok = await modal({
        title: "Conditions", width: "640px",
        build: b => {
            const g = el("div", { class: "dbCondGrid" });
            g.append(chk(c, "turnEnding", "Turn End"), el("div"));
            g.append(chk(c, "turnValid", "Turn"), el("div", { class: "dbInline" }, num(c, "turnA", { min: 0, max: 9999 }), " + ", num(c, "turnB", { min: 0, max: 9999 }), " * X"));
            g.append(chk(c, "enemyValid", "Enemy HP"), el("div", { class: "dbInline" }, sel(c, "enemyIndex", enemyOpts, { number: true }), " ≤ ", num(c, "enemyHp", { min: 0, max: 100 }), "%"));
            g.append(chk(c, "actorValid", "Actor HP"), el("div", { class: "dbInline" }, sel(c, "actorId", idOptions(db.Actors), { number: true }), " ≤ ", num(c, "actorHp", { min: 0, max: 100 }), "%"));
            g.append(chk(c, "switchValid", "Switch"), el("div", { class: "dbInline" }, sel(c, "switchId", switchOptions(db.System), { number: true })));
            b.appendChild(g);
        }
    });
    if (ok) { page.conditions = c; changed(); }
    return ok;
}

function placementView(ctx, t) {
    const db = ctx.db, sys = db.System;
    const view = el("div", { class: "dbTroopView" });
    const stage = el("div", { class: "dbTroopStage" });
    view.appendChild(stage);
    let selected = -1;
    let scale = 1;
    const folder = () => sys.optSideView ? "sv_enemies" : "enemies";
    const layout = () => {
        scale = Math.min(view.clientWidth / SCREEN_W, view.clientHeight / SCREEN_H) || 0.5;
        stage.style.transform = `scale(${scale})`;
    };
    const render = () => {
        stage.innerHTML = "";
        for (const [i, name] of [[1, sys.battleback1Name], [2, sys.battleback2Name]]) {
            if (name) {
                const img = el("img", { class: "dbBattleback", src: imageUrl("battlebacks" + i, name), draggable: false });
                stage.appendChild(img);
            }
        }
        t.members.forEach((m, i) => {
            const e = db.Enemies[m.enemyId];
            if (!e || !e.battlerName) { return; }
            const img = el("img", { class: "dbTroopEnemy" + (i === selected ? " sel" : "") + (m.hidden ? " hidden" : ""), draggable: false });
            img.src = imageUrl(folder(), e.battlerName);
            if (e.battlerHue) { img.style.filter = `hue-rotate(${e.battlerHue}deg)`; }
            img.onload = () => { img.style.left = (m.x - img.naturalWidth / 2) + "px"; img.style.top = (m.y - img.naturalHeight) + "px"; };
            img.addEventListener("pointerdown", ev => {
                ev.preventDefault();
                selected = i;
                stage.querySelectorAll(".dbTroopEnemy").forEach(x => x.classList.remove("sel"));
                img.classList.add("sel");
                img.setPointerCapture(ev.pointerId);
                const sx = ev.clientX, sy = ev.clientY, ox = m.x, oy = m.y;
                const move = e2 => {
                    m.x = Math.round(Math.max(0, Math.min(SCREEN_W, ox + (e2.clientX - sx) / scale)));
                    m.y = Math.round(Math.max(0, Math.min(SCREEN_H, oy + (e2.clientY - sy) / scale)));
                    img.style.left = (m.x - img.naturalWidth / 2) + "px";
                    img.style.top = (m.y - img.naturalHeight) + "px";
                };
                const up = () => {
                    img.removeEventListener("pointermove", move);
                    img.removeEventListener("pointerup", up);
                    if (m.x !== ox || m.y !== oy) { changed(); }
                    view.onSelect && view.onSelect(selected);
                };
                img.addEventListener("pointermove", move);
                img.addEventListener("pointerup", up);
            });
            stage.appendChild(img);
        });
        view.onSelect && view.onSelect(selected);
    };
    const ro = new ResizeObserver(layout);
    ro.observe(view);
    view.render = render;
    view.selected = () => selected;
    view.select = i => { selected = i; render(); };
    render();
    requestAnimationFrame(layout);
    return view;
}

async function alignMembers(db, t) {
    const folder = db.System.optSideView ? "sv_enemies" : "enemies";
    const widths = await Promise.all(t.members.map(async m => {
        const e = db.Enemies[m.enemyId];
        const img = e && e.battlerName ? await loadImage(folder, e.battlerName) : null;
        return img ? img.width : 96;
    }));
    const total = widths.reduce((a, b) => a + b, 0);
    let x = Math.round(SCREEN_W / 2 - total / 2);
    t.members.forEach((m, i) => { m.x = x + Math.round(widths[i] / 2); m.y = 436; x += widths[i]; });
}

async function changeBattleback(db) {
    const sys = db.System;
    const r1 = await pickImage({ folder: "battlebacks1", current: sys.battleback1Name, title: "Battle Background (1/2)" });
    if (!r1) { return false; }
    const r2 = await pickImage({ folder: "battlebacks2", current: sys.battleback2Name, title: "Battle Background (2/2)" });
    if (!r2) { return false; }
    sys.battleback1Name = r1.name;
    sys.battleback2Name = r2.name;
    return true;
}

async function battleTest(ctx, troopId) {
    const db = ctx.db, sys = db.System;
    const tb = structuredClone(sys.testBattlers);
    while (tb.length < 4) { tb.push({ actorId: 0, level: 1, equips: [0, 0, 0, 0, 0] }); }
    const ok = await modal({
        title: "Battle Test", width: "640px",
        build: b => {
            const page = el("div");
            const bar = el("div", { class: "dbTabs small" });
            const show = k => {
                [...bar.children].forEach((x, j) => x.classList.toggle("on", j === k));
                page.innerHTML = "";
                const m = tb[k];
                const slots = el("div");
                const renderSlots = () => {
                    slots.innerHTML = "";
                    while (m.equips.length < sys.equipTypes.length - 1) { m.equips.push(0); }
                    for (let i = 0; i < sys.equipTypes.length - 1; i++) {
                        const arr = i === 0 ? db.Weapons : db.Armors;
                        const opts = idOptions(arr, "None").filter(([id]) => !id || i === 0 || id === m.equips[i] || (arr[id] && arr[id].etypeId === i + 1));
                        slots.appendChild(fld(sys.equipTypes[i + 1] + ":", sel(m.equips, i, opts, { number: true })));
                    }
                };
                renderSlots();
                page.append(grid(2,
                    fld("Actor:", sel(m, "actorId", idOptions(db.Actors, "None"), { number: true, onChange: id => {
                        const a = db.Actors[id];
                        if (a) { m.equips = a.equips.slice(); m.level = a.initialLevel; renderSlots(); }
                    } })),
                    fld("Level:", num(m, "level", { min: 1, max: 99 }))), grp("Equipment", slots));
            };
            [1, 2, 3, 4].forEach((n, k) => bar.appendChild(btn(String(n), () => show(k))));
            b.append(bar, page);
            show(0);
        }
    });
    if (!ok) { return; }
    sys.testBattlers = tb.filter(x => x.actorId > 0);
    sys.testTroopId = troopId;
    changed();
    const api = ctx.api;
    api.status("Preparando teste de batalha…");
    try {
        for (const f of FILES) {
            await api.project.writeJson(`data/Test_${f}.json`, f === "System" ? sys : db[f]);
        }
        const infos = await api.project.readJson("data/MapInfos.json");
        await api.project.writeJson("data/Test_MapInfos.json", infos);
    } catch (e) {
        alertBox("Falha ao gravar os arquivos de teste: " + e.message);
        return;
    }
    api.status("");
    const overlay = document.getElementById("playOverlay");
    const frame = document.getElementById("playFrame");
    if (overlay && frame) {
        frame.src = "/project/index.html?btest";
        overlay.hidden = false;
        frame.focus();
    } else {
        window.open("/project/index.html?btest", "_blank");
    }
}

export const troopsTab = {
    id: "troops", label: "Troops", file: "Troops", max: 2000,
    form(ctx, t, host, id) {
        const db = ctx.db;
        const name = text(t, "name", { onInput: () => ctx.refreshRow() });
        const view = placementView(ctx, t);
        const enemySel = { id: 1 };
        const halfway = chk({ get v() { const m = t.members[view.selected()]; return m ? m.hidden : false; },
            set v(x) { const m = t.members[view.selected()]; if (m) { m.hidden = x; view.render(); } } }, "v", "Appear Halfway");
        view.onSelect = i => {
            halfway.input.disabled = i < 0 || !t.members[i];
            halfway.input.checked = !!(t.members[i] && t.members[i].hidden);
        };
        view.onSelect(-1);
        const top = el("div", { class: "dbTroopTop" },
            fld("Name:", [name, btn("Auto-name", () => { t.name = autoName(db, t); name.refresh(); changed(); ctx.refreshRow(); })]),
            btn("Change BG...", async () => { if (await changeBattleback(db)) { ctx.touch("System"); view.render(); } }),
            btn("Battle Test...", () => battleTest(ctx, id)));
        const side = el("div", { class: "dbTroopSide" },
            el("div", { class: "dbLabel", text: "Enemies:" }),
            sel(enemySel, "id", idOptions(db.Enemies), { number: true }),
            btn("< Add", () => {
                if (t.members.length >= 8) { alertBox("Um grupo pode ter no máximo 8 inimigos."); return; }
                t.members.push({ enemyId: enemySel.id, x: SCREEN_W / 2, y: 436, hidden: false });
                alignMembers(db, t).then(() => { changed(); view.select(t.members.length - 1); });
            }),
            btn("Remove >", () => {
                const i = view.selected();
                if (i >= 0 && t.members[i]) { t.members.splice(i, 1); changed(); view.select(-1); }
            }),
            btn("Clear", () => { t.members.length = 0; changed(); view.select(-1); }),
            btn("Align", () => alignMembers(db, t).then(() => { changed(); view.render(); })),
            halfway);
        host.appendChild(top);
        host.appendChild(el("div", { class: "dbTroopMid" }, view, side));
        host.appendChild(battleEvents(ctx, t, id));
    }
};

function battleEvents(ctx, t, troopId) {
    const db = ctx.db;
    const box = grp("Battle Event");
    let cur = 0;
    const render = () => {
        [...box.children].slice(1).forEach(c => c.remove());
        if (!t.pages.length) { t.pages.push(blankTroopPage()); }
        cur = Math.min(cur, t.pages.length - 1);
        const page = t.pages[cur];
        const bar = el("div", { class: "dbTabs small" });
        t.pages.forEach((_, i) => {
            const b = btn(String(i + 1), () => { cur = i; render(); });
            if (i === cur) { b.classList.add("on"); }
            bar.appendChild(b);
        });
        const tools = el("div", { class: "dbRow" },
            btn("New Event Page", () => { t.pages.splice(cur + 1, 0, blankTroopPage()); cur++; changed(); render(); }, "small"),
            btn("Copy Event Page", () => { pageClip = structuredClone(page); }, "small"),
            btn("Paste Event Page", () => { if (pageClip) { t.pages[cur] = structuredClone(pageClip); changed(); render(); } }, "small"),
            btn("Delete Event Page", () => { if (t.pages.length > 1) { t.pages.splice(cur, 1); changed(); render(); } }, "small"),
            btn("Clear Event Page", () => { t.pages[cur] = blankTroopPage(); changed(); render(); }, "small"));
        const condBtn = btn(conditionSummary(db, t, page.conditions), async () => {
            if (await editConditions(db, t, page)) { condBtn.textContent = conditionSummary(db, t, page.conditions); }
        }, "dbPickBtn");
        box.append(bar, tools,
            el("div", { class: "dbRow" }, fld("Condition:", condBtn), fld("Span:", sel(page, "span", [[0, "Battle"], [1, "Turn"], [2, "Moment"]], { number: true }))),
            fld("Contents:", commandList(page, "list", { context: "troop", troopId, title: "Battle Event" })));
    };
    render();
    return box;
}

// ------------------------------------------------------------------ States

export const statesTab = {
    id: "states", label: "States", file: "States", max: 1000,
    form(ctx, s, host) {
        const db = ctx.db;
        const [left, right] = cols(host);
        left.appendChild(grp("General Settings", grid(2,
            fld("Name:", text(s, "name", { onInput: () => ctx.refreshRow() })),
            fld("Icon:", iconField(s)),
            fld("Restriction:", sel(s, "restriction", RESTRICTIONS, { number: true })),
            fld("Priority:", num(s, "priority", { min: 0, max: 100 })),
            fld("[SV] Motion:", sel(s, "motion", SV_MOTIONS, { number: true })),
            fld("[SV] Overlay:", sel(s, "overlay", SV_OVERLAYS, { number: true })))));
        left.appendChild(grp("Removal Conditions",
            el("div", { class: "dbRow" }, chk(s, "removeAtBattleEnd", "Remove at Battle End"), chk(s, "removeByRestriction", "Remove by Restriction")),
            grid(2,
                fld("Auto-removal Timing:", sel(s, "autoRemovalTiming", AUTO_REMOVAL, { number: true })),
                fld("Duration in Turns:", [num(s, "minTurns", { min: 0, max: 9999 }), " ~ ", num(s, "maxTurns", { min: 0, max: 9999 })])),
            el("div", { class: "dbRow" }, chk(s, "removeByDamage", "Remove by Damage"), num(s, "chanceByDamage", { min: 0, max: 100 }), "%"),
            el("div", { class: "dbRow" }, chk(s, "removeByWalking", "Remove by Walking"), num(s, "stepsToRemove", { min: 0, max: 9999 }), "steps")));
        left.appendChild(grp("Messages",
            fld("If an actor is inflicted with the state:", [el("span", { class: "dbHint", text: "(Target Name)" }), text(s, "message1")]),
            fld("If an enemy is inflicted with the state:", [el("span", { class: "dbHint", text: "(Target Name)" }), text(s, "message2")]),
            fld("If the state persists:", [el("span", { class: "dbHint", text: "(Target Name)" }), text(s, "message3")]),
            fld("If the state is removed:", [el("span", { class: "dbHint", text: "(Target Name)" }), text(s, "message4")])));
        right.appendChild(grp("Traits", traitsList(db, s)));
        right.appendChild(noteGroup(s));
    }
};
