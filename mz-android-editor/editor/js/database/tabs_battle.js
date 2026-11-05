// Abas Enemies, Troops e States.
import { el, num, text, area, sel, chk, fld, grp, grid, btn, tableList, modal, changed, pad, alertBox } from "./ui.js";
import { PARAMS, RESTRICTIONS, SV_MOTIONS, SV_OVERLAYS, AUTO_REMOVAL, idOptions, nameOf, switchOptions, blankTroopPage, FILES } from "./common.js";
import { traitsList } from "./traits.js";
import { pickImage, imageThumb, imageUrl, loadImage, pickIcon } from "./pickers.js";
import { cols, noteGroup, imageBox } from "./tabs_actors.js";
import { iconField } from "./tabs_items.js";
import { commandList } from "./eventlist.js";
import { t } from "../i18n.js";

// ------------------------------------------------------------------ Enemies

const COND_TYPES = [t("Always", "Dialog_Action"), t("Turn", "Dialog_Action"), t("HP", "Constants"), t("MP", "Constants"),
    t("State", "Constants"), t("Party Level", "Dialog_Action"), t("Switch", "Constants")];

function conditionText(db, a) {
    const p1 = a.conditionParam1, p2 = a.conditionParam2;
    switch (a.conditionType) {
        case 1: return `${t("Turn", "Group_ActionPatterns")} ${p1}+${p2}*X`;
        case 2: return `${t("HP", "Constants")} ${Math.round(p1 * 100)}% ~ ${Math.round(p2 * 100)}%`;
        case 3: return `${t("MP", "Constants")} ${Math.round(p1 * 100)}% ~ ${Math.round(p2 * 100)}%`;
        case 4: return `${t("State", "Constants")} ${nameOf(db.States, p1)}`;
        case 5: return `${t("Party Level", "Group_ActionPatterns")} ≥ ${p1}`;
        case 6: return `${t("Switch", "Constants")} ${pad(p1)}`;
        default: return t("Always", "Group_ActionPatterns");
    }
}

async function editAction(db, a) {
    const o = a ? { ...a } : { conditionParam1: 0, conditionParam2: 0, conditionType: 0, rating: 5, skillId: 1 };
    const v = [];
    for (let tq = 0; tq <= 6; tq++) {
        const same = o.conditionType === tq;
        const d = [[0, 0], [0, 1], [0, 1], [0, 1], [1, 0], [1, 0], [1, 0]][tq];
        v[tq] = { p1: same ? o.conditionParam1 : d[0], p2: same ? o.conditionParam2 : d[1] };
    }
    const name = "c" + Math.random().toString(36).slice(2);
    const ok = await modal({
        title: t("Action", "Dialog_Action"), width: "600px",
        build: b => {
            b.appendChild(fld(t("Skill", "Constants") + ":", sel(o, "skillId", idOptions(db.Skills), { number: true })));
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
            COND_TYPES.forEach((label, tq) => {
                const r = el("input", { type: "radio", name, checked: o.conditionType === tq });
                r.addEventListener("change", () => { if (r.checked) { o.conditionType = tq; } });
                g.append(el("label", { class: "dbChk" }, r, el("span", { text: label })), el("div", { class: "dbInline" }, controls[tq]));
            });
            b.appendChild(grp(t("Conditions", "Dialog_Action"), g));
            b.appendChild(fld(t("Rating", "Dialog_Action") + ":", num(o, "rating", { min: 1, max: 9 })));
        }
    });
    if (!ok) { return null; }
    o.conditionParam1 = v[o.conditionType].p1;
    o.conditionParam2 = v[o.conditionType].p2;
    return o;
}

function dropText(db, d) {
    if (!d.kind) { return [t("None", "Constants"), ""]; }
    const arr = [null, db.Items, db.Weapons, db.Armors][d.kind];
    return [nameOf(arr, d.dataId), "1/" + d.denominator];
}

