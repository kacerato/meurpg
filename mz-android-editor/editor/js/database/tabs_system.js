// Abas System 1, System 2, Types e Terms (todas editam data/System.json).
import { el, num, text, sel, chk, fld, grp, grid, btn, tableList, modal, changed, pad, askNumber, confirmBox, radios } from "./ui.js";
import { idOptions, nameOf, typeOptions } from "./common.js";
import { pickSheet, pickColor, audioField, charThumb, imageButton } from "./pickers.js";
import { imageBox } from "./tabs_actors.js";
import { MapView } from "../mapview.js";

function twoCols(host) {
    const left = el("div", { class: "dbCol" }), right = el("div", { class: "dbCol" });
    host.appendChild(el("div", { class: "dbCols" }, left, right));
    return [left, right];
}

// ------------------------------------------------------------------ System 1

async function pickActor(db, current) {
    const o = { id: current || 1 };
    const ok = await modal({ title: "Actor", width: "420px", build: b => b.appendChild(fld("Actor:", sel(o, "id", idOptions(db.Actors), { number: true }))) });
    return ok ? o.id : null;
}

async function mapName(api, id) {
    if (!id) { return "None"; }
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
        title: "Starting Position", width: "1000px", height: "580px",
        build: (b, dlg) => {
            b.classList.add("dbPickBody");
            const list = el("div", { class: "dbPickList" });
            const items = [...(allowNone ? [[0, "(None)"]] : []), ...infos.filter(Boolean).sort((a, b2) => a.order - b2.order).map(i => [i.id, `${pad(i.id, 3)}:${i.name}`])];
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
            b.append(list, el("div", { class: "dbPickRight" }, vp, el("div", { class: "dbRow" }, el("span", { text: "Toque no mapa para definir a posição." }), coord)));
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

const VEHICLES = [["boat", "Boat"], ["ship", "Ship"], ["airship", "Airship"]];
const MUSIC = [["titleBgm", "Title", "bgm"], ["battleBgm", "Battle", "bgm"], ["victoryMe", "Victory", "me"],
    ["defeatMe", "Defeat", "me"], ["gameoverMe", "Game Over", "me"], ["boat", "Boat", "bgm"], ["ship", "Ship", "bgm"], ["airship", "Airship", "bgm"]];
const SOUNDS = ["Cursor", "OK", "Cancel", "Buzzer", "Equip", "Save", "Load", "Battle Start", "Escape", "Enemy Attack",
    "Enemy Damage", "Enemy Collapse", "Boss Collapse 1", "Boss Collapse 2", "Ally Damage", "Ally Collapse", "Recovery",
    "Miss", "Evasion", "Magic Evasion", "Magic Reflection", "Shop", "Use Item", "Use Skill"];

export const system1Tab = {
    id: "system1", label: "System 1", file: "System",
    page(ctx, host) {
        const db = ctx.db, sys = db.System, api = ctx.api;
        const [left, right] = twoCols(host);
        left.appendChild(grp("Game Title", text(sys, "gameTitle")));
        left.appendChild(grp("Currency", text(sys, "currencyUnit")));
        left.appendChild(grp("Starting Party", tableList({
            columns: [{ title: "Actor", width: "1fr" }],
            items: sys.partyMembers,
            cells: id => [pad(id) + " " + nameOf(db.Actors, id)],
            create: () => pickActor(db, 1),
            edit: id => pickActor(db, id),
            clipKey: "party"
        })));
        const toneBtn = btn("", async () => {
            const v = await pickColor(sys.windowTone.slice(0, 3), "tone", "Window Color", 3);
            if (v) { sys.windowTone = [v[0], v[1], v[2], sys.windowTone[3] || 0]; changed(); paintTone(); }
        }, "dbPickBtn");
        const paintTone = () => {
            const c = [0x40, 0x60, 0x80].map((b, i) => Math.max(0, Math.min(255, b + sys.windowTone[i])));
            toneBtn.textContent = sys.windowTone.slice(0, 3).join(", ");
            toneBtn.style.background = `rgb(${c.join(",")})`;
            toneBtn.style.color = "#fff";
        };
        paintTone();
        left.appendChild(grp("Window Color", toneBtn));
        left.appendChild(grp("Vehicle Images", el("div", { class: "dbImgRow" }, ...VEHICLES.map(([k, label]) =>
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
                b.textContent = p.mapId ? `${await mapName(api, p.mapId)} (${p.x},${p.y})` : "None";
            };
            paint();
            posGrid.appendChild(fld(label + ":", b));
        };
        posField("Player", () => ({ mapId: sys.startMapId, x: sys.startX, y: sys.startY }),
            r => { sys.startMapId = r.mapId; sys.startX = r.x; sys.startY = r.y; }, false);
        for (const [k, label] of VEHICLES) {
            posField(label, () => ({ mapId: sys[k].startMapId, x: sys[k].startX, y: sys[k].startY }),
                r => { sys[k].startMapId = r.mapId; sys[k].startX = r.x; sys[k].startY = r.y; }, true);
        }
        left.appendChild(grp("Starting Positions", posGrid));
        left.appendChild(grp("Title Screen", grid(2,
            fld("Images:", [imageButton(sys, "title1Name", "titles1"), imageButton(sys, "title2Name", "titles2")], { span: 2 }),
            chk(sys, "optDrawTitle", "Draw Game Title"))));
        if (!sys.titleCommandWindow) { sys.titleCommandWindow = { background: 0, offsetX: 0, offsetY: 0 }; }
        left.appendChild(grp("Command Window", grid(3,
            fld("Background:", sel(sys.titleCommandWindow, "background", [[0, "Window"], [1, "Dim"], [2, "Transparent"]], { number: true })),
            fld("Offset X:", num(sys.titleCommandWindow, "offsetX", { min: -9999, max: 9999 })),
            fld("Offset Y:", num(sys.titleCommandWindow, "offsetY", { min: -9999, max: 9999 })))));
        left.appendChild(grp("Battle Screen", radios(sys, "optSideView", [[false, "Front-view"], [true, "Side-view"]])));
        left.appendChild(grp("Battle System", sel(sys, "battleSystem", [[0, "Turn-based"], [1, "Time Progress (Active)"], [2, "Time Progress (Wait)"]], { number: true })));
        left.appendChild(grp("Options", el("div", { class: "dbChecks" },
            chk(sys, "optTransparent", "Start Transparent"),
            chk(sys, "optFollowers", "Show Player Followers"),
            chk(sys, "optSlipDeath", "Knockout by Slip Damage"),
            chk(sys, "optFloorDeath", "Knockout by Floor Damage"),
            chk(sys, "optDisplayTp", "Display TP in Battle"),
            chk(sys, "optExtraExp", "EXP for Reserve Members"),
            chk(sys, "optKeyItemsNumber", "Show Number of Key Items"),
            chk(sys, "optAutosave", "Enable Autosave"))));
        right.appendChild(grp("Music", grid(2, ...MUSIC.map(([k, label, folder]) =>
            VEHICLES.some(v => v[0] === k) ? fld(label + ":", audioField(sys[k], "bgm", folder)) : fld(label + ":", audioField(sys, k, folder))))));
        while (sys.sounds.length < SOUNDS.length) { sys.sounds.push({ name: "", pan: 0, pitch: 100, volume: 90 }); }
        right.appendChild(grp("Sounds", grid(2, ...SOUNDS.map((label, i) => fld(label + ":", audioField(sys.sounds, i, "se"))))));
    }
};

// ------------------------------------------------------------------ System 2

function weaponImageOptions() {
    const out = [[0, "None"]];
    for (let i = 1; i <= 36; i++) { out.push([i, `Weapons${Math.floor((i - 1) / 12) + 1} #${((i - 1) % 12) + 1}`]); }
    return out;
}

export const system2Tab = {
    id: "system2", label: "System 2", file: "System",
    page(ctx, host) {
        const sys = ctx.db.System;
        const [left, right] = twoCols(host);
        const menuNames = ["Item", "Skill", "Equip", "Status", "Formation", "Save"];
        while (sys.menuCommands.length < 6) { sys.menuCommands.push(true); }
        left.appendChild(grp("Menu Commands", el("div", { class: "dbChecks" }, ...menuNames.map((n, i) => chk(sys.menuCommands, i, n)))));
        const catNames = ["Item", "Weapon", "Armor", "Key Item"];
        while (sys.itemCategories.length < 4) { sys.itemCategories.push(true); }
        left.appendChild(grp("Item Categories", el("div", { class: "dbChecks" }, ...catNames.map((n, i) => chk(sys.itemCategories, i, n)))));
        while (sys.attackMotions.length < sys.weaponTypes.length) { sys.attackMotions.push({ type: 0, weaponImageId: 0 }); }
        const motions = el("div", { class: "dbMotions" });
        sys.weaponTypes.forEach((wt, i) => {
            const m = sys.attackMotions[i];
            motions.appendChild(el("div", { class: "dbMotionRow" },
                el("span", { class: "dbLabel", text: i === 0 ? "Bare Hands" : pad(i, 2) + " " + wt }),
                sel(m, "type", [[0, "Thrust"], [1, "Swing"], [2, "Missile"]], { number: true }),
                sel(m, "weaponImageId", weaponImageOptions(), { number: true })));
        });
        left.appendChild(grp("[SV] Attack Motions", motions));
        const magic = el("div", { class: "dbChecks" });
        sys.skillTypes.forEach((st, i) => {
            if (i === 0) { return; }
            const o = { get v() { return sys.magicSkills.includes(i); }, set v(on) {
                const s = new Set(sys.magicSkills); on ? s.add(i) : s.delete(i); sys.magicSkills = [...s].sort((a, b) => a - b);
            } };
            magic.appendChild(chk(o, "v", pad(i, 2) + " " + st));
        });
        right.appendChild(grp("[SV] Magic Skills", magic));
        const adv = sys.advanced || (sys.advanced = {});
        const advFields = [
            fld("Game ID:", num(adv, "gameId", { min: 0, max: 99999999, width: "140px" })),
            fld("Screen Width:", num(adv, "screenWidth", { min: 640, max: 4000 })),
            fld("Screen Height:", num(adv, "screenHeight", { min: 360, max: 4000 })),
            fld("UI Area Width:", num(adv, "uiAreaWidth", { min: 640, max: 4000 })),
            fld("UI Area Height:", num(adv, "uiAreaHeight", { min: 360, max: 4000 })),
            fld("Font Size:", num(adv, "fontSize", { min: 12, max: 128 })),
            fld("Main Font Filename:", text(adv, "mainFontFilename")),
            fld("Number Font Filename:", text(adv, "numberFontFilename")),
            fld("Fallback Fonts:", text(adv, "fallbackFonts"), { span: 2 })
        ];
        if ("windowOpacity" in adv) { advFields.push(fld("Window Opacity:", num(adv, "windowOpacity", { min: 0, max: 255 }))); }
        if ("picturesUpperLimit" in adv) { advFields.push(fld("Pictures Upper Limit:", num(adv, "picturesUpperLimit", { min: 1, max: 999 }))); }
        right.appendChild(grp("Advanced Settings", grid(2, ...advFields)));
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
    const change = btn("Change Maximum...", async () => {
        const n = await askNumber("Change Maximum", "Maximum:", sys[key].length - 1, 1, 999);
        if (n === null || n === sys[key].length - 1) { return; }
        if (n < sys[key].length - 1 && !(await confirmBox("Os nomes excedentes serão apagados. Continuar?"))) { return; }
        if (n < sys[key].length - 1) { sys[key].length = n + 1; } else { while (sys[key].length <= n) { sys[key].push(""); } }
        selIdx = Math.min(selIdx, n);
        changed();
        render();
    });
    box.append(el("div", { class: "dbListTitle", text: title }), list, fld("Name:", name), change);
    render();
    return box;
}

export const typesTab = {
    id: "types", label: "Types", file: "System",
    page(ctx, host) {
        host.appendChild(el("div", { class: "dbTypes" },
            typeListBox(ctx, "Elements", "elements"),
            typeListBox(ctx, "Skill Types", "skillTypes"),
            typeListBox(ctx, "Weapon Types", "weaponTypes"),
            typeListBox(ctx, "Armor Types", "armorTypes"),
            typeListBox(ctx, "Equipment Types", "equipTypes")));
    }
};

// ------------------------------------------------------------------ Terms

const BASIC = ["Level", "Level (abbr.)", "HP", "HP (abbr.)", "MP", "MP (abbr.)", "TP", "TP (abbr.)", "EXP", "EXP (abbr.)"];
const PARAM_TERMS = ["Max HP", "Max MP", "Attack", "Defense", "M.Attack", "M.Defense", "Agility", "Luck", "Hit", "Evasion"];
const COMMANDS = ["Fight", "Escape", "Attack", "Guard", "Item", "Skill", "Equip", "Status", "Formation", "Save", "Game End",
    "Options", "Weapon", "Armor", "Key Item", "Equip 2", "Optimize", "Clear", "New Game", "Continue", null, "To Title",
    "Cancel", null, "Buy", "Sell"];
const MSG_LABELS = { touchUI: "Touch UI", bgmVolume: "BGM Volume", bgsVolume: "BGS Volume", meVolume: "ME Volume",
    seVolume: "SE Volume", expTotal: "EXP Total", expNext: "EXP Next", file: "Save File", autosave: "Autosave File",
    obtainExp: "Obtain EXP", counterAttack: "Counterattack" };
const msgLabel = k => MSG_LABELS[k] || k.replace(/([A-Z])/g, " $1").replace(/^./, c => c.toUpperCase());

export const termsTab = {
    id: "terms", label: "Terms", file: "System",
    page(ctx, host) {
        const t = ctx.db.System.terms;
        const [left, right] = twoCols(host);
        while (t.basic.length < 10) { t.basic.push(""); }
        while (t.params.length < 10) { t.params.push(""); }
        left.appendChild(grp("Basic Statuses", grid(2, ...BASIC.map((l, i) => fld(l + ":", text(t.basic, i))))));
        left.appendChild(grp("Parameters", grid(2, ...PARAM_TERMS.map((l, i) => fld(l + ":", text(t.params, i))))));
        left.appendChild(grp("Commands", grid(2, ...COMMANDS.map((l, i) => l === null ? null : fld(l + ":", text(t.commands, i))).filter(Boolean))));
        right.appendChild(grp("Messages", grid(2, ...Object.keys(t.messages).map(k => fld(msgLabel(k) + ":", text(t.messages, k))))));
    }
};
