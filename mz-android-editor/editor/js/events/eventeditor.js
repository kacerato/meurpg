// Editor de evento de mapa (Event Editor) com páginas, condições, gráfico, movimento autônomo,
// opções, prioridade, trigger e lista de conteúdo. Também o editor de lista de evento comum.

import { db, clone, TEMPLATE } from "./data.js";
import { h, dialog, field, row, col, group, num, txt, sel, chk, switchPick, varPick, characterDialog, drawCharacterThumb, confirmBox } from "./ui.js";
import { createCommandList, commandListToolbar } from "./commandlist.js";
import { moveRouteDialog } from "./moveroute.js";

let pageClipboard = null;

const MOVE_TYPES = ["Fixed", "Random", "Approach", "Custom"];
const SPEEDS = ["1: x8 Slower", "2: x4 Slower", "3: x2 Slower", "4: Normal", "5: x2 Faster", "6: x4 Faster"];
const FREQS = ["1: Lowest", "2: Lower", "3: Normal", "4: Higher", "5: Highest"];
const PRIORITIES = ["Below characters", "Same as characters", "Above characters"];
const TRIGGERS = ["Action Button", "Player Touch", "Event Touch", "Autorun", "Parallel"];

function opt(arr, base = 0) { return arr.map((l, i) => ({ value: i + base, label: l })); }

