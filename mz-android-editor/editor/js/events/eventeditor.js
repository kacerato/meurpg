// Editor de evento de mapa (Event Editor) com páginas, condições, gráfico, movimento autônomo,
// opções, prioridade, trigger e lista de conteúdo. Também o editor de lista de evento comum.

import { db, clone, TEMPLATE } from "./data.js";
import { h, dialog, field, row, col, group, num, txt, sel, chk, switchPick, varPick, characterDialog, drawCharacterThumb, getApi } from "./ui.js";
import { createCommandList, commandListToolbar } from "./commandlist.js";
import { moveRouteDialog } from "./moveroute.js";
import { pageMoveProps } from "./routesim.js";
import { t } from "../i18n.js";

let pageClipboard = null;
const MAX_PAGES = 20; // limite do MZ (01_09_03)

// "Aplicar" do Event Editor: grava o evento no mapa sem fechar o diálogo. Usa opts.onApply(ev) se o
// chamador fornecer; senão grava direto no modo evento (api.events), com desfazer.
async function applyToMap(opts, ev) {
    if (opts.onApply) { return opts.onApply(clone(ev)); }
    const mode = getApi() && getApi().events;
    if (!mode || !mode.map || mode.mapId !== opts.mapId) { return; }
    mode.record();
    mode.map.events[ev.id] = clone(ev);
    await mode.save();
}

const MOVE_TYPES = [t("Fixed", "Layout_EventPage"), t("Random", "Layout_EventPage"), t("Approach", "Layout_EventPage"), t("Custom", "Layout_EventPage")];
const SPEEDS = [t("1: x8 Slower", "MovementSpeedBox"), t("2: x4 Slower", "MovementSpeedBox"), t("3: x2 Slower", "MovementSpeedBox"), t("4: Normal", "MovementSpeedBox"), t("5: x2 Faster", "MovementSpeedBox"), t("6: x4 Faster", "MovementSpeedBox")];
const FREQS = [t("1: Lowest", "MovementFrequencyBox"), t("2: Lower", "MovementFrequencyBox"), t("3: Normal", "MovementFrequencyBox"), t("4: Higher", "MovementFrequencyBox"), t("5: Highest", "MovementFrequencyBox")];
const PRIORITIES = [t("Below characters", "Layout_EventPage"), t("Same as characters", "Layout_EventPage"), t("Above characters", "Layout_EventPage")];
const TRIGGERS = [t("Action Button", "Layout_EventPage"), t("Player Touch", "Layout_EventPage"), t("Event Touch", "Layout_EventPage"), t("Autorun", "Layout_EventPage"), t("Parallel", "Layout_EventPage")];

// Rótulos dos botões de página: a fonte oficial tem <br> (quebra de linha no botão do MZ).
function pageBtn(src) { return t(src, "Layout_EventPageButtons").replace(/<br>/g, " "); }
function opt(arr, base = 0) { return arr.map((l, i) => ({ value: i + base, label: l })); }

