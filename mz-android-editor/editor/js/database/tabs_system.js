// Abas System 1, System 2, Types e Terms (todas editam data/System.json).
import { el, num, text, sel, chk, fld, grp, grid, btn, tableList, modal, changed, pad, askNumber, confirmBox, radios } from "./ui.js";
import { idOptions, nameOf, typeOptions, PARAMS } from "./common.js";
import { pickSheet, pickColor, audioField, charThumb, imageButton } from "./pickers.js";
import { imageBox } from "./tabs_actors.js";
import { MapView } from "../mapview.js";
import { t } from "../i18n.js";

function twoCols(host) {
    const left = el("div", { class: "dbCol" }), right = el("div", { class: "dbCol" });
    host.appendChild(el("div", { class: "dbCols" }, left, right));
    return [left, right];
}

// ------------------------------------------------------------------ System 1

async function pickActor(db, current) {
    const o = { id: current || 1 };
    const ok = await modal({ title: t("Starting Party", "Dialog_StartingParty"), width: "420px", build: b => b.appendChild(fld(t("Actor", "Constants") + ":", sel(o, "id", idOptions(db.Actors), { number: true }))) });
    return ok ? o.id : null;
}

async function mapName(api, id) {
    if (!id) { return t("None", "Constants"); }
    const infos = await api.project.mapInfos();
    return infos[id] ? `${pad(id, 3)}:${infos[id].name}` : "MAP" + pad(id, 3);
}

// Diálogo de posição inicial: lista de mapas + mapa desenhado com o Tilemap do runtime.
async function pickPosition(api, pos, allowNone) {
    const infos = await api.project.mapInfos();
    const tilesets = await api.project.tilesets();
    const state = { mapId: pos.mapId || 0, x: pos.x || 0, y: pos.y || 0 };
    let view = null, marker = null;
    const coord = el("span", { class: "dbHint" });
    const updateMarker = () => {
        coord.textContent = state.mapId ? `(${state.x}, ${state.y})` : "";
        if (!marker || !view || !view.mapData) { return; }
        marker.clear();
        if (state.mapId) {
            marker.lineStyle(3, 0x2060ff, 1);
            marker.drawRect(state.x * 48 + 2, state.y * 48 + 2, 44, 44);
        }
    };
    const loadMap = async () => {
        if (!view || !state.mapId) { return; }
        const map = await api.project.map(state.mapId);
        view.load(map, tilesets[map.tilesetId]);
        view.overlay.addChild(marker);
        // centraliza na posição
        view.scrollX = state.x * 48 - view.app.renderer.width / 2;
        view.scrollY = state.y * 48 - view.app.renderer.height / 2;
        view._applyView();
        updateMarker();
    };
    const ok = await modal({
        title: t("Location", "Dialog_Location"), width: "1000px", height: "580px",
        build: (b, dlg) => {
            b.classList.add("dbPickBody");
            const list = el("div", { class: "dbPickList" });
            const items = [...(allowNone ? [[0, "(" + t("None", "Constants") + ")"]] : []), ...infos.filter(Boolean).sort((a, b2) => a.order - b2.order).map(i => [i.id, `${pad(i.id, 3)}:${i.name}`])];
            for (const [id, label] of items) {
                const r = el("div", { class: "dbPickItem" + (id === state.mapId ? " sel" : ""), text: label });
                r.addEventListener("click", () => {
                    list.querySelectorAll(".sel").forEach(x => x.classList.remove("sel"));
                    r.classList.add("sel");
                    if (state.mapId !== id) { state.mapId = id; state.x = 0; state.y = 0; loadMap(); updateMarker(); }
                });
                list.appendChild(r);
            }
            const vp = el("div", { class: "dbMapView" });
            const canvas = el("canvas");
            vp.appendChild(canvas);
            b.append(list, el("div", { class: "dbPickRight" }, vp, el("div", { class: "dbRow" }, el("span", { text: t("Tap the map to set the position.", "MZEditor") }), coord)));
            requestAnimationFrame(() => {
                view = new MapView(canvas, vp);
                marker = new PIXI.Graphics();
                let down = null;
                vp.addEventListener("pointerdown", e => { down = { x: e.clientX, y: e.clientY }; });
                vp.addEventListener("pointerup", e => {
                    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8 || !view.mapData) { return; }
                    const r = vp.getBoundingClientRect();
                    const z = view.zoom;
                    const x = Math.floor((e.clientX - r.left - view.world.position.x + view.scrollX) / (48 * z));
                    const y = Math.floor((e.clientY - r.top - view.world.position.y + view.scrollY) / (48 * z));
                    if (x >= 0 && y >= 0 && x < view.mapData.width && y < view.mapData.height) { state.x = x; state.y = y; updateMarker(); }
                });
                loadMap();
                const s = list.querySelector(".sel");
                if (s) { s.scrollIntoView({ block: "center" }); }
            });
            const cleanup = new MutationObserver(() => {
                if (!dlg.root.isConnected && view) {
                    cleanup.disconnect();
                    try { view._resizeObserver.disconnect(); view.app.destroy(false); } catch (e) { /* ignora */ }
                }
            });
            cleanup.observe(document.body, { childList: true });
        }
    });
    return ok ? state : null;
}

