// Pré-visualização de animações (aba Animations) com o Effekseer do próprio projeto
// (/project/js/libs/effekseer.min.js + effekseer.wasm), reproduzindo Sprite_Animation do
// runtime: mesmas matrizes de projeção/câmera, viewport 4096, escala/velocidade/rotação/offset,
// sound timings e flash timings (cor mesclada no alvo, decaimento (d-1)/d).
import { el, btn } from "./ui.js";
import { pickImage, loadImage } from "./pickers.js";

const W = 816, H = 624, VIEWPORT = 4096;
const state = {
    runtime: null,          // Promise do initRuntime
    view: null,             // elemento reutilizado (um único contexto WebGL)
    ctx: null,              // contexto Effekseer
    gl: null,
    effects: new Map(),     // nome -> effect
    target: { folder: "enemies", name: "" },
    anim: null, handle: null, frame: 0, maxFrame: 0, flash: [0, 0, 0, 0], flashDur: 0,
    playing: false, raf: 0, last: 0, acc: 0,
    db: null
};

function loadScript(src) {
    return new Promise((resolve, reject) => {
        if (window.effekseer) { resolve(); return; }
        const s = document.createElement("script");
        s.src = src;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error("Falha ao carregar " + src));
        document.head.appendChild(s);
    });
}

function initRuntime() {
    if (!state.runtime) {
        state.runtime = loadScript("/project/js/libs/effekseer.min.js").then(() => new Promise((resolve, reject) => {
            window.effekseer.initRuntime("/project/js/libs/effekseer.wasm", resolve, () => reject(new Error("Falha ao carregar effekseer.wasm")));
        }));
        state.runtime.catch(() => { state.runtime = null; });
    }
    return state.runtime;
}

function ensureView() {
    if (state.view) { return state.view; }
    const bg = el("canvas", { class: "dbAnimBg" });
    bg.width = W; bg.height = H;
    const fx = el("canvas", { class: "dbAnimFx" });
    fx.width = W; fx.height = H;
    const msg = el("div", { class: "dbAnimMsg" });
    const box = el("div", { class: "dbAnimView" }, bg, fx, msg);
    state.view = { box, bg, fx, msg };
    return state.view;
}

async function ensureContext() {
    await initRuntime();
    if (state.ctx) { return state.ctx; }
    const v = ensureView();
    const gl = v.fx.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false, preserveDrawingBuffer: false });
    if (!gl) { throw new Error("WebGL indisponível"); }
    const ctx = window.effekseer.createContext();
    ctx.init(gl);
    state.ctx = ctx;
    state.gl = gl;
    return ctx;
}

function loadEffect(name) {
    if (state.effects.has(name)) { return state.effects.get(name); }
    const p = new Promise((resolve, reject) => {
        const url = "/project/effects/" + encodeURIComponent(name) + ".efkefc";
        const eff = state.ctx.loadEffect(url, 1, () => resolve(eff), () => reject(new Error("Falha ao carregar " + url)));
    });
    state.effects.set(name, p);
    p.catch(() => state.effects.delete(name));
    return p;
}

// ------------------------------------------------------------------ fundo + alvo (2D)

let bgImgs = [null, null], targetImg = null;
async function loadBackground() {
    const sys = state.db.System;
    bgImgs = await Promise.all([
        sys.battleback1Name ? loadImage("battlebacks1", sys.battleback1Name) : null,
        sys.battleback2Name ? loadImage("battlebacks2", sys.battleback2Name) : null
    ]);
    const t = state.target;
    if (!t.name) {
        const enemy = (state.db.Enemies || []).find(e => e && e.battlerName);
        if (enemy) { t.name = enemy.battlerName; t.folder = state.db.System.optSideView ? "sv_enemies" : "enemies"; }
    }
    targetImg = t.name ? await loadImage(t.folder, t.name) : null;
    drawBackground();
}

function targetRect() {
    const w = targetImg ? targetImg.width : 0, h = targetImg ? targetImg.height : 0;
    return { x: W / 2 - w / 2, y: 436 - h, w, h };
}

function drawBackground() {
    const g = state.view.bg.getContext("2d");
    g.fillStyle = "#000";
    g.fillRect(0, 0, W, H);
    for (const img of bgImgs) {
        if (img) { g.drawImage(img, (W - img.width) / 2, (H - img.height) / 2); }
    }
    if (targetImg) {
        const r = targetRect();
        g.drawImage(targetImg, r.x, r.y);
        const [cr, cg, cb, ca] = state.flash;
        if (ca > 0) {
            // Sprite.setBlendColor: mistura a cor com alfa ca/255 só onde o alvo é opaco
            const tmp = document.createElement("canvas");
            tmp.width = r.w; tmp.height = r.h;
            const t = tmp.getContext("2d");
            t.drawImage(targetImg, 0, 0);
            t.globalCompositeOperation = "source-atop";
            t.fillStyle = `rgba(${cr},${cg},${cb},${ca / 255})`;
            t.fillRect(0, 0, r.w, r.h);
            g.drawImage(tmp, r.x, r.y);
        }
    }
}

// ------------------------------------------------------------------ laço (60 fps fixos)

