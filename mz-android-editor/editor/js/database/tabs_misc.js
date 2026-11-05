// Abas Animations, Tilesets e Common Events.
import { el, num, text, area, sel, chk, fld, grp, grid, btn, tableList, modal, changed } from "./ui.js";
import { switchOptions } from "./common.js";
import { listFiles, pickImage, pickColor, audioField, audioText, loadImage } from "./pickers.js";
import { cols, noteGroup } from "./tabs_actors.js";
import { commandList } from "./eventlist.js";
import { previewGroup } from "./animpreview.js";
import { changeBattleback } from "./tabs_battle.js";
import { t } from "../i18n.js";

// ------------------------------------------------------------------ Animations

async function pickEffect(current) {
    const names = await listFiles("effects", ["efkefc"]);
    let value = current;
    const ok = await modal({
        title: t("Select an Effect", "Dialog_EffectSelector"), width: "520px", height: "520px",
        build: b => {
            const list = el("div", { class: "dbPickList full" });
            for (const n of ["", ...names]) {
                const r = el("div", { class: "dbPickItem" + (n === current ? " sel" : ""), text: n || "(" + t("None", "Constants") + ")" });
                r.addEventListener("click", () => { list.querySelectorAll(".sel").forEach(x => x.classList.remove("sel")); r.classList.add("sel"); value = n; });
                list.appendChild(r);
            }
            b.appendChild(list);
            requestAnimationFrame(() => { const s = list.querySelector(".sel"); if (s) { s.scrollIntoView({ block: "center" }); } });
        }
    });
    return ok ? value : null;
}

async function editSoundTiming(tq) {
    const o = tq ? structuredClone(tq) : { frame: 0, se: { name: "", pan: 0, pitch: 100, volume: 90 } };
    const ok = await modal({
        title: t("Sound", "Dialog_AnimationSound"), width: "520px",
        build: b => b.appendChild(grid(2, fld(t("Frame", "Dialog_AnimationSound") + ":", num(o, "frame", { min: 0, max: 9999 })), fld(t("Filename", "Dialog_AnimationSound") + ":", audioField(o, "se", "se"))))
    });
    return ok ? o : null;
}

async function editFlashTiming(tq) {
    const o = tq ? structuredClone(tq) : { frame: 0, duration: 30, color: [255, 255, 255, 170] };
    const ok = await modal({
        title: t("Flash", "Dialog_AnimationFlash"), width: "560px",
        build: b => {
            const colorBtn = btn("", async () => {
                const c = await pickColor(o.color, "color");
                if (c) { o.color = c; paint(); }
            }, "dbPickBtn");
            const paint = () => {
                colorBtn.textContent = o.color.join(", ");
                colorBtn.style.background = `rgba(${o.color[0]},${o.color[1]},${o.color[2]},${o.color[3] / 255})`;
            };
            paint();
            b.appendChild(grid(3, fld(t("Frame", "Dialog_AnimationFlash") + ":", num(o, "frame", { min: 0, max: 9999 })),
                fld(t("Duration", "Dialog_AnimationFlash") + ":", num(o, "duration", { min: 1, max: 999 })), fld(t("Color", "Dialog_AnimationFlash") + ":", colorBtn)));
        }
    });
    return ok ? o : null;
}