const VEHICLES = [["boat", t("Boat", "Constants")], ["ship", t("Ship", "Constants")], ["airship", t("Airship", "Constants")]];
const MUSIC = [["titleBgm", t("Title", "Group_SystemMusic"), "bgm"], ["battleBgm", t("Battle", "Group_SystemMusic"), "bgm"], ["victoryMe", t("Victory", "Group_SystemMusic"), "me"],
    ["defeatMe", t("Defeat", "Group_SystemMusic"), "me"], ["gameoverMe", t("Game Over", "Group_SystemMusic"), "me"], ["boat", t("Boat", "Constants"), "bgm"],
    ["ship", t("Ship", "Constants"), "bgm"], ["airship", t("Airship", "Constants"), "bgm"]];
const SOUNDS = [
    t("Cursor", "Group_SystemSound"), t("OK", "Group_SystemSound"), t("Cancel", "Group_SystemSound"), t("Buzzer", "Group_SystemSound"),
    t("Equip", "Group_SystemSound"), t("Save", "Group_SystemSound"), t("Load", "Group_SystemSound"), t("Battle Start", "Group_SystemSound"),
    t("Escape", "Group_SystemSound"), t("Enemy Attack", "Group_SystemSound"), t("Enemy Damage", "Group_SystemSound"), t("Enemy Collapse", "Group_SystemSound"),
    t("Boss Collapse 1", "Group_SystemSound"), t("Boss Collapse 2", "Group_SystemSound"), t("Actor Damage", "Group_SystemSound"), t("Actor Collapse", "Group_SystemSound"),
    t("Recovery", "Group_SystemSound"), t("Miss", "Group_SystemSound"), t("Evasion", "Group_SystemSound"), t("Magic Evasion", "Group_SystemSound"),
    t("Magic Reflection", "Group_SystemSound"), t("Shop", "Group_SystemSound"), t("Use Item", "Group_SystemSound"), t("Use Skill", "Group_SystemSound")
];

