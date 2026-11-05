// Seletores de recursos: imagens (com pré-visualização e matiz), sprite sheets de
// personagem/rosto (com índice), ícones do IconSet e áudio (volume/tom/pan + tocar).
import { el, btn, modal, fld, num, getApi, changed } from "./ui.js";
import { t } from "../i18n.js";

const imgCache = new Map();
export function imageUrl(folder, name) {
    return `/project/img/${folder}/${encodeURIComponent(name)}.png`;
}
export function loadImage(folder, name) {
    const key = folder + "/" + name;
    if (!imgCache.has(key)) {
        imgCache.set(key, new Promise(resolve => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => resolve(null);
            img.src = imageUrl(folder, name);
        }));
    }
    return imgCache.get(key);
}

const listCache = new Map();
export async function listFiles(dir, exts) {
    const key = dir + "|" + exts.join(",");
    if (!listCache.has(key)) {
        listCache.set(key, (async () => {
            const entries = await getApi().project.list(dir).catch(() => []);
            const names = new Set();
            for (const e of entries || []) {
                const n = typeof e === "string" ? e : e.name;
                if (e.dir) { continue; }
                const dot = n.lastIndexOf(".");
                if (dot > 0 && exts.includes(n.slice(dot + 1).toLowerCase())) { names.add(n.slice(0, dot)); }
            }
            return [...names].sort((a, b) => a.localeCompare(b));
        })());
    }
    return listCache.get(key);
}

export function isBigCharacter(name) {
    const m = /^[!$]+/.exec(name || "");
    return !!(m && m[0].includes("$"));
}

// ---------------------------------------------------------------- miniaturas

function canvas(w, h, cls) {
    const c = el("canvas", { class: cls || "dbThumb" });
    c.width = w; c.height = h;
    return c;
}

function drawFit(ctx, img, sx, sy, sw, sh, W, H) {
    const s = Math.min(W / sw, H / sh, 2);
    const dw = sw * s, dh = sh * s;
    ctx.imageSmoothingEnabled = s < 1;
    ctx.drawImage(img, sx, sy, sw, sh, (W - dw) / 2, (H - dh) / 2, dw, dh);
}

export function charThumb(name, index, size = 72) {
    const c = canvas(size, size);
    if (name) {
        loadImage("characters", name).then(img => {
            if (!img) { return; }
            const big = isBigCharacter(name);
            const pw = img.width / (big ? 3 : 12), ph = img.height / (big ? 4 : 8);
            const bx = big ? 0 : (index % 4) * 3, by = big ? 0 : Math.floor(index / 4) * 4;
            drawFit(c.getContext("2d"), img, (bx + 1) * pw, by * ph, pw, ph, size, size);
        });
    }
    return c;
}

export function faceThumb(name, index, size = 96) {
    const c = canvas(size, size);
    if (name) {
        loadImage("faces", name).then(img => {
            if (!img) { return; }
            const fw = img.width / 4, fh = img.height / 2;
            drawFit(c.getContext("2d"), img, (index % 4) * fw, Math.floor(index / 4) * fh, fw, fh, size, size);
        });
    }
    return c;
}

export function svThumb(name, size = 72) {
    const c = canvas(size, size);
    if (name) {
        loadImage("sv_actors", name).then(img => {
            if (!img) { return; }
            const fw = img.width / 9, fh = img.height / 6;
            drawFit(c.getContext("2d"), img, fw, 0, fw, fh, size, size);
        });
    }
    return c;
}

export function imageThumb(folder, name, w = 160, h = 120, hue = 0) {
    const c = canvas(w, h);
    if (hue) { c.style.filter = `hue-rotate(${hue}deg)`; }
    if (name) {
        loadImage(folder, name).then(img => {
            if (img) { drawFit(c.getContext("2d"), img, 0, 0, img.width, img.height, w, h); }
        });
    }
    return c;
}

export function iconCanvas(index, size = 32) {
    const c = canvas(size, size, "dbIcon");
    loadImage("system", "IconSet").then(img => {
        if (!img || !index) { return; }
        const ctx = c.getContext("2d");
        ctx.drawImage(img, (index % 16) * 32, Math.floor(index / 16) * 32, 32, 32, 0, 0, size, size);
    });
    return c;
}

// ---------------------------------------------------------------- diálogo base de seleção

