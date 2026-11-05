package br.mz.editor;

import android.content.res.AssetManager;
import android.util.Log;

import java.io.BufferedInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Servidor HTTP mínimo em 127.0.0.1 que implementa o mesmo contrato do devserver Node:
 * "/" -> assets/editor, "/project/..." -> projeto aberto, "/api/..." -> metadados e gravação.
 */
public class LocalServer implements Runnable {
    private static final String TAG = "MZ.LocalServer";

    private final AssetManager assets;
    private volatile SafProject project;
    private ServerSocket socket;
    private final ExecutorService pool = Executors.newFixedThreadPool(6);
    private int port;

    public LocalServer(AssetManager assets) {
        this.assets = assets;
    }

    public void setProject(SafProject project) {
        this.project = project;
    }

    public SafProject getProject() {
        return project;
    }

    // Implantação (rotas /api/deploy/*), ligada pela MainActivity.
    private volatile Deployer deployer;

    void setDeployer(Deployer d) {
        this.deployer = d;
    }

    public int start() throws IOException {
        socket = new ServerSocket(0, 16, InetAddress.getByName("127.0.0.1"));
        port = socket.getLocalPort();
        Thread t = new Thread(this, "mz-http-accept");
        t.setDaemon(true);
        t.start();
        return port;
    }

    public int getPort() {
        return port;
    }

    public void stop() {
        try {
            if (socket != null) {
                socket.close();
            }
        } catch (IOException ignored) {
        }
        pool.shutdownNow();
    }

    @Override
    public void run() {
        while (!socket.isClosed()) {
            try {
                Socket client = socket.accept();
                pool.execute(() -> handle(client));
            } catch (IOException e) {
                if (!socket.isClosed()) {
                    Log.w(TAG, "accept", e);
                }
            }
        }
    }

    // ---- HTTP -------------------------------------------------------------------------

    private static final class Request {
        String method;
        String path;
        Map<String, String> query = new HashMap<>();
        Map<String, String> headers = new HashMap<>();
        byte[] body = new byte[0];
    }

    private void handle(Socket client) {
        try (Socket c = client) {
            c.setSoTimeout(15000);
            InputStream in = new BufferedInputStream(c.getInputStream(), 64 * 1024);
            OutputStream out = c.getOutputStream();
            Request req = parse(in);
            if (req == null) {
                return;
            }
            try {
                route(req, out);
            } catch (Exception e) {
                Log.e(TAG, req.method + " " + req.path, e);
                text(out, 500, "erro: " + e);
            }
            out.flush();
        } catch (IOException ignored) {
        }
    }

    private Request parse(InputStream in) throws IOException {
        String line = readLine(in);
        if (line == null || line.isEmpty()) {
            return null;
        }
        String[] parts = line.split(" ");
        if (parts.length < 2) {
            return null;
        }
        Request r = new Request();
        r.method = parts[0];
        String target = parts[1];
        int q = target.indexOf('?');
        r.path = q >= 0 ? target.substring(0, q) : target;
        if (q >= 0) {
            for (String kv : target.substring(q + 1).split("&")) {
                int eq = kv.indexOf('=');
                String k = eq >= 0 ? kv.substring(0, eq) : kv;
                String v = eq >= 0 ? kv.substring(eq + 1) : "";
                r.query.put(URLDecoder.decode(k, "UTF-8"), URLDecoder.decode(v, "UTF-8"));
            }
        }
        r.path = URLDecoder.decode(r.path, "UTF-8");
        String h;
        while ((h = readLine(in)) != null && !h.isEmpty()) {
            int colon = h.indexOf(':');
            if (colon > 0) {
                r.headers.put(h.substring(0, colon).trim().toLowerCase(Locale.ROOT), h.substring(colon + 1).trim());
            }
        }
        String len = r.headers.get("content-length");
        if (len != null) {
            int n = Integer.parseInt(len);
            byte[] body = new byte[n];
            int off = 0;
            while (off < n) {
                int read = in.read(body, off, n - off);
                if (read < 0) {
                    break;
                }
                off += read;
            }
            r.body = body;
        }
        return r;
    }

    private static String readLine(InputStream in) throws IOException {
        ByteArrayOutputStream buf = new ByteArrayOutputStream();
        int b;
        while ((b = in.read()) >= 0) {
            if (b == '\n') {
                break;
            }
            if (b != '\r') {
                buf.write(b);
            }
        }
        if (b < 0 && buf.size() == 0) {
            return null;
        }
        return buf.toString("UTF-8");
    }

