// Registro dos módulos do editor. Cada módulo vive em editor/js/<nome>/index.js e exporta
// `register(api)`. Para ligar um módulo novo, adicione UMA linha na lista abaixo.
// Ordem importa: events antes de database (o banco usa api.events.editCommandList).

export const MODULES = [
    "./maptools/index.js",
    "./events/index.js",
    "./database/index.js",
    "./plugins/index.js",
    "./generator/index.js",
];

export async function loadModules(api) {
    // Desenvolvimento: ?modules=./database/index.js,./events/index.js liga módulos sem editar este arquivo;
    // ?modules=none desliga todos.
    const q = new URLSearchParams(location.search).get("modules");
    const extra = (q || "").split(",").map(s => s.trim()).filter(Boolean);
    const list = q === "none" ? [] : (extra.length ? extra : MODULES);
    for (const path of list) {
        try {
            const mod = await import(path);
            await mod.register(api);
        } catch (e) {
            console.error("módulo falhou:", path, e);
        }
    }
}