async function editDrop(db, d) {
    const o = { ...d };
    const ids = [0, d.kind === 1 ? d.dataId : 1, d.kind === 2 ? d.dataId : 1, d.kind === 3 ? d.dataId : 1];
    const idObj = { 1: ids[1], 2: ids[2], 3: ids[3] };
    const name = "d" + Math.random().toString(36).slice(2);
    const ok = await modal({
        title: t("Drop Item", "Dialog_DropItem"), width: "520px",
        build: b => {
            const g = el("div", { class: "dbCondGrid" });
            [[t("None", "Constants"), null], [t("Item", "Constants"), db.Items], [t("Weapon", "Constants"), db.Weapons], [t("Armor", "Constants"), db.Armors]].forEach(([label, arr], k) => {
                const r = el("input", { type: "radio", name, checked: o.kind === k });
                r.addEventListener("change", () => { if (r.checked) { o.kind = k; } });
                g.append(el("label", { class: "dbChk" }, r, el("span", { text: label })),
                    el("div", null, arr ? sel(idObj, k, idOptions(arr), { number: true }) : ""));
            });
            b.appendChild(g);
            b.appendChild(fld(t("Probability", "Dialog_DropItem") + ":", ["1 / ", num(o, "denominator", { min: 1, max: 1000 })]));
        }
    });
    if (!ok) { return null; }
    o.dataId = o.kind ? idObj[o.kind] : d.dataId;
    return o;
}

export const enemiesTab = {
    id: "enemies", label: t("Enemies", "DatabaseMain"), desc: t("Data for enemies fought in battles.", "DatabaseMain"), file: "Enemies", max: 2000,
    form(ctx, e, host) {
        const db = ctx.db;
        const [left, right] = cols(host);
        const folder = () => db.System.optSideView ? "sv_enemies" : "enemies";
        left.appendChild(grp(t("General Settings", "Constants"),
            fld(t("Name", "Constants") + ":", text(e, "name", { onInput: () => ctx.refreshRow() })),
            imageBox(t("Image", "Edit_Enemies") + ":", () => imageThumb(folder(), e.battlerName, 220, 150, e.battlerHue), async () => {
                const r = await pickImage({ folder: folder(), current: e.battlerName, hue: e.battlerHue });
                if (r) { e.battlerName = r.name; e.battlerHue = r.hue; return true; }
            }),
            grid(4, ...PARAMS.map((p, i) => fld(p + ":", num(e.params, i, { min: i === 0 ? 1 : 0, max: i === 0 ? 999999 : i === 1 ? 9999 : 999 }))))));
        left.appendChild(grp(t("Rewards", "Edit_Enemies"), grid(2,
            fld(t("EXP", "Constants") + ":", num(e, "exp", { min: 0, max: 9999999 })),
            fld(t("Gold", "Edit_Enemies") + ":", num(e, "gold", { min: 0, max: 9999999 })))));
        while (e.dropItems.length < 3) { e.dropItems.push({ dataId: 1, denominator: 1, kind: 0 }); }
        left.appendChild(grp(t("Drop Items", "Edit_Enemies"), tableList({
            fixed: true,
            columns: [{ title: t("Item", "Constants"), width: "1fr" }, { title: t("Probability", "Dialog_DropItem"), width: "110px" }],
            items: e.dropItems,
            cells: d => dropText(db, d),
            edit: d => editDrop(db, d)
        })));
        right.appendChild(grp(t("Action Patterns", "Group_ActionPatterns"), tableList({
            columns: [{ title: t("Skill", "Constants"), width: "1fr" }, { title: t("Condition", "Group_ActionPatterns"), width: "1fr" }, { title: t("R", "Group_ActionPatterns"), width: "80px" }],
            items: e.actions,
            cells: a => [nameOf(db.Skills, a.skillId), conditionText(db, a), String(a.rating)],
            create: () => editAction(db, null),
            edit: a => editAction(db, a),
            clipKey: "action"
        })));
        right.appendChild(grp(t("Traits", "Group_Traits"), traitsList(db, e)));
        right.appendChild(noteGroup(e, 4));
    }
};

// ------------------------------------------------------------------ Troops

const SCREEN_W = 816, SCREEN_H = 624;
let pageClip = null;

function autoName(db, tq) {
    const counts = new Map();
    for (const m of tq.members) {
        const n = nameOf(db.Enemies, m.enemyId, "");
        counts.set(n, (counts.get(n) || 0) + 1);
    }
    return [...counts].map(([n, c]) => c > 1 ? `${n}*${c}` : n).join(", ");
}

