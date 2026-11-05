// API compartilhada entre os módulos do editor (banco de dados, eventos, pintura, plugins...).
// Regras: módulos NÃO editam index.html/app.js; cada um exporta `register(api)` a partir de
// editor/js/<modulo>/index.js e é ligado em editor/js/modules.js.

const dialogs = [];

export const api = {
    project: null,       // instância de Project (project.js): readJson/writeJson/list/map()/tilesets()...
    view: null,          // MapView atual (mapview.js) ou null
    currentMapId: 0,
    listeners: new Map(),

    // Eventos simples: "map:selected" {id, map}, "map:changed" {id}, "db:changed" {file}
    on(name, fn) {
        const list = this.listeners.get(name) || [];
        list.push(fn);
        this.listeners.set(name, list);
    },
    emit(name, payload) {
        for (const fn of this.listeners.get(name) || []) {
            try { fn(payload); } catch (e) { console.error(name, e); }
        }
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
        const close = () => {
            root.remove();
            const i = dialogs.indexOf(root);
            if (i >= 0) { dialogs.splice(i, 1); }
        };
        for (const b of opts.buttons || [{ label: "OK", primary: true }, { label: "Cancelar" }]) {
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
        return { root, body, close };
    },

    closeTopDialog() {
        const top = dialogs[dialogs.length - 1];
        if (top) { top.remove(); dialogs.pop(); return true; }
        return false;
    },

    status(msg) {
        const el = document.getElementById("statusMsg");
        if (el) { el.textContent = msg || ""; }
    }
};
