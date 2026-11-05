// Resource Manager (Ferramentas → Gerenciador de Recursos), fiel ao RPG Maker MZ:
// lista de pastas à esquerda, lista de arquivos, pré-visualização e os botões
// Import / Export / Delete / DLC / Preview. Extra: "Importar recursos padrão".
import { el, button, modal, confirmBox, alertBox, progressDialog } from "./ui.js";
import * as audio from "./audio.js";
import { t } from "../i18n.js";
import { loadTemplate, templateFileUrl } from "./newproject.js";

// Pastas na ordem do Resource Manager do MZ.
export const FOLDERS = [
    "audio/bgm", "audio/bgs", "audio/me", "audio/se",
    "effects",
    "img/battlebacks1", "img/battlebacks2", "img/characters",
    "img/enemies", "img/faces", "img/parallaxes", "img/pictures",
    "img/sv_actors", "img/sv_enemies", "img/system", "img/tilesets",
    "img/titles1", "img/titles2",
    "movies"
];
// Pastas de topo cujos arquivos podem ficar em subpastas (effects/Texture, effects/Model).
const NESTED = new Set(["effects"]);

export function extsFor(folder) {
    if (folder.startsWith("audio/")) { return ["ogg", "m4a"]; }
    if (folder === "effects") { return ["efkefc"]; }
    if (folder === "movies") { return ["webm", "mp4"]; }
    return ["png"];
}
function acceptFor(folder) {
    if (folder.startsWith("audio/")) { return ".ogg,.m4a,audio/ogg,audio/mp4"; }
    if (folder === "effects") { return ".efkefc"; }
    if (folder === "movies") { return ".webm,.mp4,video/webm,video/mp4"; }
    return ".png,image/png";
}
const MIME = { png: "image/png", ogg: "audio/ogg", m4a: "audio/mp4", webm: "video/webm", mp4: "video/mp4", efkefc: "application/octet-stream" };
// Pasta de recurso de um caminho relativo ("img/faces/Actor1.png" → "img/faces"), ou null.
function resourceFolderOf(rel) {
    const segs = rel.split("/");
    if (segs.length < 2) { return null; }
    if (NESTED.has(segs[0]) || segs[0] === "movies") { return segs[0]; }
    const two = segs[0] + "/" + segs[1];
    return FOLDERS.includes(two) && segs.length > 2 ? two : null;
}
const extOf = n => (n.lastIndexOf(".") > 0 ? n.slice(n.lastIndexOf(".") + 1).toLowerCase() : "");
const baseOf = n => (n.lastIndexOf(".") > 0 ? n.slice(0, n.lastIndexOf(".")) : n);
const fileUrl = (folder, name) => `/project/${folder}/${encodeURIComponent(name)}`;

let api = null;
export function init(theApi) { api = theApi; }