function fileListPane(names, current, onPick, noneLabel = "(" + t("None", "Constants") + ")") {
    const list = el("div", { class: "dbPickList" });
    const items = [noneLabel !== false ? ["", noneLabel] : null, ...names.map(n => [n, n])].filter(Boolean);
    const rows = [];
    for (const [value, label] of items) {
        const r = el("div", { class: "dbPickItem" + (value === current ? " sel" : ""), text: label });
        r.addEventListener("click", () => {
            rows.forEach(x => x.classList.remove("sel"));
            r.classList.add("sel");
            onPick(value);
        });
        rows.push(r);
        list.appendChild(r);
    }
    requestAnimationFrame(() => { const s = list.querySelector(".sel"); if (s) { s.scrollIntoView({ block: "center" }); } });
    return list;
}

// Seleciona uma imagem de img/<folder>/. Devolve {name, hue} ou null.
export async function pickImage({ folder, current = "", hue, title = t("Select an Image", "Dialog_ImageSelector"), none = true }) {
    const names = await listFiles("img/" + folder, ["png"]);
    const state = { name: current, hue: hue || 0 };
    const preview = el("div", { class: "dbPickPreview" });
    const img = el("img", { class: "dbPickImg" });
    preview.appendChild(img);
    const show = () => {
        img.style.display = state.name ? "" : "none";
        if (state.name) { img.src = imageUrl(folder, state.name); }
        img.style.filter = state.hue ? `hue-rotate(${state.hue}deg)` : "";
    };
    const ok = await modal({
        title, width: "860px", height: "560px",
        build: b => {
            b.classList.add("dbPickBody");
            b.appendChild(fileListPane(names, current, v => { state.name = v; show(); }, none ? "(" + t("None", "Constants") + ")" : false));
            const right = el("div", { class: "dbPickRight" }, preview);
            if (hue !== undefined) {
                const slider = el("input", { type: "range", min: 0, max: 360, value: state.hue, class: "dbRange" });
                const lab = el("span", { text: String(state.hue) });
                slider.addEventListener("input", () => { state.hue = Number(slider.value); lab.textContent = slider.value; show(); });
                right.appendChild(el("div", { class: "dbRow" }, el("span", { text: t("Hue", "Dialog_ImageSelector") + ":" }), slider, lab));
            }
            b.appendChild(right);
            show();
        }
    });
    return ok ? state : null;
}

// Personagem (characters) ou rosto (faces): escolhe arquivo + índice no sprite sheet.
export async function pickSheet({ kind, name = "", index = 0, title }) {
    const folder = kind === "face" ? "faces" : "characters";
    const names = await listFiles("img/" + folder, ["png"]);
    const state = { name, index };
    const cv = el("canvas", { class: "dbSheet" });
    const draw = async () => {
        const ctx = cv.getContext("2d");
        if (!state.name) { cv.width = 1; cv.height = 1; return; }
        const img = await loadImage(folder, state.name);
        if (!img) { return; }
        cv.width = img.width; cv.height = img.height;
        ctx.clearRect(0, 0, cv.width, cv.height);
        ctx.drawImage(img, 0, 0);
        const big = kind !== "face" && isBigCharacter(state.name);
        if (big) { state.index = 0; }
        const cw = big ? img.width : img.width / 4, ch = big ? img.height : img.height / 2;
        ctx.lineWidth = 4;
        ctx.strokeStyle = "#ff3030";
        ctx.strokeRect((state.index % 4) * cw + 2, Math.floor(state.index / 4) * ch + 2, cw - 4, ch - 4);
    };
    cv.addEventListener("click", e => {
        if (!state.name || (kind !== "face" && isBigCharacter(state.name))) { return; }
        const r = cv.getBoundingClientRect();
        const x = Math.floor((e.clientX - r.left) / r.width * 4);
        const y = Math.floor((e.clientY - r.top) / r.height * 2);
        state.index = Math.max(0, Math.min(7, y * 4 + x));
        draw();
    });
    const ok = await modal({
        title: title || t("Select an Image", "Dialog_ImageSelector"), width: "900px", height: "560px",
        build: b => {
            b.classList.add("dbPickBody");
            b.appendChild(fileListPane(names, name, v => { state.name = v; state.index = 0; draw(); }));
            b.appendChild(el("div", { class: "dbPickRight" }, el("div", { class: "dbPickPreview" }, cv)));
            draw();
        }
    });
    return ok ? state : null;
}

