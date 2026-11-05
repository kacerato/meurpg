// Resource Manager (Ferramentas → Gerenciador de Recursos), fiel ao RPG Maker MZ:
// lista de pastas à esquerda, lista de arquivos, pré-visualização e os botões
// Import / Export / Delete / DLC / Preview. Extra: "Importar recursos padrão".
import { el, button, modal, confirmBox, alertBox, progressDialog } from "./ui.js";
import * as audio from "./audio.js";

// Pastas na ordem do Resource Manager do MZ.
export const FOLDERS = [
    "audio/bgm", "audio/bgs", "audio/me", "audio/se",
    "effects",
    "img/animations", "img/battlebacks1", "img/battlebacks2", "img/characters",
    "img/enemies", "img/faces", "img/parallaxes", "img/pictures",
    "img/sv_actors", "img/sv_enemies", "img/system", "img/tilesets",
    "img/titles1", "img/titles2"
];

export function extsFor(folder) {
    if (folder.startsWith("audio/")) { return ["ogg", "m4a"]; }
    if (folder === "effects") { return ["efkefc"]; }
    return ["png"];
}
function acceptFor(folder) {
    if (folder.startsWith("audio/")) { return ".ogg,.m4a,audio/ogg,audio/mp4"; }
    if (folder === "effects") { return ".efkefc"; }
    return ".png,image/png";
}
const MIME = { png: "image/png", ogg: "audio/ogg", m4a: "audio/mp4", efkefc: "application/octet-stream" };
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
                await api.project.writeBinary(it.rel, it.file, MIME[extOf(it.rel)] || it.file.type || "application/octet-stream");
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
        await alertBox(api, "Importar", "Falha ao importar:\n" + failed.slice(0, 20).join("\n"), "warning");
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
    if (dup.length && !(await confirmBox(api, "Importar",
        `${dup.length} arquivo(s) já existem em ${folder} e serão substituídos:\n${dup.slice(0, 8).map(f => f.name).join(", ")}${dup.length > 8 ? "…" : ""}`))) {
        return [];
    }
    await writeAll(ok.map(f => ({ rel: `${folder}/${f.name}`, file: f })), "Importando…");
    if (skipped) {
        await alertBox(api, "Importar", `${skipped} arquivo(s) ignorado(s): tipo inválido para ${folder} (${exts.join(", ")}).`, "warning");
    }
    api.status(`${ok.length} arquivo(s) importado(s) em ${folder}`);
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
            if (segs[i] === "effects") { rel = segs.slice(i).join("/"); break; }
        }
        if (!rel) { continue; }
        const folder = rel.split("/")[0] === "effects" ? "effects" : rel.split("/").slice(0, 2).join("/");
        if (onlyFolder && folder !== onlyFolder) { continue; }
        // effects/ inclui texturas (effects/Texture/*.png) usadas pelos .efkefc
        if (folder !== "effects" && !extsFor(folder).includes(extOf(f.name))) { continue; }
        items.push({ rel, file: f, folder });
    }
    if (!items.length) {
        await alertBox(api, "Importar", onlyFolder
            ? `Nenhum arquivo de ${onlyFolder} encontrado na pasta escolhida.`
            : "Nenhum recurso (img/, audio/, effects/) encontrado na pasta escolhida.", "warning");
        return 0;
    }
    // não sobrescreve o que já existe no projeto
    const existingBy = new Map();
    for (const folder of new Set(items.map(i => i.folder))) {
        const ents = await api.project.list(folder).catch(() => []);
        existingBy.set(folder, new Set((ents || []).map(e => e.name || e)));
    }
    const fresh = items.filter(i => !(i.rel.split("/").length === i.folder.split("/").length + 1 && existingBy.get(i.folder).has(i.file.name)));
    const keep = items.length - fresh.length;
    const total = fresh.reduce((s, i) => s + i.file.size, 0);
    if (!(await confirmBox(api, "Importar recursos",
        `Copiar ${fresh.length} arquivo(s) (${(total / 1048576).toFixed(1)} MB) para o projeto?` +
        (keep ? `\n${keep} já existem e serão mantidos.` : "")))) {
        return 0;
    }
    const n = await writeAll(fresh.map(({ rel, file }) => ({ rel, file })), "Importando recursos…");
    api.status(`${n} recurso(s) importado(s)`);
    return n;
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
        box.appendChild(el("div", { class: "tlHint", text: "Nenhum arquivo selecionado" }));
        return;
    }
    const ext = extOf(name);
    if (ext === "png") {
        const img = el("img", { class: big ? "tlPreviewImgBig" : "tlPreviewImg", alt: name, src: fileUrl(folder, name) });
        const info = el("div", { class: "tlPreviewInfo", text: name });
        img.addEventListener("load", () => { info.textContent = `${name} — ${img.naturalWidth}×${img.naturalHeight}`; });
        img.addEventListener("error", () => { info.textContent = `${name} — não foi possível carregar`; });
        box.append(el("div", { class: "tlPreviewCanvas" }, img), info);
    } else if (ext === "ogg" || ext === "m4a") {
        const type = folder.split("/")[1];
        const st = { name: baseOf(name), volume: 90, pitch: 100, pan: 0 };
        box.append(
            el("div", { class: "tlPreviewAudio" },
                el("img", { src: "img/toolbar/tools-soundtest.png", alt: "", class: "tlBigIcon" }),
                el("div", { class: "tlPreviewInfo", text: name }),
                el("div", { class: "tlRow" },
                    button("▶ Tocar", () => audio.play(type, st, filesSet)),
                    button("■ Parar", () => audio.stop(type))))
        );
    } else {
        box.append(el("div", { class: "tlPreviewAudio" },
            el("div", { class: "tlEffName", text: "✦ " + name }),
            el("div", { class: "tlHint", text: "Efeito Effekseer (.efkefc). A pré-visualização é feita na aba Animações do Banco de Dados." })));
    }
}

