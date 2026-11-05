package br.mz.editor;

import com.android.apksig.ApkSigner;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.KeyStore;
import java.security.PrivateKey;
import java.security.SecureRandom;
import java.security.Signature;
import java.security.cert.Certificate;
import java.security.cert.CertificateFactory;
import java.security.cert.X509Certificate;
import java.io.ByteArrayInputStream;
import java.text.SimpleDateFormat;
import java.util.Collections;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

/**
 * Assinatura dos APKs exportados: chave RSA 2048 gerada no aparelho na primeira exportação,
 * guardada num PKCS12 em filesDir (deploy-keystore.p12), certificado X.509 autoassinado
 * montado à mão em DER (o Android não tem API pública para isso). Assina com apksig (v1+v2).
 * A mesma chave é reutilizada, então novas versões do jogo instalam por cima das antigas.
 */
final class Signer {
    static final String ALIAS = "mzgame";
    static final char[] PASSWORD = "mzeditor".toCharArray();

    private final File keystoreFile;
    private PrivateKey key;
    private X509Certificate cert;

    Signer(File filesDir) {
        this.keystoreFile = new File(filesDir, "deploy-keystore.p12");
    }

    synchronized void ensureKey(Deployer.Job log) throws Exception {
        if (key != null) {
            return;
        }
        KeyStore ks = KeyStore.getInstance("PKCS12");
        if (keystoreFile.exists()) {
            try (FileInputStream in = new FileInputStream(keystoreFile)) {
                ks.load(in, PASSWORD);
            }
            key = (PrivateKey) ks.getKey(ALIAS, PASSWORD);
            cert = (X509Certificate) ks.getCertificate(ALIAS);
            if (key != null && cert != null) {
                return;
            }
        }
        if (log != null) {
            log.log("Gerando chave de assinatura (primeira exportação)...");
        }
        KeyPairGenerator g = KeyPairGenerator.getInstance("RSA");
        g.initialize(2048, new SecureRandom());
        KeyPair kp = g.generateKeyPair();
        byte[] der = selfSignedCert(kp, "MZ Editor Game");
        cert = (X509Certificate) CertificateFactory.getInstance("X.509").generateCertificate(new ByteArrayInputStream(der));
        key = kp.getPrivate();
        ks.load(null, null);
        ks.setKeyEntry(ALIAS, key, PASSWORD, new Certificate[]{cert});
        File tmp = new File(keystoreFile.getPath() + ".tmp");
        try (FileOutputStream out = new FileOutputStream(tmp)) {
            ks.store(out, PASSWORD);
        }
        if (!tmp.renameTo(keystoreFile)) {
            throw new IOException("não foi possível gravar " + keystoreFile);
        }
    }

    void sign(File in, File out) throws Exception {
        ensureKey(null);
        ApkSigner.SignerConfig sc = new ApkSigner.SignerConfig.Builder("MZGAME", key, Collections.singletonList(cert)).build();
        new ApkSigner.Builder(Collections.singletonList(sc))
            .setInputApk(in)
            .setOutputApk(out)
            .setV1SigningEnabled(true)
            .setV2SigningEnabled(true)
            .setV3SigningEnabled(false)
            .setV4SigningEnabled(false)
            .setCreatedBy("MZ Editor")
            .build()
            .sign();
    }

    String certSha256() throws Exception {
        ensureKey(null);
        byte[] d = java.security.MessageDigest.getInstance("SHA-256").digest(cert.getEncoded());
        StringBuilder sb = new StringBuilder();
        for (byte b : d) {
            sb.append(String.format(Locale.ROOT, "%02X", b & 0xff));
        }
        return sb.toString();
    }

    // ---- DER -----------------------------------------------------------------------------

    private static final byte[] OID_SHA256_RSA = {0x06, 0x09, 0x2A, (byte) 0x86, 0x48, (byte) 0x86, (byte) 0xF7, 0x0D, 0x01, 0x01, 0x0B};
    private static final byte[] OID_CN = {0x06, 0x03, 0x55, 0x04, 0x03};

    static byte[] selfSignedCert(KeyPair kp, String cn) throws Exception {
        byte[] algId = tlv(0x30, cat(OID_SHA256_RSA, new byte[]{0x05, 0x00}));
        byte[] name = tlv(0x30, tlv(0x31, tlv(0x30, cat(OID_CN, tlv(0x0C, cn.getBytes(StandardCharsets.UTF_8))))));
        byte[] serial = new byte[9];
        new SecureRandom().nextBytes(serial);
        serial[0] = 0x01; // positivo e sem zeros à esquerda
        long now = System.currentTimeMillis();
        Date from = new Date(now - 24L * 3600 * 1000);
        Date to = new Date(now + 50L * 365 * 24 * 3600 * 1000);
        byte[] validity = tlv(0x30, cat(time(from), time(to)));
        byte[] tbs = tlv(0x30, cat(
            new byte[]{(byte) 0xA0, 0x03, 0x02, 0x01, 0x02},
            tlv(0x02, serial),
            algId,
            name,
            validity,
            name,
            kp.getPublic().getEncoded()));
        Signature s = Signature.getInstance("SHA256withRSA");
        s.initSign(kp.getPrivate());
        s.update(tbs);
        byte[] sig = s.sign();
        return tlv(0x30, cat(tbs, algId, tlv(0x03, cat(new byte[]{0}, sig))));
    }

    private static byte[] time(Date d) {
        SimpleDateFormat utc = new SimpleDateFormat("yyMMddHHmmss'Z'", Locale.ROOT);
        SimpleDateFormat gen = new SimpleDateFormat("yyyyMMddHHmmss'Z'", Locale.ROOT);
        utc.setTimeZone(TimeZone.getTimeZone("UTC"));
        gen.setTimeZone(TimeZone.getTimeZone("UTC"));
        int year = Integer.parseInt(gen.format(d).substring(0, 4));
        if (year < 2050) {
            return tlv(0x17, utc.format(d).getBytes(StandardCharsets.US_ASCII));
        }
        return tlv(0x18, gen.format(d).getBytes(StandardCharsets.US_ASCII));
    }

    private static byte[] tlv(int tag, byte[] value) {
        ByteArrayOutputStream b = new ByteArrayOutputStream();
        b.write(tag);
        int n = value.length;
        if (n < 0x80) {
            b.write(n);
        } else if (n < 0x100) {
            b.write(0x81);
            b.write(n);
        } else if (n < 0x10000) {
            b.write(0x82);
            b.write(n >> 8);
            b.write(n);
        } else {
            b.write(0x83);
            b.write(n >> 16);
            b.write(n >> 8);
            b.write(n);
        }
        b.write(value, 0, n);
        return b.toByteArray();
    }

    private static byte[] cat(byte[]... parts) {
        ByteArrayOutputStream b = new ByteArrayOutputStream();
        for (byte[] p : parts) {
            b.write(p, 0, p.length);
        }
        return b.toByteArray();
    }
}
