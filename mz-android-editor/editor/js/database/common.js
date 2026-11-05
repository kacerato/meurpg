// Constantes e listas de opções compartilhadas entre as abas (rótulos do editor MZ, traduzidos por t()).
import { pad } from "./ui.js";
import { t } from "../i18n.js";

export const PARAMS = [t("Max HP", "Constants"), t("Max MP", "Constants"), t("Attack", "Constants"), t("Defense", "Constants"),
    t("M.Attack", "Constants"), t("M.Defense", "Constants"), t("Agility", "Constants"), t("Luck", "Constants")];
export const XPARAMS = [t("Hit Rate", "Constants"), t("Evasion Rate", "Constants"), t("Critical Rate", "Constants"),
    t("Critical Evasion", "Constants"), t("Magic Evasion", "Constants"), t("Magic Reflection", "Constants"),
    t("Counter Attack", "Constants"), t("HP Regeneration", "Constants"), t("MP Regeneration", "Constants"), t("TP Regeneration", "Constants")];
export const SPARAMS = [t("Target Rate", "Constants"), t("Guard Effect", "Constants"), t("Recovery Effect", "Constants"),
    t("Pharmacology", "Constants"), t("MP Cost Rate", "Constants"), t("TP Charge Rate", "Constants"),
    t("Physical Damage", "Constants"), t("Magic Damage", "Constants"), t("Floor Damage", "Constants"), t("Experience", "Constants")];
export const SPECIAL_FLAGS = [t("Auto Battle", "Constants"), t("Guard", "Constants"), t("Substitute", "Constants"), t("Preserve TP", "Constants")];
export const COLLAPSE = [t("Normal", "Constants"), t("Boss", "Constants"), t("Instant", "Constants"), t("No Disappear", "Constants")];
export const PARTY_ABILITY = [t("Encounter Half", "Constants"), t("Encounter None", "Constants"), t("Cancel Surprise", "Constants"),
    t("Raise Preemptive", "Constants"), t("Gold Double", "Constants"), t("Drop Item Double", "Constants")];
export const OCCASIONS = [[0, t("Always", "Constants")], [1, t("Battle Screen", "Constants")], [2, t("Menu Screen", "Constants")], [3, t("Never", "Constants")]];
export const HIT_TYPES = [[0, t("Certain Hit", "Group_Invocation")], [1, t("Physical Attack", "Group_Invocation")], [2, t("Magical Attack", "Group_Invocation")]];
export const DAMAGE_TYPES = [[0, t("None", "Constants")], [1, t("HP Damage", "Group_Damage")], [2, t("MP Damage", "Group_Damage")],
    [3, t("HP Recover", "Group_Damage")], [4, t("MP Recover", "Group_Damage")], [5, t("HP Drain", "Group_Damage")], [6, t("MP Drain", "Group_Damage")]];
export const ITEM_TYPES = [[1, t("Regular Item", "Constants")], [2, t("Key Item", "Constants")], [3, t("Hidden Item A", "Constants")], [4, t("Hidden Item B", "Constants")]];
export const RESTRICTIONS = [[0, t("None", "Constants")], [1, t("Attack an enemy", "Edit_States")], [2, t("Attack anyone", "Edit_States")],
    [3, t("Attack an ally", "Edit_States")], [4, t("Cannot move", "Edit_States")]];
export const SV_MOTIONS = [[0, t("Normal", "Edit_States")], [1, t("Abnormal", "Edit_States")], [2, t("Sleep", "Edit_States")], [3, t("Dead", "Edit_States")]];
export const SV_OVERLAYS = [[0, t("None", "Constants")], [1, t("Poison", "Edit_States")], [2, t("Blind", "Edit_States")], [3, t("Silence", "Edit_States")],
    [4, t("Rage", "Edit_States")], [5, t("Confusion", "Edit_States")], [6, t("Charm", "Edit_States")], [7, t("Sleep", "Edit_States")],
    [8, t("Paralysis", "Edit_States")], [9, t("Curse", "Edit_States")], [10, t("Fear", "Edit_States")]];
