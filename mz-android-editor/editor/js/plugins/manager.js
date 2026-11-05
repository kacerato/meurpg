// Diálogo "Gerenciador de plugins" (Plugin Manager): lista ordenada Nome / Status / Descrição,
// reordenação por arrastar, ativar/desativar, adicionar/editar/excluir/atualizar, avisos de
// @base / @orderAfter / @orderBefore / plugin de MV, e gravação de js/plugins.js.

import { loadPluginList, savePluginList, getPluginInfo, clearInfoCache, mergeParameters } from "./store.js";
import { openPluginDialog } from "./plugindlg.js";
import { el, alertDialog, confirmDialog } from "./ui.js";
import { t } from "../i18n.js";

let clipboard = null;

const clone = o => JSON.parse(JSON.stringify(o));

// Avisos no estilo do MZ para a ordem/dependências atuais.
export async function computeWarnings(list) {
    const out = [];   // {index, text}
    const index = new Map(list.map((p, i) => [p.name, i]));
    const infos = await Promise.all(list.map(p => getPluginInfo(p.name).catch(() => null)));
    list.forEach((p, i) => {
        const info = infos[i];
        if (!info) {
            return;
        }
        if (info.missing) {
            out.push({ index: i, text: t("The plugin \"%1\" cannot be loaded.", "Dialog_PluginManager", p.name) });
            return;
        }
        if (!info.isMZ) {
            out.push({ index: i, text: t("The plugin \"%1\" may not support %2.", "Dialog_PluginManager", p.name, "RPG Maker MZ") });
        }
        if (!p.status) {
            return;
        }
        for (const b of info.base) {
            if (!index.has(b)) {
                out.push({ index: i, text: t("The plugin \"%1\" requires the base plugin \"%2\".", "Dialog_PluginManager", p.name, b) });
            } else if (!list[index.get(b)].status) {
                out.push({ index: i, text: t("The plugin \"%1\" requires the base plugin \"%2\".", "Dialog_PluginManager", p.name, b) });
            } else if (index.get(b) > i) {
                out.push({ index: i, text: t("The plugin \"%1\" must be ordered after \"%2\".", "Dialog_PluginManager", p.name, b) });
            }
        }
        for (const a of info.orderAfter) {
            if (index.has(a) && index.get(a) > i && !info.base.includes(a)) {
                out.push({ index: i, text: t("The plugin \"%1\" must be ordered after \"%2\".", "Dialog_PluginManager", p.name, a) });
            }
        }
        for (const b of info.orderBefore) {
            if (index.has(b) && index.get(b) < i) {
                out.push({ index: i, text: t("The plugin \"%1\" must be ordered before \"%2\".", "Dialog_PluginManager", p.name, b) });
            }
        }
    });
    return out;
}

