// Diálogo "Propriedades do Mapa" do MZ (Dialog_MapProperties), com os textos da tradução
// pt_BR oficial do editor, e os subdiálogos: seleção de áudio (Layout_AudioSelector),
// fundo de batalha, panorama (Layout_ParallaxBack) e encontro (Dialog_Encounter).

import { t } from "../i18n.js";

const NONE = () => "(" + t("None", "Constants") + ")";

const el = (tag, attrs = {}, ...children) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
        if (k === "class") { e.className = v; }
        else if (k === "text") { e.textContent = v; }
        else if (k.startsWith("on")) { e.addEventListener(k.slice(2), v); }
        else if (v === true) { e.setAttribute(k, ""); }
        else if (v !== false && v !== null && v !== undefined) { e.setAttribute(k, v); }
    }
    for (const c of children) {
        if (c !== null && c !== undefined) {
            e.append(c);
        }
    }
    return e;
};

function field(label, input, title) {
    return el("label", { class: "mtField", title: title || "" }, el("span", { text: label }), input);
}

function numberInput(value, min, max) {
    return el("input", { type: "number", min, max, value, inputmode: "numeric" });
}

function clampInt(v, min, max) {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
}

// Lista de arquivos (sem extensão, sem duplicatas) de uma pasta do projeto.
async function listAssets(api, dir) {
    const items = await api.project.list(dir).catch(() => []);
    const names = new Set();
    for (const it of items || []) {
        const name = typeof it === "string" ? it : (it.name || "");
        const isDir = typeof it === "object" && (it.dir || it.isDirectory || it.type === "dir");
        if (!name || isDir) { continue; }
        const base = name.replace(/\.(png|ogg|m4a|webp|png_|ogg_|m4a_)$/i, "");
        if (base !== name) { names.add(base); }
    }
    return [...names].sort((a, b) => a.localeCompare(b));
}

// ---------- Seleção de áudio (BGM/BGS) ----------
export function openAudioDialog(api, folder, audio) {
    return new Promise(resolve => {
        const cur = { name: "", volume: 90, pitch: 100, pan: 0, ...(audio || {}) };
        let player = null;
        const stop = () => { if (player) { player.pause(); player = null; } };
        const list = el("select", { size: 12, class: "mtList" });
        const vol = el("input", { type: "range", min: 0, max: 100, value: cur.volume });
        const pitch = el("input", { type: "range", min: 50, max: 150, value: cur.pitch });
        const pan = el("input", { type: "range", min: -100, max: 100, value: cur.pan });
        const lab = (r, fmt) => { const s = el("span", { class: "mtRangeVal" }); const u = () => { s.textContent = fmt(r.value); }; r.addEventListener("input", u); u(); return s; };
        const play = () => {
            stop();
            const name = list.value;
            if (!name) { return; }
            player = new Audio(`/project/audio/${folder}/${encodeURIComponent(name)}.ogg`);
            player.volume = vol.value / 100;
            player.playbackRate = pitch.value / 100;
            player.loop = true;
            player.play().catch(() => {
                player = new Audio(`/project/audio/${folder}/${encodeURIComponent(name)}.m4a`);
                player.volume = vol.value / 100;
                player.play().catch(() => {});
            });
        };
        const dlg = api.openDialog({
            title: folder.toUpperCase(),
            width: "620px",
            height: "460px",
            buttons: [
                { label: t("OK", "BasicConstants"), primary: true, onClick: () => { stop(); resolve({ name: list.value || "", volume: +vol.value, pitch: +pitch.value, pan: +pan.value }); } },
                { label: t("Cancel", "BasicConstants"), onClick: () => { stop(); resolve(null); } }
            ]
        });
        const body = el("div", { class: "mtAudio" },
            el("div", { class: "mtAudioList" }, list),
            el("div", { class: "mtAudioSide" },
                el("button", { class: "mtBtn", text: t("Play", "Layout_AudioSelector"), title: t("Plays the selected file.", "Layout_AudioSelector"), onclick: play }),
                el("button", { class: "mtBtn", text: t("Stop", "Layout_AudioSelector"), title: t("Stops playback.", "Layout_AudioSelector"), onclick: stop }),
                field(t("Volume", "Layout_AudioSelector"), el("div", { class: "mtRange" }, vol, lab(vol, v => v + "%")), t("Volume for audio playback.", "Layout_AudioSelector")),
                field(t("Pitch", "Layout_AudioSelector"), el("div", { class: "mtRange" }, pitch, lab(pitch, v => v + "%")), t("Pitch for audio playback.", "Layout_AudioSelector")),
                field(t("Pan", "Layout_AudioSelector"), el("div", { class: "mtRange" }, pan, lab(pan, v => v)), t("Pan for audio playback.", "Layout_AudioSelector"))
            )
        );
        dlg.body.appendChild(body);
        list.append(el("option", { value: "", text: NONE() }));
        listAssets(api, "audio/" + folder).then(names => {
            for (const n of names) {
                list.append(el("option", { value: n, text: n }));
            }
            list.value = cur.name || "";
        });
        list.addEventListener("dblclick", play);
    });
}