// opts: { map, mapId, event, tileset, page?, row? }  -> resolve(evento editado) ou null
export function openEventEditor(opts) {
    const ev = clone(opts.event);
    let pageIndex = Math.min(opts.page || 0, ev.pages.length - 1);
    let cl = null;
    let applied = false;
    return dialog({
        title: `${t("Event Editor", "EventEditorMain")} - ID:${String(ev.id).padStart(3, "0")}`,
        width: "min(1260px, 99vw)", height: "98vh",
        build: (body, dlg) => {
            body.classList.add("evEditorBody");
            const name = txt(ev.name, { width: "180px" });
            const note = txt(ev.note, { width: "260px" });
            name.onChange(() => { ev.name = name.get(); });
            note.onChange(() => { ev.note = note.get(); });
            const tabBar = h("div", { class: "evTabs evPageTabs" });
            const pageArea = h("div", { class: "evPageArea" });
            const b = (label, fn) => h("button", { type: "button", class: "evBtn", onclick: fn }, label);
            // Como no MZ: Nova/Colar desabilitam com 20 páginas; Excluir desabilita com uma só; Limpar não pede confirmação.
            const bNew = b(pageBtn("New<br>Event Page"), () => { if (ev.pages.length < MAX_PAGES) { ev.pages.splice(pageIndex + 1, 0, TEMPLATE.page()); showPage(pageIndex + 1); } });
            const bCopy = b(pageBtn("Copy<br>Event Page"), () => { pageClipboard = clone(ev.pages[pageIndex]); syncBtns(); });
            const bPaste = b(pageBtn("Paste<br>Event Page"), () => { if (pageClipboard && ev.pages.length < MAX_PAGES) { ev.pages.splice(pageIndex + 1, 0, clone(pageClipboard)); showPage(pageIndex + 1); } });
            const bDel = b(pageBtn("Delete<br>Event Page"), () => { if (ev.pages.length > 1) { ev.pages.splice(pageIndex, 1); showPage(Math.min(pageIndex, ev.pages.length - 1)); } });
            const bClear = b(pageBtn("Clear<br>Event Page"), () => { ev.pages[pageIndex] = TEMPLATE.page(); showPage(pageIndex); });
            const syncBtns = () => {
                bNew.disabled = ev.pages.length >= MAX_PAGES;
                bPaste.disabled = !pageClipboard || ev.pages.length >= MAX_PAGES;
                bDel.disabled = ev.pages.length <= 1;
            };
            const top = h("div", { class: "evEditorTop" },
                field(t("Name", "Constants"), name), field(t("Note", "Constants"), note),
                h("div", { class: "evRow evPageBtns" }, bNew, bCopy, bPaste, bDel, bClear));
            body.append(top, tabBar, pageArea);

            const showPage = i => {
                pageIndex = i;
                syncBtns();
                tabBar.innerHTML = "";
                ev.pages.forEach((_, k) => {
                    const tb = h("button", { type: "button", class: "evTab" + (k === i ? " on" : "") }, String(k + 1));
                    tb.addEventListener("click", () => showPage(k));
                    tabBar.append(tb);
                });
                pageArea.innerHTML = "";
                pageArea.append(buildPage(ev.pages[i]));
            };

            const buildPage = page => {
                const c = page.conditions;
                // Conditions
                const condRow = (label, valid, ...ctls) => {
                    const ch = chk(label, c[valid]);
                    const sync = () => { c[valid] = ch.get(); for (const x of ctls) { if (x.enable) { x.enable(c[valid]); } } };
                    ch.onChange(sync);
                    setTimeout(sync);
                    return h("div", { class: "evCondRow" }, ch.el, ...ctls.map(x => x.el || x));
                };
                const s1 = switchPick(c.switch1Id, "190px").onChange(() => { c.switch1Id = s1.get(); });
                const s2 = switchPick(c.switch2Id, "190px").onChange(() => { c.switch2Id = s2.get(); });
                const vv = varPick(c.variableId, "190px").onChange(() => { c.variableId = vv.get(); });
                const vn = num(c.variableValue, { min: -99999999, max: 99999999, width: "90px" }).onChange(() => { c.variableValue = vn.get(); });
                const ss = sel(["A", "B", "C", "D"], c.selfSwitchCh, { width: "70px" }).onChange(() => { c.selfSwitchCh = ss.get(); });
                const it = sel(db.options("items"), c.itemId, { width: "190px" }).onChange(() => { c.itemId = it.get(); });
                const ac = sel(db.options("actors"), c.actorId, { width: "190px" }).onChange(() => { c.actorId = ac.get(); });
                const vRow = row(vv, "≥", vn); vRow.enable = on => { vv.enable(on); vn.enable(on); };
                const ssRow = row(ss, t("is ON")); ssRow.enable = on => ss.enable(on);
                const itRow = row(it, t("exists")); itRow.enable = on => it.enable(on);
                const acRow = row(ac, t("is present")); acRow.enable = on => ac.enable(on);
                const conditions = group(t("Conditions", "Group_EventConditions"),
                    condRow(t("Switch", "Constants"), "switch1Valid", s1), condRow(t("Switch", "Constants"), "switch2Valid", s2),
                    condRow(t("Variable", "Constants"), "variableValid", vRow), condRow(t("Self Switch", "Group_EventConditions"), "selfSwitchValid", ssRow),
                    condRow(t("Item", "Constants"), "itemValid", itRow), condRow(t("Actor", "Constants"), "actorValid", acRow));
                // Image
                const canvas = h("canvas", { class: "evPageImage" });
                const imgBtn = h("button", { type: "button", class: "evImageBtn", title: t("Image", "Constants") }, canvas);
                const drawImg = () => drawCharacterThumb(canvas, page.image, opts.tileset, 120);
                imgBtn.addEventListener("click", async () => {
                    const r = await characterDialog(page.image, { mode: "event", tileset: opts.tileset });
                    if (r) { page.image = r; drawImg(); }
                });
                drawImg();
                const image = group(t("Image", "Constants"), imgBtn);
                // Autonomous Movement
                const mt = sel(opt(MOVE_TYPES), page.moveType);
                const routeBtn = h("button", { type: "button", class: "evBtn" }, t("Route", "Layout_EventPage") + "…");
                routeBtn.addEventListener("click", async () => {
                    const r = await moveRouteDialog(page.moveRoute, {
                        showWait: false, title: t("Movement Route", "Dialog_MovementRoute"),
                        previewStart: () => (opts.mapId ? { mapId: opts.mapId, x: ev.x, y: ev.y, selfId: ev.id, events: opts.map && opts.map.events, forced: false, ...pageMoveProps(page) } : null)
                    });
                    if (r) { page.moveRoute = r.route; }
                });
                mt.onChange(() => { page.moveType = mt.get(); routeBtn.disabled = page.moveType !== 3; });
                routeBtn.disabled = page.moveType !== 3;
                const sp = sel(opt(SPEEDS, 1), page.moveSpeed).onChange(() => { page.moveSpeed = sp.get(); });
                const fq = sel(opt(FREQS, 1), page.moveFrequency).onChange(() => { page.moveFrequency = fq.get(); });
                const movement = group(t("Autonomous Movement", "Layout_EventPage"), field(t("Type", "Layout_EventPage"), mt, routeBtn), field(t("Speed", "MovementSpeedBox"), sp), field(t("Frequency", "MovementFrequencyBox"), fq));
                // Options
                const o = k => { const x = chk({ walkAnime: t("Walking", "Layout_EventPage"), stepAnime: t("Stepping", "Layout_EventPage"), directionFix: t("Direction Fix", "Layout_EventPage"), through: t("Through", "Layout_EventPage") }[k], page[k]); x.onChange(() => { page[k] = x.get(); }); return x; };
                const options = group(t("Options", "Layout_EventPage"), o("walkAnime"), o("stepAnime"), o("directionFix"), o("through"));
                const pr = sel(opt(PRIORITIES), page.priorityType).onChange(() => { page.priorityType = pr.get(); });
                const tr = sel(opt(TRIGGERS), page.trigger).onChange(() => { page.trigger = tr.get(); });
                const left = h("div", { class: "evPageLeft" }, conditions, h("div", { class: "evRow evTop" }, image, col(movement)), h("div", { class: "evRow evTop" }, options, col(group(t("Priority", "Layout_EventPage"), pr), group(t("Trigger", "Layout_EventPage"), tr))));
                // Contents
                cl = createCommandList({ list: page.list, ctx: { map: opts.map, mapId: opts.mapId, eventId: ev.id, eventPos: { x: ev.x, y: ev.y, ...pageMoveProps(page) } } });
                const right = h("div", { class: "evPageRight" }, h("div", { class: "evContentsTitle" }, t("Contents", "Layout_EventPage")), cl.el, commandListToolbar(cl));
                return h("div", { class: "evPage" }, left, right);
            };
            showPage(pageIndex);
            if (opts.row !== undefined && cl) { setTimeout(() => cl.selectRow(opts.row), 30); }
        },
        onApply: async () => { await applyToMap(opts, ev); applied = true; },
        // Depois de "Aplicar" o evento já está no mapa: o OK grava aqui e devolve null, para o chamador
        // não colocá-lo de novo (evento novo ganharia outro ID).
        onOk: () => (applied && !opts.onApply ? { v: ev, applied: true } : { v: ev })
    }).then(async r => {
        if (!r) { return null; }
        if (r.applied) { await applyToMap(opts, r.v); return null; }
        return r.v;
    });
}

