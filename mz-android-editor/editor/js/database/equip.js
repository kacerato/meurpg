// Regras de equipamento e parâmetros do ator, iguais ao runtime (rmmz_objects.js):
// Game_Actor.equipSlots / initEquips / releaseUnequippableItems / canEquip, Game_BattlerBase.param.
// Usado pelo Equipamento inicial (Atores) e pelo Teste de batalha (Tropas).
import { asObjects } from "./common.js";

const W_TYPE = 51, A_TYPE = 52, E_SEAL = 54, SLOT_TYPE = 55, PARAM = 21;

function traitsOf(objs) {
    const out = [];
    for (const o of objs) { if (o && o.traits) { out.push(...o.traits); } }
    return out;
}
const setOf = (traits, code) => new Set(traits.filter(tr => tr.code === code).map(tr => tr.dataId));

// Game_BattlerBase.slotType() === 1
export function isDualWield(traits) {
    const s = [...setOf(traits, SLOT_TYPE)];
    return s.length > 0 && Math.max(...s) === 1;
}

// Game_Actor.equipSlots(): etypeId de cada espaço (o 2º vira arma com Dual Wield)
export function equipSlots(db, traits) {
    const slots = [];
    for (let i = 1; i < db.System.equipTypes.length; i++) { slots.push(i); }
    if (slots.length >= 2 && isDualWield(traits)) { slots[1] = 1; }
    return slots;
}

// Game_BattlerBase.canEquipWeapon / canEquipArmor
export function canEquip(traits, item, isWeapon) {
    if (!item) { return false; }
    const typeOk = isWeapon ? setOf(traits, W_TYPE).has(item.wtypeId) : setOf(traits, A_TYPE).has(item.atypeId);
    return typeOk && !setOf(traits, E_SEAL).has(item.etypeId);
}

// Opções [[id, rótulo]] para um espaço, só com o que ator + classe podem equipar.
export function slotCandidates(db, traits, etypeId, current, options) {
    const isWeapon = etypeId === 1;
    const arr = isWeapon ? db.Weapons : db.Armors;
    const all = options(arr);
    const out = all.filter(([id]) => !id || id === current ||
        (arr[id] && arr[id].etypeId === etypeId && canEquip(traits, arr[id], isWeapon)));
    return all.objectKind ? asObjects(out, all.objectKind) : out;
}

// Game_Actor.initEquips(equips) + releaseUnequippableItems(true): devolve os objetos que
// realmente ficam equipados (o runtime descarta o que não serve, em laço até estabilizar).
export function resolveEquips(db, actor, cls, equips) {
    const base = [actor, cls];
    let slots = equipSlots(db, traitsOf(base));
    let objs = slots.map((etype, i) => {
        const id = equips[i] || 0;
        return id ? (etype === 1 ? db.Weapons[id] : db.Armors[id]) || null : null;
    });
    for (;;) {
        const traits = traitsOf([...base, ...objs]);
        slots = equipSlots(db, traits);
        let changed = false;
        objs = objs.map((o, i) => {
            // a arma tem etypeId 1 (DataManager.isWeapon equivale aqui a "veio de $dataWeapons")
            if (o && (!canEquip(traits, o, db.Weapons.includes(o)) || o.etypeId !== slots[i])) { changed = true; return null; }
            return o;
        });
        if (!changed) { break; }
    }
    return { slots, objs };
}

// Game_BattlerBase.param(paramId) de um Game_Actor sem estados nem buffs.
export function actorParams(db, actorId, level, equips) {
    const actor = db.Actors[actorId];
    const cls = actor && db.Classes[actor.classId];
    if (!actor || !cls) { return null; }
    const { objs } = resolveEquips(db, actor, cls, equips);
    const traits = traitsOf([actor, cls, ...objs]);
    return [0, 1, 2, 3, 4, 5, 6, 7].map(p => {
        const base = (cls.params[p] || [])[level] || 0;
        const plus = objs.reduce((s, o) => s + (o ? o.params[p] || 0 : 0), 0);
        const rate = traits.filter(tr => tr.code === PARAM && tr.dataId === p).reduce((r, tr) => r * tr.value, 1);
        const v = Math.max(0, base + plus) * rate;
        return Math.round(Math.max(p === 0 ? 1 : 0, v));
    });
}

export { traitsOf };
