// Módulo "generator": Gerador de Personagem do RPG Maker MZ.
// Estrutura da tela igual à do MZ (Ferramentas → Gerador de Personagem): abas Homem/Mulher/Criança,
// Lista de Peças, Variação, Cor, Ajustar, Pré-visualização e os botões Aleatório, Imagem do rosto…,
// Personagem Andando…, Personagem Caído…, Personagem Lutando…, Salvar/Carregar Configurações…

import {
    LAYERGROUP_LIST, LAYERGROUP_TEXT, COLOR_TEXT, GENDERS, MASK_ID_LIST,
    layergroupToMaskIDs, layergroupToPaletteType, maskIDToPaletteType, isEssential, blankProbability,
    SETTINGS_IDENTITY, SETTINGS_VERSION
} from "./data.js";
import {
    buildAssets, makeDefaultData, compose, loadGradients, paletteLength, gradientRow,
    patternKeyList, imageToCanvas, BASE
} from "./composer.js";
import { openExporter } from "./exporter.js";
import { promptText, pickFile, message, el, hasProject } from "./ui.js";

const CSS_URL = new URL("../../css/generator.css", import.meta.url).href;

function injectCss() {
    if (!document.querySelector(`link[data-mz-module="generator"]`)) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = CSS_URL;
        link.dataset.mzModule = "generator";
        document.head.appendChild(link);
    }
}

// Estado por aba (no MZ cada aba é uma instância própria do layout e guarda seus dados).
const sessions = {};

async function getSession(gender) {
    if (!sessions[gender]) {
        sessions[gender] = (async () => {
            const assets = await buildAssets(gender);
            return {
                gender, assets,
                data: makeDefaultData(assets),
                lgIndex: 0,
                colorNameIndex: 0,
                available: new Set(),
                images: {}
            };
        })();
    }
    return sessions[gender];
}

let api = null;
let dialogOpen = null;

export async function register(apiObj) {
    api = apiObj;
    injectCss();
    api.bindToolbar("btnGenerator", () => openGenerator(), "Gerador de Personagem");
}

const PALETTE_COLS = 6;
const SW_W = 26, SW_H = 30, SW_GAP = 2;

