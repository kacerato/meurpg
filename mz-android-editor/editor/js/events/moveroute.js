// Editor de rota de movimento (Set Movement Route / movimento autônomo Custom), fiel ao MZ.
// Códigos = Game_Character.ROUTE_* do runtime (rmmz_objects.js).

import { db, clone } from "./data.js";
import { h, dialog, field, row, num, txt, sel, chk, switchPick, audioPick, audioText, charIndexPick, area, alertBox, getApi } from "./ui.js";
import { MiniMap } from "./minimap.js";
import { t } from "../i18n.js";

const SPEEDS = ["", t("1: x8 Slower", "MovementSpeedBox"), t("2: x4 Slower", "MovementSpeedBox"), t("3: x2 Slower", "MovementSpeedBox"), t("4: Normal", "MovementSpeedBox"), t("5: x2 Faster", "MovementSpeedBox"), t("6: x4 Faster", "MovementSpeedBox")];
const FREQS = ["", t("1: Lowest", "MovementFrequencyBox"), t("2: Lower", "MovementFrequencyBox"), t("3: Normal", "MovementFrequencyBox"), t("4: Higher", "MovementFrequencyBox"), t("5: Highest", "MovementFrequencyBox")];
const BLENDS = [t("Normal", "Constants"), t("Additive", "Constants"), t("Multiply", "Constants"), t("Screen", "Constants")];

export const ROUTE_NAMES = {
    1: t("Move Down", "MovementCommands"), 2: t("Move Left", "MovementCommands"), 3: t("Move Right", "MovementCommands"), 4: t("Move Up", "MovementCommands"),
    5: t("Move Lower Left", "MovementCommands"), 6: t("Move Lower Right", "MovementCommands"), 7: t("Move Upper Left", "MovementCommands"), 8: t("Move Upper Right", "MovementCommands"),
    9: t("Move at Random", "MovementCommands"), 10: t("Move toward Player", "MovementCommands"), 11: t("Move away from Player", "MovementCommands"),
    12: t("1 Step Forward", "MovementCommands"), 13: t("1 Step Backward", "MovementCommands"), 14: t("Jump", "MovementCommands"), 15: t("Wait", "MovementCommands"),
    16: t("Turn Down", "MovementCommands"), 17: t("Turn Left", "MovementCommands"), 18: t("Turn Right", "MovementCommands"), 19: t("Turn Up", "MovementCommands"),
    20: t("Turn 90° Right", "MovementCommands"), 21: t("Turn 90° Left", "MovementCommands"), 22: t("Turn 180°", "MovementCommands"), 23: t("Turn 90° Right or Left", "MovementCommands"),
    24: t("Turn at Random", "MovementCommands"), 25: t("Turn toward Player", "MovementCommands"), 26: t("Turn away from Player", "MovementCommands"),
    27: t("Switch ON", "MovementCommands"), 28: t("Switch OFF", "MovementCommands"), 29: t("Speed", "MovementCommands"), 30: t("Frequency", "MovementCommands"),
    31: t("Walking Animation ON", "MovementCommands"), 32: t("Walking Animation OFF", "MovementCommands"), 33: t("Stepping Animation ON", "MovementCommands"), 34: t("Stepping Animation OFF", "MovementCommands"),
    35: t("Direction Fix ON", "MovementCommands"), 36: t("Direction Fix OFF", "MovementCommands"), 37: t("Through ON", "MovementCommands"), 38: t("Through OFF", "MovementCommands"),
    39: t("Transparent ON", "MovementCommands"), 40: t("Transparent OFF", "MovementCommands"), 41: t("Image", "MovementCommands"), 42: t("Opacity", "MovementCommands"), 43: t("Blend Mode", "MovementCommands"),
    44: t("SE", "MovementCommands"), 45: t("Script", "MovementCommands")
};

