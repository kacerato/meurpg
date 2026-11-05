// Abas Animations, Tilesets e Common Events.
import { el, num, text, area, sel, chk, fld, grp, grid, btn, tableList, modal, changed } from "./ui.js";
import { switchOptions } from "./common.js";
import { listFiles, pickImage, pickColor, audioField, audioText, loadImage } from "./pickers.js";
import { cols, noteGroup } from "./tabs_actors.js";
import { commandList } from "./eventlist.js";
import { previewGroup } from "./animpreview.js";
import { changeBattleback } from "./tabs_battle.js";

// ------------------------------------------------------------------ Animations

async function pickEffect(current) {
    const names = await listFiles("effects", ["efkefc"]);
    let value = current;
    const ok = await modal({
        title: "Particle Effect", width: "520px", height: "520px",
        build: b => {
            const list = el("div", { class: "dbPickList full" });
            for (const n of ["", ...names]) {
                const r = el("div", { class: "dbPickItem" + (n === current ? " sel" : ""), text: n || "(None)" });
                r.addEventListener("click", () => { list.querySelectorAll(".sel").forEach(x => x.classList.remove("sel")); r.classList.add("sel"); value = n; });
                list.appendChild(r);
            }
            b.appendChild(list);
            requestAnimationFrame(() => { const s = list.querySelector(".sel"); if (s) { s.scrollIntoView({ block: "center" }); } });
        }
    });
    return ok ? value : null;
}

async function editSoundTiming(t) {
    const o = t ? structuredClone(t) : { frame: 0, se: { name: "", pan: 0, pitch: 100, volume: 90 } };
    const ok = await modal({
        title: "Sound Timing", width: "520px",
        build: b => b.appendChild(grid(2, fld("Frame:", num(o, "frame", { min: 0, max: 9999 })), fld("SE:", audioField(o, "se", "se"))))
    });
    return ok ? o : null;
}

async function editFlashTiming(t) {
    const o = t ? structuredClone(t) : { frame: 0, duration: 30, color: [255, 255, 255, 170] };
    const ok = await modal({
        title: "Flash Timing", width: "560px",
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
            b.appendChild(grid(3, fld("Frame:", num(o, "frame", { min: 0, max: 9999 })),
                fld("Duration:", num(o, "duration", { min: 1, max: 999 })), fld("Color:", colorBtn)));
        }
    });
    return ok ? o : null;
}

