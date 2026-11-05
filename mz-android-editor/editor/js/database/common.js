// Constantes e listas de opções compartilhadas entre as abas (rótulos do editor MZ em inglês).
import { pad } from "./ui.js";

export const PARAMS = ["Max HP", "Max MP", "Attack", "Defense", "M.Attack", "M.Defense", "Agility", "Luck"];
export const XPARAMS = ["Hit Rate", "Evasion Rate", "Critical Rate", "Critical Evasion", "Magic Evasion",
    "Magic Reflection", "Counter Attack", "HP Regeneration", "MP Regeneration", "TP Regeneration"];
export const SPARAMS = ["Target Rate", "Guard Effect", "Recovery Effect", "Pharmacology", "MP Cost Rate",
    "TP Charge Rate", "Physical Damage", "Magic Damage", "Floor Damage", "Experience"];
export const SPECIAL_FLAGS = ["Auto Battle", "Guard", "Substitute", "Preserve TP"];
export const COLLAPSE = ["Normal", "Boss", "Instant", "No Disappear"];
export const PARTY_ABILITY = ["Encounter Half", "Encounter None", "Cancel Surprise", "Raise Preemptive", "Gold Double", "Drop Item Double"];
export const OCCASIONS = [[0, "Always"], [1, "Battle Screen"], [2, "Menu Screen"], [3, "Never"]];
export const HIT_TYPES = [[0, "Certain Hit"], [1, "Physical Attack"], [2, "Magical Attack"]];
export const DAMAGE_TYPES = [[0, "None"], [1, "HP Damage"], [2, "MP Damage"], [3, "HP Recover"], [4, "MP Recover"], [5, "HP Drain"], [6, "MP Drain"]];
export const ITEM_TYPES = [[1, "Regular Item"], [2, "Key Item"], [3, "Hidden Item A"], [4, "Hidden Item B"]];
export const RESTRICTIONS = [[0, "None"], [1, "Attack an enemy"], [2, "Attack anyone"], [3, "Attack an ally"], [4, "Cannot move"]];
export const SV_MOTIONS = [[0, "Normal"], [1, "Abnormal"], [2, "Sleep"], [3, "Dead"]];
export const SV_OVERLAYS = [[0, "None"], [1, "Poison"], [2, "Blind"], [3, "Silence"], [4, "Rage"], [5, "Confusion"],
    [6, "Fascination"], [7, "Sleep"], [8, "Paralyze"], [9, "Curse"], [10, "Fear"]];
export const AUTO_REMOVAL = [[0, "None"], [1, "Action End"], [2, "Turn End"]];

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

export function nameOf(arr, id, none = "None") {
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
export const SCOPE_TEXT = ["None", "1 Enemy", "All Enemies", "1 Random Enemy", "2 Random Enemies", "3 Random Enemies",
    "4 Random Enemies", "1 Ally", "All Allies", "1 Ally (Dead)", "All Allies (Dead)", "The User",
    "1 Ally (Unconditional)", "All Allies (Unconditional)", "Enemies & Allies"];

// --------------------------------------------------------------------- Curva de EXP (Game_Actor.expForLevel)
export function expForLevel(p, level) {
    const [basis, extra, accA, accB] = p;
    return Math.round(basis * Math.pow(level - 1, 0.9 + accA / 250) * level * (level + 1) /
        (6 + Math.pow(level, 2) / 50 / accB) + (level - 1) * extra);
}

// --------------------------------------------------------------------- Curvas de parâmetro
// growth: -1 (cresce cedo) .. 1 (cresce tarde). Gera 100 posições (índice = nível; 0 = valor do nível 1).
export function generateCurve(v1, v99, growth = 0) {
    const out = new Array(100);
    const exp = Math.pow(2, growth * 1.5);
    for (let lv = 1; lv <= 99; lv++) {
        const t = (lv - 1) / 98;
        out[lv] = Math.round(v1 + (v99 - v1) * Math.pow(t, exp));
    }
    out[0] = out[1];
    return out;
}
// Predefinições A–E (A = maior). Valores [nível 1, nível 99] por parâmetro.
export const CURVE_PRESETS = {
    0: [[650, 9000], [550, 7500], [450, 6000], [350, 4500], [250, 3000]],
    1: [[90, 2000], [75, 1600], [60, 1200], [45, 800], [30, 400]],
    2: [[30, 450], [25, 375], [20, 300], [15, 225], [10, 150]],
    3: [[30, 450], [25, 375], [20, 300], [15, 225], [10, 150]],
    4: [[30, 450], [25, 375], [20, 300], [15, 225], [10, 150]],
    5: [[30, 450], [25, 375], [20, 300], [15, 225], [10, 150]],
    6: [[30, 450], [25, 375], [20, 300], [15, 225], [10, 150]],
    7: [[30, 450], [25, 375], [20, 300], [15, 225], [10, 150]]
};
export function defaultClassParams() {
    return PARAMS.map((_, i) => generateCurve(CURVE_PRESETS[i][2][0], CURVE_PRESETS[i][2][1], 0));
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
