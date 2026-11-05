// Pequenos diálogos reutilizados pelo gerador (nome de arquivo, lista de arquivos, mensagem, confirmação).
// Todos usam api.openDialog para manter o visual do editor e funcionar com o botão voltar.
import { t } from "../i18n.js";

export function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) { e.className = cls; }
    if (text != null) { e.textContent = text; }
    return e;
}

export function message(api, title, text) {
    return new Promise(resolve => {
        const d = api.openDialog({ title, width: "min(460px, 96vw)", height: "auto", buttons: [{ label: t("OK", "BasicConstants"), primary: true, onClick: () => resolve() }] });
        d.body.appendChild(el("div", "gen-msg", text));
        watchClose(d, () => resolve());
    });
}

export function confirmBox(api, title, text) {
    return new Promise(resolve => {
        const d = api.openDialog({
            title, width: "min(460px, 96vw)", height: "auto",
            buttons: [{ label: t("Yes", "BasicConstants"), primary: true, onClick: () => resolve(true) }, { label: t("No", "BasicConstants"), onClick: () => resolve(false) }]
        });
        d.body.appendChild(el("div", "gen-msg", text));
        watchClose(d, () => resolve(false));
    });
}

// Resolve com o texto digitado ou null. Com `outside` (rótulo), ganha um terceiro botão que
// resolve com { outside: true, value } — salvar fora da pasta do projeto (ver saveOutside).
export function promptText(api, { title, label, value = "", hint = "", outside = "" }) {
    return new Promise(resolve => {
        let done = false;
        const finish = v => { if (!done) { done = true; resolve(v); } };
        const input = document.createElement("input");
        input.type = "text";
        input.value = value;
        input.autocapitalize = "off";
        input.spellcheck = false;
        const d = api.openDialog({
            title, width: "min(520px, 96vw)", height: "auto",
            buttons: [
                { label: t("OK", "BasicConstants"), primary: true, onClick: () => { const v = input.value.trim(); if (!v) { return false; } finish(v); } },
                ...(outside ? [{ label: outside, onClick: () => { const v = input.value.trim(); if (!v) { return false; } finish({ outside: true, value: v }); } }] : []),
                { label: t("Cancel", "BasicConstants"), onClick: () => finish(null) }
            ]
        });
        const form = el("div", "gen-form");
        const lab = el("label");
        lab.append(el("span", "", label), input);
        form.appendChild(lab);
        if (hint) { form.appendChild(el("div", "gen-hint", hint)); }
        d.body.appendChild(form);
        input.addEventListener("keydown", e => {
            if (e.key === "Enter") { const v = input.value.trim(); if (v) { finish(v); d.close(); } }
        });
        setTimeout(() => { input.focus(); input.select(); }, 50);
        watchClose(d, () => finish(null));
    });
}

