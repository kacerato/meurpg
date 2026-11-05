// Sound Test (Ferramentas → Teste de Som), como no MZ: abas BGM/BGS/ME/SE, lista de
// arquivos de audio/<tipo>/, Volume/Pitch/Pan e Play/Stop. Como no MZ, a música continua
// tocando depois que a janela é fechada (para servir de fundo enquanto se edita).
import { el, button, modal } from "./ui.js";
import * as audio from "./audio.js";

const TYPES = ["bgm", "bgs", "me", "se"];
const st = { type: "bgm", sel: { bgm: null, bgs: null, me: null, se: null }, volume: 90, pitch: 100, pan: 0 };
let api = null;

export function init(theApi) { api = theApi; }

async function listAudio(type) {
    const entries = await api.project.list("audio/" + type).catch(() => []);
    const files = new Set();
    const names = new Set();
    for (const e of entries || []) {
        const n = e.name || e;
        if (e.dir) { continue; }
        const m = /^(.*)\.(ogg|m4a)$/i.exec(n);
        if (m) { files.add(n); names.add(m[1]); }
    }
    return { files, names: [...names].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })) };
}

export async function openSoundTest() {
    let cur = { files: new Set(), names: [] };
    const tabs = el("div", { class: "tlTabs" });
    const list = el("div", { class: "tlList tlFiles" });
    const nowPlaying = el("div", { class: "tlNow" });

    const sliders = {};
    const slider = (key, min, max, label) => {
        const input = el("input", { type: "range", min, max, step: 1, value: st[key], class: "tlRange" });
        const num = el("input", { type: "number", min, max, value: st[key], class: "tlNum" });
        const sync = v => {
            st[key] = Math.max(min, Math.min(max, Number(v) || 0));
            input.value = st[key]; num.value = st[key];
            audio.update(st.type, st);
        };
        input.addEventListener("input", () => sync(input.value));
        num.addEventListener("change", () => sync(num.value));
        sliders[key] = sync;
        return el("div", { class: "tlField" }, el("label", { text: label }), el("div", { class: "tlRow" }, input, num));
    };

    const playSel = () => {
        const name = st.sel[st.type];
        if (!name) { return; }
        audio.play(st.type, { name, volume: st.volume, pitch: st.pitch, pan: st.pan }, cur.files);
        nowPlaying.textContent = `♪ ${st.type.toUpperCase()}: ${name}`;
    };
    const renderList = () => {
        if (!cur.names.length) {
            list.replaceChildren(el("div", { class: "tlHint", text: `(nenhum arquivo em audio/${st.type})` }));
            return;
        }
        list.replaceChildren(...cur.names.map(n => {
            const row = el("div", { class: "tlItem" + (n === st.sel[st.type] ? " selected" : "") }, n);
            row.addEventListener("click", () => { st.sel[st.type] = n; renderList(); });
            row.addEventListener("dblclick", () => { st.sel[st.type] = n; renderList(); playSel(); });
            return row;
        }));
        const s = list.querySelector(".selected");
        if (s) { s.scrollIntoView({ block: "nearest" }); }
    };
    const selectType = async t => {
        st.type = t;
        for (const b of tabs.children) { b.classList.toggle("on", b.dataset.type === t); }
        list.replaceChildren(el("div", { class: "tlHint", text: "Carregando…" }));
        cur = await listAudio(t);
        if (st.sel[t] && !cur.names.includes(st.sel[t])) { st.sel[t] = null; }
        renderList();
    };
    for (const t of TYPES) {
        const b = el("button", { class: "tlTab", type: "button", "data-type": t }, t.toUpperCase());
        b.addEventListener("click", () => selectType(t));
        tabs.appendChild(b);
    }

    const p = modal(api, {
        title: "Sound Test", width: "720px", height: "540px", cls: "tlSoundDlg",
        build: b => {
            b.classList.add("tlSoundBody");
            b.append(
                el("div", { class: "tlCol tlColFiles" }, tabs, list),
                el("div", { class: "tlCol tlColCtrl" },
                    slider("volume", 0, 100, "Volume"),
                    slider("pitch", 50, 150, "Pitch"),
                    slider("pan", -100, 100, "Pan"),
                    el("div", { class: "tlRow tlPlayRow" },
                        button("▶ Play", playSel, "primary"),
                        button("■ Stop", () => { audio.stop(st.type); nowPlaying.textContent = ""; })),
                    button("Parar tudo", () => { audio.stop(); nowPlaying.textContent = ""; }),
                    nowPlaying,
                    audio.usingFallback() ? el("div", { class: "tlHint", text: "Pan indisponível neste navegador." }) : null));
        },
        buttons: [{ label: "Fechar", primary: true, value: true }]
    });
    await selectType(st.type);
    await p;
}
