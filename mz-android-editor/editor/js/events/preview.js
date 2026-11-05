// Prévias desenhadas com as imagens reais do projeto e as mesmas contas do runtime (rmmz_core.js /
// rmmz_windows.js): tom de cor (ColorFilter), janela (Window._refreshBack/_refreshFrame), janela de
// mensagem (Window_Message/Window_NameBox) e fundo de batalha com as duas camadas.

import { db } from "./data.js";
import { h, imgUrl, loadImage } from "./ui.js";

const cache = new Map();
export function projectImage(folder, name) {
    if (!name) { return Promise.resolve(null); }
    const key = folder + "/" + name;
    if (!cache.has(key)) { cache.set(key, loadImage(imgUrl(folder, name)).catch(() => null)); }
    return cache.get(key);
}

// Fonte principal do jogo (advanced.mainFontFilename), registrada como "evGameFont".
let gameFont = null;
export function loadGameFont() {
    if (!gameFont) {
        const file = adv().mainFontFilename || "mplus-1m-regular.woff";
        const ff = new FontFace("evGameFont", `url("/project/fonts/${encodeURIComponent(file)}")`);
        gameFont = ff.load().then(f => { document.fonts.add(f); return true; }).catch(() => false);
    }
    return gameFont;
}

function adv() { return (db.system && db.system.advanced) || {}; }
export function screenSize() { const a = adv(); return { w: a.screenWidth || 816, h: a.screenHeight || 624 }; }
export function boxSize() { const a = adv(); return { w: (a.uiAreaWidth || 816) - 8, h: (a.uiAreaHeight || 624) - 8 }; }

// Imagem de amostra para as prévias de tom: a tela de título 1 do projeto (ou o 1º fundo de batalha).
export async function sampleImage() {
    const s = db.system || {};
    return (await projectImage("titles1", s.title1Name)) || (await projectImage("battlebacks1", (s.battleback1Name) || "Grassland"))
        || (await projectImage("battlebacks2", s.battleback2Name)) || null;
}

// ---------- ColorFilter ----------
// Igual ao shader do runtime: saturação (HSL) *= 1 - cinza/255, depois soma r,g,b (/255) e limita.
export function toneImageData(d, tone) {
    const [tr, tg, tb, gray] = tone;
    const sat = 1 - gray / 255;
    const a = d.data;
    for (let i = 0; i < a.length; i += 4) {
        let r = a[i] / 255, g = a[i + 1] / 255, b = a[i + 2] / 255;
        if (sat < 1) {
            const mn = Math.min(r, g, b), mx = Math.max(r, g, b), l = (mn + mx) / 2, delta = mx - mn;
            if (delta > 0) {
                let hh;
                if (r === mx) { hh = (((g - b) / delta + 6) % 6) / 6; } else if (g === mx) { hh = ((b - r) / delta + 2) / 6; } else { hh = ((r - g) / delta + 4) / 6; }
                let s = l < 1 ? delta / (1 - Math.abs(2 * l - 1)) : 0;
                s *= sat;
                const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((hh * 6) % 2) - 1)), m = l - c / 2;
                const cm = c + m, xm = x + m;
                if (hh < 1 / 6) { r = cm; g = xm; b = m; } else if (hh < 2 / 6) { r = xm; g = cm; b = m; } else if (hh < 3 / 6) { r = m; g = cm; b = xm; }
                else if (hh < 4 / 6) { r = m; g = xm; b = cm; } else if (hh < 5 / 6) { r = xm; g = m; b = cm; } else { r = cm; g = m; b = xm; }
            }
        }
        a[i] = Math.max(0, Math.min(255, (r + tr / 255) * 255));
        a[i + 1] = Math.max(0, Math.min(255, (g + tg / 255) * 255));
        a[i + 2] = Math.max(0, Math.min(255, (b + tb / 255) * 255));
    }
    return d;
}
// Desenha a imagem cobrindo o canvas (como Sprite com escala de tela) e aplica o tom.
export function drawToned(canvas, image, tone) {
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!image) { return; }
    const k = Math.max(canvas.width / image.width, canvas.height / image.height);
    const w = image.width * k, hh = image.height * k;
    ctx.drawImage(image, (canvas.width - w) / 2, (canvas.height - hh) / 2, w, hh);
    if (tone.some(v => v)) { ctx.putImageData(toneImageData(ctx.getImageData(0, 0, canvas.width, canvas.height), tone), 0, 0); }
}