export const system1Tab = {
    id: "system1", label: t("System 1", "DatabaseMain"), desc: t("Basic configuration of the entire game.", "DatabaseMain"), file: "System",
    page(ctx, host) {
        const db = ctx.db, sys = db.System, api = ctx.api;
        const [left, right] = twoCols(host);
        left.appendChild(grp(t("Game Title", "Edit_X_System1"), text(sys, "gameTitle")));
        left.appendChild(grp(t("Currency", "Edit_X_System1"), text(sys, "currencyUnit")));
        left.appendChild(grp(t("Starting Party", "Group_StartingParty"), tableList({
            columns: [{ title: t("Actor", "Constants"), width: "1fr" }],
            items: sys.partyMembers,
            cells: id => [pad(id) + " " + nameOf(db.Actors, id)],
            create: () => pickActor(db, 1),
            edit: id => pickActor(db, id),
            clipKey: "party"
        })));
        const toneBtn = btn("", async () => {
            const v = await pickColor(sys.windowTone.slice(0, 3), "tone", t("Window Color", "Dialog_WindowColor"), 3);
            if (v) { sys.windowTone = [v[0], v[1], v[2], sys.windowTone[3] || 0]; changed(); paintTone(); }
        }, "dbPickBtn");
        const paintTone = () => {
            const c = [0x40, 0x60, 0x80].map((b, i) => Math.max(0, Math.min(255, b + sys.windowTone[i])));
            toneBtn.textContent = sys.windowTone.slice(0, 3).join(", ");
            toneBtn.style.background = `rgb(${c.join(",")})`;
            toneBtn.style.color = "#fff";
        };
        paintTone();
        left.appendChild(grp(t("Window Color", "Edit_X_System1"), toneBtn));
        left.appendChild(grp(t("Vehicle Images", "Edit_X_System1"), el("div", { class: "dbImgRow" }, ...VEHICLES.map(([k, label]) =>
            imageBox(label + ":", () => charThumb(sys[k].characterName, sys[k].characterIndex, 72), async () => {
                const r = await pickSheet({ kind: "character", name: sys[k].characterName, index: sys[k].characterIndex });
                if (r) { sys[k].characterName = r.name; sys[k].characterIndex = r.index; return true; }
            })))));
        const posGrid = grid(2);
        const posField = (label, get, set, allowNone) => {
            const b = btn("", async () => {
                const r = await pickPosition(api, get(), allowNone);
                if (r) { set(r); changed(); paint(); }
            }, "dbPickBtn");
            const paint = async () => {
                const p = get();
                b.textContent = p.mapId ? `${await mapName(api, p.mapId)} (${p.x},${p.y})` : t("None", "Constants");
            };
            paint();
            posGrid.appendChild(fld(label + ":", b));
        };
        posField(t("Player", "Constants"), () => ({ mapId: sys.startMapId, x: sys.startX, y: sys.startY }),
            r => { sys.startMapId = r.mapId; sys.startX = r.x; sys.startY = r.y; }, false);
        for (const [k, label] of VEHICLES) {
            posField(label, () => ({ mapId: sys[k].startMapId, x: sys[k].startX, y: sys[k].startY }),
                r => { sys[k].startMapId = r.mapId; sys[k].startX = r.x; sys[k].startY = r.y; }, true);
        }
        left.appendChild(grp(t("Starting Positions", "Group_SystemStarting"), posGrid));
        left.appendChild(grp(t("Title Screen", "Edit_X_System1"), grid(2,
            fld(t("Images", "Edit_X_System1") + ":", [imageButton(sys, "title1Name", "titles1"), imageButton(sys, "title2Name", "titles2")], { span: 2 }),
            chk(sys, "optDrawTitle", t("Draw Game Title", "Edit_X_System1")))));
        if (!sys.titleCommandWindow) { sys.titleCommandWindow = { background: 0, offsetX: 0, offsetY: 0 }; }
        left.appendChild(grp(t("Command Window", "Edit_X_System1"), grid(3,
            fld(t("Background", "Dialog_TitleCommandWindow") + ":", sel(sys.titleCommandWindow, "background", [[0, t("Window", "Constants")], [1, t("Dim", "Constants")], [2, t("Transparent", "Constants")]], { number: true })),
            fld(t("Offset X", "Dialog_TitleCommandWindow") + ":", num(sys.titleCommandWindow, "offsetX", { min: -9999, max: 9999 })),
            fld(t("Offset Y", "Dialog_TitleCommandWindow") + ":", num(sys.titleCommandWindow, "offsetY", { min: -9999, max: 9999 })))));
        left.appendChild(grp(t("Battle Screen", "Group_SystemBattle"), radios(sys, "optSideView", [[false, t("Front-view", "Group_SystemBattle")], [true, t("Side-view", "Group_SystemBattle")]])));
        left.appendChild(grp(t("Battle System", "Group_SystemBattle"), sel(sys, "battleSystem", [[0, t("Turn-based", "Group_SystemBattle")], [1, t("Time Progress (Active)", "Group_SystemBattle")], [2, t("Time Progress (Wait)", "Group_SystemBattle")]], { number: true })));
        left.appendChild(grp(t("Options", "Group_SystemOptions"), el("div", { class: "dbChecks" },
            chk(sys, "optTransparent", t("Start in Transparent", "Group_SystemOptions")),
            chk(sys, "optFollowers", t("Show Player Followers", "Group_SystemOptions")),
            chk(sys, "optSlipDeath", t("Death by Slip Damage", "Group_SystemOptions")),
            chk(sys, "optFloorDeath", t("Death by Floor Damage", "Group_SystemOptions")),
            chk(sys, "optDisplayTp", t("Display TP in Window", "Group_SystemOptions")),
            chk(sys, "optExtraExp", t("EXP for Reserve Members", "Group_SystemOptions")),
            chk(sys, "optKeyItemsNumber", t("Show the Number of Key Items", "Group_SystemOptions")),
            chk(sys, "optAutosave", t("Enable Autosave", "Group_SystemOptions")))));
        right.appendChild(grp(t("Music", "Group_SystemMusic"), grid(2, ...MUSIC.map(([k, label, folder]) =>
            VEHICLES.some(v => v[0] === k) ? fld(label + ":", audioField(sys[k], "bgm", folder)) : fld(label + ":", audioField(sys, k, folder))))));
        while (sys.sounds.length < SOUNDS.length) { sys.sounds.push({ name: "", pan: 0, pitch: 100, volume: 90 }); }
        right.appendChild(grp(t("Sound", "Group_SystemSound"), grid(2, ...SOUNDS.map((label, i) => fld(label + ":", audioField(sys.sounds, i, "se"))))));
    }
};

