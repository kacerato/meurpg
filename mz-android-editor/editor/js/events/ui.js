// Componentes de interface do módulo events: diálogos com Promise, campos, grupos de rádio
// no estilo do MZ e seletores (switch, variável, banco, áudio, imagem, personagem, local).

import { db, clone } from "./data.js";

let API = null;
export function setApi(api) { API = api; }
export const PROJECT = "/project/";

// ---------- DOM ----------
export function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    if (attrs) {
        for (const [k, v] of Object.entries(attrs)) {
            if (v === undefined || v === null || v === false) { continue; }
            if (k === "class") { el.className = v; }
            else if (k === "style" && typeof v === "object") { Object.assign(el.style, v); }
            else if (k.startsWith("on") && typeof v === "function") { el.addEventListener(k.slice(2), v); }
            else if (k === "text") { el.textContent = v; }
            else { el.setAttribute(k, v === true ? "" : v); }
        }
    }
    for (const c of children.flat()) {
        if (c === null || c === undefined || c === false) { continue; }
        el.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return el;
}

// Diálogo modal que resolve com o valor de onOk (ou null ao cancelar/fechar pelo botão voltar).
export function dialog({ title, width, height, okLabel = "OK", cancelLabel = "Cancel", build, onOk, extraButtons, noCancel }) {
    return new Promise(resolve => {
        let done = false;
        const finish = v => { if (!done) { done = true; obs.disconnect(); resolve(v); } };
        const buttons = [...(extraButtons || [])];
        buttons.push({
            label: okLabel, primary: true,
            onClick: () => {
                let r;
                try { r = onOk ? onOk() : true; } catch (e) { console.error(e); alertBox(String(e.message || e)); return false; }
                if (r === false) { return false; }
                finish(r === undefined ? true : r);
                return true;
            }
        });
        if (!noCancel) { buttons.push({ label: cancelLabel, onClick: () => finish(null) }); }
        const dlg = API.openDialog({ title, width, height, buttons });
        dlg.root.classList.add("evDlgRoot");
        dlg.body.classList.add("evDlgBody");
        const obs = new MutationObserver(() => { if (!dlg.root.isConnected) { finish(null); } });
        obs.observe(document.body, { childList: true });
        if (build) { build(dlg.body, dlg); }
    });
}

export function alertBox(msg, title = "MZ Editor") {
    return dialog({ title, width: "420px", height: "auto", noCancel: true, build: b => b.append(h("p", { class: "evMsg" }, msg)) });
}

export function confirmBox(msg, title = "MZ Editor") {
    return dialog({ title, width: "420px", height: "auto", okLabel: "Yes", cancelLabel: "No", build: b => b.append(h("p", { class: "evMsg" }, msg)) });
}

// Menu de ações (equivalente ao menu de contexto do botão direito) como folha de toque.
export function actionMenu(items, { x, y, title } = {}) {
    return new Promise(resolve => {
        const back = h("div", { class: "evMenuBack" });
        const box = h("div", { class: "evMenu" });
        if (title) { box.append(h("div", { class: "evMenuTitle" }, title)); }
        const close = v => { back.remove(); resolve(v); };
        const addItems = (list, parent) => {
            for (const it of list) {
                if (it === "-") { parent.append(h("div", { class: "evMenuSep" })); continue; }
                if (it.items) {
                    const sub = h("div", { class: "evMenuSub hidden" });
                    const btn = h("button", { class: "evMenuItem", onclick: e => { e.stopPropagation(); sub.classList.toggle("hidden"); } }, it.label + "  ▸");
                    btn.disabled = !!it.disabled;
                    parent.append(btn, sub);
                    addItems(it.items, sub);
                    continue;
                }
                const btn = h("button", { class: "evMenuItem", onclick: e => { e.stopPropagation(); close(it.value !== undefined ? it.value : it.label); if (it.action) { it.action(); } } }, it.label);
                btn.disabled = !!it.disabled;
                parent.append(btn);
            }
        };
        addItems(items, box);
        back.append(box);
        back.addEventListener("click", () => close(null));
        document.body.append(back);
        const w = innerWidth, hh = innerHeight;
        const r = box.getBoundingClientRect();
        if (x !== undefined) {
            box.style.left = Math.max(4, Math.min(w - r.width - 4, x)) + "px";
            box.style.top = Math.max(4, Math.min(hh - r.height - 4, y)) + "px";
        } else {
            box.style.left = Math.max(4, (w - r.width) / 2) + "px";
            box.style.top = Math.max(4, (hh - r.height) / 2) + "px";
        }
    });
}

