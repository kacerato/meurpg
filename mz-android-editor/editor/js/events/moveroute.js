// Editor de rota de movimento (Set Movement Route / movimento autônomo Custom), fiel ao MZ.
// Códigos = Game_Character.ROUTE_* do runtime (rmmz_objects.js).

import { db, clone } from "./data.js";
import { h, dialog, field, row, num, txt, sel, chk, switchPick, audioPick, audioText, charIndexPick, alertBox, actionMenu, getApi } from "./ui.js";
import { MiniMap } from "./minimap.js";
import { SimWorld, runRoute } from "./routesim.js";
import { CharSprites } from "./simview.js";
import { t } from "../i18n.js";

const SPEEDS = ["", t("1: x8 Slower", "MovementSpeedBox"), t("2: x4 Slower", "MovementSpeedBox"), t("3: x2 Slower", "MovementSpeedBox"), t("4: Normal", "MovementSpeedBox"), t("5: x2 Faster", "MovementSpeedBox"), t("6: x4 Faster", "MovementSpeedBox")];
const FREQS = ["", t("1: Lowest", "MovementFrequencyBox"), t("2: Lower", "MovementFrequencyBox"), t("3: Normal", "MovementFrequencyBox"), t("4: Higher", "MovementFrequencyBox"), t("5: Highest", "MovementFrequencyBox")];
const BLENDS = [t("Normal", "Constants"), t("Additive", "Constants"), t("Multiply", "Constants"), t("Screen", "Constants")];

export const ROUTE_NAMES = {
    1: t("Move Down", "MovementCommands"), 2: t("Move Left", "MovementCommands"), 3: t("Move Right", "MovementCommands"), 4: t("Move Up", "MovementCommands"),
    5: t("Move Lower Left", "MovementCommands"), 6: t("Move Lower Right", "MovementCommands"), 7: t("Move Upper Left", "MovementCommands"), 8: t("Move Upper Right", "MovementCommands"),
    9: t("Move at Random", "MovementCommands"), 10: t("Move toward Player", "MovementCommands"), 11: t("Move away from Player", "MovementCommands"),
    12: t("1 Step Forward", "MovementCommands"), 13: t("1 Step Backward", "MovementCommands"), 14: t("Jump", "MovementCommands"), 15: t("Wait", "MovementCommands"),
    16: t("Turn Down", "MovementCommands"), 17: t("Turn Left", "MovementCommands"), 18: t("Turn Right", "MovementCommands"), 19: t("Turn Up", "MovementCommands"),
    20: t("Turn 90° Right", "MovementCommands"), 21: t("Turn 90° Left", "MovementCommands"), 22: t("Turn 180°", "MovementCommands"), 23: t("Turn 90° Right or Left", "MovementCommands"),
    24: t("Turn at Random", "MovementCommands"), 25: t("Turn toward Player", "MovementCommands"), 26: t("Turn away from Player", "MovementCommands"),
    27: t("Switch ON", "MovementCommands"), 28: t("Switch OFF", "MovementCommands"), 29: t("Speed", "MovementCommands"), 30: t("Frequency", "MovementCommands"),
    31: t("Walking Animation ON", "MovementCommands"), 32: t("Walking Animation OFF", "MovementCommands"), 33: t("Stepping Animation ON", "MovementCommands"), 34: t("Stepping Animation OFF", "MovementCommands"),
    35: t("Direction Fix ON", "MovementCommands"), 36: t("Direction Fix OFF", "MovementCommands"), 37: t("Through ON", "MovementCommands"), 38: t("Through OFF", "MovementCommands"),
    39: t("Transparent ON", "MovementCommands"), 40: t("Transparent OFF", "MovementCommands"), 41: t("Image", "MovementCommands"), 42: t("Opacity", "MovementCommands"), 43: t("Blend Mode", "MovementCommands"),
    44: t("SE", "MovementCommands"), 45: t("Script", "MovementCommands")
};

