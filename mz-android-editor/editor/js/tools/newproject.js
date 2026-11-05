// Novo projeto (Arquivo → Novo Projeto), como o MZ: copia o "newdata" inteiro (data/, img/,
// audio/, effects/, js/, ...) para a pasta nova e personaliza o título.
// Fonte do template, em ordem:
//   1. editor/template-full/ (APK: android/app/template.gradle copia RPG/newdata/ completo e
//      gera manifest.json) — o jogo criado roda e tem todos os recursos padrão;
//   2. editor/template/ (mínimo, no git: data/, js/, img/system/, fonts/) — PC/devserver;
//      o diálogo avisa que os recursos padrão faltam.
import { el, modal, alertBox, progressDialog } from "./ui.js";
import { t } from "../i18n.js";

const FULL_BASE = new URL("../../template-full/", import.meta.url);
const MIN_BASE = new URL("../../template/", import.meta.url);

async function fetchManifest(base) {
    const r = await fetch(new URL("manifest.json", base), { cache: "no-cache" });
    if (!r.ok) { throw new Error(new URL("manifest.json", base).pathname + ": " + r.status); }
    const m = await r.json();
    if (!m || !Array.isArray(m.files)) { throw new Error("manifest.json inválido"); }
    return m;
}

// → { base: URL, full: boolean, manifest: {total, files:[{path,size}]} }
let templatePromise = null;
export function loadTemplate() {
    if (!templatePromise) {
        templatePromise = fetchManifest(FULL_BASE)
            .then(manifest => ({ base: FULL_BASE, full: true, manifest }))
            .catch(() => fetchManifest(MIN_BASE).then(manifest => ({ base: MIN_BASE, full: false, manifest })));
        templatePromise.catch(() => { templatePromise = null; });
    }
    return templatePromise;
}
// Compatibilidade (api.tools.newProject.loadManifest): o manifest da fonte em uso.
export function loadManifest() {
    return loadTemplate().then(tp => tp.manifest);
}
export const templateFileUrl = (tp, rel) => new URL(rel.split("/").map(encodeURIComponent).join("/"), tp.base);

// ------------------------------------------------------------------ "writers" (destinos)
// Um writer é { write(relPath, Blob), finish?() }.

// Grava pela API do projeto aberto (útil para testes: prefix = "subpasta/").
export function apiWriter(project, prefix = "") {
    return {
        serverDir: prefix.replace(/\/+$/, ""),   // destino da cópia em lote do servidor ("" = raiz)
        write: (rel, blob) => project.writeBinary(prefix + rel, blob, blob.type || "application/octet-stream")
    };
}

// ------------------------------------------------------------------ cópia em lote no servidor
// Casca Android (LocalServer): POST /api/template/copy {title, dir} copia o template (template-full
// ou template) direto dos assets para o projeto SAF aberto, em Java e com várias threads, e
// personaliza System.json / index.html / game.rmmzproject. Progresso em GET /api/template/status
// → {done, total, file, state: "idle"|"running"|"done"|"error", error?}. No PC a rota não existe
// (o devserver responde 404) e a cópia segue arquivo a arquivo.
export async function serverCopyAvailable() {
    try {
        const r = await fetch("/api/template/status", { cache: "no-store" });
        if (!r.ok) { return false; }
        const s = await r.json();
        return !!s && typeof s.state === "string";
    } catch {
        return false;
    }
}

async function serverCopy(title, dir, onProgress) {
    const res = await fetch("/api/template/copy", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, dir })
    });
    if (!res.ok) { throw new Error("/api/template/copy: " + res.status + " " + (await res.text().catch(() => ""))); }
    for (;;) {
        await new Promise(r => setTimeout(r, 300));
        const s = await (await fetch("/api/template/status", { cache: "no-store" })).json();
        if (onProgress && s.total) { onProgress(s.done | 0, s.total | 0, s.file || ""); }
        if (s.state === "done") { return s.total | 0; }
        if (s.state === "error") { throw new Error(s.error || s.file || "template copy failed"); }
    }
}

// Grava numa pasta escolhida com a File System Access API (Chrome/Edge no PC).
export function dirWriter(dirHandle) {
    const dirs = new Map([["", dirHandle]]);
    const getDir = async rel => {
        if (dirs.has(rel)) { return dirs.get(rel); }
        const i = rel.lastIndexOf("/");
        const parent = await getDir(i < 0 ? "" : rel.slice(0, i));
        const h = await parent.getDirectoryHandle(i < 0 ? rel : rel.slice(i + 1), { create: true });
        dirs.set(rel, h);
        return h;
    };
    return {
        async write(rel, blob) {
            const i = rel.lastIndexOf("/");
            const dir = await getDir(i < 0 ? "" : rel.slice(0, i));
            const fh = await dir.getFileHandle(i < 0 ? rel : rel.slice(i + 1), { create: true });
            const w = await fh.createWritable();
            await w.write(blob);
            await w.close();
        }
    };
}