// Layout dos botões em 3 colunas como no diálogo original.
const BUTTONS = [
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    [16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30],
    [31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45]
];
const BUTTON_LABELS = { 14: t("Jump", "MovementCommands") + "…", 15: t("Wait", "MovementCommands") + "…", 27: t("Switch ON", "MovementCommands") + "…", 28: t("Switch OFF", "MovementCommands") + "…", 29: t("Change Speed", "MovementCommands") + "…", 30: t("Change Frequency", "MovementCommands") + "…", 41: t("Change Image", "MovementCommands") + "…", 42: t("Change Opacity", "MovementCommands") + "…", 43: t("Change Blend Mode", "MovementCommands") + "…", 44: t("Play SE", "MovementCommands") + "…", 45: t("Script", "MovementCommands") + "…" };

const sign = n => (n >= 0 ? "+" : "") + n;

export function routeText(c) {
    const p = c.parameters || [];
    const n = ROUTE_NAMES[c.code];
    if (!c.code) { return ""; }
    switch (c.code) {
        case 14: return `${t("Jump", "MovementCommands")}：${sign(p[0])},${sign(p[1])}`;
        case 15: return `${t("Wait", "MovementCommands")}：${t(p[0] === 1 ? "%1 frame" : "%1 frames", "Constants", p[0])}`;
        case 27: case 28: return `${n}：#${db.pad(p[0])} ${db.switchName(p[0])}`;
        case 29: return `${t("Speed", "MovementCommands")}：${p[0]}`;
        case 30: return `${t("Frequency", "MovementCommands")}：${p[0]}`;
        case 41: return `${t("Image", "MovementCommands")}：${p[0] ? p[0] + "(" + p[1] + ")" : t("None", "Constants")}`;
        case 42: return `${t("Opacity", "MovementCommands")}：${p[0]}`;
        case 43: return `${t("Blend Mode", "MovementCommands")}：${BLENDS[p[0]] || p[0]}`;
        case 44: return `${t("SE", "MovementCommands")}：${audioText(p[0])}`;
        case 45: return `${t("Script", "MovementCommands")}：${p[0]}`;
        default: return n || t("Undefined Command", "MovementCommands");
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
                b.append(row(field(t("X", "MovementCommand14"), x), field(t("Y", "MovementCommand14"), y)));
                get = () => [x.get(), y.get()];
                break;
            }
            case 15: { const w = num(p[0] || 60, { min: 1, max: 999 }); b.append(field(t("Duration", "Group_Duration"), w, " " + t("frames (1/60 sec)", "Group_Duration"))); get = () => [w.get()]; break; }
            case 27: case 28: { const s = switchPick(p[0] || 1); b.append(field(t("Switch", "Constants"), s)); get = () => [s.get()]; break; }
            case 29: { const s = sel(SPEEDS.map((l, i) => ({ value: i, label: l })).slice(1), p[0] || 4); b.append(field(t("Speed", "MovementSpeedBox"), s)); get = () => [s.get()]; break; }
            case 30: { const s = sel(FREQS.map((l, i) => ({ value: i, label: l })).slice(1), p[0] || 3); b.append(field(t("Frequency", "MovementFrequencyBox"), s)); get = () => [s.get()]; break; }
            case 41: { const s = charIndexPick(p[0] || "", p[1] || 0); b.append(field(t("Image", "MovementCommand41"), s)); get = () => { const v = s.get(); return [v.name, v.index]; }; break; }
            case 42: { const s = num(p[0] === undefined ? 255 : p[0], { min: 0, max: 255 }); b.append(field(t("Opacity", "MovementCommand42"), s)); get = () => [s.get()]; break; }
            case 43: { const s = sel(BLENDS.map((l, i) => ({ value: i, label: l })), p[0] || 0); b.append(field(t("Blend Mode", "MovementCommand43"), s)); get = () => [s.get()]; break; }
            case 44: { const s = audioPick("se", p[0] || { name: "", volume: 90, pitch: 100, pan: 0 }); b.append(field(t("SE", "MovementCommands"), s)); get = () => [s.get()]; break; }
            case 45: { const s = area(p[0] || "", { rows: 4, mono: true }); b.append(field(t("Script", "MovementCommand45"), s)); get = () => [s.get()]; break; }
        }
    };
    return dialog({ title, width: "520px", height: "auto", build, onOk: () => ({ v: get() }) }).then(r => r ? r.v : null);
}

export function routeNeedsParams(code) { return !!BUTTON_LABELS[code]; }