export const animationsTab = {
    id: "animations", label: t("Animations", "DatabaseMain"), desc: t("Data used for various visual effects.", "DatabaseMain"), file: "Animations", max: 1000,
    form(ctx, a, host) {
        const [left, right] = cols(host);
        if (!a.rotation) { a.rotation = { x: 0, y: 0, z: 0 }; }
        if (!a.soundTimings) { a.soundTimings = []; }
        if (!a.flashTimings) { a.flashTimings = []; }
        left.appendChild(grp(t("General Settings", "Constants"), grid(2,
            fld(t("Name", "Constants") + ":", text(a, "name", { onInput: () => ctx.refreshRow() })),
            fld(t("Display Type", "Layout_MZAnimationEdit") + ":", sel(a, "displayType", [[0, t("For each target", "Layout_MZAnimationEdit")], [1, t("Center of all targets", "Layout_MZAnimationEdit")], [2, t("Center of the screen", "Layout_MZAnimationEdit")]], { number: true })))));
        const fileBtn = btn(a.effectName || "(" + t("None", "Constants") + ")", async () => {
            const r = await pickEffect(a.effectName);
            if (r !== null) { a.effectName = r; fileBtn.textContent = r || "(" + t("None", "Constants") + ")"; changed(); }
        }, "dbPickBtn");
        left.appendChild(grp(t("Particle Effect", "Layout_MZAnimationEdit"), grid(3,
            fld(t("Filename", "Layout_MZAnimationEdit") + ":", fileBtn, { span: 3 }),
            fld(t("Scale", "Layout_MZAnimationEdit") + ":", [num(a, "scale", { min: 0, max: 1000 }), "%"]),
            fld(t("Speed", "Layout_MZAnimationEdit") + ":", [num(a, "speed", { min: 1, max: 1000 }), "%"]),
            el("div"),
            fld(t("Rotation", "Layout_MZAnimationEdit") + " " + t("X", "Dialog_EffectRotation") + ":", num(a.rotation, "x", { min: -360, max: 360 })),
            fld(t("Rotation", "Layout_MZAnimationEdit") + " " + t("Y", "Dialog_EffectRotation") + ":", num(a.rotation, "y", { min: -360, max: 360 })),
            fld(t("Rotation", "Layout_MZAnimationEdit") + " " + t("Z", "Dialog_EffectRotation") + ":", num(a.rotation, "z", { min: -360, max: 360 })),
            fld(t("Offset X", "Layout_MZAnimationEdit") + ":", num(a, "offsetX", { min: -9999, max: 9999 })),
            fld(t("Offset Y", "Layout_MZAnimationEdit") + ":", num(a, "offsetY", { min: -9999, max: 9999 })))));
        left.appendChild(grp(t("Preview", "Constants"), ...previewGroup(ctx.db, a, async db => {
            const ok = await changeBattleback(db);
            if (ok) { ctx.touch("System"); }
            return ok;
        }, () => ctx.touch("System"))));
        right.appendChild(grp(t("Sound", "Group_AnimationSound"), tableList({
            columns: [{ title: t("Frame", "Group_AnimationSound"), width: "70px" }, { title: t("Filename", "Group_AnimationSound"), width: "1fr" }],
            items: a.soundTimings,
            cells: s => [String(s.frame), audioText(s.se)],
            create: () => editSoundTiming(null),
            edit: s => editSoundTiming(s),
            clipKey: "sound"
        })));
        right.appendChild(grp(t("Flash", "Group_AnimationFlash"), tableList({
            columns: [{ title: t("Frame", "Group_AnimationFlash"), width: "70px" }, { title: t("Duration", "Group_AnimationFlash"), width: "80px" }, { title: t("Color", "Group_AnimationFlash"), width: "1fr" }],
            items: a.flashTimings,
            cells: f => {
                const sw = el("span", { class: "dbSwatch" });
                sw.style.background = `rgba(${f.color[0]},${f.color[1]},${f.color[2]},${f.color[3] / 255})`;
                return [String(f.frame), String(f.duration), el("span", null, sw, " " + f.color.join(", "))];
            },
            create: () => editFlashTiming(null),
            edit: f => editFlashTiming(f),
            clipKey: "flash"
        })));
    }
};

// ------------------------------------------------------------------ Tilesets

