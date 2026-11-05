// Conversão de dados do RPG Maker MV (MZ: "MV Data Conversion", manual 01_01_01_02).
//
// O que o MZ converte (unidade QML compilada Singletons/DataConverter.qml dentro do RPG.exe, chamada por
// DataManager.convertDatabase ao carregar o banco — ver NOTES.md):
//   convertSystem(system)  completa o System.json com o modelo de System novo (JsonTemplates.newSystem),
//                          inclusive `advanced` com `gameId` único (CommonUtils.generateUniqueId), e
//                          completa terms.messages (convertSystemTerms / NewDataMaker.systemMessages);
//   convertSkills(skills)  mensagens de uso do MV (" casts %1!") → MZ ("%1 casts %2!") e messageType;
//   convertStates(states)  mensagens de estado do MV (" is poisoned!") → MZ ("%1 is poisoned!") e messageType.
// Animações do MV (com `frames`) NÃO são convertidas: o runtime do MZ as reproduz (Sprite_AnimationMV) e o
// manual as dá como "não recomendadas" porque não podem ser editadas no MZ. O restante (mapas, tilesets,
// atores...) tem o mesmo formato nas duas versões.
//
// O MZ converte em silêncio e marca o banco como modificado; aqui o editor pergunta antes (o projeto pode
// estar sendo aberto só para leitura no aparelho) e a conversão entra no "Salvar projeto" (api.markDirty).
//
// API: api.mvconvert = { detect(), convert(report?), check() }.
import { t } from "../i18n.js";

let API = null;
const TEMPLATE_SYSTEM = new URL("../../template/data/System.json", import.meta.url).href;

export function register(api) {
    API = api;
    if (!document.getElementById("mvconvertCss")) {
        const link = document.createElement("link");
        link.id = "mvconvertCss";
        link.rel = "stylesheet";
        link.href = new URL("../../css/mvconvert.css", import.meta.url).href;
        document.head.appendChild(link);
    }
    api.mvconvert = { detect: () => detect(api.project), convert: r => convert(api, r), check: () => check(api) };
    if (api.project) {
        // depois do boot (mapa e árvore carregados), como o MZ faz após abrir o projeto
        setTimeout(() => { check(api).catch(e => console.error("mvconvert", e)); }, 300);
    }
    api.on("project:opened", () => { check(api).catch(e => console.error("mvconvert", e)); });
}

// ------------------------------------------------------------------ detecção

async function tryJson(project, path) {
    try { return await project.readJson(path); } catch (e) { return null; }
}
async function listNames(project, dir) {
    try { return (await project.list(dir) || []).filter(e => !e.dir).map(e => e.name); } catch (e) { return []; }
}
async function pngSize(path) {
    try {
        const res = await fetch("/project/" + path, { cache: "no-store" });
        if (!res.ok) { return null; }
        const b = new DataView(await res.arrayBuffer());
        return { w: b.getUint32(16), h: b.getUint32(20) };
    } catch (e) { return null; }
}
const isMvMessages = list => (list || []).some(o => o && o.messageType === undefined);

// Devolve { mv: bool, convertible: bool, system, skills, states, animations, scripts, images, fonts, plugins }.
export async function detect(project) {
    const r = { mv: false, convertible: false, system: false, skills: 0, states: 0, animations: 0,
        scripts: [], images: [], fonts: [], plugins: [] };
    if (!project) { return r; }
    const [system, skills, states, animations] = await Promise.all(["System", "Skills", "States", "Animations"]
        .map(f => tryJson(project, `data/${f}.json`)));
    if (system && !system.advanced) { r.system = true; }
    if (isMvMessages(skills)) { r.skills = skills.filter(o => o && o.messageType === undefined).length; }
    if (isMvMessages(states)) { r.states = states.filter(o => o && o.messageType === undefined).length; }
    r.animations = (animations || []).filter(a => a && Array.isArray(a.frames)).length;
    const js = await listNames(project, "js");
    r.scripts = js.filter(n => /^rpg_\w+\.js$/i.test(n));
    const sys = await listNames(project, "img/system");
    // MV: o manual manda NÃO copiar estes (o MZ tem outros ou não usa)
    r.images = sys.filter(n => /^(Damage|Loading|MadeWithMv)\.png$/i.test(n));
    if (sys.some(n => /^ButtonSet\.png$/i.test(n))) {
        const s = await pngSize("img/system/ButtonSet.png");
        if (s && s.w !== 528) { r.images.push("ButtonSet.png"); }   // MV 240×48, MZ 528×96
    }
    const fonts = await listNames(project, "fonts");
    r.fonts = fonts.filter(n => /^gamefont\.css$/i.test(n));
    // plugins do MV: sem "@target MZ" no cabeçalho (o Gerenciador de plugins do MZ mostra um aviso)
    const pl = await listNames(project, "js/plugins");
    for (const n of pl.filter(n => /\.js$/i.test(n)).slice(0, 200)) {
        try {
            const res = await fetch("/project/js/plugins/" + encodeURIComponent(n), { cache: "no-store" });
            const head = (await res.text()).slice(0, 4000);
            if (/\/\*:/.test(head) && !/@target\s+MZ/i.test(head)) { r.plugins.push(n); }
        } catch (e) { /* ignora */ }
    }
    r.convertible = r.system || r.skills > 0 || r.states > 0;
    r.mv = r.convertible || r.animations > 0 || r.scripts.length > 0 || r.images.length > 0 || r.fonts.length > 0;
    return r;
}

