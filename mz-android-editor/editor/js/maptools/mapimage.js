// "Deslocar" (Dialog_MapShift) e "Salvar como Imagem" (Dialog_MapSaveAsImage) do MZ.

import { drawTile, loadTilesetBitmaps, whenBitmapsReady } from "./render.js";

const pad3 = n => String(n).padStart(3, "0");

function field(label, input, title) {
    const l = document.createElement("label");
    l.className = "mtField";
    l.title = title || "";
    const s = document.createElement("span");
    s.textContent = label;
    l.append(s, input);
    return l;
}

function numInput(v, min, max) {
    const i = document.createElement("input");
    i.type = "number";
    i.min = min;
    i.max = max;
    i.value = v;
    i.inputMode = "numeric";
    return i;
}

// Desloca todo o conteúdo do mapa (todas as camadas e os eventos) dx,dy tiles, dando a volta
// nas bordas, como o comando Deslocar do MZ.
export function shiftMap(map, dx, dy) {
    const w = map.width, h = map.height;
    const src = map.data;
    const out = new Array(src.length).fill(0);
    const mod = (a, n) => ((a % n) + n) % n;
    for (let z = 0; z < 6; z++) {
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                out[(z * h + mod(y + dy, h)) * w + mod(x + dx, w)] = src[(z * h + y) * w + x] || 0;
            }
        }
    }
    for (let i = 0; i < src.length; i++) {
        src[i] = out[i];
    }
    for (const ev of map.events || []) {
        if (ev) {
            ev.x = mod(ev.x + dx, w);
            ev.y = mod(ev.y + dy, h);
        }
    }
}

export function openShiftDialog(api, edit, after) {
    return new Promise(resolve => {
        const x = numInput(0, -256, 256);
        const y = numInput(0, -256, 256);
        const dlg = api.openDialog({
            title: "Deslocar",
            width: "360px",
            height: "250px",
            buttons: [
                {
                    label: "Ok", primary: true, onClick: () => {
                        const dx = Math.round(Number(x.value) || 0);
                        const dy = Math.round(Number(y.value) || 0);
                        if (dx || dy) {
                            const before = edit.snapshot();
                            shiftMap(edit.map, dx, dy);
                            edit.recordFull("Deslocar", before);
                            after(edit);
                        }
                        resolve(true);
                    }
                },
                { label: "Cancelar", onClick: () => resolve(false) }
            ]
        });
        const g = document.createElement("fieldset");
        g.className = "mtGroup";
        const lg = document.createElement("legend");
        lg.textContent = "Deslocamento";
        const row = document.createElement("div");
        row.className = "mtRow";
        row.append(
            field("X", x, "Número de tiles a serem deslocados horizontalmente no Eixo X."),
            field("Y", y, "Número de tiles a serem deslocados verticalmente no Eixo Y."));
        g.title = "Distância para o deslocamento.";
        g.append(lg, row);
        dlg.body.appendChild(g);
        x.focus();
    });
}

// Desenha o mapa inteiro num canvas (camadas 0–1, sombras, camadas 2–3), com a mesma
// matemática de tiles do Tilemap. maxPixels limita o tamanho (o canvas do Android é finito).
export async function renderMapCanvas(map, tileset, maxPixels = 4096 * 4096) {
    const bitmaps = loadTilesetBitmaps(tileset);
    await whenBitmapsReady(bitmaps);
    const full = 48;
    const area = map.width * map.height * full * full;
    const size = area > maxPixels ? Math.max(4, Math.floor(full * Math.sqrt(maxPixels / area))) : full;
    const c = document.createElement("canvas");
    c.width = map.width * size;
    c.height = map.height * size;
    const g = c.getContext("2d");
    g.imageSmoothingEnabled = size !== full;
    g.fillStyle = "#000";
    g.fillRect(0, 0, c.width, c.height);
    const w = map.width, h = map.height;
    const at = (x, y, z) => map.data[(z * h + y) * w + x] || 0;
    const half = size / 2;
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const dx = x * size, dy = y * size;
            drawTile(g, bitmaps, at(x, y, 0), dx, dy, size);
            drawTile(g, bitmaps, at(x, y, 1), dx, dy, size);
            const sh = at(x, y, 4) & 15;
            if (sh) {
                g.fillStyle = "rgba(0,0,0,0.5)";
                for (let i = 0; i < 4; i++) {
                    if (sh & (1 << i)) {
                        g.fillRect(dx + (i % 2) * half, dy + Math.floor(i / 2) * half, half, half);
                    }
                }
            }
        }
    }
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            drawTile(g, bitmaps, at(x, y, 2), x * size, y * size, size);
            drawTile(g, bitmaps, at(x, y, 3), x * size, y * size, size);
        }
    }
    return { canvas: c, scaled: size !== full };
}

export function openSaveImageDialog(api, edit) {
    return new Promise(resolve => {
        const path = document.createElement("input");
        path.type = "text";
        path.value = `Map${pad3(edit.id)}.png`;
        const note = document.createElement("p");
        note.className = "mtHint";
        note.textContent = "Caminho dentro da pasta do projeto.";
        const dlg = api.openDialog({
            title: "Salvar como Imagem",
            width: "460px",
            height: "230px",
            buttons: [
                {
                    label: "Ok", primary: true, onClick: () => {
                        const p = path.value.trim().replace(/^[\\/]+/, "");
                        if (!p) {
                            api.status("O local está vazio.");
                            return false;
                        }
                        if (p.length > 240) {
                            api.status("O nome do caminho é muito longo.");
                            return false;
                        }
                        save(api, edit, /\.png$/i.test(p) ? p : p + ".png").then(resolve);
                        return true;
                    }
                },
                { label: "Cancelar", onClick: () => resolve(false) }
            ]
        });
        dlg.body.append(field("Local de Saída", path, "Local para salvar a imagem do mapa."), note);
    });
}

async function save(api, edit, relPath) {
    try {
        api.status("Gerando imagem…");
        const tilesets = await api.project.tilesets();
        const { canvas, scaled } = await renderMapCanvas(edit.map, tilesets[edit.map.tilesetId]);
        const blob = await new Promise(r => canvas.toBlob(r, "image/png"));
        await api.project.writeBinary(relPath, blob, "image/png");
        api.status(`Imagem salva: ${relPath} (${canvas.width}×${canvas.height}${scaled ? ", reduzida" : ""})`);
        return true;
    } catch (err) {
        console.error(err);
        api.status("Falha ao salvar imagem: " + (err.message || err));
        return false;
    }
}
