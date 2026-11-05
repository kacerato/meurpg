// Registro dos módulos do editor. Cada módulo vive em editor/js/<nome>/index.js e exporta
// `register(api)`. Para ligar um módulo novo, adicione UMA linha na lista abaixo.
// (As sessões paralelas entregam o módulo; a integração aqui é feita pela sessão principal.)

export const MODULES = [
    // "./database/index.js",
    // "./events/index.js",
    // "./maptools/index.js",
    // "./plugins/index.js",
    // "./generator/index.js",
];

export async function loadModules(api) {
    // Desenvolvimento: ?modules=./database/index.js,./events/index.js liga módulos sem editar este arquivo.
    const extra = (new URLSearchParams(location.search).get("modules") || "")
        .split(",").map(s => s.trim()).filter(Boolean);
    for (const path of [...MODULES, ...extra]) {
        try {
            const mod = await import(path);
            await mod.register(api);
        } catch (e) {
            console.error("módulo falhou:", path, e);
        }
    }
}
