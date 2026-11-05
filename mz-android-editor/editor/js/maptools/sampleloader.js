// "Carregar" (Dialog_MapLoader): mapas de exemplo do MZ, copiados de RPG/samplemaps para
// editor/samplemaps com um manifest.json (nome original, nome pt_BR oficial, tamanho, tileset).

import { t, has, currentLanguage } from "../i18n.js";

const BASE = new URL("../../samplemaps/", import.meta.url).href;
let manifest = null;

async function loadManifest() {
    if (!manifest) {
        const res = await fetch(BASE + "manifest.json");
        if (!res.ok) { throw new Error(t("%1 not found.", null, "samplemaps/manifest.json")); }
        manifest = await res.json();
    }
    return manifest;
}

// Nome do mapa de exemplo no idioma do editor (Dialog_MapLoader); namePt fica como reserva.
// (o manifest tem dois nomes grafados diferente da fonte do .qm)
const SAMPLE_ALIAS = { "Abandoned Grassland temple": "Abandoned Grassland Temple", "Hall of Teleportation": "Hall of Transference" };
const sampleName = e => {
    const src = SAMPLE_ALIAS[e.name] || e.name;
    const lang = currentLanguage();
    if (src && (lang === "en" || has(src, "Dialog_MapLoader"))) { return t(src, "Dialog_MapLoader"); }
    return lang === "pt_BR" ? e.namePt : e.name;
};

// Resolve com {map, info: {name}} ou null.
export async function openSampleLoader(api) {
    let list;
    try {
        list = await loadManifest();
    } catch (err) {
        api.status(String(err.message || err));
        return null;
    }
    return new Promise(resolve => {
        let sel = -1;
        const dlg = api.openDialog({
            title: t("Sample Maps", "Dialog_MapLoader"),
            width: "min(900px, 98vw)",
            height: "min(560px, 96vh)",
            buttons: [
                {
                    label: t("OK", "BasicConstants"), primary: true, onClick: () => {
                        if (sel < 0) { return false; }
                        const e = list[sel];
                        fetch(BASE + e.file).then(r => r.json()).then(map => {
                            resolve({ map, info: { name: sampleName(e) } });
                        }).catch(err => {
                            api.status(t("Failed to load: %1", null, err.message));
                            resolve(null);
                        });
                        return true;
                    }
                },
                { label: t("Cancel", "BasicConstants"), onClick: () => resolve(null) }
            ]
        });
        const wrap = document.createElement("div");
        wrap.className = "mtSampleDialog";
        const ul = document.createElement("div");
        ul.className = "mtSampleList";
        const side = document.createElement("div");
        side.className = "mtSamplePreview";
        const img = document.createElement("img");
        img.alt = "";
        const info = document.createElement("div");
        info.className = "mtSampleInfo";
        side.append(img, info);
        list.forEach((e, i) => {
            const b = document.createElement("button");
            b.textContent = sampleName(e);
            b.title = e.name;
            b.addEventListener("click", () => {
                sel = i;
                for (const x of ul.children) { x.classList.toggle("sel", x === b); }
                img.src = BASE + e.image;
                info.textContent = `${sampleName(e)} · ${e.width}×${e.height}`;
            });
            b.addEventListener("dblclick", () => {
                const ok = dlg.root.querySelector(".mzDialogButtons button.primary");
                if (ok) { ok.click(); }
            });
            ul.appendChild(b);
        });
        wrap.append(ul, side);
        dlg.body.appendChild(wrap);
        if (ul.firstChild) { ul.firstChild.click(); }
    });
}