export async function listFolder(folder) {
    const entries = await api.project.list(folder).catch(() => []);
    const exts = extsFor(folder);
    return (entries || [])
        .filter(e => !e.dir && exts.includes(extOf(typeof e === "string" ? e : e.name)))
        .map(e => (typeof e === "string" ? e : e.name))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

// ------------------------------------------------------------------ importação

function chooseFiles({ accept, multiple = true, directory = false }) {
    if (directory && window.Android && typeof window.Android.pickFolder === "function") {
        return chooseAndroidFolder();
    }
    return new Promise(resolve => {
        const input = el("input", { type: "file", accept, multiple, style: { display: "none" } });
        if (directory) { input.webkitdirectory = true; input.setAttribute("webkitdirectory", ""); }
        let settled = false;
        input.addEventListener("change", () => { settled = true; resolve([...input.files]); input.remove(); });
        input.addEventListener("cancel", () => { if (!settled) { settled = true; resolve([]); input.remove(); } });
        document.body.appendChild(input);
        input.click();
    });
}

// Android: o WebView abre o seletor de ARQUIVOS para webkitdirectory (sem caminhos relativos).
// A casca escolhe a pasta pelo SAF e o servidor local a expõe; devolve objetos com name, size,
// webkitRelativePath e load() (lido só na hora de copiar).
function chooseAndroidFolder() {
    return new Promise(resolve => {
        window.mzFolderPicked = async name => {
            window.mzFolderPicked = null;
            if (!name) { resolve([]); return; }
            try {
                const r = await fetch("/api/extfolder/list", { cache: "no-store" });
                const { files } = await r.json();
                resolve(files.map(f => ({
                    name: f.path.slice(f.path.lastIndexOf("/") + 1),
                    size: f.size,
                    webkitRelativePath: name + "/" + f.path,
                    load: () => fetch("/api/extfolder/file?path=" + encodeURIComponent(f.path)).then(res => {
                        if (!res.ok) { throw new Error(res.status + " " + f.path); }
                        return res.blob();
                    })
                })));
            } catch (e) {
                console.error(e);
                resolve([]);
            }
        };
        window.Android.pickFolder();
    });
}

async function writeAll(items, title) {
    // items: [{rel, file}]
    const prog = items.length > 3 ? progressDialog(api, title) : null;
    let done = 0;
    const failed = [];
    const queue = items.slice();
    const worker = async () => {
        while (queue.length) {
            const it = queue.shift();
            try {
                const blob = it.file || await it.load();
                await api.project.writeBinary(it.rel, blob, MIME[extOf(it.rel)] || blob.type || "application/octet-stream");
            } catch (e) {
                failed.push(it.rel + ": " + e.message);
            }
            done++;
            if (prog) { prog.set(done, items.length, `${done} / ${items.length} — ${it.rel}`); }
        }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
    if (prog) { prog.close(); }
    const folders = new Set(items.map(i => i.rel.slice(0, i.rel.lastIndexOf("/"))));
    for (const folder of folders) { api.emit("resources:changed", { folder }); }
    if (failed.length) {
        await alertBox(api, t("Import", "Dialog_ResourceManager"), t("Failed to import:") + "\n" + failed.slice(0, 20).join("\n"), "warning");
    }
    return items.length - failed.length;
}

// Importa arquivos escolhidos pelo usuário para `folder`. Devolve os nomes gravados.
export async function importFiles(folder) {
    const files = await chooseFiles({ accept: acceptFor(folder) });
    if (!files.length) { return []; }
    const exts = extsFor(folder);
    const ok = files.filter(f => exts.includes(extOf(f.name)));
    const skipped = files.length - ok.length;
    const existing = new Set(await listFolder(folder));
    const dup = ok.filter(f => existing.has(f.name));
    if (dup.length && !(await confirmBox(api, t("Import", "Dialog_ResourceManager"),
        t("%1 file(s) already exist in %2 and will be replaced:", null, dup.length, folder) + "\n" +
        `${dup.slice(0, 8).map(f => f.name).join(", ")}${dup.length > 8 ? "…" : ""}`))) {
        return [];
    }
    await writeAll(ok.map(f => ({ rel: `${folder}/${f.name}`, file: f })), t("Importing…"));
    if (skipped) {
        await alertBox(api, t("Import", "Dialog_ResourceManager"), t("%1 file(s) skipped: invalid type for %2 (%3).", null, skipped, folder, exts.join(", ")), "warning");
    }
    api.status(t("%1 file(s) imported into %2", null, ok.length, folder));
    return ok.map(f => f.name);
}

// Escolhe uma pasta (ex.: newdata do MZ, um DLC) e copia os recursos dela.
// onlyFolder: limita a uma pasta de recursos (botão DLC); senão importa img/, audio/, effects/.
export async function importFromFolder(onlyFolder = null) {
    const files = await chooseFiles({ directory: true });
    if (!files.length) { return 0; }
    const known = new Set(FOLDERS);
    const items = [];
    for (const f of files) {
        const segs = (f.webkitRelativePath || f.name).split("/");
        let rel = null;
        for (let i = 0; i < segs.length - 1; i++) {
            const two = segs[i] + "/" + segs[i + 1];
            if (known.has(two) && i + 2 < segs.length) { rel = segs.slice(i).join("/"); break; }
            if ((NESTED.has(segs[i]) || segs[i] === "movies") && i + 1 < segs.length) { rel = segs.slice(i).join("/"); break; }
        }
        if (!rel) { continue; }
        const folder = resourceFolderOf(rel);
        if (!folder) { continue; }
        if (onlyFolder && folder !== onlyFolder) { continue; }
        // effects/ inclui texturas (effects/Texture/*.png) usadas pelos .efkefc
        if (!NESTED.has(folder) && !extsFor(folder).includes(extOf(f.name))) { continue; }
        items.push(f.load ? { rel, load: f.load, size: f.size } : { rel, file: f, size: f.size });
    }
    if (!items.length) {
        await alertBox(api, t("Import", "Dialog_ResourceManager"), onlyFolder
            ? t("No %1 files found in the chosen folder.", null, onlyFolder)
            : t("No resources (img/, audio/, effects/) found in the chosen folder."), "warning");
        return 0;
    }
    return copyMissing(items, onlyFolder ? t("DLC", "Dialog_ResourceManager") : t("Import Default Resources"));
}

// Copia os itens [{rel, file | load(), size}] que ainda não existem no projeto (não sobrescreve).
async function copyMissing(items, title, intro = "") {
    const existingBy = new Map();
    for (const dir of new Set(items.map(i => i.rel.slice(0, i.rel.lastIndexOf("/"))))) {
        const ents = await api.project.list(dir).catch(() => []);
        existingBy.set(dir, new Set((ents || []).filter(e => !e.dir).map(e => e.name || e)));
    }
    const fresh = items.filter(i => {
        const k = i.rel.lastIndexOf("/");
        return !existingBy.get(i.rel.slice(0, k)).has(i.rel.slice(k + 1));
    });
    const keep = items.length - fresh.length;
    if (!fresh.length) {
        await alertBox(api, title, t("%1 already exist and will be kept.", null, keep));
        return 0;
    }
    const total = fresh.reduce((s, i) => s + (i.size || 0), 0);
    if (!(await confirmBox(api, title, (intro ? intro + "\n\n" : "") +
        t("Copy %1 file(s) (%2 MB) to the project?", null, fresh.length, (total / 1048576).toFixed(1)) +
        (keep ? "\n" + t("%1 already exist and will be kept.", null, keep) : "")))) {
        return 0;
    }
    const n = await writeAll(fresh, t("Importing resources…"));
    api.status(t("%1 resource(s) imported", null, n));
    return n;
}

// "Importar recursos padrão": usa o template completo do editor (editor/template-full/, empacotado
// no APK) — a mesma fonte do Novo projeto; sem ele, pede a pasta (ex.: RPG/newdata).
export async function importDefaultResources() {
    const tp = await loadTemplate().catch(() => null);
    if (!tp || !tp.full) { return importFromFolder(null); }
    const items = tp.manifest.files
        .filter(f => resourceFolderOf(f.path))
        .map(f => ({
            rel: f.path, size: f.size,
            load: async () => {
                const r = await fetch(templateFileUrl(tp, f.path));
                if (!r.ok) { throw new Error("HTTP " + r.status); }
                return r.blob();
            }
        }));
    return copyMissing(items, t("Import Default Resources"), t("Source: default resources of RPG Maker MZ 1.1.1 (bundled with the editor)."));
}

// ------------------------------------------------------------------ exportação

export async function exportFile(folder, name) {
    const rel = `${folder}/${name}`;
    if (window.Android && typeof window.Android.shareFile === "function") {
        window.Android.shareFile(rel, MIME[extOf(name)] || "application/octet-stream");
        return;
    }
    const res = await fetch(fileUrl(folder, name));
    if (!res.ok) { throw new Error("HTTP " + res.status); }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = el("a", { href: url, download: name, style: { display: "none" } });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// ------------------------------------------------------------------ pré-visualização

function previewInto(box, folder, name, filesSet, { big = false } = {}) {
    audio.stop();
    box.replaceChildren();
    if (!name) {
        box.appendChild(el("div", { class: "tlHint", text: t("No file selected") }));
        return;
    }
    const ext = extOf(name);
    if (ext === "png") {
        const img = el("img", { class: big ? "tlPreviewImgBig" : "tlPreviewImg", alt: name, src: fileUrl(folder, name) });
        const info = el("div", { class: "tlPreviewInfo", text: name });
        img.addEventListener("load", () => { info.textContent = `${name} — ${img.naturalWidth}×${img.naturalHeight}`; });
        img.addEventListener("error", () => { info.textContent = `${name} — ${t("could not be loaded")}`; });
        box.append(el("div", { class: "tlPreviewCanvas" }, img), info);
    } else if (ext === "ogg" || ext === "m4a") {
        const type = folder.split("/")[1];
        const st = { name: baseOf(name), volume: 90, pitch: 100, pan: 0 };
        box.append(
            el("div", { class: "tlPreviewAudio" },
                el("img", { src: "img/toolbar/tools-soundtest.png", alt: "", class: "tlBigIcon" }),
                el("div", { class: "tlPreviewInfo", text: name }),
                el("div", { class: "tlRow" },
                    button("▶ " + t("Play", "Layout_AudioSelector"), () => audio.play(type, st, filesSet)),
                    button("■ " + t("Stop", "Layout_AudioSelector"), () => audio.stop(type))))
        );
    } else if (ext === "webm" || ext === "mp4") {
        const video = el("video", { class: big ? "tlPreviewImgBig" : "tlPreviewImg", src: fileUrl(folder, name), controls: true, preload: "metadata" });
        const info = el("div", { class: "tlPreviewInfo", text: name });
        video.addEventListener("loadedmetadata", () => { info.textContent = `${name} — ${video.videoWidth}×${video.videoHeight}, ${video.duration.toFixed(1)} s`; });
        video.addEventListener("error", () => { info.textContent = `${name} — ${t("could not be loaded")}`; });
        box.append(el("div", { class: "tlPreviewCanvas" }, video), info);
    } else {
        box.append(el("div", { class: "tlPreviewAudio" },
            el("div", { class: "tlEffName", text: "✦ " + name }),
            el("div", { class: "tlHint", text: t("Effekseer effect (.efkefc). Preview it in the Animations tab of the Database.") })));
    }
}

async function previewDialog(folder, name, filesSet) {
    await modal(api, {
        title: t("Resource Preview", "Dialog_ResourcePreview") + " — " + name, width: "960px", height: "560px", cls: "tlPreviewDlg",
        build: b => { const box = el("div", { class: "tlPreviewBox big" }); b.appendChild(box); previewInto(box, folder, name, filesSet, { big: true }); },
        buttons: [{ label: t("Close", "BasicConstants"), primary: true, value: true }],
        onClose: () => audio.stop()
    });
    audio.stop();
}

// ------------------------------------------------------------------ diálogo

const state = { folder: "img/characters", selected: new Set(), last: null, multi: false };

export async function openResourceManager() {
    let files = [];
    let filesSet = new Set();
    const folderList = el("div", { class: "tlList tlFolders" });
    const fileList = el("div", { class: "tlList tlFiles" });
    const preview = el("div", { class: "tlPreviewBox" });
    const countLbl = el("span", { class: "tlCount" });
    const multiBtn = button("☑ " + t("Multiple Selection"), () => {
        state.multi = !state.multi;
        multiBtn.classList.toggle("on", state.multi);
        if (!state.multi && state.selected.size > 1) {
            state.selected = new Set(state.last ? [state.last] : []);
        }
        renderFiles();
    }, "toggle");
    const btns = {};

    const renderFolders = () => {
        folderList.replaceChildren(...FOLDERS.map(f => {
            const [top, sub] = f.includes("/") ? f.split("/") : ["", f];
            const row = el("div", { class: "tlItem tlFolder" + (f === state.folder ? " selected" : "") },
                el("span", { class: "tlFolderTop", text: top ? top + "/" : "" }), sub);
            row.addEventListener("click", () => selectFolder(f));
            return row;
        }));
    };
    const renderFiles = () => {
        countLbl.textContent = t("%1 file(s)", null, files.length) + (state.selected.size > 1 ? " — " + t("%1 selected", null, state.selected.size) : "");
        if (!files.length) {
            fileList.replaceChildren(el("div", { class: "tlHint", text: t("(empty folder)") }));
        } else {
            fileList.replaceChildren(...files.map(n => {
                const sel = state.selected.has(n);
                const row = el("div", { class: "tlItem" + (sel ? " selected" : "") },
                    state.multi ? el("span", { class: "tlCheck", text: sel ? "☑" : "☐" }) : null, n);
                row.addEventListener("click", ev => {
                    if (state.multi || ev.ctrlKey || ev.metaKey) {
                        sel ? state.selected.delete(n) : state.selected.add(n);
                    } else if (ev.shiftKey && state.last) {
                        const a = files.indexOf(state.last), b2 = files.indexOf(n);
                        state.selected = new Set(files.slice(Math.min(a, b2), Math.max(a, b2) + 1));
                    } else {
                        state.selected = new Set([n]);
                    }
                    state.last = n;
                    renderFiles();
                    previewInto(preview, state.folder, state.selected.has(n) ? n : null, filesSet);
                });
                row.addEventListener("dblclick", () => previewDialog(state.folder, n, filesSet));
                return row;
            }));
        }
        const any = state.selected.size > 0;
        btns.exp.disabled = !any;
        btns.del.disabled = !any;
        btns.prev.disabled = state.selected.size !== 1;
    };
    const selectFolder = async (f, keepSel = false) => {
        audio.stop();
        state.folder = f;
        if (!keepSel) { state.selected.clear(); state.last = null; }
        renderFolders();
        fileList.replaceChildren(el("div", { class: "tlHint", text: t("Loading…") }));
        files = await listFolder(f);
        filesSet = new Set(files);
        for (const s of [...state.selected]) { if (!filesSet.has(s)) { state.selected.delete(s); } }
        renderFiles();
        previewInto(preview, f, state.selected.size === 1 ? [...state.selected][0] : null, filesSet);
    };

    btns.imp = button(t("Import", "Dialog_ResourceManager") + "…", async () => {
        const names = await importFiles(state.folder);
        if (names.length) { state.selected = new Set(names); state.last = names[0]; }
        await selectFolder(state.folder, true);
    });
    btns.exp = button(t("Export", "Dialog_ResourceManager") + "…", async () => {
        for (const n of state.selected) {
            try { await exportFile(state.folder, n); } catch (e) { await alertBox(api, t("Export", "Dialog_ResourceManager"), `${n}: ${e.message}`, "warning"); }
        }
    });
    btns.del = button(t("Delete", "Dialog_ResourceManager"), async () => {
        const list = [...state.selected];
        if (!list.length) { return; }
        if (!(await confirmBox(api, t("Delete", "Dialog_ResourceManager"),
            t("Delete %1 file(s) from %2? This cannot be undone.", null, list.length, state.folder) + `\n\n${list.slice(0, 10).join("\n")}${list.length > 10 ? "\n…" : ""}`))) {
            return;
        }
        audio.stop();
        const fail = [];
        for (const n of list) {
            if (!(await api.project.delete(`${state.folder}/${n}`))) { fail.push(n); }
        }
        api.emit("resources:changed", { folder: state.folder });
        if (fail.length) { await alertBox(api, t("Delete", "Dialog_ResourceManager"), t("Could not delete:") + "\n" + fail.join("\n"), "warning"); }
        await selectFolder(state.folder);
    });
    btns.dlc = button(t("DLC", "Dialog_ResourceManager") + "…", async () => {
        await importFromFolder(state.folder);
        await selectFolder(state.folder, true);
    });
    btns.prev = button(t("Preview", "Constants") + "…", () => {
        const n = [...state.selected][0];
        if (n) { previewDialog(state.folder, n, filesSet); }
    });
    btns.std = button(t("Import Default Resources") + "…", async () => {
        await importDefaultResources();
        await selectFolder(state.folder, true);
    });
    btns.imp.title = t("Import files into the selected folder.", "Dialog_ResourceManager");
    btns.exp.title = t("Export the selected file.", "Dialog_ResourceManager");
    btns.del.title = t("Delete the selected file.", "Dialog_ResourceManager");
    btns.prev.title = t("Preview the selected file.", "Dialog_ResourceManager");
    btns.dlc.title = t("Imports files for this folder from a chosen DLC folder.");
    btns.std.title = t("Copies img/, audio/ and effects/ from a folder (e.g. RPG Maker MZ's newdata or a sample project).");

    const p = modal(api, {
        title: t("Resource Manager", "Dialog_ResourceManager"), width: "1040px", height: "580px", cls: "tlResDlg",
        build: b => {
            b.classList.add("tlResBody");
            b.append(
                el("div", { class: "tlCol tlColFolders" }, el("div", { class: "tlColHead", text: t("Folders") }), folderList),
                el("div", { class: "tlCol tlColFiles" },
                    el("div", { class: "tlColHead" }, t("Files") + " ", countLbl), fileList,
                    el("div", { class: "tlRow" }, multiBtn)),
                el("div", { class: "tlCol tlColPreview" },
                    el("div", { class: "tlColHead", text: t("Preview", "Constants") }), preview,
                    el("div", { class: "tlBtnGrid" }, btns.imp, btns.exp, btns.del, btns.dlc, btns.prev, btns.std)));
        },
        buttons: [{ label: t("OK", "BasicConstants"), primary: true, value: true }],
        onClose: () => audio.stop()
    });
    renderFolders();
    await selectFolder(state.folder, true);
    await p;
    audio.stop();
}

// Seletor genérico para outros módulos: devolve o nome SEM extensão (convenção do MZ) ou null.
// Permite importar na hora. opts: {current, title, none}
export async function pickResource(folder, opts = {}) {
    let files = await listFolder(folder);
    let names = [...new Set(files.map(baseOf))];
    let sel = opts.current ?? null;
    const list = el("div", { class: "tlList tlFiles" });
    const preview = el("div", { class: "tlPreviewBox" });
    const render = () => {
        const rows = [];
        if (opts.none !== false) { rows.push(""); }
        rows.push(...names);
        list.replaceChildren(...rows.map(n => {
            const row = el("div", { class: "tlItem" + (n === (sel ?? "") ? " selected" : "") }, n || "(" + t("None", "Constants") + ")");
            row.addEventListener("click", () => {
                sel = n;
                render();
                const full = files.find(f => baseOf(f) === n);
                previewInto(preview, folder, full || null, new Set(files));
            });
            return row;
        }));
    };
    const ok = await modal(api, {
        title: opts.title || (folder.startsWith("audio/") ? t("Select an Audio", "Dialog_AudioSelector") : t("Select an Image", "Dialog_ImageSelector")) + " — " + folder, width: "860px", height: "540px", cls: "tlPickDlg",
        build: b => {
            b.classList.add("tlPickBody");
            b.append(
                el("div", { class: "tlCol tlColFiles" }, list,
                    el("div", { class: "tlRow" }, button(t("Import", "Dialog_ResourceManager") + "…", async () => {
                        const imported = await importFiles(folder);
                        files = await listFolder(folder);
                        names = [...new Set(files.map(baseOf))];
                        if (imported.length) { sel = baseOf(imported[0]); }
                        render();
                    }))),
                el("div", { class: "tlCol tlColPreview" }, preview));
            render();
            const full = files.find(f => baseOf(f) === sel);
            previewInto(preview, folder, full || null, new Set(files));
        },
        onClose: () => audio.stop()
    });
    audio.stop();
    return ok ? (sel ?? "") : null;
}
