package br.mz.editor;

import java.nio.charset.StandardCharsets;

/**
 * Personalização do player-template.apk sem recompilar: troca os marcadores longos gravados
 * em android/player/build.gradle diretamente nos binários (AndroidManifest.xml binário e
 * resources.arsc), sempre por um texto de tamanho MENOR OU IGUAL, reescrevendo o prefixo de
 * comprimento da string e completando com zeros. Os offsets do pool de strings não mudam, então
 * nenhum chunk precisa ser reconstruído.
 */
final class ApkBuilder {
    /** MANTENHA em sincronia com android/player/build.gradle. */
    static final String PKG_PLACEHOLDER = "br.mzgame." + repeat('z', 90);
    static final String LABEL_PLACEHOLDER = "MZGAMELABEL" + repeat('_', 89);

    private ApkBuilder() {
    }

    private static String repeat(char c, int n) {
        StringBuilder sb = new StringBuilder(n);
        for (int i = 0; i < n; i++) {
            sb.append(c);
        }
        return sb.toString();
    }

    /** Troca no AndroidManifest.xml binário (pool UTF-16 ou UTF-8). Devolve quantas trocas. */
    static int patchPoolString(byte[] data, String placeholder, String value) {
        int n = 0;
        n += patchUtf16(data, placeholder, value);
        n += patchUtf8(data, placeholder, value);
        return n;
    }

    // Pool UTF-16: [u16 len][chars UTF-16LE][u16 0]
    private static int patchUtf16(byte[] data, String placeholder, String value) {
        int len = placeholder.length();
        byte[] pat = new byte[2 + len * 2];
        pat[0] = (byte) len;
        pat[1] = (byte) (len >> 8);
        System.arraycopy(placeholder.getBytes(StandardCharsets.UTF_16LE), 0, pat, 2, len * 2);
        int count = 0;
        for (int at = indexOf(data, pat, 0); at >= 0; at = indexOf(data, pat, at + 1)) {
            byte[] v = value.getBytes(StandardCharsets.UTF_16LE);
            int vlen = value.length();
            if (vlen > len) {
                throw new IllegalArgumentException("texto longo demais: " + value);
            }
            data[at] = (byte) vlen;
            data[at + 1] = (byte) (vlen >> 8);
            int end = at + 2 + len * 2 + 2;
            for (int i = at + 2; i < end; i++) {
                data[i] = 0;
            }
            System.arraycopy(v, 0, data, at + 2, v.length);
            count++;
        }
        return count;
    }

    // Pool UTF-8: [u8 len em UTF-16][u8 len em bytes][bytes][0] (tamanhos < 128)
    private static int patchUtf8(byte[] data, String placeholder, String value) {
        byte[] ph = placeholder.getBytes(StandardCharsets.UTF_8);
        byte[] pat = new byte[2 + ph.length];
        pat[0] = (byte) placeholder.length();
        pat[1] = (byte) ph.length;
        System.arraycopy(ph, 0, pat, 2, ph.length);
        int count = 0;
        for (int at = indexOf(data, pat, 0); at >= 0; at = indexOf(data, pat, at + 1)) {
            byte[] v = value.getBytes(StandardCharsets.UTF_8);
            if (v.length > ph.length || value.length() > 127) {
                throw new IllegalArgumentException("texto longo demais: " + value);
            }
            data[at] = (byte) value.length();
            data[at + 1] = (byte) v.length;
            int end = at + 2 + ph.length + 1;
            for (int i = at + 2; i < end; i++) {
                data[i] = 0;
            }
            System.arraycopy(v, 0, data, at + 2, v.length);
            count++;
        }
        return count;
    }

    /** Nome do pacote no chunk ResTable_package do resources.arsc: char16_t[128] fixo. */
    static int patchArscPackageName(byte[] data, String placeholder, String value) {
        byte[] pat = placeholder.getBytes(StandardCharsets.UTF_16LE);
        int count = 0;
        for (int at = indexOf(data, pat, 0); at >= 0; at = indexOf(data, pat, at + 1)) {
            for (int i = 0; i < pat.length; i++) {
                data[at + i] = 0;
            }
            byte[] v = value.getBytes(StandardCharsets.UTF_16LE);
            System.arraycopy(v, 0, data, at, Math.min(v.length, pat.length));
            count++;
        }
        return count;
    }

    static int indexOf(byte[] data, byte[] pat, int from) {
        outer:
        for (int i = Math.max(0, from); i <= data.length - pat.length; i++) {
            for (int j = 0; j < pat.length; j++) {
                if (data[i + j] != pat[j]) {
                    continue outer;
                }
            }
            return i;
        }
        return -1;
    }
}