// ---------- Campos ----------
export function field(label, ...controls) {
    return h("div", { class: "evField" }, label ? h("span", { class: "evLabel" }, label) : null, ...controls.map(c => c.el || c));
}
export function row(...items) { return h("div", { class: "evRow" }, ...items.map(c => c && c.el ? c.el : c)); }
export function col(...items) { return h("div", { class: "evCol" }, ...items.map(c => c && c.el ? c.el : c)); }
export function group(title, ...children) {
    return h("fieldset", { class: "evGroup" }, title ? h("legend", null, title) : null, ...children.map(c => c && c.el ? c.el : c));
}

// Controles com get()/set() e .el (para tratar todos da mesma forma).
function ctl(el, get, set) {
    const c = { el, get, set, disabled: false };
    c.enable = on => {
        c.disabled = !on;
        el.classList.toggle("evDisabled", !on);
        for (const i of [el, ...el.querySelectorAll("input,select,textarea,button")]) {
            if (i.tagName) { i.disabled = !on; }
        }
    };
    c.onChange = fn => { el.addEventListener("change", fn); el.addEventListener("input", fn); return c; };
    return c;
}

export function num(value = 0, { min = -99999999, max = 99999999, step = 1, width = "90px", float = false } = {}) {
    const el = h("input", { type: "number", class: "evNum", min, max, step, value, style: { width } });
    el.addEventListener("change", () => { el.value = clampNum(el.value); });
    const clampNum = v => {
        let n = float ? parseFloat(v) : parseInt(v, 10);
        if (!isFinite(n)) { n = Math.max(min, Math.min(max, 0)); }
        return Math.max(min, Math.min(max, n));
    };
    return ctl(el, () => clampNum(el.value), v => { el.value = v; });
}

export function txt(value = "", { width, placeholder } = {}) {
    const el = h("input", { type: "text", class: "evTxt", value: value || "", placeholder, style: width ? { width } : null });
    el.value = value || "";
    return ctl(el, () => el.value, v => { el.value = v || ""; });
}

export function area(value = "", { rows = 6, mono = false, cls = "" } = {}) {
    const el = h("textarea", { class: "evArea " + (mono ? "mono " : "") + cls, rows, spellcheck: "false" });
    el.value = value || "";
    return ctl(el, () => el.value, v => { el.value = v || ""; });
}

export function sel(options, value, { width } = {}) {
    const el = h("select", { class: "evSel", style: width ? { width } : null });
    const fill = opts => {
        el.innerHTML = "";
        for (const o of opts) {
            const opt = typeof o === "object" ? o : { value: o, label: String(o) };
            el.append(h("option", { value: JSON.stringify(opt.value) }, opt.label));
        }
    };
    fill(options);
    const c = ctl(el, () => { try { return JSON.parse(el.value); } catch (e) { return null; } }, v => { el.value = JSON.stringify(v); if (el.selectedIndex < 0) { el.selectedIndex = 0; } });
    c.set(value);
    c.setOptions = (opts, v) => { fill(opts); c.set(v); };
    return c;
}

export function chk(label, value = false) {
    const input = h("input", { type: "checkbox" });
    input.checked = !!value;
    const el = h("label", { class: "evChk" }, input, h("span", null, label));
    const c = ctl(el, () => input.checked, v => { input.checked = !!v; });
    c.input = input;
    return c;
}

// Linhas de rádio do MZ: cada opção habilita seus próprios controles.
let radioSeq = 0;
export function radioName() { return "evr" + (++radioSeq); }
export function radios(rows, value, { inline = false, name: shared } = {}) {
    const name = shared || "evr" + (++radioSeq);
    const el = h("div", { class: "evRadios" + (inline ? " inline" : "") });
    const items = rows.map(r => {
        const input = h("input", { type: "radio", name });
        const lbl = h("label", { class: "evRadio" }, input, h("span", null, r.label));
        const line = h("div", { class: "evRadioRow" }, lbl, ...(r.controls || []).map(c => c.el || c));
        el.append(line);
        return { r, input };
    });
    const sync = () => {
        for (const { r, input } of items) {
            for (const c of r.controls || []) { if (c.enable) { c.enable(input.checked); } }
        }
    };
    for (const it of items) { it.input.addEventListener("change", () => { sync(); el.dispatchEvent(new Event("change")); }); }
    const c = ctl(el, () => { const it = items.find(i => i.input.checked); return it ? it.r.value : rows[0].value; },
        v => { const it = items.find(i => i.r.value === v) || (shared ? null : items[0]); if (it) { it.input.checked = true; } sync(); });
    c.sync = sync;
    c.has = () => items.some(i => i.input.checked);
    c.set(value);
    c.enable = on => { for (const it of items) { it.input.disabled = !on; } if (on) { sync(); } else { for (const it of items) { for (const cc of it.r.controls || []) { if (cc.enable) { cc.enable(false); } } } } };
    return c;
}

