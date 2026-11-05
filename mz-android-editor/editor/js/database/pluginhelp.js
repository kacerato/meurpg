// "Plugin Help..." do campo Note: mostra o @help dos plugins ATIVOS (js/plugins.js) e lista as
// tags de nota <...> encontradas, com botão para inserir no Note. Usa o parser do módulo plugins.
import { el, btn, modal, changed } from "./ui.js";
import { parsePlugin } from "../plugins/parser.js";
import { loadPluginList } from "../plugins/store.js";

async function activePluginsHelp() {
    const list = await loadPluginList().catch(() => []);
    const out = [];
    for (const p of list) {
        if (!p || !p.status) { continue; }
        const res = await fetch("/project/js/plugins/" + encodeURIComponent(p.name) + ".js", { cache: "no-store" }).catch(() => null);
        const text = res && res.ok ? await res.text() : "";
        const info = parsePlugin(text, p.name);
        out.push({ name: p.name, desc: info.plugindesc || "", help: info.help || "", tags: noteTags(info.help || "") });
    }
    return out;
}

// Tags de nota citadas no texto de ajuda: <Nome>, <Nome:valor>, <Nome: x y> ...
export function noteTags(help) {
    const tags = new Set();
    for (const m of help.matchAll(/<[A-Za-z_\u00C0-\uFFFF][^<>\n]{0,80}>/g)) {
        if (!/^<\/?(br|b|i|p|span|div)\b/i.test(m[0])) { tags.add(m[0]); }
    }
    return [...tags];
}

// textarea: o campo Note (para inserir a tag na posição do cursor). obj/key: dado ligado.
export async function openPluginHelp(obj, key, textarea) {
    const plugins = await activePluginsHelp();
    let cur = plugins.findIndex(p => p.tags.length);
    if (cur < 0) { cur = 0; }
    const insert = tag => {
        const t = textarea;
        const v = obj[key] || "";
        const a = t ? t.selectionStart ?? v.length : v.length;
        const b = t ? t.selectionEnd ?? v.length : v.length;
        const sep = a > 0 && v[a - 1] !== "\n" ? "\n" : "";
        obj[key] = v.slice(0, a) + sep + tag + v.slice(b);
        if (t) { t.value = obj[key]; }
        changed();
    };
    await modal({
        title: "Plugin Help", width: "900px", height: "560px", okLabel: "Close", cancelLabel: null,
        build: b => {
            b.classList.add("dbPickBody");
            const list = el("div", { class: "dbPickList" });
            const right = el("div", { class: "dbPickRight dbHelpRight" });
            const show = i => {
                cur = i;
                [...list.children].forEach((r, j) => r.classList.toggle("sel", j === i));
                right.innerHTML = "";
                const p = plugins[i];
                if (!p) { right.appendChild(el("div", { class: "dbHint", text: "Nenhum plugin ativo." })); return; }
                right.appendChild(el("div", { class: "dbHelpTitle", text: p.name + (p.desc ? " — " + p.desc : "") }));
                if (p.tags.length) {
                    const tags = el("div", { class: "dbHelpTags" });
                    for (const tag of p.tags) {
                        tags.appendChild(el("div", { class: "dbHelpTag" }, el("code", { text: tag }),
                            btn("Insert", () => insert(tag), "small")));
                    }
                    right.appendChild(tags);
                }
                right.appendChild(el("pre", { class: "dbHelpText", text: p.help || "(sem @help)" }));
            };
            plugins.forEach((p, i) => {
                const r = el("div", { class: "dbPickItem", text: p.name + (p.tags.length ? ` (${p.tags.length})` : "") });
                r.addEventListener("click", () => show(i));
                list.appendChild(r);
            });
            b.append(list, right);
            show(cur);
        }
    });
}
