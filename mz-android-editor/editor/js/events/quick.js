// Quick Event Creation (Transfer, Door, Treasure, Inn) como no menu de contexto do MZ.

import { db, TEMPLATE } from "./data.js";
import { h, dialog, field, row, group, num, sel, radios, locationPick, characterDialog, drawCharacterThumb } from "./ui.js";
import { t } from "../i18n.js";

const E = i => ({ code: 0, indent: i, parameters: [] });
const C = (code, indent, parameters = []) => ({ code, indent, parameters });
const se = name => ({ name, volume: 90, pitch: 100, pan: 0 });
const route = (list, wait = true) => ({ list: [...list.map(([code, parameters = []]) => ({ code, parameters })), { code: 0, parameters: [] }], repeat: false, skippable: false, wait });
const moveRoute = (indent, target, r) => [C(205, indent, [target, r]), ...r.list.filter(c => c.code).map(c => C(505, indent, [c]))];

function imageField(image, tileset) {
    const canvas = h("canvas", { class: "evPageImage" });
    let cur = image;
    const btn = h("button", { type: "button", class: "evImageBtn" }, canvas);
    const draw = () => drawCharacterThumb(canvas, cur, tileset, 96);
    btn.addEventListener("click", async () => { const r = await characterDialog(cur, { tileset }); if (r) { cur = r; draw(); } });
    draw();
    return { el: btn, get: () => cur };
}
const DIR_OPTS = [{ value: 0, label: t("Retain", "Constants") }, { value: 2, label: t("Down", "Constants") }, { value: 4, label: t("Left", "Constants") }, { value: 6, label: t("Right", "Constants") }, { value: 8, label: t("Up", "Constants") }];
const FADE_OPTS = [{ value: 0, label: t("Black", "Constants") }, { value: 1, label: t("White", "Constants") }, { value: 2, label: t("None", "Constants") }];