// Botão que abre um seletor e mostra o texto do valor atual.
export function pickBtn(value, label, onPick, { width = "220px" } = {}) {
    let cur = value;
    const el = h("button", { type: "button", class: "evPick", style: { width } });
    const refresh = () => { el.textContent = label(cur); };
    el.addEventListener("click", async e => {
        e.preventDefault();
        const v = await onPick(cur);
        if (v !== null && v !== undefined) { cur = v; refresh(); el.dispatchEvent(new Event("change")); }
    });
    refresh();
    const c = ctl(el, () => cur, v => { cur = v; refresh(); });
    c.refresh = refresh;
    return c;
}

// ---------- Seletores de lista ----------
export function listDialog({ title, options, value, width = "520px", height = "86vh", editNames }) {
    let cur = value;
    let names = editNames ? editNames.names.slice() : null;
    return dialog({
        title, width, height,
        build: body => {
            const filter = h("input", { type: "search", class: "evTxt evFilter", placeholder: "Filtrar…" });
            const list = h("div", { class: "evList" });
            const nameBox = editNames ? txt("") : null;
            const render = () => {
                const q = filter.value.toLowerCase();
                list.innerHTML = "";
                const opts = editNames ? editNames.options(names) : options;
                for (const o of opts) {
                    if (q && !o.label.toLowerCase().includes(q)) { continue; }
                    const it = h("div", { class: "evListItem" + (o.value === cur ? " selected" : "") }, o.label);
                    it.addEventListener("click", () => {
                        cur = o.value;
                        for (const s of list.querySelectorAll(".selected")) { s.classList.remove("selected"); }
                        it.classList.add("selected");
                        if (nameBox) { nameBox.set(names[cur] || ""); }
                    });
                    it.addEventListener("dblclick", () => body.closest(".mzDialog").querySelector(".mzDialogButtons .primary").click());
                    list.append(it);
                }
                const s = list.querySelector(".selected");
                if (s) { s.scrollIntoView({ block: "center" }); }
            };
            filter.addEventListener("input", render);
            body.append(filter, list);
            if (editNames) {
                nameBox.set(names[cur] || "");
                nameBox.el.addEventListener("input", () => {
                    names[cur] = nameBox.get();
                    const s = list.querySelector(".selected");
                    if (s) { s.textContent = db.pad(cur) + " " + names[cur]; }
                });
                const maxN = num(names.length - 1, { min: 1, max: 5000 });
                const applyMax = h("button", { type: "button", class: "evBtn", onclick: () => {
                    const n = maxN.get();
                    while (names.length < n + 1) { names.push(""); }
                    names.length = n + 1;
                    render();
                } }, "Change Maximum…");
                body.append(row(field("Name:", nameBox), field("Max:", maxN), applyMax));
            }
            render();
        },
        onOk: () => {
            if (editNames && JSON.stringify(names) !== JSON.stringify(editNames.names)) { editNames.save(names); }
            return { v: cur };
        }
    }).then(r => r ? r.v : null);
}

export function dataPick(list, value, { none = false, width, title } = {}) {
    const label = v => v ? db.pad(v) + " " + db.name(list, v) : (none ? "None" : db.pad(0));
    return pickBtn(value, label, cur => listDialog({ title: title || "Select", options: db.options(list, { none }), value: cur }), { width });
}

function namedPick(kind, value, width) {
    const names = () => db.system[kind] || [""];
    const label = v => "#" + db.pad(v) + " " + (names()[v] || "");
    return pickBtn(value, label, cur => listDialog({
        title: kind === "switches" ? "Switch" : "Variable",
        value: cur,
        editNames: {
            names: names(),
            options: arr => db.nameListOptions(arr),
            save: async arr => {
                db.system[kind] = arr;
                await API.project.writeJson("data/System.json", db.system);
                API.emit("db:changed", { file: "data/System.json" });
            }
        }
    }), { width });
}
export function switchPick(value = 1, width) { return namedPick("switches", value || 1, width); }
export function varPick(value = 1, width) { return namedPick("variables", value || 1, width); }

// ---------- Arquivos ----------
const listCache = new Map();
export async function listFiles(dir, exts) {
    const key = dir + "|" + exts;
    if (!listCache.has(key)) {
        const res = await API.project.list(dir);
        const names = new Set();
        for (const e of res || []) {
            if (e.dir) { continue; }
            const m = /^(.*)\.([^.]+)$/.exec(e.name);
            if (m && exts.includes(m[2].toLowerCase())) { names.add(m[1]); }
        }
        listCache.set(key, [...names].sort((a, b) => a.localeCompare(b)));
    }
    return listCache.get(key);
}

export function imgUrl(folder, name) {
    return PROJECT + "img/" + folder + "/" + encodeURIComponent(name) + ".png";
}

