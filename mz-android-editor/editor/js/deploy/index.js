// Módulo deploy: Arquivo > Implantação (Deployment) do RPG Maker MZ.
// Plataformas: Navegadores web (pasta ou .zip) e Android (APK instalável gerado no aparelho).
// Ver NOTES.md.

import { md5, encryptAsset, decryptAsset, encryptKind } from "./crypto.js";
import { findUsedFiles } from "./scan.js";
import { ZipWriter } from "./zip.js";
import { t } from "../i18n.js";

const ICON = new URL("./deploy.svg", import.meta.url).href;

function injectCss() {
    if (document.getElementById("deployCss")) {
        return;
    }
    const link = document.createElement("link");
    link.id = "deployCss";
    link.rel = "stylesheet";
    link.href = new URL("../../css/deploy.css", import.meta.url).href;
    document.head.appendChild(link);
}

function el(tag, attrs = {}, ...children) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
        if (v == null || v === false) {
            continue;
        }
        if (k === "class") { e.className = v; }
        else if (k === "text") { e.textContent = v; }
        else if (k.startsWith("on")) { e.addEventListener(k.slice(2), v); }
        else { e.setAttribute(k, v === true ? "" : v); }
    }
    for (const c of children.flat()) {
        if (c != null && c !== false) {
            e.append(typeof c === "string" ? document.createTextNode(c) : c);
        }
    }
    return e;
}

function addToolbarButton(api) {
    if (document.getElementById("btnDeploy")) {
        return;
    }
    const bar = document.getElementById("toolbar");
    if (!bar) {
        return;
    }
    const btn = el("button", { id: "btnDeploy", class: "tb", title: t("Deployment", "MainMenu") },
        el("img", { src: ICON, alt: "" }));
    const play = document.getElementById("btnPlay");
    if (play && play.parentNode === bar) {
        play.after(btn);
    } else {
        bar.append(btn);
    }
    btn.addEventListener("click", () => openDeployDialog(api));
}

export async function register(api) {
    injectCss();
    addToolbarButton(api);
    api.deploy = { open: () => openDeployDialog(api), md5, encryptAsset, decryptAsset };
}

// ---------------------------------------------------------------------------------------------
// Arquivos do projeto

const isAndroid = () => !!(window.Android && window.Android.platform && window.Android.platform() === "android");
const hasJavaDeploy = () => isAndroid() && typeof window.Android.deployVersion === "function";

async function readBytes(path) {
    const res = await fetch("/api/file?path=" + encodeURIComponent(path), { cache: "no-store" });
    if (!res.ok) {
        throw new Error(t("Failed to read %1: %2", null, path, res.status));
    }
    return new Uint8Array(await res.arrayBuffer());
}

async function readText(path) {
    return new TextDecoder().decode(await readBytes(path));
}

async function listAll(api, log) {
    const info = api.project.info || {};
    if (Array.isArray(info.files) && info.files.length) {
        return info.files.slice();
    }
    const out = [];
    const walk = async dir => {
        const items = await api.project.list(dir);
        for (const it of items) {
            const p = dir ? dir + "/" + it.name : it.name;
            if (it.dir) {
                if (!dir && isExcludedTop(it.name, null)) {
                    continue;
                }
                await walk(p);
            } else {
                out.push(p);
            }
        }
    };
    await walk("");
    log(t("%1 files in the project", null, out.length));
    return out;
}

// Pastas/arquivos do projeto que nunca vão para o pacote.
function isExcludedTop(name, outRoot) {
    const n = name.toLowerCase();
    return n.startsWith(".") || n === "save" || n === "node_modules" || n.endsWith(".rmmzproject")
        || n === "game.rmmzproject" || (outRoot && n === outRoot.toLowerCase());
}

// ---------------------------------------------------------------------------------------------
// Configurações

const PLATFORMS = [
    { id: "win", label: t("Windows", "Dialog_Deployment"), tip: t("Creates a package for Windows.", "Dialog_Deployment"), off: true },
    { id: "mac", label: t("macOS", "Dialog_Deployment"), tip: t("Creates a package for macOS.", "Dialog_Deployment"), off: true },
    { id: "web", label: t("Web browsers", "Dialog_Deployment") + " / Android / iOS (HTML5)", tip: t("Creates a package for web browsers.", "Dialog_Deployment") },
    { id: "apk", label: t("Android (installable APK, built on the device)") }
];

