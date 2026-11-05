// Módulo events do MZ Editor: modo evento no mapa, editor de evento, todos os comandos de evento
// e Event Searcher. Contrato: mz-android-editor/SESSIONS.md.

import { db } from "./data.js";
import { setApi } from "./ui.js";
import { EventMode } from "./eventmode.js";
import { openSearcher } from "./search.js";

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
    api.bindToolbar("btnModeEvent", () => setMode("event"), "Modo evento");
    if (btnMap) { btnMap.addEventListener("click", () => { if (api.mode === "event") { setMode("map"); } }); }
    api.on("mode:changed", ({ mode: m }) => { if ((m === "event") !== mode.active) { setMode(m, true); } });
    api.bindToolbar("btnEventSearch", () => openSearcher(api, mode), "Event Searcher");

    // Mapa já carregado antes do registro (app.js chama loadModules antes de selectMap, mas por garantia)
    if (api.view && api.view.mapData && api.currentMapId) {
        const tilesets = await api.project.tilesets();
        mode.setMap(api.currentMapId, api.view.mapData, tilesets[api.view.mapData.tilesetId]);
    }
}