// Abre o diálogo "Movement Route". opts.target: valor do personagem (ou undefined para rota do evento)
// opts.targets: opções [{value,label}] para o seletor de alvo; opts.showWait: mostra "Wait for Completion".
// opts.previewStart(target) -> {mapId, x, y, d} | null: posição inicial para a prévia desenhada no mapa.
export function moveRouteDialog(route, { target, targets, showWait = true, title = t("Movement Route", "Dialog_MovementRoute"), previewStart } = {}) {
    const r = clone(route) || { list: [{ code: 0, parameters: [] }], repeat: false, skippable: false, wait: true };
    if (!r.list.length || r.list[r.list.length - 1].code !== 0) { r.list.push({ code: 0, parameters: [] }); }
    let selected = r.list.length - 1;
    let clip = null;
    let targetSel = null, repeat, skip, wait;
    let mini = null;
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
                updatePreview();
            };
            // ---- prévia no mapa ----
            const pvHost = h("div", { class: "evRoutePvHost" });
            const pvInfo = h("div", { class: "evDesc" });
            let pvStart = null, pvMapId = 0, anim = null;
            const updatePreview = async recenter => {
                if (!previewStart) { return; }
                const st = await previewStart(targetSel ? targetSel.get() : target);
                if (!st) { pvInfo.textContent = t("No known position for the preview."); if (mini) { mini.layer.removeChildren(); } return; }
                if (!mini) { mini = new MiniMap(pvHost, { zoom: 0.75 }); }
                if (pvMapId !== st.mapId) { pvMapId = st.mapId; await mini.load(getApi(), st.mapId); recenter = true; }
                pvStart = st;
                const steps = simulateRoute(r.list, st);
                drawRoute(mini.layer, steps, repeat ? repeat.get() : r.repeat, selected);
                if (recenter) { mini.centerOn(st.x, st.y); }
                const end = steps[steps.length - 1];
                pvInfo.textContent = `(${st.x},${st.y}) → (${end.x},${end.y})`;
            };
            const playPreview = () => {
                if (!mini || !pvStart) { return; }
                if (anim) { mini.app.ticker.remove(anim); anim = null; }
                const steps = simulateRoute(r.list, pvStart);
                const dot = new PIXI.Graphics().lineStyle(2, 0x000000).beginFill(0xffff00).drawCircle(0, 0, 10).endFill();
                mini.layer.addChild(dot);
                let t = 0;
                anim = () => {
                    t += 1 / 12;
                    const i = Math.floor(t);
                    if (i >= steps.length - 1) { mini.app.ticker.remove(anim); anim = null; dot.destroy(); return; }
                    const a = steps[i], b = steps[i + 1], f = t - i;
                    const lift = b.kind === "jump" ? Math.sin(f * Math.PI) * 30 : 0;
                    dot.position.set((a.x + (b.x - a.x) * f + 0.5) * 48, (a.y + (b.y - a.y) * f + 0.5) * 48 - lift);
                };
                mini.app.ticker.add(anim);
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
                targetSel.onChange(() => updatePreview(true));
                left.append(field(t("Character", "Constants"), targetSel));
            }
            left.append(list, h("div", { class: "evRow evListTools" },
                h("button", { type: "button", class: "evBtn", onclick: () => editAt(selected) }, t("Edit", "StandardPopupMenu")),
                h("button", { type: "button", class: "evBtn", onclick: () => { if (r.list[selected].code) { clip = clone(r.list[selected]); } } }, t("Copy", "BasicConstants")),
                h("button", { type: "button", class: "evBtn", onclick: () => { if (clip) { r.list.splice(selected, 0, clone(clip)); selected++; render(); } } }, t("Paste", "BasicConstants")),
                h("button", { type: "button", class: "evBtn", onclick: () => { if (r.list[selected].code) { r.list.splice(selected, 1); render(); } } }, t("Delete", "BasicConstants")),
                h("button", { type: "button", class: "evBtn", onclick: () => { r.list = [{ code: 0, parameters: [] }]; selected = 0; render(); } }, t("Clear", "BasicConstants"))));
            repeat = chk(t("Repeat Movements", "Layout_MovementRoute"), r.repeat);
            skip = chk(t("Skip If Cannot Move", "Layout_MovementRoute"), r.skippable);
            wait = chk(t("Wait for Completion", "Layout_MovementRoute"), r.wait);
            repeat.onChange(() => updatePreview());
            left.append(h("fieldset", { class: "evGroup" }, h("legend", null, t("Options", "Layout_MovementRoute")), repeat.el, skip.el, showWait ? wait.el : null));
            const cmds = h("fieldset", { class: "evGroup evRouteCmds" }, h("legend", null, t("Movement Commands", "Layout_MovementRoute")));
            const grid = h("div", { class: "evRouteGrid" });
            for (const colCodes of BUTTONS) {
                const c = h("div", { class: "evRouteCol" });
                for (const code of colCodes) {
                    c.append(h("button", { type: "button", class: "evBtn evRouteBtn", onclick: () => insert(code) }, BUTTON_LABELS[code] || ROUTE_NAMES[code]));
                }
                grid.append(c);
            }
            cmds.append(grid);
            const center = previewStart ? h("div", { class: "evRouteCenter" },
                h("div", { class: "evRow" }, h("span", { class: "evContentsTitle" }, t("Preview", "Constants")),
                    h("button", { type: "button", class: "evBtn", onclick: playPreview }, "▶ " + t("Preview", "Constants"))),
                pvHost, pvInfo) : null;
            body.append(h("div", { class: "evRouteWrap" + (center ? " withPreview" : "") }, left, center, cmds));
            render();
            requestAnimationFrame(() => updatePreview(true));
        },
        onOk: () => {
            r.repeat = repeat.get(); r.skippable = skip.get(); r.wait = showWait ? wait.get() : false;
            return { v: { route: r, target: targetSel ? targetSel.get() : target } };
        }
    }).then(x => { if (mini) { mini.destroy(); mini = null; } return x ? x.v : null; });
}