// Monta um .zip (método "store", sem compressão) em memória.
export function zipWriter(rootName = "") {
    const CRC = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) { c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; }
        CRC[n] = c >>> 0;
    }
    const crc32 = bytes => {
        let c = 0xFFFFFFFF;
        for (let i = 0; i < bytes.length; i++) { c = CRC[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8); }
        return (c ^ 0xFFFFFFFF) >>> 0;
    };
    const enc = new TextEncoder();
    const parts = [];
    const central = [];
    let offset = 0;
    const d = new Date();
    const dosTime = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    const dosDate = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    return {
        async write(rel, blob) {
            const data = new Uint8Array(await blob.arrayBuffer());
            const name = enc.encode((rootName ? rootName + "/" : "") + rel);
            const crc = crc32(data);
            const h = new DataView(new ArrayBuffer(30));
            h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true);
            h.setUint16(8, 0, true); h.setUint16(10, dosTime, true); h.setUint16(12, dosDate, true);
            h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true);
            h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
            parts.push(h.buffer, name, data);
            const c = new DataView(new ArrayBuffer(46));
            c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
            c.setUint16(10, 0, true); c.setUint16(12, dosTime, true); c.setUint16(14, dosDate, true);
            c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true);
            c.setUint16(28, name.length, true); c.setUint32(42, offset, true);
            central.push(c.buffer, name);
            offset += 30 + name.length + data.length;
        },
        finish() {
            const size = central.reduce((s, p) => s + p.byteLength, 0);
            const e = new DataView(new ArrayBuffer(22));
            const count = central.length / 2;
            e.setUint32(0, 0x06054b50, true); e.setUint16(8, count, true); e.setUint16(10, count, true);
            e.setUint32(12, size, true); e.setUint32(16, offset, true);
            return new Blob([...parts, ...central, e.buffer], { type: "application/zip" });
        }
    };
}

// ------------------------------------------------------------------ criação

const escapeHtml = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]));

