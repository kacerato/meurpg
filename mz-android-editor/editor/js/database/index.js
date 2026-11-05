// Módulo "database": diálogo Banco de dados do RPG Maker MZ (16 abas).
// Contrato: SESSIONS.md. Liga o botão btnDatabase; grava data/*.json e emite db:changed.
import { el, btn, setApi, setChangedHook, modal, fld, num, confirmBox, alertBox, pad, getClip, setClip } from "./ui.js";
import { FILES, BLANK, registerKinds } from "./common.js";
import { TABS } from "./tabs.js";
import { stopAudio } from "./pickers.js";
import { t } from "../i18n.js";

const CSS_ID = "dbCss";
const ui = { tab: 0, sel: {} };   // aba e seleção lembradas entre aberturas


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
        api.status(t("Database", "DatabaseMain") + ": " + (e.message || e));
    }), t("Database", "DatabaseMain"));
    api.database = { open: (tabId) => openDatabase(api, tabId) };
}

async function loadAll(api) {
    const db = {};
    await Promise.all(FILES.map(async f => {
        db[f] = structuredClone(await api.project.readJson(`data/${f}.json`, { fresh: true }));
    }));
    registerKinds(db);
    return db;
}

let opened = null;

export async function openDatabase(api, tabId) {
    if (opened) { return; }
    if (!api.project) { throw new Error(t("No project is open.", "MZEditor")); }
    api.status(t("Loading the database...", "MZEditor"));
    const db = await loadAll(api);
    api.status("");
    const dirty = new Set();
    let current = null;                      // aba atual
    let multi = new Set(), multiMode = false, anchor = 0;   // seleção múltipla na lista
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
        api.status(files.length ? t("Database saved: %1", "MZEditor", files.join(", ")) : "");
        return files;
    };

    const dlg = api.openDialog({
        title: t("Database", "DatabaseMain"),
        width: "calc(100vw - 12px)", height: "calc(100vh - 12px)",
        buttons: [
            { label: t("OK", "BasicConstants"), primary: true, onClick: () => { save().then(close).catch(err => alertBox(t("Failed to save: %1", "MZEditor", err.message))); return false; } },
            { label: t("Cancel", "BasicConstants"), onClick: () => { if (dirty.size) { confirmBox(t("Discard changes to the database?", "DatabaseMain"), t("Database", "DatabaseMain")).then(ok => ok && close()); return false; } close(); } },
            { label: t("Apply", "BasicConstants"), onClick: () => { save().catch(err => alertBox(t("Failed to save: %1", "MZEditor", err.message))); return false; } }
        ]
    });
    opened = dlg;
    dlg.root.classList.add("dbRoot");
    dlg.body.classList.add("dbBody");
    dlg.body.append(tabBar, content);
    const titleBar = dlg.root.querySelector(".mzDialogTitle");
    const updateTitle = () => { titleBar.textContent = t("Database", "DatabaseMain") + (dirty.size ? " *" : ""); };

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

    TABS.forEach((tab, i) => {
        const b = btn(tab.label, () => showTab(i));
        if (tab.desc) { b.title = tab.desc; }
        tabBar.appendChild(b);
    });

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
        multi = new Set([ui.sel[current.id] || 1]);
        multiMode = false;
        const multiBtn = btn(t("Multi", "MZEditor"), () => {
            multiMode = !multiMode;
            multiBtn.classList.toggle("on", multiMode);
            if (!multiMode) { multi = new Set([ui.sel[current.id]]); markSelected(); }
        }, "small");
        multiBtn.title = t("Multiple selection (same as Shift + click)", "MZEditor");
        const listBtns = el("div", { class: "dbListBtns" },
            btn(t("Change Maximum", "DataSelector") + "...", changeMaximum),
            el("div", { class: "dbRow" },
                multiBtn,
                btn(t("Copy", "BasicConstants"), copyItems, "small"),
                btn(t("Paste", "BasicConstants"), pasteItem, "small"),
                btn(t("Clear", "BasicConstants"), clearItem, "small")));
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
            if (!r) { return; }
            const id = Number(r.dataset.id);
            if (e.shiftKey) {
                // Shift + clique: intervalo a partir da âncora (como no MZ)
                const a = anchor || ui.sel[current.id] || id;
                multi = new Set();
                for (let k = Math.min(a, id); k <= Math.max(a, id); k++) { multi.add(k); }
            } else if (multiMode) {
                if (multi.has(id) && multi.size > 1) { multi.delete(id); } else { multi.add(id); }
                anchor = id;
            } else {
                multi = new Set([id]);
                anchor = id;
            }
            selectItem(id, true);
        };
        markSelected();
    }

    function markSelected() {
        const s = ui.sel[current.id];
        for (const r of listEl.querySelectorAll(".dbListItem.sel, .dbListItem.multi")) { r.classList.remove("sel", "multi"); }
        for (const id of multi) {
            const m = id !== s && listEl.querySelector(`.dbListItem[data-id="${id}"]`);
            if (m) { m.classList.add("multi"); }
        }
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

    function selectItem(id, keepMulti) {
        if (id < 1) { formEl.innerHTML = ""; return; }
        if (!keepMulti) { multi = new Set([id]); anchor = id; }
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
            title: t("Change Maximum", "Dialog_ChangeMaximum"), width: "380px",
            build: b => b.appendChild(fld(t("Maximum", "Dialog_ChangeMaximum") + ":", num(n, "v", { min: 1, max: limit })))
        });
        if (!ok || n.v === arr.length - 1) { return; }
        if (n.v < arr.length - 1) {
            const sure = await confirmBox(t("Data from %1 onward will be deleted. Continue?", "MZEditor", pad(n.v + 1)), t("Change Maximum", "Dialog_ChangeMaximum"));
            if (!sure) { return; }
            arr.length = n.v + 1;
        } else {
            for (let id = arr.length; id <= n.v; id++) { arr[id] = BLANK[current.file](id); }
        }
        ctx.touch(current.file);
        renderList();
        selectItem(Math.min(ui.sel[current.id] || 1, arr.length - 1));
    }

    function selectedIds() {
        const ids = [...multi].sort((a, b) => a - b);
        return ids.length ? ids : [ui.sel[current.id]];
    }

    function copyItems() {
        const items = selectedIds().map(id => structuredClone(db[current.file][id]));
        setClip("data:" + current.file, items);
        api.status(t("Copied: %1 item(s)", "MZEditor", items.length));
    }

    // Cola em sequência a partir do item selecionado (vários itens copiados => vários destinos).
    function pasteItem() {
        const c = getClip("data:" + current.file);
        const s = ui.sel[current.id];
        if (!c || !c.length || !s) { return; }
        const arr = db[current.file];
        c.forEach((item, k) => {
            const id = s + k;
            if (id < arr.length) { arr[id] = Object.assign(structuredClone(item), { id }); }
        });
        ctx.touch(current.file);
        renderList();
        selectItem(s);
    }

    function clearItem() {
        const ids = selectedIds();
        for (const id of ids) { db[current.file][id] = BLANK[current.file](id); }
        ctx.touch(current.file);
        renderList();
        selectItem(ui.sel[current.id]);
    }

    let start = ui.tab;
    if (tabId) { const i = TABS.findIndex(tab => tab.id === tabId); if (i >= 0) { start = i; } }
    showTab(start);
}