// ------------------------------------------------------------------ System 2

function weaponImageOptions() {
    const out = [[0, t("None", "Constants")]];
    for (let i = 1; i <= 36; i++) { out.push([i, `Weapons${Math.floor((i - 1) / 12) + 1} #${((i - 1) % 12) + 1}`]); }
    return out;
}

export const system2Tab = {
    id: "system2", label: t("System 2", "DatabaseMain"), desc: t("Basic configuration of the entire game.", "DatabaseMain"), file: "System",
    page(ctx, host) {
        const sys = ctx.db.System;
        const [left, right] = twoCols(host);
        const menuNames = [t("Item", "Constants"), t("Skill", "Constants"), t("Equip", "Constants"), t("Status", "Constants"), t("Formation", "Constants"), t("Save", "Constants")];
        while (sys.menuCommands.length < 6) { sys.menuCommands.push(true); }
        left.appendChild(grp(t("Menu Commands", "Group_SystemMenuCommands"), el("div", { class: "dbChecks" }, ...menuNames.map((n, i) => chk(sys.menuCommands, i, n)))));
        const catNames = [t("Item", "Constants"), t("Weapon", "Constants"), t("Armor", "Constants"), t("Key Item", "Constants")];
        while (sys.itemCategories.length < 4) { sys.itemCategories.push(true); }
        left.appendChild(grp(t("Item Categories", "Group_SystemItemCategories"), el("div", { class: "dbChecks" }, ...catNames.map((n, i) => chk(sys.itemCategories, i, n)))));
        while (sys.attackMotions.length < sys.weaponTypes.length) { sys.attackMotions.push({ type: 0, weaponImageId: 0 }); }
        const motions = el("div", { class: "dbMotions" });
        sys.weaponTypes.forEach((wt, i) => {
            const m = sys.attackMotions[i];
            motions.appendChild(el("div", { class: "dbMotionRow" },
                el("span", { class: "dbLabel", text: i === 0 ? t("Bare Hands", "Group_SystemAttackMotions") : pad(i, 2) + " " + wt }),
                sel(m, "type", [[0, t("Thrust", "Constants")], [1, t("Swing", "Constants")], [2, t("Missile", "Constants")]], { number: true }),
                sel(m, "weaponImageId", weaponImageOptions(), { number: true })));
        });
        left.appendChild(grp(t("[SV] Attack Motions", "Group_SystemAttackMotions"), motions));
        const magic = el("div", { class: "dbChecks" });
        sys.skillTypes.forEach((st, i) => {
            if (i === 0) { return; }
            const o = { get v() { return sys.magicSkills.includes(i); }, set v(on) {
                const s = new Set(sys.magicSkills); on ? s.add(i) : s.delete(i); sys.magicSkills = [...s].sort((a, b) => a - b);
            } };
            magic.appendChild(chk(o, "v", pad(i, 2) + " " + st));
        });
        right.appendChild(grp(t("[SV] Magic Skills", "Group_SystemMagicSkills"), magic));
        const adv = sys.advanced || (sys.advanced = {});
        const advFields = [
            fld(t("Game ID", "Group_SystemAdvanced") + ":", num(adv, "gameId", { min: 0, max: 99999999, width: "140px" })),
            fld(t("Screen Width", "Group_SystemAdvanced") + ":", num(adv, "screenWidth", { min: 640, max: 4000 })),
            fld(t("Screen Height", "Group_SystemAdvanced") + ":", num(adv, "screenHeight", { min: 360, max: 4000 })),
            fld(t("UI Area Width", "Group_SystemAdvanced") + ":", num(adv, "uiAreaWidth", { min: 640, max: 4000 })),
            fld(t("UI Area Height", "Group_SystemAdvanced") + ":", num(adv, "uiAreaHeight", { min: 360, max: 4000 })),
            fld(t("Font Size", "Group_SystemAdvanced") + ":", num(adv, "fontSize", { min: 12, max: 128 })),
            fld(t("Main Font Filename", "Group_SystemAdvanced") + ":", text(adv, "mainFontFilename")),
            fld(t("Number Font Filename", "Group_SystemAdvanced") + ":", text(adv, "numberFontFilename")),
            fld(t("Fallback Fonts", "Group_SystemAdvanced") + ":", text(adv, "fallbackFonts"), { span: 2 })
        ];
        if ("windowOpacity" in adv) { advFields.push(fld(t("Window Opacity", "MZEditor") + ":", num(adv, "windowOpacity", { min: 0, max: 255 }))); }
        if ("picturesUpperLimit" in adv) { advFields.push(fld(t("Pictures Upper Limit", "MZEditor") + ":", num(adv, "picturesUpperLimit", { min: 1, max: 999 }))); }
        right.appendChild(grp(t("Advanced Settings", "Group_SystemAdvanced"), grid(2, ...advFields)));
    }
};

