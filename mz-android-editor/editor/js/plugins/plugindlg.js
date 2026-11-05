// Diálogo "Plugin" (adicionar / editar): Nome, Status, Descrição, Autor, Ajuda e a tabela
// de Parâmetros; aba extra com os Plugin Commands do arquivo (somente leitura).

import { getPluginInfo, listPluginFiles, mergeParameters } from "./store.js";
import { defaultsOf, typeInfo } from "./parser.js";
import { ParamTable } from "./params.js";
import { el, promptDialog } from "./ui.js";
import { t } from "../i18n.js";

function commandsView(info) {
    const box = el("div", { class: "pgCommands" });
    if (!info.commands.length) {
        box.appendChild(el("div", { class: "pgEmpty", text: t("(This plugin declares no commands)") }));
        return box;
    }
    for (const c of info.commands) {
        const args = el("div", { class: "pgArgs" });
        if (c.args.length) {
            args.appendChild(el("div", { class: "pgArgRow pgArgHead" },
                el("span", { text: t("Arguments", "EventCommand357") }), el("span", { text: t("Type", "Constants") }),
                el("span", { text: t("Default", "Constants") }), el("span", { text: t("Description", "Constants") })));
            for (const a of c.args) {
                const ti = typeInfo(a.type);
                const opts = a.options.length ? " [" + a.options.map(o => o.text).join(", ") + "]" : "";
                args.appendChild(el("div", { class: "pgArgRow" },
                    el("span", {}, el("b", { text: a.text || a.name }), a.text ? el("small", { text: " " + a.name }) : ""),
                    el("span", { text: ti.raw + opts }),
                    el("span", { text: a.default }),
                    el("span", { text: a.desc })));
            }
        } else {
            args.appendChild(el("div", { class: "pgHint", text: t("No arguments.") }));
        }
        const head = el("div", { class: "pgCmdHead" },
            el("span", { class: "pgToggle", text: "▸" }),
            el("b", { text: c.text || c.name }), el("small", { text: "  " + c.name }));
        const block = el("div", { class: "pgCmd" }, head,
            c.desc ? el("div", { class: "pgCmdDesc", text: c.desc }) : "", args);
        head.addEventListener("click", () => {
            block.classList.toggle("open");
            head.firstChild.textContent = block.classList.contains("open") ? "▾" : "▸";
        });
        box.appendChild(block);
    }
    return box;
}