async function previewDialog(folder, name, filesSet) {
    await modal(api, {
        title: "Preview — " + name, width: "960px", height: "560px", cls: "tlPreviewDlg",
        build: b => { const box = el("div", { class: "tlPreviewBox big" }); b.appendChild(box); previewInto(box, folder, name, filesSet, { big: true }); },
        buttons: [{ label: "Fechar", primary: true, value: true }],
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
    const multiBtn = button("☑ Seleção múltipla", () => {
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
        countLbl.textContent = `${files.length} arquivo(s)` + (state.selected.size > 1 ? ` — ${state.selected.size} selecionado(s)` : "");
        if (!files.length) {
            fileList.replaceChildren(el("div", { class: "tlHint", text: "(pasta vazia)" }));
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
        fileList.replaceChildren(el("div", { class: "tlHint", text: "Carregando…" }));
        files = await listFolder(f);
        filesSet = new Set(files);
        for (const s of [...state.selected]) { if (!filesSet.has(s)) { state.selected.delete(s); } }
        renderFiles();
        previewInto(preview, f, state.selected.size === 1 ? [...state.selected][0] : null, filesSet);
    };

    btns.imp = button("Importar…", async () => {
        const names = await importFiles(state.folder);
        if (names.length) { state.selected = new Set(names); state.last = names[0]; }
        await selectFolder(state.folder, true);
    });
    btns.exp = button("Exportar…", async () => {
        for (const n of state.selected) {
            try { await exportFile(state.folder, n); } catch (e) { await alertBox(api, "Exportar", `${n}: ${e.message}`, "warning"); }
        }
    });
    btns.del = button("Excluir", async () => {
        const list = [...state.selected];
        if (!list.length) { return; }
        if (!(await confirmBox(api, "Excluir",
            `Excluir ${list.length} arquivo(s) de ${state.folder}? Esta ação não pode ser desfeita.\n\n${list.slice(0, 10).join("\n")}${list.length > 10 ? "\n…" : ""}`))) {
            return;
        }
        audio.stop();
        const fail = [];
        for (const n of list) {
            if (!(await api.project.delete(`${state.folder}/${n}`))) { fail.push(n); }
        }
        api.emit("resources:changed", { folder: state.folder });
        if (fail.length) { await alertBox(api, "Excluir", "Não foi possível excluir:\n" + fail.join("\n"), "warning"); }
        await selectFolder(state.folder);
    });
    btns.dlc = button("DLC…", async () => {
        await importFromFolder(state.folder);
        await selectFolder(state.folder, true);
    });
    btns.prev = button("Preview…", () => {
        const n = [...state.selected][0];
        if (n) { previewDialog(state.folder, n, filesSet); }
    });
    btns.std = button("Importar recursos padrão…", async () => {
        await importFromFolder(null);
        await selectFolder(state.folder, true);
    });
    btns.dlc.title = "Importa arquivos desta pasta a partir de uma pasta de DLC escolhida";
    btns.std.title = "Copia img/, audio/ e effects/ de uma pasta (ex.: newdata do RPG Maker MZ ou um projeto de exemplo)";

    const p = modal(api, {
        title: "Resource Manager", width: "1040px", height: "580px", cls: "tlResDlg",
        build: b => {
            b.classList.add("tlResBody");
            b.append(
                el("div", { class: "tlCol tlColFolders" }, el("div", { class: "tlColHead", text: "Pastas" }), folderList),
                el("div", { class: "tlCol tlColFiles" },
                    el("div", { class: "tlColHead" }, "Arquivos ", countLbl), fileList,
                    el("div", { class: "tlRow" }, multiBtn)),
                el("div", { class: "tlCol tlColPreview" },
                    el("div", { class: "tlColHead", text: "Pré-visualização" }), preview,
                    el("div", { class: "tlBtnGrid" }, btns.imp, btns.exp, btns.del, btns.dlc, btns.prev, btns.std)));
        },
        buttons: [{ label: "OK", primary: true, value: true }],
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
            const row = el("div", { class: "tlItem" + (n === (sel ?? "") ? " selected" : "") }, n || "(Nenhum)");
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
        title: opts.title || "Selecionar — " + folder, width: "860px", height: "540px", cls: "tlPickDlg",
        build: b => {
            b.classList.add("tlPickBody");
            b.append(
                el("div", { class: "tlCol tlColFiles" }, list,
                    el("div", { class: "tlRow" }, button("Importar…", async () => {
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