// Grava o template em `writer`, personalizando o título como o MZ faz
// (System.json → gameTitle, <title> do index.html) e criando game.rmmzproject.
export async function createProject(writer, { title = "", onProgress } = {}) {
    if (typeof writer.serverDir === "string" && await serverCopyAvailable()) {
        return serverCopy(title, writer.serverDir, onProgress);
    }
    const tp = await loadTemplate();
    const files = tp.manifest.files;
    let done = 0;
    for (const f of files) {
        const res = await fetch(templateFileUrl(tp, f.path));
        if (!res.ok) { throw new Error(`${tp.base.pathname}${f.path}: ${res.status}`); }
        let blob = await res.blob();
        if (f.path === "data/System.json") {
            const sys = JSON.parse(await blob.text());
            sys.gameTitle = title;
            sys.versionId = Math.floor(Math.random() * 100000000);
            blob = new Blob([JSON.stringify(sys)], { type: "application/json" });
        } else if (f.path === "index.html") {
            const html = (await blob.text()).replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`);
            blob = new Blob([html], { type: "text/html" });
        }
        await writer.write(f.path, blob);
        done++;
        if (onProgress) { onProgress(done, files.length + 1, f.path); }
    }
    await writer.write("game.rmmzproject", new Blob(["RPGMZ 1.1.1"], { type: "text/plain" }));
    if (onProgress) { onProgress(files.length + 1, files.length + 1, "game.rmmzproject"); }
    return files.length + 1;
}

// ------------------------------------------------------------------ diálogo

function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = el("a", { href: url, download: name, style: { display: "none" } });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
}

const validName = s => /^[^\\/:*?"<>|]+$/.test(s) && !/^\.+$/.test(s);

export async function openNewProject(api) {
    const android = !!(window.Android && typeof window.Android.newProject === "function");
    const canPickDir = typeof window.showDirectoryPicker === "function";
    let parentDir = null;
    let n = 1;
    const name = el("input", { type: "text", class: "tlInput", value: "Project" + n, maxlength: 64 });
    const title = el("input", { type: "text", class: "tlInput", value: "", maxlength: 128 });
    const loc = el("input", { type: "text", class: "tlInput", readonly: true, value: "" });
    const err = el("div", { class: "tlErr" });
    const tp = await loadTemplate().catch(() => null);
    const manifest = tp && tp.manifest;

    let locText;
    if (android) {
        locText = t("(folder chosen on the device)");
    } else if (canPickDir) {
        locText = t("(click Choose…)");
    } else {
        locText = t("(will be downloaded as a .zip)");
    }
    loc.value = locText;
    const choose = el("button", { class: "tlBtn", type: "button", disabled: android || !canPickDir }, t("Choose…"));
    choose.addEventListener("click", async () => {
        try {
            parentDir = await window.showDirectoryPicker({ id: "mzNewProject", mode: "readwrite" });
            loc.value = parentDir.name + "\\" + (name.value || "");
        } catch { /* cancelado */ }
    });
    name.addEventListener("input", () => { if (parentDir) { loc.value = parentDir.name + "\\" + name.value; } });

    const ok = await modal(api, {
        title: t("New Project", "Dialog_NewProject"), width: "620px", height: "auto", cls: "tlNewDlg",
        build: b => {
            b.append(
                el("div", { class: "tlForm" },
                    el("label", { text: t("Name", "Constants") + ":", title: t("Name of the project folder.", "Dialog_NewProject") }), name,
                    el("label", { text: t("Game Title", "Dialog_NewProject") + ":", title: t("Title of the game.", "Dialog_NewProject") }), title,
                    el("label", { text: t("Location", "Dialog_NewProject") + ":", title: t("Location to create the project folder.", "Dialog_NewProject") }),
                    el("div", { class: "tlRow tlGrow" }, loc, choose)),
                el("div", { class: "tlHint" },
                    (manifest ? t("Template: %1 files (%2 MB).", null, manifest.files.length + 1, (manifest.total / 1048576).toFixed(1)) : t("Template unavailable.")) + " ",
                    tp && !tp.full
                        ? el("b", { class: "tlWarn" }, t("Only the minimal template is available: the default images and audio (characters, tilesets, music…) are missing and the game will not run until you copy them in Resource Manager → Import Default Resources."))
                        : ""),
                err);
        },
        buttons: [
            {
                label: t("OK", "BasicConstants"), primary: true, value: true, onClick: () => {
                    const nm = name.value.trim();
                    if (!nm) { err.textContent = t("Name is empty.", "Dialog_NewProject"); return false; }
                    if (!validName(nm)) { err.textContent = t("Invalid folder name."); return false; }
                    if (!manifest && !android) { err.textContent = t("Template not found (%1).", null, "editor/template/manifest.json"); return false; }
                    return true;
                }
            },
            { label: t("Cancel", "BasicConstants"), value: false }
        ]
    });
    if (!ok) { return; }
    const projName = name.value.trim();
    const gameTitle = title.value;

    if (android) {
        // A casca escolhe a pasta (SAF), cria <nome>/ e recarrega com ?newProject=<título>;
        // app.js chama createProject(apiWriter) e o template (completo no APK) é copiado.
        window.Android.newProject(projName, gameTitle);
        return;
    }
    const prog = progressDialog(api, t("Creating project…"));
    try {
        if (parentDir) {
            let target;
            try {
                await parentDir.getDirectoryHandle(projName, { create: false });
                prog.close();
                await alertBox(api, t("New Project", "Dialog_NewProject"), t("The project already exists.", "Dialog_NewProject") + "\n" + parentDir.name + "\\" + projName, "warning");
                return;
            } catch { target = await parentDir.getDirectoryHandle(projName, { create: true }); }
            await createProject(dirWriter(target), { title: gameTitle, onProgress: (d, n, f) => prog.set(d, n, f) });
            prog.close();
            await alertBox(api, t("New Project", "Dialog_NewProject"),
                t("Project created in %1.", null, parentDir.name + "\\" + projName) + "\n\n" +
                t("To edit it on the PC, restart the server with:") + "\n" +
                `node devserver/server.mjs --project "<path>\\${projName}"` +
                (tp.full ? "" : "\n\n" + t("For the default resources, open Resource Manager → Import Default Resources and choose the newdata folder of RPG Maker MZ.")));
        } else {
            const zip = zipWriter(projName);
            await createProject(zip, { title: gameTitle, onProgress: (d, n, f) => prog.set(d, n, f) });
            prog.close();
            download(zip.finish(), projName + ".zip");
            await alertBox(api, t("New Project", "Dialog_NewProject"),
                t("%1 with the new project has been downloaded.", null, projName + ".zip") + "\n\n" +
                t("Extract the .zip into a folder (on Android, e.g. in Documents/RPG) and use “%1”.", null, t("Open Project", "ProjectManager")) + "\n" +
                t("Alternatively, manually copy the editor's template folder (editor/template) and rename it."));
        }
    } catch (e) {
        prog.close();
        await alertBox(api, t("New Project", "Dialog_NewProject"), t("Failed to create a new project.", "ProjectManager") + "\n" + e.message, "warning");
    }
}
