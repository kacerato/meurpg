// Histórico de desfazer/refazer do módulo de eventos que sobrevive ao fechar os diálogos: alterações em
// data/CommonEvents.json (editor de evento comum aberto pelo buscador) e em data/System.json (renomear
// switches/variáveis, "Mudar Máximo"). Vale junto com o histórico por mapa do modo evento (eventmode.js):
// todas as entradas levam um número de sequência e o Desfazer pega a mais recente das duas pilhas.
//
// As alterações não gravam na hora: vão para o cache do Project e para o salvamento unificado
// (api.markDirty); o "Salvar projeto" grava junto com os mapas, como o MZ.

import { db, clone } from "./data.js";
import { t } from "../i18n.js";

let seq = 0;
export const nextSeq = () => ++seq;
export const dbHist = { undo: [], redo: [] };
const LIMIT = 100;
let API = null;
const listeners = new Set();

export function initHistory(api) { API = api; }
export function onHistoryChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function changed() { for (const fn of listeners) { try { fn(); } catch (e) { console.error(e); } } }

// Grava um arquivo do banco pelo salvamento unificado (cache + markDirty) e avisa os módulos.
export function persistDb(file, obj) {
    if (!API) { return; }
    API.project.cache.set(file, obj);
    API.markDirty(file);
    API.emit("db:changed", { file });
}

const KINDS = {
    // {kind: "common", id, before, after}
    common: {
        file: "data/CommonEvents.json",
        apply(e, v) { db.commonEvents[e.id] = clone(v); persistDb(this.file, db.commonEvents); },
        label: e => `${t("Common Event", "Constants")} ${String(e.id).padStart(4, "0")}`
    },
    // {kind: "names", field: "switches" | "variables", before, after}
    names: {
        file: "data/System.json",
        apply(e, v) { db.system[e.field] = clone(v); persistDb(this.file, db.system); },
        label: e => (e.field === "switches" ? t("Switches", "Dialog_VariableSelector") : t("Variables", "Dialog_VariableSelector"))
    }
};

// Registra uma alteração já aplicada (before → after) e a aplica pelo salvamento unificado.
// mapTop: quantos passos o maptools tinha no mapa atual (para decidir, no modo mapa, quem é mais recente).
export function recordDb(entry) {
    if (JSON.stringify(entry.before) === JSON.stringify(entry.after)) { return; }
    entry.seq = nextSeq();
    entry.mapTop = mapToolsTop();
    dbHist.undo.push(entry);
    if (dbHist.undo.length > LIMIT) { dbHist.undo.shift(); }
    dbHist.redo.length = 0;
    KINDS[entry.kind].apply(entry, entry.after);
    changed();
}
export function dbTopSeq(stack) { const e = dbHist[stack][dbHist[stack].length - 1]; return e ? e.seq : -1; }
export function undoDb() {
    const e = dbHist.undo.pop();
    if (!e) { return false; }
    KINDS[e.kind].apply(e, e.before);
    e.seq = nextSeq();
    e.mapTop = mapToolsTop("redo");
    dbHist.redo.push(e);
    if (API) { API.status(t("Undo", "BasicConstants") + ": " + KINDS[e.kind].label(e)); }
    changed();
    return true;
}
export function redoDb() {
    const e = dbHist.redo.pop();
    if (!e) { return false; }
    KINDS[e.kind].apply(e, e.after);
    e.seq = nextSeq();
    e.mapTop = mapToolsTop();
    dbHist.undo.push(e);
    if (API) { API.status(t("Redo", "BasicConstants") + ": " + KINDS[e.kind].label(e)); }
    changed();
    return true;
}
// Uma ação nova no modo evento descarta o que podia ser refeito (como em qualquer histórico).
export function clearDbRedo() { if (dbHist.redo.length) { dbHist.redo.length = 0; changed(); } }

// ---- modo mapa: o maptools tem o histórico de tiles; a entrada do banco só é desfeita se for mais
// recente que o último passo do mapa atual (o topo da pilha do maptools não mudou desde então). ----
function mapToolsTop(stack = "undo") {
    const mt = window.mzMapTools;
    const id = API && API.currentMapId;
    const e = mt && mt.state && mt.state.edits && mt.state.edits.get(id);
    const s = e && (stack === "undo" ? e.undoStack : e.redoStack);
    return { mapId: id, rec: s && s.length ? s[s.length - 1] : null };
}
function isNewerThanMap(e, stack) {
    if (!e) { return false; }
    const now = mapToolsTop(stack);
    if (!now.rec) { return true; }
    return now.mapId === e.mapTop.mapId && now.rec === e.mapTop.rec;
}
export function dbUndoWinsInMapMode() { return isNewerThanMap(dbHist.undo[dbHist.undo.length - 1], "undo"); }
export function dbRedoWinsInMapMode() { return isNewerThanMap(dbHist.redo[dbHist.redo.length - 1], "redo"); }
