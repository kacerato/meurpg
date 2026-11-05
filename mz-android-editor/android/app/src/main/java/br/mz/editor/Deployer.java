package br.mz.editor;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.net.Uri;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Enumeration;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;

/**
 * Implantação no aparelho (rotas /api/deploy/*). O editor web manda o plano
 * {kind:"apk"|"zip"|"folder", outputName, appName, packageName, keyHex, icon, outTree, files:[{src,dst,enc}], inline:[{dst,text}]};
 * "folder" grava a pasta do jogo dentro de outTree (pasta escolhida pelo SAF, fora do projeto).
 * aqui os arquivos são lidos do projeto via SAF, criptografados (formato RPGMV do rmmz_core.js),
 * empacotados e, para APK, injetados no player-template.apk e assinados com apksig.
 * O progresso é consultado por GET /api/deploy/status?id=.
 */
final class Deployer {
    private static final String TAG = "MZ.Deploy";
    static final String OUT_DIR = "deploy";             // filesDir/deploy (servido pelo ApkProvider)
    static final String DOWNLOAD_SUBDIR = "MZEditor";   // Download/MZEditor

    private static final byte[] HEADER = {0x52, 0x50, 0x47, 0x4d, 0x56, 0, 0, 0, 0, 0x03, 0x01, 0, 0, 0, 0, 0};

    private final Context ctx;
    private final LocalServer server;
    private final Signer signer;
    private final ExecutorService exec = Executors.newSingleThreadExecutor();
    private final Map<String, Job> jobs = new ConcurrentHashMap<>();
    private final AtomicInteger seq = new AtomicInteger();

    Deployer(Context ctx, LocalServer server) {
        this.ctx = ctx.getApplicationContext();
        this.server = server;
        this.signer = new Signer(this.ctx.getFilesDir());
    }

    static final class Job {
        final String id;
        volatile String state = "running";
        volatile String message = "";
        volatile int done;
        volatile int total = 1;
        volatile boolean cancelled;
        final List<String> log = new ArrayList<>();
        volatile JSONObject result;

        Job(String id) {
            this.id = id;
        }

        void log(String s) {
            synchronized (log) {
                log.add(s);
            }
            Log.i(TAG, s);
        }

        String toJson() {
            try {
                JSONObject o = new JSONObject();
                o.put("id", id);
                o.put("state", state);
                o.put("message", message);
                o.put("done", done);
                o.put("total", total);
                synchronized (log) {
                    o.put("log", new JSONArray(log));
                }
                if (result != null) {
                    o.put("result", result);
                }
                return o.toString();
            } catch (Exception e) {
                return "{\"state\":\"error\",\"message\":\"json\"}";
            }
        }

        void check() throws IOException {
            if (cancelled) {
                throw new IOException("Cancelado pelo usuário.");
            }
        }
    }

    // ---- rotas -----------------------------------------------------------------------------

    /** Devolve {status, body} ou null se a rota não é de deploy. */
    String[] handle(String method, String path, Map<String, String> query, byte[] body) {
        try {
            switch (path) {
                case "/api/deploy/start": {
                    if (!"POST".equals(method)) {
                        return new String[]{"405", "{\"error\":\"method\"}"};
                    }
                    SafProject prj = server.getProject();
                    if (prj == null) {
                        return new String[]{"404", "{\"error\":\"no_project\"}"};
                    }
                    JSONObject req = new JSONObject(new String(body, StandardCharsets.UTF_8));
                    Job job = new Job("d" + seq.incrementAndGet());
                    jobs.put(job.id, job);
                    exec.execute(() -> run(job, prj, req));
                    return new String[]{"200", "{\"id\":\"" + job.id + "\"}"};
                }
                case "/api/deploy/status": {
                    Job job = jobs.get(String.valueOf(query.get("id")));
                    if (job == null) {
                        return new String[]{"404", "{\"error\":\"no_job\"}"};
                    }
                    return new String[]{"200", job.toJson()};
                }
                case "/api/deploy/cancel": {
                    Job job = jobs.get(String.valueOf(query.get("id")));
                    if (job != null) {
                        job.cancelled = true;
                    }
                    return new String[]{"200", "{\"ok\":true}"};
                }
                default:
                    return null;
            }
        } catch (Exception e) {
            return new String[]{"400", "{\"error\":" + LocalServer.Json.str(String.valueOf(e)) + "}"};
        }
    }