export async function pickIcon(current = 0) {
    const state = { index: current };
    const cv = el("canvas", { class: "dbIconSheet" });
    const info = el("span", { text: "" });
    const draw = async () => {
        const img = await loadImage("system", "IconSet");
        if (!img) { return; }
        cv.width = img.width; cv.height = img.height;
        const ctx = cv.getContext("2d");
        ctx.drawImage(img, 0, 0);
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#ff3030";
        ctx.strokeRect((state.index % 16) * 32 + 1, Math.floor(state.index / 16) * 32 + 1, 30, 30);
        info.textContent = t("Icon Index", "Dialog_IconSelector") + ": " + state.index;
    };
    const reveal = () => {
        const sc = cv.parentElement;
        if (sc) { sc.scrollTop = Math.floor(state.index / 16) * 32 * (cv.clientWidth / 512) - sc.clientHeight / 2; }
    };
    cv.addEventListener("click", e => {
        const r = cv.getBoundingClientRect();
        const x = Math.floor((e.clientX - r.left) / r.width * 16);
        const y = Math.floor((e.clientY - r.top) / r.height * (cv.height / 32));
        state.index = y * 16 + x;
        draw();
    });
    const ok = await modal({
        title: t("Select an Icon", "Dialog_IconSelector"), width: "620px", height: "560px",
        build: b => {
            b.appendChild(el("div", { class: "dbIconScroll" }, cv));
            b.appendChild(el("div", { class: "dbRow" }, info));
            draw().then(() => requestAnimationFrame(reveal));
        }
    });
    return ok ? state.index : null;
}

// ---------------------------------------------------------------- áudio

let playing = null;
export function stopAudio() {
    if (playing) { playing.pause(); playing = null; }
}
export async function playAudio(folder, a) {
    stopAudio();
    if (!a || !a.name) { return; }
    const base = `/project/audio/${folder}/${encodeURIComponent(a.name)}`;
    const audio = new Audio();
    const canOgg = audio.canPlayType("audio/ogg") !== "";
    audio.src = base + (canOgg ? ".ogg" : ".m4a");
    audio.volume = Math.max(0, Math.min(1, (a.volume ?? 90) / 100));
    audio.playbackRate = Math.max(0.5, Math.min(1.5, (a.pitch ?? 100) / 100));
    audio.preservesPitch = false;
    audio.loop = folder === "bgm" || folder === "bgs";
    playing = audio;
    audio.play().catch(() => {});
}

// a: {name, volume, pitch, pan}. Devolve um objeto novo ou null.
export async function pickAudio(folder, a, title) {
    const names = await listFiles("audio/" + folder, ["ogg", "m4a"]);
    const state = { name: a?.name || "", volume: a?.volume ?? 90, pitch: a?.pitch ?? 100, pan: a?.pan ?? 0 };
    const slider = (key, min, max, label) => {
        const s = el("input", { type: "range", min, max, value: state[key], class: "dbRange" });
        const v = el("span", { class: "dbRangeVal", text: String(state[key]) });
        s.addEventListener("input", () => { state[key] = Number(s.value); v.textContent = s.value; });
        return fld(label, [s, v]);
    };
    const ok = await modal({
        title: title || t("Select an Audio", "Dialog_AudioSelector") + " (" + folder.toUpperCase() + ")", width: "760px", height: "520px",
        build: b => {
            b.classList.add("dbPickBody");
            b.appendChild(fileListPane(names, state.name, v => { state.name = v; }));
            b.appendChild(el("div", { class: "dbPickRight audio" },
                el("div", { class: "dbRow" }, btn(t("Play", "Layout_AudioSelector"), () => playAudio(folder, state)), btn(t("Stop", "Layout_AudioSelector"), stopAudio)),
                slider("volume", 0, 100, t("Volume", "Layout_AudioSelector")),
                slider("pitch", 50, 150, t("Pitch", "Layout_AudioSelector")),
                slider("pan", -100, 100, t("Pan", "Layout_AudioSelector"))));
        }
    });
    stopAudio();
    return ok ? state : null;
}

export function audioText(a) {
    return a && a.name ? `${a.name} (${a.volume}, ${a.pitch}, ${a.pan})` : "(" + t("None", "Constants") + ")";
}

// Campo de áudio ligado a obj[key] (objeto de áudio).
export function audioField(obj, key, folder, o = {}) {
    const b = el("button", { class: "dbBtn dbPickBtn", type: "button" });
    const show = () => { b.textContent = audioText(obj[key]); };
    show();
    b.addEventListener("click", async () => {
        const r = await pickAudio(folder, obj[key], o.title);
        if (r) { obj[key] = r; changed(); show(); }
    });
    return b;
}

// ---------------------------------------------------------------- cor / tom

