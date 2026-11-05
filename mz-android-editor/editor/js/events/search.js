// Event Searcher: procura uso de switch/variável/item/arma/armadura/evento comum ou texto em todos os
// mapas, eventos comuns e grupos de inimigos; resultado clicável abre o evento na linha encontrada.

import { db } from "./data.js";
import { h, dialog, field, row, sel, txt, radios, switchPick, varPick, alertBox } from "./ui.js";
import { CMD } from "./commands.js";
import { rowText } from "./commandlist.js";
import { openCommonEventEditor } from "./eventeditor.js";

let last = { kind: 0, sw: 1, vr: 1, item: 1, weapon: 1, armor: 1, common: 1, text: "", results: [] };

function cmdRefs(c) {
    const d = CMD[c.code];
    if (!d || !d.refs) { return []; }
    try { return d.refs(c.parameters || []); } catch (e) { return []; }
}

function matchList(list, q, ctx) {
    const hits = [];
    (list || []).forEach((c, i) => {
        if (q.type === "text") {
            if (c.code === 0) { return; }
            if (rowText(list, i, ctx).toLowerCase().includes(q.text)) { hits.push(i); }
            return;
        }
        if (cmdRefs(c).some(([k, id]) => k === q.type && id === q.id)) { hits.push(i); }
    });
    return hits;
}

function pageCondHit(page, q) {
    const c = page.conditions || {};
    if (q.type === "switch") { return (c.switch1Valid && c.switch1Id === q.id) || (c.switch2Valid && c.switch2Id === q.id); }
    if (q.type === "variable") { return c.variableValid && c.variableId === q.id; }
    if (q.type === "item") { return c.itemValid && c.itemId === q.id; }
    return false;
}

async function runSearch(api, q) {
    const out = [];
    const infos = db.mapInfos.filter(Boolean).sort((a, b) => a.order - b.order);
    for (const info of infos) {
        let map;
        try { map = await api.project.map(info.id); } catch (e) { continue; }
        const ctx = { map, mapId: info.id };
        for (const ev of map.events || []) {
            if (!ev) { continue; }
            ev.pages.forEach((page, pi) => {
                const where = `${info.name}, ${String(ev.id).padStart(3, "0")}:${ev.name} (${ev.x},${ev.y}), Page ${pi + 1}`;
                if (pageCondHit(page, q)) { out.push({ kind: "map", mapId: info.id, eventId: ev.id, page: pi, where, line: "Conditions" }); }
                if (q.type === "switch" && page.moveType === 3 && page.moveRoute.list.some(r => (r.code === 27 || r.code === 28) && r.parameters[0] === q.id)) {
                    out.push({ kind: "map", mapId: info.id, eventId: ev.id, page: pi, where, line: "Autonomous Movement (Route)" });
                }
                for (const i of matchList(page.list, q, ctx)) {
                    out.push({ kind: "map", mapId: info.id, eventId: ev.id, page: pi, row: i, where, line: rowText(page.list, i, ctx).trim() });
                }
            });
        }
    }
    db.commonEvents.forEach((ce, id) => {
        if (!ce) { return; }
        const where = `Common Event ${String(id).padStart(4, "0")}:${ce.name}`;
        if (q.type === "switch" && ce.trigger > 0 && ce.switchId === q.id) { out.push({ kind: "common", id, where, line: "Trigger Switch" }); }
        for (const i of matchList(ce.list, q, {})) { out.push({ kind: "common", id, row: i, where, line: rowText(ce.list, i, {}).trim() }); }
    });
    db.troops.forEach((tr, id) => {
        if (!tr) { return; }
        (tr.pages || []).forEach((page, pi) => {
            const where = `Troop ${String(id).padStart(4, "0")}:${tr.name}, Page ${pi + 1}`;
            const c = page.conditions || {};
            if (q.type === "switch" && c.switchValid && c.switchId === q.id) { out.push({ kind: "troop", id, where, line: "Conditions" }); }
            for (const i of matchList(page.list, q, {})) { out.push({ kind: "troop", id, where, line: rowText(page.list, i, {}).trim() }); }
        });
    });
    return out;
}