// ------------------------------------------------------------------ Types

function typeListBox(ctx, title, key) {
    const sys = ctx.db.System;
    const box = el("div", { class: "dbTypeBox" });
    const list = el("div", { class: "dbList" });
    let selIdx = 1;
    const nameObj = { get v() { return sys[key][selIdx] || ""; }, set v(x) { sys[key][selIdx] = x; } };
    const name = text(nameObj, "v", { onInput: () => {
        const r = list.querySelector(".sel"); if (r) { r.textContent = pad(selIdx, 2) + " " + sys[key][selIdx]; }
    } });
    const render = () => {
        list.innerHTML = "";
        for (let i = 1; i < sys[key].length; i++) {
            const r = el("div", { class: "dbListItem" + (i === selIdx ? " sel" : ""), text: pad(i, 2) + " " + (sys[key][i] || "") });
            r.addEventListener("click", () => { selIdx = i; render(); });
            list.appendChild(r);
        }
        name.refresh();
        name.disabled = selIdx >= sys[key].length;
    };
    const change = btn(t("Change Maximum", "Group_SystemTypes") + "...", async () => {
        const n = await askNumber(t("Change Maximum", "Dialog_ChangeMaximum"), t("Maximum", "Dialog_ChangeMaximum") + ":", sys[key].length - 1, 1, 999);
        if (n === null || n === sys[key].length - 1) { return; }
        if (n < sys[key].length - 1 && !(await confirmBox(t("Excess names will be deleted. Continue?", "MZEditor")))) { return; }
        if (n < sys[key].length - 1) { sys[key].length = n + 1; } else { while (sys[key].length <= n) { sys[key].push(""); } }
        selIdx = Math.min(selIdx, n);
        changed();
        render();
    });
    box.append(el("div", { class: "dbListTitle", text: title }), list, fld(t("Name", "Constants") + ":", name), change);
    render();
    return box;
}

