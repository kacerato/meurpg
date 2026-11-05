// Escritor ZIP mínimo (STORED + DEFLATE via CompressionStream("deflate-raw")), sem ZIP64.
// Uso: const z = new ZipWriter(); await z.add("www/index.html", bytes); const blob = z.finish();
// As partes ficam em Blobs, então o navegador pode manter os dados fora do heap JS.

import { t } from "../i18n.js";

const CRC_TABLE = (() => {
    const tbl = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) {
            c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        }
        tbl[n] = c >>> 0;
    }
    return tbl;
})();

export function crc32(data) {
    let c = 0xffffffff;
    for (let i = 0; i < data.length; i++) {
        c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
    }
    return (c ^ 0xffffffff) >>> 0;
}

// Extensões já comprimidas: gravadas sem compressão (STORED).
const STORE_EXT = /\.(png|jpe?g|gif|webp|ogg|m4a|mp3|webm|mp4|woff2?|zip|apk|[a-z0-9]+_)$/i;

export async function deflateRaw(data) {
    if (typeof CompressionStream === "undefined") {
        return null;
    }
    const cs = new CompressionStream("deflate-raw");
    const stream = new Blob([data]).stream().pipeThrough(cs);
    return new Uint8Array(await new Response(stream).arrayBuffer());
}

function dosDateTime(d) {
    const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    return { time, date };
}

export class ZipWriter {
    constructor() {
        this.parts = [];
        this.entries = [];
        this.offset = 0;
        this.stamp = dosDateTime(new Date());
    }

    // data: Uint8Array. compress: true/false/undefined (= automático pela extensão).
    async add(name, data, compress) {
        const nameBytes = new TextEncoder().encode(name);
        const crc = crc32(data);
        let method = 0;
        let payload = data;
        const wantDeflate = compress === undefined ? !STORE_EXT.test(name) && data.length > 64 : compress;
        if (wantDeflate) {
            const d = await deflateRaw(data);
            if (d && d.length < data.length) {
                method = 8;
                payload = d;
            }
        }
        if (this.offset + payload.length > 0xffffffff - 0x10000) {
            throw new Error(t("Package larger than 4 GB: ZIP64 is not supported."));
        }
        const head = new Uint8Array(30 + nameBytes.length);
        const v = new DataView(head.buffer);
        v.setUint32(0, 0x04034b50, true);
        v.setUint16(4, 20, true);
        v.setUint16(6, 0x0800, true); // nomes em UTF-8
        v.setUint16(8, method, true);
        v.setUint16(10, this.stamp.time, true);
        v.setUint16(12, this.stamp.date, true);
        v.setUint32(14, crc, true);
        v.setUint32(18, payload.length, true);
        v.setUint32(22, data.length, true);
        v.setUint16(26, nameBytes.length, true);
        v.setUint16(28, 0, true);
        head.set(nameBytes, 30);
        this.entries.push({ nameBytes, crc, method, csize: payload.length, usize: data.length, offset: this.offset });
        this.parts.push(head, new Blob([payload]));
        this.offset += head.length + payload.length;
    }

    finish() {
        const cdStart = this.offset;
        let cdSize = 0;
        for (const e of this.entries) {
            const c = new Uint8Array(46 + e.nameBytes.length);
            const v = new DataView(c.buffer);
            v.setUint32(0, 0x02014b50, true);
            v.setUint16(4, 20, true);
            v.setUint16(6, 20, true);
            v.setUint16(8, 0x0800, true);
            v.setUint16(10, e.method, true);
            v.setUint16(12, this.stamp.time, true);
            v.setUint16(14, this.stamp.date, true);
            v.setUint32(16, e.crc, true);
            v.setUint32(20, e.csize, true);
            v.setUint32(24, e.usize, true);
            v.setUint16(28, e.nameBytes.length, true);
            v.setUint32(42, e.offset, true);
            c.set(e.nameBytes, 46);
            this.parts.push(c);
            cdSize += c.length;
        }
        if (this.entries.length > 0xffff) {
            throw new Error(t("More than 65535 files: ZIP64 is not supported."));
        }
        const end = new Uint8Array(22);
        const v = new DataView(end.buffer);
        v.setUint32(0, 0x06054b50, true);
        v.setUint16(8, this.entries.length, true);
        v.setUint16(10, this.entries.length, true);
        v.setUint32(12, cdSize, true);
        v.setUint32(16, cdStart, true);
        this.parts.push(end);
        return new Blob(this.parts, { type: "application/zip" });
    }
}
