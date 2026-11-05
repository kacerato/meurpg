// Cliente do projeto: fala com o servidor local (Node no PC, NanoHTTPD no Android)
// pelo contrato /api e /project. O editor nunca toca o sistema de arquivos diretamente.

import { t } from "./i18n.js";

export const PROJECT_BASE = "/project/";

export class Project {
    constructor() {
        this.info = null;
        this.cache = new Map();
    }

    async open() {
        const res = await fetch("/api/project");
        if (!res.ok) {
            throw new Error(t("Could not open the project: %1", null, res.status));
        }
        this.info = await res.json();
        this.cache.clear();
        return this.info;
    }

    get name() {
        return this.info ? this.info.name : "";
    }

    async readJson(relPath, { fresh = false } = {}) {
        if (!fresh && this.cache.has(relPath)) {
            return this.cache.get(relPath);
        }
        const res = await fetch("/api/file?path=" + encodeURIComponent(relPath));
        if (!res.ok) {
            throw new Error(t("Failed to read %1: %2", null, relPath, res.status));
        }
        const data = await res.json();
        this.cache.set(relPath, data);
        return data;
    }

    async writeJson(relPath, data) {
        const body = JSON.stringify(data);
        const res = await fetch("/api/file?path=" + encodeURIComponent(relPath), {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body
        });
        if (!res.ok) {
            throw new Error(t("Failed to write %1: %2", null, relPath, res.status));
        }
        this.cache.set(relPath, data);
        return res.json();
    }

    async writeBinary(relPath, blob, type = "application/octet-stream") {
        const res = await fetch("/api/file?path=" + encodeURIComponent(relPath), {
            method: "PUT",
            headers: { "Content-Type": type },
            body: blob
        });
        if (!res.ok) {
            throw new Error(t("Failed to write %1: %2", null, relPath, res.status));
        }
        return res.json();
    }

    async delete(relPath) {
        const res = await fetch("/api/file?path=" + encodeURIComponent(relPath), { method: "DELETE" });
        this.cache.delete(relPath);
        return res.ok;
    }

    async list(dir) {
        const res = await fetch("/api/list?dir=" + encodeURIComponent(dir));
        return res.ok ? res.json() : [];
    }

    // Atalhos do banco de dados MZ
    mapInfos() { return this.readJson("data/MapInfos.json"); }
    system() { return this.readJson("data/System.json"); }
    tilesets() { return this.readJson("data/Tilesets.json"); }
    map(id) { return this.readJson("data/Map" + String(id).padStart(3, "0") + ".json"); }
}

// Redireciona o carregamento de imagens do corescript para a pasta do projeto.
export function patchImageManagerForProject() {
    const original = ImageManager.loadBitmap;
    ImageManager.loadBitmap = function(folder, filename) {
        return original.call(this, PROJECT_BASE + folder, filename);
    };
}