// ---------- Seleção de imagem (fundo de batalha / panorama) ----------
export function openImageDialog(api, title, folders, current) {
    return new Promise(resolve => {
        const lists = [];
        const preview = el("div", { class: "mtImgPreview" });
        const refresh = () => {
            preview.innerHTML = "";
            folders.forEach((folder, i) => {
                const name = lists[i].value;
                if (name) {
                    preview.append(el("img", { src: `/project/img/${folder}/${encodeURIComponent(name)}.png`, alt: "" }));
                }
            });
        };
        const dlg = api.openDialog({
            title,
            width: "760px",
            height: "480px",
            buttons: [
                { label: t("OK", "BasicConstants"), primary: true, onClick: () => resolve(lists.map(l => l.value || "")) },
                { label: t("Cancel", "BasicConstants"), onClick: () => resolve(null) }
            ]
        });
        const cols = el("div", { class: "mtImgLists" });
        folders.forEach((folder, i) => {
            const list = el("select", { size: 14, class: "mtList" });
            list.append(el("option", { value: "", text: NONE() }));
            list.addEventListener("change", refresh);
            lists.push(list);
            cols.append(list);
            listAssets(api, "img/" + folder).then(names => {
                for (const n of names) {
                    list.append(el("option", { value: n, text: n }));
                }
                list.value = current[i] || "";
                refresh();
            });
        });
        dlg.body.append(el("div", { class: "mtImgDialog" }, cols, preview));
    });
}

// ---------- Encontro ----------
// Área de transferência de encontros (vale entre mapas, como no MZ).
let encClipboard = null;

