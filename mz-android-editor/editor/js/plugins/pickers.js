// Seletores usados pelos editores de parâmetro: banco de dados, switch/variável, arquivo,
// cor do texto (Window.png) e ícone (IconSet.png). Todos devolvem Promise<string|null>.

import { DATABASE_TYPES } from "./parser.js";
import { el, promptDialog, touchList, pad } from "./ui.js";
import { t } from "../i18n.js";

const PICK_W = "760px";
const PICK_H = "560px";

function descBox(def) {
    return def && def.desc ? el("div", { class: "pgDesc", text: def.desc }) : null;
}

function valueRow(value, onInput) {
    const input = el("input", { type: "text", class: "pgInput", value });
    input.addEventListener("input", () => onInput && onInput(input.value));
    const row = el("div", { class: "pgValueRow" }, el("label", { text: t("Text", "Dialog_PluginParameter") + ":" }), input);
    return { row, input };
}

async function loadNames(api, type) {
    if (type === "switch" || type === "variable") {
        const sys = await api.project.readJson("data/System.json");
        const names = (type === "switch" ? sys.switches : sys.variables) || [];
        return names.map((n, i) => (i === 0 ? null : { id: i, name: n || "" }));
    }
    const data = await api.project.readJson(DATABASE_TYPES[type]);
    return (data || []).map((d, i) => (i === 0 || !d ? null : { id: i, name: d.name || "" }));
}

// Lista de itens do banco de dados / switches / variáveis. "(Nenhum)" grava "0".
export async function pickDatabase(api, def, value, title) {
    let entries = [];
    try {
        entries = (await loadNames(api, def.kind)).filter(Boolean);
    } catch (e) {
        entries = [];
    }
    const items = [{ label: "(" + t("None", "Constants") + ")", value: "0" },
        ...entries.map(e => ({ label: `${pad(e.id)} ${e.name}`, value: String(e.id) }))];
    let current = String(value ?? "");
    let text;
    return promptDialog(api, {
        title, width: PICK_W, height: PICK_H,
        build(body, ctx) {
            const sel = items.findIndex(i => i.value === current || (current === "" && i.value === "0"));
            const list = touchList({
                items, selected: sel,
                onSelect: it => { current = it.value; text.input.value = it.value; },
                onActivate: it => ctx.accept(it.value)
            });
            text = valueRow(current, v => { current = v; });
            body.classList.add("pgCol");
            body.append(descBox(def) || "", list.root, text.row);
            requestAnimationFrame(() => list.select(sel, true));
        },
        onOk: () => current
    });
}

// --- Arquivos --------------------------------------------------------------------------

const IMAGE_EXT = /\.(png|jpe?g|webp|gif|bmp)(_|\.rpgmvp)?$/i;
const AUDIO_EXT = /\.(ogg|m4a|mp3|wav)(_|\.rpgmvo)?$/i;
const MEDIA_EXT = /\.(png|jpe?g|webp|gif|bmp|ogg|m4a|mp3|wav|webm|mp4|efkefc|json|js|txt|csv)(_|\.rpgmv[po])?$/i;

function stripExt(name) {
    return name.replace(/\.(png_|ogg_|m4a_|rpgmvp|rpgmvo)$/i, "").replace(/\.[^./]+$/, "");
}

