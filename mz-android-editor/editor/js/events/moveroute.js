// Editor de rota de movimento (Set Movement Route / movimento autônomo Custom), fiel ao MZ.
// Códigos = Game_Character.ROUTE_* do runtime (rmmz_objects.js).

import { db, clone } from "./data.js";
import { h, dialog, field, row, num, txt, sel, chk, switchPick, audioPick, audioText, charIndexPick, area, alertBox } from "./ui.js";

const SPEEDS = ["", "1: x8 Slower", "2: x4 Slower", "3: x2 Slower", "4: Normal", "5: x2 Faster", "6: x4 Faster"];
const FREQS = ["", "1: Lowest", "2: Lower", "3: Normal", "4: Higher", "5: Highest"];
const BLENDS = ["Normal", "Additive", "Multiply", "Screen"];

export const ROUTE_NAMES = {
    1: "Move Down", 2: "Move Left", 3: "Move Right", 4: "Move Up",
    5: "Move Lower Left", 6: "Move Lower Right", 7: "Move Upper Left", 8: "Move Upper Right",
    9: "Move at Random", 10: "Move toward Player", 11: "Move away from Player",
    12: "1 Step Forward", 13: "1 Step Backward", 14: "Jump", 15: "Wait",
    16: "Turn Down", 17: "Turn Left", 18: "Turn Right", 19: "Turn Up",
    20: "Turn 90° Right", 21: "Turn 90° Left", 22: "Turn 180°", 23: "Turn 90° Right or Left",
    24: "Turn at Random", 25: "Turn toward Player", 26: "Turn away from Player",
    27: "Switch ON", 28: "Switch OFF", 29: "Speed", 30: "Frequency",
    31: "Walking Animation ON", 32: "Walking Animation OFF", 33: "Stepping Animation ON", 34: "Stepping Animation OFF",
    35: "Direction Fix ON", 36: "Direction Fix OFF", 37: "Through ON", 38: "Through OFF",
    39: "Transparent ON", 40: "Transparent OFF", 41: "Image", 42: "Opacity", 43: "Blend Mode",
    44: "SE", 45: "Script"
};

// Layout dos botões em 3 colunas como no diálogo original.
const BUTTONS = [
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    [16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30],
    [31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45]
];
const BUTTON_LABELS = { 14: "Jump…", 15: "Wait…", 27: "Switch ON…", 28: "Switch OFF…", 29: "Change Speed…", 30: "Change Frequency…", 41: "Change Image…", 42: "Change Opacity…", 43: "Change Blend Mode…", 44: "Play SE…", 45: "Script…" };

const sign = n => (n >= 0 ? "+" : "") + n;

export function routeText(c) {
    const p = c.parameters || [];
    const n = ROUTE_NAMES[c.code];
    if (!c.code) { return ""; }
    switch (c.code) {
        case 14: return `Jump：${sign(p[0])},${sign(p[1])}`;
        case 15: return `Wait：${p[0]} frames`;
        case 27: case 28: return `${n}：#${db.pad(p[0])} ${db.switchName(p[0])}`;
        case 29: return `Speed：${p[0]}`;
        case 30: return `Frequency：${p[0]}`;
        case 41: return `Image：${p[0] ? p[0] + "(" + p[1] + ")" : "None"}`;
        case 42: return `Opacity：${p[0]}`;
        case 43: return `Blend Mode：${BLENDS[p[0]] || p[0]}`;
        case 44: return `SE：${audioText(p[0])}`;
        case 45: return `Script：${p[0]}`;
        default: return n || "?" + c.code;
    }
}

function paramDialog(code, params) {
    const p = clone(params) || [];
    let get;
    const title = (BUTTON_LABELS[code] || ROUTE_NAMES[code]).replace("…", "");
    const build = b => {
        switch (code) {
            case 14: {
                const x = num(p[0] || 0, { min: -100, max: 100 }), y = num(p[1] || 0, { min: -100, max: 100 });
                b.append(row(field("X:", x), field("Y:", y)));
                get = () => [x.get(), y.get()];
                break;
            }
            case 15: { const w = num(p[0] || 60, { min: 1, max: 999 }); b.append(field("Duration:", w, " frames (1/60 sec)")); get = () => [w.get()]; break; }
            case 27: case 28: { const s = switchPick(p[0] || 1); b.append(field("Switch:", s)); get = () => [s.get()]; break; }
            case 29: { const s = sel(SPEEDS.map((l, i) => ({ value: i, label: l })).slice(1), p[0] || 4); b.append(field("Speed:", s)); get = () => [s.get()]; break; }
            case 30: { const s = sel(FREQS.map((l, i) => ({ value: i, label: l })).slice(1), p[0] || 3); b.append(field("Frequency:", s)); get = () => [s.get()]; break; }
            case 41: { const s = charIndexPick(p[0] || "", p[1] || 0); b.append(field("Image:", s)); get = () => { const v = s.get(); return [v.name, v.index]; }; break; }
            case 42: { const s = num(p[0] === undefined ? 255 : p[0], { min: 0, max: 255 }); b.append(field("Opacity:", s)); get = () => [s.get()]; break; }
            case 43: { const s = sel(BLENDS.map((l, i) => ({ value: i, label: l })), p[0] || 0); b.append(field("Blend Mode:", s)); get = () => [s.get()]; break; }
            case 44: { const s = audioPick("se", p[0] || { name: "", volume: 90, pitch: 100, pan: 0 }); b.append(field("SE:", s)); get = () => [s.get()]; break; }
            case 45: { const s = area(p[0] || "", { rows: 4, mono: true }); b.append(field("Script:", s)); get = () => [s.get()]; break; }
        }
    };
    return dialog({ title, width: "520px", height: "auto", build, onOk: () => ({ v: get() }) }).then(r => r ? r.v : null);
}