// ---------- Janela ----------
// Window._refreshBack: fundo (0,0,96,96) esticado + padrão (0,96,96,96) em mosaico, margem 4,
// opacidade backOpacity e tom; Window._refreshFrame: moldura (96,0,96,96) em 9 partes com m = 24.
export function drawWindow(ctx, skin, x, y, w, hh, { tone = [0, 0, 0, 0], backOpacity = 192, frame = true } = {}) {
    if (!skin) { return; }
    const m = 4, bw = Math.max(0, w - m * 2), bh = Math.max(0, hh - m * 2);
    if (bw && bh) {
        const back = document.createElement("canvas");
        back.width = bw; back.height = bh;
        const b = back.getContext("2d");
        b.drawImage(skin, 0, 0, 96, 96, 0, 0, bw, bh);
        for (let ty = 0; ty < bh; ty += 96) { for (let tx = 0; tx < bw; tx += 96) { b.drawImage(skin, 0, 96, 96, 96, tx, ty, 96, 96); } }
        if (tone.some(v => v)) { b.putImageData(toneImageData(b.getImageData(0, 0, bw, bh), [tone[0], tone[1], tone[2], 0]), 0, 0); }
        ctx.save(); ctx.globalAlpha = backOpacity / 255; ctx.drawImage(back, x + m, y + m); ctx.restore();
    }
    if (!frame) { return; }
    const sx = 96, sy = 0, sw = 96, M = 24, smw = sw - M * 2;
    const dmw = w - M * 2, dmh = hh - M * 2;
    const part = (px, py, pw, ph, dx, dy, dw, dh) => { if (dw > 0 && dh > 0) { ctx.drawImage(skin, px, py, pw, ph, x + dx, y + dy, dw, dh); } };
    part(sx, sy, M, M, 0, 0, M, M); part(sx + sw - M, sy, M, M, w - M, 0, M, M);
    part(sx, sy + sw - M, M, M, 0, hh - M, M, M); part(sx + sw - M, sy + sw - M, M, M, w - M, hh - M, M, M);
    part(sx + M, sy, smw, M, M, 0, dmw, M); part(sx + M, sy + sw - M, smw, M, M, hh - M, dmw, M);
    part(sx, sy + M, M, smw, 0, M, M, dmh); part(sx + sw - M, sy + M, M, smw, w - M, M, M, dmh);
}
// Window_Base.refreshDimmerBitmap: degradê preto 0,6 nas bordas de 12 px (padding).
function drawDimmer(ctx, x, y, w, hh) {
    const m = 12, c1 = "rgba(0,0,0,0.6)", c2 = "rgba(0,0,0,0)";
    let g = ctx.createLinearGradient(0, y, 0, y + m); g.addColorStop(0, c2); g.addColorStop(1, c1);
    ctx.fillStyle = g; ctx.fillRect(x, y, w, m);
    ctx.fillStyle = c1; ctx.fillRect(x, y + m, w, hh - m * 2);
    g = ctx.createLinearGradient(0, y + hh - m, 0, y + hh); g.addColorStop(0, c1); g.addColorStop(1, c2);
    ctx.fillStyle = g; ctx.fillRect(x, y + hh - m, w, m);
}

