// Montagem das imagens do gerador (rosto, andando, caído, battler SV).
// Reproduz Layout_CharacterGenerator.refreshComposer() + ImageComposer (C++) do MZ:
//  - camadas desenhadas na ordem de LAYER_ORDERS (de baixo para cima);
//  - em cada parte, os arquivos _c1.._cN são desenhados do último para o primeiro;
//  - colorização: índice = 255 - qGray(r,g,b) (qGray = (r*11 + g*16 + b*5) / 32),
//    cor = linha do gradiente escolhida na posição do índice; alfa original preservado;
//  - rosto: cada arquivo _cK_mNNN pertence à máscara NNN; sem _m = não colorível;
//  - andando/caído/SV: a máscara <nome>_c.png indica, pixel a pixel, a cor-chave da máscara;
//  - paleta comum (tipo 3): cor 0 = cores originais (sem colorir); demais paletas sempre colorem.

import { decodePng, createImage } from "./png.js";
import {
    LAYER_ORDERS, LAYERGROUP_LIST as LAYERGROUP_KEYS, MASK_ID_LIST, EYE_MASK, SKIN_MASK, PALETTE_FILES,
    layergroupToPaletteType, layergroupToMaskIDs, isDefaultSet
} from "./data.js";

export const BASE = new URL("../../generator/", import.meta.url).href;

const SIZES = {
    face: [144, 144],
    tv: [144, 192],
    tvd: [144, 48],
    sv: [576, 384]
};

// ---------- carregamento ----------

const imageCache = new Map();

export function loadImage(path) {
    let p = imageCache.get(path);
    if (!p) {
        p = fetch(BASE + path).then(r => {
            if (!r.ok) { throw new Error(path + ": " + r.status); }
            return r.arrayBuffer();
        }).then(decodePng);
        imageCache.set(path, p);
        p.catch(() => imageCache.delete(path));
    }
    return p;
}

let manifestPromise = null;
export function loadManifest() {
    if (!manifestPromise) {
        manifestPromise = fetch(BASE + "manifest.json").then(r => r.json());
    }
    return manifestPromise;
}

const TYPE_DIRS = { face: "Face", tv: "TV", tvd: "TVD", sv: "SV", variation: "Variation" };
const GENDER_DIRS = { male: "Male", female: "Female", kid: "Kid" };

// dataAssets[type][layer][pattern] = [caminhos] (mesma estrutura do exploreAssets() do MZ).
export async function buildAssets(gender) {
    const manifest = await loadManifest();
    const g = manifest[gender] || {};
    const assets = {};
    for (const type of Object.keys(TYPE_DIRS)) {
        const byLayer = assets[type] = {};
        for (const file of g[type] || []) {
            const base = file.replace(/\.[^/.]+$/, "");
            const m = base.match(/^[^_]+_([^_]+)_([^_.]+)/);
            if (!m) { continue; }
            const layer = m[1].toLowerCase();
            const pattern = m[2];
            ((byLayer[layer] ??= {})[pattern] ??= []).push(`${TYPE_DIRS[type]}/${GENDER_DIRS[gender]}/${file}`);
        }
        for (const layer of Object.values(byLayer)) {
            for (const list of Object.values(layer)) { list.sort(); }
        }
    }
    return assets;
}

export function patternKeyList(assets, lg) {
    return Object.keys(assets.variation[lg] || {}).sort();
}

export function firstPatternName(assets, lg) {
    for (const type of ["variation", "face", "tv", "sv", "tvd"]) {
        const keys = Object.keys(assets[type][lg] || {}).sort();
        if (keys.length) { return keys[0]; }
    }
    return "";
}

export function makeDefaultData(assets, maskIDs = MASK_ID_LIST) {
    const patterns = { body: firstPatternName(assets, "body") };
    const offsets = {};
    for (const lg of LAYERGROUP_KEYS) {
        patterns[lg] = isDefaultSet(lg) ? firstPatternName(assets, lg) : "";
        offsets[lg] = { x: 0, y: 0 };
    }
    const colors = {};
    for (const id of maskIDs) { colors[id] = 0; }
    return { patterns, colors, offsets };
}

// ---------- gradientes ----------

let gradientsPromise = null;
export function loadGradients() {
    if (!gradientsPromise) {
        gradientsPromise = Promise.all(PALETTE_FILES.map(f => loadImage(f)));
    }
    return gradientsPromise;
}

// Cada faixa de 4 px de altura é um gradiente de 256 cores (claro → escuro).
export const GRADIENT_BAND = 4;
const GRADIENT_SAMPLE_Y = 0;

export function paletteLength(gradImage) {
    return Math.floor(gradImage.height / GRADIENT_BAND);
}

