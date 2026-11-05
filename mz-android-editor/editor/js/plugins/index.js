// Módulo plugins: Gerenciador de plugins do RPG Maker MZ (botão btnPlugins).

import { openPluginManager } from "./manager.js";
import { getPluginCommands, getEnabledPluginsWithCommands, editPluginCommandArgs, defaultArgs } from "./commands.js";
import { getPluginInfo, loadPluginList } from "./store.js";

function injectCss() {
    if (document.getElementById("pluginsCss")) {
        return;
    }
    const link = document.createElement("link");
    link.id = "pluginsCss";
    link.rel = "stylesheet";
    link.href = new URL("../../css/plugins.css", import.meta.url).href;
    document.head.appendChild(link);
}

export async function register(api) {
    injectCss();
    // Acesso em tempo de execução para outros módulos (sem import estático).
    api.plugins = {
        open: () => openPluginManager(api),
        list: loadPluginList,
        info: getPluginInfo,
        getPluginCommands,
        getEnabledPluginsWithCommands,
        defaultArgs,
        editCommandArgs: (pluginName, commandName, args) => editPluginCommandArgs(api, pluginName, commandName, args)
    };
    api.bindToolbar("btnPlugins", () => openPluginManager(api), "Gerenciador de plugins");
}
