// Pequenos utilitários de interface do módulo plugins (diálogos com Promise, listas de toque).

import { t } from "../i18n.js";

export function el(tag, attrs = {}, ...children) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
        if (v == null || v === false) {
            continue;
        }
        if (k === "class") {
            e.className = v;
        } else if (k === "text") {
            e.textContent = v;
        } else if (k.startsWith("on") && typeof v === "function") {
            e.addEventListener(k.slice(2), v);
        } else if (k === "style" && typeof v === "object") {
            Object.assign(e.style, v);
        } else {
            e.setAttribute(k, v === true ? "" : v);
        }
    }
    for (const c of children.flat()) {
        if (c == null || c === false) {
            continue;
        }
        e.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    }
    return e;
}

// Diálogo modal que devolve uma Promise.
//   build(body, ctx)  monta o conteúdo; ctx.accept(valor) fecha com valor; ctx.close() cancela.
//   onOk()            devolve o valor (undefined = não fecha).
export function promptDialog(api, { title, width, height, build, onOk, okLabel = t("OK", "BasicConstants"), extraButtons = [] }) {
    return new Promise(resolve => {
        let done = false;
        const finish = v => {
            if (!done) {
                done = true;
                resolve(v);
            }
        };
        const buttons = [
            ...extraButtons,
            {
                label: okLabel, primary: true, onClick: () => {
                    const v = onOk ? onOk() : true;
                    if (v === undefined) {
                        return false;
                    }
                    finish(v);
                    return true;
                }
            },
            { label: t("Cancel", "BasicConstants"), onClick: () => finish(null) }
        ];
        const d = api.openDialog({ title, width, height, buttons });
        d.root.classList.add("pgDialog");
        // Fechado por fora (Esc / api.closeTopDialog): resolve como cancelado.
        const mo = new MutationObserver(() => {
            if (!d.root.isConnected) {
                mo.disconnect();
                finish(null);
            }
        });
        mo.observe(document.body, { childList: true });
        const ctx = {
            dialog: d,
            accept(v) {
                finish(v);
                d.close();
            },
            close() {
                finish(null);
                d.close();
            }
        };
        build(d.body, ctx);
    });
}

export function alertDialog(api, title, message) {
    return promptDialog(api, {
        title, width: "520px", height: "auto",
        build(body) {
            body.appendChild(el("div", { class: "pgMessage", text: message }));
        },
        onOk: () => true
    });
}

export function confirmDialog(api, title, message) {
    return promptDialog(api, {
        title, width: "520px", height: "auto",
        build(body) {
            body.appendChild(el("div", { class: "pgMessage", text: message }));
        },
        onOk: () => true
    }).then(v => v === true);
}

// Lista de seleção para toque: tocar seleciona; tocar de novo no item selecionado ativa.
// items: [{label, value, sub?}]; devolve {root, select(index), get selected(), setItems()}.
export function touchList({ items = [], selected = -1, onSelect, onActivate, className = "" }) {
    const root = el("div", { class: "pgList " + className, tabindex: "0" });
    let cur = selected;
    let data = items;
    const render = () => {
        root.textContent = "";
        data.forEach((it, i) => {
            const row = el("div", { class: "pgListRow" + (i === cur ? " selected" : "") + (it.className ? " " + it.className : "") },
                it.icon || null,
                el("span", { class: "pgListLabel", text: it.label }),
                it.sub ? el("span", { class: "pgListSub", text: it.sub }) : null);
            row.addEventListener("click", () => {
                if (cur === i) {
                    if (onActivate) {
                        onActivate(it, i);
                    }
                    return;
                }
                api.select(i);
                if (onSelect) {
                    onSelect(it, i);
                }
            });
            root.appendChild(row);
        });
    };
    const api = {
        root,
        get selected() { return cur; },
        get item() { return data[cur]; },
        select(i, scroll = false) {
            cur = i;
            [...root.children].forEach((r, j) => r.classList.toggle("selected", j === i));
            if (scroll && root.children[i]) {
                root.children[i].scrollIntoView({ block: "nearest" });
            }
        },
        setItems(list, sel = -1) {
            data = list;
            cur = sel;
            render();
        }
    };
    render();
    return api;
}

export function pad(n, len = 4) {
    return String(n).padStart(len, "0");
}
