// Módulo "database": diálogo Banco de dados do RPG Maker MZ (16 abas).
// Contrato: SESSIONS.md. Liga o botão btnDatabase; grava data/*.json e emite db:changed.
import { el, btn, setApi, setChangedHook, modal, fld, num, confirmBox, alertBox, pad } from "./ui.js";
import { FILES, BLANK } from "./common.js";
import { TABS } from "./tabs.js";
import { stopAudio } from "./pickers.js";

const CSS_ID = "dbCss";
const ui = { tab: 0, sel: {} };   // aba e seleção lembradas entre aberturas
const clipboard = {};             // Copy/Paste da lista de dados, por arquivo

function injectCss() {
    if (document.getElementById(CSS_ID)) { return; }
    const link = el("link", { id: CSS_ID, rel: "stylesheet", href: new URL("../../css/database.css", import.meta.url).href });
    document.head.appendChild(link);
}

export async function register(api) {
    setApi(api);
    injectCss();
    api.bindToolbar("btnDatabase", () => openDatabase(api).catch(e => {
        console.error(e);
        api.status("Database: " + (e.message || e));
    }), "Database");
    api.database = { open: (tabId) => openDatabase(api, tabId) };
}

async function loadAll(api) {
    const db = {};
    await Promise.all(FILES.map(async f => {
        db[f] = structuredClone(await api.project.readJson(`data/${f}.json`, { fresh: true }));
    }));
    return db;
}

let opened = null;