// Diálogo genérico de lista de arquivos com pré-visualização (preview(name) -> Node).
function fileDialog({ title, files, value, preview, extra, width = "900px", height = "86vh", onSelect }) {
    let cur = value;
    return dialog({
        title, width, height,
        build: body => {
            const wrap = h("div", { class: "evFileWrap" });
            const list = h("div", { class: "evList evFileList" });
            const pv = h("div", { class: "evFilePreview" });
            const show = () => { pv.innerHTML = ""; const n = preview && preview(cur); if (n) { pv.append(n); } };
            for (const f of ["", ...files]) {
                const it = h("div", { class: "evListItem" + (f === cur ? " selected" : "") }, f === "" ? "(None)" : f);
                it.addEventListener("click", () => {
                    cur = f;
                    for (const s of list.querySelectorAll(".selected")) { s.classList.remove("selected"); }
                    it.classList.add("selected");
                    if (onSelect) { onSelect(f); }
                    show();
                });
                list.append(it);
            }
            wrap.append(list, pv);
            body.append(wrap);
            if (extra) { body.append(extra); }
            show();
            requestAnimationFrame(() => { const s = list.querySelector(".selected"); if (s) { s.scrollIntoView({ block: "center" }); } });
        },
        onOk: () => ({ v: cur })
    }).then(r => r ? r.v : null);
}

export function imagePick(folder, value, { width = "220px" } = {}) {
    return pickBtn(value || "", v => v || "(None)", async cur => {
        const files = await listFiles("img/" + folder, ["png"]);
        return fileDialog({ title: "Select an Image", files, value: cur, preview: n => n ? h("img", { src: imgUrl(folder, n), class: "evPvImg" }) : null });
    }, { width });
}

// ---------- Áudio ----------
let audioEl = null;
function stopAudio() { if (audioEl) { audioEl.pause(); audioEl = null; } }
function playAudio(folder, a) {
    stopAudio();
    if (!a.name) { return; }
    audioEl = new Audio(PROJECT + "audio/" + folder + "/" + encodeURIComponent(a.name) + ".ogg");
    audioEl.volume = Math.max(0, Math.min(1, a.volume / 100));
    audioEl.playbackRate = Math.max(0.5, Math.min(1.5, a.pitch / 100));
    audioEl.onerror = () => {
        if (audioEl && !audioEl.src.endsWith(".m4a")) { audioEl.src = audioEl.src.replace(/\.ogg$/, ".m4a"); audioEl.play().catch(() => {}); }
    };
    audioEl.play().catch(() => {});
}
export function audioText(a) {
    return a && a.name ? `${a.name} (${a.volume}, ${a.pitch}, ${a.pan})` : "None";
}
export function audioDialog(folder, value) {
    const a = clone(value) || { name: "", volume: 90, pitch: 100, pan: 0 };
    const vol = slider(a.volume, 0, 100), pit = slider(a.pitch, 50, 150), pan = slider(a.pan, -100, 100);
    return listFiles("audio/" + folder, ["ogg", "m4a"]).then(files => {
        const extra = h("div", { class: "evAudioCtl" },
            row(h("button", { type: "button", class: "evBtn", onclick: () => playAudio(folder, { name: a.name, volume: vol.get(), pitch: pit.get(), pan: pan.get() }) }, "▶ Play"),
                h("button", { type: "button", class: "evBtn", onclick: stopAudio }, "■ Stop")),
            field("Volume", vol), field("Pitch", pit), field("Pan", pan));
        return fileDialog({ title: "Select " + folder.toUpperCase(), files, value: a.name, extra, width: "640px", onSelect: n => { a.name = n; } });
    }).then(name => {
        stopAudio();
        if (name === null) { return null; }
        return { name, volume: vol.get(), pitch: pit.get(), pan: pan.get() };
    });
}
export function audioPick(folder, value, { width = "260px" } = {}) {
    return pickBtn(clone(value) || { name: "", volume: 90, pitch: 100, pan: 0 }, audioText, cur => audioDialog(folder, cur), { width });
}

export function slider(value, min, max, { step = 1 } = {}) {
    const range = h("input", { type: "range", min, max, step, class: "evRange" });
    const box = h("input", { type: "number", min, max, step, class: "evNum", style: { width: "70px" } });
    range.value = value; box.value = value;
    range.addEventListener("input", () => { box.value = range.value; });
    box.addEventListener("input", () => { range.value = box.value; });
    const el = h("span", { class: "evSlider" }, range, box);
    return ctl(el, () => Math.max(min, Math.min(max, Number(box.value) || 0)), v => { range.value = v; box.value = v; });
}

// ---------- Imagens de personagem / rosto ----------
export function loadImage(src) {
    return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
}
export function isBigCharacter(name) { return /^[!]?\$/.test(name || ""); }

