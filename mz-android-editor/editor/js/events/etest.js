// "Test" da lista de comandos: executa os comandos selecionados no jogo, como o editor do PC.
// O runtime (rmmz_managers.js) com ?etest carrega data/Test_*.json + data/Test_Event.json
// (DataManager.loadDatabase) e Scene_Boot chama DataManager.setupEventTest(): mapa vazio (-1),
// grupo inicial; Game_Map.setupStartingEvent roda $testEvent no interpretador.

import { clone } from "./data.js";

const DB_FILES = ["Actors", "Classes", "Skills", "Items", "Weapons", "Armors", "Enemies", "Troops",
    "States", "Animations", "Tilesets", "CommonEvents", "System", "MapInfos"];

let cleanupObserver = null;

export async function runEventTest(api, cmds) {
    if (!cmds || !cmds.length) { return; }
    const base = Math.min(...cmds.map(c => c.indent));
    const list = cmds.map(c => ({ ...clone(c), indent: c.indent - base }));
    const last = list[list.length - 1];
    if (!(last && last.code === 0 && last.indent === 0)) { list.push({ code: 0, indent: 0, parameters: [] }); }
    api.status("Preparando teste do evento…");
    const written = [];
    for (const f of DB_FILES) {
        const data = await api.project.readJson("data/" + f + ".json", { fresh: true });
        await api.project.writeJson("data/Test_" + f + ".json", data);
        written.push("data/Test_" + f + ".json");
    }
    await api.project.writeJson("data/Test_Event.json", list);
    written.push("data/Test_Event.json");
    api.status("");
    const overlay = document.getElementById("playOverlay");
    const frame = document.getElementById("playFrame");
    frame.src = "/project/index.html?etest";
    overlay.hidden = false;
    frame.focus();
    // Ao fechar o teste, remove os arquivos temporários (o editor do PC também não os mantém).
    if (cleanupObserver) { cleanupObserver.disconnect(); }
    cleanupObserver = new MutationObserver(() => {
        if (!overlay.hidden) { return; }
        cleanupObserver.disconnect();
        cleanupObserver = null;
        if (api.project.delete) {
            for (const p of written) { api.project.delete(p).catch(() => {}); }
        }
    });
    cleanupObserver.observe(overlay, { attributes: true, attributeFilter: ["hidden"] });
}