const rowCache = new WeakMap();
export function gradientRow(gradImage, index) {
    let rows = rowCache.get(gradImage);
    if (!rows) { rows = []; rowCache.set(gradImage, rows); }
    if (!rows[index]) {
        const y = Math.min(gradImage.height - 1, index * GRADIENT_BAND + GRADIENT_SAMPLE_Y);
        const row = new Uint8Array(256 * 3);
        for (let x = 0; x < 256; x++) {
            const o = (y * gradImage.width + Math.min(x, gradImage.width - 1)) * 4;
            row[x * 3] = gradImage.data[o];
            row[x * 3 + 1] = gradImage.data[o + 1];
            row[x * 3 + 2] = gradImage.data[o + 2];
        }
        rows[index] = row;
    }
    return rows[index];
}

function hexToInt(hex) {
    return parseInt(hex.slice(1), 16);
}

// ---------- colorização ----------

function recolorAll(src, row) {
    const out = new Uint8ClampedArray(src.data);
    const d = out;
    for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] === 0) { continue; }
        const k = (255 - ((d[i] * 11 + d[i + 1] * 16 + d[i + 2] * 5) >> 5)) * 3;
        d[i] = row[k]; d[i + 1] = row[k + 1]; d[i + 2] = row[k + 2];
    }
    return { width: src.width, height: src.height, data: out };
}

// rows[k] = linha do gradiente para a máscara maskInts[k] (ou null = sem colorir).
function recolorWithMask(src, mask, maskInts, rows) {
    const out = new Uint8ClampedArray(src.data);
    const d = out, m = mask.data;
    const w = Math.min(src.width, mask.width), h = Math.min(src.height, mask.height);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const i = (y * src.width + x) * 4;
            if (d[i + 3] === 0) { continue; }
            const mi = (y * mask.width + x) * 4;
            if (m[mi + 3] === 0) { continue; }
            const key = (m[mi] << 16) | (m[mi + 1] << 8) | m[mi + 2];
            const k = maskInts.indexOf(key);
            if (k < 0 || !rows[k]) { continue; }
            const row = rows[k];
            const g = (255 - ((d[i] * 11 + d[i + 1] * 16 + d[i + 2] * 5) >> 5)) * 3;
            d[i] = row[g]; d[i + 1] = row[g + 1]; d[i + 2] = row[g + 2];
        }
    }
    return { width: src.width, height: src.height, data: out };
}

// Cores-chave presentes numa máscara (ImageComposer.makeMaskList).
const maskListCache = new WeakMap();
function makeMaskList(mask) {
    let list = maskListCache.get(mask);
    if (!list) {
        const set = new Set();
        const m = mask.data;
        for (let i = 0; i < m.length; i += 4) {
            if (m[i + 3] !== 0) { set.add((m[i] << 16) | (m[i + 1] << 8) | m[i + 2]); }
        }
        list = MASK_ID_LIST.filter(id => set.has(hexToInt(id)));
        maskListCache.set(mask, list);
    }
    return list;
}

// Desenho "source-over" em alfa não pré-multiplicado (como QPainter + QImage::save).
export function drawOver(dst, src, dx = 0, dy = 0) {
    const D = dst.data, S = src.data;
    for (let sy = 0; sy < src.height; sy++) {
        const y = sy + dy;
        if (y < 0 || y >= dst.height) { continue; }
        for (let sx = 0; sx < src.width; sx++) {
            const x = sx + dx;
            if (x < 0 || x >= dst.width) { continue; }
            const si = (sy * src.width + sx) * 4;
            const sa = S[si + 3];
            if (sa === 0) { continue; }
            const di = (y * dst.width + x) * 4;
            const da = D[di + 3];
            if (sa === 255 || da === 0) {
                D[di] = S[si]; D[di + 1] = S[si + 1]; D[di + 2] = S[si + 2]; D[di + 3] = sa;
                continue;
            }
            const a = sa / 255, b = (da / 255) * (1 - a), oa = a + b;
            D[di] = (S[si] * a + D[di] * b) / oa;
            D[di + 1] = (S[si + 1] * a + D[di + 1] * b) / oa;
            D[di + 2] = (S[si + 2] * a + D[di + 2] * b) / oa;
            D[di + 3] = oa * 255;
        }
    }
}

// Copia src para dst substituindo a área (usado ao inserir na folha exportada).
export function blit(dst, src, dx, dy) {
    for (let sy = 0; sy < src.height; sy++) {
        const y = sy + dy;
        if (y < 0 || y >= dst.height) { continue; }
        const x0 = Math.max(0, dx), x1 = Math.min(dst.width, dx + src.width);
        if (x1 <= x0) { continue; }
        const so = (sy * src.width + (x0 - dx)) * 4;
        dst.data.set(src.data.subarray(so, so + (x1 - x0) * 4), (y * dst.width + x0) * 4);
    }
}

// ---------- montagem ----------

