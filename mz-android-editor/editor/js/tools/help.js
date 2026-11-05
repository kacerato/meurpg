// Ajuda → Conteúdo (manual oficial em editor/help/en/, num iframe) e Ajuda → Sobre.
import { el, modal } from "./ui.js";

export const EDITOR_VERSION = "0.4.0";
export const MZ_VERSION = "1.1.1";
const HELP_BASE = new URL("../../help/", import.meta.url);

// page: arquivo do manual (ex.: "01_05.html" = Aid Tools). lang: só "en" incluído.
export async function openHelp(api, page = "index.html") {
    const url = new URL("en/" + page, HELP_BASE).href;
    const frame = el("iframe", { class: "tlHelpFrame", src: url, title: "Manual do RPG Maker MZ" });
    const back = el("button", { class: "tlBtn", type: "button", title: "Voltar" }, "◀");
    const fwd = el("button", { class: "tlBtn", type: "button", title: "Avançar" }, "▶");
    const home = el("button", { class: "tlBtn", type: "button", title: "Início" }, "⌂");
    back.addEventListener("click", () => { try { frame.contentWindow.history.back(); } catch {} });
    fwd.addEventListener("click", () => { try { frame.contentWindow.history.forward(); } catch {} });
    home.addEventListener("click", () => { frame.src = new URL("en/index.html", HELP_BASE).href; });
    const topics = el("select", { class: "tlInput" },
        ...[["index.html", "Início"], ["01_02.html", "Getting Started"], ["01_03.html", "Basic Editor Controls"],
            ["01_04.html", "Menu Bar Content"], ["01_05.html", "Aid Tools"], ["01_07.html", "Map"],
            ["01_08.html", "Database"], ["01_09.html", "Events"], ["01_10.html", "Event Commands"],
            ["01_11_01.html", "Asset Standards"], ["01_11_04.html", "Plugins"]]
            .map(([v, t]) => el("option", { value: v, selected: v === page }, t)));
    topics.addEventListener("change", () => { frame.src = new URL("en/" + topics.value, HELP_BASE).href; });
    await modal(api, {
        title: "RPG Maker MZ Help", width: "1180px", height: "580px", cls: "tlHelpDlg",
        build: b => {
            b.classList.add("tlHelpBody");
            b.append(el("div", { class: "tlRow tlHelpBar" }, back, fwd, home, topics,
                el("a", { class: "tlLink", href: url, target: "_blank", rel: "noopener" }, "abrir em nova janela")), frame);
        },
        buttons: [{ label: "Fechar", primary: true, value: true }]
    });
}

export async function openAbout(api) {
    let runtime = "?";
    try { runtime = (window.Utils && Utils.RPGMAKER_VERSION) || "?"; } catch {}
    const platform = (window.Android && window.Android.platform && window.Android.platform()) || (api.project && api.project.info && api.project.info.platform) || "web";
    await modal(api, {
        title: "About", width: "560px", height: "auto", cls: "tlAboutDlg",
        build: b => {
            b.append(el("div", { class: "tlAbout" },
                el("img", { src: "img/app.png", alt: "", class: "tlAboutIcon" }),
                el("div", {},
                    el("div", { class: "tlAboutTitle", text: "MZ Editor (port Android)" }),
                    el("div", { text: `Versão ${EDITOR_VERSION} — compatível com projetos RPG Maker MZ ${MZ_VERSION}` }),
                    el("div", { text: `Core script do projeto: ${runtime} · Plataforma: ${platform}` }),
                    el("div", { class: "tlAboutCredits" },
                        el("div", { text: "RPG Maker MZ © Gotcha Gotcha Games Inc. / Yoji Ojima. Runtime (rmmz_*.js), manual, ícones e template de projeto pertencem aos seus autores e são usados a partir da instalação licenciada do usuário." }),
                        el("div", { text: "Fontes M+ (M+ FONTS PROJECT, licença livre). PixiJS (MIT), Effekseer (MIT), pako (MIT), localForage (Apache-2.0)." }),
                        el("div", { text: "Editor web e casca Android: código próprio deste projeto." })))));
        },
        buttons: [{ label: "OK", primary: true, value: true }]
    });
}