// Abre o diálogo e devolve o evento pronto (sem id/x/y definitivos) ou null.
export async function quickEvent(kind, { mapId, x, y, tileset }) {
    const ev = TEMPLATE.event(0, x, y);
    const page = ev.pages[0];
    const here = { mapId, x, y };
    const title = { transfer: t("Transfer", "Dialog_QuickTransfer"), door: t("Door", "Dialog_QuickDoor"), treasure: t("Treasure", "Dialog_QuickTreasure"), inn: t("Inn", "Dialog_QuickInn") }[kind];
    let get;
    const ok = await dialog({
        title, width: "640px", height: "auto",
        build: b => {
            if (kind === "transfer") {
                const loc = locationPick(here.mapId, here.x, here.y); const dir = sel(DIR_OPTS, 0); const fade = sel(FADE_OPTS, 0);
                b.append(field(t("Location", "Dialog_QuickTransfer"), loc), row(field(t("Direction", "Dialog_QuickTransfer"), dir), field(t("Fade", "EventCommand201"), fade)));
                get = () => ({ loc: loc.get(), dir: dir.get(), fade: fade.get() });
            } else if (kind === "door") {
                const img = imageField({ characterName: "!Door1", characterIndex: 0, direction: 2, pattern: 0, tileId: 0 }, tileset);
                const loc = locationPick(here.mapId, here.x, here.y); const fade = sel(FADE_OPTS, 0);
                b.append(row(group(t("Image", "Constants"), img), h("div", null, field(t("Location", "Dialog_QuickDoor"), loc), field(t("Fade", "EventCommand201"), fade))));
                get = () => ({ img: img.get(), loc: loc.get(), fade: fade.get() });
            } else if (kind === "treasure") {
                const img = imageField({ characterName: "!Chest", characterIndex: 0, direction: 2, pattern: 0, tileId: 0 }, tileset);
                const gold = num(100, { min: 1, max: 9999999 });
                const it = sel(db.options("items"), 1), wp = sel(db.options("weapons"), 1), ar = sel(db.options("armors"), 1);
                const r = radios([{ label: t("Gold", "Dialog_QuickTreasure"), value: 0, controls: [gold] }, { label: t("Item", "Constants"), value: 1, controls: [it] }, { label: t("Weapon", "Constants"), value: 2, controls: [wp] }, { label: t("Armor", "Constants"), value: 3, controls: [ar] }], 1);
                b.append(row(group(t("Image", "Constants"), img), group(t("Content", "Dialog_QuickTreasure"), r)));
                get = () => ({ img: img.get(), kind: r.get(), gold: gold.get(), id: [0, it.get(), wp.get(), ar.get()][r.get()] });
            } else {
                const img = imageField({ characterName: "People1", characterIndex: 0, direction: 2, pattern: 1, tileId: 0 }, tileset);
                const price = num(50, { min: 0, max: 9999999 });
                b.append(row(group(t("Image", "Constants"), img), field(t("Price", "Dialog_QuickInn"), price)));
                get = () => ({ img: img.get(), price: price.get() });
            }
        },
        onOk: () => ({ v: get() })
    });
    if (!ok) { return null; }
    const v = ok.v;
    const L = [];
    if (kind === "transfer") {
        page.priorityType = 0; page.trigger = 1;
        L.push(C(250, 0, [se("Move1")]), C(201, 0, [0, v.loc.mapId, v.loc.x, v.loc.y, v.dir, v.fade]));
    } else if (kind === "door") {
        page.image = v.img; page.priorityType = 1; page.trigger = 0; page.directionFix = true; page.walkAnime = false;
        L.push(C(250, 0, [se("Open1")]),
            ...moveRoute(0, 0, route([[36], [17], [15, [3]], [18], [15, [3]], [19], [15, [3]], [35]])),
            ...moveRoute(0, -1, route([[37], [4], [38]])),
            C(201, 0, [0, v.loc.mapId, v.loc.x, v.loc.y, 0, v.fade]),
            ...moveRoute(0, 0, route([[36], [16], [35]], false)));
    } else if (kind === "treasure") {
        page.image = v.img; page.priorityType = 1; page.trigger = 0; page.directionFix = true; page.walkAnime = false;
        const lists = ["", "items", "weapons", "armors"];
        const obj = v.kind ? db[lists[v.kind]][v.id] : null;
        // Mesmas mensagens do editor original (%G vira \\G).
        const text = (v.kind === 0 ? t("%1%G were found!", "Dialog_QuickTreasure", v.gold) : t("%1 was found!", "Dialog_QuickTreasure", `\\I[${obj ? obj.iconIndex : 0}]${obj ? obj.name : ""}`)).replace(/%G/g, "\\G");
        L.push(C(250, 0, [se("Chest1")]),
            ...moveRoute(0, 0, route([[36], [17], [15, [3]], [18], [15, [3]], [19], [15, [3]], [35]])));
        if (v.kind === 0) { L.push(C(125, 0, [0, 0, v.gold])); }
        else { L.push(C(125 + v.kind, 0, v.kind === 1 ? [v.id, 0, 0, 1] : [v.id, 0, 0, 1, false])); }
        L.push(C(101, 0, ["", 0, 0, 2, ""]), C(401, 0, [text]), C(123, 0, ["A", 0]));
        const p2 = TEMPLATE.page();
        p2.conditions.selfSwitchValid = true; p2.conditions.selfSwitchCh = "A";
        p2.image = { ...v.img, direction: 8 };
        p2.priorityType = 1; p2.trigger = 0; p2.directionFix = true; p2.walkAnime = false;
        ev.pages.push(p2);
    } else {
        page.image = v.img; page.priorityType = 1; page.trigger = 0;
        const price = v.price;
        const yes = t("Yes", "BasicConstants"), no = t("No", "BasicConstants");
        L.push(C(101, 0, [v.img.characterName ? "" : "", 0, 0, 2, ""]),
            C(401, 0, [t("%1%G for one night. Would you like to stay?", "Dialog_QuickInn", price).replace(/%G/g, "\\G") + "\\$"]),
            C(102, 0, [[yes, no], 1, 0, 2, 0]),
            C(402, 0, [0, yes]),
            C(111, 1, [7, price, 0]),
            C(125, 2, [1, 0, price]),
            C(221, 2, []),
            C(249, 2, [se("Inn1")]),
            C(230, 2, [180]),
            C(314, 2, [0, 0]),
            C(222, 2, []),
            E(2),
            C(411, 1, []),
            C(101, 2, ["", 0, 0, 2, ""]),
            C(401, 2, [t("You don’t have enough money.", "Dialog_QuickInn")]),
            E(2),
            C(412, 1, []),
            E(1),
            C(402, 0, [1, no]),
            E(1),
            C(404, 0, []));
    }
    L.push(E(0));
    page.list = L;
    return ev;
}