export const typesTab = {
    id: "types", label: t("Types", "DatabaseMain"), desc: t("Names of elements, skill types, weapon types, armor types, and equipment types.", "DatabaseMain"), file: "System",
    page(ctx, host) {
        host.appendChild(el("div", { class: "dbTypes" },
            typeListBox(ctx, t("Elements", "Edit_X_Types"), "elements"),
            typeListBox(ctx, t("Skill Types", "Edit_X_Types"), "skillTypes"),
            typeListBox(ctx, t("Weapon Types", "Edit_X_Types"), "weaponTypes"),
            typeListBox(ctx, t("Armor Types", "Edit_X_Types"), "armorTypes"),
            typeListBox(ctx, t("Equipment Types", "Edit_X_Types"), "equipTypes")));
    }
};

// ------------------------------------------------------------------ Terms

const ABBR = " " + t("(abbr.)", "Edit_X_Terms");
const BASIC = [t("Level", "Constants"), t("Level", "Constants") + ABBR, t("HP", "Constants"), t("HP", "Constants") + ABBR,
    t("MP", "Constants"), t("MP", "Constants") + ABBR, t("TP", "Constants"), t("TP", "Constants") + ABBR, t("EXP", "Constants"), t("EXP", "Constants") + ABBR];
const PARAM_TERMS = [...PARAMS, t("Hit"), t("Evasion", "Group_SystemMessages")];
const COMMANDS = [t("Fight", "Constants"), t("Escape", "Constants"), t("Attack", "Constants"), t("Guard", "Constants"), t("Item", "Constants"),
    t("Skill", "Constants"), t("Equip", "Constants"), t("Status", "Constants"), t("Formation", "Constants"), t("Save", "Constants"),
    t("Game End", "Constants"), t("Options", "Constants"), t("Weapon", "Constants"), t("Armor", "Constants"), t("Key Item", "Constants"),
    t("Equip", "Constants") + " 2", t("Optimize", "Constants"), t("Clear", "Constants"), t("New Game", "Constants"), t("Continue", "Constants"),
    null, t("To Title", "Constants"), t("Cancel", "Constants"), null, t("Buy", "Constants"), t("Sell", "Constants")];
