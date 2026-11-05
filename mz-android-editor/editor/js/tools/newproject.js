// Novo projeto (Arquivo → Novo Projeto). O template mínimo do MZ (data/*.json em branco,
// index.html, css/, js/ com libs e plugins oficiais, img/system/, fonts/, icon/) vem de
// editor/template/ (cópia de RPG/newdata/ listada em template/manifest.json). Os recursos
// grandes (img/characters, audio/...) são um pacote opcional, importado depois pelo
// Resource Manager → "Importar recursos padrão".
import { el, modal, alertBox, progressDialog } from "./ui.js";

const TEMPLATE_BASE = new URL("../../template/", import.meta.url);

let manifestPromise = null;
export function loadManifest() {
    if (!manifestPromise) {
        manifestPromise = fetch(new URL("manifest.json", TEMPLATE_BASE)).then(r => {
            if (!r.ok) { throw new Error("template/manifest.json: " + r.status); }
            return r.json();
        });
        manifestPromise.catch(() => { manifestPromise = null; });
    }
    return manifestPromise;
}

// ------------------------------------------------------------------ "writers" (destinos)
// Um writer é { write(relPath, Blob), finish?() }.

// Grava pela API do projeto aberto (útil para testes: prefix = "subpasta/").
export function apiWriter(project, prefix = "") {
    return { write: (rel, blob) => project.writeBinary(prefix + rel, blob, blob.type || "application/octet-stream") };
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
    const manifest = await loadManifest();
    const files = manifest.files;
    let done = 0;
    for (const f of files) {
        const res = await fetch(new URL(f.path.split("/").map(encodeURIComponent).join("/"), TEMPLATE_BASE));
        if (!res.ok) { throw new Error(`template/${f.path}: ${res.status}`); }
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
    const manifest = await loadManifest().catch(() => null);

    let locText;
    if (android) {
        locText = "(pasta escolhida pelo aparelho)";
    } else if (canPickDir) {
        locText = "(clique em Escolher…)";
    } else {
        locText = "(será baixado como .zip)";
    }
    loc.value = locText;
    const choose = el("button", { class: "tlBtn", type: "button", disabled: android || !canPickDir }, "Escolher…");
    choose.addEventListener("click", async () => {
        try {
            parentDir = await window.showDirectoryPicker({ id: "mzNewProject", mode: "readwrite" });
            loc.value = parentDir.name + "\\" + (name.value || "");
        } catch { /* cancelado */ }
    });
    name.addEventListener("input", () => { if (parentDir) { loc.value = parentDir.name + "\\" + name.value; } });

    const ok = await modal(api, {
        title: "New Project", width: "620px", height: "auto", cls: "tlNewDlg",
        build: b => {
            b.append(
                el("div", { class: "tlForm" },
                    el("label", { text: "Nome:" }), name,
                    el("label", { text: "Título do jogo:" }), title,
                    el("label", { text: "Local:" }), el("div", { class: "tlRow tlGrow" }, loc, choose)),
                el("div", { class: "tlHint" },
                    manifest ? `Template: ${manifest.files.length + 1} arquivos (${(manifest.total / 1048576).toFixed(1)} MB). ` : "Template indisponível. ",
                    "Imagens e áudios padrão (personagens, tilesets, músicas…) são opcionais: copie depois em Resource Manager → Importar recursos padrão."),
                err);
        },
        buttons: [
            {
                label: "OK", primary: true, value: true, onClick: () => {
                    if (!validName(name.value.trim())) { err.textContent = "Nome de pasta inválido."; return false; }
                    if (!manifest && !android) { err.textContent = "Template não encontrado (editor/template/manifest.json)."; return false; }
                    return true;
                }
            },
            { label: "Cancelar", value: false }
        ]
    });
    if (!ok) { return; }
    const projName = name.value.trim();
    const gameTitle = title.value;

    if (android) {
        // A casca Android escolhe a pasta (SAF), copia editor/template/ e abre o projeto.
        window.Android.newProject(projName, gameTitle);
        return;
    }
    const prog = progressDialog(api, "Criando projeto…");
    try {
        if (parentDir) {
            let target;
            try {
                await parentDir.getDirectoryHandle(projName, { create: false });
                prog.close();
                await alertBox(api, "New Project", `A pasta "${projName}" já existe em ${parentDir.name}. Escolha outro nome.`, "warning");
                return;
            } catch { target = await parentDir.getDirectoryHandle(projName, { create: true }); }
            await createProject(dirWriter(target), { title: gameTitle, onProgress: (d, t, f) => prog.set(d, t, f) });
            prog.close();
            await alertBox(api, "New Project",
                `Projeto criado em ${parentDir.name}\\${projName}.\n\n` +
                "Para editá-lo no PC, reinicie o servidor com:\n" +
                `node devserver/server.mjs --project "<caminho>\\${projName}"\n\n` +
                "Para os recursos padrão, abra o Resource Manager → Importar recursos padrão e escolha a pasta newdata do RPG Maker MZ.");
        } else {
            const zip = zipWriter(projName);
            await createProject(zip, { title: gameTitle, onProgress: (d, t, f) => prog.set(d, t, f) });
            prog.close();
            download(zip.finish(), projName + ".zip");
            await alertBox(api, "New Project",
                `Foi baixado ${projName}.zip com o projeto novo.\n\n` +
                "Extraia o .zip numa pasta (no Android, por exemplo, em Documentos/RPG) e use “Abrir projeto”.\n" +
                "Alternativa: copie manualmente a pasta template do editor (editor/template) e renomeie-a.");
        }
    } catch (e) {
        prog.close();
        await alertBox(api, "New Project", "Falha ao criar o projeto: " + e.message, "warning");
    }
}
