// "Carregar" (Dialog_MapLoader): mapas de exemplo do MZ, copiados de RPG/samplemaps para
// editor/samplemaps com um manifest.json (nome original, nome pt_BR oficial, tamanho, tileset).

const BASE = new URL("../../samplemaps/", import.meta.url).href;
let manifest = null;

async function loadManifest() {
    if (!manifest) {
        const res = await fetch(BASE + "manifest.json");
        if (!res.ok) { throw new Error("samplemaps/manifest.json não encontrado"); }
        manifest = await res.json();
    }
    return manifest;
}

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
            title: "Modelos de Mapas",
            width: "min(900px, 98vw)",
            height: "min(560px, 96vh)",
            buttons: [
                {
                    label: "Ok", primary: true, onClick: () => {
                        if (sel < 0) { return false; }
                        const e = list[sel];
                        fetch(BASE + e.file).then(r => r.json()).then(map => {
                            resolve({ map, info: { name: e.namePt } });
                        }).catch(err => {
                            api.status("Falha ao carregar: " + err.message);
                            resolve(null);
                        });
                        return true;
                    }
                },
                { label: "Cancelar", onClick: () => resolve(null) }
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
            b.textContent = e.namePt;
            b.title = e.name;
            b.addEventListener("click", () => {
                sel = i;
                for (const x of ul.children) { x.classList.toggle("sel", x === b); }
                img.src = BASE + e.image;
                info.textContent = `${e.namePt} · ${e.width}×${e.height}`;
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