// jump(result): seleciona o mapa e abre o evento (eventMode.openEvent).
export function openSearcher(api, eventMode) {
    let resultsEl = null;
    const render = () => {
        resultsEl.innerHTML = "";
        resultsEl.append(h("div", { class: "evDesc" }, last.results.length ? `${last.results.length} result(s)` : "No results."));
        for (const r of last.results) {
            const it = h("div", { class: "evListItem evSearchHit" }, h("div", { class: "evHitWhere" }, r.where), h("div", { class: "evHitLine" }, r.line));
            it.addEventListener("click", () => jump(r));
            resultsEl.append(it);
        }
    };
    let dlgClose = null;
    const jump = async r => {
        if (dlgClose) { dlgClose(); }
        if (r.kind === "common") { await openCommonEventEditor(api, r.id, r.row); return; }
        if (r.kind === "troop") { alertBox(`${r.where}\n${r.line}\n\nEdite grupos de inimigos no Banco de dados (aba Troops).`, "Event Searcher"); return; }
        if (api.currentMapId !== r.mapId) {
            const rowEl = document.querySelector(`#mapTree div[data-id="${r.mapId}"]`);
            if (!rowEl) { return; }
            await new Promise(res => {
                const once = ({ id }) => { if (id === r.mapId) { res(); } };
                api.on("map:selected", once);
                rowEl.click();
                setTimeout(res, 3000);
            });
        }
        if (!eventMode.active) { document.getElementById("btnModeEvent").click(); }
        await eventMode.openEvent(r.eventId, r.page, r.row);
    };
    return dialog({
        title: "Event Searcher", width: "min(1000px, 98vw)", height: "94vh", okLabel: "Close", noCancel: true,
        build: (body, dlg) => {
            dlgClose = dlg.close;
            const sw = switchPick(last.sw), vr = varPick(last.vr);
            const it = sel(db.options("items"), last.item), wp = sel(db.options("weapons"), last.weapon), ar = sel(db.options("armors"), last.armor);
            const ce = sel(db.options("commonEvents"), last.common);
            const tx = txt(last.text, { width: "320px" });
            const r = radios([
                { label: "Switch", value: 0, controls: [sw] }, { label: "Variable", value: 1, controls: [vr] },
                { label: "Item", value: 2, controls: [it] }, { label: "Weapon", value: 3, controls: [wp] }, { label: "Armor", value: 4, controls: [ar] },
                { label: "Common Event", value: 5, controls: [ce] }, { label: "Text", value: 6, controls: [tx] }
            ], last.kind);
            resultsEl = h("div", { class: "evList evSearchResults" });
            const go = h("button", { type: "button", class: "evBtn primary" }, "Search");
            go.addEventListener("click", async () => {
                last = { ...last, kind: r.get(), sw: sw.get(), vr: vr.get(), item: it.get(), weapon: wp.get(), armor: ar.get(), common: ce.get(), text: tx.get() };
                const types = ["switch", "variable", "item", "weapon", "armor", "common", "text"];
                const q = { type: types[last.kind], id: [last.sw, last.vr, last.item, last.weapon, last.armor, last.common][last.kind], text: last.text.toLowerCase() };
                if (q.type === "text" && !q.text) { return; }
                go.disabled = true; go.textContent = "Searching…";
                try { last.results = await runSearch(api, q); } finally { go.disabled = false; go.textContent = "Search"; }
                render();
            });
            body.classList.add("evSearchBody");
            body.append(h("div", { class: "evSearchTop" }, h("fieldset", { class: "evGroup" }, h("legend", null, "Search Target"), r.el), go), resultsEl);
            render();
        }
    });
}
