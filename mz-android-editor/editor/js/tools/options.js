// Opções (Ferramentas → Opções). As do MZ (Cor transparente, Grade do mapa, Tema,
// Seletor de objetos) + as do port (tamanho de ícones, idioma, confirmação ao sair,
// salvamento automático). Persistidas em localStorage["mzEditor.options"].
import { el, modal } from "./ui.js";
import { t, LANGUAGES, normalizeLanguage } from "../i18n.js";

const KEY = "mzEditor.options";
export const DEFAULTS = {
    transparentColor: "#808080",
    showGrid: true,
    theme: "light",           // light | dark
    objectSelector: "smart",  // dropdown | extended | smart
    iconSize: "normal",       // small | normal | large
    lang: "pt_BR",            // pt_BR | en | ja_JP | zh_CN | zh_TW | ko_KR | de_DE | es_ES | fr_FR | it_IT | ru_RU (i18n.js)
    confirmExit: false,       // sempre pedir confirmação (maptools já pede se houver alterações)
    autosave: 0               // minutos; 0 = desligado
};

let api = null;
let values = { ...DEFAULTS };
let autosaveTimer = 0;

export function load() {
    try { values = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; }
    catch { values = { ...DEFAULTS }; }
    // valores antigos ("ja", "zh") viram os locales do .qm (i18n.js)
    values.lang = normalizeLanguage(values.lang);
    return values;
}
export function get(key) { return key ? values[key] : { ...values }; }
export function set(patch) {
    values = { ...values, ...patch };
    try { localStorage.setItem(KEY, JSON.stringify(values)); } catch { /* sem storage */ }
    apply();
    if (api) { api.emit("options:changed", { ...values }); }
}

// Opções → Seletor de objetos (MZ, 01_05): "Dropdown" = lista suspensa; "Extended" = janela
// separada; "Smart" = escolhe pela quantidade (lista suspensa abaixo de 100 objetos — textos do
// .qm: "Optimized for less than 100 objects" / "Optimized for hundreds of objects").
// Devolve "dropdown" ou "extended" para uma lista com `count` objetos.
export const SMART_LIMIT = 100;
export function objectSelectorMode(count) {
    const m = values.objectSelector;
    if (m === "dropdown" || m === "extended") { return m; }
    return (count || 0) < SMART_LIMIT ? "dropdown" : "extended";
}

const ICON = { small: { img: 18, bar: 40 }, normal: { img: 22, bar: 46 }, large: { img: 30, bar: 56 } };

export function apply() {
    const root = document.documentElement;
    root.dataset.theme = values.theme;
    root.dataset.iconsize = values.iconSize;
    const ic = ICON[values.iconSize] || ICON.normal;
    root.style.setProperty("--bar-h", ic.bar + "px");
    root.style.setProperty("--tl-icon", ic.img + "px");
    // Cor transparente (MZ: "cor usada no fundo transparente do editor"): vale nos visualizadores
    // de imagem (tools.css aplica --mz-transparent a eles), não no fundo do mapa.
    root.style.setProperty("--mz-transparent", values.transparentColor);
    root.dataset.objectSelector = values.objectSelector;
    // Grade: o botão btnGrid (app.js) é quem liga/desliga no MapView
    const grid = document.getElementById("btnGrid");
    if (grid && grid.classList.contains("on") !== !!values.showGrid) { grid.click(); }
    clearInterval(autosaveTimer);
    if (values.autosave > 0) {
        autosaveTimer = setInterval(() => {
            const save = document.getElementById("btnSave");
            // maptools marca btnSave com .mtModified quando há alterações não salvas
            if (save && !save.disabled && save.classList.contains("mtModified")) {
                save.click();
                if (api) { api.status(t("Saved automatically")); }
            }
        }, values.autosave * 60000);
    }
}

function onBeforeUnload(e) {
    if (values.confirmExit) { e.preventDefault(); e.returnValue = ""; }
}

export function init(theApi) {
    api = theApi;
    load();
    apply();
    window.addEventListener("beforeunload", onBeforeUnload);
    // mantém showGrid coerente se o usuário usar o botão # diretamente
    const grid = document.getElementById("btnGrid");
    if (grid) {
        grid.addEventListener("click", () => {
            const on = grid.classList.contains("on");
            if (on !== values.showGrid) {
                values.showGrid = on;
                try { localStorage.setItem(KEY, JSON.stringify(values)); } catch {}
            }
        });
    }
}

