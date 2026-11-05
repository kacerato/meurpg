// Leitura dos comandos de plugin (@command/@arg) a partir dos comentários dos arquivos em js/plugins/.
// Parse básico do bloco /*: ... */ (inglês) igual ao que o editor MZ usa para "Plugin Command".

let cache = null;

function parseBlock(text) {
    const info = { target: "", desc: "", commands: [], structs: {} };
    const lines = text.split(/\r?\n/).map(l => l.replace(/^\s*\*\s?/, ""));
    let cmd = null, arg = null, opt = null;
    for (const line of lines) {
        const m = /^@(\w+)\s*(.*)$/.exec(line.trim());
        if (!m) { continue; }
        const [, tag, raw] = m;
        const val = raw.trim();
        switch (tag) {
            case "target": info.target = val; break;
            case "plugindesc": info.desc = val; break;
            case "command": cmd = { name: val, text: val, desc: "", args: [] }; info.commands.push(cmd); arg = null; break;
            case "arg":
                if (cmd) { arg = { name: val, text: val, desc: "", type: "string", default: "", options: [] }; cmd.args.push(arg); opt = null; }
                break;
            case "param": cmd = null; arg = null; break;
            case "text": if (arg) { arg.text = val; } else if (cmd) { cmd.text = val; } break;
            case "desc": if (arg) { arg.desc = val; } else if (cmd) { cmd.desc = val; } break;
            case "type": if (arg) { arg.type = val; } break;
            case "default": if (arg) { arg.default = val; } break;
            case "min": if (arg) { arg.min = Number(val); } break;
            case "max": if (arg) { arg.max = Number(val); } break;
            case "decimals": if (arg) { arg.decimals = Number(val); } break;
            case "on": if (arg) { arg.on = val; } break;
            case "off": if (arg) { arg.off = val; } break;
            case "dir": if (arg) { arg.dir = val; } break;
            case "option": if (arg) { opt = { label: val, value: val }; arg.options.push(opt); } break;
            case "value": if (opt) { opt.value = val; } break;
        }
    }
    return info;
}

export async function loadPluginCommands(api) {
    if (cache) { return cache; }
    const files = (await api.project.list("js/plugins")).filter(e => !e.dir && /\.js$/i.test(e.name));
    const out = [];
    for (const f of files) {
        const name = f.name.replace(/\.js$/i, "");
        try {
            const res = await fetch("/api/file?path=" + encodeURIComponent("js/plugins/" + f.name));
            const src = await res.text();
            // Bloco principal em inglês: "/*:" (não "/*:ja" etc.)
            const m = /\/\*:(?![a-z]{2}\b)([\s\S]*?)\*\//.exec(src);
            if (!m) { continue; }
            const info = parseBlock(m[1]);
            info.name = name;
            if (info.commands.length) { out.push(info); }
        } catch (e) {
            console.warn("events: plugin", f.name, e);
        }
    }
    cache = out.sort((a, b) => a.name.localeCompare(b.name));
    return cache;
}

export function resetPluginCache() { cache = null; }