const MSG_LABELS = {
    actionFailure: t("Action Failure", "Group_SystemMessages"), actorDamage: t("Actor Damage", "Group_SystemMessages"),
    actorDrain: t("Actor Drain", "Group_SystemMessages"), actorGain: t("Actor Gain", "Group_SystemMessages"),
    actorLoss: t("Actor Loss", "Group_SystemMessages"), actorNoDamage: t("Actor No Damage", "Group_SystemMessages"),
    actorNoHit: t("Actor No Hit", "Group_SystemMessages"), actorRecovery: t("Actor Recovery", "Group_SystemMessages"),
    alwaysDash: t("Always Dash", "Group_SystemMessages"), autosave: t("Autosave", "Group_SystemMessages"),
    bgmVolume: t("BGM Volume", "Group_SystemMessages"), bgsVolume: t("BGS Volume", "Group_SystemMessages"),
    buffAdd: t("Buff Add", "Group_SystemMessages"), buffRemove: t("Buff Remove", "Group_SystemMessages"),
    commandRemember: t("Command Remember", "Group_SystemMessages"),
    counterAttack: t("Counter Attack", "Group_SystemMessages"),
    criticalToActor: t("Critical to Actor", "Group_SystemMessages"),
    criticalToEnemy: t("Critical to Enemy", "Group_SystemMessages"), debuffAdd: t("Debuff Add", "Group_SystemMessages"),
    defeat: t("Defeat", "Group_SystemMessages"), emerge: t("Emerge", "Group_SystemMessages"),
    enemyDamage: t("Enemy Damage", "Group_SystemMessages"), enemyDrain: t("Enemy Drain", "Group_SystemMessages"),
    enemyGain: t("Enemy Gain", "Group_SystemMessages"), enemyLoss: t("Enemy Loss", "Group_SystemMessages"),
    enemyNoDamage: t("Enemy No Damage", "Group_SystemMessages"), enemyNoHit: t("Enemy No Hit", "Group_SystemMessages"),
    enemyRecovery: t("Enemy Recovery", "Group_SystemMessages"),
    escapeFailure: t("Escape Failure", "Group_SystemMessages"), escapeStart: t("Escape Start", "Group_SystemMessages"),
    evasion: t("Evasion", "Group_SystemMessages"), expNext: t("EXP Next", "Group_SystemMessages"),
    expTotal: t("EXP Total", "Group_SystemMessages"), file: t("File", "Group_SystemMessages"),
    levelUp: t("Level Up", "Group_SystemMessages"), loadMessage: t("Load Message", "Group_SystemMessages"),
    magicEvasion: t("Magic Evasion", "Group_SystemMessages"),
    magicReflection: t("Magic Reflection", "Group_SystemMessages"), meVolume: t("ME Volume", "Group_SystemMessages"),
    obtainExp: t("Obtain EXP", "Group_SystemMessages"), obtainGold: t("Obtain Gold", "Group_SystemMessages"),
    obtainItem: t("Obtain Item", "Group_SystemMessages"), obtainSkill: t("Obtain Skill", "Group_SystemMessages"),
    partyName: t("Party Name", "Group_SystemMessages"), possession: t("Possession", "Group_SystemMessages"),
    preemptive: t("Preemptive", "Group_SystemMessages"), saveMessage: t("Save Message", "Group_SystemMessages"),
    seVolume: t("SE Volume", "Group_SystemMessages"), substitute: t("Substitute", "Group_SystemMessages"),
    surprise: t("Surprise", "Group_SystemMessages"), touchUI: t("Touch UI", "Group_SystemMessages"),
    useItem: t("Use Item", "Group_SystemMessages"), victory: t("Victory", "Group_SystemMessages")
};
const msgLabel = k => MSG_LABELS[k] || k.replace(/([A-Z])/g, " $1").replace(/^./, c => c.toUpperCase());

export const termsTab = {
    id: "terms", label: t("Terms", "DatabaseMain"), desc: t("Text data such as command and parameter names.", "DatabaseMain"), file: "System",
    page(ctx, host) {
        const tq = ctx.db.System.terms;
        const [left, right] = twoCols(host);
        while (tq.basic.length < 10) { tq.basic.push(""); }
        while (tq.params.length < 10) { tq.params.push(""); }
        left.appendChild(grp(t("Basic Statuses", "Edit_X_Terms"), grid(2, ...BASIC.map((l, i) => fld(l + ":", text(tq.basic, i))))));
        left.appendChild(grp(t("Parameters", "Edit_X_Terms"), grid(2, ...PARAM_TERMS.map((l, i) => fld(l + ":", text(tq.params, i))))));
        left.appendChild(grp(t("Commands", "Edit_X_Terms"), grid(2, ...COMMANDS.map((l, i) => l === null ? null : fld(l + ":", text(tq.commands, i))).filter(Boolean))));
        right.appendChild(grp(t("Messages", "Group_SystemMessages"), grid(2, ...Object.keys(tq.messages).map(k => fld(msgLabel(k) + ":", text(tq.messages, k))))));
    }
};