// ------------------------------------------------------------------ conversão (DataConverter)

// CommonUtils.generateUniqueId: id numérico de 8 dígitos (como os gameId dos projetos do MZ).
export function generateUniqueId() {
    return 10000000 + Math.floor(Math.random() * 90000000);
}

// Completa `data` com as chaves que faltam em relação a `template` (recursivo em objetos; arrays e
// valores existentes nunca são alterados).
export function fillMissing(data, template) {
    if (!data || typeof data !== "object" || Array.isArray(data) || !template || typeof template !== "object") { return data; }
    for (const key of Object.keys(template)) {
        const tv = template[key];
        if (!(key in data) || data[key] === undefined) {
            data[key] = structuredClone(tv);
        } else if (tv && typeof tv === "object" && !Array.isArray(tv) && data[key] && typeof data[key] === "object") {
            fillMissing(data[key], tv);
        }
    }
    return data;
}

export function convertSystem(system, template) {
    const hadAdvanced = !!system.advanced;
    fillMissing(system, template);
    if (!hadAdvanced) {
        system.advanced = structuredClone(template.advanced);
        system.advanced.gameId = generateUniqueId();
    }
    // convertSystemTerms: mensagens novas do MZ (autosave, touchUI...) com o texto padrão
    system.terms = system.terms || {};
    system.terms.messages = system.terms.messages || {};
    for (const [k, v] of Object.entries((template.terms || {}).messages || {})) {
        if (!(k in system.terms.messages)) { system.terms.messages[k] = v; }
    }
    return system;
}

// MV: Window_BattleLog escreve subject.name() + message1.format(item.name).
// MZ: message1.format(subject.name(), item.name). Logo " casts %1!" → "%1 casts %2!".
export function convertBattleMessage(object, key) {
    const m = object[key];
    if (typeof m === "string" && m !== "") {
        object[key] = "%1" + m.replace("%1", "%2");
    }
}

export function convertSkills(skills) {
    let n = 0;
    for (const skill of skills || []) {
        if (!skill || skill.messageType !== undefined) { continue; }
        convertBattleMessage(skill, "message1");
        convertBattleMessage(skill, "message2");
        skill.messageType = 1;
        n++;
    }
    return n;
}

// MV: target.name() + state.messageN.  MZ: state.messageN.format(target.name()).
export function convertStates(states) {
    let n = 0;
    for (const state of states || []) {
        if (!state || state.messageType !== undefined) { continue; }
        for (const k of ["message1", "message2", "message3", "message4"]) { convertBattleMessage(state, k); }
        state.messageType = 1;
        n++;
    }
    return n;
}

// Aplica a conversão na memória e marca os arquivos para o próximo "Salvar projeto".
export async function convert(api, report) {
    const project = api.project;
    const r = report || await detect(project);
    const files = [];
    if (r.system) {
        const res = await fetch(TEMPLATE_SYSTEM);
        const template = await res.json();
        const system = await project.readJson("data/System.json");
        convertSystem(system, template);
        api.markDirty("data/System.json", system);
        files.push("data/System.json");
    }
    if (r.skills) {
        const skills = await project.readJson("data/Skills.json");
        if (convertSkills(skills)) { api.markDirty("data/Skills.json", skills); files.push("data/Skills.json"); }
    }
    if (r.states) {
        const states = await project.readJson("data/States.json");
        if (convertStates(states)) { api.markDirty("data/States.json", states); files.push("data/States.json"); }
    }
    for (const f of files) { api.emit("db:changed", { file: f }); }
    return files;
}