// Layout dos botões em 3 colunas como no diálogo original.
const BUTTONS = [
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    [16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30],
    [31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45]
];
const BUTTON_LABELS = { 14: t("Jump", "MovementCommands") + "…", 15: t("Wait", "MovementCommands") + "…", 27: t("Switch ON", "MovementCommands") + "…", 28: t("Switch OFF", "MovementCommands") + "…", 29: t("Change Speed", "MovementCommands") + "…", 30: t("Change Frequency", "MovementCommands") + "…", 41: t("Change Image", "MovementCommands") + "…", 42: t("Change Opacity", "MovementCommands") + "…", 43: t("Change Blend Mode", "MovementCommands") + "…", 44: t("Play SE", "MovementCommands") + "…", 45: t("Script", "MovementCommands") + "…" };

const sign = n => (n >= 0 ? "+" : "") + n;

export function routeText(c) {
    const p = c.parameters || [];
    const n = ROUTE_NAMES[c.code];
    if (!c.code) { return ""; }
    switch (c.code) {
        case 14: return `${t("Jump", "MovementCommands")}：${sign(p[0])},${sign(p[1])}`;
        case 15: return `${t("Wait", "MovementCommands")}：${t(p[0] === 1 ? "%1 frame" : "%1 frames", "Constants", p[0])}`;
        case 27: case 28: return `${n}：#${db.pad(p[0])} ${db.switchName(p[0])}`;
        case 29: return `${t("Speed", "MovementCommands")}：${p[0]}`;
        case 30: return `${t("Frequency", "MovementCommands")}：${p[0]}`;
        case 41: return `${t("Image", "MovementCommands")}：${p[0] ? p[0] + "(" + p[1] + ")" : t("None", "Constants")}`;
        case 42: return `${t("Opacity", "MovementCommands")}：${p[0]}`;
        case 43: return `${t("Blend Mode", "MovementCommands")}：${BLENDS[p[0]] || p[0]}`;
        case 44: return `${t("SE", "MovementCommands")}：${audioText(p[0])}`;
        case 45: return `${t("Script", "MovementCommands")}：${p[0]}`;
        default: return n || t("Undefined Command", "MovementCommands");
    }
}

function paramDialog(code, params) {
    const p = clone(params) || [];
    let get;
    const title = (BUTTON_LABELS[code] || ROUTE_NAMES[code]).replace("…", "");
    const build = b => {
        switch (code) {
            case 14: {
                const x = num(p[0] || 0, { min: -100, max: 100 }), y = num(p[1] || 0, { min: -100, max: 100 });
                b.append(row(field(t("X", "MovementCommand14"), x), field(t("Y", "MovementCommand14"), y)));
                get = () => [x.get(), y.get()];
                break;
            }
            case 15: { const w = num(p[0] || 60, { min: 1, max: 999 }); b.append(field(t("Duration", "Group_Duration"), w, " " + t("frames (1/60 sec)", "Group_Duration"))); get = () => [w.get()]; break; }
            case 27: case 28: { const s = switchPick(p[0] || 1); b.append(field(t("Switch", "Constants"), s)); get = () => [s.get()]; break; }
            case 29: { const s = sel(SPEEDS.map((l, i) => ({ value: i, label: l })).slice(1), p[0] || 4); b.append(field(t("Speed", "MovementSpeedBox"), s)); get = () => [s.get()]; break; }
            case 30: { const s = sel(FREQS.map((l, i) => ({ value: i, label: l })).slice(1), p[0] || 3); b.append(field(t("Frequency", "MovementFrequencyBox"), s)); get = () => [s.get()]; break; }
            case 41: { const s = charIndexPick(p[0] || "", p[1] || 0); b.append(field(t("Image", "MovementCommand41"), s)); get = () => { const v = s.get(); return [v.name, v.index]; }; break; }
            case 42: { const s = num(p[0] === undefined ? 255 : p[0], { min: 0, max: 255 }); b.append(field(t("Opacity", "MovementCommand42"), s)); get = () => [s.get()]; break; }
            case 43: { const s = sel(BLENDS.map((l, i) => ({ value: i, label: l })), p[0] || 0); b.append(field(t("Blend Mode", "MovementCommand43"), s)); get = () => [s.get()]; break; }
            case 44: { const s = audioPick("se", p[0] || { name: "", volume: 90, pitch: 100, pan: 0 }); b.append(field(t("SE", "MovementCommands"), s)); get = () => [s.get()]; break; }
            // MZ: campo de uma linha (a lista da rota mostra uma linha só).
            case 45: { const s = txt(String(p[0] || "").replace(/\n/g, " "), { width: "100%" }); s.el.classList.add("mono"); b.append(field(t("Script", "MovementCommand45"), s)); get = () => [s.get().replace(/\n/g, " ")]; break; }
        }
    };
    return dialog({ title, width: "520px", height: "auto", build, onOk: () => ({ v: get() }) }).then(r => r ? r.v : null);
}