// Seletor de arquivo a partir de @dir (padrão "img"). Valor = caminho relativo a @dir, sem
// extensão; "(Nenhum)" grava "". Subpastas podem ser abertas.
export async function pickFile(api, def, value, title) {
    const baseDir = (def.dir || "img").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
    let current = String(value ?? "");
    let sub = current.includes("/") ? current.slice(0, current.lastIndexOf("/")) : "";
    let list, text, crumb, preview;
    let audio = null;

    const stopAudio = () => {
        if (audio) {
            audio.pause();
            audio = null;
        }
    };

    async function fileExtOf(dir, base) {
        const entries = await api.project.list(dir);
        const hit = entries.find(e => !e.dir && stripExt(e.name) === base);
        return hit ? hit.name : null;
    }

    async function showPreview(rel) {
        preview.textContent = "";
        stopAudio();
        if (!rel) {
            return;
        }
        const dir = baseDir + (rel.includes("/") ? "/" + rel.slice(0, rel.lastIndexOf("/")) : "");
        const base = rel.includes("/") ? rel.slice(rel.lastIndexOf("/") + 1) : rel;
        const file = await fileExtOf(dir, base);
        if (!file) {
            return;
        }
        const url = "/project/" + dir.split("/").map(encodeURIComponent).join("/") + "/" + encodeURIComponent(file);
        if (IMAGE_EXT.test(file) && !/(_|rpgmvp)$/i.test(file)) {
            preview.appendChild(el("img", { src: url, alt: "" }));
        } else if (AUDIO_EXT.test(file) && !/(_|rpgmvo)$/i.test(file)) {
            const play = el("button", { class: "pgBtn", text: "▶ " + t("Play", "Layout_AudioSelector") });
            const stop = el("button", { class: "pgBtn", text: "■ " + t("Stop", "Layout_AudioSelector") });
            play.addEventListener("click", () => {
                stopAudio();
                audio = new Audio(url);
                audio.play().catch(() => {});
            });
            stop.addEventListener("click", stopAudio);
            preview.append(el("div", { class: "pgAudio" }, play, stop));
        }
        preview.appendChild(el("div", { class: "pgPreviewName", text: file }));
    }

    async function loadDir(selectValue) {
        const dir = baseDir + (sub ? "/" + sub : "");
        crumb.textContent = dir + "/";
        let entries = [];
        try {
            entries = await api.project.list(dir);
        } catch {
            entries = [];
        }
        const dirs = entries.filter(e => e.dir).map(e => e.name).sort();
        const seen = new Set();
        const files = [];
        for (const e of entries) {
            if (e.dir || !MEDIA_EXT.test(e.name)) {
                continue;
            }
            const b = stripExt(e.name);
            if (!seen.has(b)) {
                seen.add(b);
                files.push(b);
            }
        }
        files.sort((a, b) => a.localeCompare(b));
        const items = [];
        if (!sub) {
            items.push({ label: "(" + t("None", "Constants") + ")", value: "", kind: "none" });
        } else {
            items.push({ label: "📁 ..", value: null, kind: "up", className: "pgDirRow" });
        }
        for (const d of dirs) {
            items.push({ label: "📁 " + d, value: null, kind: "dir", dir: d, className: "pgDirRow" });
        }
        for (const f of files) {
            items.push({ label: f, value: (sub ? sub + "/" : "") + f, kind: "file" });
        }
        const sel = items.findIndex(i => i.kind !== "up" && i.kind !== "dir" && i.value === selectValue);
        list.setItems(items, sel);
        requestAnimationFrame(() => list.select(sel, true));
    }

    const enter = it => {
        if (it.kind === "up") {
            sub = sub.includes("/") ? sub.slice(0, sub.lastIndexOf("/")) : "";
            loadDir(current);
            return true;
        }
        if (it.kind === "dir") {
            sub = (sub ? sub + "/" : "") + it.dir;
            loadDir(current);
            return true;
        }
        return false;
    };

    const result = await promptDialog(api, {
        title, width: "980px", height: PICK_H,
        build(body, ctx) {
            crumb = el("div", { class: "pgCrumb" });
            preview = el("div", { class: "pgPreview" });
            list = touchList({
                onSelect: it => {
                    if (enter(it)) {
                        return;
                    }
                    current = it.value;
                    text.input.value = current;
                    showPreview(current);
                },
                onActivate: it => {
                    if (!enter(it)) {
                        ctx.accept(it.value);
                    }
                }
            });
            text = valueRow(current, v => { current = v; });
            body.classList.add("pgCol");
            body.append(descBox(def) || "", crumb,
                el("div", { class: "pgSplit" }, list.root, preview), text.row);
            loadDir(current);
            showPreview(current);
        },
        onOk: () => current
    });
    stopAudio();
    return result;
}

// --- Cor do texto (índice 0–31 da paleta de img/system/Window.png) ---------------------

function loadImage(src) {
    return new Promise((res, rej) => {
        const img = new Image();
        img.onload = () => res(img);
        img.onerror = rej;
        img.src = src;
    });
}

export async function pickColor(api, def, value, title) {
    let colors = [];
    try {
        const img = await loadImage("/project/img/system/Window.png");
        const c = document.createElement("canvas");
        c.width = img.width;
        c.height = img.height;
        const g = c.getContext("2d");
        g.drawImage(img, 0, 0);
        for (let n = 0; n < 32; n++) {
            const px = 96 + (n % 8) * 12 + 6;
            const py = 144 + Math.floor(n / 8) * 12 + 6;
            const d = g.getImageData(px, py, 1, 1).data;
            colors.push(`rgb(${d[0]},${d[1]},${d[2]})`);
        }
    } catch {
        colors = Array.from({ length: 32 }, () => "#888");
    }
    let current = String(value ?? "0");
    let text;
    return promptDialog(api, {
        title, width: "620px", height: "auto",
        build(body, ctx) {
            const grid = el("div", { class: "pgSwatches" });
            const cells = colors.map((col, n) => {
                const cell = el("button", { class: "pgSwatch", style: { background: col }, title: String(n) },
                    el("span", { text: String(n) }));
                cell.addEventListener("click", () => {
                    if (current === String(n)) {
                        ctx.accept(current);
                        return;
                    }
                    current = String(n);
                    text.input.value = current;
                    mark();
                });
                grid.appendChild(cell);
                return cell;
            });
            const mark = () => cells.forEach((c, n) => c.classList.toggle("selected", String(n) === current));
            text = valueRow(current, v => { current = v.trim(); mark(); });
            body.classList.add("pgCol");
            body.append(descBox(def) || "", grid, text.row);
            mark();
        },
        onOk: () => current
    });
}