async function openGenerator() {
    if (dialogOpen) { return; }
    const dlg = api.openDialog({
        title: "Gerador de Personagem",
        width: "min(1260px, 99vw)",
        height: "min(600px, 98vh)",
        buttons: [{ label: "Fechar", onClick: () => { stopAnim(); dialogOpen = null; } }]
    });
    dlg.root.querySelector(".mzDialog").classList.add("genDialog");
    dialogOpen = dlg;
    // Fechar pelo botão voltar do Android (closeTopDialog) também encerra a animação.
    const obs = new MutationObserver(() => {
        if (!dlg.root.isConnected) { stopAnim(); dialogOpen = null; obs.disconnect(); }
    });
    obs.observe(document.body, { childList: true });

    const ui = buildLayout(dlg.body);
    let session = null;
    let refreshToken = 0;
    let previewMode = "sheet";
    let animTimer = 0, animFrame = 0, animDir = 0, svMotion = 0;
    const grads = await loadGradients();

    function stopAnim() {
        if (animTimer) { clearInterval(animTimer); animTimer = 0; }
    }

    const currentLg = () => LAYERGROUP_LIST[session.lgIndex];

    async function switchGender(gender) {
        ui.loading.hidden = false;
        for (const b of ui.tabs.children) { b.classList.toggle("on", b.dataset.gender === gender); }
        session = await getSession(gender);
        ui.loading.hidden = true;
        refreshPartsList();
        refreshPatterns();
        await refreshAll();
    }

    // ---------- Lista de Peças ----------
    function refreshPartsList() {
        ui.parts.innerHTML = "";
        LAYERGROUP_LIST.forEach((lg, i) => {
            const it = el("div", "gen-item" + (i === session.lgIndex ? " sel" : ""), LAYERGROUP_TEXT[lg]);
            it.addEventListener("click", () => {
                session.lgIndex = i;
                session.colorNameIndex = 0;
                for (const c of ui.parts.children) { c.classList.toggle("sel", c === it); }
                refreshPatterns();
                refreshColorNames();
                refreshOffset();
            });
            ui.parts.appendChild(it);
        });
    }

    // ---------- Variação ----------
    function refreshPatterns() {
        const lg = currentLg();
        const keys = patternKeyList(session.assets, lg);
        const cells = isEssential(lg) ? keys : ["", ...keys];
        ui.varGrid.innerHTML = "";
        let selCell = null;
        for (const key of cells) {
            const cell = el("div", "gen-var");
            cell.title = key || "—";
            if (key) {
                const img = document.createElement("img");
                img.loading = "lazy";
                img.src = BASE + session.assets.variation[lg][key][0];
                img.alt = key;
                cell.appendChild(img);
            }
            if ((session.data.patterns[lg] || "") === key) { cell.classList.add("sel"); selCell = cell; }
            cell.addEventListener("click", () => {
                session.data.patterns[lg] = key;
                for (const c of ui.varGrid.children) { c.classList.toggle("sel", c === cell); }
                refreshAll();
            });
            ui.varGrid.appendChild(cell);
        }
        if (selCell) { requestAnimationFrame(() => selCell.scrollIntoView({ block: "nearest" })); }
    }

    // ---------- Cor ----------
    function currentMaskIDs() {
        return layergroupToMaskIDs(currentLg());
    }

    function refreshColorNames() {
        const ids = currentMaskIDs();
        if (session.colorNameIndex >= ids.length) { session.colorNameIndex = 0; }
        ui.colorNames.innerHTML = "";
        ids.forEach((id, i) => {
            const it = el("div", "gen-item" + (i === session.colorNameIndex ? " sel" : "")
                + (session.available.has(id) ? "" : " disabled"), COLOR_TEXT[id]);
            it.addEventListener("click", () => {
                session.colorNameIndex = i;
                for (const c of ui.colorNames.children) { c.classList.toggle("sel", c === it); }
                refreshPalette();
            });
            ui.colorNames.appendChild(it);
        });
        refreshPalette();
    }

    function currentMaskID() {
        const ids = currentMaskIDs();
        return ids[session.colorNameIndex] ?? null;
    }

    function refreshPalette() {
        const id = currentMaskID();
        const cv = ui.palette;
        const ctx = cv.getContext("2d");
        if (!id) {
            cv.width = 1; cv.height = 1; ctx.clearRect(0, 0, 1, 1);
            return;
        }
        const pt = layergroupToPaletteType(currentLg());
        const grad = grads[pt];
        const n = paletteLength(grad);
        const rows = Math.ceil(n / PALETTE_COLS);
        const cw = PALETTE_COLS * (SW_W + SW_GAP) + SW_GAP, ch = rows * (SW_H + SW_GAP) + SW_GAP;
        cv.width = cw; cv.height = ch;
        cv.style.width = cw + "px"; cv.style.height = ch + "px";
        ctx.clearRect(0, 0, cw, ch);
        const sel = session.data.colors[id] | 0;
        for (let i = 0; i < n; i++) {
            const x = SW_GAP + (i % PALETTE_COLS) * (SW_W + SW_GAP);
            const y = SW_GAP + Math.floor(i / PALETTE_COLS) * (SW_H + SW_GAP);
            if (pt === 3 && i === 0) {
                // Paleta comum: o primeiro quadro (xadrez) = cores originais.
                for (let yy = 0; yy < SW_H; yy += 6) {
                    for (let xx = 0; xx < SW_W; xx += 6) {
                        ctx.fillStyle = ((xx + yy) / 6) % 2 ? "#ffffff" : "#d0d0d0";
                        ctx.fillRect(x + xx, y + yy, Math.min(6, SW_W - xx), Math.min(6, SW_H - yy));
                    }
                }
            } else {
                // Cada quadro mostra o trecho 16..143 do gradiente (como o MZ).
                const row = gradientRow(grad, i);
                for (let xx = 0; xx < SW_W; xx++) {
                    const k = Math.min(255, Math.floor(16 + (xx + 0.5) * 128 / SW_W)) * 3;
                    ctx.fillStyle = `rgb(${row[k]},${row[k + 1]},${row[k + 2]})`;
                    ctx.fillRect(x + xx, y, 1, SW_H);
                }
            }
            if (i === sel) {
                ctx.lineWidth = 2;
                ctx.strokeStyle = "#000";
                ctx.strokeRect(x - 1, y - 1, SW_W + 2, SW_H + 2);
                ctx.strokeStyle = "#fff";
                ctx.strokeRect(x + 1, y + 1, SW_W - 2, SW_H - 2);
            }
        }
    }

    ui.palette.addEventListener("click", ev => {
        const id = currentMaskID();
        if (!id) { return; }
        const r = ui.palette.getBoundingClientRect();
        const x = (ev.clientX - r.left) * ui.palette.width / r.width;
        const y = (ev.clientY - r.top) * ui.palette.height / r.height;
        const col = Math.floor((x - SW_GAP / 2) / (SW_W + SW_GAP));
        const row = Math.floor((y - SW_GAP / 2) / (SW_H + SW_GAP));
        if (col < 0 || col >= PALETTE_COLS || row < 0) { return; }
        const i = row * PALETTE_COLS + col;
        const n = paletteLength(grads[layergroupToPaletteType(currentLg())]);
        if (i >= n) { return; }
        session.data.colors[id] = i;
        refreshPalette();
        refreshAll();
    });

    // ---------- Ajustar (deslocamento da parte no rosto, -8..+8) ----------
    function refreshOffset() {
        const off = session.data.offsets[currentLg()] || { x: 0, y: 0 };
        const s = v => (v >= 0 ? "+" : "") + v;
        ui.offsetText.textContent = `X${s(off.x)},Y${s(off.y)}`;
        ui.pad.up.disabled = !(off.y > -8);
        ui.pad.down.disabled = !(off.y < 8);
        ui.pad.left.disabled = !(off.x > -8);
        ui.pad.right.disabled = !(off.x < 8);
    }
    for (const [dir, dx, dy] of [["up", 0, -1], ["down", 0, 1], ["left", -1, 0], ["right", 1, 0]]) {
        ui.pad[dir].addEventListener("click", async () => {
            const lg = currentLg();
            const off = session.data.offsets[lg] ??= { x: 0, y: 0 };
            off.x = Math.max(-8, Math.min(8, off.x + dx));
            off.y = Math.max(-8, Math.min(8, off.y + dy));
            refreshOffset();
            const token = ++refreshToken;
            const r = await compose("face", session.assets, session.data);
            if (token !== refreshToken) { return; }
            session.images.face = r.image;
            drawPreview();
        });
    }

    // ---------- Pré-visualização ----------
    async function refreshAll() {
        const token = ++refreshToken;
        const s = session;
        const results = await Promise.all(["face", "tv", "tvd", "sv"].map(t => compose(t, s.assets, s.data)));
        if (token !== refreshToken || s !== session) { return; }
        const available = new Set();
        ["face", "tv", "tvd", "sv"].forEach((t, i) => {
            s.images[t] = results[i].image;
            for (const id of results[i].available) { available.add(id); }
        });
        s.available = available;
        refreshColorNames();
        refreshOffset();
        drawPreview();
    }

    const sheetCanvas = document.createElement("canvas");
    sheetCanvas.width = 720; sheetCanvas.height = 384;
    sheetCanvas.className = "gen-sheet gen-checker";
    const tmp = document.createElement("canvas");

    function drawPreview() {
        if (!session) { return; }
        if (previewMode === "sheet") {
            const ctx = sheetCanvas.getContext("2d");
            ctx.clearRect(0, 0, 720, 384);
            const put = (img, x, y) => { if (img) { ctx.drawImage(imageToCanvas(img, tmp), x, y); } };
            put(session.images.face, 0, 0);
            put(session.images.tv, 0, 144);
            put(session.images.tvd, 0, 336);
            put(session.images.sv, 144, 0);
            fitSheet();
        } else {
            drawAnimFrame();
        }
    }

    function fitSheet() {
        const area = ui.previewArea;
        const aw = area.clientWidth - 4, ah = area.clientHeight - 4;
        if (aw <= 0 || ah <= 0) { return; }
        const k = Math.min(aw / 720, ah / 384, 2);
        const scale = k >= 1 ? Math.floor(k) : k;
        sheetCanvas.style.width = Math.floor(720 * scale) + "px";
        sheetCanvas.style.height = Math.floor(384 * scale) + "px";
    }
    new ResizeObserver(() => { if (previewMode === "sheet") { fitSheet(); } }).observe(ui.previewArea);

    // Animação: andando (3 quadros × 4 direções), battler SV (movimentos do rmmz_sprites) e caído.
    const SV_MOTIONS = ["walk", "wait", "chant", "guard", "damage", "evade", "thrust", "swing", "missile", "skill",
        "spell", "item", "escape", "victory", "dying", "abnormal", "sleep", "dead"];
    const SV_MOTION_TEXT = ["Andar", "Esperar", "Recitar", "Defender", "Dano", "Esquivar", "Estocar", "Golpear",
        "Disparar", "Habilidade", "Magia", "Item", "Fugir", "Vitória", "Em perigo", "Status anormal", "Dormir", "Morto"];
    const anim = buildAnimView();

    function buildAnimView() {
        const wrap = el("div", "gen-anim");
        const mk = (cap, w, h) => {
            const cell = el("div", "gen-animCell");
            const cv = document.createElement("canvas");
            cv.width = w; cv.height = h;
            cv.className = "gen-checker";
            cell.append(el("div", "gen-cap", cap), cv);
            wrap.appendChild(cell);
            return { cell, cv };
        };
        const face = mk("Rosto", 144, 144);
        const tv = mk("Personagem Andando", 48 * 3, 48 * 3);
        const dirs = el("div", "gen-dirs");
        const dirBtns = [];
        // ordem das linhas na folha: baixo, esquerda, direita, cima
        for (const [label, row, col, gr] of [["▲", 3, 2, 1], ["◀", 1, 1, 2], ["▼", 0, 2, 2], ["▶", 2, 3, 2]]) {
            const b = el("button", "", label);
            b.style.gridColumn = col; b.style.gridRow = gr;
            b.addEventListener("click", () => { animDir = row; for (const x of dirBtns) { x.classList.toggle("on", x === b); } drawAnimFrame(); });
            if (row === 0) { b.classList.add("on"); }
            dirBtns.push(b);
            dirs.appendChild(b);
        }
        tv.cell.appendChild(dirs);
        const sv = mk("Personagem Lutando", 64 * 3, 64 * 3);
        const sel = document.createElement("select");
        SV_MOTIONS.forEach((m, i) => { const o = document.createElement("option"); o.value = i; o.textContent = SV_MOTION_TEXT[i]; sel.appendChild(o); });
        sel.addEventListener("change", () => { svMotion = Number(sel.value); drawAnimFrame(); });
        sv.cell.appendChild(sel);
        const tvd = mk("Personagem Caído", 48 * 3, 48 * 3);
        return { wrap, face, tv, sv, tvd };
    }

    function drawAnimFrame() {
        if (!session) { return; }
        const pattern = [0, 1, 2, 1][animFrame % 4];
        const blitScaled = (img, sx, sy, sw, sh, cv) => {
            const ctx = cv.getContext("2d");
            ctx.imageSmoothingEnabled = false;
            ctx.clearRect(0, 0, cv.width, cv.height);
            if (img) { ctx.drawImage(imageToCanvas(img, tmp), sx, sy, sw, sh, 0, 0, cv.width, cv.height); }
        };
        blitScaled(session.images.face, 0, 0, 144, 144, anim.face.cv);
        blitScaled(session.images.tv, pattern * 48, animDir * 48, 48, 48, anim.tv.cv);
        const m = svMotion;
        const cx = Math.floor(m / 6) * 3 + pattern, cy = m % 6;
        blitScaled(session.images.sv, cx * 64, cy * 64, 64, 64, anim.sv.cv);
        blitScaled(session.images.tvd, [0, 1, 2, 2][animFrame % 4] * 48, 0, 48, 48, anim.tvd.cv);
    }

    function setPreviewMode(mode) {
        previewMode = mode;
        for (const b of ui.modeBtns) { b.classList.toggle("on", b.dataset.mode === mode); }
        ui.previewArea.innerHTML = "";
        ui.previewArea.classList.toggle("gen-checker", false);
        stopAnim();
        if (mode === "sheet") {
            ui.previewArea.appendChild(sheetCanvas);
        } else {
            ui.previewArea.appendChild(anim.wrap);
            animTimer = setInterval(() => { animFrame++; drawAnimFrame(); }, 200);
        }
        ui.previewArea.appendChild(ui.loading);
        drawPreview();
    }
    for (const b of ui.modeBtns) { b.addEventListener("click", () => setPreviewMode(b.dataset.mode)); }

    // ---------- Botões ----------
    ui.btn.random.addEventListener("click", async () => {
        const s = session;
        for (const lg of LAYERGROUP_LIST) {
            const keys = patternKeyList(s.assets, lg);
            let index;
            if (Math.random() < blankProbability(lg)) {
                index = -1;
            } else if (lg === "ears" && 0.9 > Math.random()) {
                index = 0;
            } else {
                index = Math.floor(Math.random() * keys.length);
            }
            s.data.patterns[lg] = keys[index] || "";
            s.data.offsets[lg] = { x: 0, y: 0 };
        }
        for (const id of MASK_ID_LIST) {
            const pt = maskIDToPaletteType(id);
            let len = paletteLength(grads[pt]);
            if (pt === 2 && Math.random() < 0.7) { len = Math.min(len, 12); }
            if (pt === 3 && Math.random() < 0.5) { len = 0; }
            s.data.colors[id] = Math.floor(Math.random() * len);
        }
        refreshPatterns();
        await refreshAll();
    });

    ui.btn.reset.addEventListener("click", async () => {
        session.data = makeDefaultData(session.assets);
        refreshPatterns();
        await refreshAll();
    });

    const exportOf = type => () => openExporter(api, type, session.images[type]);
    ui.btn.face.addEventListener("click", exportOf("face"));
    ui.btn.tv.addEventListener("click", exportOf("tv"));
    ui.btn.tvd.addEventListener("click", exportOf("tvd"));
    ui.btn.sv.addEventListener("click", exportOf("sv"));

    ui.btn.save.addEventListener("click", async () => {
        if (!(await hasProject(api))) { return; }
        const name = await promptText(api, {
            title: "Salvar Configurações",
            label: "Arquivo (JSON) dentro do projeto:",
            value: session.settingsPath || "Personagem.json",
            hint: "Salva as configurações atuais."
        });
        if (!name) { return; }
        const path = name.endsWith(".json") ? name : name + ".json";
        const body = JSON.stringify({
            identity: SETTINGS_IDENTITY,
            version: SETTINGS_VERSION,
            gender: session.gender,
            patterns: session.data.patterns,
            colors: session.data.colors,
            offsets: session.data.offsets
        });
        const res = await fetch("/api/file?path=" + encodeURIComponent(path), {
            method: "PUT", headers: { "Content-Type": "application/json" }, body
        });
        if (res.ok) {
            session.settingsPath = path;
            api.status("Configurações salvas: " + path);
        } else {
            await message(api, "Salvar Configurações", "Falha ao gravar " + path + " (" + res.status + ")");
        }
    });

    ui.btn.load.addEventListener("click", async () => {
        if (!(await hasProject(api))) { return; }
        const path = await pickFile(api, {
            title: "Carregar Configurações",
            dirs: [""],
            filter: n => n.toLowerCase().endsWith(".json") && n !== "package.json",
            hint: "Carrega as configurações salvas."
        });
        if (!path) { return; }
        try {
            const res = await fetch("/api/file?path=" + encodeURIComponent(path));
            const json = await res.json();
            if (!json || json.identity !== SETTINGS_IDENTITY || !json.patterns || !json.colors) {
                throw new Error("arquivo inválido");
            }
            const gender = GENDERS.some(g => g.key === json.gender) ? json.gender : session.gender;
            const target = await getSession(gender);
            const def = makeDefaultData(target.assets);
            target.data = {
                patterns: { ...def.patterns, ...json.patterns },
                colors: { ...def.colors, ...json.colors },
                offsets: { ...def.offsets, ...(json.offsets || {}) }
            };
            target.settingsPath = path;
            await switchGender(gender);
            api.status("Configurações carregadas: " + path);
        } catch (e) {
            await message(api, "Carregar Configurações", "Não foi possível carregar " + path + ": " + e.message);
        }
    });

    for (const b of ui.tabs.children) {
        b.addEventListener("click", () => switchGender(b.dataset.gender));
    }

    setPreviewMode("sheet");
    await switchGender("male");
}

