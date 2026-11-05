// Módulo events do MZ Editor: modo evento no mapa, editor de evento, todos os comandos de evento
// e Event Searcher. Contrato: mz-android-editor/SESSIONS.md.

import { db, clone } from "./data.js";
import { setApi, h, dialog } from "./ui.js";
import { EventMode } from "./eventmode.js";
import { openSearcher } from "./search.js";
import { createCommandList, commandListToolbar } from "./commandlist.js";
import { t } from "../i18n.js";

export async function register(api) {
    if (!document.querySelector('link[data-mz="events"]')) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = new URL("../../css/events.css", import.meta.url).href;
        link.dataset.mz = "events";
        document.head.appendChild(link);
    }
    setApi(api);
    await db.load(api);
    api.on("db:changed", ({ file }) => { db.reload(file).catch(e => console.warn("events: reload", file, e)); });

    const mode = new EventMode(api);
    api.events = mode; // útil para depuração e para outros módulos (ex.: abrir evento)

    // Ponte para o módulo database (Troops / Common Events): edita uma lista de comandos num diálogo.
    // Recebe uma cópia da lista; devolve a lista editada ou null se cancelado.
    mode.editCommandList = (list, opts = {}) => {
        const work = clone(list);
        return dialog({
            title: opts.title || t("Contents", "Layout_EventPage"), width: "min(1100px, 99vw)", height: "96vh",
            build: body => {
                const cl = createCommandList({ list: work, ctx: { map: null, mapId: 0, eventId: 0, troopId: opts.troopId || 0 } });
                body.append(h("div", { class: "evContentsTitle" }, t("Contents", "Layout_EventPage")), cl.el, commandListToolbar(cl));
                body.classList.add("evCommonBody");
            },
            onOk: () => ({ v: work })
        }).then(r => (r ? r.v : null));
    };
    api.mode = api.mode || "map";

    const btnEvent = document.getElementById("btnModeEvent");
    const btnMap = document.getElementById("btnModeMap");
    const setMode = (m, fromEvent) => {
        api.mode = m;
        mode.setActive(m === "event");
        if (btnEvent) { btnEvent.classList.toggle("on", m === "event"); }
        if (btnMap) { btnMap.classList.toggle("on", m !== "event"); }
        if (!fromEvent) { api.emit("mode:changed", { mode: m }); }
    };
    api.bindToolbar("btnModeEvent", () => setMode("event"), t("Event", "MainMenu"));
    if (btnMap) { btnMap.addEventListener("click", () => { if (api.mode === "event") { setMode("map"); } }); }
    api.on("mode:changed", ({ mode: m }) => { if ((m === "event") !== mode.active) { setMode(m, true); } });
    api.bindToolbar("btnEventSearch", () => openSearcher(api, mode), t("Event Searcher", "MainMenu"));

    // Mapa já carregado antes do registro (app.js chama loadModules antes de selectMap, mas por garantia)
    if (api.view && api.view.mapData && api.currentMapId) {
        const tilesets = await api.project.tilesets();
        mode.setMap(api.currentMapId, api.view.mapData, tilesets[api.view.mapData.tilesetId]);
    }
}