// ---------- Texto com códigos de controle ----------
// Mesmo processamento do text_preview.js do editor MZ (e de Window_Base): \V[n] vira 0 (como na
// prévia do MZ, que não tem as variáveis do jogo), \N[n], \P[n], \G, \C[n], \I[n], \PX, \PY, \FS, \{ \}.
export function textColors(skin) {
    const out = [];
    if (!skin) { return out; }
    const c = document.createElement("canvas"); c.width = skin.width; c.height = skin.height;
    const x = c.getContext("2d"); x.drawImage(skin, 0, 0);
    for (let n = 0; n < 32; n++) {
        const d = x.getImageData(96 + (n % 8) * 12 + 6, 144 + Math.floor(n / 8) * 12 + 6, 1, 1).data;
        out.push(`rgb(${d[0]},${d[1]},${d[2]})`);
    }
    return out;
}
export function convertEscapes(text) {
    const s = db.system || {};
    return text.replace(/\\/g, "\x1b").replace(/\x1b\x1b/g, "\\")
        .replace(/\x1bV\[(\d+)\]/gi, () => "0")
        .replace(/\x1bN\[(\d+)\]/gi, (_, n) => db.name("actors", Number(n)))
        .replace(/\x1bP\[(\d+)\]/gi, (_, n) => db.name("actors", (s.partyMembers || [])[Number(n) - 1]))
        .replace(/\x1bG/gi, s.currencyUnit || "");
}
export class TextPainter {
    constructor(ctx, { colors = [], icons = null, fontSize = adv().fontSize || 26, fallback = adv().fallbackFonts || "Verdana, sans-serif", fontFamily = "evGameFont" } = {}) {
        Object.assign(this, { ctx, colors, icons, defaultFontSize: fontSize, fallback, fontFamily });
        this.fontSize = fontSize;
        this.color = colors[0] || "#fff";
    }
    font() { return `${this.fontSize}px ${this.fontFamily}, ${this.fallback}`; }
    width(s) { this.ctx.font = this.font(); return this.ctx.measureText(s).width; }
    // Desenha (ou mede, se draw = false) o texto a partir de (x, y); devolve {width, height, y}.
    draw(text, x, y, { draw = true, maxHeight = Infinity } = {}) {
        this.fontSize = this.defaultFontSize; this.color = this.colors[0] || "#fff";
        const src = convertEscapes(text);
        const st = { x, y, startX: x, startY: y, buf: "", i: 0, h: 0, maxW: 0 };
        const lineH = () => {
            const save = this.fontSize; let mx = this.fontSize;
            const line = src.slice(st.i).split("\n")[0];
            for (const m of line.matchAll(/\x1b({|}|FS)(\[(\d+)\])?/gi)) {
                const c = m[1].toUpperCase();
                if (c === "{") { if (this.fontSize <= 96) { this.fontSize += 12; } } else if (c === "}") { if (this.fontSize >= 24) { this.fontSize -= 12; } } else { this.fontSize = Number(m[3]); }
                mx = Math.max(mx, this.fontSize);
            }
            this.fontSize = save;
            return mx + (36 - this.defaultFontSize);
        };
        st.h = lineH();
        const flush = () => {
            const w = this.width(st.buf);
            if (draw && st.buf && st.y + st.h <= maxHeight + 0.5) {
                const ctx = this.ctx, ty = st.y + st.h - (st.h - this.fontSize * 0.7) / 2;
                ctx.font = this.font(); ctx.lineWidth = 3; ctx.lineJoin = "round"; ctx.strokeStyle = "rgba(0,0,0,0.6)";
                ctx.strokeText(st.buf, st.x, ty); ctx.fillStyle = this.color; ctx.fillText(st.buf, st.x, ty);
            }
            st.x += w; st.buf = "";
            st.maxW = Math.max(st.maxW, st.x - st.startX);
        };
        const param = () => { const m = /^\[(\d+)\]/.exec(src.slice(st.i)); if (m) { st.i += m[0].length; return Number(m[1]); } return ""; };
        while (st.i < src.length) {
            const c = src[st.i++];
            if (c.charCodeAt(0) >= 0x20) { st.buf += c; continue; }
            flush();
            if (c === "\n") { st.x = st.startX; st.y += st.h; st.h = lineH(); continue; }
            if (c !== "\x1b") { continue; }
            const m = /^[$.|^!><{}\\]|^[A-Z]+/i.exec(src.slice(st.i));
            const code = m ? m[0].toUpperCase() : "";
            if (m) { st.i += m[0].length; }
            switch (code) {
                case "C": { const n = param(); this.color = this.colors[n] || this.color; break; }
                case "I": {
                    const n = param();
                    if (draw && this.icons && st.y + st.h <= maxHeight + 0.5) { this.ctx.drawImage(this.icons, (n % 16) * 32, Math.floor(n / 16) * 32, 32, 32, st.x + 2, st.y + 2, 32, 32); }
                    st.x += 36; st.maxW = Math.max(st.maxW, st.x - st.startX); break;
                }
                case "PX": st.x = st.startX + Number(param() || 0); break;
                case "PY": st.y = st.startY + Number(param() || 0); break;
                case "FS": this.fontSize = Number(param() || this.defaultFontSize); break;
                case "{": if (this.fontSize <= 96) { this.fontSize += 12; } break;
                case "}": if (this.fontSize >= 24) { this.fontSize -= 12; } break;
            }
        }
        flush();
        return { width: st.maxW, height: st.y - st.startY + st.h, y: st.y };
    }
}