    private void route(Request req, OutputStream out) throws IOException {
        String p = req.path;
        if (p.startsWith("/api/")) {
            api(req, out);
        } else if (p.equals("/project")) {
            redirect(out, "/project/index.html");
        } else if (p.startsWith("/project/")) {
            String rel = p.substring("/project/".length());
            serveProject(req, out, rel.isEmpty() ? "index.html" : rel);
        } else {
            serveAsset(req, out, p.equals("/") ? "index.html" : p.substring(1));
        }
    }

    private void api(Request req, OutputStream out) throws IOException {
        SafProject prj = project;
        switch (req.path) {
            case "/api/project": {
                if (prj == null) {
                    json(out, 404, "{\"error\":\"no_project\"}");
                    return;
                }
                StringBuilder sb = new StringBuilder();
                sb.append("{\"name\":").append(Json.str(prj.getName()))
                  .append(",\"root\":").append(Json.str(prj.getRootUri().toString()))
                  .append(",\"platform\":\"android\",\"files\":[]}");
                json(out, 200, sb.toString());
                return;
            }
            case "/api/file": {
                if (prj == null) {
                    text(out, 404, "no project");
                    return;
                }
                String rel = req.query.get("path");
                if (rel == null || rel.contains("..")) {
                    text(out, 403, "forbidden");
                    return;
                }
                if ("GET".equals(req.method)) {
                    serveProject(req, out, rel);
                } else if ("PUT".equals(req.method) || "POST".equals(req.method)) {
                    prj.write(rel, req.body);
                    json(out, 200, "{\"ok\":true,\"bytes\":" + req.body.length + "}");
                } else if ("DELETE".equals(req.method)) {
                    if (prj.delete(rel)) {
                        json(out, 200, "{\"ok\":true}");
                    } else {
                        text(out, 404, "not found");
                    }
                } else {
                    text(out, 405, "method");
                }
                return;
            }
            case "/api/list": {
                if (prj == null) {
                    text(out, 404, "no project");
                    return;
                }
                String dir = req.query.get("dir");
                json(out, 200, prj.listJson(dir == null ? "" : dir));
                return;
            }
            default: {
                Deployer d = deployer;
                String[] r = d != null && req.path.startsWith("/api/deploy/")
                    ? d.handle(req.method, req.path, req.query, req.body) : null;
                if (r != null) {
                    json(out, Integer.parseInt(r[0]), r[1]);
                    return;
                }
                text(out, 404, "unknown api");
            }
        }
    }

    private void serveAsset(Request req, OutputStream out, String rel) throws IOException {
        if (rel.contains("..")) {
            text(out, 403, "forbidden");
            return;
        }
        try (InputStream in = assets.open("editor/" + rel)) {
            byte[] data = readAll(in);
            bytes(out, 200, Mime.of(rel), data, req);
        } catch (IOException e) {
            text(out, 404, "not found: " + rel);
        }
    }

    private void serveProject(Request req, OutputStream out, String rel) throws IOException {
        SafProject prj = project;
        if (prj == null) {
            text(out, 404, "no project");
            return;
        }
        if (rel.contains("..")) {
            text(out, 403, "forbidden");
            return;
        }
        SafProject.Entry entry = prj.resolve(rel);
        if (entry == null || entry.isDir) {
            text(out, 404, "not found: " + rel);
            return;
        }
        String type = Mime.of(rel);
        long size = entry.size;
        String rangeHeader = req.headers.get("range");
        long start = 0;
        long end = size - 1;
        int status = 200;
        if (rangeHeader != null && rangeHeader.startsWith("bytes=") && size > 0) {
            String[] r = rangeHeader.substring(6).split("-", 2);
            try {
                if (!r[0].isEmpty()) {
                    start = Long.parseLong(r[0]);
                    if (r.length > 1 && !r[1].isEmpty()) {
                        end = Math.min(size - 1, Long.parseLong(r[1]));
                    }
                } else if (r.length > 1 && !r[1].isEmpty()) {
                    long suffix = Long.parseLong(r[1]);
                    start = Math.max(0, size - suffix);
                }
                status = 206;
            } catch (NumberFormatException ignored) {
                start = 0;
                end = size - 1;
            }
        }
        long length = end - start + 1;
        StringBuilder head = new StringBuilder();
        head.append("HTTP/1.1 ").append(status).append(status == 206 ? " Partial Content" : " OK").append("\r\n")
            .append("Content-Type: ").append(type).append("\r\n")
            .append("Accept-Ranges: bytes\r\n")
            .append("Cache-Control: no-store\r\n")
            .append("Connection: close\r\n")
            .append("Content-Length: ").append(length).append("\r\n");
        if (status == 206) {
            head.append("Content-Range: bytes ").append(start).append('-').append(end).append('/').append(size).append("\r\n");
        }
        head.append("\r\n");
        out.write(head.toString().getBytes(StandardCharsets.ISO_8859_1));
        if ("HEAD".equals(req.method)) {
            return;
        }
        try (InputStream in = prj.open(entry)) {
            long skipped = 0;
            while (skipped < start) {
                long s = in.skip(start - skipped);
                if (s <= 0) {
                    break;
                }
                skipped += s;
            }
            byte[] buf = new byte[64 * 1024];
            long remaining = length;
            while (remaining > 0) {
                int n = in.read(buf, 0, (int) Math.min(buf.length, remaining));
                if (n < 0) {
                    break;
                }
                out.write(buf, 0, n);
                remaining -= n;
            }
        }
    }