// Seleção do gráfico de evento/personagem. opts.mode: "event" (frame exato + tiles) | "index" (só índice).
export async function characterDialog(image, { mode = "event", tileset = null, title = "Select an Image" } = {}) {
    const img = clone(image) || { characterName: "", characterIndex: 0, direction: 2, pattern: 1, tileId: 0 };
    const files = await listFiles("img/characters", ["png"]);
    const tabs = [{ name: "Characters" }];
    if (mode === "event" && tileset) {
        ["B", "C", "D", "E"].forEach((t, i) => { if (tileset.tilesetNames[5 + i]) { tabs.push({ name: t, set: i }); } });
    }
    let tab = img.tileId > 0 ? 1 + Math.floor(img.tileId / 256) : 0;
    if (!tabs[tab]) { tab = 0; }
    return dialog({
        title, width: "1000px", height: "92vh",
        build: body => {
            const tabBar = h("div", { class: "evTabs" });
            const content = h("div", { class: "evCharContent" });
            const list = h("div", { class: "evList evFileList" });
            const canvasWrap = h("div", { class: "evFilePreview evCharPreview" });
            const canvas = h("canvas", { class: "evCharCanvas" });
            canvasWrap.append(canvas);
            const draw = async () => {
                const ctx = canvas.getContext("2d");
                if (tab === 0) {
                    if (!img.characterName) { canvas.width = 1; canvas.height = 1; return; }
                    const im = await loadImage(imgUrl("characters", img.characterName));
                    canvas.width = im.width; canvas.height = im.height;
                    ctx.drawImage(im, 0, 0);
                    const big = isBigCharacter(img.characterName);
                    const pw = im.width / (big ? 3 : 12), ph = im.height / (big ? 4 : 8);
                    const bx = big ? 0 : (img.characterIndex % 4) * 3, by = big ? 0 : Math.floor(img.characterIndex / 4) * 4;
                    ctx.lineWidth = 3; ctx.strokeStyle = "#fff";
                    if (mode === "event") {
                        ctx.strokeRect(1.5 + (bx + img.pattern) * pw, 1.5 + (by + (img.direction - 2) / 2) * ph, pw - 3, ph - 3);
                    } else {
                        ctx.strokeRect(1.5 + bx * pw, 1.5 + by * ph, pw * 3 - 3, ph * 4 - 3);
                    }
                    canvas.onclick = e => {
                        const r = canvas.getBoundingClientRect();
                        const cx = Math.floor((e.clientX - r.left) / r.width * im.width / pw);
                        const cy = Math.floor((e.clientY - r.top) / r.height * im.height / ph);
                        img.characterIndex = big ? 0 : Math.floor(cx / 3) + Math.floor(cy / 4) * 4;
                        img.pattern = cx % 3;
                        img.direction = (cy % 4) * 2 + 2;
                        img.tileId = 0;
                        draw();
                    };
                } else {
                    const set = tabs[tab].set;
                    const im = await loadImage(imgUrl("tilesets", tileset.tilesetNames[5 + set]));
                    const T = 48;
                    canvas.width = 8 * T; canvas.height = 32 * T;
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    for (let n = 0; n < 256; n++) {
                        const sx = ((Math.floor(n / 128) % 2) * 8 + (n % 8)) * T;
                        const sy = (Math.floor((n % 256) / 8) % 16) * T;
                        ctx.drawImage(im, sx, sy, T, T, (n % 8) * T, Math.floor(n / 8) * T, T, T);
                    }
                    if (img.tileId >= set * 256 && img.tileId < set * 256 + 256 && img.tileId > 0) {
                        const n = img.tileId - set * 256;
                        ctx.lineWidth = 3; ctx.strokeStyle = "#fff";
                        ctx.strokeRect((n % 8) * T + 1.5, Math.floor(n / 8) * T + 1.5, T - 3, T - 3);
                    }
                    canvas.onclick = e => {
                        const r = canvas.getBoundingClientRect();
                        const cx = Math.floor((e.clientX - r.left) / r.width * 8);
                        const cy = Math.floor((e.clientY - r.top) / r.height * 32);
                        img.tileId = set * 256 + cy * 8 + cx;
                        img.characterName = ""; img.characterIndex = 0; img.pattern = 0; img.direction = 2;
                        draw();
                    };
                }
            };
            const renderList = () => {
                list.innerHTML = "";
                list.style.display = tab === 0 ? "" : "none";
                for (const f of ["", ...files]) {
                    const it = h("div", { class: "evListItem" + (f === img.characterName && !img.tileId ? " selected" : "") }, f || "(None)");
                    it.addEventListener("click", () => {
                        img.characterName = f; img.tileId = 0;
                        if (isBigCharacter(f)) { img.characterIndex = 0; }
                        for (const s of list.querySelectorAll(".selected")) { s.classList.remove("selected"); }
                        it.classList.add("selected");
                        draw();
                    });
                    list.append(it);
                }
            };
            tabs.forEach((t, i) => {
                const b = h("button", { type: "button", class: "evTab" + (i === tab ? " on" : "") }, t.name);
                b.addEventListener("click", () => { tab = i; for (const x of tabBar.children) { x.classList.toggle("on", x === b); } renderList(); draw(); });
                tabBar.append(b);
            });
            if (tabs.length > 1) { body.append(tabBar); }
            content.append(list, canvasWrap);
            body.append(content);
            renderList(); draw();
        },
        onOk: () => ({ v: img })
    }).then(r => r ? r.v : null);
}

