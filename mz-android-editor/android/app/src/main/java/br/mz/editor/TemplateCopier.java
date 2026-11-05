package br.mz.editor;

import android.content.ContentResolver;
import android.content.res.AssetManager;
import android.net.Uri;
import android.os.SystemClock;
import android.provider.DocumentsContract;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.TreeSet;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Novo projeto em lote: copia o template do editor (assets/editor/template-full/** ou, se não houver,
 * assets/editor/template/**) direto para o projeto SAF aberto, em várias threads, sem passar cada
 * arquivo por HTTP. Personaliza como o newproject.js: System.json (gameTitle, versionId),
 * index.html (&lt;title&gt;) e cria game.rmmzproject ("RPGMZ 1.1.1").
 *
 * Rotas:
 *   POST /api/template/copy   {title}  → {ok, total, source}   (409 se já houver uma cópia rodando)
 *   GET  /api/template/status          → {state:"idle"|"running"|"done"|"error", done, total, file, ms, error, source}
 * O projeto de destino deve estar vazio (pasta recém-criada): arquivos existentes não são sobrescritos
 * (o SAF criaria "nome (1)"); nesse caso use a cópia arquivo a arquivo do newproject.js.
 */
final class TemplateCopier {
    private static final String TAG = "MZ.Template";
    private static final int THREADS = 6;

    private final AssetManager assets;
    private final LocalServer server;
    private volatile Job job;

    TemplateCopier(AssetManager assets, LocalServer server) {
        this.assets = assets;
        this.server = server;
    }

    static final class Job {
        volatile String state = "running";
        final AtomicInteger done = new AtomicInteger();
        volatile int total;
        volatile String file = "";
        volatile String error = "";
        volatile String source = "";
        volatile long ms;

        String toJson() {
            return "{\"state\":" + LocalServer.Json.str(state)
                + ",\"done\":" + done.get()
                + ",\"total\":" + total
                + ",\"file\":" + LocalServer.Json.str(file)
                + ",\"ms\":" + ms
                + ",\"source\":" + LocalServer.Json.str(source)
                + ",\"error\":" + LocalServer.Json.str(error) + "}";
        }
    }

    /** Devolve {status, body} ou null se a rota não é deste módulo. */
    String[] handle(String method, String path, byte[] body) {
        try {
            if ("/api/template/status".equals(path)) {
                Job j = job;
                return new String[]{"200", j == null ? "{\"state\":\"idle\",\"done\":0,\"total\":0}" : j.toJson()};
            }
            if (!"/api/template/copy".equals(path)) {
                return null;
            }
            if (!"POST".equals(method)) {
                return new String[]{"405", "{\"error\":\"method\"}"};
            }
            SafProject prj = server.getProject();
            if (prj == null) {
                return new String[]{"404", "{\"error\":\"no_project\"}"};
            }
            Job cur = job;
            if (cur != null && "running".equals(cur.state)) {
                return new String[]{"409", "{\"error\":\"busy\"}"};
            }
            String title = "";
            String sub = "";
            if (body != null && body.length > 0) {
                JSONObject req = new JSONObject(new String(body, StandardCharsets.UTF_8));
                title = req.optString("title", "");
                // "dir": subpasta do projeto como destino (testes/medições); padrão = raiz do projeto
                sub = req.optString("dir", "").replaceAll("^/+|/+$", "");
                if (sub.contains("..")) {
                    return new String[]{"400", "{\"error\":\"dir\"}"};
                }
            }
            String base = exists("editor/template-full") ? "editor/template-full" : "editor/template";
            List<String> files = listFiles(base);
            Job j = new Job();
            j.total = files.size() + 1;
            j.source = base;
            job = j;
            final String t = title;
            final String d = sub;
            new Thread(() -> run(j, prj, base, files, t, d), "mz-template").start();
            return new String[]{"200", "{\"ok\":true,\"total\":" + j.total + ",\"source\":" + LocalServer.Json.str(base) + "}"};
        } catch (Exception e) {
            return new String[]{"400", "{\"error\":" + LocalServer.Json.str(String.valueOf(e)) + "}"};
        }
    }

    private boolean exists(String dir) {
        try {
            String[] l = assets.list(dir);
            return l != null && l.length > 0;
        } catch (IOException e) {
            return false;
        }
    }

    /** Lista do manifest.json do template (rápido); sem ele, percorre as pastas dos assets. */
    private List<String> listFiles(String base) throws IOException {
        List<String> out = new ArrayList<>();
        try (InputStream in = assets.open(base + "/manifest.json")) {
            JSONObject man = new JSONObject(new String(LocalServer.readAll(in), StandardCharsets.UTF_8));
            JSONArray arr = man.getJSONArray("files");
            for (int i = 0; i < arr.length(); i++) {
                Object o = arr.get(i);
                String p = o instanceof JSONObject ? ((JSONObject) o).getString("path") : String.valueOf(o);
                if (!p.contains("..") && !p.equals("game.rmmzproject")) {
                    out.add(p);
                }
            }
            return out;
        } catch (Exception e) {
            out.clear();
        }
        walk(base, "", out);
        out.remove("manifest.json");
        return out;
    }

    private void walk(String base, String rel, List<String> out) throws IOException {
        String[] names = assets.list(rel.isEmpty() ? base : base + "/" + rel);
        if (names == null) {
            return;
        }
        for (String n : names) {
            String r = rel.isEmpty() ? n : rel + "/" + n;
            String[] kids = assets.list(base + "/" + r);
            if (kids != null && kids.length > 0) {
                walk(base, r, out);
            } else {
                out.add(r);
            }
        }
    }

    private void run(Job j, SafProject prj, String base, List<String> files0, String title, String sub) {
        List<String> files = new ArrayList<>();
        for (String f : files0) {
            files.add(sub.isEmpty() ? f : sub + "/" + f);
        }
        final String prefix = sub.isEmpty() ? "" : sub + "/";
        long t0 = SystemClock.elapsedRealtime();
        ContentResolver resolver = prj.resolver();
        try {
            // 1) pastas primeiro, em ordem (pais antes dos filhos), guardando o Uri de cada uma
            Map<String, Uri> dirs = new ConcurrentHashMap<>();
            dirs.put("", prj.getRootDocumentUri());
            TreeSet<String> needed = new TreeSet<>();
            for (String f : files) {
                int s = f.lastIndexOf('/');
                while (s > 0) {
                    needed.add(f.substring(0, s));
                    s = f.lastIndexOf('/', s - 1);
                }
            }
            for (String d : needed) { // TreeSet: "img" antes de "img/faces"
                int s = d.lastIndexOf('/');
                String parent = s >= 0 ? d.substring(0, s) : "";
                String name = s >= 0 ? d.substring(s + 1) : d;
                SafProject.Entry existing = prj.resolve(d);
                Uri uri = existing != null && existing.isDir ? existing.uri
                    : DocumentsContract.createDocument(resolver, dirs.get(parent), DocumentsContract.Document.MIME_TYPE_DIR, name);
                if (uri == null) {
                    throw new IOException("não foi possível criar a pasta " + d);
                }
                dirs.put(d, uri);
            }
            // 2) arquivos em paralelo
            final String versionId = String.valueOf(new Random().nextInt(100000000));
            ExecutorService pool = Executors.newFixedThreadPool(THREADS);
            List<Future<?>> futures = new ArrayList<>();
            List<String> errors = Collections.synchronizedList(new ArrayList<>());
            for (String f : files) {
                futures.add(pool.submit(() -> {
                    if (!errors.isEmpty()) {
                        return;
                    }
                    try {
                        byte[] data;
                        String src = f.substring(prefix.length());
                        try (InputStream in = assets.open(base + "/" + src)) {
                            data = LocalServer.readAll(in);
                        }
                        data = personalize(src, data, title, versionId);
                        int s = f.lastIndexOf('/');
                        Uri dir = dirs.get(s >= 0 ? f.substring(0, s) : "");
                        writeNew(resolver, dir, s >= 0 ? f.substring(s + 1) : f, data);
                        j.file = f;
                        j.done.incrementAndGet();
                    } catch (Exception e) {
                        errors.add(f + ": " + e);
                    }
                }));
            }
            for (Future<?> fu : futures) {
                fu.get();
            }
            pool.shutdown();
            if (!errors.isEmpty()) {
                throw new IOException(errors.get(0));
            }
            if (!sub.isEmpty() && !dirs.containsKey(sub)) {
                SafProject.Entry e = prj.resolve(sub);
                dirs.put(sub, e != null ? e.uri : DocumentsContract.createDocument(resolver, dirs.get(""), DocumentsContract.Document.MIME_TYPE_DIR, sub));
            }
            writeNew(resolver, dirs.get(sub), "game.rmmzproject", "RPGMZ 1.1.1".getBytes(StandardCharsets.UTF_8));
            j.file = "game.rmmzproject";
            j.done.incrementAndGet();
            j.state = "done";
        } catch (Exception e) {
            Log.e(TAG, "copy", e);
            j.error = e.getMessage() != null ? e.getMessage() : String.valueOf(e);
            j.state = "error";
        } finally {
            prj.invalidate();
            j.ms = SystemClock.elapsedRealtime() - t0;
            Log.i(TAG, "template: " + j.done.get() + "/" + j.total + " arquivos em " + j.ms + " ms (" + j.state + ")");
        }
    }

    private static void writeNew(ContentResolver resolver, Uri dir, String name, byte[] data) throws IOException {
        Uri doc = DocumentsContract.createDocument(resolver, dir, LocalServer.Mime.of(name).split(";")[0], name);
        if (doc == null) {
            throw new IOException("não foi possível criar " + name);
        }
        try (OutputStream out = resolver.openOutputStream(doc, "w")) {
            if (out == null) {
                throw new IOException("não foi possível gravar " + name);
            }
            out.write(data);
        }
    }

    /** Mesmas personalizações do newproject.js. */
    static byte[] personalize(String path, byte[] data, String title, String versionId) throws Exception {
        if ("data/System.json".equals(path)) {
            JSONObject sys = new JSONObject(new String(data, StandardCharsets.UTF_8));
            sys.put("gameTitle", title);
            sys.put("versionId", Long.parseLong(versionId));
            return sys.toString().getBytes(StandardCharsets.UTF_8);
        }
        if ("index.html".equals(path)) {
            String esc = title.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
            String html = new String(data, StandardCharsets.UTF_8).replaceFirst("<title>[^<]*</title>",
                java.util.regex.Matcher.quoteReplacement("<title>" + esc + "</title>"));
            return html.getBytes(StandardCharsets.UTF_8);
        }
        return data;
    }
}