    // ---- respostas --------------------------------------------------------------------

    private static void bytes(OutputStream out, int status, String type, byte[] data, Request req) throws IOException {
        String head = "HTTP/1.1 " + status + " OK\r\n"
            + "Content-Type: " + type + "\r\n"
            + "Content-Length: " + data.length + "\r\n"
            + "Cache-Control: no-store\r\n"
            + "Connection: close\r\n\r\n";
        out.write(head.getBytes(StandardCharsets.ISO_8859_1));
        if (req == null || !"HEAD".equals(req.method)) {
            out.write(data);
        }
    }

    private static void text(OutputStream out, int status, String body) throws IOException {
        bytes(out, status, "text/plain; charset=utf-8", body.getBytes(StandardCharsets.UTF_8), null);
    }

    private static void json(OutputStream out, int status, String body) throws IOException {
        bytes(out, status, "application/json; charset=utf-8", body.getBytes(StandardCharsets.UTF_8), null);
    }

    private static void redirect(OutputStream out, String location) throws IOException {
        String head = "HTTP/1.1 302 Found\r\nLocation: " + location + "\r\nContent-Length: 0\r\nConnection: close\r\n\r\n";
        out.write(head.getBytes(StandardCharsets.ISO_8859_1));
    }

    static byte[] readAll(InputStream in) throws IOException {
        ByteArrayOutputStream buf = new ByteArrayOutputStream();
        byte[] b = new byte[64 * 1024];
        int n;
        while ((n = in.read(b)) >= 0) {
            buf.write(b, 0, n);
        }
        return buf.toByteArray();
    }

    /** Tipos MIME por extensão (mesma tabela do devserver). */
    static final class Mime {
        private static final Map<String, String> TABLE = new HashMap<>();
        static {
            TABLE.put("html", "text/html; charset=utf-8");
            TABLE.put("js", "text/javascript; charset=utf-8");
            TABLE.put("mjs", "text/javascript; charset=utf-8");
            TABLE.put("css", "text/css; charset=utf-8");
            TABLE.put("json", "application/json; charset=utf-8");
            TABLE.put("png", "image/png");
            TABLE.put("jpg", "image/jpeg");
            TABLE.put("jpeg", "image/jpeg");
            TABLE.put("gif", "image/gif");
            TABLE.put("ogg", "audio/ogg");
            TABLE.put("m4a", "audio/mp4");
            TABLE.put("wav", "audio/wav");
            TABLE.put("wasm", "application/wasm");
            TABLE.put("ttf", "font/ttf");
            TABLE.put("woff", "font/woff");
            TABLE.put("woff2", "font/woff2");
            TABLE.put("svg", "image/svg+xml");
            TABLE.put("txt", "text/plain; charset=utf-8");
        }

        static String of(String name) {
            int dot = name.lastIndexOf('.');
            String ext = dot >= 0 ? name.substring(dot + 1).toLowerCase(Locale.ROOT) : "";
            String t = TABLE.get(ext);
            return t != null ? t : "application/octet-stream";
        }
    }

    /** Escapes mínimos para montar JSON sem biblioteca. */
    static final class Json {
        static String str(String s) {
            StringBuilder sb = new StringBuilder("\"");
            for (char ch : s.toCharArray()) {
                switch (ch) {
                    case '"': sb.append("\\\""); break;
                    case '\\': sb.append("\\\\"); break;
                    case '\n': sb.append("\\n"); break;
                    case '\r': sb.append("\\r"); break;
                    case '\t': sb.append("\\t"); break;
                    default:
                        if (ch < 0x20) {
                            sb.append(String.format("\\u%04x", (int) ch));
                        } else {
                            sb.append(ch);
                        }
                }
            }
            return sb.append('"').toString();
        }
    }
}
