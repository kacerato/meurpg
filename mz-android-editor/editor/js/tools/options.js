// Opções (Ferramentas → Opções). As do MZ (Cor transparente, Grade do mapa, Tema,
// Seletor de objetos) + as do port (tamanho de ícones, idioma, confirmação ao sair,
// salvamento automático). Persistidas em localStorage["mzEditor.options"].
import { el, modal } from "./ui.js";

const KEY = "mzEditor.options";
export const DEFAULTS = {
    transparentColor: "#808080",
    showGrid: true,
    theme: "light",           // light | dark
    objectSelector: "smart",  // dropdown | extended | smart
    iconSize: "normal",       // small | normal | large
    lang: "pt_BR",            // pt_BR | en | ja | zh
    confirmExit: false,       // sempre pedir confirmação (maptools já pede se houver alterações)
    autosave: 0               // minutos; 0 = desligado
};

let api = null;
let values = { ...DEFAULTS };
let autosaveTimer = 0;

export function load() {
    try { values = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; }
    catch { values = { ...DEFAULTS }; }
    return values;
}
export function get(key) { return key ? values[key] : { ...values }; }
export function set(patch) {
    values = { ...values, ...patch };
    try { localStorage.setItem(KEY, JSON.stringify(values)); } catch { /* sem storage */ }
    apply();
    if (api) { api.emit("options:changed", { ...values }); }
}

const ICON = { small: { img: 18, bar: 40 }, normal: { img: 22, bar: 46 }, large: { img: 30, bar: 56 } };

export function apply() {
    const root = document.documentElement;
    root.dataset.theme = values.theme;
    root.dataset.iconsize = values.iconSize;
    root.lang = { pt_BR: "pt-BR", en: "en", ja: "ja", zh: "zh-CN" }[values.lang] || "pt-BR";
    const ic = ICON[values.iconSize] || ICON.normal;
    root.style.setProperty("--bar-h", ic.bar + "px");
    root.style.setProperty("--tl-icon", ic.img + "px");
    const vp = document.getElementById("viewport");
    if (vp) { vp.style.background = values.transparentColor; }
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
                if (api) { api.status("Salvo automaticamente"); }
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
    const color = el("input", { type: "color", value: draft.transparentColor, class: "tlColor" });
    color.addEventListener("input", () => { draft.transparentColor = color.value; });

    const group = (title, ...rows) => el("fieldset", { class: "tlGroup" }, el("legend", { text: title }), ...rows);
    const row = (label, ctrl) => el("div", { class: "tlFormRow" }, el("label", { text: label }), ctrl);

    const ok = await modal(api, {
        title: "Options", width: "640px", height: "auto", cls: "tlOptDlg",
        build: b => {
            b.append(
                el("div", { class: "tlOptGrid" },
                    group("Transparent Color", row("Cor:", color)),
                    group("Map Grid", check("showGrid", "Mostrar")),
                    group("UI",
                        row("Tema:", sel("theme", [["light", "Claro"], ["dark", "Escuro"]])),
                        row("Seletor de objetos:", sel("objectSelector", [["dropdown", "Dropdown"], ["extended", "Extended"], ["smart", "Smart"]])),
                        row("Ícones da barra:", sel("iconSize", [["small", "Pequenos"], ["normal", "Normais"], ["large", "Grandes"]])),
                        row("Idioma:", sel("lang", [["pt_BR", "Português (Brasil)"], ["en", "English"], ["ja", "日本語"], ["zh", "简体中文"]]))),
                    group("Editor",
                        check("confirmExit", "Confirmar ao sair do editor"),
                        row("Salvar automaticamente:", sel("autosave", [[0, "Desligado"], [1, "A cada 1 min"], [5, "A cada 5 min"], [10, "A cada 10 min"]])))),
                el("div", { class: "tlHint", text: "O idioma vale para os rótulos que os módulos traduzirem (api.tools.options.get('lang'))." }));
        },
        buttons: [
            { label: "OK", primary: true, value: true },
            { label: "Cancelar", value: false },
            { label: "Padrão", value: "reset" }
        ]
    });
    if (ok === "reset") { set({ ...DEFAULTS }); }
    else if (ok) { set(draft); }
}
