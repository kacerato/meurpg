package br.mz.editor;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.zip.CRC32;
import java.util.zip.Deflater;

/**
 * Escritor ZIP mínimo (sem ZIP64, sem data descriptors) com alinhamento de 4 bytes das entradas
 * STORED (como o zipalign), para APKs e pacotes web. Cada entrada é recebida inteira em memória.
 */
final class ZipOut implements AutoCloseable {
    private static final class Ent {
        byte[] name;
        int method;
        long crc;
        long csize;
        long usize;
        long offset;
    }

    private final OutputStream out;
    private final List<Ent> entries = new ArrayList<>();
    private long pos;
    private final Deflater deflater = new Deflater(6, true);
    private final int dosTime;
    private final int dosDate;

    ZipOut(OutputStream out) {
        this.out = out;
        java.util.Calendar c = java.util.Calendar.getInstance();
        dosTime = (c.get(java.util.Calendar.HOUR_OF_DAY) << 11) | (c.get(java.util.Calendar.MINUTE) << 5) | (c.get(java.util.Calendar.SECOND) >> 1);
        dosDate = ((c.get(java.util.Calendar.YEAR) - 1980) << 9) | ((c.get(java.util.Calendar.MONTH) + 1) << 5) | c.get(java.util.Calendar.DAY_OF_MONTH);
    }

    /** Extensões já comprimidas (ou que o Android exige sem compressão) ficam STORED. */
    static boolean shouldStore(String name) {
        String n = name.toLowerCase(java.util.Locale.ROOT);
        return n.endsWith(".png") || n.endsWith(".jpg") || n.endsWith(".jpeg") || n.endsWith(".gif") || n.endsWith(".webp")
            || n.endsWith(".ogg") || n.endsWith(".m4a") || n.endsWith(".mp3") || n.endsWith(".webm") || n.endsWith(".mp4")
            || n.endsWith(".woff") || n.endsWith(".woff2") || n.endsWith("_") || n.endsWith(".arsc") || n.endsWith(".zip");
    }

    void add(String name, byte[] data, boolean compress) throws IOException {
        Ent e = new Ent();
        e.name = name.getBytes(StandardCharsets.UTF_8);
        CRC32 crc = new CRC32();
        crc.update(data);
        e.crc = crc.getValue();
        e.usize = data.length;
        byte[] payload = data;
        e.method = 0;
        if (compress && data.length > 64) {
            deflater.reset();
            deflater.setInput(data);
            deflater.finish();
            java.io.ByteArrayOutputStream buf = new java.io.ByteArrayOutputStream(Math.max(64, data.length / 2));
            byte[] tmp = new byte[64 * 1024];
            while (!deflater.finished()) {
                int n = deflater.deflate(tmp);
                buf.write(tmp, 0, n);
            }
            if (buf.size() < data.length) {
                payload = buf.toByteArray();
                e.method = 8;
            }
        }
        e.csize = payload.length;
        e.offset = pos;
        int extra = 0;
        if (e.method == 0) {
            long dataStart = pos + 30 + e.name.length;
            extra = (int) ((4 - (dataStart % 4)) % 4);
        }
        if (pos + 30 + e.name.length + extra + payload.length > 0xFFFFFFFFL - 0x10000) {
            throw new IOException("pacote maior que 4 GB (ZIP64 não suportado)");
        }
        byte[] h = new byte[30];
        le32(h, 0, 0x04034b50);
        le16(h, 4, e.method == 0 ? 10 : 20);
        le16(h, 6, 0x0800);
        le16(h, 8, e.method);
        le16(h, 10, dosTime);
        le16(h, 12, dosDate);
        le32(h, 14, (int) e.crc);
        le32(h, 18, (int) e.csize);
        le32(h, 22, (int) e.usize);
        le16(h, 26, e.name.length);
        le16(h, 28, extra);
        out.write(h);
        out.write(e.name);
        if (extra > 0) {
            out.write(new byte[extra]);
        }
        out.write(payload);
        pos += 30 + e.name.length + extra + payload.length;
        entries.add(e);
    }

    @Override
    public void close() throws IOException {
        long cdStart = pos;
        long cdSize = 0;
        for (Ent e : entries) {
            byte[] c = new byte[46];
            le32(c, 0, 0x02014b50);
            le16(c, 4, 20);
            le16(c, 6, e.method == 0 ? 10 : 20);
            le16(c, 8, 0x0800);
            le16(c, 10, e.method);
            le16(c, 12, dosTime);
            le16(c, 14, dosDate);
            le32(c, 16, (int) e.crc);
            le32(c, 20, (int) e.csize);
            le32(c, 24, (int) e.usize);
            le16(c, 28, e.name.length);
            le32(c, 42, (int) e.offset);
            out.write(c);
            out.write(e.name);
            cdSize += 46 + e.name.length;
        }
        if (entries.size() > 0xFFFF) {
            throw new IOException("mais de 65535 arquivos (ZIP64 não suportado)");
        }
        byte[] end = new byte[22];
        le32(end, 0, 0x06054b50);
        le16(end, 8, entries.size());
        le16(end, 10, entries.size());
        le32(end, 12, (int) cdSize);
        le32(end, 16, (int) cdStart);
        out.write(end);
        out.flush();
        deflater.end();
        out.close();
    }

    private static void le16(byte[] b, int o, int v) {
        b[o] = (byte) v;
        b[o + 1] = (byte) (v >>> 8);
    }

    private static void le32(byte[] b, int o, int v) {
        b[o] = (byte) v;
        b[o + 1] = (byte) (v >>> 8);
        b[o + 2] = (byte) (v >>> 16);
        b[o + 3] = (byte) (v >>> 24);
    }
}