    // ---- execução --------------------------------------------------------------------------

    private void run(Job job, SafProject prj, JSONObject req) {
        try {
            String kind = req.optString("kind", "apk");
            String name = sanitize(req.optString("outputName", "Game"));
            String keyHex = req.optString("keyHex", "");
            byte[] key = keyHex.length() == 32 ? hex(keyHex) : null;
            JSONArray files = req.getJSONArray("files");
            JSONArray inline = req.optJSONArray("inline");
            job.total = files.length() + (inline != null ? inline.length() : 0) + ("apk".equals(kind) ? 2 : 0);
            if ("zip".equals(kind)) {
                File tmp = new File(ctx.getCacheDir(), "deploy-" + job.id + ".zip");
                try {
                    job.message = "Compactando";
                    try (ZipOut zip = new ZipOut(new BufferedOutputStream(new FileOutputStream(tmp), 256 * 1024))) {
                        // como o MZ: index.html na raiz do pacote (sem a pasta www/)
                        addGameFiles(job, prj, zip, "", files, inline, key);
                    }
                    publish(job, tmp, name + ".zip", "application/zip", null);
                } finally {
                    tmp.delete();
                }
            } else if ("folder".equals(kind)) {
                writeFolder(job, prj, req.getString("outTree"), name, files, inline, key);
            } else {
                buildApk(job, prj, req, name, files, inline, key);
            }
            job.state = "done";
            job.message = "Concluído";
        } catch (Throwable e) {
            Log.e(TAG, "deploy", e);
            job.log("ERRO: " + e);
            job.message = e.getMessage() != null ? e.getMessage() : String.valueOf(e);
            job.state = "error";
        }
    }

    private void addGameFiles(Job job, SafProject prj, ZipOut zip, String prefix, JSONArray files, JSONArray inline, byte[] key) throws Exception {
        int nEnc = 0;
        for (int i = 0; i < files.length(); i++) {
            job.check();
            JSONObject f = files.getJSONObject(i);
            String src = f.getString("src");
            String dst = f.optString("dst", src);
            if (src.contains("..") || dst.contains("..")) {
                throw new IOException("caminho inválido: " + src);
            }
            SafProject.Entry e = prj.resolve(src);
            if (e == null || e.isDir) {
                job.log("aviso: arquivo não encontrado, ignorado: " + src);
                job.done++;
                continue;
            }
            byte[] data;
            try (InputStream in = prj.open(e)) {
                data = LocalServer.readAll(in);
            }
            if (f.optBoolean("enc", false)) {
                if (key == null) {
                    throw new IOException("criptografia pedida sem chave");
                }
                data = encrypt(data, key);
                nEnc++;
            }
            zip.add(prefix + dst, data, !ZipOut.shouldStore(dst));
            job.done++;
        }
        if (inline != null) {
            for (int i = 0; i < inline.length(); i++) {
                JSONObject f = inline.getJSONObject(i);
                zip.add(prefix + f.getString("dst"), f.getString("text").getBytes(StandardCharsets.UTF_8), true);
                job.done++;
            }
        }
        job.log(files.length() + (inline != null ? inline.length() : 0) + " arquivo(s) do jogo empacotados (" + nEnc + " criptografados).");
    }