// Lista arquivos do projeto (pastas em `dirs`) e devolve o caminho escolhido ou null.
// Com `accept` (ex.: ".png"), ganha o botão "Outro local…" que devolve um File do aparelho/PC.
export function pickFile(api, { title, dirs, filter, hint = "", thumbs = false, accept = "" }) {
    return new Promise(resolve => {
        let done = false, selected = null;
        const finish = v => { if (!done) { done = true; resolve(v); } };
        const d = api.openDialog({
            title, width: "min(560px, 96vw)", height: "auto",
            buttons: [
                { label: t("OK", "BasicConstants"), primary: true, onClick: () => { if (!selected) { return false; } finish(selected); } },
                ...(accept ? [{
                    label: t("Other Location…"), onClick: () => {
                        chooseLocalFile(accept).then(f => { if (f) { finish(f); d.close(); } });
                        return false;
                    }
                }] : []),
                { label: t("Cancel", "BasicConstants"), onClick: () => finish(null) }
            ]
        });
        const form = el("div", "gen-form");
        if (hint) { form.appendChild(el("div", "gen-hint", hint)); }
        const list = el("div", "gen-fileList");
        list.appendChild(el("div", "gen-file", t("Loading…")));
        form.appendChild(list);
        d.body.appendChild(form);
        watchClose(d, () => finish(null));
        (async () => {
            const items = [];
            for (const dir of dirs) {
                try {
                    const res = await fetch("/api/list?dir=" + encodeURIComponent(dir));
                    if (!res.ok) { continue; }
                    for (const e of await res.json()) {
                        if (!e.dir && filter(e.name)) { items.push(dir ? dir + "/" + e.name : e.name); }
                    }
                } catch (e) { /* pasta inexistente */ }
            }
            items.sort((a, b) => a.localeCompare(b));
            list.innerHTML = "";
            if (!items.length) {
                list.appendChild(el("div", "gen-file", t("(no files)")));
                return;
            }
            for (const path of items) {
                const row = el("div", "gen-file");
                if (thumbs) {
                    const img = document.createElement("img");
                    img.loading = "lazy";
                    img.src = "/api/file?path=" + encodeURIComponent(path);
                    row.appendChild(img);
                }
                row.appendChild(el("span", "", path));
                row.addEventListener("click", () => {
                    selected = path;
                    for (const c of list.children) { c.classList.toggle("sel", c === row); }
                });
                row.addEventListener("dblclick", () => { selected = path; finish(path); d.close(); });
                list.appendChild(row);
            }
        })();
    });
}

// Abre o seletor de arquivos do sistema (PC; no Android, o file chooser do WebView).
export function chooseLocalFile(accept) {
    return new Promise(resolve => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = accept;
        input.style.display = "none";
        let settled = false;
        const done = f => { if (!settled) { settled = true; resolve(f); input.remove(); } };
        input.addEventListener("change", () => done(input.files[0] || null));
        input.addEventListener("cancel", () => done(null));
        document.body.appendChild(input);
        input.click();
    });
}

// Grava `blob` fora da pasta do projeto, como o diálogo "Salvar como" do MZ:
//  - PC (Chrome/Edge): showSaveFilePicker — o usuário escolhe pasta e nome;
//  - Android: grava em `projectPath` e abre o compartilhamento (Android.shareFile), de onde o
//    arquivo vai para Arquivos/Drive/outro app;
//  - senão: download pelo navegador.
// → "picker" | "share" | "download" | null (cancelado)
export async function saveOutside(blob, fileName, mime, projectPath) {
    if (typeof window.showSaveFilePicker === "function") {
        const ext = fileName.slice(fileName.lastIndexOf("."));
        let h;
        try {
            h = await window.showSaveFilePicker({ suggestedName: fileName, types: [{ description: ext, accept: { [mime]: [ext] } }] });
        } catch (e) {
            if (e && e.name === "AbortError") { return null; }
            h = null;
        }
        if (h) {
            const w = await h.createWritable();
            await w.write(blob);
            await w.close();
            return "picker";
        }
    }
    if (window.Android && typeof window.Android.shareFile === "function" && projectPath) {
        const res = await fetch("/api/file?path=" + encodeURIComponent(projectPath), { method: "PUT", headers: { "Content-Type": mime }, body: blob });
        if (!res.ok) { throw new Error(String(res.status)); }
        window.Android.shareFile(projectPath, mime);
        return "share";
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    return "download";
}

// Chama fn quando o diálogo some do DOM (Cancelar, X, botão voltar).
function watchClose(d, fn) {
    const obs = new MutationObserver(() => {
        if (!d.root.isConnected) { obs.disconnect(); fn(); }
    });
    obs.observe(document.body, { childList: true });
}

export async function hasProject(api) {
    try {
        const res = await fetch("/api/project");
        if (res.ok) { return true; }
    } catch (e) { /* sem servidor */ }
    await message(api, t("Character Generator", "Dialog_CharacterGenerator"), t("Open a project first to save or load files."));
    return false;
}

export async function fileExists(path) {
    try {
        const res = await fetch("/api/file?path=" + encodeURIComponent(path), { cache: "no-store" });
        return res.ok;
    } catch (e) {
        return false;
    }
}
