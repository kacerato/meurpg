// Codec PNG mínimo (RGBA 8 bits não pré-multiplicado).
// Decodificamos nós mesmos para obter os valores exatos dos pixels: o canvas do navegador
// aplica gestão de cor/gama e pré-multiplica o alfa, o que quebraria a comparação das
// cores-chave das máscaras (_c.png) e a colorização por gradiente (mesmo resultado do MZ).

async function inflate(bytes) {
    const ds = new DecompressionStream("deflate");
    const stream = new Blob([bytes]).stream().pipeThrough(ds);
    return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function deflate(bytes) {
    const cs = new CompressionStream("deflate");
    const stream = new Blob([bytes]).stream().pipeThrough(cs);
    return new Uint8Array(await new Response(stream).arrayBuffer());
}

const ADAM7 = [[0, 0, 8, 8], [4, 0, 8, 8], [0, 4, 4, 8], [2, 0, 4, 4], [0, 2, 2, 4], [1, 0, 2, 2], [0, 1, 1, 2]];

// Devolve {width, height, data: Uint8ClampedArray RGBA}.
export async function decodePng(buffer) {
    const b = new Uint8Array(buffer);
    const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
    if (dv.getUint32(0) !== 0x89504e47) {
        throw new Error("não é PNG");
    }
    let p = 8, w = 0, h = 0, bd = 8, ct = 6, il = 0, plte = null, trns = null;
    const idat = [];
    while (p < b.length) {
        const len = dv.getUint32(p);
        const type = String.fromCharCode(b[p + 4], b[p + 5], b[p + 6], b[p + 7]);
        const d = b.subarray(p + 8, p + 8 + len);
        if (type === "IHDR") {
            w = dv.getUint32(p + 8); h = dv.getUint32(p + 12);
            bd = d[8]; ct = d[9]; il = d[12];
        } else if (type === "IDAT") {
            idat.push(d);
        } else if (type === "PLTE") {
            plte = d;
        } else if (type === "tRNS") {
            trns = d;
        } else if (type === "IEND") {
            break;
        }
        p += 12 + len;
    }
    let total = 0;
    for (const d of idat) { total += d.length; }
    const z = new Uint8Array(total);
    let o = 0;
    for (const d of idat) { z.set(d, o); o += d.length; }
    const raw = await inflate(z);
    const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ct];
    const bitsPP = ch * bd;
    const bpp = Math.max(1, bitsPP >> 3);
    const out = new Uint8ClampedArray(w * h * 4);
    const maxv = (1 << bd) - 1;
    let q = 0;
    const passes = il ? ADAM7 : [[0, 0, 1, 1]];
    for (const [x0, y0, dx, dy] of passes) {
        const pw = Math.ceil((w - x0) / dx), ph = Math.ceil((h - y0) / dy);
        if (pw <= 0 || ph <= 0) {
            continue;
        }
        const stride = Math.ceil(pw * bitsPP / 8);
        let prev = new Uint8Array(stride);
        let line = new Uint8Array(stride);
        for (let yy = 0; yy < ph; yy++) {
            const f = raw[q++];
            line.set(raw.subarray(q, q + stride));
            q += stride;
            for (let i = 0; i < stride; i++) {
                const a = i >= bpp ? line[i - bpp] : 0, up = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
                let v = line[i];
                if (f === 1) { v += a; }
                else if (f === 2) { v += up; }
                else if (f === 3) { v += (a + up) >> 1; }
                else if (f === 4) {
                    const pp = a + up - c, pa = Math.abs(pp - a), pb = Math.abs(pp - up), pc = Math.abs(pp - c);
                    v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? up : c);
                }
                line[i] = v & 255;
            }
            const sample = (xi, k) => {
                if (bd === 8) { return line[xi * ch + k]; }
                if (bd === 16) { return line[(xi * ch + k) * 2]; }
                const bit = (xi * ch + k) * bd;
                return (line[bit >> 3] >> (8 - bd - (bit & 7))) & maxv;
            };
            const y = y0 + yy * dy;
            for (let xx = 0; xx < pw; xx++) {
                const x = x0 + xx * dx;
                const di = (y * w + x) * 4;
                let r, g, bb, al = 255;
                if (ct === 6) { r = sample(xx, 0); g = sample(xx, 1); bb = sample(xx, 2); al = sample(xx, 3); }
                else if (ct === 2) {
                    r = sample(xx, 0); g = sample(xx, 1); bb = sample(xx, 2);
                    if (trns && trns.length >= 6 && bd === 8 && r === trns[1] && g === trns[3] && bb === trns[5]) { al = 0; }
                }
                else if (ct === 0) {
                    const s = sample(xx, 0);
                    r = g = bb = bd < 8 ? Math.round(s * 255 / maxv) : s;
                }
                else if (ct === 4) { r = g = bb = sample(xx, 0); al = sample(xx, 1); }
                else {
                    const i = sample(xx, 0);
                    r = plte[i * 3]; g = plte[i * 3 + 1]; bb = plte[i * 3 + 2];
                    al = trns && i < trns.length ? trns[i] : 255;
                }
                out[di] = r; out[di + 1] = g; out[di + 2] = bb; out[di + 3] = al;
            }
            const t = prev; prev = line; line = t;
        }
    }
    return { width: w, height: h, data: out };
}

const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) { c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; }
        t[n] = c >>> 0;
    }
    return t;
})();

function crc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) { c = CRC_TABLE[(c ^ bytes[i]) & 255] ^ (c >>> 8); }
    return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
    const out = new Uint8Array(12 + data.length);
    const dv = new DataView(out.buffer);
    dv.setUint32(0, data.length);
    for (let i = 0; i < 4; i++) { out[4 + i] = type.charCodeAt(i); }
    out.set(data, 8);
    dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
    return out;
}

// Codifica RGBA 8 bits (sem perdas) em PNG. Devolve Blob image/png.
export async function encodePng(img) {
    const { width: w, height: h, data } = img;
    const stride = w * 4;
    const raw = new Uint8Array((stride + 1) * h);
    for (let y = 0; y < h; y++) {
        // filtro Sub: comprime bem sprites com áreas transparentes
        const ro = y * (stride + 1);
        raw[ro] = 1;
        const so = y * stride;
        for (let i = 0; i < stride; i++) {
            raw[ro + 1 + i] = (data[so + i] - (i >= 4 ? data[so + i - 4] : 0)) & 255;
        }
    }
    const ihdr = new Uint8Array(13);
    const dv = new DataView(ihdr.buffer);
    dv.setUint32(0, w); dv.setUint32(4, h);
    ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
    const sig = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const idat = await deflate(raw);
    return new Blob([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", new Uint8Array(0))], { type: "image/png" });
}

export function createImage(width, height) {
    return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}