function openEncounterDialog(api, troops, enc) {
    return new Promise(resolve => {
        const cur = enc ? JSON.parse(JSON.stringify(enc)) : { troopId: 1, weight: 10, regionSet: [] };
        const troop = el("select");
        troops.forEach((tr, i) => {
            if (tr) {
                troop.append(el("option", { value: i, text: String(i).padStart(4, "0") + " " + (tr.name || "") }));
            }
        });
        troop.value = cur.troopId;
        const weight = numberInput(cur.weight, 0, 100);
        const rangeAll = el("input", { type: "radio", name: "mtEncRange", checked: !cur.regionSet.length });
        const rangeReg = el("input", { type: "radio", name: "mtEncRange", checked: cur.regionSet.length > 0 });
        const regs = [0, 1, 2].map(i => numberInput(cur.regionSet[i] || 0, 0, 255));
        const sync = () => regs.forEach(r => { r.disabled = !rangeReg.checked; });
        rangeAll.addEventListener("change", sync);
        rangeReg.addEventListener("change", sync);
        sync();
        const dlg = api.openDialog({
            title: t("Encounter", "Dialog_Encounter"),
            width: "440px",
            height: "400px",
            buttons: [
                {
                    label: t("OK", "BasicConstants"), primary: true, onClick: () => {
                        const regionSet = rangeReg.checked ? regs.map(r => clampInt(r.value, 0, 255)).filter(v => v > 0) : [];
                        resolve({ troopId: Number(troop.value) || 1, weight: clampInt(weight.value, 0, 100), regionSet });
                    }
                },
                { label: t("Cancel", "BasicConstants"), onClick: () => resolve(null) }
            ]
        });
        dlg.body.append(
            el("fieldset", { class: "mtGroup" }, el("legend", { text: t("Troop and Weight", "Dialog_Encounter") }),
                field(t("Troop", "Constants"), troop, t("Troop to be encountered.", "Dialog_Encounter")),
                field(t("Weight", "Dialog_Encounter"), weight, t("Value that affects the frequency at which the troop is encountered.", "Dialog_Encounter"))),
            el("fieldset", { class: "mtGroup", title: t("Range in which the troop is encountered.", "Dialog_Encounter") }, el("legend", { text: t("Range", "Dialog_Encounter") }),
                el("label", { class: "mtCheck", title: t("No limit on the encounter range.", "Dialog_Encounter") }, rangeAll, " " + t("Entire Map", "Dialog_Encounter")),
                el("label", { class: "mtCheck", title: t("Specifies the numbers set with the map editor.", "Dialog_Encounter") }, rangeReg, " " + t("Specify by Region ID", "Dialog_Encounter")),
                el("div", { class: "mtRow", title: t("Valid when a non-zero value is entered.", "Dialog_Encounter") }, ...regs))
        );
    });
}

function audioButton(api, folder, getAudio, setAudio) {
    const btn = el("button", { class: "mtBtn mtPick" });
    const show = () => { btn.textContent = (getAudio() && getAudio().name) || NONE(); };
    btn.addEventListener("click", async () => {
        const r = await openAudioDialog(api, folder, getAudio());
        if (r) { setAudio(r); show(); }
    });
    show();
    return btn;
}

