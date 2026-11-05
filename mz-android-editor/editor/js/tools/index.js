// Módulo "tools": Resource Manager, Sound Test, Novo projeto, Opções e Ajuda/Sobre.
// Contrato: mz-android-editor/SESSIONS.md. Expõe api.tools para os outros módulos.
import { el } from "./ui.js";
import * as resources from "./resources.js";
import * as soundtest from "./soundtest.js";
import * as options from "./options.js";
import { openNewProject, createProject, apiWriter, dirWriter, zipWriter, loadManifest } from "./newproject.js";
import { openHelp, openAbout } from "./help.js";

function injectCss() {
    if (document.getElementById("tlCss")) { return; }
    const link = document.createElement("link");
    link.id = "tlCss";
    link.rel = "stylesheet";
    link.href = new URL("../../css/tools.css", import.meta.url).href;
    document.head.appendChild(link);
}

function toolbarButton(id, icon, title, onClick) {
    const b = el("button", { id, class: "tb", title, type: "button" }, el("img", { src: icon, alt: "" }));
    b.addEventListener("click", onClick);
    return b;
}

// Menu "☰" à direita da barra: Opções, Ajuda, Sobre (+ atalhos das ferramentas).
function buildMenu(api) {
    const bar = document.getElementById("toolbar");
    if (!bar || document.getElementById("btnToolsMenu")) { return; }
    const help = toolbarButton("btnHelpContents", "img/toolbar/help-contents.png", "Conteúdo da ajuda", () => openHelp(api));
    const menuBtn = el("button", { id: "btnToolsMenu", class: "tb tlMenuBtn", title: "Menu", type: "button" }, "☰");
    const about = toolbarButton("btnHelpAbout", "img/toolbar/help-about.png", "Sobre", () => openAbout(api));
    bar.append(el("span", { class: "sep" }), help, about, menuBtn);

    const items = [
        ["img/toolbar/file-new.png", "Novo projeto…", () => openNewProject(api)],
        ["img/toolbar/tools-resourcemanager.png", "Resource Manager…", () => resources.openResourceManager()],
        ["img/toolbar/tools-soundtest.png", "Sound Test…", () => soundtest.openSoundTest()],
        null,
        ["", "⚙ Opções…", () => options.openOptions()],
        null,
        ["img/toolbar/help-contents.png", "Conteúdo da ajuda", () => openHelp(api)],
        ["img/toolbar/help-about.png", "Sobre o MZ Editor…", () => openAbout(api)]
    ];
    const menu = el("div", { class: "tlMenu", hidden: true });
    for (const it of items) {
        if (!it) { menu.appendChild(el("div", { class: "tlMenuSep" })); continue; }
        const [icon, label, fn] = it;
        const row = el("button", { class: "tlMenuItem", type: "button" },
            icon ? el("img", { src: icon, alt: "" }) : el("span", { class: "tlMenuNoIcon" }), label);
        row.addEventListener("click", () => { hide(); fn(); });
        menu.appendChild(row);
    }
    const backdrop = el("div", { class: "tlMenuBackdrop", hidden: true });
    const hide = () => { menu.hidden = true; backdrop.hidden = true; };
    backdrop.addEventListener("click", hide);
    menuBtn.addEventListener("click", () => {
        if (!menu.hidden) { hide(); return; }
        const r = menuBtn.getBoundingClientRect();
        menu.style.top = (r.bottom + 2) + "px";
        menu.style.right = Math.max(4, window.innerWidth - r.right) + "px";
        menu.hidden = false;
        backdrop.hidden = false;
    });
    document.body.append(backdrop, menu);
}

export async function register(api) {
    injectCss();
    resources.init(api);
    soundtest.init(api);
    options.init(api);

    api.bindToolbar("btnResources", () => resources.openResourceManager(), "Resource Manager");
    api.bindToolbar("btnSoundTest", () => soundtest.openSoundTest(), "Sound Test");
    api.bindToolbar("btnNew", () => openNewProject(api), "Novo projeto");
    buildMenu(api);

    api.tools = {
        // Abre o seletor de arquivos e importa para a pasta (ex.: "img/faces"). → nomes gravados
        importFiles: folder => resources.importFiles(folder),
        // Lista + pré-visualização + Importar. → nome sem extensão, "" (Nenhum) ou null (cancelado)
        pickResource: (folder, opts) => resources.pickResource(folder, opts),
        importFromFolder: only => resources.importFromFolder(only),
        listFolder: folder => resources.listFolder(folder),
        exportFile: (folder, name) => resources.exportFile(folder, name),
        folders: resources.FOLDERS.slice(),
        openResourceManager: () => resources.openResourceManager(),
        openSoundTest: () => soundtest.openSoundTest(),
        openNewProject: () => openNewProject(api),
        openOptions: () => options.openOptions(),
        openHelp: page => openHelp(api, page),
        openAbout: () => openAbout(api),
        options: { get: options.get, set: options.set },
        newProject: { createProject, apiWriter, dirWriter, zipWriter, loadManifest }
    };
}