export const animationsTab = {
    id: "animations", label: "Animations", file: "Animations", max: 1000,
    form(ctx, a, host) {
        const [left, right] = cols(host);
        if (!a.rotation) { a.rotation = { x: 0, y: 0, z: 0 }; }
        if (!a.soundTimings) { a.soundTimings = []; }
        if (!a.flashTimings) { a.flashTimings = []; }
        left.appendChild(grp("General Settings", grid(2,
            fld("Name:", text(a, "name", { onInput: () => ctx.refreshRow() })),
            fld("Display Type:", sel(a, "displayType", [[0, "For each target"], [1, "For the center of targets"], [2, "For the screen"]], { number: true })))));
        const fileBtn = btn(a.effectName || "(None)", async () => {
            const r = await pickEffect(a.effectName);
            if (r !== null) { a.effectName = r; fileBtn.textContent = r || "(None)"; changed(); }
        }, "dbPickBtn");
        left.appendChild(grp("Particle Effect", grid(3,
            fld("File:", fileBtn, { span: 3 }),
            fld("Scale:", [num(a, "scale", { min: 0, max: 1000 }), "%"]),
            fld("Speed:", [num(a, "speed", { min: 1, max: 1000 }), "%"]),
            el("div"),
            fld("Rotation X:", num(a.rotation, "x", { min: -360, max: 360 })),
            fld("Rotation Y:", num(a.rotation, "y", { min: -360, max: 360 })),
            fld("Rotation Z:", num(a.rotation, "z", { min: -360, max: 360 })),
            fld("Offset X:", num(a, "offsetX", { min: -9999, max: 9999 })),
            fld("Offset Y:", num(a, "offsetY", { min: -9999, max: 9999 })))));
        left.appendChild(grp("Preview", ...previewGroup(ctx.db, a, async db => {
            const ok = await changeBattleback(db);
            if (ok) { ctx.touch("System"); }
            return ok;
        })));
        right.appendChild(grp("Sound Timings", tableList({
            columns: [{ title: "Frame", width: "70px" }, { title: "Sound", width: "1fr" }],
            items: a.soundTimings,
            cells: s => [String(s.frame), audioText(s.se)],
            create: () => editSoundTiming(null),
            edit: s => editSoundTiming(s),
            clipKey: "sound"
        })));
        right.appendChild(grp("Flash Timings", tableList({
            columns: [{ title: "Frame", width: "70px" }, { title: "Duration", width: "80px" }, { title: "Color", width: "1fr" }],
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
const MODES = [["passage", "Passage"], ["passage4", "Passage (4 dir)"], ["ladder", "Ladder"], ["bush", "Bush"],
    ["counter", "Counter"], ["damage", "Damage Floor"], ["terrain", "Terrain Tag"]];
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
    const rev = { v: false };
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
    // calcula a transformação a partir da célula tocada; o arrasto aplica o mesmo resultado
    const transformFor = (cell, px, py) => {
        const f = ts.flags[cell.ids[0]] || 0;
        const isA = ui.tab === 0;
        switch (ui.mode) {
            case "passage": {
                const cur = f & 0x10 ? 2 : (f & 0x0f) === 0x0f ? 1 : 0;
                const n = isA ? 2 : 3;
                const next = (cur + (rev.v ? n - 1 : 1)) % n;
                return v => next === 0 ? v & ~0x1f : next === 1 ? (v & ~0x10) | 0x0f : (v & ~0x0f) | 0x10;
            }
            case "passage4": {
                const dists = [[0x01, T - py], [0x02, px], [0x04, T - px], [0x08, py]].sort((a, b) => a[1] - b[1]);
                const bit = dists[0][0];
                const set = !(f & bit);
                return v => set ? v | bit : v & ~bit;
            }
            case "terrain": {
                const next = ((f >> 12) + (rev.v ? 7 : 1)) % 8;
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
    // Toque: um toque alterna (arrastar rola a lista). Mouse/caneta: arrastar pinta.
    let paint = null, painted = null;
    cv.addEventListener("pointerdown", e => {
        if (e.pointerType === "touch") { return; }
        const { cell, px, py, i } = cellAt(e);
        if (!cell) { return; }
        paint = transformFor(cell, px, py);
        painted = new Set([i]);
        setFlags(cell, paint); changed(); drawMarks();
        cv.setPointerCapture(e.pointerId);
    });
    cv.addEventListener("pointermove", e => {
        if (!paint || ui.mode === "passage4") { return; }
        const { cell, i } = cellAt(e);
        if (cell && !painted.has(i)) { painted.add(i); setFlags(cell, paint); drawMarks(); }
    });
    cv.addEventListener("pointerup", () => { paint = null; });
    cv.addEventListener("click", e => {
        if (e.pointerType !== "touch" && !(e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents)) { return; }
        const { cell, px, py } = cellAt(e);
        if (!cell) { return; }
        setFlags(cell, transformFor(cell, px, py)); changed(); drawMarks();
    });

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
    modeBar.appendChild(chk(rev, "v", "Reverse"));
    wrap.append(el("div", { class: "dbTileMain" }, el("div", { class: "dbTileLeft" }, scroll, tabBar), modeBar));
    wrap.redraw = draw;
    draw();
    return wrap;
}

export const tilesetsTab = {
    id: "tilesets", label: "Tilesets", file: "Tilesets", max: 1000,
    form(ctx, ts, host) {
        while (ts.tilesetNames.length < 9) { ts.tilesetNames.push(""); }
        const host2 = el("div", { class: "dbCols tileset" });
        const left = el("div", { class: "dbCol" }), right = el("div", { class: "dbCol" });
        host2.append(left, right);
        host.appendChild(host2);
        let palette = null;
        left.appendChild(grp("General Settings", grid(2,
            fld("Name:", text(ts, "name", { onInput: () => ctx.refreshRow() })),
            fld("Mode:", sel(ts, "mode", [[0, "World Type"], [1, "Area Type"], [2, "VX Compatible Type"]], { number: true })))));
        const imgs = el("div", { class: "dbTileImgs" });
        SLOT_NAMES.forEach((n, i) => {
            const b = btn("", async () => {
                const r = await pickImage({ folder: "tilesets", current: ts.tilesetNames[i], title: "Select an Image (" + n + ")" });
                if (r) { ts.tilesetNames[i] = r.name; recomputeVehicleBits(ts); changed(); paint(); palette.redraw(); }
            }, "dbPickBtn");
            const paint = () => { b.textContent = ts.tilesetNames[i] || "(None)"; };
            paint();
            imgs.appendChild(el("div", { class: "dbTileImgRow" }, el("span", { class: "dbLabel", text: n + ":" }), b));
        });
        left.appendChild(grp("Images", imgs));
        left.appendChild(noteGroup(ts, 4));
        palette = tilePalette(ts);
        right.appendChild(grp("Tile List", palette));
    }
};

// ------------------------------------------------------------------ Common Events

export const commonEventsTab = {
    id: "commonEvents", label: "Common Events", file: "CommonEvents", max: 1000,
    form(ctx, ce, host) {
        const db = ctx.db;
        const sw = sel(ce, "switchId", switchOptions(db.System), { number: true, disabled: ce.trigger === 0 });
        host.appendChild(grp("General Settings", grid(3,
            fld("Name:", text(ce, "name", { onInput: () => ctx.refreshRow() })),
            fld("Trigger:", sel(ce, "trigger", [[0, "None"], [1, "Autorun"], [2, "Parallel"]], { number: true, onChange: v => { sw.disabled = v === 0; } })),
            fld("Switch:", sw))));
        const contents = grp("Contents", commandList(ce, "list", { context: "common", commonEventId: ce.id, title: "Common Event" }));
        contents.classList.add("grow");
        host.appendChild(contents);
    }
};