export const AUTO_REMOVAL = [[0, t("None", "Constants")], [1, t("Action End", "Edit_States")], [2, t("Turn End", "Edit_States")]];

export const FILES = ["Actors", "Classes", "Skills", "Items", "Weapons", "Armors", "Enemies", "Troops",
    "States", "Animations", "Tilesets", "CommonEvents", "System"];

// Opções "0001 Nome" a partir de um array do banco (índice 0 = null).
export function idOptions(arr, none) {
    const out = none !== undefined && none !== false ? [[0, none]] : [];
    for (let i = 1; i < (arr || []).length; i++) {
        out.push([i, pad(i) + " " + (arr[i] ? arr[i].name || "" : "")]);
    }
    return out;
}

// Opções a partir de uma lista de tipos do System (elements, skillTypes ...), índice 0 vazio.
export function typeOptions(list, none) {
    const out = none !== undefined && none !== false ? [[0, none]] : [];
    for (let i = 1; i < (list || []).length; i++) {
        out.push([i, pad(i, 2) + " " + (list[i] || "")]);
    }
    return out;
}

export function nameOf(arr, id, none = t("None", "Constants")) {
    if (!id) { return none; }
    const o = arr && arr[id];
    return o ? o.name || "" : "?" + id;
}

export function switchOptions(sys) {
    const out = [];
    for (let i = 1; i < Math.max(sys.switches.length, 2); i++) { out.push([i, pad(i) + " " + (sys.switches[i] || "")]); }
    return out;
}

// --------------------------------------------------------------------- Escopo (MZ: Faction / Number / Status)
// Códigos do runtime (Game_Action): 0 none; 1 1 enemy; 2 all enemies; 3-6 random 1-4 enemies;
// 7 1 ally; 8 all allies; 9 1 ally (dead); 10 all allies (dead); 11 user; 12 1 ally (unconditional);
// 13 all allies (unconditional); 14 enemies & allies.
export function decodeScope(s) {
    if (s >= 1 && s <= 6) { return { faction: 1, number: s === 1 ? 0 : s === 2 ? 1 : 2, random: s >= 3 ? s - 2 : 1, status: 0 }; }
    if (s >= 7 && s <= 13 && s !== 11) {
        const number = [7, 9, 12].includes(s) ? 0 : 1;
        const status = s <= 8 ? 0 : s <= 10 ? 1 : 2;
        return { faction: 2, number, random: 1, status };
    }
    if (s === 14) { return { faction: 3, number: 1, random: 1, status: 0 }; }
    if (s === 11) { return { faction: 4, number: 0, random: 1, status: 0 }; }
    return { faction: 0, number: 0, random: 1, status: 0 };
}
export function encodeScope(d) {
    switch (d.faction) {
        case 1: return d.number === 0 ? 1 : d.number === 1 ? 2 : 2 + Math.max(1, Math.min(4, d.random));
        case 2: {
            const one = d.number === 0;
            return d.status === 0 ? (one ? 7 : 8) : d.status === 1 ? (one ? 9 : 10) : (one ? 12 : 13);
        }
        case 3: return 14;
        case 4: return 11;
        default: return 0;
    }
}
export const SCOPE_TEXT = [t("None", "Constants"), t("1 Enemy", "Constants"), t("All Enemies", "Constants"), t("1 Random Enemy", "Constants"),
    t("2 Random Enemies", "Constants"), t("3 Random Enemies", "Constants"), t("4 Random Enemies", "Constants"), t("1 Ally", "Constants"),
    t("All Allies", "Constants"), t("1 Ally (Dead)", "Constants"), t("All Allies (Dead)", "Constants"), t("The User", "Constants"),
    t("1 Ally (UNC)", "Constants"), t("All Allies (UNC)", "Constants"), t("All Enemies & Allies", "Constants")];