// Botão com miniatura do gráfico (usado no editor de evento e nos comandos).
export function drawCharacterThumb(canvas, image, tileset, size = 96) {
    const ctx = canvas.getContext("2d");
    canvas.width = size; canvas.height = size;
    ctx.clearRect(0, 0, size, size);
    if (image.tileId > 0 && tileset) {
        const set = Math.floor(image.tileId / 256), n = image.tileId % 256;
        const name = tileset.tilesetNames[5 + set];
        if (!name) { return; }
        loadImage(imgUrl("tilesets", name)).then(im => {
            const T = 48;
            const sx = ((Math.floor(n / 128) % 2) * 8 + (n % 8)) * T, sy = (Math.floor(n / 8) % 16) * T;
            ctx.drawImage(im, sx, sy, T, T, (size - T) / 2, (size - T) / 2, T, T);
        }).catch(() => {});
        return;
    }
    if (!image.characterName) { return; }
    loadImage(imgUrl("characters", image.characterName)).then(im => {
        const big = isBigCharacter(image.characterName);
        const pw = im.width / (big ? 3 : 12), ph = im.height / (big ? 4 : 8);
        const bx = big ? 0 : (image.characterIndex % 4) * 3, by = big ? 0 : Math.floor(image.characterIndex / 4) * 4;
        const s = Math.min(1, size / Math.max(pw, ph));
        ctx.drawImage(im, (bx + (image.pattern || 0)) * pw, (by + ((image.direction || 2) - 2) / 2) * ph, pw, ph,
            (size - pw * s) / 2, (size - ph * s) / 2, pw * s, ph * s);
    }).catch(() => {});
}

export function charIndexPick(name, index, { width = "240px" } = {}) {
    return pickBtn({ name: name || "", index: index || 0 }, v => v.name ? `${v.name} (${v.index})` : "(None)", async cur => {
        const r = await characterDialog({ characterName: cur.name, characterIndex: cur.index, direction: 2, pattern: 1, tileId: 0 }, { mode: "index" });
        return r ? { name: r.characterName, index: r.characterIndex } : null;
    }, { width });
}

export async function faceDialog(name, index) {
    const files = await listFiles("img/faces", ["png"]);
    let cur = { name: name || "", index: index || 0 };
    return dialog({
        title: "Select an Image", width: "1000px", height: "92vh",
        build: body => {
            const list = h("div", { class: "evList evFileList" });
            const wrap = h("div", { class: "evFilePreview" });
            const canvas = h("canvas", { class: "evCharCanvas" });
            wrap.append(canvas);
            const draw = async () => {
                const ctx = canvas.getContext("2d");
                if (!cur.name) { canvas.width = 1; canvas.height = 1; return; }
                const im = await loadImage(imgUrl("faces", cur.name));
                canvas.width = im.width; canvas.height = im.height;
                ctx.drawImage(im, 0, 0);
                const fw = im.width / 4, fh = im.height / 2;
                ctx.lineWidth = 4; ctx.strokeStyle = "#fff";
                ctx.strokeRect((cur.index % 4) * fw + 2, Math.floor(cur.index / 4) * fh + 2, fw - 4, fh - 4);
                canvas.onclick = e => {
                    const r = canvas.getBoundingClientRect();
                    cur.index = Math.floor((e.clientX - r.left) / r.width * 4) + Math.floor((e.clientY - r.top) / r.height * 2) * 4;
                    draw();
                };
            };
            for (const f of ["", ...files]) {
                const it = h("div", { class: "evListItem" + (f === cur.name ? " selected" : "") }, f || "(None)");
                it.addEventListener("click", () => {
                    cur.name = f;
                    for (const s of list.querySelectorAll(".selected")) { s.classList.remove("selected"); }
                    it.classList.add("selected"); draw();
                });
                list.append(it);
            }
            body.append(h("div", { class: "evCharContent" }, list, wrap));
            draw();
        },
        onOk: () => ({ v: cur })
    }).then(r => r ? r.v : null);
}

export function drawFace(canvas, name, index, size = 144) {
    const ctx = canvas.getContext("2d");
    canvas.width = size; canvas.height = size;
    ctx.clearRect(0, 0, size, size);
    if (!name) { return; }
    loadImage(imgUrl("faces", name)).then(im => {
        const fw = im.width / 4, fh = im.height / 2;
        ctx.drawImage(im, (index % 4) * fw, Math.floor(index / 4) * fh, fw, fh, 0, 0, size, size);
    }).catch(() => {});
}