function conditionSummary(db, troop, c) {
    const out = [];
    if (c.turnEnding) { out.push(t("Turn End", "Group_BattleEvent")); }
    if (c.turnValid) { out.push(`${t("Turn", "Group_BattleEvent")} ${c.turnA}+${c.turnB}*X`); }
    if (c.enemyValid) { out.push(`${t("Enemy HP", "Group_BattleEvent")} #${c.enemyIndex + 1} ≤ ${c.enemyHp}%`); }
    if (c.actorValid) { out.push(`${t("Actor HP", "Group_BattleEvent")} ${nameOf(db.Actors, c.actorId)} ≤ ${c.actorHp}%`); }
    if (c.switchValid) { out.push(`${t("Switch", "Constants")} ${pad(c.switchId)}`); }
    return out.length ? out.join(", ") : t("Don’t Run", "Group_BattleEvent");
}

async function editConditions(db, troop, page) {
    const c = structuredClone(page.conditions);
    const enemyOpts = [];
    for (let i = 0; i < 8; i++) {
        const m = troop.members[i];
        enemyOpts.push([i, `#${i + 1} ${m ? nameOf(db.Enemies, m.enemyId, "") : ""}`]);
    }
    const ok = await modal({
        title: t("Conditions", "Dialog_BattleConditions"), width: "640px",
        build: b => {
            const g = el("div", { class: "dbCondGrid" });
            g.append(chk(c, "turnEnding", t("Turn End", "Dialog_BattleConditions")), el("div"));
            g.append(chk(c, "turnValid", t("Turn", "Dialog_BattleConditions")), el("div", { class: "dbInline" }, num(c, "turnA", { min: 0, max: 9999 }), " + ", num(c, "turnB", { min: 0, max: 9999 }), " * X"));
            g.append(chk(c, "enemyValid", t("Enemy HP", "Dialog_BattleConditions")), el("div", { class: "dbInline" }, sel(c, "enemyIndex", enemyOpts, { number: true }), " ≤ ", num(c, "enemyHp", { min: 0, max: 100 }), "%"));
            g.append(chk(c, "actorValid", t("Actor HP", "Dialog_BattleConditions")), el("div", { class: "dbInline" }, sel(c, "actorId", idOptions(db.Actors), { number: true }), " ≤ ", num(c, "actorHp", { min: 0, max: 100 }), "%"));
            g.append(chk(c, "switchValid", t("Switch", "Constants")), el("div", { class: "dbInline" }, sel(c, "switchId", switchOptions(db.System), { number: true })));
            b.appendChild(g);
        }
    });
    if (ok) { page.conditions = c; changed(); }
    return ok;
}