// Abre o diálogo de propriedades. map: objeto MapXXX.json (editado numa cópia);
// info: entrada de MapInfos. Resolve com {map, name} ou null (cancelado).
export async function openMapProperties(api, { title, map, info }) {
    const [tilesets, troops] = await Promise.all([
        api.project.tilesets(),
        api.project.readJson("data/Troops.json").catch(() => [null])
    ]);
    const m = JSON.parse(JSON.stringify(map));
    return new Promise(resolve => {
        const name = el("input", { type: "text", value: info ? info.name : "" });
        const displayName = el("input", { type: "text", value: m.displayName || "" });
        const tileset = el("select");
        tilesets.forEach((ts, i) => {
            if (ts) {
                tileset.append(el("option", { value: i, text: String(i).padStart(4, "0") + " " + (ts.name || "") }));
            }
        });
        tileset.value = m.tilesetId;
        const width = numberInput(m.width, 0, 256);
        const height = numberInput(m.height, 0, 256);
        const scroll = el("select");
        [t("No Loop", "Dialog_MapProperties"), t("Loop Vertically", "Dialog_MapProperties"), t("Loop Horizontally", "Dialog_MapProperties"), t("Loop Both", "Dialog_MapProperties")].forEach((s, i) => scroll.append(el("option", { value: i, text: s })));
        scroll.value = m.scrollType || 0;
        const encStep = numberInput(m.encounterStep || 30, 1, 999);

        const bgmOn = el("input", { type: "checkbox", checked: !!m.autoplayBgm });
        const bgsOn = el("input", { type: "checkbox", checked: !!m.autoplayBgs });
        const bgmBtn = audioButton(api, "bgm", () => m.bgm, a => { m.bgm = a; });
        const bgsBtn = audioButton(api, "bgs", () => m.bgs, a => { m.bgs = a; });
        const bbOn = el("input", { type: "checkbox", checked: !!m.specifyBattleback });
        const bbBtn = el("button", { class: "mtBtn mtPick" });
        const showBb = () => { bbBtn.textContent = [m.battleback1Name, m.battleback2Name].filter(Boolean).join(" & ") || NONE(); };
        bbBtn.addEventListener("click", async () => {
            const r = await openImageDialog(api, t("Battle Background", "EventCommand283"), ["battlebacks1", "battlebacks2"], [m.battleback1Name, m.battleback2Name]);
            if (r) { [m.battleback1Name, m.battleback2Name] = r; showBb(); }
        });
        showBb();
        const dash = el("input", { type: "checkbox", checked: !!m.disableDashing });
        const syncEnabled = () => {
            bgmBtn.disabled = !bgmOn.checked;
            bgsBtn.disabled = !bgsOn.checked;
            bbBtn.disabled = !bbOn.checked;
        };
        [bgmOn, bgsOn, bbOn].forEach(c => c.addEventListener("change", syncEnabled));
        syncEnabled();

        // Panorama
        const pxBtn = el("button", { class: "mtBtn mtPick" });
        const showPx = () => { pxBtn.textContent = m.parallaxName || NONE(); };
        pxBtn.addEventListener("click", async () => {
            const r = await openImageDialog(api, t("Parallax Background", "Dialog_MapProperties"), ["parallaxes"], [m.parallaxName]);
            if (r) { m.parallaxName = r[0]; showPx(); }
        });
        showPx();
        const loopX = el("input", { type: "checkbox", checked: !!m.parallaxLoopX });
        const loopY = el("input", { type: "checkbox", checked: !!m.parallaxLoopY });
        const sx = numberInput(m.parallaxSx || 0, -32, 32);
        const sy = numberInput(m.parallaxSy || 0, -32, 32);
        const pxShow = el("input", { type: "checkbox", checked: !!m.parallaxShow });
        const syncLoop = () => { sx.disabled = !loopX.checked; sy.disabled = !loopY.checked; };
        loopX.addEventListener("change", syncLoop);
        loopY.addEventListener("change", syncLoop);
        syncLoop();
        const note = el("textarea", { rows: 4 });
        note.value = m.note || "";

        // Encontros
        const encList = m.encounterList ? m.encounterList.slice() : [];
        const encBody = el("tbody");
        let encSel = -1;
        const troopName = id => (troops[id] ? troops[id].name : "") || "";
        const drawEnc = () => {
            encBody.innerHTML = "";
            encList.forEach((e, i) => {
                const tr = el("tr", { class: i === encSel ? "sel" : "" },
                    el("td", { text: troopName(e.troopId) }),
                    el("td", { text: String(e.weight) }),
                    el("td", { text: e.regionSet && e.regionSet.length ? e.regionSet.join(", ") : t("Entire Map", "Group_Encounters") }));
                tr.addEventListener("click", () => { encSel = i; drawEnc(); });
                tr.addEventListener("dblclick", () => editEnc(i));
                encBody.append(tr);
            });
            const blank = el("tr", { class: "blank" }, el("td", { colspan: 3, text: " " }));
            blank.addEventListener("dblclick", () => editEnc(-1));
            blank.addEventListener("click", () => { encSel = -1; drawEnc(); });
            encBody.append(blank);
        };
        const editEnc = async i => {
            const r = await openEncounterDialog(api, troops, i >= 0 ? encList[i] : null);
            if (r) {
                if (i >= 0) { encList[i] = r; } else { encList.push(r); encSel = encList.length - 1; }
                drawEnc();
            }
        };
        drawEnc();
        const encButtons = el("div", { class: "mtRow" },
            el("button", { class: "mtBtn", text: t("New", "StandardPopupMenu"), onclick: () => editEnc(-1) }),
            el("button", { class: "mtBtn", text: t("Edit", "StandardPopupMenu"), onclick: () => { if (encSel >= 0) { editEnc(encSel); } } }),
            el("button", { class: "mtBtn", text: t("Copy", "BasicConstants"), onclick: () => { if (encSel >= 0) { encClipboard = JSON.parse(JSON.stringify(encList[encSel])); } } }),
            el("button", { class: "mtBtn", text: t("Paste", "BasicConstants"), onclick: () => {
                if (!encClipboard) { return; }
                // como no MZ, cola antes da linha selecionada (ou no fim, na linha vazia)
                const at = encSel >= 0 ? encSel : encList.length;
                encList.splice(at, 0, JSON.parse(JSON.stringify(encClipboard)));
                encSel = at;
                drawEnc();
            } }),
            el("button", { class: "mtBtn", text: t("Delete", "BasicConstants"), onclick: () => { if (encSel >= 0) { encList.splice(encSel, 1); encSel = -1; drawEnc(); } } }));

        const dlg = api.openDialog({
            title: title || t("Map Properties", "Dialog_MapProperties"),
            width: "980px",
            height: "600px",
            buttons: [
                {
                    label: t("OK", "BasicConstants"), primary: true, onClick: () => {
                        m.displayName = displayName.value;
                        m.tilesetId = Number(tileset.value) || 1;
                        m.scrollType = Number(scroll.value) || 0;
                        m.encounterStep = clampInt(encStep.value, 1, 999);
                        m.autoplayBgm = bgmOn.checked;
                        m.autoplayBgs = bgsOn.checked;
                        m.specifyBattleback = bbOn.checked;
                        m.disableDashing = dash.checked;
                        m.parallaxLoopX = loopX.checked;
                        m.parallaxLoopY = loopY.checked;
                        m.parallaxSx = clampInt(sx.value, -32, 32);
                        m.parallaxSy = clampInt(sy.value, -32, 32);
                        m.parallaxShow = pxShow.checked;
                        m.note = note.value;
                        m.encounterList = encList;
                        resolve({
                            map: m,
                            name: name.value,
                            width: clampInt(width.value, 0, 256),
                            height: clampInt(height.value, 0, 256)
                        });
                    }
                },
                { label: t("Cancel", "BasicConstants"), onClick: () => resolve(null) }
            ]
        });
        dlg.body.classList.add("mtProps");
        const general = el("fieldset", { class: "mtGroup", title: t("Basic map settings.", "Dialog_MapProperties") }, el("legend", { text: t("General Settings", "Constants") }),
            el("div", { class: "mtGrid2" },
                field(t("Name", "Constants"), name, t("Name of the map.", "Dialog_MapProperties")),
                field(t("Display Name", "Dialog_MapProperties"), displayName, t("Name displayed on the upper left part of the screen when moving to the map. Not displayed if left blank.", "Dialog_MapProperties")),
                field(t("Tileset", "Constants"), tileset, t("Tileset used for the map.", "Dialog_MapProperties")),
                el("div", { class: "mtRow" },
                    field(t("Width", "Dialog_MapProperties"), width, t("Horizontal size of the map.", "Dialog_MapProperties")),
                    field(t("Height", "Dialog_MapProperties"), height, t("Vertical size of the map.", "Dialog_MapProperties"))),
                field(t("Scroll Type", "Dialog_MapProperties"), scroll, t("Whether to wrap around from one side to the other.", "Dialog_MapProperties")),
                field(t("Enc. Steps", "Dialog_MapProperties"), encStep, t("Average number of steps between random encounters.", "Dialog_MapProperties"))),
            el("div", { class: "mtGrid2" },
                el("div", {}, el("label", { class: "mtCheck", title: t("Makes the BGM change automatically when moving to the map.", "Dialog_MapProperties") }, bgmOn, " " + t("Autoplay BGM", "Dialog_MapProperties")), bgmBtn),
                el("div", {}, el("label", { class: "mtCheck", title: t("Makes the BGS change automatically when moving to the map.", "Dialog_MapProperties") }, bgsOn, " " + t("Autoplay BGS", "Dialog_MapProperties")), bgsBtn),
                el("div", {}, el("label", { class: "mtCheck", title: t("Displays the specified background when a battle occurs on this map. When not specified, a background conforming to the terrain is automatically selected for world maps, and for other maps, a processed image of the map screen will be used as a background.", "Dialog_MapProperties") }, bbOn, " " + t("Specify Battleback", "Dialog_MapProperties")), bbBtn),
                el("div", {}, el("label", { class: "mtCheck", title: t("Makes it impossible to perform a dash on the map.", "Dialog_MapProperties") }, dash, " " + t("Disable Dashing", "Dialog_MapProperties")))),
            el("fieldset", { class: "mtGroup", title: t("Distant view image displayed in the transparent area of the map.", "Dialog_MapProperties") }, el("legend", { text: t("Parallax Background", "Dialog_MapProperties") }),
                field(t("Image", "Layout_ParallaxBack"), pxBtn, t("Image of the parallax background.", "Layout_ParallaxBack")),
                el("div", { class: "mtRow" },
                    el("label", { class: "mtCheck", title: t("Loops the parallax background horizontally.", "Layout_ParallaxBack") }, loopX, " " + t("Loop Horizontally", "Constants")),
                    field(t("Scroll", "Layout_ParallaxBack"), sx, t("Automatically performs horizontal scrolling at the specified speed.", "Layout_ParallaxBack"))),
                el("div", { class: "mtRow" },
                    el("label", { class: "mtCheck", title: t("Loops the parallax background vertically.", "Layout_ParallaxBack") }, loopY, " " + t("Loop Vertically", "Constants")),
                    field(t("Scroll", "Layout_ParallaxBack"), sy, t("Automatically performs vertical scrolling at the specified speed.", "Layout_ParallaxBack"))),
                el("label", { class: "mtCheck", title: t("Displays the parallax background in the map editor. This may appear differently than in the actual game.", "Dialog_MapProperties") }, pxShow, " " + t("Show in the Editor", "Dialog_MapProperties"))),
            field(t("Note", "Constants"), note));
        const enc = el("fieldset", { class: "mtGroup mtEnc", title: t("List of the troops for random encounters.", "Group_Encounters") }, el("legend", { text: t("Encounters", "Group_Encounters") }),
            el("div", { class: "mtTableWrap" },
                el("table", { class: "mtTable" },
                    el("thead", {}, el("tr", {}, el("th", { text: t("Troop", "Constants") }), el("th", { text: t("Weight", "Group_Encounters") }), el("th", { text: t("Range", "Group_Encounters") }))),
                    encBody)),
            encButtons);
        dlg.body.append(el("div", { class: "mtPropsCols" }, general, enc));
        name.focus();
    });
}

// Novo mapa com os padrões do MZ (17×13, tileset 1, passos 30, BGM/BGS vazios).
export function newMapData(tilesetId = 1) {
    const width = 17, height = 13;
    return {
        autoplayBgm: false, autoplayBgs: false, battleback1Name: "", battleback2Name: "",
        bgm: { name: "", pan: 0, pitch: 100, volume: 90 },
        bgs: { name: "", pan: 0, pitch: 100, volume: 90 },
        disableDashing: false, displayName: "", encounterList: [], encounterStep: 30,
        height, note: "", parallaxLoopX: false, parallaxLoopY: false, parallaxName: "",
        parallaxShow: true, parallaxSx: 0, parallaxSy: 0, scrollType: 0,
        specifyBattleback: false, tilesetId, width,
        data: new Array(width * height * 6).fill(0),
        events: [null]
    };
}