// ------------------------------------------------------------------ interface

let checking = false;
const SKIP_KEY = "mzEditor.mvconvert.skip";

export async function check(api) {
    if (checking || !api.project) { return null; }
    checking = true;
    try {
        const r = await detect(api.project);
        if (!r.mv) { return r; }
        const name = api.project.name || "";
        let skipped = [];
        try { skipped = JSON.parse(sessionStorage.getItem(SKIP_KEY) || "[]"); } catch (e) { skipped = []; }
        if (skipped.includes(name)) { return r; }
        if (!r.convertible) {
            // nada a converter (o MZ também não diz nada): só um aviso na barra de status
            api.status(t("This project contains files from RPG Maker MV."));
            return r;
        }
        await ask(api, r, () => {
            try { sessionStorage.setItem(SKIP_KEY, JSON.stringify([...skipped, name])); } catch (e) { /* sem storage */ }
        });
        return r;
    } finally {
        checking = false;
    }
}

function li(text) { const e = document.createElement("li"); e.textContent = text; return e; }

function ask(api, r, onSkip) {
    return new Promise(resolve => {
        let answered = false;
        const buttons = r.convertible
            ? [{ label: t("Convert"), primary: true, onClick: () => {
                answered = true;
                convert(api, r).then(files => {
                    api.status(t("MV data converted: %1. Save the project to keep the changes.", null, files.map(f => f.replace(/^data\//, "")).join(", ")));
                    resolve(files);
                }).catch(e => { console.error(e); api.status(String(e.message || e)); resolve(null); });
            } },
            { label: t("Cancel", "BasicConstants"), onClick: () => { answered = true; onSkip(); resolve(null); } }]
            : [{ label: t("OK", "BasicConstants"), primary: true, onClick: () => { answered = true; onSkip(); resolve(null); } }];
        const dlg = api.openDialog({ title: "RPG Maker MZ", width: "560px", height: "auto", buttons });
        dlg.root.classList.add("mvcRoot");
        const body = dlg.body;
        body.classList.add("mvcBody");
        const p = document.createElement("p");
        p.textContent = r.convertible
            ? t("This project contains data in the RPG Maker MV format. Convert it to the RPG Maker MZ format?")
            : t("This project contains files from RPG Maker MV.");
        body.append(p);
        const conv = document.createElement("ul");
        if (r.system) { conv.append(li(t("System: add the RPG Maker MZ settings (Advanced Settings, game ID, new terms).") )); }
        if (r.skills) { conv.append(li(t("Skills: convert the battle messages of %1 skills to the RPG Maker MZ format.", null, r.skills))); }
        if (r.states) { conv.append(li(t("States: convert the messages of %1 states to the RPG Maker MZ format.", null, r.states))); }
        if (conv.children.length) { body.append(conv); }
        const warn = document.createElement("ul");
        warn.className = "mvcWarn";
        if (r.animations) { warn.append(li(t("Animations: %1 MV animations are kept as they are (they play in the game but cannot be edited in RPG Maker MZ).", null, r.animations))); }
        if (r.scripts.length) { warn.append(li(t("js: MV core scripts found (%1); the game uses rmmz_*.js.", null, r.scripts.join(", ")))); }
        if (r.images.length) { warn.append(li(t("img/system: %1 are MV images and are not needed.", null, r.images.join(", ")))); }
        if (r.fonts.length) { warn.append(li(t("fonts: gamefont.css is not used; choose the fonts in Database → System 2 → Advanced Settings."))); }
        if (r.plugins.length) { warn.append(li(t("Plugins for RPG Maker MV (%1) are not guaranteed to work.", null, r.plugins.length))); }
        if (warn.children.length) { body.append(warn); }
        const note = document.createElement("p");
        note.className = "mvcNote";
        note.textContent = t("Make a backup of the project before saving.");
        if (r.convertible) { body.append(note); }
        dlg.onClose = () => { if (!answered) { onSkip(); resolve(null); } };
    });
}
