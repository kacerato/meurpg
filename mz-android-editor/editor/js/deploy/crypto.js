// MD5 (RFC 1321) e o formato de criptografia de assets do RPG Maker MZ.
//
// Formato (o que Utils.decryptArrayBuffer em rmmz_core.js desfaz):
//   [16 bytes de cabeçalho "RPGMV\0\0\0\0\x03\x01\0\0\0\0\0"]
//   [16 primeiros bytes do arquivo original XOR chave]
//   [restante do arquivo original sem alteração]
// A chave é System.json.encryptionKey: 32 dígitos hex = MD5 da senha digitada (como o MZ/MV).
// Arquivos criptografados ganham "_" no final da extensão: .png_ .ogg_ .m4a_

export const RPGMV_HEADER = Uint8Array.from([0x52, 0x50, 0x47, 0x4d, 0x56, 0, 0, 0, 0, 0x03, 0x01, 0, 0, 0, 0, 0]);

const S = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];
const K = new Uint32Array(64);
for (let i = 0; i < 64; i++) {
    K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000) >>> 0;
}

// MD5 de bytes (Uint8Array) ou de texto (codificado em UTF-8). Devolve hex minúsculo.
export function md5(input) {
    const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
    const len = bytes.length;
    const total = (((len + 8) >> 6) + 1) << 6;
    const buf = new Uint8Array(total);
    buf.set(bytes);
    buf[len] = 0x80;
    const dv = new DataView(buf.buffer);
    dv.setUint32(total - 8, (len * 8) >>> 0, true);
    dv.setUint32(total - 4, Math.floor(len / 0x20000000), true);
    let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
    const M = new Uint32Array(16);
    for (let off = 0; off < total; off += 64) {
        for (let i = 0; i < 16; i++) {
            M[i] = dv.getUint32(off + i * 4, true);
        }
        let A = a0, B = b0, C = c0, D = d0;
        for (let i = 0; i < 64; i++) {
            let F, g;
            if (i < 16) { F = (B & C) | (~B & D); g = i; }
            else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) & 15; }
            else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) & 15; }
            else { F = C ^ (B | ~D); g = (7 * i) & 15; }
            F = (F + A + K[i] + M[g]) >>> 0;
            A = D; D = C; C = B;
            B = (B + ((F << S[i]) | (F >>> (32 - S[i])))) >>> 0;
        }
        a0 = (a0 + A) >>> 0; b0 = (b0 + B) >>> 0; c0 = (c0 + C) >>> 0; d0 = (d0 + D) >>> 0;
    }
    let hex = "";
    for (const w of [a0, b0, c0, d0]) {
        for (let i = 0; i < 4; i++) {
            hex += ((w >>> (i * 8)) & 0xff).toString(16).padStart(2, "0");
        }
    }
    return hex;
}

export function keyBytes(keyHex) {
    const out = new Uint8Array(16);
    for (let i = 0; i < 16; i++) {
        out[i] = parseInt(keyHex.substr(i * 2, 2), 16);
    }
    return out;
}

// Criptografa um arquivo (Uint8Array) no formato que rmmz_core.js lê.
export function encryptAsset(data, keyHex) {
    const key = keyBytes(keyHex);
    const out = new Uint8Array(16 + data.length);
    out.set(RPGMV_HEADER, 0);
    out.set(data, 16);
    for (let i = 0; i < 16 && i < data.length; i++) {
        out[16 + i] ^= key[i];
    }
    return out;
}

// Inverso (para autoteste): mesmo algoritmo de Utils.decryptArrayBuffer.
export function decryptAsset(data, keyHex) {
    for (let i = 0; i < 16; i++) {
        if (data[i] !== RPGMV_HEADER[i]) {
            throw new Error("Decryption error");
        }
    }
    const key = keyBytes(keyHex);
    const body = data.slice(16);
    for (let i = 0; i < 16 && i < body.length; i++) {
        body[i] ^= key[i];
    }
    return body;
}

// Quais arquivos o MZ criptografa: imagens .png em img/ e áudio .ogg/.m4a em audio/.
export function encryptKind(path) {
    const p = path.toLowerCase();
    if (p.startsWith("img/") && p.endsWith(".png")) {
        return "image";
    }
    if (p.startsWith("audio/") && (p.endsWith(".ogg") || p.endsWith(".m4a"))) {
        return "audio";
    }
    return null;
}
