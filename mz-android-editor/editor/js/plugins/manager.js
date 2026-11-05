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

    function updateButtons() {
        const has = selected >= 0 && selected < list.length;
        buttons.edit.disabled = !has;
        buttons.del.disabled = !has;
        buttons.copy.disabled = !has;
        buttons.paste.disabled = !clipboard;
        buttons.up.disabled = !has || selected === 0;
        buttons.down.disabled = !has || selected >= list.length - 1;
        buttons.update.disabled = !has;
    }

    function select(i, scroll) {
        selected = i;
        tbody.querySelectorAll(".pmRow").forEach(r => r.classList.toggle("selected", Number(r.dataset.i ?? -2) === i ||
            (i === list.length && r.classList.contains("pmEmptyRow"))));
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
            const row = el("div", { class: "pmRow" + (i === selected ? " selected" : ""), "data-i": String(i) },
                handle,
                el("span", { class: "pmName", text: p.name }),
                el("span", { class: "pmStatusCell" }, status),
                el("span", { class: "pmDesc", text: p.description || "" }));
            row.addEventListener("click", () => {
                if (selected === i) {
                    edit(i);
                } else {
                    select(i);
                }
            });
            bindDrag(handle, i);
            tbody.appendChild(row);
        });
        // Linha vazia no fim: tocar adiciona (no MZ: duplo clique em uma linha vazia).
        const empty = el("div", { class: "pmRow pmEmptyRow" + (selected === list.length ? " selected" : "") },
            el("span", { class: "pmHandle" }), el("span", { class: "pmName", text: "" }),
            el("span", { class: "pmStatusCell" }), el("span", { class: "pmDesc pmHint", text: t("Tap here to add a plugin") }));
        empty.addEventListener("click", () => add(list.length));
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
        if (selected < 0 || selected >= list.length) {
            return;
        }
        list.splice(selected, 1);
        selected = Math.min(selected, list.length - 1);
        markDirty();
        render();
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
    async function update() {
        if (selected < 0 || selected >= list.length) {
            return;
        }
        const p = list[selected];
        const info = await getPluginInfo(p.name, { fresh: true });
        if (info.missing) {
            await alertDialog(api, t("Refresh", "Dialog_PluginManager"), t("The plugin \"%1\" cannot be loaded.", "Dialog_PluginManager", p.name));
            return;
        }
        p.description = info.plugindesc || "";
        p.parameters = mergeParameters(info, p.parameters);
        markDirty();
        render();
        api.status(t("Plugin %1 refreshed.", null, p.name));
    }

    function copy() {
        if (selected >= 0 && selected < list.length) {
            clipboard = clone(list[selected]);
            updateButtons();
        }
    }

    function paste() {
        if (!clipboard) {
            return;
        }
        const at = selected >= 0 ? Math.min(selected + 1, list.length) : list.length;
        list.splice(at, 0, clone(clipboard));
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
        B("copy", t("Copy", "BasicConstants"), copy),
        B("paste", t("Paste", "BasicConstants"), paste),
        el("span", { class: "sep" }),
        B("up", "▲ " + t("Up", "Constants"), () => move(-1)),
        B("down", "▼ " + t("Down", "Constants"), () => move(1)),
        el("span", { class: "sep" }),
        B("update", t("Refresh", "Dialog_PluginManager"), update, t("Reloads the plugin file (description and parameters).")),
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
    render();
}