// opts: { map, mapId, event, tileset, page?, row? }  -> resolve(evento editado) ou null
export function openEventEditor(opts) {
    const ev = clone(opts.event);
    let pageIndex = Math.min(opts.page || 0, ev.pages.length - 1);
    let cl = null;
    return dialog({
        title: `Event Editor - ID:${String(ev.id).padStart(3, "0")}`,
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
            const top = h("div", { class: "evEditorTop" },
                field("Name:", name), field("Note:", note),
                h("div", { class: "evRow evPageBtns" },
                    b("New Event Page", () => { ev.pages.splice(pageIndex + 1, 0, TEMPLATE.page()); showPage(pageIndex + 1); }),
                    b("Copy Event Page", () => { pageClipboard = clone(ev.pages[pageIndex]); }),
                    b("Paste Event Page", () => { if (pageClipboard) { ev.pages.splice(pageIndex + 1, 0, clone(pageClipboard)); showPage(pageIndex + 1); } }),
                    b("Delete Event Page", () => { if (ev.pages.length > 1) { ev.pages.splice(pageIndex, 1); showPage(Math.min(pageIndex, ev.pages.length - 1)); } }),
                    b("Clear Event Page", async () => { if (await confirmBox("Clear this event page?")) { ev.pages[pageIndex] = TEMPLATE.page(); showPage(pageIndex); } })));
            body.append(top, tabBar, pageArea);

            const showPage = i => {
                pageIndex = i;
                tabBar.innerHTML = "";
                ev.pages.forEach((_, k) => {
                    const t = h("button", { type: "button", class: "evTab" + (k === i ? " on" : "") }, String(k + 1));
                    t.addEventListener("click", () => showPage(k));
                    tabBar.append(t);
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
                const ssRow = row(ss, "is ON"); ssRow.enable = on => ss.enable(on);
                const itRow = row(it, "exists"); itRow.enable = on => it.enable(on);
                const acRow = row(ac, "is present"); acRow.enable = on => ac.enable(on);
                const conditions = group("Conditions",
                    condRow("Switch", "switch1Valid", s1), condRow("Switch", "switch2Valid", s2),
                    condRow("Variable", "variableValid", vRow), condRow("Self Switch", "selfSwitchValid", ssRow),
                    condRow("Item", "itemValid", itRow), condRow("Actor", "actorValid", acRow));
                // Image
                const canvas = h("canvas", { class: "evPageImage" });
                const imgBtn = h("button", { type: "button", class: "evImageBtn", title: "Image" }, canvas);
                const drawImg = () => drawCharacterThumb(canvas, page.image, opts.tileset, 120);
                imgBtn.addEventListener("click", async () => {
                    const r = await characterDialog(page.image, { mode: "event", tileset: opts.tileset });
                    if (r) { page.image = r; drawImg(); }
                });
                drawImg();
                const image = group("Image", imgBtn);
                // Autonomous Movement
                const mt = sel(opt(MOVE_TYPES), page.moveType);
                const routeBtn = h("button", { type: "button", class: "evBtn" }, "Route…");
                routeBtn.addEventListener("click", async () => {
                    const r = await moveRouteDialog(page.moveRoute, {
                        showWait: false, title: "Movement Route",
                        previewStart: () => (opts.mapId ? { mapId: opts.mapId, x: ev.x, y: ev.y, d: page.image.direction || 2, directionFix: page.directionFix } : null)
                    });
                    if (r) { page.moveRoute = r.route; }
                });
                mt.onChange(() => { page.moveType = mt.get(); routeBtn.disabled = page.moveType !== 3; });
                routeBtn.disabled = page.moveType !== 3;
                const sp = sel(opt(SPEEDS, 1), page.moveSpeed).onChange(() => { page.moveSpeed = sp.get(); });
                const fq = sel(opt(FREQS, 1), page.moveFrequency).onChange(() => { page.moveFrequency = fq.get(); });
                const movement = group("Autonomous Movement", field("Type:", mt, routeBtn), field("Speed:", sp), field("Freq:", fq));
                // Options
                const o = k => { const x = chk({ walkAnime: "Walking", stepAnime: "Stepping", directionFix: "Direction Fix", through: "Through" }[k], page[k]); x.onChange(() => { page[k] = x.get(); }); return x; };
                const options = group("Options", o("walkAnime"), o("stepAnime"), o("directionFix"), o("through"));
                const pr = sel(opt(PRIORITIES), page.priorityType).onChange(() => { page.priorityType = pr.get(); });
                const tr = sel(opt(TRIGGERS), page.trigger).onChange(() => { page.trigger = tr.get(); });
                const left = h("div", { class: "evPageLeft" }, conditions, h("div", { class: "evRow evTop" }, image, col(movement)), h("div", { class: "evRow evTop" }, options, col(group("Priority", pr), group("Trigger", tr))));
                // Contents
                cl = createCommandList({ list: page.list, ctx: { map: opts.map, mapId: opts.mapId, eventId: ev.id, eventPos: { x: ev.x, y: ev.y, d: page.image.direction || 2, directionFix: page.directionFix } } });
                const right = h("div", { class: "evPageRight" }, h("div", { class: "evContentsTitle" }, "Contents"), cl.el, commandListToolbar(cl));
                return h("div", { class: "evPage" }, left, right);
            };
            showPage(pageIndex);
            if (opts.row !== undefined && cl) { setTimeout(() => cl.selectRow(opts.row), 30); }
        },
        onOk: () => ({ v: ev })
    }).then(r => r ? r.v : null);
}

// Editor de lista de um evento comum (usado pelo Event Searcher).
export function openCommonEventEditor(api, id, rowIndex) {
    const ce = clone(db.commonEvents[id]);
    if (!ce) { return Promise.resolve(null); }
    return dialog({
        title: `Common Event - ${String(id).padStart(4, "0")}`, width: "min(1100px, 99vw)", height: "96vh",
        build: body => {
            const name = txt(ce.name, { width: "220px" }).onChange(() => { ce.name = name.get(); });
            const trig = sel(opt(["None", "Autorun", "Parallel"]), ce.trigger).onChange(() => { ce.trigger = trig.get(); });
            const sw = switchPick(ce.switchId || 1).onChange(() => { ce.switchId = sw.get(); });
            const cl = createCommandList({ list: ce.list, ctx: { map: null, mapId: 0, eventId: 0 } });
            body.append(row(field("Name:", name), field("Trigger:", trig), field("Switch:", sw)), h("div", { class: "evContentsTitle" }, "Contents"), cl.el, commandListToolbar(cl));
            body.classList.add("evCommonBody");
            if (rowIndex !== undefined) { setTimeout(() => cl.selectRow(rowIndex), 30); }
        },
        onOk: () => ({ v: ce })
    }).then(async r => {
        if (!r) { return null; }
        db.commonEvents[id] = r.v;
        await api.project.writeJson("data/CommonEvents.json", db.commonEvents);
        api.emit("db:changed", { file: "data/CommonEvents.json" });
        return r.v;
    });
}
