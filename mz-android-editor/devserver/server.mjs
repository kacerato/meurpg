// Servidor de desenvolvimento do editor MZ.
// Contrato HTTP (o mesmo que a casca Android implementa com NanoHTTPD):
//   GET  /                      -> editor/index.html (estáticos do editor)
//   GET  /project/<caminho>     -> arquivo do projeto aberto (index.html, js/, img/, data/ ...)
//   GET  /api/project           -> { name, root, files: [...] } (metadados do projeto)
//   GET  /api/file?path=data/X  -> conteúdo bruto do arquivo do projeto
//   PUT  /api/file?path=data/X  -> grava o corpo no arquivo do projeto (cria pastas)
//   GET  /api/list?dir=img/x    -> lista de nomes dentro de uma pasta do projeto
//   POST /api/openFolder        -> Jogo > Abrir Pasta: abre a pasta do projeto no gerenciador de arquivos
// Uso: node server.mjs --project <pasta do projeto> [--port 8765]

import http from "node:http";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const argOf = (k, d) => {
    const i = args.indexOf(k);
    return i >= 0 ? args[i + 1] : d;
};
const PORT = Number(argOf("--port", 8765));
const EDITOR_DIR = path.resolve(here, "..", "editor");
const PROJECT_DIR = path.resolve(argOf("--project", path.resolve(here, "..", "testproject")));

const MIME = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".ogg": "audio/ogg",
    ".m4a": "audio/mp4",
    ".wasm": "application/wasm",
    ".ttf": "font/ttf",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".svg": "image/svg+xml",
    ".efkefc": "application/octet-stream",
    ".txt": "text/plain; charset=utf-8"
};

function safeJoin(root, rel) {
    const p = path.resolve(root, decodeURIComponent(rel).replace(/^\/+/, ""));
    if (!p.startsWith(root)) {
        return null;
    }
    return p;
}

function send(res, status, body, type = "text/plain; charset=utf-8", extra = {}) {
    res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store", ...extra });
    res.end(body);
}

async function serveStatic(res, root, rel) {
    const file = safeJoin(root, rel);
    if (!file) {
        return send(res, 403, "forbidden");
    }
    try {
        const st = await fsp.stat(file);
        if (!st.isFile()) {
            return send(res, 404, "not found");
        }
        const type = MIME[path.extname(file).toLowerCase()] || "application/octet-stream";
        res.writeHead(200, { "Content-Type": type, "Content-Length": st.size, "Cache-Control": "no-store" });
        fs.createReadStream(file).pipe(res);
    } catch {
        send(res, 404, "not found");
    }
}

async function walk(dir, rel = "", out = []) {
    const entries = await fsp.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
        const r = rel ? rel + "/" + e.name : e.name;
        if (e.isDirectory()) {
            await walk(path.join(dir, e.name), r, out);
        } else {
            out.push(r);
        }
    }
    return out;
}

async function readBody(req) {
    const chunks = [];
    for await (const c of req) {
        chunks.push(c);
    }
    return Buffer.concat(chunks);
}

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const p = url.pathname;
    try {
        if (p.startsWith("/api/")) {
            if (p === "/api/project" && req.method === "GET") {
                const files = await walk(PROJECT_DIR);
                const body = { name: path.basename(PROJECT_DIR), root: PROJECT_DIR, files, platform: "node" };
                return send(res, 200, JSON.stringify(body), MIME[".json"]);
            }
            if (p === "/api/file") {
                const file = safeJoin(PROJECT_DIR, url.searchParams.get("path") || "");
                if (!file) {
                    return send(res, 403, "forbidden");
                }
                if (req.method === "GET") {
                    return serveStatic(res, PROJECT_DIR, url.searchParams.get("path") || "");
                }
                if (req.method === "PUT") {
                    const body = await readBody(req);
                    await fsp.mkdir(path.dirname(file), { recursive: true });
                    await fsp.writeFile(file, body);
                    return send(res, 200, JSON.stringify({ ok: true, bytes: body.length }), MIME[".json"]);
                }
                if (req.method === "DELETE") {
                    try {
                        await fsp.unlink(file);
                        return send(res, 200, JSON.stringify({ ok: true }), MIME[".json"]);
                    } catch {
                        return send(res, 404, "not found");
                    }
                }
            }
            if (p === "/api/openFolder" && req.method === "POST") {
                const cmd = process.platform === "win32" ? "explorer" : process.platform === "darwin" ? "open" : "xdg-open";
                spawn(cmd, [PROJECT_DIR], { detached: true, stdio: "ignore" }).on("error", () => {}).unref();
                return send(res, 200, JSON.stringify({ ok: true }), MIME[".json"]);
            }
            if (p === "/api/list" && req.method === "GET") {
                const dir = safeJoin(PROJECT_DIR, url.searchParams.get("dir") || "");
                if (!dir) {
                    return send(res, 403, "forbidden");
                }
                const entries = await fsp.readdir(dir, { withFileTypes: true });
                const list = entries.map(e => ({ name: e.name, dir: e.isDirectory() }));
                return send(res, 200, JSON.stringify(list), MIME[".json"]);
            }
            return send(res, 404, "unknown api");
        }
        if (p.startsWith("/project/")) {
            const rel = p.slice("/project/".length) || "index.html";
            if (rel === "index.html" || rel.endsWith("/index.html")) {
                // teste de jogo: injeta /fitscreen.js (tela cheia opcional) antes do main.js
                const file = safeJoin(PROJECT_DIR, rel);
                try {
                    let html = await fsp.readFile(file, "utf8");
                    if (!html.includes("/fitscreen.js")) {
                        const m = html.indexOf("main.js");
                        let at = m >= 0 ? html.lastIndexOf("<script", m) : -1;
                        if (at < 0) { at = html.lastIndexOf("</body>"); }
                        if (at >= 0) {
                            html = html.slice(0, at) + '<script type="text/javascript" src="/fitscreen.js"></script>\n' + html.slice(at);
                        }
                    }
                    return send(res, 200, html, MIME[".html"]);
                } catch {
                    return send(res, 404, "not found");
                }
            }
            return serveStatic(res, PROJECT_DIR, rel);
        }
        if (p === "/project") {
            res.writeHead(302, { Location: "/project/index.html" });
            return res.end();
        }
        return serveStatic(res, EDITOR_DIR, p === "/" ? "index.html" : p);
    } catch (e) {
        send(res, 500, String(e && e.stack || e));
    }
});

server.listen(PORT, "127.0.0.1", () => {
    console.log(`editor:  http://127.0.0.1:${PORT}/`);
    console.log(`project: ${PROJECT_DIR}`);
});