const recolorCache = new Map();
const RECOLOR_CACHE_MAX = 300;
function cached(key, make) {
    let v = recolorCache.get(key);
    if (v) {
        recolorCache.delete(key);
        recolorCache.set(key, v);
        return v;
    }
    v = make();
    recolorCache.set(key, v);
    if (recolorCache.size > RECOLOR_CACHE_MAX) {
        recolorCache.delete(recolorCache.keys().next().value);
    }
    return v;
}

function pathNameToMaskID(path) {
    const base = path.replace(/^.*\//, "").replace(/\.[^/.]+$/, "");
    const m = base.match(/.*_m(\d+)$/);
    if (!m) { return "#FFFFFF"; }
    return MASK_ID_LIST[Number(m[1]) - 1] || "#FFFFFF";
}

function isMaskImageName(path) {
    return /_c$/.test(path.replace(/\.[^/.]+$/, ""));
}

function makeMaskImageName(path) {
    return path.replace(/(.*)(\.[^.]+)$/, "$1_c$2");
}

// data: {patterns, colors, offsets}; devolve {image, available:Set<maskID>}.
export async function compose(type, assets, data) {
    const [w, h] = SIZES[type];
    const out = createImage(w, h);
    const available = new Set();
    const grads = await loadGradients();
    const eyesGrad = grads[1], skinGrad = grads[2];
    const order = LAYER_ORDERS[type];

    // Carrega em paralelo tudo o que vai ser usado.
    const plan = [];
    for (const layer of order) {
        const lg = layer.replace(/\d$/, "");
        const pattern = data.patterns[lg];
        if (!pattern || !assets[type][layer] || !assets[type][layer][pattern]) { continue; }
        plan.push({ layer, lg, files: assets[type][layer][pattern].slice().reverse() });
    }
    const all = new Set();
    for (const p of plan) { for (const f of p.files) { all.add(f); } }
    const images = new Map();
    await Promise.all([...all].map(f => loadImage(f).then(img => images.set(f, img), () => {})));

    for (const { lg, files } of plan) {
        const paletteType = layergroupToPaletteType(lg);
        const grad = grads[paletteType];
        const lgMasks = layergroupToMaskIDs(lg);
        const maskIDs = [], colors = [];
        for (const id of lgMasks) {
            const c = data.colors[id] | 0;
            if (paletteType < 3 || c > 0) { maskIDs.push(id); colors.push(c); }
        }
        const eyeIndex = lgMasks.indexOf(EYE_MASK);
        let ox = 0, oy = 0;
        if (type === "face") {
            const off = data.offsets[lg];
            if (off) { ox = off.x | 0; oy = off.y | 0; }
        }
        for (const file of files) {
            if (isMaskImageName(file)) { continue; }
            const img = images.get(file);
            if (!img) { continue; }
            let layerImg = img;
            if (type === "face") {
                const maskID = pathNameToMaskID(file);
                let row = null, rowGrad = grad, rowIndex = -1;
                if (lgMasks.includes(maskID)) {
                    available.add(maskID);
                    const c = data.colors[maskID] | 0;
                    if (paletteType < 3 || c > 0) { rowIndex = c; }
                }
                if (lg === "eyebrows" && maskID === SKIN_MASK) {
                    rowGrad = skinGrad;
                    rowIndex = data.colors[SKIN_MASK] | 0;
                }
                if (rowIndex >= 0 && rowIndex < paletteLength(rowGrad)) {
                    row = gradientRow(rowGrad, rowIndex);
                    const key = `${file}|${PALETTE_FILES[grads.indexOf(rowGrad)]}|${rowIndex}`;
                    layerImg = cached(key, () => recolorAll(img, row));
                }
            } else {
                const maskPath = makeMaskImageName(file);
                const hasMask = files.includes(maskPath);
                if (hasMask) {
                    const mask = images.get(maskPath);
                    if (mask) {
                        // cores "disponíveis": as que aparecem em qualquer imagem (andando, caído, SV)
                        for (const id of makeMaskList(mask)) { available.add(id); }
                        const rows = maskIDs.map((id, k) => {
                            const g = (lgMasks.indexOf(id) === eyeIndex && eyeIndex >= 0) ? eyesGrad : grad;
                            return colors[k] < paletteLength(g) ? gradientRow(g, colors[k]) : null;
                        });
                        const key = `${file}|${maskIDs.join(",")}|${colors.join(",")}|${paletteType}`;
                        const maskInts = maskIDs.map(hexToInt);
                        layerImg = cached(key, () => recolorWithMask(img, mask, maskInts, rows));
                    }
                }
            }
            drawOver(out, layerImg, ox, oy);
        }
    }
    return { image: out, available };
}

export function imageToCanvas(img, canvas) {
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    ctx.putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0);
    return canvas;
}