function playSe(se) {
    if (!se || !se.name) { return; }
    const a = new Audio();
    a.src = `/project/audio/se/${encodeURIComponent(se.name)}.${a.canPlayType("audio/ogg") ? "ogg" : "m4a"}`;
    a.volume = Math.max(0, Math.min(1, (se.volume ?? 90) / 100));
    a.playbackRate = Math.max(0.5, Math.min(2, (se.pitch ?? 100) / 100));
    a.preservesPitch = false;
    a.play().catch(() => {});
}

function stepFrame() {
    const anim = state.anim;
    // updateEffectGeometry
    if (state.handle) {
        const r = Math.PI / 180, s = anim.scale / 100;
        state.handle.setLocation(0, 0, 0);
        state.handle.setRotation(anim.rotation.x * r, anim.rotation.y * r, anim.rotation.z * r);
        state.handle.setScale(s, s, s);
        state.handle.setSpeed(anim.speed / 100);
    }
    // updateMain: processSoundTimings / processFlashTimings
    for (const t of anim.soundTimings) { if (t.frame === state.frame) { playSe(t.se); } }
    for (const t of anim.flashTimings) {
        if (t.frame === state.frame) { state.flash = t.color.slice(); state.flashDur = t.duration; }
    }
    state.frame++;
    // updateFlash
    if (state.flashDur > 0) {
        const d = state.flashDur--;
        state.flash[3] *= (d - 1) / d;
    }
    state.ctx.update();
    if (state.frame > state.maxFrame && state.flashDur === 0 && !(state.handle && state.handle.exists)) {
        state.playing = false;
    }
}

function render() {
    const gl = state.gl, anim = state.anim;
    drawBackground();
    gl.viewport(0, 0, W, H);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (!state.handle || !state.handle.exists) { return; }
    // Sprite_Animation.setProjectionMatrix / setCameraMatrix / setViewport
    const p = -(VIEWPORT / H);
    state.ctx.setProjectionMatrix([1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 1, p, 0, 0, 0, 1]);
    state.ctx.setCameraMatrix([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -10, 1]);
    let px = W / 2, py = H / 2;
    if (anim.displayType !== 2 && targetImg) {
        const r = targetRect();
        px = r.x + r.w / 2;
        py = anim.alignBottom ? r.y + r.h : r.y + r.h / 2;
    }
    gl.viewport(anim.offsetX - VIEWPORT / 2 + px, anim.offsetY - VIEWPORT / 2 + py, VIEWPORT, VIEWPORT);
    state.ctx.beginDraw();
    state.ctx.drawHandle(state.handle);
    state.ctx.endDraw();
    gl.viewport(0, 0, W, H);
}

function loop(t) {
    if (!state.view.box.isConnected) { stop(); return; }
    const dt = state.last ? Math.min(100, t - state.last) : 1000 / 60;
    state.last = t;
    state.acc += dt;
    while (state.acc >= 1000 / 60 && state.playing) {
        state.acc -= 1000 / 60;
        stepFrame();
    }
    render();
    if (state.playing) {
        state.raf = requestAnimationFrame(loop);
    } else {
        state.raf = 0;
        state.flash = [0, 0, 0, 0];
        drawBackground();
    }
}

function stop() {
    if (state.raf) { cancelAnimationFrame(state.raf); state.raf = 0; }
    if (state.ctx) { state.ctx.stopAll(); }
    state.playing = false;
    state.handle = null;
}

async function play(anim) {
    const v = state.view;
    v.msg.textContent = "";
    try {
        await ensureContext();
        stop();
        state.anim = structuredClone(anim);
        if (!state.anim.rotation) { state.anim.rotation = { x: 0, y: 0, z: 0 }; }
        state.frame = 0;
        state.flash = [0, 0, 0, 0];
        state.flashDur = 0;
        state.maxFrame = Math.max(0, ...[...anim.soundTimings, ...anim.flashTimings].map(t => t.frame));
        state.handle = null;
        if (anim.effectName) {
            v.msg.textContent = "Carregando efeito…";
            const eff = await loadEffect(anim.effectName);
            v.msg.textContent = "";
            state.handle = state.ctx.play(eff, 0, 0, 0);
        }
        state.playing = true;
        state.last = 0;
        state.acc = 1000 / 60;
        state.raf = requestAnimationFrame(loop);
    } catch (e) {
        v.msg.textContent = String(e.message || e);
    }
}

// Grupo "Preview" da aba Animations: Play / Change Target / Change Battle Background.
export function previewGroup(ctxDb, anim, changeBattleback) {
    state.db = ctxDb;
    const v = ensureView();
    stop();
    loadBackground();
    const controls = el("div", { class: "dbRow" },
        btn("Play", () => play(anim)),
        btn("Stop", () => { stop(); state.flash = [0, 0, 0, 0]; drawBackground(); render0(); }),
        btn("Change Target...", async () => {
            const folder = state.db.System.optSideView ? "sv_enemies" : "enemies";
            const r = await pickImage({ folder, current: state.target.name, title: "Change Target" });
            if (r) { state.target = { folder, name: r.name }; await loadBackground(); }
        }),
        btn("Change BG...", async () => { if (await changeBattleback(state.db)) { await loadBackground(); } }));
    return [v.box, controls];
}

function render0() {
    if (state.gl) {
        state.gl.viewport(0, 0, W, H);
        state.gl.clearColor(0, 0, 0, 0);
        state.gl.clear(state.gl.COLOR_BUFFER_BIT);
    }
}

export function stopPreview() { stop(); }