// --------------------------------------------------------------------- Curva de EXP (Game_Actor.expForLevel)
export function expForLevel(p, level) {
    const [basis, extra, accA, accB] = p;
    return Math.round(basis * Math.pow(level - 1, 0.9 + accA / 250) * level * (level + 1) /
        (6 + Math.pow(level, 2) / 50 / accB) + (level - 1) * extra);
}

// --------------------------------------------------------------------- Curvas de parâmetro
// Valores exatos do editor MZ 1.1.1 (Constants.qml e Dialog_ParameterCurves.qml compilados
// no RPG.exe; desmontados do bytecode QV4 — ver NOTES.md).
export const PARAM_MIN = [1, 0, 0, 0, 0, 0, 0, 0];               // Constants.paramMinArray
export const PARAM_MAX = [9999, 9999, 999, 999, 999, 999, 999, 999]; // Constants.paramMaxArray
export const PARAM_GRAPH_MAX = [9999, 2000, 250, 250, 250, 250, 500, 500]; // Constants.paramGraphMaxArray
export const GROWTH_MIN = 0, GROWTH_NORMAL = 10, GROWTH_MAX = 20; // slider Fast / Normal / Slow

// Dialog_ParameterCurves.generateParameters(value1, value2, growth): mistura da reta com a
// parábola, ponderada pelo slider; Math.ceil. Só altera os níveis 1..99 (o índice 0 fica).
export function generateCurve(v1, v99, growth = GROWTH_NORMAL, base) {
    const out = base ? base.slice() : new Array(100).fill(0);
    const w = growth - 10;
    for (let lv = 1; lv <= 99; lv++) {
        const lin = (v1 - v99 === 0 ? v1 : v1 + (v99 - v1) * (lv - 1) / 98);
        const quad = v1 + (lv - 1) * ((lv - 1) * (v99 - v1)) / 98 / 98;
        out[lv] = Math.ceil((quad * w + lin * (10 - w)) / 10);
    }
    return out;
}

// Dialog_ParameterCurves.quickSetParameters(rank), rank = 4 - índice do botão (A = 4 ... E = 0).
// rnd: Math.random() (pode ser fixado para testes).
export function quickCurveEndpoints(paramId, buttonIndex, rnd1 = Math.random(), rnd2 = Math.random()) {
    const rank = 4 - buttonIndex;
    const g = PARAM_GRAPH_MAX[paramId];
    let v1 = (200 + rank * 100 + rnd1 * 100) * (g / 10000);
    const v99 = (4000 + rank * 1000 + rnd2 * 1000) * (g / 10000);
    if (paramId >= 2) { v1 += 5; }
    return [Math.round(v1), Math.round(v99)];
}
export function quickCurve(paramId, buttonIndex, base) {
    const [v1, v99] = quickCurveEndpoints(paramId, buttonIndex);
    return generateCurve(v1, v99, GROWTH_NORMAL, base);
}

// Classe nova: curva "C" no meio da faixa (determinística).
export function defaultClassParams() {
    return PARAMS.map((_, i) => {
        const [v1, v99] = quickCurveEndpoints(i, 2, 0.5, 0.5);
        const arr = generateCurve(v1, v99, GROWTH_NORMAL);
        arr[0] = PARAM_MIN[i];
        return arr;
    });
}

// --------------------------------------------------------------------- dados em branco (Change Maximum / Clear)
const eventEnd = () => [{ code: 0, indent: 0, parameters: [] }];
const blankDamage = () => ({ critical: false, elementId: 0, formula: "0", type: 0, variance: 20 });

export function blankTroopPage() {
    return {
        conditions: { actorHp: 50, actorId: 1, actorValid: false, enemyHp: 50, enemyIndex: 0, enemyValid: false,
            switchId: 1, switchValid: false, turnA: 0, turnB: 0, turnEnding: false, turnValid: false },
        list: eventEnd(), span: 0
    };
}

