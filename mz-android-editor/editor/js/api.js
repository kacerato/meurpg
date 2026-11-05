// API compartilhada entre os módulos do editor (banco de dados, eventos, pintura, plugins...).
import { t } from "./i18n.js";

// Regras: módulos NÃO editam index.html/app.js; cada um exporta `register(api)` a partir de
// editor/js/<modulo>/index.js e é ligado em editor/js/modules.js.

const dialogs = [];

// ---------------------------------------------------------------------------------------------
// CONTRATO DE SALVAMENTO ("projeto modificado" único, como o RPG Maker MZ)
//
// O MZ mantém tudo em memória e só grava em "Salvar projeto" (Ctrl+S), perguntando
// "Salvar as alterações no jogo?" ao abrir/criar outro projeto, fechar ou sair. Aqui:
//
//   api.markDirty(file, data?)   marca `file` (caminho relativo, ex. "data/Map001.json") como
//                                modificado. `data` = objeto a gravar; sem `data`, grava o objeto
//                                que estiver no cache do Project (api.project.readJson(file)).
//   api.markDirty(file, null, { del: true })   agenda a EXCLUSÃO do arquivo no próximo Salvar.
//   api.markClean(file)          desfaz a marcação (ex.: desfazer voltou ao estado gravado).
//   api.isDirty()                há algo a salvar?
//   api.dirtyFiles()             lista dos arquivos marcados.
//   api.on("save", async () => {...})   chamado no início de api.saveAll(), em ordem de registro,
//                                e aguardado: o módulo grava o que guarda por conta própria
//                                ou chama markDirty com o que tiver pendente.
//   api.on("saved", ({files}) => {...})  depois de gravar; `files` = caminhos gravados/excluídos.
//   api.on("dirty:changed", ({dirty}) => {...})
//   await api.saveAll()          grava tudo (Salvar projeto, Testar jogo, Implantação...).
//                                Devolve true se gravou sem erro.
//   await api.confirmSave()      se houver alterações, pergunta Sim/Não/Cancelar; Sim grava.
//                                Devolve false só em Cancelar (ou falha ao gravar).
//
// Compatibilidade: módulos que gravam direto com api.project.writeJson (banco de dados e
// plugins, no OK/Aplicar) continuam funcionando — essa gravação imediata só não entra no
// "não salvar" (fica documentado como divergência no FIDELITY.md).
// ---------------------------------------------------------------------------------------------

const dirty = new Map(); // file -> { data, del }