export function routeNeedsParams(code) { return !!BUTTON_LABELS[code]; }

// Abre o diálogo "Movement Route". opts.target: valor do personagem (ou undefined para rota do evento)
// opts.targets: opções [{value,label}] para o seletor de alvo; opts.showWait: mostra "Wait for Completion".
export function moveRouteDialog(route, { target, targets, showWait = true, title = "Movement Route" } = {}) {
    const r = clone(route) || { list: [{ code: 0, parameters: [] }], repeat: false, skippable: false, wait: true };
    if (!r.list.length || r.list[r.list.length - 1].code !== 0) { r.list.push({ code: 0, parameters: [] }); }
    let selected = r.list.length - 1;
    let clip = null;
    let targetSel = null, repeat, skip, wait;
    return dialog({
        title, width: "1180px", height: "94vh",
        build: body => {
            const list = h("div", { class: "evList evRouteList" });
            const render = () => {
                list.innerHTML = "";
                r.list.forEach((c, i) => {
                    const it = h("div", { class: "evListItem" + (i === selected ? " selected" : "") }, "◇" + routeText(c));
                    it.addEventListener("click", () => { selected = i; render(); });
                    it.addEventListener("dblclick", () => editAt(i));
                    list.append(it);
                });
                const s = list.querySelector(".selected");
                if (s) { s.scrollIntoView({ block: "nearest" }); }
            };
            const insert = async code => {
                let params = [];
                if (routeNeedsParams(code)) {
                    params = await paramDialog(code, null);
                    if (!params) { return; }
                }
                r.list.splice(selected, 0, { code, parameters: params });
                selected++;
                render();
            };
            const editAt = async i => {
                const c = r.list[i];
                if (!c.code || !routeNeedsParams(c.code)) { return; }
                const p = await paramDialog(c.code, c.parameters);
                if (p) { c.parameters = p; render(); }
            };
            const left = h("div", { class: "evRouteLeft" });
            if (targets) {
                targetSel = sel(targets, target);
                left.append(field("Character:", targetSel));
            }
            left.append(list, h("div", { class: "evRow evListTools" },
                h("button", { type: "button", class: "evBtn", onclick: () => editAt(selected) }, "Edit"),
                h("button", { type: "button", class: "evBtn", onclick: () => { if (r.list[selected].code) { clip = clone(r.list[selected]); } } }, "Copy"),
                h("button", { type: "button", class: "evBtn", onclick: () => { if (clip) { r.list.splice(selected, 0, clone(clip)); selected++; render(); } } }, "Paste"),
                h("button", { type: "button", class: "evBtn", onclick: () => { if (r.list[selected].code) { r.list.splice(selected, 1); render(); } } }, "Delete"),
                h("button", { type: "button", class: "evBtn", onclick: () => { r.list = [{ code: 0, parameters: [] }]; selected = 0; render(); } }, "Clear")));
            repeat = chk("Repeat Movements", r.repeat);
            skip = chk("Skip If Cannot Move", r.skippable);
            wait = chk("Wait for Completion", r.wait);
            left.append(h("fieldset", { class: "evGroup" }, h("legend", null, "Options"), repeat.el, skip.el, showWait ? wait.el : null));
            const cmds = h("fieldset", { class: "evGroup evRouteCmds" }, h("legend", null, "Movement Commands"));
            const grid = h("div", { class: "evRouteGrid" });
            for (const colCodes of BUTTONS) {
                const c = h("div", { class: "evRouteCol" });
                for (const code of colCodes) {
                    c.append(h("button", { type: "button", class: "evBtn evRouteBtn", onclick: () => insert(code) }, BUTTON_LABELS[code] || ROUTE_NAMES[code]));
                }
                grid.append(c);
            }
            cmds.append(grid);
            body.append(h("div", { class: "evRouteWrap" }, left, cmds));
            render();
        },
        onOk: () => {
            r.repeat = repeat.get(); r.skippable = skip.get(); r.wait = showWait ? wait.get() : false;
            return { v: { route: r, target: targetSel ? targetSel.get() : target } };
        }
    }).then(x => x ? x.v : null);
}