// Editor de lista de um evento comum (usado pelo Event Searcher).
export function openCommonEventEditor(api, id, rowIndex) {
    const ce = clone(db.commonEvents[id]);
    if (!ce) { return Promise.resolve(null); }
    return dialog({
        title: `${t("Common Event", "Constants")} - ${String(id).padStart(4, "0")}`, width: "min(1100px, 99vw)", height: "96vh",
        build: body => {
            const name = txt(ce.name, { width: "220px" }).onChange(() => { ce.name = name.get(); });
            const trig = sel(opt([t("None", "Constants"), t("Autorun", "Edit_CommonEvents"), t("Parallel", "Edit_CommonEvents")]), ce.trigger).onChange(() => { ce.trigger = trig.get(); });
            const sw = switchPick(ce.switchId || 1).onChange(() => { ce.switchId = sw.get(); });
            const cl = createCommandList({ list: ce.list, ctx: { map: null, mapId: 0, eventId: 0 } });
            body.append(row(field(t("Name", "Constants"), name), field(t("Trigger", "Edit_CommonEvents"), trig), field(t("Switch", "Constants"), sw)), h("div", { class: "evContentsTitle" }, t("Contents", "Edit_CommonEvents")), cl.el, commandListToolbar(cl));
            body.classList.add("evCommonBody");
            if (rowIndex !== undefined) { setTimeout(() => cl.selectRow(rowIndex), 30); }
        },
        onApply: () => save(clone(ce)),
        onOk: () => ({ v: ce })
    }).then(async r => {
        if (!r) { return null; }
        await save(r.v);
        return r.v;
    });
    async function save(v) {
        db.commonEvents[id] = v;
        await api.project.writeJson("data/CommonEvents.json", db.commonEvents);
        api.emit("db:changed", { file: "data/CommonEvents.json" });
    }
}