    /** Pasta do jogo em <outTree>/<name>/ (SAF), para o formato "pasta" fora do projeto. */
    private void writeFolder(Job job, SafProject prj, String outTree, String name, JSONArray files, JSONArray inline, byte[] key) throws Exception {
        SafProject out = new SafProject(ctx.getContentResolver(), Uri.parse(outTree));
        String base = name + "/";
        job.message = "Gravando";
        int nEnc = 0;
        for (int i = 0; i < files.length(); i++) {
            job.check();
            JSONObject f = files.getJSONObject(i);
            String src = f.getString("src");
            String dst = f.optString("dst", src);
            if (src.contains("..") || dst.contains("..")) {
                throw new IOException("caminho inválido: " + src);
            }
            SafProject.Entry e = prj.resolve(src);
            if (e == null || e.isDir) {
                job.log("aviso: arquivo não encontrado, ignorado: " + src);
                job.done++;
                continue;
            }
            byte[] data;
            try (InputStream in = prj.open(e)) {
                data = LocalServer.readAll(in);
            }
            if (f.optBoolean("enc", false)) {
                if (key == null) {
                    throw new IOException("criptografia pedida sem chave");
                }
                data = encrypt(data, key);
                nEnc++;
            }
            out.write(base + dst, data);
            job.done++;
        }
        if (inline != null) {
            for (int i = 0; i < inline.length(); i++) {
                JSONObject f = inline.getJSONObject(i);
                out.write(base + f.getString("dst"), f.getString("text").getBytes(StandardCharsets.UTF_8));
                job.done++;
            }
        }
        job.log(files.length() + " arquivo(s) gravados em " + out.getName() + "/" + name + " (" + nEnc + " criptografados).");
        JSONObject r = new JSONObject();
        r.put("name", name);
        r.put("size", 0);
        r.put("location", out.getName() + "/" + name);
        r.put("file", "");
        job.result = r;
    }

    /** Mesmo formato que Utils.decryptArrayBuffer (rmmz_core.js) desfaz. */
    static byte[] encrypt(byte[] data, byte[] key) {
        byte[] out = new byte[16 + data.length];
        System.arraycopy(HEADER, 0, out, 0, 16);
        System.arraycopy(data, 0, out, 16, data.length);
        for (int i = 0; i < 16 && i < data.length; i++) {
            out[16 + i] ^= key[i];
        }
        return out;
    }

    private void buildApk(Job job, SafProject prj, JSONObject req, String name, JSONArray files, JSONArray inline, byte[] key) throws Exception {
        String appName = req.optString("appName", name);
        String pkg = req.optString("packageName", "");
        if (!pkg.matches("[a-zA-Z][a-zA-Z0-9_]*(\\.[a-zA-Z][a-zA-Z0-9_]*)+") || pkg.length() > ApkBuilder.PKG_PLACEHOLDER.length()) {
            throw new IOException("nome de pacote inválido: " + pkg);
        }
        if (appName.getBytes(StandardCharsets.UTF_8).length > ApkBuilder.LABEL_PLACEHOLDER.length()) {
            throw new IOException("nome do app longo demais");
        }
        job.message = "Preparando";
        signer.ensureKey(job);
        File cache = ctx.getCacheDir();
        File template = new File(cache, "player-template.apk");
        try (InputStream in = ctx.getAssets().open("player-template.apk"); OutputStream out = new FileOutputStream(template)) {
            byte[] buf = new byte[256 * 1024];
            int n;
            while ((n = in.read(buf)) >= 0) {
                out.write(buf, 0, n);
            }
        }
        byte[] icon = null;
        String iconPath = req.optString("icon", "icon/icon.png");
        SafProject.Entry ie = prj.resolve(iconPath);
        if (ie != null && !ie.isDir) {
            try (InputStream in = prj.open(ie)) {
                icon = LocalServer.readAll(in);
            }
        }
        File unsigned = new File(cache, "deploy-" + job.id + "-unsigned.apk");
        File outDir = new File(ctx.getFilesDir(), OUT_DIR);
        if (!outDir.isDirectory() && !outDir.mkdirs()) {
            throw new IOException("não foi possível criar " + outDir);
        }
        File signed = new File(outDir, name + ".apk");
        try {
            job.message = "Montando APK";
            try (ZipFile tz = new ZipFile(template);
                 ZipOut zip = new ZipOut(new BufferedOutputStream(new FileOutputStream(unsigned), 256 * 1024))) {
                Enumeration<? extends ZipEntry> en = tz.entries();
                while (en.hasMoreElements()) {
                    ZipEntry ze = en.nextElement();
                    String n = ze.getName();
                    if (ze.isDirectory() || n.startsWith("META-INF/") && (n.endsWith(".SF") || n.endsWith(".RSA") || n.endsWith(".EC") || n.endsWith(".DSA") || n.endsWith("MANIFEST.MF"))) {
                        continue;
                    }
                    if (n.startsWith("assets/www/")) {
                        continue;
                    }
                    byte[] data;
                    try (InputStream in = tz.getInputStream(ze)) {
                        data = LocalServer.readAll(in);
                    }
                    if (n.equals("AndroidManifest.xml")) {
                        int c = ApkBuilder.patchPoolString(data, ApkBuilder.PKG_PLACEHOLDER, pkg);
                        if (c == 0) {
                            throw new IOException("marcador de pacote não encontrado no template");
                        }
                    } else if (n.equals("resources.arsc")) {
                        ApkBuilder.patchArscPackageName(data, ApkBuilder.PKG_PLACEHOLDER, pkg);
                        int c = ApkBuilder.patchPoolString(data, ApkBuilder.LABEL_PLACEHOLDER, appName);
                        if (c == 0) {
                            throw new IOException("marcador de nome do app não encontrado no template");
                        }
                    } else if (icon != null && n.startsWith("res/") && n.toLowerCase(Locale.ROOT).endsWith(".png")) {
                        // o template só tem o ícone como PNG (nomes de res/ encurtados pelo AGP)
                        data = icon;
                    }
                    boolean store = ze.getMethod() == ZipEntry.STORED || n.equals("resources.arsc");
                    zip.add(n, data, !store);
                }
                JSONObject app = new JSONObject();
                app.put("title", appName);
                app.put("packageName", pkg);
                zip.add("assets/www/app.json", app.toString().getBytes(StandardCharsets.UTF_8), true);
                job.done++;
                addGameFiles(job, prj, zip, "assets/www/", files, inline, key);
            }
            job.check();
            job.message = "Assinando";
            job.log("Assinando APK (v1 + v2)...");
            signed.delete();
            signer.sign(unsigned, signed);
            job.log("Certificado SHA-256: " + signer.certSha256());
            job.done++;
        } finally {
            unsigned.delete();
            template.delete();
        }
        publish(job, signed, name + ".apk", "application/vnd.android.package-archive", signed);
    }