// entry: {name, status, description, parameters} ou null (novo). Devolve Promise<entry|null>.
export async function openPluginDialog(api, entry, { usedNames = [] } = {}) {
    const files = await listPluginFiles(api);
    const original = entry ? JSON.parse(JSON.stringify(entry)) : null;
    const state = {
        name: entry ? entry.name : "",
        status: entry ? !!entry.status : true,
        description: entry ? entry.description || "" : "",
        parameters: entry ? { ...(entry.parameters || {}) } : {},
        info: null
    };

    let nameSel, statusRow, descEl, authorEl, helpEl, warnEl, urlEl, table, paramDesc, cmdPane, tabs;

    const setStatus = on => {
        state.status = on;
        statusRow.querySelectorAll(".pgRadio").forEach(b => b.classList.toggle("on", (b.dataset.v === "1") === on));
    };

    async function loadInfo(name, isOriginal) {
        state.name = name;
        if (!name) {
            state.info = null;
            state.description = "";
            state.parameters = {};
            descEl.textContent = authorEl.textContent = helpEl.textContent = "";
            urlEl.textContent = "";
            warnEl.hidden = true;
            table.setData([], state.parameters, {});
            cmdPane.replaceChildren(commandsView({ commands: [] }));
            return;
        }
        const info = await getPluginInfo(name, { fresh: true });
        state.info = info;
        if (isOriginal && original) {
            // Edição: mantém os valores gravados (inclusive parâmetros que não existem mais,
            // como o MZ faz até que se use "Atualizar").
            const ordered = mergeParameters(info, original.parameters);
            for (const k of Object.keys(original.parameters || {})) {
                if (!(k in ordered)) {
                    ordered[k] = original.parameters[k];
                }
            }
            state.parameters = ordered;
            state.description = info.missing ? original.description : (info.plugindesc || "");
        } else {
            state.parameters = defaultsOf(info.params);
            state.description = info.plugindesc || "";
        }
        descEl.textContent = state.description;
        authorEl.textContent = info.author || "";
        urlEl.textContent = info.url || "";
        urlEl.parentElement.hidden = !info.url;
        helpEl.textContent = info.help || "";
        const warn = info.missing ? t("The plugin \"%1\" cannot be loaded.", "Dialog_PluginManager", name)
            : !info.isMZ ? t("The plugin \"%1\" may not support %2.", "Dialog_PluginManager", name, "RPG Maker MZ")
                : "";
        warnEl.textContent = warn;
        warnEl.hidden = !warn;
        table.setData(info.params, state.parameters, info.structs);
        paramDesc.textContent = "";
        cmdPane.replaceChildren(commandsView(info));
        tabs.querySelector("[data-tab=cmd]").textContent = `${t("Commands", "Edit_X_Terms")} (${info.commands.length})`;
    }

    return promptDialog(api, {
        title: t("Plugin Settings", "Dialog_PluginSettings"), width: "1240px", height: "580px",
        build(body) {
            body.classList.add("pgPluginDlg");
            nameSel = el("select", { class: "pgSelect" });
            nameSel.appendChild(el("option", { value: "", text: "" }));
            const names = files.slice();
            if (state.name && !names.includes(state.name)) {
                names.unshift(state.name);
            }
            for (const n of names) {
                const used = usedNames.includes(n) && n !== (original && original.name);
                nameSel.appendChild(el("option", { value: n, text: used ? n + "  " + t("(already in the list)") : n }));
            }
            nameSel.value = state.name;
            nameSel.addEventListener("change", () => loadInfo(nameSel.value, original && nameSel.value === original.name));

            statusRow = el("div", { class: "pgRadioRow small" },
                el("button", { class: "pgRadio", "data-v": "1", text: t("ON", "Constants"), onclick: () => setStatus(true) }),
                el("button", { class: "pgRadio", "data-v": "0", text: t("OFF", "Constants"), onclick: () => setStatus(false) }));
            descEl = el("div", { class: "pgField pgRO" });
            authorEl = el("div", { class: "pgField pgRO" });
            urlEl = el("div", { class: "pgField pgRO pgUrl" });
            helpEl = el("div", { class: "pgHelp pgRO" });
            warnEl = el("div", { class: "pgWarn", hidden: true });

            const left = el("div", { class: "pgLeft" },
                el("div", { class: "pgFormRow" }, el("label", { text: t("Name", "Constants") + ":" }), nameSel),
                el("div", { class: "pgFormRow" }, el("label", { text: t("Status", "Dialog_PluginSettings") + ":" }), statusRow),
                el("div", { class: "pgFormRow" }, el("label", { text: t("Description", "Constants") + ":" }), descEl),
                el("div", { class: "pgFormRow" }, el("label", { text: t("Author", "Dialog_PluginSettings") + ":" }), authorEl),
                el("div", { class: "pgFormRow", hidden: true }, el("label", { text: "URL:" }), urlEl),
                warnEl,
                el("label", { class: "pgHelpLabel", text: t("Help", "Dialog_PluginSettings") + ":" }),
                helpEl);

            table = new ParamTable(api, {
                defs: [], values: state.parameters, structs: {},
                onSelect: def => { paramDesc.textContent = def.desc || ""; }
            });
            paramDesc = el("div", { class: "pgDesc pgParamDesc" });
            const paramPane = el("div", { class: "pgPane" }, table.root, paramDesc);
            cmdPane = el("div", { class: "pgPane", hidden: true });
            const showTab = tab => {
                paramPane.hidden = tab !== "par";
                cmdPane.hidden = tab !== "cmd";
                tabs.querySelectorAll("button").forEach(b => b.classList.toggle("on", b.dataset.tab === tab));
            };
            tabs = el("div", { class: "pgTabs" },
                el("button", { class: "on", "data-tab": "par", text: t("Parameters", "Dialog_PluginSettings"), onclick: () => showTab("par") }),
                el("button", { "data-tab": "cmd", text: t("Commands", "Edit_X_Terms"), onclick: () => showTab("cmd") }));
            const right = el("div", { class: "pgRight" }, tabs, paramPane, cmdPane);
            body.append(left, right);
            setStatus(state.status);
            loadInfo(state.name, !!original).catch(e => {
                warnEl.textContent = String(e.message || e);
                warnEl.hidden = false;
            });
        },
        onOk: () => {
            if (!state.name) {
                // Nenhum plugin escolhido: equivale a cancelar.
                return null;
            }
            // Se o valor de um parâmetro foi editado, `table.values` é o próprio state.parameters.
            return {
                name: state.name,
                status: state.status,
                description: state.description,
                parameters: state.parameters
            };
        }
    });
}