// ---------- Prévia do Show Text ----------
// Uma tela por página (4 linhas na janela, como Window_Message.needsNewPage), com a janela na
// posição (Top/Middle/Bottom), o fundo (Window/Dim/Transparent), rosto, nome e o tom do System.
export async function renderMessagePages(host, { face, name, lines, background = 0, position = 2 }) {
    host.innerHTML = "";
    await loadGameFont();
    const skin = await projectImage("system", "Window");
    const icons = await projectImage("system", "IconSet");
    const faceImg = face && face.name ? await projectImage("faces", face.name) : null;
    const colors = textColors(skin);
    const scr = screenSize(), box = boxSize();
    const bx = (scr.w - box.w) / 2, by = (scr.h - box.h) / 2;
    const ww = box.w, wh = 4 * 36 + 24 + 8;
    const wy = by + (position * (box.h - wh)) / 2;
    const tone = (db.system && db.system.windowTone) || [0, 0, 0, 0];
    const opacity = 192; // Window_Base.updateBackOpacity
    // Quebra de página como Window_Message.needsNewPage: a linha que passaria da altura do conteúdo
    // (innerHeight = 152) vai para a página seguinte (linhas com \{ ou \FS são mais altas).
    const meas = new TextPainter(document.createElement("canvas").getContext("2d"), { colors });
    const pages = [];
    let cur = [];
    for (const line of lines.length ? lines : [""]) {
        if (cur.length && meas.draw([...cur, line].join("\n"), 0, 0, { draw: false }).height > wh - 24) { pages.push(cur); cur = []; }
        cur.push(line);
    }
    pages.push(cur);
    const bg = await sampleImage();
    for (const page of pages) {
        const cv = h("canvas", { class: "evMsgPvCanvas" });
        cv.width = scr.w; cv.height = scr.h;
        const ctx = cv.getContext("2d");
        drawToned(cv, bg, [0, 0, 0, 0]); // cena de fundo para dar para ver Janela / Escurecer / Transparente
        ctx.strokeStyle = "rgba(255,255,255,0.15)"; ctx.strokeRect(bx + 0.5, by + 0.5, box.w - 1, box.h - 1);
        const painter = new TextPainter(ctx, { colors, icons });
        const paintWin = (x, y, w, hh) => {
            if (background === 0) { drawWindow(ctx, skin, x, y, w, hh, { tone, backOpacity: opacity }); } else if (background === 1) { drawDimmer(ctx, x, y, w, hh); }
        };
        paintWin(bx, wy, ww, wh);
        const cx = bx + 12, cy = wy + 12, ch = wh - 24;
        ctx.save(); ctx.beginPath(); ctx.rect(cx, cy, ww - 24, ch); ctx.clip();
        if (faceImg) {
            const fw = faceImg.width / 4, fh = faceImg.height / 2, fi = face.index || 0;
            ctx.drawImage(faceImg, (fi % 4) * fw, Math.floor(fi / 4) * fh, fw, fh, cx, cy + (ch - 144) / 2, 144, 144);
        }
        painter.draw(page.join("\n"), cx + (faceImg ? 164 : 4), cy, { maxHeight: cy + ch });
        ctx.restore();
        if (name) {
            const nw = Math.ceil(new TextPainter(ctx, { colors }).draw(name, 0, 0, { draw: false }).width) + 24 + 16, nh = 36 + 24;
            const ny = wy > by ? wy - nh : wy + wh;
            paintWin(bx, ny, nw, nh);
            new TextPainter(ctx, { colors, icons }).draw(name, bx + 12 + 8, ny + 12);
        }
        pages.length > 1 && host.append(h("div", { class: "evDesc" }, `${pages.indexOf(page) + 1}/${pages.length}`));
        host.append(cv);
    }
}