export function facePick(name, index) {
    const canvas = h("canvas", { class: "evFaceCanvas" });
    let cur = { name: name || "", index: index || 0 };
    const el = h("button", { type: "button", class: "evFaceBtn" }, canvas);
    const refresh = () => drawFace(canvas, cur.name, cur.index, 144);
    el.addEventListener("click", async () => { const r = await faceDialog(cur.name, cur.index); if (r) { cur = r; refresh(); } });
    refresh();
    return ctl(el, () => cur, v => { cur = v; refresh(); });
}

// ---------- Tom de cor / cor ----------
const TONE_PRESETS = [["Normal", [0, 0, 0, 0]], ["Dark", [-68, -68, -68, 0]], ["Sepia", [34, -34, -68, 170]], ["Sunset", [68, -34, -34, 0]], ["Night", [-68, -68, 0, 68]]];
export function tonePick(tone, { gray = true, color = false } = {}) {
    const t = clone(tone) || [0, 0, 0, 0];
    const lim = color ? [0, 255] : [-255, 255];
    const r = slider(t[0], lim[0], lim[1]), g = slider(t[1], lim[0], lim[1]), b = slider(t[2], lim[0], lim[1]);
    const k = slider(t[3], 0, color ? 255 : 255);
    const sw = h("div", { class: "evSwatch" });
    const upd = () => {
        const v = [r.get(), g.get(), b.get(), k.get()];
        if (color) {
            sw.style.background = `rgba(${v[0]},${v[1]},${v[2]},${v[3] / 255})`;
        } else {
            const base = 128;
            const gr = v[3] / 255;
            const avg = base;
            const f = x => Math.max(0, Math.min(255, Math.round((base * (1 - gr) + avg * gr) + x)));
            sw.style.background = `rgb(${f(v[0])},${f(v[1])},${f(v[2])})`;
        }
    };
    for (const s of [r, g, b, k]) { s.onChange(upd); }
    const presets = color ? null : h("div", { class: "evRow" }, ...TONE_PRESETS.map(([n, v]) => h("button", { type: "button", class: "evBtn", onclick: () => { [r, g, b, k].forEach((s, i) => s.set(v[i])); upd(); } }, n)));
    const el = h("div", { class: "evTone" }, h("div", { class: "evToneSliders" }, field("Red", r), field("Green", g), field("Blue", b), (gray || color) ? field(color ? "Intensity" : "Gray", k) : null), sw, presets);
    upd();
    return ctl(el, () => [r.get(), g.get(), b.get(), k.get()], v => { [r, g, b, k].forEach((s, i) => s.set(v[i])); upd(); });
}