const T = 48;
const SLOT_NAMES = ["A1", "A2", "A3", "A4", "A5", "B", "C", "D", "E"];
const MODES = [["passage", t("Passage", "Edit_Tilesets")], ["passage4", t("Passage (4 dir)", "Edit_Tilesets")], ["ladder", t("Ladder", "Edit_Tilesets")],
    ["bush", t("Bush", "Edit_Tilesets")], ["counter", t("Counter", "Edit_Tilesets")], ["damage", t("Damage Floor", "Edit_Tilesets")], ["terrain", t("Terrain Tag", "Edit_Tilesets")]];
const BIT = { ladder: 0x20, bush: 0x40, counter: 0x80, damage: 0x100 };
const ui = { tab: 0, mode: "passage" };

// Bits de veículo (0x200 barco, 0x400 navio, 0x800 pouso de aeronave), recalculados como o MZ:
// A1 bloco A (mar) e D (água) navegáveis por barco/navio, B (mar profundo) só navio, C e E nenhum;
// tile transitável (passagem ≠ ×) bloqueia barco/navio; aeronave não pousa em A1, A3, A4, nem em
// A2 intransitável ou com Bush. Só nas folhas que têm imagem (conferido com os 6 tilesets do
// template: 34048/34048 tiles idênticos).
function slotOfTile(id) {
    if (id < 1024) { return 5 + Math.floor(id / 256); }
    if (id < 1536) { return -1; }
    if (id < 2048) { return 4; }
    if (id < 2816) { return 0; }
    if (id < 4352) { return 1; }
    if (id < 5888) { return 2; }
    return 3;
}
export function vehicleBits(flags, id) {
    if (id === 0) { return 0; }
    const walk = ((flags[id] || 0) & 0x0f) !== 0x0f;
    if (id >= 2048 && id < 2816) {
        const k = Math.floor((id - 2048) / 48);
        const boat = k === 0 || (k >= 4 && k % 2 === 0);
        const ship = boat || k === 1;
        return ((!boat || walk) ? 0x200 : 0) | ((!ship || walk) ? 0x400 : 0) | 0x800;
    }
    let land = 0;
    if (id >= 2816 && id < 4352) {
        const b = flags[2048 + Math.floor((id - 2048) / 48) * 48] || 0;
        if ((b & 0x0f) === 0x0f || (b & 0x40)) { land = 0x800; }
    } else if (id >= 4352) {
        land = 0x800;
    }
    return 0x600 | land;
}
export function recomputeVehicleBits(ts) {
    for (let id = 0; id < ts.flags.length && id < 8192; id++) {
        const s = slotOfTile(id);
        if (s < 0 || !ts.tilesetNames[s]) { continue; }
        ts.flags[id] = ((ts.flags[id] || 0) & ~0xe00) | vehicleBits(ts.flags, id);
    }
}

// Autotile "tipo floresta" (manual, Asset Standards): o pixel (8,8) a partir do canto inferior
// direito do bloco é transparente. Nesses, Bush não vale para as 8 formas da borda inferior.
const FOREST_SHAPES = [38, 39, 40, 41, 43, 44, 45, 46];
const forestCache = new Map();
function isForestKind(img, name, kind) {
    const key = name + "#" + kind;
    if (forestCache.has(key)) { return forestCache.get(key); }
    let res = false;
    try {
        const tx = kind % 8, ty = Math.floor(kind / 8);
        const bx = tx * 2, by = (ty - 2) * 3;
        const c = document.createElement("canvas");
        c.width = 1; c.height = 1;
        const g = c.getContext("2d");
        g.drawImage(img, bx * T + 2 * T - 8, by * T + 3 * T - 8, 1, 1, 0, 0, 1, 1);
        res = g.getImageData(0, 0, 1, 1).data[3] === 0;
    } catch (e) { res = false; }
    forestCache.set(key, res);
    return res;
}

