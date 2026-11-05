// Ajuda → Conteúdo (manual oficial em editor/help/en/, num iframe) e Ajuda → Sobre.
import { el, modal } from "./ui.js";
import { t } from "../i18n.js";

export const EDITOR_VERSION = "0.4.0";
export const MZ_VERSION = "1.1.1";
const HELP_BASE = new URL("../../help/", import.meta.url);

// page: arquivo do manual (ex.: "01_05.html" = Aid Tools). lang: só "en" incluído.
export async function openHelp(api, page = "index.html") {
    const url = new URL("en/" + page, HELP_BASE).href;
    const frame = el("iframe", { class: "tlHelpFrame", src: url, title: t("RPG Maker MZ Help") });
    const back = el("button", { class: "tlBtn", type: "button", title: t("Back") }, "◀");
    const fwd = el("button", { class: "tlBtn", type: "button", title: t("Forward") }, "▶");
    const home = el("button", { class: "tlBtn", type: "button", title: t("Home") }, "⌂");
    back.addEventListener("click", () => { try { frame.contentWindow.history.back(); } catch {} });
    fwd.addEventListener("click", () => { try { frame.contentWindow.history.forward(); } catch {} });
    home.addEventListener("click", () => { frame.src = new URL("en/index.html", HELP_BASE).href; });
    const topics = el("select", { class: "tlInput" },
        ...[["index.html", t("Home")], ["01_02.html", t("Getting Started")], ["01_03.html", t("Basic Editor Controls")],
            ["01_04.html", t("Menu Bar Content")], ["01_05.html", t("Aid Tools")], ["01_07.html", t("Map", "MainMenu")],
            ["01_08.html", t("Database", "MainMenu")], ["01_09.html", t("Events")], ["01_10.html", t("Event Commands", "Dialog_EventCommandSelect")],
            ["01_11_01.html", t("Asset Standards")], ["01_11_04.html", t("Plugins")]]
            .map(([v, label]) => el("option", { value: v, selected: v === page }, label)));
    topics.addEventListener("change", () => { frame.src = new URL("en/" + topics.value, HELP_BASE).href; });
    await modal(api, {
        title: t("RPG Maker MZ Help"), width: "1180px", height: "580px", cls: "tlHelpDlg",
        build: b => {
            b.classList.add("tlHelpBody");
            b.append(el("div", { class: "tlRow tlHelpBar" }, back, fwd, home, topics,
                el("a", { class: "tlLink", href: url, target: "_blank", rel: "noopener" }, t("Open in New Window"))), frame);
        },
        buttons: [{ label: t("Close", "BasicConstants"), primary: true, value: true }]
    });
}

export async function openAbout(api) {
    let runtime = "?";
    try { runtime = (window.Utils && Utils.RPGMAKER_VERSION) || "?"; } catch {}
    const platform = (window.Android && window.Android.platform && window.Android.platform()) || (api.project && api.project.info && api.project.info.platform) || "web";
    await modal(api, {
        title: t("About %1", "Dialog_About", "MZ Editor"), width: "560px", height: "auto", cls: "tlAboutDlg",
        build: b => {
            b.append(el("div", { class: "tlAbout" },
                el("img", { src: "img/app.png", alt: "", class: "tlAboutIcon" }),
                el("div", {},
                    el("div", { class: "tlAboutTitle", text: t("MZ Editor (Android port)") }),
                    el("div", { text: t("Version %1 — compatible with RPG Maker MZ %2 projects", null, EDITOR_VERSION, MZ_VERSION) }),
                    el("div", { text: t("Project core script: %1 · Platform: %2", null, runtime, platform) }),
                    el("div", { class: "tlAboutCredits" },
                        el("div", { text: t("RPG Maker MZ © Gotcha Gotcha Games Inc. / Yoji Ojima. The runtime (rmmz_*.js), manual, icons and project template belong to their authors and are used from the user's licensed installation.") }),
                        el("div", { text: t("M+ fonts (M+ FONTS PROJECT, free license). PixiJS (MIT), Effekseer (MIT), pako (MIT), localForage (Apache-2.0).") }),
                        el("div", { text: t("Web editor and Android shell: this project's own code.") })))));
        },
        buttons: [{ label: t("OK", "BasicConstants"), primary: true, value: true }]
    });
}