// ---------- Mini-mapa para escolher local ----------
export async function locationDialog({ mapId, x, y, title = "Select a Location", allowMapChange = true }) {
    let cur = { mapId: mapId || API.currentMapId || 1, x: x || 0, y: y || 0 };
    let app = null;
    const destroy = () => { if (app) { try { app.destroy(true, { children: true }); } catch (e) { /* ignora */ } app = null; } };
    const result = await dialog({
        title, width: "1180px", height: "94vh",
        build: body => {
            const list = h("div", { class: "evList evMapList" });
            const host = h("div", { class: "evLocHost" });
            const info = h("div", { class: "evLocInfo" });
            body.append(h("div", { class: "evLocWrap" }, allowMapChange ? list : null, h("div", { class: "evLocRight" }, host, info)));
            const infos = db.mapInfos.filter(Boolean).sort((a, b) => a.order - b.order);
            for (const m of infos) {
                const depth = (() => { let d = 0, p = m.parentId; while (p && db.mapInfos[p] && d < 10) { d++; p = db.mapInfos[p].parentId; } return d; })();
                const it = h("div", { class: "evListItem" + (m.id === cur.mapId ? " selected" : ""), style: { paddingLeft: (8 + depth * 14) + "px" } }, m.name);
                it.addEventListener("click", () => {
                    cur.mapId = m.id;
                    for (const s of list.querySelectorAll(".selected")) { s.classList.remove("selected"); }
                    it.classList.add("selected");
                    loadMap();
                });
                list.append(it);
            }
            let tilemap = null, cursor = null, map = null;
            const z = 0.5;
            let sx = 0, sy = 0;
            const apply = () => {
                if (!tilemap || !app) { return; }
                const rw = app.renderer.width, rh = app.renderer.height;
                sx = Math.max(0, Math.min(map.width * 48 * z - rw, sx)); sy = Math.max(0, Math.min(map.height * 48 * z - rh, sy));
                if (map.width * 48 * z < rw) { sx = 0; } if (map.height * 48 * z < rh) { sy = 0; }
                app.stage.scale.set(z, z);
                tilemap.width = Math.ceil(rw / z); tilemap.height = Math.ceil(rh / z);
                tilemap.origin.x = sx / z; tilemap.origin.y = sy / z;
                tilemap.refresh();
                cursor.clear();
                cursor.lineStyle(4, 0xffffff, 1).drawRect(cur.x * 48 - sx / z + 2, cur.y * 48 - sy / z + 2, 44, 44);
                cursor.lineStyle(2, 0x000000, 1).drawRect(cur.x * 48 - sx / z + 5, cur.y * 48 - sy / z + 5, 38, 38);
                info.textContent = `${db.mapName(cur.mapId)} (${cur.x},${cur.y})`;
            };
            const loadMap = async () => {
                map = await API.project.map(cur.mapId);
                const tilesets = await API.project.tilesets();
                const ts = tilesets[map.tilesetId];
                if (!app) {
                    app = new PIXI.Application({ width: host.clientWidth || 600, height: host.clientHeight || 400, backgroundColor: 0x202020, resolution: 1 });
                    host.append(app.view);
                    cursor = new PIXI.Graphics();
                    new ResizeObserver(() => { if (app) { app.renderer.resize(Math.max(1, host.clientWidth), Math.max(1, host.clientHeight)); apply(); } }).observe(host);
                    bindPointer();
                }
                if (tilemap) { app.stage.removeChild(tilemap); tilemap.destroy(); }
                tilemap = new Tilemap();
                tilemap.tileWidth = 48; tilemap.tileHeight = 48;
                tilemap.setData(map.width, map.height, map.data);
                const bitmaps = ts.tilesetNames.map(n => ImageManager.loadTileset(n));
                tilemap.setBitmaps(bitmaps);
                for (const bm of bitmaps) { bm.addLoadListener(() => apply()); }
                if (!app.__evTick) { app.__evTick = true; app.ticker.add(() => { if (tilemap) { tilemap.update(); } }); }
                tilemap.flags = ts.flags;
                app.stage.addChildAt(tilemap, 0);
                app.stage.addChild(cursor);
                cur.x = Math.min(cur.x, map.width - 1); cur.y = Math.min(cur.y, map.height - 1);
                sx = cur.x * 48 * z - (app.renderer.width / 2); sy = cur.y * 48 * z - (app.renderer.height / 2);
                apply();
            };
            const bindPointer = () => {
                const v = app.view;
                v.style.touchAction = "none";
                let down = null, moved = false;
                v.addEventListener("pointerdown", e => { v.setPointerCapture(e.pointerId); down = { x: e.clientX, y: e.clientY }; moved = false; });
                v.addEventListener("pointermove", e => {
                    if (!down) { return; }
                    const dx = e.clientX - down.x, dy = e.clientY - down.y;
                    if (Math.abs(dx) + Math.abs(dy) > 6) { moved = true; }
                    if (moved) { sx -= dx; sy -= dy; down = { x: e.clientX, y: e.clientY }; apply(); }
                });
                v.addEventListener("pointerup", e => {
                    if (down && !moved && map) {
                        const r = v.getBoundingClientRect();
                        const tx = Math.floor((e.clientX - r.left + sx) / (48 * z)), ty = Math.floor((e.clientY - r.top + sy) / (48 * z));
                        if (tx >= 0 && ty >= 0 && tx < map.width && ty < map.height) { cur.x = tx; cur.y = ty; apply(); }
                    }
                    down = null;
                });
            };
            requestAnimationFrame(loadMap);
        },
        onOk: () => ({ v: { ...cur } })
    });
    destroy();
    return result ? result.v : null;
}

export function locationPick(mapId, x, y, { width = "260px", allowMapChange = true } = {}) {
    return pickBtn({ mapId, x, y }, v => `${db.mapName(v.mapId)} (${v.x},${v.y})`, cur => locationDialog({ ...cur, allowMapChange }), { width });
}

// Abas simples (MZ usa QTabWidget em vários diálogos).
export function tabs(defs, active = 0) {
    const bar = h("div", { class: "evTabs" });
    const pages = h("div", { class: "evTabPages" });
    const btns = defs.map((d, i) => {
        const b = h("button", { type: "button", class: "evTab" }, d.label);
        const p = h("div", { class: "evTabPage" }, ...(d.content || []).map(c => c && c.el ? c.el : c));
        b.addEventListener("click", () => show(i));
        bar.append(b); pages.append(p);
        return { b, p };
    });
    const show = i => { btns.forEach((x, j) => { x.b.classList.toggle("on", i === j); x.p.style.display = i === j ? "" : "none"; }); el.dataset.active = i; };
    const el = h("div", { class: "evTabsWrap" }, bar, pages);
    show(active);
    return { el, show, pages: btns.map(x => x.p), get active() { return Number(el.dataset.active); } };
}
