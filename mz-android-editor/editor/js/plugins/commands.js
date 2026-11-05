// API pública de Plugin Commands (@command/@arg) para outros módulos (ex.: eventos,
// comando "Plugin Command", código 357).
//
//   import { getPluginCommands, editPluginCommandArgs } from "../plugins/commands.js";
//   const cmds = await getPluginCommands("PictureAnimation");
//   // [{ name, text, desc, args: [{name, text, desc, type, default, min, max, ...}], structs }]
//
// No MZ o comando 357 grava parameters = [pluginName, commandName, commandText, args], onde
// args é um objeto {nomeDoArg: "valor string"} (structs/arrays como JSON string).

import { getPluginInfo, loadPluginList } from "./store.js";
import { defaultsOf } from "./parser.js";

// Lista os comandos do plugin. `structs` (definições ~struct~ do arquivo) vai em cada comando
// para que quem chama possa editar argumentos do tipo struct<...>.
export async function getPluginCommands(pluginName, { fresh = false } = {}) {
    const info = await getPluginInfo(pluginName, { fresh });
    return info.commands.map(c => ({
        name: c.name,
        text: c.text || c.name,
        desc: c.desc || "",
        args: c.args.map(a => ({ ...a, options: a.options.slice() })),
        structs: info.structs
    }));
}

// Plugins ativos (status ON), na ordem do Plugin Manager, que têm pelo menos um comando —
// é a lista "Plugin Name" do diálogo Plugin Command do MZ.
export async function getEnabledPluginsWithCommands() {
    const list = await loadPluginList();
    const out = [];
    for (const p of list) {
        if (!p.status) {
            continue;
        }
        const info = await getPluginInfo(p.name);
        if (info.commands.length) {
            out.push({ name: p.name, description: p.description, commands: await getPluginCommands(p.name) });
        }
    }
    return out;
}

// Argumentos iniciais de um comando (valores @default, como strings).
export function defaultArgs(command) {
    return defaultsOf(command.args || []);
}

// Abre o editor de argumentos (mesmos editores por tipo do Plugin Manager).
// Devolve Promise<objeto de args | null (cancelado)>.
export async function editPluginCommandArgs(api, pluginName, commandName, args) {
    const cmds = await getPluginCommands(pluginName);
    const cmd = cmds.find(c => c.name === commandName);
    if (!cmd) {
        return null;
    }
    const { editParamSet } = await import("./params.js");
    const values = { ...defaultArgs(cmd), ...(args || {}) };
    return editParamSet(api, {
        title: `${pluginName} : ${cmd.text}`,
        defs: cmd.args,
        values,
        structs: cmd.structs,
        desc: cmd.desc
    });
}