// ---------- Fundo de batalha ----------
// As duas camadas como Sprite_Battleback.adjustPosition: área 1000×740 (proporcional à tela),
// centralizada na horizontal, no topo (ou embaixo na visão lateral), escala ≥ 1 para cobrir.
export async function drawBattleback(canvas, name1, name2) {
    const scr = screenSize();
    canvas.width = scr.w; canvas.height = scr.h;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, scr.w, scr.h);
    const W = Math.floor((1000 * scr.w) / 816), H = Math.floor((740 * scr.h) / 624);
    const x = (scr.w - W) / 2, y = db.system && db.system.optSideView ? scr.h - H : 0;
    for (const [folder, n] of [["battlebacks1", name1], ["battlebacks2", name2]]) {
        const im = await projectImage(folder, n);
        if (!im) { continue; }
        const k = Math.max(W / im.width, H / im.height, 1);
        ctx.drawImage(im, x, y, im.width * k, im.height * k);
    }
}

// ---------- Prévia do Show Scrolling Text ----------
// Window_ScrollText (rmmz_windows.js): janela sem moldura/fundo (opacity 0) do tamanho da área de UI
// (Scene_Message.scrollTextWindowRect), padding 12; o texto (drawTextEx em baseTextRect: x = 8) começa
// com origin.y = -altura da janela e sobe velocidade/2 px por quadro (×3 com OK/Shift/toque segurado,
// a não ser com "No Fast Forward"); acaba quando origin.y >= altura do conteúdo (textSizeEx). 60 quadros/s.
// Devolve { stop() }; segurar o dedo/mouse na prévia acelera como no jogo.
export async function playScrollText(host, { lines, speed = 2, noFast = false, onEnd }) {
    host.innerHTML = "";
    await loadGameFont();
    const skin = await projectImage("system", "Window");
    const icons = await projectImage("system", "IconSet");
    const colors = textColors(skin);
    const scr = screenSize(), box = boxSize();
    const bx = (scr.w - box.w) / 2, by = (scr.h - box.h) / 2;
    const pad = 12, innerW = box.w - pad * 2, innerH = box.h - pad * 2;
    const text = lines.join("\n");
    const meas = new TextPainter(document.createElement("canvas").getContext("2d"), { colors });
    const contentsH = Math.max(1, meas.draw(text, 0, 0, { draw: false }).height);
    // conteúdo pré-desenhado (como o bitmap contents do runtime)
    const contents = document.createElement("canvas");
    contents.width = innerW; contents.height = contentsH;
    new TextPainter(contents.getContext("2d"), { colors, icons }).draw(text, 8, 0, { maxHeight: contentsH });
    const bg = await sampleImage();
    const back = document.createElement("canvas");
    back.width = scr.w; back.height = scr.h;
    drawToned(back, bg, [0, 0, 0, 0]);
    const cv = h("canvas", { class: "evMsgPvCanvas evScrollPv" });
    cv.width = scr.w; cv.height = scr.h;
    const info = h("div", { class: "evDesc" });
    host.append(cv, info);
    const ctx = cv.getContext("2d");
    let originY = -box.h, frame = 0, held = false, raf = 0, last = performance.now(), acc = 0, done = false;
    const down = e => { held = true; e.preventDefault(); };
    const up = () => { held = false; };
    cv.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    const paint = () => {
        ctx.drawImage(back, 0, 0);
        ctx.strokeStyle = "rgba(255,255,255,0.15)"; ctx.strokeRect(bx + 0.5, by + 0.5, box.w - 1, box.h - 1);
        ctx.save(); ctx.beginPath(); ctx.rect(bx + pad, by + pad, innerW, innerH); ctx.clip();
        ctx.drawImage(contents, bx + pad, by + pad - Math.round(originY));
        ctx.restore();
        info.textContent = `${(frame / 60).toFixed(1)} s · ${Math.max(0, Math.round(originY + box.h))}/${contentsH + box.h} px`;
    };
    const step = () => {
        let v = speed / 2;
        if (!noFast && held) { v *= 3; } // Window_ScrollText.fastForwardRate
        originY += v; frame++;
        if (originY >= contentsH) { done = true; }
    };
    const loop = now => {
        acc += Math.min(250, now - last); last = now;
        while (acc >= 1000 / 60 && !done) { acc -= 1000 / 60; step(); }
        paint();
        if (done) { cleanup(); if (onEnd) { onEnd(frame); } return; }
        raf = requestAnimationFrame(loop);
    };
    const cleanup = () => { cancelAnimationFrame(raf); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up); };
    paint();
    raf = requestAnimationFrame(t0 => { last = t0; loop(t0); });
    return { stop: () => { done = true; cleanup(); } };
}