export function routeNeedsParams(code) { return !!BUTTON_LABELS[code]; }

let routeClip = null; // comandos de rota copiados (compartilhado entre diálogos + localStorage)

// Abre o diálogo "Movement Route". opts.target: valor do personagem (ou undefined para rota do evento)
// opts.targets: opções [{value,label}] para o seletor de alvo; opts.showWait: mostra "Wait for Completion".
// opts.previewStart(target) -> {mapId, x, y, d} | null: posição inicial para a prévia desenhada no mapa.
export function moveRouteDialog(route, { target, targets, showWait = true, title = t("Movement Route", "Dialog_MovementRoute"), previewStart } = {}) {
    const r = clone(route) || { list: [{ code: 0, parameters: [] }], repeat: false, skippable: false, wait: true };
    if (!r.list.length || r.list[r.list.length - 1].code !== 0) { r.list.push({ code: 0, parameters: [] }); }
    let selected = r.list.length - 1; // âncora / linha atual
    let selEnd = selected;            // outra ponta da seleção (Shift+clique, Shift+setas, Multi)
    let multi = false;
    let targetSel = null, repeat, skip, wait;
    let mini = null;
    return dialog({
        title, width: "1180px", height: "94vh",
        build: body => {
            const list = h("div", { class: "evList evRouteList" });
            const render = () => {
                list.innerHTML = "";
                const [a, b] = range();
                r.list.forEach((c, i) => {
                    const it = h("div", { class: "evListItem" + (i >= a && i <= b ? " selected" : ""), title: routeText(c) }, "◇" + routeText(c));
                    it.dataset.i = i;
                    list.append(it);
                });
                const s = list.querySelector(".selected");
                if (s) { s.scrollIntoView({ block: "nearest" }); }
                updatePreview();
            };
            // ---- prévia no mapa (simulação do runtime: routesim.js SimWorld) ----
            const pvHost = h("div", { class: "evRoutePvHost" });
            pvHost.__pv = () => ({ mini, sprites }); // inspeção (testes no navegador)
            const pvInfo = h("div", { class: "evDesc evRoutePvInfo" });
            let pvStart = null, pvMapId = 0, anim = null, playerRef = null, seed = 1, sprites = null;
            const curRoute = () => ({ list: r.list, repeat: repeat ? repeat.get() : r.repeat, skippable: skip ? skip.get() : r.skippable });
            // Mundo novo a cada desenho: eventos com o próprio movimento autônomo, jogador (posição de
            // referência ou o próprio alvo), seguidores, veículos e um estado de switches/variáveis de jogo novo.
            const buildWorld = st => new SimWorld({
                map: mini.map, flags: mini.tileset && mini.tileset.flags, mapId: st.mapId, events: st.events,
                system: db.system, actors: db.actors, seed, ownerId: st.ownerId || 0,
                player: st.isPlayer ? null : playerRef,
                main: { kind: st.isPlayer ? "player" : "event", id: st.selfId || 0, start: st, route: curRoute(), forced: st.forced !== false, pageIndex: st.pageIndex, data: st.event }
            });
            const ensureSprites = () => {
                if (!sprites) { sprites = new CharSprites(mini.charLayer, mini.tileset); }
                sprites.tileset = mini.tileset;
                return sprites;
            };
            const updatePreview = async recenter => {
                if (!previewStart) { return; }
                stopAnim();
                const st = await previewStart(targetSel ? targetSel.get() : target);
                if (!st) { pvInfo.textContent = t("No known position for the preview."); if (mini) { mini.layer.removeChildren(); } if (sprites) { sprites.destroy(); sprites = null; } return; }
                if (!mini) {
                    mini = new MiniMap(pvHost, { zoom: 0.75 });
                    // toque no mapa: posição de referência do jogador (Move/Turn toward/away from Player)
                    mini.onTap = (x, y) => { if (pvStart && !pvStart.isPlayer) { playerRef = { x, y, d: 2 }; updatePreview(); } };
                }
                if (pvMapId !== st.mapId) {
                    pvMapId = st.mapId; await mini.load(getApi(), st.mapId); recenter = true;
                    if (sprites) { sprites.destroy(); sprites = null; }
                    const s = db.system || {};
                    playerRef = s.startMapId === st.mapId ? { x: s.startX, y: s.startY, d: 2 } : null;
                }
                pvStart = st;
                const route = curRoute();
                const world0 = buildWorld(st);
                if (!world0.main) { pvInfo.textContent = t("No known position for the preview."); return; }
                ensureSprites().sync(world0); // situação inicial (todos parados no quadro 0)
                const res = runRoute(buildWorld(st), route);
                drawRoute(mini.layer, st, res, route.repeat, selected, st.isPlayer ? null : playerRef);
                if (recenter) { mini.centerOn(st.x, st.y); }
                const end = res.char, w = res.world;
                const secs = (res.frames / 60).toFixed(1);
                const parts = [`(${st.x},${st.y}) → (${end.x},${end.y})`, t("%1 frames (%2 s)", "MZEditor", res.frames, secs)];
                if (res.stuck) { parts.push(t("blocked: the route stops here (no \"Skip If Cannot Move\")", "MZEditor")); }
                const usesPlayer = r.list.some(c => [10, 11, 25, 26].includes(c.code));
                const usesRandom = r.list.some(c => [9, 23, 24].includes(c.code)) || w.events.some(e => e !== end && (e._moveType === 1 || e._moveType === 2));
                if (usesPlayer && !st.isPlayer) { parts.push(playerRef ? t("player at (%1,%2): tap the map to move it", "MZEditor", playerRef.x, playerRef.y) : t("the player is not on this map: tap the map to place it", "MZEditor")); }
                if (usesRandom) { parts.push("\u{1F3B2} " + t("random: one possible outcome", "MZEditor")); }
                const moving = w.events.filter(e => e !== end && e._moveType > 0 && e._pageIndex >= 0).length;
                if (moving) { parts.push(t("%1 other event(s) with autonomous movement", "MZEditor", moving)); }
                if (st.isPlayer && w.player.followers.some(f => f.visible)) { parts.push(t("%1 follower(s)", "MZEditor", w.player.followers.filter(f => f.visible).length)); }
                const sws = [...new Set(w.switchLog.map(s => s.id))];
                if (sws.length) { parts.push(t("switches (simulated, not saved): %1", "MZEditor", sws.map(id => `#${db.pad(id)} ${w.sw[id] ? "ON" : "OFF"}`).join(", "))); }
                if (w.scripts.ran) { parts.push(w.scripts.errors.length ? t("Script: error \"%1\"", "MZEditor", w.scripts.errors[0].msg) : t("Script: %1 run(s)", "MZEditor", w.scripts.ran)); }
                pvInfo.textContent = parts.join(" · ");
            };
            const stopAnim = () => { if (anim && mini && mini.app) { mini.app.ticker.remove(anim.fn); } anim = null; };
            // ▶ Preview: o mundo anda quadro a quadro como no jogo: o alvo segue a rota (velocidade, frequência,
            // espera, salto) e os outros eventos, o jogador e os seguidores se movem ao mesmo tempo.
            const playPreview = () => {
                if (!mini || !pvStart) { return; }
                stopAnim();
                const route = curRoute();
                const world = buildWorld(pvStart);
                const ch = world.main;
                if (!ch) { return; }
                for (const c of mini.layer.children) { c.alpha = 0.35; } // rota desenhada fica de fundo
                const sp = ensureSprites();
                sp.sync(world);
                let acc = 0, idle = 0, tail = 0;
                const fn = () => {
                    acc += mini.app.ticker.deltaMS;
                    let guard = 0;
                    while (acc >= 1000 / 60 && guard++ < 10) {
                        acc -= 1000 / 60;
                        const n = ch.log.length;
                        world.update();
                        idle = ch.log.length > n && ch.log[ch.log.length - 1].ok ? 0 : idle + 1;
                        if (ch.ended && ch.isStopping()) { tail++; }
                    }
                    sp.sync(world);
                    const done = tail > 24 || world.frame > 60 * 600 || (!route.skippable && idle > 240 && ch.isStopping() && ch._waitCount <= 0);
                    if (done) { mini.app.ticker.remove(fn); anim = null; setTimeout(() => { if (!anim) { updatePreview(); } }, 600); }
                };
                anim = { fn };
                mini.app.ticker.add(fn);
            };
            // ---- seleção e edição da lista (como a lista do MZ: Shift+clique, menu, atalhos) ----
            const range = () => { const a = Math.min(selected, selEnd); let b = Math.max(selected, selEnd); if (b === r.list.length - 1 && a < b) { b--; } return [a, b]; };
            const selCmds = () => { const [a, b] = range(); return r.list.slice(a, b + 1).filter(c => c.code); };
            const pick = (i, extend) => { if (extend || multi) { selEnd = i; } else { selected = selEnd = i; } render(); };
            const ops = {
                edit: () => editAt(selected),
                copy: () => { const c = selCmds(); if (c.length) { routeClip = clone(c); try { localStorage.setItem("mzRouteClip", JSON.stringify(routeClip)); } catch (e) { /* ignora */ } } },
                cut: () => { ops.copy(); ops.del(); },
                paste: () => {
                    let c = routeClip;
                    if (!c) { try { c = JSON.parse(localStorage.getItem("mzRouteClip") || "null"); } catch (e) { c = null; } }
                    if (!c || !c.length) { return; }
                    const at = range()[0];
                    r.list.splice(at, 0, ...clone(c));
                    selected = selEnd = at + c.length; render();
                },
                del: () => {
                    const [a, b] = range();
                    if (!r.list.slice(a, b + 1).some(c => c.code)) { return; }
                    r.list.splice(a, b - a + 1, ...r.list.slice(a, b + 1).filter(c => !c.code));
                    selected = selEnd = Math.min(a, r.list.length - 1); render();
                },
                selectAll: () => { selected = 0; selEnd = r.list.length - 1; render(); },
                clear: () => { r.list = [{ code: 0, parameters: [] }]; selected = selEnd = 0; render(); }
            };
            const menu = async (x, y) => {
                const has = selCmds().length > 0;
                const cur = r.list[selected];
                await actionMenu([
                    { label: t("Edit", "StandardPopupMenu") + "…", disabled: !cur.code || !routeNeedsParams(cur.code), action: ops.edit },
                    "-",
                    { label: t("Cut", "BasicConstants"), disabled: !has, action: ops.cut },
                    { label: t("Copy", "BasicConstants"), disabled: !has, action: ops.copy },
                    { label: t("Paste", "BasicConstants"), action: ops.paste },
                    { label: t("Delete", "BasicConstants"), disabled: !has, action: ops.del },
                    "-",
                    { label: t("Select All", "BasicConstants"), action: ops.selectAll },
                    { label: t("Clear", "BasicConstants"), action: ops.clear }
                ], { x, y });
            };
            // toque = seleciona, duplo toque = editar, toque longo = menu; botão direito = menu.
            list.tabIndex = 0;
            let lastTap = { i: -1, t: 0 }, pressTimer = null, pressPos = null, longFired = false;
            const rowAt = e => { const it = e.target.closest(".evListItem"); return it ? Number(it.dataset.i) : -1; };
            const inRange = i => { const [a, b] = range(); return i >= a && i <= b; };
            list.addEventListener("pointerdown", e => {
                const i = rowAt(e); if (i < 0) { return; }
                longFired = false; pressPos = { x: e.clientX, y: e.clientY };
                clearTimeout(pressTimer);
                if (e.pointerType !== "mouse") { pressTimer = setTimeout(() => { longFired = true; if (!inRange(i)) { pick(i, false); } menu(pressPos.x, pressPos.y); }, 550); }
            });
            list.addEventListener("pointermove", e => { if (pressPos && Math.hypot(e.clientX - pressPos.x, e.clientY - pressPos.y) > 10) { clearTimeout(pressTimer); } });
            list.addEventListener("pointerup", e => {
                clearTimeout(pressTimer);
                if (longFired || e.button === 2) { return; }
                const i = rowAt(e); if (i < 0) { return; }
                const now = Date.now();
                if (lastTap.i === i && now - lastTap.t < 400 && !e.shiftKey) { lastTap = { i: -1, t: 0 }; editAt(i); return; }
                lastTap = { i, t: now };
                pick(i, e.shiftKey);
            });
            list.addEventListener("pointercancel", () => clearTimeout(pressTimer));
            list.addEventListener("contextmenu", e => { e.preventDefault(); const i = rowAt(e); if (i >= 0 && !inRange(i)) { pick(i, false); } menu(e.clientX, e.clientY); });
            list.addEventListener("keydown", e => {
                const mod = e.ctrlKey || e.metaKey;
                if (e.key === "Enter" && !mod) { e.preventDefault(); ops.edit(); }
                else if (e.key === "Delete") { e.preventDefault(); ops.del(); }
                else if (mod && e.key === "c") { e.preventDefault(); ops.copy(); }
                else if (mod && e.key === "x") { e.preventDefault(); ops.cut(); }
                else if (mod && e.key === "v") { e.preventDefault(); ops.paste(); }
                else if (mod && e.key === "a") { e.preventDefault(); ops.selectAll(); }
                else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                    e.preventDefault();
                    const d = e.key === "ArrowDown" ? 1 : -1;
                    const cur = e.shiftKey ? selEnd : selected;
                    pick(Math.max(0, Math.min(r.list.length - 1, cur + d)), e.shiftKey);
                }
            });
            const insert = async code => {
                let params = [];
                if (routeNeedsParams(code)) {
                    params = await paramDialog(code, null);
                    if (!params) { return; }
                }
                const at = range()[0];
                r.list.splice(at, 0, { code, parameters: params });
                selected = selEnd = at + 1;
                render();
            };
            const editAt = async i => {
                const c = r.list[i];
                if (!c.code || !routeNeedsParams(c.code)) { return; }
                const p = await paramDialog(c.code, c.parameters);
                if (p) { c.parameters = p; render(); }
            };
            const left = h("div", { class: "evRouteLeft" });
            if (targets) {
                targetSel = sel(targets, target);
                targetSel.onChange(() => updatePreview(true));
                left.append(field(t("Character", "Constants"), targetSel));
            }
            const multiBtn = h("button", { type: "button", class: "evBtn toggle", title: t("Select multiple (same as Shift+click)") }, t("Multi-select"));
            multiBtn.addEventListener("click", () => { multi = !multi; multiBtn.classList.toggle("on", multi); if (!multi) { selEnd = selected; render(); } });
            const tb = (label, fn) => h("button", { type: "button", class: "evBtn", onclick: fn }, label);
            left.append(list, h("div", { class: "evRow evListTools" },
                tb(t("Edit", "StandardPopupMenu"), () => ops.edit()), tb(t("Cut", "BasicConstants"), () => ops.cut()), tb(t("Copy", "BasicConstants"), () => ops.copy()),
                tb(t("Paste", "BasicConstants"), () => ops.paste()), tb(t("Delete", "BasicConstants"), () => ops.del()), multiBtn,
                tb("☰", e => { const rc = e.currentTarget.getBoundingClientRect(); menu(rc.left, rc.bottom); })));
            repeat = chk(t("Repeat Movements", "Layout_MovementRoute"), r.repeat);
            skip = chk(t("Skip If Cannot Move", "Layout_MovementRoute"), r.skippable);
            wait = chk(t("Wait for Completion", "Layout_MovementRoute"), r.wait);
            repeat.onChange(() => updatePreview());
            skip.onChange(() => updatePreview());
            left.append(h("fieldset", { class: "evGroup" }, h("legend", null, t("Options", "Layout_MovementRoute")), repeat.el, skip.el, showWait ? wait.el : null));
            const cmds = h("fieldset", { class: "evGroup evRouteCmds" }, h("legend", null, t("Movement Commands", "Layout_MovementRoute")));
            const grid = h("div", { class: "evRouteGrid" });
            for (const colCodes of BUTTONS) {
                const c = h("div", { class: "evRouteCol" });
                for (const code of colCodes) {
                    c.append(h("button", { type: "button", class: "evBtn evRouteBtn", onclick: () => insert(code) }, BUTTON_LABELS[code] || ROUTE_NAMES[code]));
                }
                grid.append(c);
            }
            cmds.append(grid);
            const center = previewStart ? h("div", { class: "evRouteCenter" },
                h("div", { class: "evRow" }, h("span", { class: "evContentsTitle" }, t("Preview", "Constants")),
                    h("button", { type: "button", class: "evBtn", onclick: playPreview }, "▶ " + t("Preview", "Constants")),
                    h("button", { type: "button", class: "evBtn", title: t("Draw the random moves again", "MZEditor"), onclick: () => { seed = (seed * 48271 + 11) % 2147483647; updatePreview(); } }, "\u{1F3B2}")),
                pvHost, pvInfo) : null;
            body.append(h("div", { class: "evRouteWrap" + (center ? " withPreview" : "") }, left, center, cmds));
            render();
            requestAnimationFrame(() => updatePreview(true));
        },
        onOk: () => {
            r.repeat = repeat.get(); r.skippable = skip.get(); r.wait = showWait ? wait.get() : false;
            return { v: { route: r, target: targetSel ? targetSel.get() : target } };
        }
    }).then(x => { if (mini) { mini.destroy(); mini = null; } return x ? x.v : null; });
}