    /** Copia para Download/MZEditor via MediaStore e grava o resultado no job. */
    private void publish(Job job, File file, String displayName, String mime, File keep) throws IOException {
        job.message = "Salvando em Download";
        ContentResolver cr = ctx.getContentResolver();
        ContentValues v = new ContentValues();
        v.put(MediaStore.MediaColumns.DISPLAY_NAME, displayName);
        v.put(MediaStore.MediaColumns.MIME_TYPE, mime);
        v.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/" + DOWNLOAD_SUBDIR);
        v.put(MediaStore.MediaColumns.IS_PENDING, 1);
        String location;
        Uri uri = null;
        try {
            uri = cr.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
        } catch (Exception e) {
            Log.w(TAG, "MediaStore", e);
        }
        if (uri != null) {
            try (InputStream in = new FileInputStream(file); OutputStream out = cr.openOutputStream(uri, "w")) {
                if (out == null) {
                    throw new IOException("MediaStore sem saída");
                }
                byte[] buf = new byte[256 * 1024];
                int n;
                while ((n = in.read(buf)) >= 0) {
                    out.write(buf, 0, n);
                }
            }
            ContentValues done = new ContentValues();
            done.put(MediaStore.MediaColumns.IS_PENDING, 0);
            cr.update(uri, done, null, null);
            location = "Download/" + DOWNLOAD_SUBDIR;
            job.log("Salvo em Download/" + DOWNLOAD_SUBDIR + "/" + displayName);
        } else {
            location = "armazenamento interno do app";
            job.log("aviso: não foi possível salvar em Download; arquivo mantido no app.");
        }
        try {
            JSONObject r = new JSONObject();
            r.put("name", displayName);
            r.put("size", file.length());
            r.put("location", location);
            r.put("file", keep != null ? keep.getName() : "");
            if (uri != null) {
                r.put("uri", uri.toString());
            }
            job.result = r;
        } catch (Exception ignored) {
        }
    }

    static String sanitize(String s) {
        String r = s.replaceAll("[\\\\/:*?\"<>|\\x00-\\x1f]+", "_").trim();
        return r.isEmpty() ? "Game" : r;
    }

    private static byte[] hex(String s) {
        byte[] b = new byte[s.length() / 2];
        for (int i = 0; i < b.length; i++) {
            b[i] = (byte) Integer.parseInt(s.substring(i * 2, i * 2 + 2), 16);
        }
        return b;
    }
}