function buildLayout(body) {
    const root = el("div", "gen");
    // coluna esquerda
    const left = el("div", "gen-col");
    const tabs = el("div", "gen-tabs");
    for (const g of GENDERS) {
        const b = el("button", "", g.text);
        b.dataset.gender = g.key;
        tabs.appendChild(b);
    }
    const partsBox = el("div", "gen-box");
    partsBox.style.flex = "1";
    const parts = el("div", "gen-list");
    parts.title = "Selecione um tipo de peças.";
    partsBox.append(el("div", "gen-boxTitle", "Lista de Peças"), parts);
    const leftBtns = el("div", "gen-leftBtns");
    left.append(tabs, partsBox, leftBtns);

    // coluna do meio
    const mid = el("div", "gen-col");
    const varBox = el("div", "gen-box gen-variation");
    const varGrid = el("div", "gen-varGrid");
    varBox.title = "Selecionar variação.";
    varBox.append(el("div", "gen-boxTitle", "Variação"), varGrid);
    const colorBox = el("div", "gen-box gen-color");
    colorBox.title = "Selecionar cor.";
    const colorRow = el("div", "gen-colorRow");
    const colorNames = el("div", "gen-list");
    const paletteWrap = el("div", "gen-paletteWrap");
    const palette = document.createElement("canvas");
    paletteWrap.appendChild(palette);
    colorRow.append(colorNames, paletteWrap);
    colorBox.append(el("div", "gen-boxTitle", "Cor"), colorRow);
    const offBox = el("div", "gen-box gen-offset");
    offBox.title = "Ajusta a posição da parte do rosto.";
    const padEl = el("div", "gen-pad");
    const pad = {
        up: el("button", "up", "△"), left: el("button", "left", "◁"),
        right: el("button", "right", "▷"), down: el("button", "down", "▽")
    };
    padEl.append(pad.up, pad.left, pad.right, pad.down);
    const offsetText = el("div", "gen-offsetText", "X+0,Y+0");
    const offRow = el("div", "gen-offRow");
    offRow.append(padEl, offsetText);
    offBox.append(el("div", "gen-boxTitle", "Ajustar"), offRow);
    mid.append(varBox, colorBox, offBox);

    // coluna direita: pré-visualização
    const right = el("div", "gen-col");
    const prevBox = el("div", "gen-box gen-preview");
    prevBox.title = "Pré-visualização de personagem.";
    const head = el("div", "gen-previewHead");
    const seg = el("div", "gen-seg");
    const modeBtns = [["sheet", "Folhas"], ["anim", "Animação"]].map(([m, t]) => {
        const b = el("button", "", t);
        b.dataset.mode = m;
        seg.appendChild(b);
        return b;
    });
    head.append(el("div", "gen-boxTitle", "Pré-visualização"), seg);
    const previewArea = el("div", "gen-previewArea");
    const loading = el("div", "gen-loading", "Carregando…");
    previewArea.appendChild(loading);
    prevBox.append(head, previewArea);
    right.appendChild(prevBox);

    // barra de botões
    const actions = el("div", "gen-actions");
    const mkb = (text, hint, parent = actions) => { const b = el("button", "", text); b.title = hint; parent.appendChild(b); return b; };
    const btn = {};
    btn.random = mkb("Aleatório", "Define todas as opções de personagem aleatoriamente.", leftBtns);
    btn.reset = mkb("Redefinir", "Volta todas as partes e cores ao padrão inicial.", leftBtns);
    btn.face = mkb("Imagem do rosto…", "Abre janela de imagens de rosto.");
    btn.tv = mkb("Personagem Andando…", "Abre janela para importação e exportação de gráfico do personagem andando.");
    btn.tvd = mkb("Personagem Caído…", "Abre janela para importação e exportação de gráfico do personagem nocauteado.");
    btn.sv = mkb("Personagem Lutando…", "Abre janela para importação e exportação de gráfico de personagem em batalha.");
    actions.appendChild(el("span", "sep"));
    btn.save = mkb("Salvar Configurações…", "Salva as configurações atuais.");
    btn.load = mkb("Carregar Configurações…", "Carrega as configurações salvas.");

    root.append(left, mid, right, actions);
    body.appendChild(root);
    return { tabs, parts, varGrid, colorNames, palette, pad, offsetText, modeBtns, previewArea, loading, btn };
}