// Lista de células da paleta de uma aba: {ids:[...], img:slot, sx, sy}
function paletteCells(ts, tab) {
    const out = [];
    const has = i => !!ts.tilesetNames[i];
    if (tab === 0) {
        const auto = (kind, slot, bx, by) => {
            const ids = [];
            for (let s = 0; s < 48; s++) { ids.push(2048 + kind * 48 + s); }
            out.push({ ids, slot, sx: bx * T, sy: by * T });
        };
        if (has(0)) {
            for (let k = 0; k < 16; k++) {
                const tx = k % 8, ty = Math.floor(k / 8);
                let bx, by;
                if (k === 0) { bx = 0; by = 0; } else if (k === 1) { bx = 0; by = 3; } else if (k === 2) { bx = 6; by = 0; } else if (k === 3) { bx = 6; by = 3; } else {
                    bx = Math.floor(tx / 4) * 8; by = ty * 6 + (Math.floor(tx / 2) % 2) * 3;
                    if (k % 2 === 1) { bx += 6; }
                }
                auto(k, 0, bx, by);
            }
        }
        if (has(1)) { for (let k = 16; k < 48; k++) { const tx = k % 8, ty = Math.floor(k / 8); auto(k, 1, tx * 2, (ty - 2) * 3); } }
        if (has(2)) { for (let k = 48; k < 80; k++) { const tx = k % 8, ty = Math.floor(k / 8); auto(k, 2, tx * 2, (ty - 6) * 2); } }
        if (has(3)) {
            for (let k = 80; k < 128; k++) {
                const tx = k % 8, ty = Math.floor(k / 8);
                auto(k, 3, tx * 2, Math.floor((ty - 10) * 2.5 + (ty % 2 === 1 ? 0.5 : 0)));
            }
        }
        if (has(4)) { for (let i = 0; i < 128; i++) { out.push({ ids: [1536 + i], slot: 4, sx: (i % 8) * T, sy: Math.floor(i / 8) * T }); } }
    } else {
        const slot = 4 + tab;
        const base = (tab - 1) * 256;
        for (let i = 0; i < 256; i++) {
            const half = Math.floor(i / 128);
            out.push({ ids: [base + i], slot, sx: (half * 8 + (i % 8)) * T, sy: (Math.floor(i / 8) % 16) * T, locked: base + i === 0 });
        }
    }
    return out;
}

function markText(f, mode, isA) {
    switch (mode) {
        case "passage": return f & 0x10 ? "☆" : (f & 0x0f) === 0x0f ? "×" : "○";
        case "terrain": return String(f >> 12);
        case "passage4": return null;
        default: return f & BIT[mode] ? { ladder: "#", bush: "≋", counter: "◆", damage: "▲" }[mode] : "・";
    }
}

