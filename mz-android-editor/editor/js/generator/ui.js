// Pequenos diálogos reutilizados pelo gerador (nome de arquivo, lista de arquivos, mensagem, confirmação).
// Todos usam api.openDialog para manter o visual do editor e funcionar com o botão voltar.

export function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) { e.className = cls; }
    if (text != null) { e.textContent = text; }
    return e;
}

export function message(api, title, text) {
    return new Promise(resolve => {
        const d = api.openDialog({ title, width: "min(460px, 96vw)", height: "auto", buttons: [{ label: "OK", primary: true, onClick: () => resolve() }] });
        d.body.appendChild(el("div", "gen-msg", text));
        watchClose(d, () => resolve());
    });
}

export function confirmBox(api, title, text) {
    return new Promise(resolve => {
        const d = api.openDialog({
            title, width: "min(460px, 96vw)", height: "auto",
            buttons: [{ label: "Sim", primary: true, onClick: () => resolve(true) }, { label: "Não", onClick: () => resolve(false) }]
        });
        d.body.appendChild(el("div", "gen-msg", text));
        watchClose(d, () => resolve(false));
    });
}

// Resolve com o texto digitado ou null.
export function promptText(api, { title, label, value = "", hint = "" }) {
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
                { label: "OK", primary: true, onClick: () => { const v = input.value.trim(); if (!v) { return false; } finish(v); } },
                { label: "Cancelar", onClick: () => finish(null) }
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
export function pickFile(api, { title, dirs, filter, hint = "", thumbs = false }) {
    return new Promise(resolve => {
        let done = false, selected = null;
        const finish = v => { if (!done) { done = true; resolve(v); } };
        const d = api.openDialog({
            title, width: "min(560px, 96vw)", height: "auto",
            buttons: [
                { label: "OK", primary: true, onClick: () => { if (!selected) { return false; } finish(selected); } },
                { label: "Cancelar", onClick: () => finish(null) }
            ]
        });
        const form = el("div", "gen-form");
        if (hint) { form.appendChild(el("div", "gen-hint", hint)); }
        const list = el("div", "gen-fileList");
        list.appendChild(el("div", "gen-file", "Carregando…"));
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
                list.appendChild(el("div", "gen-file", "(nenhum arquivo)"));
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
    await message(api, "Gerador de Personagem", "Abra um projeto primeiro para gravar ou carregar arquivos.");
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