function loadSettings(api, system) {
    const name = api.project.name || "Game";
    const slug = name.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "").replace(/^[0-9]+/, "") || "jogo";
    const defaults = {
        platform: isAndroid() ? "apk" : "web",
        outDir: "deploy",
        outName: name.replace(/[\\/:*?"<>|]+/g, "_"),
        webFormat: "folder",
        excludeUnused: false,
        encImages: false,
        encAudio: false,
        appName: (system && system.gameTitle) || name,
        packageName: "br.mz.game." + slug,
        install: true,
        fitScreen: true
    };
    try {
        const saved = JSON.parse(localStorage.getItem("mzDeploy:" + name) || "{}");
        const out = { ...defaults, ...saved };
        if (out.platform === "win" || out.platform === "mac") { out.platform = defaults.platform; }
        return out;
    } catch (_) {
        return defaults;
    }
}

function saveSettings(api, s) {
    try {
        const { key, ...rest } = s;
        localStorage.setItem("mzDeploy:" + (api.project.name || "Game"), JSON.stringify(rest));
    } catch (_) { /* sem storage */ }
}

// ---------------------------------------------------------------------------------------------
// Diálogo

export async function openDeployDialog(api) {
    if (!api.project) {
        api.status(t("Open a project first."));
        return;
    }
    let system = null;
    try {
        system = await api.project.readJson("data/System.json", { fresh: true });
    } catch (_) { /* segue com padrões */ }
    const s = loadSettings(api, system);
    let running = false;
    let cancelled = false;

    const dlg = api.openDialog({
        title: t("Deployment", "Dialog_Deployment"),
        width: "720px",
        height: "620px",
        buttons: [
            { label: t("OK", "BasicConstants"), primary: true, onClick: () => { start(); return false; } },
            { label: t("Cancel", "BasicConstants"), onClick: () => { if (running) { cancelled = true; log(t("Cancelling...")); return false; } return true; } }
        ]
    });
    dlg.root.classList.add("deployDialog");

    const radios = PLATFORMS.map(p => {
        const r = el("input", { type: "radio", name: "deployPlatform", value: p.id });
        r.checked = s.platform === p.id;
        r.disabled = !!p.off;
        r.addEventListener("change", () => { s.platform = p.id; refresh(); });
        // Windows/macOS precisam do runtime NW.js do editor de PC: aparecem, mas desabilitados
        const tip = p.off ? (p.tip + " " + t("Not available on this platform: it requires the NW.js runtime of the PC editor.")) : p.tip;
        return el("label", { class: "dpRow" + (p.off ? " dpOff" : ""), title: tip || null }, r, p.label);
    });

    const input = (value, attrs = {}) => {
        const i = el("input", { type: "text", value: value ?? "", ...attrs });
        return i;
    };
    const check = (checked, label) => {
        const c = el("input", { type: "checkbox" });
        c.checked = !!checked;
        return { box: c, row: el("label", { class: "dpRow" }, c, label) };
    };

    const outDir = input(s.outDir, { spellcheck: "false" });
    // Local de saída fora do projeto: pasta escolhida (SAF no Android, showDirectoryPicker no PC)
    let external = null; // { kind: "saf", uri, label } | { kind: "handle", handle, label }
    if (s.outTree && isAndroid()) { external = { kind: "saf", uri: s.outTree, label: s.outTreeLabel || s.outTree }; }
    const chooseBtn = el("button", { class: "dpSmall", type: "button", text: t("Choose", "Layout_DirectoryChooser") + "…", title: t("Chooses the location.", "Layout_DirectoryChooser") });
    const clearBtn = el("button", { class: "dpSmall", type: "button", text: "✕", title: t("Folder (in the project)") });
    const canChoose = () => (isAndroid() && typeof window.Android.pickDeployFolder === "function") || typeof window.showDirectoryPicker === "function";
    chooseBtn.addEventListener("click", async () => {
        if (isAndroid() && window.Android.pickDeployFolder) {
            window.mzDeployFolderPicked = (uri, label) => {
                external = { kind: "saf", uri, label: label || uri };
                refresh();
            };
            window.Android.pickDeployFolder();
        } else if (window.showDirectoryPicker) {
            try {
                const handle = await window.showDirectoryPicker({ id: "mzDeploy", mode: "readwrite" });
                external = { kind: "handle", handle, label: handle.name };
                refresh();
            } catch (_) { /* cancelado */ }
        }
    });
    clearBtn.addEventListener("click", () => { external = null; outDir.value = s.outDir; refresh(); });
    const outName = input(s.outName, { spellcheck: "false" });
    const fmtFolder = el("input", { type: "radio", name: "deployFmt", value: "folder" });
    const fmtZip = el("input", { type: "radio", name: "deployFmt", value: "zip" });
    fmtFolder.checked = s.webFormat !== "zip";
    fmtZip.checked = s.webFormat === "zip";
    const excl = check(s.excludeUnused, t("Exclude unused files", "Layout_DeploymentOptions"));
    const encImg = check(s.encImages, t("Image files", "Layout_DeploymentOptions"));
    const encAud = check(s.encAudio, t("Audio files", "Layout_DeploymentOptions"));
    const key = el("input", { type: "password", placeholder: t("Encryption key", "Layout_DeploymentOptions"), autocomplete: "off" });
    key.value = s.password || ""; // o MZ lembra a chave de criptografia do projeto
    const showKey = el("button", { class: "dpSmall", type: "button", text: "👁" });
    showKey.addEventListener("click", () => { key.type = key.type === "password" ? "text" : "password"; });
    const appName = input(s.appName);
    const pkg = input(s.packageName, { spellcheck: "false" });
    const install = check(s.install, t("Offer to install when finished"));
    // extensão do port: resolução ajustada à proporção da tela do aparelho (sem barras pretas)
    const fit = check(s.fitScreen !== false, t("Full screen (fit the resolution to the screen)"));

    const bar = el("div", { class: "dpBar" }, el("div", { class: "dpBarFill" }));
    const barText = el("span", { class: "dpBarText", text: "" });
    const logBox = el("pre", { class: "dpLog" });
    const result = el("div", { class: "dpResult" });

    const webBox = el("fieldset", { class: "dpGroup" }, el("legend", { text: t("Format (web)") }),
        el("label", { class: "dpRow" }, fmtFolder, t("Folder")),
        el("label", { class: "dpRow" }, fmtZip, isAndroid() ? t(".zip file (saved to %1)", null, "Download/MZEditor") : t(".zip file (browser download)")));
    const apkBox = el("fieldset", { class: "dpGroup" }, el("legend", { text: t("Android", "Dialog_Deployment") + " (APK)" }),
        el("div", { class: "dpGrid" },
            el("span", { text: t("App name") }), appName,
            el("span", { text: t("Package name") }), pkg),
        install.row,
        fit.row,
        el("div", { class: "dpHint", id: "dpApkHint" }));

    const encKeyRow = el("div", { class: "dpGrid" }, el("span", { text: t("Encryption key", "Layout_DeploymentOptions") }), el("div", { class: "dpKey" }, key, showKey));

    dlg.body.append(
        el("fieldset", { class: "dpGroup" }, el("legend", { text: t("Platform", "Dialog_Deployment") }), radios),
        el("fieldset", { class: "dpGroup" }, el("legend", { text: t("Output Location", "Dialog_Deployment") }),
            el("div", { class: "dpGrid" },
                el("span", { id: "dpOutLabel", text: t("Folder (in the project)") }), el("div", { class: "dpKey" }, outDir, chooseBtn, clearBtn),
                el("span", { text: t("Name", "Constants") }), outName),
            el("div", { class: "dpHint", id: "dpOutHint" })),
        webBox,
        apkBox,
        el("fieldset", { class: "dpGroup" }, el("legend", { text: t("Options", "Layout_DeploymentOptions") }), excl.row),
        el("fieldset", { class: "dpGroup" }, el("legend", { text: t("Encryption", "Layout_DeploymentOptions") }),
            el("div", { class: "dpInline" }, encImg.row, encAud.row), encKeyRow),
        el("div", { class: "dpProgress" }, bar, barText),
        result,
        logBox
    );

    function refresh() {
        const apk = s.platform === "apk";
        webBox.hidden = apk;
        apkBox.hidden = !apk;
        const enc = encImg.box.checked || encAud.box.checked;
        key.disabled = !enc;
        showKey.disabled = !enc;
        const hint = dlg.body.querySelector("#dpApkHint");
        hint.textContent = hasJavaDeploy()
            ? t("The APK is built and signed on the device (with the app's own key) and saved to %1.", null, "Download/MZEditor")
            : t("APK export only works inside the Android app (MZ Editor). On a PC, use \"%1\".", null, t("Web browsers", "Dialog_Deployment"));
        const out = dlg.body.querySelector("#dpOutHint");
        const name = outName.value.trim() || "Game";
        const folderOut = !apk && !fmtZip.checked;
        chooseBtn.hidden = !folderOut || !canChoose();
        clearBtn.hidden = !folderOut || !external;
        outDir.readOnly = !!(folderOut && external);
        if (folderOut && external) {
            outDir.value = external.label;
        }
        dlg.body.querySelector("#dpOutLabel").textContent = folderOut && external ? t("Output Location", "Dialog_Deployment") : t("Folder (in the project)");
        if (apk) {
            out.textContent = t("Output: %1", null, `Download/MZEditor/${name}.apk`);
        } else if (fmtZip.checked) {
            out.textContent = t("Output: %1", null, isAndroid() ? `Download/MZEditor/${name}.zip` : `${name}.zip`);
        } else if (external) {
            out.textContent = t("Output: %1", null, `${external.label}/${name}/`);
        } else {
            out.textContent = t("Output: %1 (inside the project)", null, `${(outDir.value.trim() || "deploy")}/${name}/`);
        }
    }
    for (const c of [encImg.box, encAud.box, fmtFolder, fmtZip]) {
        c.addEventListener("change", refresh);
    }
    outName.addEventListener("input", refresh);
    outDir.addEventListener("input", refresh);
    refresh();

    function log(msg) {
        logBox.textContent += msg + "\n";
        logBox.scrollTop = logBox.scrollHeight;
    }
    function progress(done, total, label) {
        const pct = total ? Math.min(100, Math.round(done * 100 / total)) : 0;
        bar.firstChild.style.width = pct + "%";
        barText.textContent = label != null ? label : `${done} / ${total} (${pct}%)`;
    }
    function setBusy(b) {
        running = b;
        for (const btn of dlg.root.querySelectorAll(".mzDialogButtons button.primary")) {
            btn.disabled = b;
        }
        for (const i of dlg.body.querySelectorAll("fieldset input, fieldset button")) {
            i.disabled = b;
        }
        if (!b) {
            refresh();
        }
    }

    async function start() {
        if (running) {
            return;
        }
        Object.assign(s, {
            outDir: external ? s.outDir : (outDir.value.trim().replace(/^\/+|\/+$/g, "") || "deploy"),
            outTree: external && external.kind === "saf" ? external.uri : "",
            outTreeLabel: external && external.kind === "saf" ? external.label : "",
            password: key.value,
            outName: outName.value.trim().replace(/[\\/:*?"<>|]+/g, "_") || "Game",
            webFormat: fmtZip.checked ? "zip" : "folder",
            excludeUnused: excl.box.checked,
            encImages: encImg.box.checked,
            encAudio: encAud.box.checked,
            appName: appName.value.trim(),
            packageName: pkg.value.trim(),
            install: install.box.checked,
            fitScreen: fit.box.checked
        });
        logBox.textContent = "";
        result.textContent = "";
        cancelled = false;
        try {
            validate(s, key.value);
            saveSettings(api, s);
            setBusy(true);
            // como o MZ, salva o projeto antes de criar o pacote (mapas não salvos ficariam de fora)
            if (api.isDirty && api.isDirty()) {
                progress(0, 0, t("Saving…"));
                if (!(await api.saveAll())) {
                    throw new Error(t("Failed to save the project."));
                }
                log(t("Project saved"));
            }
            const ext = s.platform === "web" && s.webFormat === "folder" ? external : null;
            await runDeploy(api, s, key.value, { log, progress, isCancelled: () => cancelled, result, dlg, external: ext });
        } catch (e) {
            console.error(e);
            log(t("ERROR: %1", null, e.message || e));
            progress(0, 0, t("Failed"));
            api.status(t("Failed to create a distribution package.", "ProjectManager") + " " + (e.message || e));
        } finally {
            setBusy(false);
        }
    }
}

function validate(s, password) {
    if ((s.encImages || s.encAudio) && !password) {
        throw new Error(t("Please enter the key of encryption.", "Layout_DeploymentOptions"));
    }
    if (s.platform === "apk") {
        if (!hasJavaDeploy()) {
            throw new Error(t("APK export only works inside the Android app (MZ Editor). On a PC, use \"%1\".", null, t("Web browsers", "Dialog_Deployment")));
        }
        if (!s.appName) {
            throw new Error(t("Please enter the app name."));
        }
        if (new TextEncoder().encode(s.appName).length > 100) {
            throw new Error(t("App name is too long (max. 100 bytes)."));
        }
        if (!/^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/.test(s.packageName) || s.packageName.length > 100) {
            throw new Error(t("Invalid package name. Use something like %1 (letters, digits and _, separated by dots, up to 100 characters).", null, "br.myname.mygame"));
        }
        if (s.packageName === "br.mz.editor") {
            throw new Error(t("The package name cannot be the editor's own."));
        }
    }
}

// ---------------------------------------------------------------------------------------------
// Pipeline

// Monta o plano: [{src, dst, enc}] + System.json reescrito.
async function buildPlan(api, s, password, ui) {
    const { log, progress } = ui;
    progress(0, 0, t("Listing files..."));
    const outRoot = s.platform === "web" && s.webFormat === "folder" ? s.outDir.split("/")[0] : null;
    // também nunca empacota a pasta de saída padrão "deploy/" (pacotes anteriores)
    let files = (await listAll(api, log)).filter(f => {
        const top = f.split("/")[0];
        return !isExcludedTop(top, outRoot) && !(f.includes("/") && top.toLowerCase() === (s.outDir.split("/")[0] || "deploy").toLowerCase());
    });
    if (!files.includes("index.html") || !files.includes("data/System.json")) {
        throw new Error(t("Incomplete project: %1 or %2 not found.", null, "index.html", "data/System.json"));
    }
    if (s.excludeUnused) {
        progress(0, 0, t("Looking for unused files..."));
        const { keep, removed } = await findUsedFiles(files, { readText, readBytes, log });
        log(t("Excluded %1 unused file(s).", null, removed.length));
        if (removed.length) {
            log("  " + removed.slice(0, 40).join("\n  ") + (removed.length > 40 ? `\n  ... (+${removed.length - 40})` : ""));
        }
        files = files.filter(f => keep.has(f));
    }
    const enc = s.encImages || s.encAudio;
    const keyHex = enc ? md5(password) : "";
    if (enc) {
        // autoteste: o mesmo algoritmo de Utils.decryptArrayBuffer precisa desfazer o nosso
        const sample = Uint8Array.from({ length: 40 }, (_, i) => (i * 37) & 255);
        const back = decryptAsset(encryptAsset(sample, keyHex), keyHex);
        if (back.length !== sample.length || back.some((b, i) => b !== sample[i])) {
            throw new Error(t("Encryption self-test failed."));
        }
        log(t("Encryption key (MD5 of the password): %1", null, keyHex));
    }
    const system = JSON.parse(await readText("data/System.json"));
    system.hasEncryptedImages = !!s.encImages;
    system.hasEncryptedAudio = !!s.encAudio;
    if (enc) {
        system.encryptionKey = keyHex;
    } else {
        delete system.encryptionKey;
    }
    const plan = [];
    let nEnc = 0;
    for (const f of files) {
        if (f === "data/System.json") {
            continue;
        }
        const kind = encryptKind(f);
        const e = (kind === "image" && s.encImages) || (kind === "audio" && s.encAudio);
        if (e) {
            nEnc++;
        }
        plan.push({ src: f, dst: e ? f + "_" : f, enc: !!e });
    }
    const inline = [{ dst: "data/System.json", text: JSON.stringify(system) }];
    if (s.platform === "apk" && s.fitScreen) {
        const r = await fetch("fitscreen.js", { cache: "no-store" });
        if (r.ok) { inline.push({ dst: "mz_fitscreen.js", text: await r.text() }); }
    }
    log(t("%1 file(s) in the package, %2 encrypted.", null, plan.length + 1, nEnc));
    return { plan, inline, keyHex };
}

async function runDeploy(api, s, password, ui) {
    const t0 = performance.now();
    const { plan, inline, keyHex } = await buildPlan(api, s, password, ui);
    if (s.platform === "apk") {
        await runJavaJob(api, "apk", s, plan, inline, keyHex, ui);
    } else if (s.webFormat === "zip") {
        if (hasJavaDeploy()) {
            await runJavaJob(api, "zip", s, plan, inline, keyHex, ui);
        } else {
            await runZipJs(s, plan, inline, keyHex, ui);
        }
    } else if (ui.external && ui.external.kind === "saf") {
        await runJavaJob(api, "folder", s, plan, inline, keyHex, ui);
    } else if (ui.external && ui.external.kind === "handle") {
        await runFolderHandle(ui.external.handle, s, plan, inline, keyHex, ui);
    } else {
        await runFolder(api, s, plan, inline, keyHex, ui);
    }
    ui.log(t("Finished in %1 s.", null, ((performance.now() - t0) / 1000).toFixed(1)));
    api.status(t("Deployment finished."));
}

async function transformed(item, keyHex) {
    const data = await readBytes(item.src);
    return item.enc ? encryptAsset(data, keyHex) : data;
}

async function pool(items, n, fn, ui) {
    let i = 0;
    let done = 0;
    const total = items.length;
    const worker = async () => {
        while (i < items.length) {
            if (ui.isCancelled()) {
                throw new Error(t("Cancelled by the user."));
            }
            const it = items[i++];
            await fn(it);
            done++;
            ui.progress(done, total);
        }
    };
    await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
}

async function runFolder(api, s, plan, inline, keyHex, ui) {
    const base = `${s.outDir}/${s.outName}`;
    ui.log(t("Writing to %1 ...", null, base + "/"));
    await pool(plan, 4, async it => {
        await api.project.writeBinary(`${base}/${it.dst}`, await transformed(it, keyHex));
    }, ui);
    for (const f of inline) {
        await api.project.writeBinary(`${base}/${f.dst}`, new TextEncoder().encode(f.text), "application/json");
    }
    ui.progress(1, 1, t("Finished"));
    const url = "/project/" + base.split("/").map(encodeURIComponent).join("/") + "/index.html";
    const play = el("button", { class: "primary", text: "▶ " + t("Open in playtest") });
    play.addEventListener("click", () => {
        const frame = document.getElementById("playFrame");
        const overlay = document.getElementById("playOverlay");
        if (!frame || !overlay) {
            window.open(url, "_blank");
            return;
        }
        ui.dlg.close();
        overlay.hidden = false;
        frame.src = url;
    });
    ui.result.replaceChildren(el("span", { text: t("Web package in %1", null, base + "/") + "  " }), play);
}

// PC: pasta fora do projeto escolhida com showDirectoryPicker (File System Access API).
async function runFolderHandle(root, s, plan, inline, keyHex, ui) {
    if (root.requestPermission && (await root.requestPermission({ mode: "readwrite" })) !== "granted") {
        throw new Error(t("Location is invalid.", "Dialog_Deployment"));
    }
    const base = await root.getDirectoryHandle(s.outName, { create: true });
    const dirs = new Map([["", base]]);
    const dirOf = async rel => {
        const parts = rel.split("/").slice(0, -1);
        let cur = "";
        let h = base;
        for (const p of parts) {
            cur = cur ? cur + "/" + p : p;
            if (!dirs.has(cur)) { dirs.set(cur, await h.getDirectoryHandle(p, { create: true })); }
            h = dirs.get(cur);
        }
        return h;
    };
    const write = async (rel, data) => {
        const dir = await dirOf(rel);
        const fh = await dir.getFileHandle(rel.split("/").pop(), { create: true });
        const w = await fh.createWritable();
        await w.write(data);
        await w.close();
    };
    ui.log(t("Writing to %1 ...", null, `${root.name}/${s.outName}/`));
    let done = 0;
    for (const it of plan) {
        if (ui.isCancelled()) {
            throw new Error(t("Cancelled by the user."));
        }
        await write(it.dst, await transformed(it, keyHex));
        ui.progress(++done, plan.length);
    }
    for (const f of inline) {
        await write(f.dst, new TextEncoder().encode(f.text));
    }
    ui.progress(1, 1, t("Finished"));
    ui.result.replaceChildren(el("span", { text: t("Web package in %1", null, `${root.name}/${s.outName}/`) }));
}

async function runZipJs(s, plan, inline, keyHex, ui) {
    const zip = new ZipWriter();
    let done = 0;
    for (const it of plan) {
        if (ui.isCancelled()) {
            throw new Error(t("Cancelled by the user."));
        }
        await zip.add(it.dst, await transformed(it, keyHex));
        ui.progress(++done, plan.length);
    }
    for (const f of inline) {
        await zip.add(f.dst, new TextEncoder().encode(f.text));
    }
    const blob = zip.finish();
    const a = el("a", { href: URL.createObjectURL(blob), download: s.outName + ".zip", text: t("Download %1 (%2 MB)", null, s.outName + ".zip", (blob.size / 1048576).toFixed(1)) });
    ui.result.replaceChildren(a);
    a.click();
    ui.progress(1, 1, t("Finished"));
    ui.log(`${s.outName}.zip: ${(blob.size / 1048576).toFixed(1)} MB`);
}

// Android: o Java lê os arquivos via SAF, criptografa, empacota (zip ou APK) e assina.
async function runJavaJob(api, kind, s, plan, inline, keyHex, ui) {
    const body = {
        kind,
        outputName: s.outName,
        appName: s.appName || s.outName,
        packageName: s.packageName,
        keyHex,
        icon: "icon/icon.png",
        outTree: kind === "folder" ? s.outTree : undefined,
        fitScreen: kind === "apk" ? !!s.fitScreen : undefined,
        files: plan,
        inline
    };
    const res = await fetch("/api/deploy/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) {
        throw new Error(t("The app rejected the export: %1", null, res.status + " " + await res.text()));
    }
    const { id } = await res.json();
    let logLen = 0;
    for (;;) {
        await new Promise(r => setTimeout(r, 400));
        if (ui.isCancelled()) {
            await fetch("/api/deploy/cancel?id=" + id, { method: "POST" });
        }
        const st = await (await fetch("/api/deploy/status?id=" + id, { cache: "no-store" })).json();
        for (const line of (st.log || []).slice(logLen)) {
            ui.log(line);
        }
        logLen = (st.log || []).length;
        ui.progress(st.done, st.total, st.state === "running" ? `${st.message || ""} ${st.done}/${st.total}` : null);
        if (st.state === "error") {
            throw new Error(st.message || t("Export failed."));
        }
        if (st.state === "done") {
            const r = st.result || {};
            ui.progress(1, 1, t("Finished"));
            const parts = [el("span", { text: kind === "folder"
                ? t("Web package in %1", null, r.location + "/")
                : t("%1 (%2 MB) saved to %3", null, r.name, (r.size / 1048576).toFixed(1), r.location) + "  " })];
            if (kind === "apk") {
                const inst = el("button", { class: "primary", text: t("Install") });
                inst.addEventListener("click", () => window.Android.installApk(r.file));
                parts.push(inst);
                if (s.install) {
                    window.Android.installApk(r.file);
                }
            }
            ui.result.replaceChildren(...parts);
            return;
        }
    }
}