function tilePalette(ts) {
    const wrap = el("div", { class: "dbTilePal" });
    const cv = el("canvas", { class: "dbTileCanvas" });
    const scroll = el("div", { class: "dbTileScroll" }, cv);
    const tabBar = el("div", { class: "dbTabs small" });
    const modeBar = el("div", { class: "dbTileModes" });
    let cells = [];
    const imgs = [];

    const draw = async () => {
        cells = paletteCells(ts, ui.tab);
        const rows = Math.max(1, Math.ceil(cells.length / 8));
        cv.width = 8 * T; cv.height = rows * T;
        const ctx = cv.getContext("2d");
        ctx.fillStyle = "#3a3a3a";
        ctx.fillRect(0, 0, cv.width, cv.height);
        for (let i = 0; i < 9; i++) { imgs[i] = ts.tilesetNames[i] ? await loadImage("tilesets", ts.tilesetNames[i]) : null; }
        cells.forEach((c, i) => {
            const img = imgs[c.slot];
            const dx = (i % 8) * T, dy = Math.floor(i / 8) * T;
            if (img) { ctx.drawImage(img, c.sx, c.sy, T, T, dx, dy, T, T); }
        });
        drawMarks();
    };
    const drawMarks = () => {
        const ctx = cv.getContext("2d");
        // redesenha só as marcas por cima (limpa redesenhando os tiles)
        cells.forEach((c, i) => {
            const dx = (i % 8) * T, dy = Math.floor(i / 8) * T;
            const img = imgs[c.slot];
            ctx.fillStyle = "#3a3a3a";
            ctx.fillRect(dx, dy, T, T);
            if (img) { ctx.drawImage(img, c.sx, c.sy, T, T, dx, dy, T, T); }
            ctx.strokeStyle = "rgba(0,0,0,.25)";
            ctx.strokeRect(dx + 0.5, dy + 0.5, T - 1, T - 1);
            const f = ts.flags[c.ids[0]] || 0;
            ctx.lineWidth = 3;
            ctx.strokeStyle = "rgba(0,0,0,.85)";
            ctx.fillStyle = "#fff";
            if (ui.mode === "passage4") {
                if (f & 0x10) { mark(ctx, "☆", dx, dy); return; }
                ctx.font = "bold 14px sans-serif";
                const arrows = [[0x01, "↓", dx + T / 2, dy + T - 8], [0x02, "←", dx + 9, dy + T / 2], [0x04, "→", dx + T - 9, dy + T / 2], [0x08, "↑", dx + T / 2, dy + 9]];
                for (const [bit, ch, x, y] of arrows) {
                    if (!(f & bit)) { ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.strokeText(ch, x, y); ctx.fillText(ch, x, y); }
                }
                if ((f & 0x0f) === 0x0f) { mark(ctx, "・", dx, dy); }
                return;
            }
            mark(ctx, markText(f, ui.mode, ui.tab === 0), dx, dy);
        });
    };
    const mark = (ctx, s, dx, dy) => {
        ctx.font = "bold 22px 'M+ 1p', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.strokeText(s, dx + T / 2, dy + T / 2 + 1);
        ctx.fillText(s, dx + T / 2, dy + T / 2 + 1);
    };

    const setFlags = (cell, fn) => {
        if (cell.locked) { return; }
        for (const id of cell.ids) { ts.flags[id] = fn(ts.flags[id] || 0); }
        const base = cell.ids[0];
        if (ui.mode === "bush" && base >= 2816 && base < 4352 && imgs[1]) {
            const kind = Math.floor((base - 2048) / 48);
            if (isForestKind(imgs[1], ts.tilesetNames[1], kind)) {
                for (const sh of FOREST_SHAPES) { ts.flags[base + sh] &= ~0x40; }
            }
        }
        recomputeVehicleBits(ts);
    };
    // calcula a transformação a partir da célula tocada; o arrasto aplica o mesmo resultado.
    // reverse = botão direito do MZ (toque longo aqui): inverte o ciclo de passagem/terreno.
    const transformFor = (cell, px, py, reverse) => {
        const f = ts.flags[cell.ids[0]] || 0;
        const isA = ui.tab === 0;
        switch (ui.mode) {
            case "passage": {
                const cur = f & 0x10 ? 2 : (f & 0x0f) === 0x0f ? 1 : 0;
                const n = isA ? 2 : 3;
                const next = (cur + (reverse ? n - 1 : 1)) % n;
                return v => next === 0 ? v & ~0x1f : next === 1 ? (v & ~0x10) | 0x0f : (v & ~0x0f) | 0x10;
            }
            case "passage4": {
                const dists = [[0x01, T - py], [0x02, px], [0x04, T - px], [0x08, py]].sort((a, b) => a[1] - b[1]);
                const bit = dists[0][0];
                const set = !(f & bit);
                return v => set ? v | bit : v & ~bit;
            }
            case "terrain": {
                const next = ((f >> 12) + (reverse ? 7 : 1)) % 8;
                return v => (v & 0x0fff) | (next << 12);
            }
            default: {
                const bit = BIT[ui.mode];
                const set = !(f & bit);
                return v => set ? v | bit : v & ~bit;
            }
        }
    };
    const cellAt = e => {
        const r = cv.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width * cv.width, y = (e.clientY - r.top) / r.height * cv.height;
        const i = Math.floor(y / T) * 8 + Math.floor(x / T);
        return { cell: cells[i], px: x % T, py: y % T, i };
    };
    // Como no MZ: clicar muda o valor; arrastar com o botão pressionado aplica o mesmo valor às
    // células por onde passa; botão direito inverte o ciclo. No toque: um dedo arrasta e pinta,
    // toque longo (500 ms parado) = botão direito, dois dedos (ou a faixa à direita) rolam a lista.
    const LONG_MS = 500;
    let stroke = null;          // { id, cell, px, py, i, painted:Set, fn, timer }
    let pan = null;             // rolagem com dois dedos
    const touches = new Map();
    const applyCell = (s, cell, i) => {
        if (!cell || s.painted.has(i)) { return; }
        s.painted.add(i);
        setFlags(cell, s.fn);
    };
    const begin = (s, reverse) => {
        s.fn = transformFor(s.cell, s.px, s.py, reverse);
        applyCell(s, s.cell, s.i);
        changed(); drawMarks();
    };
    const cancelStroke = () => { if (stroke) { clearTimeout(stroke.timer); stroke = null; } };
    cv.addEventListener("contextmenu", e => e.preventDefault());
    cv.addEventListener("pointerdown", e => {
        if (e.pointerType === "touch") {
            touches.set(e.pointerId, e.clientY);
            if (touches.size >= 2) {
                // segundo dedo: desfaz nada (o 1º toque ainda não pintou se não arrastou) e passa a rolar
                if (stroke && !stroke.fn) { cancelStroke(); }
                stroke = null;
                pan = { y: [...touches.values()].reduce((a, b) => a + b, 0) / touches.size, top: scroll.scrollTop };
                return;
            }
        }
        const { cell, px, py, i } = cellAt(e);
        if (!cell) { return; }
        e.preventDefault();
        cv.setPointerCapture(e.pointerId);
        stroke = { id: e.pointerId, cell, px, py, i, painted: new Set(), fn: null, timer: 0 };
        if (e.pointerType === "touch") {
            const s = stroke;
            s.timer = setTimeout(() => { if (stroke === s && !s.fn) { begin(s, true); if (navigator.vibrate) { navigator.vibrate(15); } } }, LONG_MS);
        } else {
            begin(stroke, e.button === 2);
        }
    });
    cv.addEventListener("pointermove", e => {
        if (e.pointerType === "touch" && touches.has(e.pointerId)) { touches.set(e.pointerId, e.clientY); }
        if (pan) {
            const y = [...touches.values()].reduce((a, b) => a + b, 0) / Math.max(1, touches.size);
            scroll.scrollTop = pan.top - (y - pan.y);
            return;
        }
        if (!stroke || stroke.id !== e.pointerId) { return; }
        const { cell, i } = cellAt(e);
        if (!stroke.fn) {
            if (i === stroke.i) { return; }       // ainda na célula inicial: pode virar toque longo
            clearTimeout(stroke.timer);
            begin(stroke, false);
        }
        if (ui.mode === "passage4") { return; }   // 4 direções: só a célula tocada (o lado depende do ponto)
        applyCell(stroke, cell, i);
        drawMarks();
    });
    const end = e => {
        touches.delete(e.pointerId);
        if (pan) { if (!touches.size) { pan = null; } return; }
        if (!stroke || stroke.id !== e.pointerId) { return; }
        clearTimeout(stroke.timer);
        if (!stroke.fn && e.type === "pointerup") { begin(stroke, false); }   // toque curto
        stroke = null;
    };
    cv.addEventListener("pointerup", end);
    cv.addEventListener("pointercancel", end);

    ["A", "B", "C", "D", "E"].forEach((L, i) => {
        const b = btn(L, () => { ui.tab = i; [...tabBar.children].forEach((x, j) => x.classList.toggle("on", j === i)); draw(); scroll.scrollTop = 0; });
        if (i === ui.tab) { b.classList.add("on"); }
        tabBar.appendChild(b);
    });
    for (const [id, label] of MODES) {
        const b = btn(label, () => { ui.mode = id; [...modeBar.children].forEach(x => x.classList.toggle("on", x.dataset.mode === id)); drawMarks(); });
        b.dataset.mode = id;
        if (id === ui.mode) { b.classList.add("on"); }
        modeBar.appendChild(b);
    }
    wrap.append(el("div", { class: "dbTileMain" }, el("div", { class: "dbTileLeft" }, scroll, tabBar), modeBar));
    wrap.redraw = draw;
    draw();
    return wrap;
}