export async function openPluginManager(api) {
    let list;
    try {
        list = clone(await loadPluginList());
    } catch (e) {
        await alertDialog(api, t("Plugin Manager", "Dialog_PluginManager"), String(e.message || e));
        return;
    }
    clearInfoCache();
    let selected = list.length ? 0 : -1;
    let multi = new Set(selected >= 0 ? [selected] : []);   // seleção múltipla (Shift / Múltipla)
    let multiMode = false;
    let dirty = false;
    let tbody, warnBox, buttons = {};
    let warnSeq = 0;

    const markDirty = () => {
        dirty = true;
    };

    async function refreshWarnings() {
        const seq = ++warnSeq;
        const warns = await computeWarnings(list);
        if (seq !== warnSeq) {
            return;
        }
        warnBox.textContent = "";
        const rows = [...tbody.querySelectorAll(".pmRow[data-i]")];
        rows.forEach(r => r.classList.remove("warn"));
        for (const w of warns) {
            if (rows[w.index]) {
                rows[w.index].classList.add("warn");
            }
            const line = el("div", { class: "pmWarnLine" },
                el("img", { src: "img/warning.png", alt: "" }), el("span", { text: w.text }));
            line.addEventListener("click", () => select(w.index, true));
            warnBox.appendChild(line);
        }
        warnBox.hidden = !warns.length;
    }

    // índices afetados por Recortar/Copiar/Excluir/Atualizar (vários com Shift, como no MZ)
    function targets() {
        const ids = [...multi].filter(i => i >= 0 && i < list.length).sort((a, b) => a - b);
        return ids.length ? ids : (selected >= 0 && selected < list.length ? [selected] : []);
    }

    function updateButtons() {
        const has = selected >= 0 && selected < list.length;
        buttons.edit.disabled = !has;
        buttons.del.disabled = !has;
        buttons.cut.disabled = !has;
        buttons.copy.disabled = !has;
        buttons.paste.disabled = !clipboard;
        buttons.up.disabled = !has || selected === 0 || multi.size > 1;
        buttons.down.disabled = !has || selected >= list.length - 1 || multi.size > 1;
        buttons.update.disabled = !has;
    }

    function select(i, scroll, how) {
        if (how === "range" && selected >= 0 && i < list.length) {
            multi = new Set();
            for (let k = Math.min(selected, i); k <= Math.max(selected, i); k++) { multi.add(k); }
        } else if (how === "toggle" && i < list.length) {
            if (multi.has(i) && multi.size > 1) { multi.delete(i); } else { multi.add(i); }
            selected = i;
        } else if (how !== "keep") {
            multi = new Set(i >= 0 && i < list.length ? [i] : []);
            selected = i;
        }
        if (how !== "range") { selected = i; }
        tbody.querySelectorAll(".pmRow").forEach(r => {
            const k = Number(r.dataset.i ?? -2);
            r.classList.toggle("selected", k === selected || (selected === list.length && r.classList.contains("pmEmptyRow")));
            r.classList.toggle("multi", k !== selected && multi.has(k));
        });
        if (scroll) {
            const r = tbody.querySelector(".pmRow.selected");
            if (r) {
                r.scrollIntoView({ block: "nearest" });
            }
        }
        updateButtons();
    }

    function render() {
        tbody.textContent = "";
        if (!multi.has(selected)) {
            multi = new Set(selected >= 0 && selected < list.length ? [selected] : []);
        }
        list.forEach((p, i) => {
            const handle = el("span", { class: "pmHandle", title: t("Drag to reorder"), text: "≡" });
            const status = el("button", { class: "pmStatus" + (p.status ? " on" : ""), text: p.status ? t("ON", "Constants") : t("OFF", "Constants") });
            status.addEventListener("click", ev => {
                ev.stopPropagation();
                p.status = !p.status;
                markDirty();
                render();
                select(i);
            });
            const row = el("div", { class: "pmRow" + (i === selected ? " selected" : multi.has(i) ? " multi" : ""), "data-i": String(i) },
                handle,
                el("span", { class: "pmName", text: p.name }),
                el("span", { class: "pmStatusCell" }, status),
                el("span", { class: "pmDesc", text: p.description || "" }));
            row.addEventListener("click", ev => {
                if (longPressed) {
                    longPressed = false;
                    return;
                }
                if (ev.shiftKey) {
                    select(i, false, "range");
                } else if (multiMode) {
                    select(i, false, "toggle");
                } else if (selected === i && multi.size <= 1) {
                    edit(i);
                } else {
                    select(i);
                }
            });
            bindMenu(row, i);
            bindDrag(handle, i);
            tbody.appendChild(row);
        });
        // Linha vazia no fim: tocar adiciona (no MZ: duplo clique em uma linha vazia).
        const empty = el("div", { class: "pmRow pmEmptyRow" + (selected === list.length ? " selected" : "") },
            el("span", { class: "pmHandle" }), el("span", { class: "pmName", text: "" }),
            el("span", { class: "pmStatusCell" }), el("span", { class: "pmDesc pmHint", text: t("Tap here to add a plugin") }));
        empty.addEventListener("click", () => add(list.length));
        bindMenu(empty, list.length);
        tbody.appendChild(empty);
        updateButtons();
        refreshWarnings();
    }

    // Arrastar pela alça "≡" (pointer events: funciona com toque e mouse).
    function bindDrag(handle, from) {
        handle.addEventListener("pointerdown", ev => {
            ev.preventDefault();
            ev.stopPropagation();
            handle.setPointerCapture(ev.pointerId);
            const rows = [...tbody.querySelectorAll(".pmRow[data-i]")];
            rows[from].classList.add("dragging");
            let target = from;
            let scrollTimer = null;
            const indicate = y => {
                const rs = [...tbody.querySelectorAll(".pmRow[data-i]")];
                target = rs.length;
                for (let k = 0; k < rs.length; k++) {
                    const r = rs[k].getBoundingClientRect();
                    if (y < r.top + r.height / 2) {
                        target = k;
                        break;
                    }
                }
                rs.forEach((r, k) => {
                    r.classList.toggle("dropBefore", k === target);
                    r.classList.toggle("dropAfter", target === rs.length && k === rs.length - 1);
                });
            };
            let lastY = ev.clientY;
            const autoScroll = () => {
                const box = tbody.getBoundingClientRect();
                if (lastY < box.top + 30) {
                    tbody.scrollTop -= 12;
                } else if (lastY > box.bottom - 30) {
                    tbody.scrollTop += 12;
                }
                indicate(lastY);
            };
            scrollTimer = setInterval(autoScroll, 50);
            const move = e => {
                lastY = e.clientY;
                indicate(lastY);
            };
            const up = () => {
                clearInterval(scrollTimer);
                handle.removeEventListener("pointermove", move);
                handle.removeEventListener("pointerup", up);
                handle.removeEventListener("pointercancel", up);
                let to = target > from ? target - 1 : target;
                if (to !== from && to >= 0) {
                    const [item] = list.splice(from, 1);
                    list.splice(to, 0, item);
                    selected = to;
                    markDirty();
                } else {
                    to = from;
                }
                selected = to;
                render();
            };
            handle.addEventListener("pointermove", move);
            handle.addEventListener("pointerup", up);
            handle.addEventListener("pointercancel", up);
            indicate(ev.clientY);
        });
    }

    async function add(at = selected >= 0 ? selected + 1 : list.length) {
        const entry = await openPluginDialog(api, null, { usedNames: list.map(p => p.name) });
        if (entry) {
            const pos = Math.min(Math.max(at, 0), list.length);
            list.splice(pos, 0, entry);
            selected = pos;
            markDirty();
            render();
            select(pos, true);
        }
    }

    async function edit(i = selected) {
        if (i < 0 || i >= list.length) {
            add(list.length);
            return;
        }
        const entry = await openPluginDialog(api, list[i], { usedNames: list.map(p => p.name) });
        if (entry) {
            list[i] = entry;
            markDirty();
            render();
            select(i);
        }
    }

    async function del() {
        const ids = targets();
        if (!ids.length) {
            return;
        }
        for (const i of ids.reverse()) {
            list.splice(i, 1);
        }
        selected = Math.min(ids[ids.length - 1], list.length - 1);
        multi = new Set(selected >= 0 ? [selected] : []);
        markDirty();
        render();
    }

    function cut() {
        copy();
        del();
    }

    // Menu de contexto do MZ (clique direito; no toque, toque longo de 550 ms)
    let longPressed = false;
    let menuEl = null;
    function closeMenu() {
        if (menuEl) {
            menuEl.remove();
            menuEl = null;
        }
    }
    function openMenu(x, y, i) {
        closeMenu();
        if (i < list.length && !multi.has(i)) {
            select(i);
        } else if (i >= list.length) {
            select(list.length);
        }
        const has = i < list.length;
        const items = [
            [t("Edit", "StandardPopupMenu") + "...", () => edit(i), false],
            null,
            [t("Cut", "BasicConstants"), cut, !has],
            [t("Copy", "BasicConstants"), copy, !has],
            [t("Paste", "BasicConstants"), paste, !clipboard],
            [t("Delete", "BasicConstants"), del, !has],
            null,
            [t("Refresh", "Dialog_PluginManager"), update, !has]
        ];
        menuEl = el("div", { class: "pmMenu" });
        for (const it of items) {
            if (!it) {
                menuEl.appendChild(el("div", { class: "pmMenuSep" }));
                continue;
            }
            const b = el("button", { text: it[0], disabled: it[2] });
            b.addEventListener("click", () => { closeMenu(); it[1](); });
            menuEl.appendChild(b);
        }
        d.root.appendChild(menuEl);
        const r = d.root.getBoundingClientRect(), m = menuEl.getBoundingClientRect();
        menuEl.style.left = Math.max(0, Math.min(x - r.left, r.width - m.width - 4)) + "px";
        menuEl.style.top = Math.max(0, Math.min(y - r.top, r.height - m.height - 4)) + "px";
    }
    function bindMenu(row, i) {
        row.addEventListener("contextmenu", ev => {
            ev.preventDefault();
            openMenu(ev.clientX, ev.clientY, i);
        });
        let timer = 0, start = null;
        row.addEventListener("pointerdown", ev => {
            if (ev.pointerType !== "touch") {
                return;
            }
            start = { x: ev.clientX, y: ev.clientY };
            timer = setTimeout(() => {
                longPressed = true;
                openMenu(start.x, start.y, i);
            }, 550);
        });
        const cancel = ev => {
            if (timer && (ev.type !== "pointermove" || Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 10)) {
                clearTimeout(timer);
                timer = 0;
            }
        };
        row.addEventListener("pointermove", cancel);
        row.addEventListener("pointerup", cancel);
        row.addEventListener("pointercancel", cancel);
    }

    function move(d) {
        const i = selected;
        const j = i + d;
        if (i < 0 || j < 0 || j >= list.length) {
            return;
        }
        [list[i], list[j]] = [list[j], list[i]];
        selected = j;
        markDirty();
        render();
        select(j, true);
    }

    function setAll(on) {
        list.forEach(p => { p.status = on; });
        markDirty();
        render();
    }

    // "Atualizar": relê o arquivo e reaplica descrição/parâmetros (mantendo os valores).
    // Com vários selecionados (Shift), atualiza todos de uma vez, como no MZ.
    async function update() {
        const ids = targets();
        if (!ids.length) {
            return;
        }
        const done = [];
        for (const i of ids) {
            const p = list[i];
            const info = await getPluginInfo(p.name, { fresh: true });
            if (info.missing) {
                await alertDialog(api, t("Refresh", "Dialog_PluginManager"), t("The plugin \"%1\" cannot be loaded.", "Dialog_PluginManager", p.name));
                continue;
            }
            p.description = info.plugindesc || "";
            p.parameters = mergeParameters(info, p.parameters);
            done.push(p.name);
        }
        if (!done.length) {
            return;
        }
        const keep = new Set(multi);
        markDirty();
        render();
        multi = keep;
        select(selected, false, "keep");
        api.status(t("Plugin %1 refreshed.", null, done.join(", ")));
    }

    function copy() {
        const ids = targets();
        if (ids.length) {
            clipboard = ids.map(i => clone(list[i]));
            updateButtons();
        }
    }

    function paste() {
        if (!clipboard) {
            return;
        }
        const at = selected >= 0 ? Math.min(selected + 1, list.length) : list.length;
        list.splice(at, 0, ...clipboard.map(clone));
        selected = at;
        markDirty();
        render();
        select(at, true);
    }

    async function save() {
        try {
            await savePluginList(list);
            dirty = false;
            api.emit("plugins:changed", { list: clone(list) });
            api.status(t("%1 saved (%2 plugins).", null, "js/plugins.js", list.length));
            return true;
        } catch (e) {
            await alertDialog(api, t("Plugin Manager", "Dialog_PluginManager"), String(e.message || e));
            return false;
        }
    }

    const d = api.openDialog({
        title: t("Plugin Manager", "Dialog_PluginManager"), width: "1260px", height: "590px",
        buttons: [
            {
                label: t("OK", "BasicConstants"), primary: true, onClick: () => {
                    if (!dirty) {
                        return true;
                    }
                    save().then(ok => ok && d.close());
                    return false;
                }
            },
            {
                label: t("Cancel", "BasicConstants"), onClick: () => {
                    if (!dirty) {
                        return true;
                    }
                    confirmDialog(api, t("Plugin Manager", "Dialog_PluginManager"), t("Discard changes to the plugins?", "Dialog_PluginManager"))
                        .then(ok => ok && d.close());
                    return false;
                }
            },
            { label: t("Apply", "BasicConstants"), onClick: () => { if (dirty) { save(); } return false; } }
        ]
    });
    d.root.classList.add("pgDialog");
    const B = (key, text, fn, title) => {
        buttons[key] = el("button", { class: "pgBtn", text, title: title || text, onclick: fn });
        return buttons[key];
    };
    const bar = el("div", { class: "pgBar" },
        B("add", t("Add", "Edit_Troops"), () => add()),
        B("edit", t("Edit", "StandardPopupMenu"), () => edit()),
        B("del", t("Delete", "BasicConstants"), del),
        el("span", { class: "sep" }),
        B("cut", t("Cut", "BasicConstants"), cut),
        B("copy", t("Copy", "BasicConstants"), copy),
        B("paste", t("Paste", "BasicConstants"), paste),
        el("span", { class: "sep" }),
        B("up", "▲ " + t("Up", "Constants"), () => move(-1)),
        B("down", "▼ " + t("Down", "Constants"), () => move(1)),
        el("span", { class: "sep" }),
        B("update", t("Refresh", "Dialog_PluginManager"), update, t("Reloads the plugin file (description and parameters).")),
        B("multi", t("Multi", "MZEditor"), () => {
            multiMode = !multiMode;
            buttons.multi.classList.toggle("on", multiMode);
            if (!multiMode) {
                select(selected);
            }
        }, t("Multiple selection (same as Shift + click)", "MZEditor")),
        el("span", { class: "spacer" }),
        B("allOn", t("Turn All ON"), () => setAll(true)),
        B("allOff", t("Turn All OFF"), () => setAll(false)));
    const head = el("div", { class: "pmRow pmHead" },
        el("span", { class: "pmHandle" }), el("span", { class: "pmName", text: t("Name", "Constants") }),
        el("span", { class: "pmStatusCell", text: t("Status", "Dialog_PluginManager") }), el("span", { class: "pmDesc", text: t("Description", "Constants") }));
    tbody = el("div", { class: "pmBody" });
    warnBox = el("div", { class: "pmWarnings", hidden: true });
    d.body.classList.add("pgCol", "pmMain");
    d.body.append(bar, el("div", { class: "pmTable" }, head, tbody), warnBox);
    d.root.addEventListener("pointerdown", ev => { if (menuEl && !menuEl.contains(ev.target)) { closeMenu(); } }, true);
    // Atalhos do MZ: Del, Ctrl+X/C/V, Enter (só com o gerenciador no topo)
    const onKey = ev => {
        if (!d.root.isConnected) {
            window.removeEventListener("keydown", onKey);
            return;
        }
        const top = [...document.querySelectorAll(".pgDialog")].pop();
        if (top !== d.root || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement && document.activeElement.tagName)) {
            return;
        }
        const k = ev.key.toLowerCase();
        if (ev.key === "Escape" && menuEl) { closeMenu(); ev.preventDefault(); }
        else if (ev.key === "Delete") { del(); ev.preventDefault(); }
        else if ((ev.ctrlKey || ev.metaKey) && k === "c") { copy(); ev.preventDefault(); }
        else if ((ev.ctrlKey || ev.metaKey) && k === "x") { cut(); ev.preventDefault(); }
        else if ((ev.ctrlKey || ev.metaKey) && k === "v") { paste(); ev.preventDefault(); }
        else if (ev.key === "Enter" && selected >= 0) { edit(selected); ev.preventDefault(); }
    };
    window.addEventListener("keydown", onKey);
    render();
}