// ---------- desenho da prévia ----------
const DX = { 2: 0, 4: -1, 6: 1, 8: 0 }, DY = { 2: 1, 4: 0, 6: 0, 8: -1 };

function arrowHead(g, x1, y1, x2, y2, color) {
    const a = Math.atan2(y2 - y1, x2 - x1), s = 13;
    g.lineStyle(0).beginFill(color, 1);
    g.moveTo(x2, y2);
    g.lineTo(x2 - s * Math.cos(a - 0.45), y2 - s * Math.sin(a - 0.45));
    g.lineTo(x2 - s * Math.cos(a + 0.45), y2 - s * Math.sin(a + 0.45));
    g.closePath();
    g.endFill();
}
function label(layer, text, x, y, fill = 0xffffff) {
    const tx = new PIXI.Text(text, { fontSize: 22, fill, stroke: 0x000000, strokeThickness: 4, fontWeight: "bold" });
    tx.anchor.set(0.5, 0.5);
    tx.position.set(x, y);
    layer.addChild(tx);
}

// Desenha o resultado de runRoute (routesim.js): moldura azul no início, setas por passo executado
// (vermelhas; laranja para os sorteados e para/longe do jogador; amarela a do comando selecionado), arco
// para saltos, ✕ onde o movimento foi bloqueado, ponto para giros, "…" para Wait, moldura branca no fim,
// tracejado de volta ao início com Repeat e o jogador de referência (moldura verde "P").
export function drawRoute(layer, st, res, repeat, selectedIndex, player) {
    for (const c of layer.removeChildren()) { c.destroy(); }
    const g = new PIXI.Graphics();
    layer.addChild(g);
    const C = v => (v + 0.5) * 48;
    if (player) {
        g.lineStyle(3, 0x30d030, 1).drawRect(player.x * 48 + 3, player.y * 48 + 3, 42, 42);
        label(layer, "P", C(player.x), C(player.y), 0x80ff80);
    }
    g.lineStyle(3, 0x2a6cff, 1).drawRect(st.x * 48 + 2, st.y * 48 + 2, 44, 44);
    const seen = new Set();
    for (const e of res.log) {
        const sel = e.index === selectedIndex;
        const guess = [9, 10, 11].includes(e.code);
        const color = sel ? 0xffff00 : guess ? 0xff9a20 : 0xff3030;
        const moved = e.x !== e.x0 || e.y !== e.y0;
        if (e.jump || (moved && e.code >= 1 && e.code <= 13)) {
            const x1 = C(e.x0), y1 = C(e.y0), x2 = C(e.x), y2 = C(e.y);
            const len = Math.hypot(x2 - x1, y2 - y1) || 1;
            const ex = x2 - (x2 - x1) / len * 10, ey = y2 - (y2 - y1) / len * 10;
            if (e.jump) {
                const mx = (x1 + x2) / 2, my = Math.min(y1, y2) - 40 - len / 4;
                g.lineStyle(6, 0x000000, 0.45).moveTo(x1, y1).quadraticCurveTo(mx, my, ex, ey);
                g.lineStyle(3, color, 1).moveTo(x1, y1).quadraticCurveTo(mx, my, ex, ey);
                arrowHead(g, mx, my, x2, y2, color);
            } else if (len > 48 * 1.6) { // passou pela borda de um mapa em loop: só um toco de saída
                g.lineStyle(3, color, 1).moveTo(x1, y1).lineTo(x1 + Math.sign(x1 - x2) * 24, y1 + Math.sign(y1 - y2) * 24);
            } else {
                g.lineStyle(6, 0x000000, 0.45).moveTo(x1, y1).lineTo(ex, ey);
                g.lineStyle(3, color, 1).moveTo(x1, y1).lineTo(ex, ey);
                arrowHead(g, x1, y1, x2, y2, color);
            }
        } else if (e.code >= 1 && e.code <= 13 && !e.ok) {
            // bloqueado: ✕ na borda do tile, do lado para onde tentou andar
            const d = e.code === 13 ? 10 - e.d : e.d;
            const key = e.x + "," + e.y + "," + d;
            if (seen.has(key)) { continue; }
            seen.add(key);
            const cx = C(e.x) + (DX[d] || 0) * 20, cy = C(e.y) + (DY[d] || 0) * 20;
            g.lineStyle(4, 0x000000, 0.6).moveTo(cx - 7, cy - 7).lineTo(cx + 7, cy + 7).moveTo(cx + 7, cy - 7).lineTo(cx - 7, cy + 7);
            g.lineStyle(2.5, sel ? 0xffff00 : 0xff2020, 1).moveTo(cx - 7, cy - 7).lineTo(cx + 7, cy + 7).moveTo(cx + 7, cy - 7).lineTo(cx - 7, cy + 7);
        } else if (e.code >= 16 && e.code <= 26) {
            g.lineStyle(1, 0x000000, 1).beginFill(sel ? 0xffff00 : 0xffffff, 1).drawCircle(C(e.x) + DX[e.d] * 16, C(e.y) + DY[e.d] * 16, 5).endFill();
        } else if (e.code === 15) {
            label(layer, "…", C(e.x) + 14, C(e.y) - 14, sel ? 0xffff00 : 0xffffff);
        }
    }
    const end = res.char;
    g.lineStyle(3, 0xffffff, 1).drawRect(end.x * 48 + 6, end.y * 48 + 6, 36, 36);
    if (res.stuck) { label(layer, "✕", C(end.x), C(end.y), 0xff4040); }
    if (repeat && !res.stuck && (end.x !== st.x || end.y !== st.y)) {
        const x1 = C(end.x), y1 = C(end.y), x2 = C(st.x), y2 = C(st.y);
        const n = Math.max(2, Math.floor(Math.hypot(x2 - x1, y2 - y1) / 12));
        g.lineStyle(2, 0xffffff, 0.85);
        for (let i = 0; i < n; i += 2) {
            g.moveTo(x1 + (x2 - x1) * i / n, y1 + (y2 - y1) * i / n).lineTo(x1 + (x2 - x1) * (i + 1) / n, y1 + (y2 - y1) * (i + 1) / n);
        }
    }
}
