// Módulo deploy: Arquivo > Implantação (Deployment) do RPG Maker MZ.
// Plataformas: Navegadores web (pasta ou .zip) e Android (APK instalável gerado no aparelho).
// Ver NOTES.md.

import { md5, encryptAsset, decryptAsset, encryptKind } from "./crypto.js";
import { findUsedFiles } from "./scan.js";
import { ZipWriter } from "./zip.js";

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
    const btn = el("button", { id: "btnDeploy", class: "tb", title: "Implantação (Deployment)" },
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
        throw new Error(`Falha ao ler ${path}: ${res.status}`);
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
    log(`${out.length} arquivos no projeto`);
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
    { id: "web", label: "Navegadores web / Android / iOS (HTML5)" },
    { id: "apk", label: "Android (APK instalável, gerado no aparelho)" }
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
        install: true
    };
    try {
        const saved = JSON.parse(localStorage.getItem("mzDeploy:" + name) || "{}");
        return { ...defaults, ...saved };
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
        api.status("Abra um projeto primeiro");
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
        title: "Implantação",
        width: "720px",
        height: "620px",
        buttons: [
            { label: "OK", primary: true, onClick: () => { start(); return false; } },
            { label: "Cancelar", onClick: () => { if (running) { cancelled = true; log("cancelando..."); return false; } return true; } }
        ]
    });
    dlg.root.classList.add("deployDialog");

    const radios = PLATFORMS.map(p => {
        const r = el("input", { type: "radio", name: "deployPlatform", value: p.id });
        r.checked = s.platform === p.id;
        r.addEventListener("change", () => { s.platform = p.id; refresh(); });
        return el("label", { class: "dpRow" }, r, p.label);
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
    const outName = input(s.outName, { spellcheck: "false" });
    const fmtFolder = el("input", { type: "radio", name: "deployFmt", value: "folder" });
    const fmtZip = el("input", { type: "radio", name: "deployFmt", value: "zip" });
    fmtFolder.checked = s.webFormat !== "zip";
    fmtZip.checked = s.webFormat === "zip";
    const excl = check(s.excludeUnused, "Excluir arquivos não utilizados");
    const encImg = check(s.encImages, "Arquivos de imagem");
    const encAud = check(s.encAudio, "Arquivos de áudio");
    const key = el("input", { type: "password", placeholder: "Chave de criptografia", autocomplete: "off" });
    const showKey = el("button", { class: "dpSmall", type: "button", text: "👁" });
    showKey.addEventListener("click", () => { key.type = key.type === "password" ? "text" : "password"; });
    const appName = input(s.appName);
    const pkg = input(s.packageName, { spellcheck: "false" });
    const install = check(s.install, "Oferecer instalação ao terminar");

    const bar = el("div", { class: "dpBar" }, el("div", { class: "dpBarFill" }));
    const barText = el("span", { class: "dpBarText", text: "" });
    const logBox = el("pre", { class: "dpLog" });
    const result = el("div", { class: "dpResult" });

    const webBox = el("fieldset", { class: "dpGroup" }, el("legend", { text: "Formato (web)" }),
        el("label", { class: "dpRow" }, fmtFolder, "Pasta dentro do projeto (pode ser aberta no teste de jogo)"),
        el("label", { class: "dpRow" }, fmtZip, isAndroid() ? "Arquivo .zip (salvo em Download/MZEditor)" : "Arquivo .zip (download do navegador)"));
    const apkBox = el("fieldset", { class: "dpGroup" }, el("legend", { text: "Android (APK)" }),
        el("div", { class: "dpGrid" },
            el("span", { text: "Nome do app" }), appName,
            el("span", { text: "Nome do pacote" }), pkg),
        install.row,
        el("div", { class: "dpHint", id: "dpApkHint" }));

    const encKeyRow = el("div", { class: "dpGrid" }, el("span", { text: "Chave" }), el("div", { class: "dpKey" }, key, showKey));

    dlg.body.append(
        el("fieldset", { class: "dpGroup" }, el("legend", { text: "Plataforma" }), radios),
        el("fieldset", { class: "dpGroup" }, el("legend", { text: "Local de saída" }),
            el("div", { class: "dpGrid" },
                el("span", { text: "Pasta (no projeto)" }), outDir,
                el("span", { text: "Nome" }), outName),
            el("div", { class: "dpHint", id: "dpOutHint" })),
        webBox,
        apkBox,
        el("fieldset", { class: "dpGroup" }, el("legend", { text: "Opções" }), excl.row),
        el("fieldset", { class: "dpGroup" }, el("legend", { text: "Criptografia" }),
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
            ? "O APK é montado e assinado no aparelho (chave própria guardada no app) e salvo em Download/MZEditor."
            : "A exportação de APK só funciona dentro do app Android (MZ Editor). No PC use \"Navegadores web\".";
        const out = dlg.body.querySelector("#dpOutHint");
        const name = outName.value.trim() || "Game";
        if (apk) {
            out.textContent = `Saída: Download/MZEditor/${name}.apk`;
        } else if (fmtZip.checked) {
            out.textContent = `Saída: ${name}.zip (com a pasta www/)`;
        } else {
            out.textContent = `Saída: ${(outDir.value.trim() || "deploy")}/${name}/ (dentro do projeto)`;
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
            outDir: outDir.value.trim().replace(/^\/+|\/+$/g, "") || "deploy",
            outName: outName.value.trim().replace(/[\\/:*?"<>|]+/g, "_") || "Game",
            webFormat: fmtZip.checked ? "zip" : "folder",
            excludeUnused: excl.box.checked,
            encImages: encImg.box.checked,
            encAudio: encAud.box.checked,
            appName: appName.value.trim(),
            packageName: pkg.value.trim(),
            install: install.box.checked
        });
        logBox.textContent = "";
        result.textContent = "";
        cancelled = false;
        try {
            validate(s, key.value);
            saveSettings(api, s);
            setBusy(true);
            await runDeploy(api, s, key.value, { log, progress, isCancelled: () => cancelled, result, dlg });
        } catch (e) {
            console.error(e);
            log("ERRO: " + (e.message || e));
            progress(0, 0, "Falhou");
            api.status("Implantação falhou: " + (e.message || e));
        } finally {
            setBusy(false);
        }
    }
}

function validate(s, password) {
    if ((s.encImages || s.encAudio) && !password) {
        throw new Error("Informe a chave de criptografia (ou desmarque a criptografia).");
    }
    if (s.platform === "apk") {
        if (!hasJavaDeploy()) {
            throw new Error("Exportar APK só é possível no app Android (MZ Editor). No PC, use a plataforma \"Navegadores web\".");
        }
        if (!s.appName) {
            throw new Error("Informe o nome do app.");
        }
        if (new TextEncoder().encode(s.appName).length > 100) {
            throw new Error("Nome do app longo demais (máx. 100 bytes).");
        }
        if (!/^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/.test(s.packageName) || s.packageName.length > 100) {
            throw new Error("Nome do pacote inválido. Use algo como br.meunome.meujogo (letras, números e _, separados por pontos, até 100 caracteres).");
        }
        if (s.packageName === "br.mz.editor") {
            throw new Error("O nome do pacote não pode ser o do próprio editor.");
        }
    }
}

// ---------------------------------------------------------------------------------------------
// Pipeline

// Monta o plano: [{src, dst, enc}] + System.json reescrito.
async function buildPlan(api, s, password, ui) {
    const { log, progress } = ui;
    progress(0, 0, "Listando arquivos...");
    const outRoot = s.platform === "web" && s.webFormat === "folder" ? s.outDir.split("/")[0] : null;
    // também nunca empacota a pasta de saída padrão "deploy/" (pacotes anteriores)
    let files = (await listAll(api, log)).filter(f => {
        const top = f.split("/")[0];
        return !isExcludedTop(top, outRoot) && !(f.includes("/") && top.toLowerCase() === (s.outDir.split("/")[0] || "deploy").toLowerCase());
    });
    if (!files.includes("index.html") || !files.includes("data/System.json")) {
        throw new Error("Projeto incompleto: index.html ou data/System.json não encontrados.");
    }
    if (s.excludeUnused) {
        progress(0, 0, "Procurando arquivos não utilizados...");
        const { keep, removed } = await findUsedFiles(files, { readText, readBytes, log });
        log(`Excluídos ${removed.length} arquivo(s) não utilizado(s).`);
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
            throw new Error("autoteste de criptografia falhou");
        }
        log(`Chave de criptografia (MD5 da senha): ${keyHex}`);
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
    log(`${plan.length + 1} arquivo(s) no pacote, ${nEnc} criptografado(s).`);
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
    } else {
        await runFolder(api, s, plan, inline, keyHex, ui);
    }
    ui.log(`Concluído em ${((performance.now() - t0) / 1000).toFixed(1)} s.`);
    api.status("Implantação concluída");
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
                throw new Error("Cancelado pelo usuário.");
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
    ui.log(`Gravando em ${base}/ ...`);
    await pool(plan, 4, async it => {
        await api.project.writeBinary(`${base}/${it.dst}`, await transformed(it, keyHex));
    }, ui);
    for (const f of inline) {
        await api.project.writeBinary(`${base}/${f.dst}`, new TextEncoder().encode(f.text), "application/json");
    }
    ui.progress(1, 1, "Concluído");
    const url = "/project/" + base.split("/").map(encodeURIComponent).join("/") + "/index.html";
    const play = el("button", { class: "primary", text: "▶ Abrir no teste de jogo" });
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
    ui.result.replaceChildren(el("span", { text: `Pacote web em ${base}/  ` }), play);
}

async function runZipJs(s, plan, inline, keyHex, ui) {
    const zip = new ZipWriter();
    let done = 0;
    for (const it of plan) {
        if (ui.isCancelled()) {
            throw new Error("Cancelado pelo usuário.");
        }
        await zip.add("www/" + it.dst, await transformed(it, keyHex));
        ui.progress(++done, plan.length);
    }
    for (const f of inline) {
        await zip.add("www/" + f.dst, new TextEncoder().encode(f.text));
    }
    const blob = zip.finish();
    const a = el("a", { href: URL.createObjectURL(blob), download: s.outName + ".zip", text: `Baixar ${s.outName}.zip (${(blob.size / 1048576).toFixed(1)} MB)` });
    ui.result.replaceChildren(a);
    a.click();
    ui.progress(1, 1, "Concluído");
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
        files: plan,
        inline
    };
    const res = await fetch("/api/deploy/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) {
        throw new Error("O app não aceitou a exportação: " + res.status + " " + await res.text());
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
            throw new Error(st.message || "falha na exportação");
        }
        if (st.state === "done") {
            const r = st.result || {};
            ui.progress(1, 1, "Concluído");
            const parts = [el("span", { text: `${r.name} (${(r.size / 1048576).toFixed(1)} MB) salvo em ${r.location}  ` })];
            if (kind === "apk") {
                const inst = el("button", { class: "primary", text: "Instalar" });
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