// ---------- simulação e desenho da prévia ----------
const DX = { 2: 0, 4: -1, 6: 1, 8: 0 }, DY = { 2: 1, 4: 0, 6: 0, 8: -1 };
const TURN_R = { 2: 4, 4: 8, 6: 2, 8: 6 }, TURN_L = { 2: 6, 4: 2, 6: 8, 8: 4 };
const DIAG = { 5: [-1, 1, 4], 6: [1, 1, 6], 7: [-1, -1, 4], 8: [1, -1, 6] };

// Percorre a rota a partir de start {x, y, d} sem checar passabilidade (a prévia não tem o estado
// do jogo): devolve passos {x, y, d, kind, index}. Movimentos aleatórios/para o jogador viram "?".
export function simulateRoute(list, start) {
    let { x, y } = start;
    let d = start.d || 2;
    let fix = !!start.directionFix;
    const steps = [{ x, y, d, kind: "start", index: -1 }];
    list.forEach((c, index) => {
        const p = c.parameters || [];
        const push = kind => steps.push({ x, y, d, kind, index });
        switch (c.code) {
            case 1: case 2: case 3: case 4: {
                const dir = [2, 4, 6, 8][c.code - 1];
                if (!fix) { d = dir; }
                x += DX[dir]; y += DY[dir]; push("move"); break;
            }
            case 5: case 6: case 7: case 8: {
                const [dx, dy, hd] = DIAG[c.code];
                if (!fix && d === 10 - hd) { d = hd; }
                x += dx; y += dy; push("move"); break;
            }
            case 9: case 10: case 11: case 23: case 24: case 25: case 26: push("random"); break;
            case 12: x += DX[d]; y += DY[d]; push("move"); break;
            case 13: x -= DX[d]; y -= DY[d]; push("move"); break;
            case 14: {
                const dx = p[0] || 0, dy = p[1] || 0;
                if (!fix) { if (Math.abs(dx) > Math.abs(dy)) { if (dx) { d = dx < 0 ? 4 : 6; } } else if (dy) { d = dy < 0 ? 8 : 2; } }
                x += dx; y += dy; push("jump"); break;
            }
            case 15: push("wait"); break;
            case 16: case 17: case 18: case 19: if (!fix) { d = [2, 4, 6, 8][c.code - 16]; } push("turn"); break;
            case 20: if (!fix) { d = TURN_R[d]; } push("turn"); break;
            case 21: if (!fix) { d = TURN_L[d]; } push("turn"); break;
            case 22: if (!fix) { d = 10 - d; } push("turn"); break;
            case 35: fix = true; break;
            case 36: fix = false; break;
        }
    });
    return steps;
}