export const api = {
    project: null,       // instância de Project (project.js): readJson/writeJson/list/map()/tilesets()...
    view: null,          // MapView atual (mapview.js) ou null
    currentMapId: 0,
    mode: "map",         // "map" | "event" — contrato entre maptools e events; mudar emite "mode:changed"
    listeners: new Map(),

    // Preenchidos por app.js
    selectMap: async () => {},
    refreshMapTree: async () => {},

    // Eventos simples: "map:selected" {id, map, tileset}, "map:changed" {id}, "maps:changed",
    // "db:changed" {file}, "mode:changed" {mode}, "plugins:changed",
    // "save", "saved" {files}, "dirty:changed" {dirty} (ver CONTRATO DE SALVAMENTO acima)
    on(name, fn) {
        const list = this.listeners.get(name) || [];
        list.push(fn);
        this.listeners.set(name, list);
    },
    off(name, fn) {
        const list = this.listeners.get(name) || [];
        const i = list.indexOf(fn);
        if (i >= 0) { list.splice(i, 1); }
    },
    emit(name, payload) {
        for (const fn of this.listeners.get(name) || []) {
            try { fn(payload); } catch (e) { console.error(name, e); }
        }
    },

    // ---------- salvamento unificado ----------
    markDirty(file, data, opts = {}) {
        if (!file) { return; }
        const was = dirty.size > 0;
        dirty.set(file, { data: data === undefined ? null : data, del: !!opts.del });
        if (this.project) {
            if (opts.del) { this.project.cache.delete(file); }
            else if (data) { this.project.cache.set(file, data); }
        }
        if (!was) { this.emit("dirty:changed", { dirty: true }); }
    },
    markClean(file) {
        if (dirty.delete(file) && dirty.size === 0) { this.emit("dirty:changed", { dirty: false }); }
    },
    isDirty() { return dirty.size > 0; },
    isDirtyFile(file) { const d = dirty.get(file); return !!d && !d.del; },
    dirtyFiles() { return [...dirty.keys()]; },

    async saveAll() {
        if (!this.project) { return false; }
        if (this._saving) { return this._saving; }
        const run = async () => {
            for (const fn of this.listeners.get("save") || []) {
                await fn();
            }
            const files = [];
            // exclusões primeiro (um mapa excluído e recriado com o mesmo id volta a ser gravado)
            const entries = [...dirty.entries()].sort((a, b) => Number(b[1].del) - Number(a[1].del));
            for (const [file, { data, del }] of entries) {
                if (del) {
                    await this.project.delete(file);
                } else {
                    const obj = data || this.project.cache.get(file);
                    if (obj === undefined) { continue; }
                    await this.project.writeJson(file, obj);
                }
                // marcado de novo durante a gravação? mantém
                if (dirty.get(file) && dirty.get(file).data === data && dirty.get(file).del === del) {
                    dirty.delete(file);
                }
                files.push(file);
            }
            if (dirty.size === 0) { this.emit("dirty:changed", { dirty: false }); }
            this.emit("saved", { files });
            return true;
        };
        this._saving = run().catch(e => {
            console.error(e);
            this.status(t("Failed to save: %1", null, e.message || e));
            return false;
        }).finally(() => { this._saving = null; });
        return this._saving;
    },

    // Sim/Não/Cancelar ("Salvar as alterações no jogo?"). Devolve false se o usuário cancelar.
    confirmSave() {
        if (!this.isDirty()) { return Promise.resolve(true); }
        return new Promise(resolve => {
            let answered = false;
            const done = v => { answered = true; resolve(v); };
            const dlg = this.openDialog({
                title: "RPG Maker MZ",
                width: "420px",
                height: "170px",
                buttons: [
                    { label: t("Yes", "BasicConstants"), primary: true, onClick: () => { answered = true; this.saveAll().then(ok => resolve(!!ok)); } },
                    { label: t("No", "BasicConstants"), onClick: () => done(true) },
                    { label: t("Cancel", "BasicConstants"), onClick: () => done(false) }
                ]
            });
            dlg.body.textContent = t("Save changes to the game?", "ProjectManager");
            dlg.onClose = () => { if (!answered) { resolve(false); } };
        });
    },

    // Liga um botão da barra (id em index.html) a uma função e o habilita.
    bindToolbar(buttonId, handler, title) {
        const btn = document.getElementById(buttonId);
        if (!btn) {
            return null;
        }
        btn.disabled = false;
        if (title) {
            btn.title = title;
        }
        btn.addEventListener("click", handler);
        return btn;
    },

    // Abre um diálogo modal no estilo do MZ. Devolve {root, body, close}.
    // opts: { title, width, height, buttons: [{label, primary, onClick}] }
    openDialog(opts) {
        const root = document.createElement("div");
        root.className = "mzDialogBackdrop";
        const box = document.createElement("div");
        box.className = "mzDialog";
        if (opts.width) { box.style.width = opts.width; }
        if (opts.height) { box.style.height = opts.height; }
        const head = document.createElement("div");
        head.className = "mzDialogTitle";
        head.textContent = opts.title || "";
        const body = document.createElement("div");
        body.className = "mzDialogBody";
        const foot = document.createElement("div");
        foot.className = "mzDialogButtons";
        const handle = { root, body: null, close: null, onClose: null };
        const close = () => {
            if (!root.isConnected) { return; }
            root.remove();
            const i = dialogs.indexOf(root);
            if (i >= 0) { dialogs.splice(i, 1); }
            if (handle.onClose) { try { handle.onClose(); } catch (e) { console.error(e); } }
        };
        root._mzClose = close;
        for (const b of opts.buttons || [{ label: t("OK", "BasicConstants"), primary: true }, { label: t("Cancel", "BasicConstants") }]) {
            const btn = document.createElement("button");
            btn.textContent = b.label;
            if (b.primary) { btn.classList.add("primary"); }
            btn.addEventListener("click", () => {
                const r = b.onClick ? b.onClick() : undefined;
                if (r !== false) { close(); }
            });
            foot.appendChild(btn);
        }
        box.append(head, body, foot);
        root.appendChild(box);
        document.body.appendChild(root);
        dialogs.push(root);
        this.emit("dialog:open", { root });
        handle.body = body;
        handle.close = close;
        return handle;
    },

    closeTopDialog() {
        const top = dialogs[dialogs.length - 1];
        if (top) {
            if (top._mzClose) { top._mzClose(); } else { top.remove(); dialogs.pop(); }
            return true;
        }
        return false;
    },

    status(msg) {
        const el = document.getElementById("statusMsg");
        if (el) { el.textContent = msg || ""; }
    }
};