export async function openDatabase(api, tabId) {
    if (opened) { return; }
    if (!api.project) { throw new Error("Nenhum projeto aberto"); }
    api.status("Carregando banco de dados…");
    const db = await loadAll(api);
    api.status("");
    const dirty = new Set();
    let current = null;                      // aba atual
    const ctx = {
        api, db, dirty,
        touch(file) { dirty.add(file || current.file); updateTitle(); },
        refreshList() { if (current && current.file && !current.page) { renderList(); } },
        refreshRow() { refreshRowLabel(); },
        rerender() { showTab(ui.tab); }
    };
    setChangedHook(() => ctx.touch());

    const tabBar = el("div", { class: "dbTabs main" });
    const content = el("div", { class: "dbContent" });
    let listEl = null, formEl = null, titleEl = null;

    const save = async () => {
        const files = [...dirty];
        for (const f of files) {
            await api.project.writeJson(`data/${f}.json`, structuredClone(db[f]));
            dirty.delete(f);
            api.emit("db:changed", { file: `data/${f}.json` });
        }
        updateTitle();
        api.status(files.length ? "Banco de dados gravado: " + files.join(", ") : "");
        return files;
    };

    const dlg = api.openDialog({
        title: "Database",
        width: "calc(100vw - 12px)", height: "calc(100vh - 12px)",
        buttons: [
            { label: "OK", primary: true, onClick: () => { save().then(close).catch(err => alertBox("Erro ao gravar: " + err.message)); return false; } },
            { label: "Cancel", onClick: () => { if (dirty.size) { confirmBox("Descartar as alterações não gravadas?", "Database").then(ok => ok && close()); return false; } close(); } },
            { label: "Apply", onClick: () => { save().catch(err => alertBox("Erro ao gravar: " + err.message)); return false; } }
        ]
    });
    opened = dlg;
    dlg.root.classList.add("dbRoot");
    dlg.body.classList.add("dbBody");
    dlg.body.append(tabBar, content);
    const titleBar = dlg.root.querySelector(".mzDialogTitle");
    const updateTitle = () => { titleBar.textContent = "Database" + (dirty.size ? " *" : ""); };

    function close() {
        stopAudio();
        window.removeEventListener("keydown", onKey);
        obs.disconnect();
        dlg.close();
        opened = null;
        setChangedHook(() => {});
    }
    // fechado por fora (botão voltar do Android) => libera
    const obs = new MutationObserver(() => { if (!dlg.root.isConnected) { opened = null; stopAudio(); window.removeEventListener("keydown", onKey); obs.disconnect(); } });
    obs.observe(document.body, { childList: true });

    const onKey = e => {
        if (!current || current.page || !dlg.root.isConnected) { return; }
        if (document.querySelector(".dbModalRoot")) { return; }
        if (e.key === "F4" || e.key === "F5") {
            e.preventDefault();
            const arr = db[current.file];
            const s = ui.sel[current.id] || 1;
            selectItem(Math.max(1, Math.min(arr.length - 1, s + (e.key === "F5" ? 1 : -1))));
        }
    };
    window.addEventListener("keydown", onKey);

    TABS.forEach((t, i) => tabBar.appendChild(btn(t.label, () => showTab(i))));

    function showTab(i) {
        ui.tab = i;
        current = TABS[i];
        [...tabBar.children].forEach((b, j) => b.classList.toggle("on", j === i));
        const active = tabBar.children[i];
        if (active) { active.scrollIntoView({ inline: "nearest", block: "nearest" }); }
        content.innerHTML = "";
        content.scrollTop = 0;
        if (current.page) {
            const page = el("div", { class: "dbPage" });
            content.appendChild(page);
            current.page(ctx, page);
            return;
        }
        titleEl = el("div", { class: "dbListTitle", text: current.label });
        listEl = el("div", { class: "dbList" });
        formEl = el("div", { class: "dbForm" });
        const listBtns = el("div", { class: "dbListBtns" },
            btn("Change Maximum...", changeMaximum),
            el("div", { class: "dbRow" },
                btn("Copy", () => { const s = ui.sel[current.id]; clipboard[current.file] = structuredClone(db[current.file][s]); }, "small"),
                btn("Paste", pasteItem, "small"),
                btn("Clear", clearItem, "small")));
        content.appendChild(el("div", { class: "dbMain" }, el("div", { class: "dbListPane" }, titleEl, listEl, listBtns), formEl));
        renderList();
        const arr = db[current.file];
        selectItem(Math.min(ui.sel[current.id] || 1, arr.length - 1));
    }

    function labelOf(item, id) {
        return pad(id) + " " + (item ? (current.listName ? current.listName(item, db) : item.name || "") : "");
    }

    function renderList() {
        const arr = db[current.file];
        listEl.innerHTML = "";
        const frag = document.createDocumentFragment();
        for (let id = 1; id < arr.length; id++) {
            const r = el("div", { class: "dbListItem", text: labelOf(arr[id], id) });
            r.dataset.id = id;
            frag.appendChild(r);
        }
        listEl.appendChild(frag);
        listEl.onclick = e => {
            const r = e.target.closest(".dbListItem");
            if (r) { selectItem(Number(r.dataset.id)); }
        };
        markSelected();
    }

    function markSelected() {
        const s = ui.sel[current.id];
        for (const r of listEl.querySelectorAll(".dbListItem.sel")) { r.classList.remove("sel"); }
        const r = listEl.querySelector(`.dbListItem[data-id="${s}"]`);
        if (r) {
            r.classList.add("sel");
            const lr = listEl.getBoundingClientRect(), rr = r.getBoundingClientRect();
            if (rr.top < lr.top || rr.bottom > lr.bottom) { r.scrollIntoView({ block: "nearest" }); }
        }
    }

    function refreshRowLabel() {
        if (!current || current.page) { return; }
        const s = ui.sel[current.id];
        const r = listEl.querySelector(`.dbListItem[data-id="${s}"]`);
        if (r) { r.textContent = labelOf(db[current.file][s], s); }
    }

    function selectItem(id) {
        if (id < 1) { formEl.innerHTML = ""; return; }
        ui.sel[current.id] = id;
        markSelected();
        const arr = db[current.file];
        if (!arr[id]) { arr[id] = BLANK[current.file](id); }
        formEl.innerHTML = "";
        formEl.scrollTop = 0;
        current.form(ctx, arr[id], formEl, id);
    }

    async function changeMaximum() {
        const arr = db[current.file];
        const n = { v: arr.length - 1 };
        const limit = Math.max(current.max || 1000, arr.length - 1);
        const ok = await modal({
            title: "Change Maximum", width: "380px",
            build: b => b.appendChild(fld("Maximum:", num(n, "v", { min: 1, max: limit })))
        });
        if (!ok || n.v === arr.length - 1) { return; }
        if (n.v < arr.length - 1) {
            const sure = await confirmBox(`Os dados de ${pad(n.v + 1)} em diante serão apagados. Continuar?`, "Change Maximum");
            if (!sure) { return; }
            arr.length = n.v + 1;
        } else {
            for (let id = arr.length; id <= n.v; id++) { arr[id] = BLANK[current.file](id); }
        }
        ctx.touch(current.file);
        renderList();
        selectItem(Math.min(ui.sel[current.id] || 1, arr.length - 1));
    }

    function pasteItem() {
        const c = clipboard[current.file];
        const s = ui.sel[current.id];
        if (!c || !s) { return; }
        db[current.file][s] = Object.assign(structuredClone(c), { id: s });
        ctx.touch(current.file);
        refreshRowLabel();
        selectItem(s);
    }

    async function clearItem() {
        const s = ui.sel[current.id];
        if (!s) { return; }
        db[current.file][s] = BLANK[current.file](s);
        ctx.touch(current.file);
        refreshRowLabel();
        selectItem(s);
    }

    let start = ui.tab;
    if (tabId) { const i = TABS.findIndex(t => t.id === tabId); if (i >= 0) { start = i; } }
    showTab(start);
}