export async function openOptions() {
    const draft = { ...values };
    const sel = (key, opts) => {
        const s = el("select", { class: "tlInput" }, ...opts.map(([v, label]) => el("option", { value: v, selected: String(draft[key]) === String(v) }, label)));
        s.addEventListener("change", () => { draft[key] = typeof DEFAULTS[key] === "number" ? Number(s.value) : s.value; });
        return s;
    };
    const check = (key, label) => {
        const c = el("input", { type: "checkbox", checked: !!draft[key] });
        c.addEventListener("change", () => { draft[key] = c.checked; });
        return el("label", { class: "tlCheckLbl" }, c, label);
    };
    // Cor transparente como no MZ: Vermelho / Verde / Azul (0–255) + amostra.
    const hex = n => n.toString(16).padStart(2, "0");
    const rgb = [1, 3, 5].map(i => parseInt(String(draft.transparentColor).slice(i, i + 2), 16) || 0);
    const swatch = el("div", { class: "tlSwatch", title: t("Shows how the transparent color looks like.", "Group_CheckerboardColor") });
    const syncColor = () => {
        draft.transparentColor = "#" + rgb.map(hex).join("");
        swatch.style.setProperty("--sw", draft.transparentColor);
    };
    const chan = (i, label, tip) => {
        const n = el("input", { type: "number", class: "tlInput tlNum", min: 0, max: 255, step: 1, value: rgb[i], title: tip });
        n.addEventListener("input", () => { rgb[i] = Math.max(0, Math.min(255, Math.round(Number(n.value) || 0))); syncColor(); });
        n.addEventListener("change", () => { n.value = rgb[i]; });
        return row0(label + ":", n);
    };
    const row0 = (label, ctrl) => el("div", { class: "tlFormRow" }, el("label", { text: label }), ctrl);
    const colorRows = () => [
        chan(0, t("Red", "Group_CheckerboardColor"), t("R value of the transparent color.", "Group_CheckerboardColor")),
        chan(1, t("Green", "Group_CheckerboardColor"), t("G value of the transparent color.", "Group_CheckerboardColor")),
        chan(2, t("Blue", "Group_CheckerboardColor"), t("B value of the transparent color.", "Group_CheckerboardColor")),
        row0("", swatch)
    ];
    syncColor();

    const group = (title, ...rows) => el("fieldset", { class: "tlGroup" }, el("legend", { text: title }), ...rows);
    const row = (label, ctrl) => el("div", { class: "tlFormRow" }, el("label", { text: label }), ctrl);

    const ok = await modal(api, {
        title: t("Options", "Dialog_Options"), width: "640px", height: "auto", cls: "tlOptDlg",
        build: b => {
            b.append(
                el("div", { class: "tlOptGrid" },
                    group(t("Transparent Color", "Group_CheckerboardColor"), ...colorRows()),
                    group(t("Map Grid", "Group_MapGrid"), check("showGrid", t("Show", "Group_MapGrid"))),
                    group(t("UI", "Group_UI"),
                        row(t("Theme", "Group_UI") + ":", sel("theme", [["light", t("Default", "Constants")], ["dark", t("Dark", "Constants")]])),
                        row(t("Object Selector", "Group_UI") + ":", sel("objectSelector", [["dropdown", t("Dropdown", "Constants")], ["extended", t("Extended", "Constants")], ["smart", t("Smart", "Constants")]])),
                        row(t("Toolbar icons:"), sel("iconSize", [["small", t("Small")], ["normal", t("Normal", "Constants")], ["large", t("Large")]])),
                        row(t("Language:"), sel("lang", LANGUAGES))),
                    group(t("Editor"),
                        check("confirmExit", t("Confirm when leaving the editor")),
                        row(t("Autosave:"), sel("autosave", [[0, t("OFF", "Constants")], [1, t("Every %1 min", null, 1)], [5, t("Every %1 min", null, 5)], [10, t("Every %1 min", null, 10)]])))),
                el("div", { class: "tlHint", text: t("Changing the language reloads the editor.") }));
        },
        buttons: [
            { label: t("OK", "BasicConstants"), primary: true, value: true },
            { label: t("Cancel", "BasicConstants"), value: false },
            { label: t("Default", "Constants"), value: "reset" }
        ]
    });
    if (ok === "reset") { set({ ...DEFAULTS }); }
    else if (ok) { set(draft); }
}