function arrowHead(g, x1, y1, x2, y2, color) {
    const a = Math.atan2(y2 - y1, x2 - x1), s = 13;
    g.lineStyle(0).beginFill(color, 1);
    g.moveTo(x2, y2);
    g.lineTo(x2 - s * Math.cos(a - 0.45), y2 - s * Math.sin(a - 0.45));
    g.lineTo(x2 - s * Math.cos(a + 0.45), y2 - s * Math.sin(a + 0.45));
    g.closePath();
    g.endFill();
}

// Desenha a rota: moldura azul no início, setas vermelhas por passo (a do comando selecionado em
// amarelo), arco para saltos, "?" para passos imprevisíveis, moldura branca no fim e tracejado
// de volta ao início quando "Repeat Movements".
export function drawRoute(layer, steps, repeat, selectedIndex) {
    for (const c of layer.removeChildren()) { c.destroy(); }
    const g = new PIXI.Graphics();
    layer.addChild(g);
    const C = v => (v + 0.5) * 48;
    const st = steps[0];
    g.lineStyle(3, 0x2a6cff, 1).drawRect(st.x * 48 + 2, st.y * 48 + 2, 44, 44);
    for (let i = 1; i < steps.length; i++) {
        const a = steps[i - 1], b = steps[i];
        const color = b.index === selectedIndex - 1 ? 0xffff00 : 0xff3030;
        if (b.kind === "move" || b.kind === "jump") {
            const x1 = C(a.x), y1 = C(a.y), x2 = C(b.x), y2 = C(b.y);
            const len = Math.hypot(x2 - x1, y2 - y1) || 1;
            const ex = x2 - (x2 - x1) / len * 10, ey = y2 - (y2 - y1) / len * 10;
            if (b.kind === "jump") {
                const mx = (x1 + x2) / 2, my = Math.min(y1, y2) - 40 - len / 4;
                g.lineStyle(6, 0x000000, 0.45).moveTo(x1, y1).quadraticCurveTo(mx, my, ex, ey);
                g.lineStyle(3, color, 1).moveTo(x1, y1).quadraticCurveTo(mx, my, ex, ey);
                arrowHead(g, mx, my, x2, y2, color);
            } else {
                g.lineStyle(6, 0x000000, 0.45).moveTo(x1, y1).lineTo(ex, ey);
                g.lineStyle(3, color, 1).moveTo(x1, y1).lineTo(ex, ey);
                arrowHead(g, x1, y1, x2, y2, color);
            }
        } else if (b.kind === "turn") {
            g.lineStyle(1, 0x000000, 1).beginFill(0xffffff, 1).drawCircle(C(b.x) + DX[b.d] * 16, C(b.y) + DY[b.d] * 16, 5).endFill();
        } else if (b.kind === "random" || b.kind === "wait") {
            const t = new PIXI.Text(b.kind === "random" ? "?" : "…", { fontSize: 22, fill: 0xffffff, stroke: 0x000000, strokeThickness: 4, fontWeight: "bold" });
            t.anchor.set(0.5, 0.5);
            t.position.set(C(b.x) + 14, C(b.y) - 14);
            layer.addChild(t);
        }
    }
    const end = steps[steps.length - 1];
    g.lineStyle(3, 0xffffff, 1).drawRect(end.x * 48 + 6, end.y * 48 + 6, 36, 36);
    if (repeat && (end.x !== st.x || end.y !== st.y)) {
        const x1 = C(end.x), y1 = C(end.y), x2 = C(st.x), y2 = C(st.y);
        const n = Math.max(2, Math.floor(Math.hypot(x2 - x1, y2 - y1) / 12));
        g.lineStyle(2, 0xffffff, 0.85);
        for (let i = 0; i < n; i += 2) {
            g.moveTo(x1 + (x2 - x1) * i / n, y1 + (y2 - y1) * i / n).lineTo(x1 + (x2 - x1) * (i + 1) / n, y1 + (y2 - y1) * (i + 1) / n);
        }
    }
}