// tom [r,g,b,gray] ou cor [r,g,b,a]. mode: "tone" (-255..255) | "color" (0..255)
export async function pickColor(values, mode = "tone", title, forceCount) {
    const v = values.slice();
    const isTone = mode === "tone";
    const labels = isTone ? [t("Red", "Layout_ColorTone"), t("Green", "Layout_ColorTone"), t("Blue", "Layout_ColorTone"), t("Gray", "Layout_ColorTone")]
        : [t("Red", "Layout_FlashColor"), t("Green", "Layout_FlashColor"), t("Blue", "Layout_FlashColor"), t("Intensity", "Layout_FlashColor")];
    const count = forceCount || (isTone && v.length < 4 ? 3 : 4);
    const prev = el("div", { class: "dbColorPrev" });
    const paint = () => {
        if (isTone) {
            const base = [0x40, 0x60, 0x80];
            const c = base.map((b, i) => Math.max(0, Math.min(255, b + v[i])));
            prev.style.background = `rgb(${c.join(",")})`;
        } else {
            prev.style.background = `rgba(${v[0]},${v[1]},${v[2]},${(v[3] ?? 255) / 255})`;
        }
    };
    const ok = await modal({
        title: title || (isTone ? t("Color Tone", "EventCommand223") : t("Flash Color", "EventCommand224")), width: "520px",
        build: b => {
            for (let i = 0; i < count; i++) {
                const min = isTone && i < 3 ? -255 : 0;
                const s = el("input", { type: "range", min, max: 255, value: v[i] ?? 0, class: "dbRange" });
                const n = el("input", { type: "number", min, max: 255, value: v[i] ?? 0, class: "dbNum" });
                const set = x => { v[i] = Math.max(min, Math.min(255, Math.round(Number(x) || 0))); s.value = n.value = v[i]; paint(); };
                s.addEventListener("input", () => set(s.value));
                n.addEventListener("change", () => set(n.value));
                b.appendChild(fld(labels[i], [s, n]));
            }
            b.appendChild(prev);
            paint();
        }
    });
    return ok ? v : null;
}

// Botão de imagem simples ligado a obj[key] (nome do arquivo em img/<folder>).
export function imageButton(obj, key, folder, o = {}) {
    const b = el("button", { class: "dbBtn dbPickBtn", type: "button" });
    const show = () => { b.textContent = obj[key] || "(" + t("None", "Constants") + ")"; };
    show();
    b.addEventListener("click", async () => {
        const r = await pickImage({ folder, current: obj[key] || "", title: o.title });
        if (r) { obj[key] = r.name; changed(); show(); o.onChange && o.onChange(r.name); }
    });
    return b;
}

export { num };

// Arquivo de fonte de fonts/ (Main/Number Font Filename): grava o nome com extensão, como o MZ.
const FONT_EXTS = ["woff", "woff2", "ttf", "otf"];
export async function pickFont(current = "", title) {
    const entries = await getApi().project.list("fonts").catch(() => []);
    const names = (entries || []).filter(e => !e.dir).map(e => typeof e === "string" ? e : e.name)
        .filter(n => FONT_EXTS.includes(n.slice(n.lastIndexOf(".") + 1).toLowerCase())).sort((a, b) => a.localeCompare(b));
    const state = { name: current };
    const sample = el("div", { class: "dbFontSample", text: "AaBbCc 0123456789\nあいうえお 漢字" });
    const show = async () => {
        if (!state.name) { sample.style.fontFamily = ""; return; }
        const fam = "dbFontPreview_" + state.name.replace(/\W/g, "_");
        try {
            if (![...document.fonts].some(f => f.family === fam)) {
                const ff = new FontFace(fam, `url("/project/fonts/${encodeURIComponent(state.name)}")`);
                document.fonts.add(await ff.load());
            }
            sample.style.fontFamily = `"${fam}", sans-serif`;
        } catch (e) { sample.style.fontFamily = ""; }
    };
    const ok = await modal({
        title: title || t("Main Font Filename", "Group_SystemAdvanced"), width: "760px", height: "460px",
        build: b => {
            b.classList.add("dbPickBody");
            b.appendChild(fileListPane(names, current, v => { state.name = v; show(); }, false));
            b.appendChild(el("div", { class: "dbPickRight" }, sample));
            show();
        }
    });
    return ok ? state.name : null;
}

// Campo de texto + "..." que abre pickFont.
export function fontField(obj, key, title) {
    const input = el("input", { type: "text", class: "dbText", value: obj[key] ?? "" });
    input.addEventListener("input", () => { obj[key] = input.value; changed(); });
    const b = btn("...", async () => {
        const r = await pickFont(obj[key], title);
        if (r !== null && r !== obj[key]) { obj[key] = r; input.value = r; changed(); }
    }, "small");
    return el("div", { class: "dbInline" }, input, b);
}
