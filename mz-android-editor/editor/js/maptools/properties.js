// Diálogo "Propriedades do Mapa" do MZ (Dialog_MapProperties), com os textos da tradução
// pt_BR oficial do editor, e os subdiálogos: seleção de áudio (Layout_AudioSelector),
// fundo de batalha, panorama (Layout_ParallaxBack) e encontro (Dialog_Encounter).

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
                { label: "Ok", primary: true, onClick: () => { stop(); resolve({ name: list.value || "", volume: +vol.value, pitch: +pitch.value, pan: +pan.value }); } },
                { label: "Cancelar", onClick: () => { stop(); resolve(null); } }
            ]
        });
        const body = el("div", { class: "mtAudio" },
            el("div", { class: "mtAudioList" }, list),
            el("div", { class: "mtAudioSide" },
                el("button", { class: "mtBtn", text: "Reproduzir", onclick: play }),
                el("button", { class: "mtBtn", text: "Parar", onclick: stop }),
                field("Volume", el("div", { class: "mtRange" }, vol, lab(vol, v => v + "%"))),
                field("Intensidade", el("div", { class: "mtRange" }, pitch, lab(pitch, v => v + "%"))),
                field("Panning", el("div", { class: "mtRange" }, pan, lab(pan, v => v)))
            )
        );
        dlg.body.appendChild(body);
        list.append(el("option", { value: "", text: "(Nenhum)" }));
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
                { label: "Ok", primary: true, onClick: () => resolve(lists.map(l => l.value || "")) },
                { label: "Cancelar", onClick: () => resolve(null) }
            ]
        });
        const cols = el("div", { class: "mtImgLists" });
        folders.forEach((folder, i) => {
            const list = el("select", { size: 14, class: "mtList" });
            list.append(el("option", { value: "", text: "(Nenhum)" }));
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
function openEncounterDialog(api, troops, enc) {
    return new Promise(resolve => {
        const cur = enc ? JSON.parse(JSON.stringify(enc)) : { troopId: 1, weight: 10, regionSet: [] };
        const troop = el("select");
        troops.forEach((t, i) => {
            if (t) {
                troop.append(el("option", { value: i, text: String(i).padStart(4, "0") + " " + (t.name || "") }));
            }
        });
        troop.value = cur.troopId;
        const weight = numberInput(cur.weight, 1, 100);
        const rangeAll = el("input", { type: "radio", name: "mtEncRange", checked: !cur.regionSet.length });
        const rangeReg = el("input", { type: "radio", name: "mtEncRange", checked: cur.regionSet.length > 0 });
        const regs = [0, 1, 2].map(i => numberInput(cur.regionSet[i] || 0, 0, 255));
        const sync = () => regs.forEach(r => { r.disabled = !rangeReg.checked; });
        rangeAll.addEventListener("change", sync);
        rangeReg.addEventListener("change", sync);
        sync();
        const dlg = api.openDialog({
            title: "Batalha",
            width: "440px",
            height: "400px",
            buttons: [
                {
                    label: "Ok", primary: true, onClick: () => {
                        const regionSet = rangeReg.checked ? regs.map(r => clampInt(r.value, 0, 255)).filter(v => v > 0) : [];
                        resolve({ troopId: Number(troop.value) || 1, weight: clampInt(weight.value, 1, 100), regionSet });
                    }
                },
                { label: "Cancelar", onClick: () => resolve(null) }
            ]
        });
        dlg.body.append(
            el("fieldset", { class: "mtGroup" }, el("legend", { text: "Tropa e Frequência" }),
                field("Tropa", troop, "Tropa a ser encontrada."),
                field("Frequência", weight, "Valor que afeta a frequência com a qual a tropa é encontrada.")),
            el("fieldset", { class: "mtGroup" }, el("legend", { text: "Área" }),
                el("label", { class: "mtCheck" }, rangeAll, " Mapa Inteiro"),
                el("label", { class: "mtCheck" }, rangeReg, " Especificar ID de Região"),
                el("div", { class: "mtRow" }, ...regs))
        );
    });
}

function audioButton(api, folder, getAudio, setAudio) {
    const btn = el("button", { class: "mtBtn mtPick" });
    const show = () => { btn.textContent = (getAudio() && getAudio().name) || "(Nenhum)"; };
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
        tilesets.forEach((t, i) => {
            if (t) {
                tileset.append(el("option", { value: i, text: String(i).padStart(4, "0") + " " + (t.name || "") }));
            }
        });
        tileset.value = m.tilesetId;
        const width = numberInput(m.width, 1, 256);
        const height = numberInput(m.height, 1, 256);
        const scroll = el("select");
        ["Sem deslocamento", "Desloc. Vertical", "Desloc. Horizontal", "Desloc. em ambos"].forEach((t, i) => scroll.append(el("option", { value: i, text: t })));
        scroll.value = m.scrollType || 0;
        const encStep = numberInput(m.encounterStep || 30, 1, 999);

        const bgmOn = el("input", { type: "checkbox", checked: !!m.autoplayBgm });
        const bgsOn = el("input", { type: "checkbox", checked: !!m.autoplayBgs });
        const bgmBtn = audioButton(api, "bgm", () => m.bgm, a => { m.bgm = a; });
        const bgsBtn = audioButton(api, "bgs", () => m.bgs, a => { m.bgs = a; });
        const bbOn = el("input", { type: "checkbox", checked: !!m.specifyBattleback });
        const bbBtn = el("button", { class: "mtBtn mtPick" });
        const showBb = () => { bbBtn.textContent = [m.battleback1Name, m.battleback2Name].filter(Boolean).join(" & ") || "(Nenhum)"; };
        bbBtn.addEventListener("click", async () => {
            const r = await openImageDialog(api, "Fundo de Batalha", ["battlebacks1", "battlebacks2"], [m.battleback1Name, m.battleback2Name]);
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
        const showPx = () => { pxBtn.textContent = m.parallaxName || "(Nenhum)"; };
        pxBtn.addEventListener("click", async () => {
            const r = await openImageDialog(api, "Panorama", ["parallaxes"], [m.parallaxName]);
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
                    el("td", { text: e.regionSet && e.regionSet.length ? e.regionSet.join(", ") : "Mapa Inteiro" }));
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
            el("button", { class: "mtBtn", text: "Novo", onclick: () => editEnc(-1) }),
            el("button", { class: "mtBtn", text: "Editar", onclick: () => { if (encSel >= 0) { editEnc(encSel); } } }),
            el("button", { class: "mtBtn", text: "Excluir", onclick: () => { if (encSel >= 0) { encList.splice(encSel, 1); encSel = -1; drawEnc(); } } }));

        const dlg = api.openDialog({
            title: title || "Propriedades do Mapa",
            width: "980px",
            height: "600px",
            buttons: [
                {
                    label: "Ok", primary: true, onClick: () => {
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
                            width: clampInt(width.value, 1, 256),
                            height: clampInt(height.value, 1, 256)
                        });
                    }
                },
                { label: "Cancelar", onClick: () => resolve(null) }
            ]
        });
        dlg.body.classList.add("mtProps");
        const general = el("fieldset", { class: "mtGroup" }, el("legend", { text: "Configurações Gerais" }),
            el("div", { class: "mtGrid2" },
                field("Nome", name, "Nome do mapa."),
                field("Nome de Exibição", displayName, "Nome exibido na parte superior esquerda da tela quando entrando no mapa. Nada é exibido se deixado o espaço branco."),
                field("Tileset", tileset, "Conjunto de tiles (tileset) usados para o mapa."),
                el("div", { class: "mtRow" },
                    field("Largura", width, "Tamanho horizontal do mapa."),
                    field("Altura", height, "Tamanho vertical do mapa.")),
                field("Tipo de Deslocamento", scroll, "Se as bordas dos mapas terão deslocamento, passando a impressão de mapa infinito."),
                field("Passos", encStep, "Número médio de passos entre encontros aleatórios.")),
            el("div", { class: "mtGrid2" },
                el("div", {}, el("label", { class: "mtCheck", title: "BGM executada automaticamente quando entrando no mapa." }, bgmOn, " BGM Automática"), bgmBtn),
                el("div", {}, el("label", { class: "mtCheck", title: "BGS executada automaticamente quando entrando no mapa." }, bgsOn, " BGS Automática"), bgsBtn),
                el("div", {}, el("label", { class: "mtCheck", title: "Define a imagem de fundo especificada quando ocorre uma batalha neste mapa." }, bbOn, " Definir Fundo de Batalha"), bbBtn),
                el("div", {}, el("label", { class: "mtCheck", title: "Torna impossível correr pelo mapa." }, dash, " Desativar Corrida"))),
            el("fieldset", { class: "mtGroup" }, el("legend", { text: "Panorama" }),
                field("Imagem", pxBtn, "Imagem do panorama."),
                el("div", { class: "mtRow" },
                    el("label", { class: "mtCheck", title: "Repete o panorama horizontalmente." }, loopX, " Loop Horizontal"),
                    field("Veloc.", sx, "Realiza a rolagem horizontal automaticamente na velocidade especificada.")),
                el("div", { class: "mtRow" },
                    el("label", { class: "mtCheck", title: "Repete o panorama verticalmente." }, loopY, " Loop Vertical"),
                    field("Veloc.", sy, "Realiza a rolagem vertical automaticamente na velocidade especificada.")),
                el("label", { class: "mtCheck", title: "Exibe o plano de fundo como panorama no editor de mapa. Pode aparecer de forma diferente no jogo." }, pxShow, " Mostrar no Editor")),
            field("Anotação", note));
        const enc = el("fieldset", { class: "mtGroup mtEnc" }, el("legend", { text: "Batalha" }),
            el("div", { class: "mtTableWrap" },
                el("table", { class: "mtTable" },
                    el("thead", {}, el("tr", {}, el("th", { text: "Tropa" }), el("th", { text: "Frequência" }), el("th", { text: "Área" }))),
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