// --- Ícone (img/system/IconSet.png, 16 por linha, 32×32) -------------------------------

export async function pickIcon(api, def, value, title) {
    const SCALE = 1.25;
    let current = String(value ?? "0");
    let text;
    let img = null;
    try {
        img = await loadImage("/project/img/system/IconSet.png");
    } catch {
        img = null;
    }
    return promptDialog(api, {
        title, width: "760px", height: PICK_H,
        build(body, ctx) {
            const wrap = el("div", { class: "pgIconSheet" });
            const mark = el("div", { class: "pgIconMark" });
            const place = () => {
                const n = parseInt(current, 10) || 0;
                mark.style.left = (n % 16) * 32 * SCALE + "px";
                mark.style.top = Math.floor(n / 16) * 32 * SCALE + "px";
                mark.style.width = mark.style.height = 32 * SCALE + "px";
            };
            if (img) {
                const sheet = el("img", { src: img.src, alt: "", draggable: "false" });
                sheet.style.width = img.width * SCALE + "px";
                sheet.style.height = img.height * SCALE + "px";
                wrap.style.width = img.width * SCALE + "px";
                sheet.addEventListener("click", ev => {
                    const r = sheet.getBoundingClientRect();
                    const cx = Math.floor((ev.clientX - r.left) / (32 * SCALE));
                    const cy = Math.floor((ev.clientY - r.top) / (32 * SCALE));
                    const n = String(cy * 16 + cx);
                    if (n === current) {
                        ctx.accept(current);
                        return;
                    }
                    current = n;
                    text.input.value = n;
                    place();
                });
                wrap.append(sheet, mark);
            } else {
                wrap.textContent = t("%1 not found.", null, "img/system/IconSet.png");
            }
            text = valueRow(current, v => { current = v.trim(); place(); });
            body.classList.add("pgCol");
            body.append(descBox(def) || "", el("div", { class: "pgIconScroll" }, wrap), text.row);
            place();
            requestAnimationFrame(() => mark.scrollIntoView({ block: "center" }));
        },
        onOk: () => current
    });
}

// --- Animação (ParameterEditorAnimation): lista + prévia Effekseer, como no MZ -----------

export async function pickAnimation(api, def, value, title) {
    const { previewGroup, stopPreview } = await import("../database/animpreview.js");
    let db;
    try {
        const [Animations, System, Enemies] = await Promise.all(["Animations", "System", "Enemies"]
            .map(f => api.project.readJson(`data/${f}.json`, { fresh: true })));
        db = { Animations, System, Enemies };
    } catch {
        return pickDatabase(api, { ...def, kind: "animation" }, value, title);
    }
    const items = [{ label: "(" + t("None", "Constants") + ")", value: "0" },
        ...db.Animations.map((a, i) => (i && a ? { label: `${pad(i)} ${a.name || ""}`, value: String(i) } : null)).filter(Boolean)];
    let current = String(value ?? "");
    let text;
    const result = await promptDialog(api, {
        title, width: "1040px", height: PICK_H,
        build(body, ctx) {
            const right = el("div", { class: "pgAnimPreview" });
            const show = id => {
                stopPreview();
                right.textContent = "";
                const anim = db.Animations[Number(id)];
                if (anim) {
                    right.append(...previewGroup(db, anim, null));
                }
            };
            const sel = items.findIndex(i => i.value === current || (current === "" && i.value === "0"));
            const list = touchList({
                items, selected: sel,
                onSelect: it => { current = it.value; text.input.value = it.value; show(it.value); },
                onActivate: it => ctx.accept(it.value)
            });
            text = valueRow(current, v => { current = v; });
            body.classList.add("pgCol");
            body.append(descBox(def) || "", el("div", { class: "pgSplit" }, list.root, right), text.row);
            requestAnimationFrame(() => list.select(sel, true));
            show(current);
        },
        onOk: () => current
    });
    stopPreview();
    return result;
}
