// Janela de exportação (Dialog_CharacterExporter do MZ): mostra a folha de destino,
// a célula escolhida recebe a imagem gerada; "Importar…" carrega uma imagem base do projeto
// e "Exportar…" grava o PNG em img/faces, img/characters ou img/sv_actors. Como no MZ, as duas
// também aceitam outro local ("Outro local…": arquivo do aparelho/PC; salvar fora do projeto).

import { EXPORTS } from "./data.js";
import { decodePng, encodePng, createImage } from "./png.js";
import { blit, imageToCanvas } from "./composer.js";
import { el, promptText, pickFile, message, confirmBox, hasProject, saveOutside } from "./ui.js";
import { t } from "../i18n.js";

export function openExporter(api, type, image) {
    if (!image) { return; }
    const cfg = EXPORTS[type];
    const state = {
        base: null,
        baseName: "",
        single: type === "sv",
        cx: 0, cy: 0
    };

    const dims = () => {
        if (state.base) { return [state.base.width, state.base.height]; }
        if (state.single) { return [cfg.imageWidth, cfg.imageHeight]; }
        return [cfg.overallWidth, cfg.overallHeight];
    };
    const grid = () => {
        const [w, h] = dims();
        return [Math.max(1, Math.floor(w / cfg.imageWidth)), Math.max(1, Math.floor(h / cfg.imageHeight))];
    };

    const d = api.openDialog({
        title: cfg.title,
        width: "min(640px, 98vw)",
        height: "min(580px, 98vh)",
        buttons: [{ label: t("Close", "BasicConstants") }]
    });
    d.root.querySelector(".mzDialog").classList.add("genExpDialog");

    const top = el("div", "gen-expTop");
    const btnImport = el("button", "", t("Import", "Dialog_CharacterExporter") + "…");
    btnImport.title = t("Loads a base image from a file.", "Dialog_CharacterExporter");
    const btnExport = el("button", "", t("Export", "Dialog_CharacterExporter") + "…");
    btnExport.title = t("Saves the image to a file.", "Dialog_CharacterExporter");
    top.append(btnImport, btnExport);
    let fmtBtns = [];
    if (type === "tv") {
        // Folha comum (8 personagens) ou personagem único com prefixo $ (rmmz: ImageManager.isBigCharacter).
        const seg = el("div", "gen-seg");
        fmtBtns = [["sheet", t("Sheet (8)")], ["single", t("Single ($)")]].map(([k, label]) => {
            const b = el("button", "", label);
            b.dataset.k = k;
            b.addEventListener("click", () => {
                state.single = k === "single";
                state.base = null; state.baseName = "";
                state.cx = 0; state.cy = 0;
                redraw();
            });
            seg.appendChild(b);
            return b;
        });
        top.appendChild(seg);
    }
    const nameLabel = el("span", "gen-expName", "");
    top.appendChild(nameLabel);

    const area = el("div", "gen-expArea");
    const cv = document.createElement("canvas");
    cv.className = "gen-checker";
    area.appendChild(cv);
    d.body.append(top, area);

    const tmp = document.createElement("canvas");

    function sheetImage() {
        const [w, h] = dims();
        const out = createImage(w, h);
        if (state.base) { blit(out, state.base, 0, 0); }
        // a célula escolhida é substituída pela imagem nova
        const x = state.cx * cfg.imageWidth, y = state.cy * cfg.imageHeight;
        blit(out, createImage(cfg.imageWidth, cfg.imageHeight), x, y);
        blit(out, image, x, y);
        return out;
    }

    function redraw() {
        const [w, h] = dims();
        const [cols, rows] = grid();
        state.cx = Math.min(state.cx, cols - 1);
        state.cy = Math.min(state.cy, rows - 1);
        cv.width = w; cv.height = h;
        cv.style.width = w + "px"; cv.style.height = h + "px";
        const ctx = cv.getContext("2d");
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(imageToCanvas(sheetImage(), tmp), 0, 0);
        // cursor (ThickFrame)
        const x = state.cx * cfg.imageWidth, y = state.cy * cfg.imageHeight;
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#000";
        ctx.strokeRect(x + 1, y + 1, cfg.imageWidth - 2, cfg.imageHeight - 2);
        ctx.strokeStyle = "#fff";
        ctx.strokeRect(x + 3, y + 3, cfg.imageWidth - 6, cfg.imageHeight - 6);
        nameLabel.textContent = state.baseName ? cfg.folder + "/" + state.baseName : "";
        for (const b of fmtBtns) { b.classList.toggle("on", (b.dataset.k === "single") === state.single); }
    }

    cv.addEventListener("click", ev => {
        const r = cv.getBoundingClientRect();
        const x = (ev.clientX - r.left) * cv.width / r.width;
        const y = (ev.clientY - r.top) * cv.height / r.height;
        const [cols, rows] = grid();
        state.cx = Math.max(0, Math.min(cols - 1, Math.floor(x / cfg.imageWidth)));
        state.cy = Math.max(0, Math.min(rows - 1, Math.floor(y / cfg.imageHeight)));
        redraw();
    });

    btnImport.addEventListener("click", async () => {
        if (!(await hasProject(api))) { return; }
        const path = await pickFile(api, {
            title: t("Import", "Dialog_CharacterExporter"),
            dirs: [cfg.folder],
            filter: n => n.toLowerCase().endsWith(".png"),
            hint: t("Loads a base image from a file.", "Dialog_CharacterExporter"),
            thumbs: true,
            accept: ".png,image/png"
        });
        if (!path) { return; }
        const local = typeof path !== "string";   // File de outro local
        try {
            let buf;
            if (local) {
                buf = await path.arrayBuffer();
            } else {
                const res = await fetch("/api/file?path=" + encodeURIComponent(path), { cache: "no-store" });
                if (!res.ok) { throw new Error(String(res.status)); }
                buf = await res.arrayBuffer();
            }
            const img = await decodePng(buf);
            if (img.width < cfg.imageWidth || img.height < cfg.imageHeight) {
                throw new Error(t("The image (%1×%2) is smaller than one cell (%3×%4).", null, img.width, img.height, cfg.imageWidth, cfg.imageHeight));
            }
            state.base = img;
            state.baseName = local ? path.name : path.split("/").pop();
            state.single = type === "sv" || (img.width === cfg.imageWidth && img.height === cfg.imageHeight);
            state.cx = 0; state.cy = 0;
            redraw();
        } catch (e) {
            await message(api, t("Import", "Dialog_CharacterExporter"), t("Unable to read file %1.", "ProjectManager", local ? path.name : path) + "\n" + e.message);
        }
    });

    btnExport.addEventListener("click", async () => {
        if (!(await hasProject(api))) { return; }
        let def = state.baseName ? state.baseName.replace(/\.png$/i, "") : defaultName(type, state.single);
        let name = await promptText(api, {
            title: t("Export", "Dialog_CharacterExporter"),
            label: t("File name (%1):", null, cfg.folder + "/"),
            value: def,
            hint: type === "tv" && state.single ? t("Single character: the name must start with $.") : t("Saves the image to a file.", "Dialog_CharacterExporter"),
            outside: t("Other Location…")
        });
        if (!name) { return; }
        const outside = typeof name === "object";
        if (outside) { name = name.value; }
        name = name.replace(/\.png$/i, "").replace(/[\\/:*?"<>|]/g, "_");
        if (type === "tv" && state.single && !name.startsWith("$") && !name.startsWith("!$")) { name = "$" + name; }
        const path = cfg.folder + "/" + name + ".png";
        if (outside) {
            try {
                const how = await saveOutside(await encodePng(sheetImage()), name + ".png", "image/png", path);
                if (how) {
                    api.status(t("Image exported: %1", null, how === "share" ? path : name + ".png"));
                    if (how === "share") { api.emit("resource:changed", { path }); api.emit("resources:changed", { folder: cfg.folder }); }
                }
            } catch (e) {
                await message(api, t("Export", "Dialog_CharacterExporter"), t("Unable to write to file %1.", "ProjectManager", name + ".png") + "\n" + e.message);
            }
            return;
        }
        let exists = false;
        try {
            const res = await fetch("/api/list?dir=" + encodeURIComponent(cfg.folder), { cache: "no-store" });
            if (res.ok) { exists = (await res.json()).some(e => e.name === name + ".png"); }
        } catch (e) { /* pasta inexistente */ }
        if (exists && !(await confirmBox(api, t("Export", "Dialog_CharacterExporter"), t("The file %1 already exists. Overwrite?", null, path)))) {
            return;
        }
        try {
            const blob = await encodePng(sheetImage());
            const res = await fetch("/api/file?path=" + encodeURIComponent(path), {
                method: "PUT", headers: { "Content-Type": "image/png" }, body: blob
            });
            if (!res.ok) { throw new Error(String(res.status)); }
            state.baseName = name + ".png";
            state.base = sheetImage();
            redraw();
            api.status(t("Image exported: %1", null, path));
            api.emit("resource:changed", { path });
        } catch (e) {
            await message(api, t("Export", "Dialog_CharacterExporter"), t("Unable to write to file %1.", "ProjectManager", path) + "\n" + e.message);
        }
    });

    redraw();
}

function defaultName(type, single) {
    switch (type) {
        case "face": return "Actor";
        case "tv": return single ? "$Actor" : "Actor";
        case "tvd": return "Damage";
        default: return "Actor_1";
    }
}
