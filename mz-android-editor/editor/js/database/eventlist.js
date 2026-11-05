// Lista de comandos de evento ("Contents") usada em Troops e Common Events.
// A edição dos comandos pertence ao módulo "events": se ele expuser
// api.events.editCommandList(list, opts) (ou api.editCommandList), usamos; senão, só leitura.
import { el, btn, getApi, changed, alertBox } from "./ui.js";

const NAMES = {
    101: "Text", 102: "Show Choices", 402: "When", 403: "When Cancel", 404: "End", 103: "Input Number",
    104: "Select Item", 105: "Text (S)", 108: "Comment", 109: "Skip", 111: "If", 411: "Else", 412: "End", 112: "Loop",
    413: "Repeat Above", 113: "Break Loop", 115: "Exit Event Processing", 117: "Common Event", 118: "Label",
    119: "Jump to Label", 121: "Control Switches", 122: "Control Variables", 123: "Control Self Switch",
    124: "Control Timer", 125: "Change Gold", 126: "Change Items", 127: "Change Weapons", 128: "Change Armors",
    129: "Change Party Member", 132: "Change Battle BGM", 133: "Change Victory ME", 134: "Change Save Access",
    135: "Change Menu Access", 136: "Change Encounter", 137: "Change Formation Access", 138: "Change Window Color",
    139: "Change Defeat ME", 140: "Change Vehicle BGM", 201: "Transfer Player", 202: "Set Vehicle Location",
    203: "Set Event Location", 204: "Scroll Map", 205: "Set Movement Route", 206: "Get on/off Vehicle",
    211: "Change Transparency", 212: "Show Animation", 213: "Show Balloon Icon", 214: "Erase Event",
    216: "Change Player Followers", 217: "Gather Followers", 221: "Fadeout Screen", 222: "Fadein Screen",
    223: "Tint Screen", 224: "Flash Screen", 225: "Shake Screen", 230: "Wait", 231: "Show Picture",
    232: "Move Picture", 233: "Rotate Picture", 234: "Tint Picture", 235: "Erase Picture", 236: "Set Weather Effect",
    241: "Play BGM", 242: "Fadeout BGM", 243: "Save BGM", 244: "Resume BGM", 245: "Play BGS", 246: "Fadeout BGS",
    249: "Play ME", 250: "Play SE", 251: "Stop SE", 261: "Play Movie", 281: "Change Map Name Display",
    282: "Change Tileset", 283: "Change Battle Background", 284: "Change Parallax", 285: "Get Location Info",
    301: "Battle Processing", 601: "If Win", 602: "If Escape", 603: "If Lose", 604: "End", 302: "Shop Processing",
    303: "Name Input Processing", 311: "Change HP", 312: "Change MP", 326: "Change TP", 313: "Change State",
    314: "Recover All", 315: "Change EXP", 316: "Change Level", 317: "Change Parameter", 318: "Change Skill",
    319: "Change Equipment", 320: "Change Name", 321: "Change Class", 322: "Change Actor Images",
    323: "Change Vehicle Image", 324: "Change Nickname", 325: "Change Profile", 331: "Change Enemy HP",
    332: "Change Enemy MP", 342: "Change Enemy TP", 333: "Change Enemy State", 334: "Enemy Recover All",
    335: "Enemy Appear", 336: "Enemy Transform", 337: "Show Battle Animation", 339: "Force Action",
    340: "Abort Battle", 351: "Open Menu Screen", 352: "Open Save Screen", 353: "Game Over",
    354: "Return to Title Screen", 355: "Script", 356: "Plugin Command", 357: "Plugin Command"
};
const CONT = { 401: "", 405: "", 408: "", 655: "", 657: "", 605: "", 505: "" };

function brief(p) {
    return (p || []).map(v => typeof v === "object" && v !== null ? (v.name !== undefined ? v.name : "…") : String(v)).join(", ");
}

export function commandText(c) {
    if (c.code === 0) { return "◆"; }
    if (c.code in CONT) {
        const t = typeof c.parameters[0] === "string" ? c.parameters[0] : brief(c.parameters);
        return "　：" + (c.code === 505 ? "◇" + ((c.parameters[0] && c.parameters[0].code) ?? "") : t);
    }
    const name = NAMES[c.code] || "Code " + c.code;
    let arg = "";
    switch (c.code) {
        case 101: arg = c.parameters[0] ? `${c.parameters[0]}(${c.parameters[1]})` : "None"; break;
        case 102: arg = (c.parameters[0] || []).join(", "); break;
        case 402: arg = c.parameters[1]; break;
        case 108: case 355: arg = c.parameters[0]; break;
        case 357: arg = `${c.parameters[0]}, ${c.parameters[2] || c.parameters[1]}`; break;
        case 404: case 412: case 604: case 411: case 403: case 601: case 602: case 603: case 413: case 113: case 115: arg = ""; break;
        default: arg = brief(c.parameters);
    }
    if (c.code === 404 || c.code === 412 || c.code === 604) { return ":" + name; }
    if ([402, 403, 411, 601, 602, 603].includes(c.code)) { return ":" + name + (arg ? " " + arg : ""); }
    return "◆" + name + (arg !== "" ? "：" + arg : "");
}

function findEditor() {
    const api = getApi();
    if (api.events && typeof api.events.editCommandList === "function") { return api.events.editCommandList.bind(api.events); }
    if (typeof api.editCommandList === "function") { return api.editCommandList.bind(api); }
    return null;
}

// owner[key] é a lista de comandos. opts: {context, troopId, commonEventId, title}
export function commandList(owner, key, opts = {}) {
    const wrap = el("div", { class: "dbCmdWrap" });
    const listEl = el("div", { class: "dbCmdList" });
    const render = () => {
        listEl.innerHTML = "";
        for (const c of owner[key] || []) {
            const r = el("div", { class: "dbCmd", text: commandText(c) });
            r.style.paddingLeft = (8 + (c.indent || 0) * 20) + "px";
            listEl.appendChild(r);
        }
    };
    const edit = async () => {
        const ed = findEditor();
        if (!ed) {
            alertBox("O editor de comandos de evento (módulo \"events\") não está carregado. A lista é exibida somente para leitura.", "Contents");
            return;
        }
        const r = await ed(structuredClone(owner[key]), opts);
        if (Array.isArray(r)) { owner[key] = r; changed(); render(); }
    };
    listEl.addEventListener("dblclick", edit);
    wrap.append(el("div", { class: "dbRow" }, btn("Edit Contents...", edit, "small"),
        findEditor() ? null : el("span", { class: "dbHint", text: "(somente leitura: módulo events não carregado)" })), listEl);
    render();
    wrap.refresh = render;
    return wrap;
}