export const tilesetsTab = {
    id: "tilesets", label: t("Tilesets", "DatabaseMain"), desc: t("Data defining the behavior of tilesets for maps.", "DatabaseMain"), file: "Tilesets", max: 1000,
    form(ctx, ts, host) {
        while (ts.tilesetNames.length < 9) { ts.tilesetNames.push(""); }
        const host2 = el("div", { class: "dbCols tileset" });
        const left = el("div", { class: "dbCol" }), right = el("div", { class: "dbCol" });
        host2.append(left, right);
        host.appendChild(host2);
        let palette = null;
        left.appendChild(grp(t("General Settings", "Constants"), grid(2,
            fld(t("Name", "Constants") + ":", text(ts, "name", { onInput: () => ctx.refreshRow() })),
            fld(t("Mode", "Edit_Tilesets") + ":", sel(ts, "mode", [[0, t("World Type", "Edit_Tilesets")], [1, t("Area Type", "Edit_Tilesets")], [2, t("VX Compatible Type", "MZEditor")]], { number: true })))));
        const imgs = el("div", { class: "dbTileImgs" });
        SLOT_NAMES.forEach((n, i) => {
            const b = btn("", async () => {
                const r = await pickImage({ folder: "tilesets", current: ts.tilesetNames[i], title: t("Select an Image", "Dialog_ImageSelector") + " (" + n + ")" });
                if (r) { ts.tilesetNames[i] = r.name; recomputeVehicleBits(ts); changed(); paint(); palette.redraw(); }
            }, "dbPickBtn");
            const paint = () => { b.textContent = ts.tilesetNames[i] || "(" + t("None", "Constants") + ")"; };
            paint();
            imgs.appendChild(el("div", { class: "dbTileImgRow" }, el("span", { class: "dbLabel", text: n + ":" }), b));
        });
        left.appendChild(grp(t("Images", "Group_TilesetImages"), imgs));
        left.appendChild(noteGroup(ts, 4));
        palette = tilePalette(ts);
        right.appendChild(grp(t("Tile List", "MZEditor"), palette));
    }
};

// ------------------------------------------------------------------ Common Events

export const commonEventsTab = {
    id: "commonEvents", label: t("Common Events", "DatabaseMain"), desc: t("Data for commonly used events.", "DatabaseMain"), file: "CommonEvents", max: 1000,
    form(ctx, ce, host) {
        const db = ctx.db;
        const sw = sel(ce, "switchId", switchOptions(db.System), { number: true, disabled: ce.trigger === 0 });
        host.appendChild(grp(t("General Settings", "Constants"), grid(3,
            fld(t("Name", "Constants") + ":", text(ce, "name", { onInput: () => ctx.refreshRow() })),
            fld(t("Trigger", "Edit_CommonEvents") + ":", sel(ce, "trigger", [[0, t("None", "Constants")], [1, t("Autorun", "Edit_CommonEvents")], [2, t("Parallel", "Edit_CommonEvents")]], { number: true, onChange: v => { sw.disabled = v === 0; } })),
            fld(t("Switch", "Constants") + ":", sw))));
        const contents = grp(t("Contents", "Edit_CommonEvents"), commandList(ce, "list", { context: "common", commonEventId: ce.id, title: t("Common Event", "Constants") }));
        contents.classList.add("grow");
        host.appendChild(contents);
    }
};
