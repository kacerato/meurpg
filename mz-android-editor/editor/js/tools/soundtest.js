// Sound Test (Ferramentas → Teste de Som), como no MZ: abas BGM/BGS/ME/SE, lista de
// arquivos de audio/<tipo>/, Volume/Pitch/Pan e Play/Stop. Como no MZ, a música continua
// tocando depois que a janela é fechada (para servir de fundo enquanto se edita).
import { el, button, modal } from "./ui.js";
import * as audio from "./audio.js";
import { t } from "../i18n.js";

const TYPES = ["bgm", "bgs", "me", "se"];
const st = { type: "bgm", sel: { bgm: null, bgs: null, me: null, se: null }, volume: 90, pitch: 100, pan: 0 };
let api = null;

export function init(theApi) { api = theApi; }

const withTitle = (b, title) => { b.title = title; return b; };

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
    const slider = (key, min, max, label, hint) => {
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
        return el("div", { class: "tlField", title: hint }, el("label", { text: label }), el("div", { class: "tlRow" }, input, num));
    };

    const playSel = () => {
        const name = st.sel[st.type];
        if (!name) { return; }
        audio.play(st.type, { name, volume: st.volume, pitch: st.pitch, pan: st.pan }, cur.files);
        nowPlaying.textContent = `♪ ${st.type.toUpperCase()}: ${name}`;
    };
    const renderList = () => {
        if (!cur.names.length) {
            list.replaceChildren(el("div", { class: "tlHint", text: t("(no files in %1)", null, "audio/" + st.type) }));
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
    const selectType = async type => {
        st.type = type;
        for (const b of tabs.children) { b.classList.toggle("on", b.dataset.type === type); }
        list.replaceChildren(el("div", { class: "tlHint", text: t("Loading…") }));
        cur = await listAudio(type);
        if (st.sel[type] && !cur.names.includes(st.sel[type])) { st.sel[type] = null; }
        renderList();
    };
    for (const type of TYPES) {
        const b = el("button", { class: "tlTab", type: "button", "data-type": type }, type.toUpperCase());
        b.addEventListener("click", () => selectType(type));
        tabs.appendChild(b);
    }

    const p = modal(api, {
        title: t("Sound Test", "Dialog_SoundTest"), width: "720px", height: "540px", cls: "tlSoundDlg",
        build: b => {
            b.classList.add("tlSoundBody");
            b.append(
                el("div", { class: "tlCol tlColFiles" }, tabs, list),
                el("div", { class: "tlCol tlColCtrl" },
                    slider("volume", 0, 100, t("Volume", "Layout_AudioSelector"), t("Volume for audio playback.", "Layout_AudioSelector")),
                    slider("pitch", 50, 150, t("Pitch", "Layout_AudioSelector"), t("Pitch for audio playback.", "Layout_AudioSelector")),
                    slider("pan", -100, 100, t("Pan", "Layout_AudioSelector"), t("Pan for audio playback.", "Layout_AudioSelector")),
                    el("div", { class: "tlRow tlPlayRow" },
                        withTitle(button("▶ " + t("Play", "Layout_AudioSelector"), playSel, "primary"), t("Plays the selected file.", "Layout_AudioSelector")),
                        withTitle(button("■ " + t("Stop", "Layout_AudioSelector"), () => { audio.stop(st.type); nowPlaying.textContent = ""; }), t("Stops playback.", "Layout_AudioSelector"))),
                    button(t("Stop All"), () => { audio.stop(); nowPlaying.textContent = ""; }),
                    nowPlaying,
                    audio.usingFallback() ? el("div", { class: "tlHint", text: t("Pan is not available in this browser.") }) : null));
        },
        buttons: [{ label: t("Close", "BasicConstants"), primary: true, value: true }]
    });
    // Teclado como no MZ: Espaço toca o arquivo selecionado; ↑/↓ mudam a seleção.
    const onKey = ev => {
        const tag = ev.target && ev.target.tagName;
        const typing = (tag === "INPUT" && ev.target.type !== "range") || tag === "TEXTAREA" || tag === "SELECT";
        if (ev.key === " " && !typing && !ev.repeat) {
            ev.preventDefault();
            playSel();
        } else if ((ev.key === "ArrowDown" || ev.key === "ArrowUp") && !typing && tag !== "INPUT" && cur.names.length) {
            ev.preventDefault();
            const i = cur.names.indexOf(st.sel[st.type]);
            const j = Math.max(0, Math.min(cur.names.length - 1, i < 0 ? 0 : i + (ev.key === "ArrowDown" ? 1 : -1)));
            st.sel[st.type] = cur.names[j];
            renderList();
        }
    };
    document.addEventListener("keydown", onKey, true);
    try {
        await selectType(st.type);
        await p;
    } finally {
        document.removeEventListener("keydown", onKey, true);
    }
}