export const BLANK = {
    Actors: id => ({ id, battlerName: "", characterIndex: 0, characterName: "", classId: 1, equips: [0, 0, 0, 0, 0],
        faceIndex: 0, faceName: "", traits: [], initialLevel: 1, maxLevel: 99, name: "", nickname: "", note: "", profile: "" }),
    Classes: id => ({ id, expParams: [30, 20, 30, 30], traits: [
        { code: 23, dataId: 0, value: 1 }, { code: 22, dataId: 0, value: 0.95 }, { code: 22, dataId: 1, value: 0.05 },
        { code: 22, dataId: 2, value: 0.04 }, { code: 41, dataId: 1, value: 1 }],
    learnings: [], name: "", note: "", params: defaultClassParams() }),
    Skills: id => ({ id, animationId: 0, damage: blankDamage(), description: "", effects: [], hitType: 0, iconIndex: 0,
        message1: "", message2: "", mpCost: 0, name: "", note: "", occasion: 0, repeats: 1, requiredWtypeId1: 0,
        requiredWtypeId2: 0, scope: 1, speed: 0, stypeId: 1, successRate: 100, tpCost: 0, tpGain: 0, messageType: 1 }),
    Items: id => ({ id, animationId: 0, consumable: true, damage: blankDamage(), description: "", effects: [], hitType: 0,
        iconIndex: 0, itypeId: 1, name: "", note: "", occasion: 0, price: 0, repeats: 1, scope: 7, speed: 0,
        successRate: 100, tpGain: 0 }),
    Weapons: id => ({ id, animationId: 0, description: "", etypeId: 1, traits: [{ code: 31, dataId: 1, value: 0 },
        { code: 22, dataId: 0, value: 0 }], iconIndex: 0, name: "", note: "", params: [0, 0, 0, 0, 0, 0, 0, 0], price: 0, wtypeId: 0 }),
    Armors: id => ({ id, atypeId: 0, description: "", etypeId: 2, traits: [{ code: 22, dataId: 1, value: 0 }], iconIndex: 0,
        name: "", note: "", params: [0, 0, 0, 0, 0, 0, 0, 0], price: 0 }),
    Enemies: id => ({ id, actions: [{ conditionParam1: 0, conditionParam2: 0, conditionType: 0, rating: 5, skillId: 1 }],
        battlerHue: 0, battlerName: "", dropItems: [0, 1, 2].map(() => ({ dataId: 1, denominator: 1, kind: 0 })), exp: 0,
        traits: [{ code: 22, dataId: 0, value: 0.95 }, { code: 22, dataId: 1, value: 0.05 }, { code: 31, dataId: 1, value: 0 }],
        gold: 0, name: "", note: "", params: [100, 0, 10, 10, 10, 10, 10, 10] }),
    Troops: id => ({ id, members: [], name: "", pages: [blankTroopPage()] }),
    States: id => ({ id, autoRemovalTiming: 0, chanceByDamage: 100, iconIndex: 0, maxTurns: 1, message1: "", message2: "",
        message3: "", message4: "", minTurns: 1, motion: 0, name: "", note: "", overlay: 0, priority: 50,
        releaseByDamage: false, removeAtBattleEnd: false, removeByDamage: false, removeByRestriction: false,
        removeByWalking: false, restriction: 0, stepsToRemove: 100, traits: [], messageType: 1 }),
    Animations: id => ({ id, displayType: 0, effectName: "", flashTimings: [], name: "", offsetX: 0, offsetY: 0,
        rotation: { x: 0, y: 0, z: 0 }, scale: 100, soundTimings: [], speed: 100 }),
    Tilesets: id => {
        const flags = new Array(8192).fill(0);
        flags[0] = 0x10;
        return { id, flags, mode: 1, name: "", note: "", tilesetNames: ["", "", "", "", "", "", "", "", ""] };
    },
    CommonEvents: id => ({ id, list: eventEnd(), name: "", switchId: 1, trigger: 0 })
};