function placementView(ctx, tq) {
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
        tq.members.forEach((m, i) => {
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

async function alignMembers(db, tq) {
    const folder = db.System.optSideView ? "sv_enemies" : "enemies";
    const widths = await Promise.all(tq.members.map(async m => {
        const e = db.Enemies[m.enemyId];
        const img = e && e.battlerName ? await loadImage(folder, e.battlerName) : null;
        return img ? img.width : 96;
    }));
    const total = widths.reduce((a, b) => a + b, 0);
    let x = Math.round(SCREEN_W / 2 - total / 2);
    tq.members.forEach((m, i) => { m.x = x + Math.round(widths[i] / 2); m.y = 436; x += widths[i]; });
}

export async function changeBattleback(db) {
    const sys = db.System;
    const r1 = await pickImage({ folder: "battlebacks1", current: sys.battleback1Name, title: t("Battle Background", "EventCommand283") + " (1/2)" });
    if (!r1) { return false; }
    const r2 = await pickImage({ folder: "battlebacks2", current: sys.battleback2Name, title: t("Battle Background", "EventCommand283") + " (2/2)" });
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
        title: t("Battle Test", "Dialog_BattleTest"), width: "640px",
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
                        const opts = idOptions(arr, t("None", "Constants")).filter(([id]) => !id || i === 0 || id === m.equips[i] || (arr[id] && arr[id].etypeId === i + 1));
                        slots.appendChild(fld(sys.equipTypes[i + 1] + ":", sel(m.equips, i, opts, { number: true })));
                    }
                };
                renderSlots();
                page.append(grid(2,
                    fld(t("Actor", "Constants") + ":", sel(m, "actorId", idOptions(db.Actors, t("None", "Constants")), { number: true, onChange: id => {
                        const a = db.Actors[id];
                        if (a) { m.equips = a.equips.slice(); m.level = a.initialLevel; renderSlots(); }
                    } })),
                    fld(t("Level", "Constants") + ":", num(m, "level", { min: 1, max: 99 }))), grp(t("Equipment", "Dialog_BattleTest"), slots));
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
    api.status(t("Preparing the battle test...", "MZEditor"));
    try {
        for (const f of FILES) {
            await api.project.writeJson(`data/Test_${f}.json`, f === "System" ? sys : db[f]);
        }
        const infos = await api.project.readJson("data/MapInfos.json");
        await api.project.writeJson("data/Test_MapInfos.json", infos);
    } catch (e) {
        alertBox(t("Failed to write the test files: %1", "MZEditor", e.message));
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
    id: "troops", label: t("Troops", "DatabaseMain"), desc: t("Data for enemy groups. The unit in which they appear in the game.", "DatabaseMain"), file: "Troops", max: 2000,
    form(ctx, tq, host, id) {
        const db = ctx.db;
        const name = text(tq, "name", { onInput: () => ctx.refreshRow() });
        const view = placementView(ctx, tq);
        const enemySel = { id: 1 };
        const halfway = chk({ get v() { const m = tq.members[view.selected()]; return m ? m.hidden : false; },
            set v(x) { const m = tq.members[view.selected()]; if (m) { m.hidden = x; view.render(); } } }, "v", t("Appear Mid-Battle", "TroopScreen"));
        view.onSelect = i => {
            halfway.input.disabled = i < 0 || !tq.members[i];
            halfway.input.checked = !!(tq.members[i] && tq.members[i].hidden);
        };
        view.onSelect(-1);
        const top = el("div", { class: "dbTroopTop" },
            fld(t("Name", "Constants") + ":", [name, btn(t("Auto-name", "Edit_Troops"), () => { tq.name = autoName(db, tq); name.refresh(); changed(); ctx.refreshRow(); })]),
            btn(t("Change BG", "Edit_Troops") + "...", async () => { if (await changeBattleback(db)) { ctx.touch("System"); view.render(); } }),
            btn(t("Battle Test", "Edit_Troops") + "...", () => battleTest(ctx, id)));
        const side = el("div", { class: "dbTroopSide" },
            el("div", { class: "dbLabel", text: t("Enemy List", "Edit_Troops") + ":" }),
            sel(enemySel, "id", idOptions(db.Enemies), { number: true }),
            btn("< " + t("Add", "Edit_Troops"), () => {
                if (tq.members.length >= 8) { alertBox(t("A troop can have at most 8 enemies.", "MZEditor")); return; }
                tq.members.push({ enemyId: enemySel.id, x: SCREEN_W / 2, y: 436, hidden: false });
                alignMembers(db, tq).then(() => { changed(); view.select(tq.members.length - 1); });
            }),
            btn(t("Remove", "Edit_Troops") + " >", () => {
                const i = view.selected();
                if (i >= 0 && tq.members[i]) { tq.members.splice(i, 1); changed(); view.select(-1); }
            }),
            btn(t("Clear", "Edit_Troops"), () => { tq.members.length = 0; changed(); view.select(-1); }),
            btn(t("Align", "Edit_Troops"), () => alignMembers(db, tq).then(() => { changed(); view.render(); })),
            halfway);
        host.appendChild(top);
        host.appendChild(el("div", { class: "dbTroopMid" }, view, side));
        host.appendChild(battleEvents(ctx, tq, id));
    }
};

function battleEvents(ctx, tq, troopId) {
    const db = ctx.db;
    const box = grp(t("Battle Event", "Group_BattleEvent"));
    let cur = 0;
    const render = () => {
        [...box.children].slice(1).forEach(c => c.remove());
        if (!tq.pages.length) { tq.pages.push(blankTroopPage()); }
        cur = Math.min(cur, tq.pages.length - 1);
        const page = tq.pages[cur];
        const bar = el("div", { class: "dbTabs small" });
        tq.pages.forEach((_, i) => {
            const b = btn(String(i + 1), () => { cur = i; render(); });
            if (i === cur) { b.classList.add("on"); }
            bar.appendChild(b);
        });
        const tools = el("div", { class: "dbRow" },
            btn(t("New<br>Event Page", "Layout_EventPageButtons").replace("<br>", " "), () => { tq.pages.splice(cur + 1, 0, blankTroopPage()); cur++; changed(); render(); }, "small"),
            btn(t("Copy<br>Event Page", "Layout_EventPageButtons").replace("<br>", " "), () => { pageClip = structuredClone(page); }, "small"),
            btn(t("Paste<br>Event Page", "Layout_EventPageButtons").replace("<br>", " "), () => { if (pageClip) { tq.pages[cur] = structuredClone(pageClip); changed(); render(); } }, "small"),
            btn(t("Delete<br>Event Page", "Layout_EventPageButtons").replace("<br>", " "), () => { if (tq.pages.length > 1) { tq.pages.splice(cur, 1); changed(); render(); } }, "small"),
            btn(t("Clear<br>Event Page", "Layout_EventPageButtons").replace("<br>", " "), () => { tq.pages[cur] = blankTroopPage(); changed(); render(); }, "small"));
        const condBtn = btn(conditionSummary(db, tq, page.conditions), async () => {
            if (await editConditions(db, tq, page)) { condBtn.textContent = conditionSummary(db, tq, page.conditions); }
        }, "dbPickBtn");
        box.append(bar, tools,
            el("div", { class: "dbRow" }, fld(t("Conditions", "Group_BattleEvent") + ":", condBtn), fld(t("Span", "Group_BattleEvent") + ":", sel(page, "span", [[0, t("Battle", "Group_BattleEvent")], [1, t("Turn", "Group_BattleEvent")], [2, t("Moment", "Group_BattleEvent")]], { number: true }))),
            fld(t("Contents", "Edit_CommonEvents") + ":", commandList(page, "list", { context: "troop", troopId, title: t("Battle Event", "Group_BattleEvent") })));
    };
    render();
    return box;
}

// ------------------------------------------------------------------ States

export const statesTab = {
    id: "states", label: t("States", "DatabaseMain"), desc: t("Data that can influence character status in various ways.", "DatabaseMain"), file: "States", max: 1000,
    form(ctx, s, host) {
        const db = ctx.db;
        const [left, right] = cols(host);
        left.appendChild(grp(t("General Settings", "Constants"), grid(2,
            fld(t("Name", "Constants") + ":", text(s, "name", { onInput: () => ctx.refreshRow() })),
            fld(t("Icon", "Constants") + ":", iconField(s)),
            fld(t("Restriction", "Edit_States") + ":", sel(s, "restriction", RESTRICTIONS, { number: true })),
            fld(t("Priority", "Edit_States") + ":", num(s, "priority", { min: 0, max: 100 })),
            fld(t("[SV] Motion", "Edit_States") + ":", sel(s, "motion", SV_MOTIONS, { number: true })),
            fld(t("[SV] Overlay", "Edit_States") + ":", sel(s, "overlay", SV_OVERLAYS, { number: true })))));
        left.appendChild(grp(t("Removal Conditions", "Edit_States"),
            el("div", { class: "dbRow" }, chk(s, "removeAtBattleEnd", t("Remove at Battle End", "Edit_States")), chk(s, "removeByRestriction", t("Remove by Restriction", "Edit_States"))),
            grid(2,
                fld(t("Auto-removal Timing", "Edit_States") + ":", sel(s, "autoRemovalTiming", AUTO_REMOVAL, { number: true })),
                fld(t("Duration in Turns", "Edit_States") + ":", [num(s, "minTurns", { min: 0, max: 9999 }), " ~ ", num(s, "maxTurns", { min: 0, max: 9999 })])),
            el("div", { class: "dbRow" }, chk(s, "removeByDamage", t("Remove by Damage", "Edit_States")), num(s, "chanceByDamage", { min: 0, max: 100 }), "%"),
            el("div", { class: "dbRow" }, chk(s, "removeByWalking", t("Remove by Walking", "Edit_States")), num(s, "stepsToRemove", { min: 0, max: 9999 }), t("steps", "Edit_States"))));
        left.appendChild(grp(t("Messages", "Edit_States"),
            fld(t("If an actor is inflicted with the state", "Edit_States") + ":", [el("span", { class: "dbHint", text: t("(Target Name)", "MZEditor") }), text(s, "message1")]),
            fld(t("If an enemy is inflicted with the state", "Edit_States") + ":", [el("span", { class: "dbHint", text: t("(Target Name)", "MZEditor") }), text(s, "message2")]),
            fld(t("If the state persists", "Edit_States") + ":", [el("span", { class: "dbHint", text: t("(Target Name)", "MZEditor") }), text(s, "message3")]),
            fld(t("If the state is removed", "Edit_States") + ":", [el("span", { class: "dbHint", text: t("(Target Name)", "MZEditor") }), text(s, "message4")])));
        right.appendChild(grp(t("Traits", "Group_Traits"), traitsList(db, s)));
        right.appendChild(noteGroup(s));
    }
};
