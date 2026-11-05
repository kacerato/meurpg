// Utilitários de interface do módulo tools.
import { t } from "../i18n.js";

export function el(tag, attrs = {}, ...children) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
        if (v === undefined || v === null || v === false) { continue; }
        if (k === "class") { e.className = v; }
        else if (k === "text") { e.textContent = v; }
        else if (k === "html") { e.innerHTML = v; }
        else if (k.startsWith("on") && typeof v === "function") { e.addEventListener(k.slice(2), v); }
        else if (k === "style" && typeof v === "object") { Object.assign(e.style, v); }
        else if (v === true) { e.setAttribute(k, ""); }
        else { e.setAttribute(k, v); }
    }
    for (const c of children.flat()) {
        if (c === null || c === undefined || c === false) { continue; }
        e.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return e;
}

export function button(label, onClick, cls = "") {
    const b = el("button", { class: "tlBtn " + cls, type: "button" }, label);
    if (onClick) { b.addEventListener("click", onClick); }
    return b;
}

// Diálogo que resolve uma Promise (true = OK).
export function modal(api, opts) {
    return new Promise(resolve => {
        let done = false;
        const finish = v => { if (!done) { done = true; resolve(v); } };
        const buttons = (opts.buttons || [{ label: t("OK", "BasicConstants"), primary: true, value: true }, { label: t("Cancel", "BasicConstants"), value: false }])
            .map(b => ({
                label: b.label, primary: b.primary,
                onClick: () => {
                    if (b.onClick && b.onClick() === false) { return false; }
                    finish(b.value);
                }
            }));
        const dlg = api.openDialog({ title: opts.title, width: opts.width, height: opts.height, buttons });
        dlg.root.classList.add("tlDialog");
        if (opts.cls) { dlg.root.classList.add(opts.cls); }
        // fechar pelo app (Esc/voltar) também resolve
        const obs = new MutationObserver(() => {
            if (!dlg.root.isConnected) { obs.disconnect(); finish(opts.dismissValue ?? false); if (opts.onClose) { opts.onClose(); } }
        });
        obs.observe(document.body, { childList: true });
        if (opts.build) { opts.build(dlg.body, dlg); }
    });
}

export async function confirmBox(api, title, message) {
    return modal(api, {
        title, width: "440px", height: "auto", cls: "tlSmall",
        build: b => b.appendChild(el("div", { class: "tlMsg" }, el("img", { src: "img/question.png", alt: "" }), el("div", { text: message }))),
        buttons: [{ label: t("OK", "BasicConstants"), primary: true, value: true }, { label: t("Cancel", "BasicConstants"), value: false }]
    });
}

export async function alertBox(api, title, message, icon = "information") {
    return modal(api, {
        title, width: "480px", height: "auto", cls: "tlSmall",
        build: b => b.appendChild(el("div", { class: "tlMsg" }, el("img", { src: `img/${icon}.png`, alt: "" }), el("div", { class: "tlPre", text: message }))),
        buttons: [{ label: t("OK", "BasicConstants"), primary: true, value: true }]
    });
}

export function formatSize(n) {
    if (n < 1024) { return n + " B"; }
    if (n < 1024 * 1024) { return (n / 1024).toFixed(1) + " KB"; }
    return (n / 1024 / 1024).toFixed(2) + " MB";
}

// Barra de progresso simples dentro de um diálogo não-modal.
export function progressDialog(api, title) {
    const bar = el("div", { class: "tlProgressBar" }, el("div"));
    const label = el("div", { class: "tlProgressLabel", text: "" });
    const dlg = api.openDialog({ title, width: "480px", height: "auto", buttons: [] });
    dlg.root.classList.add("tlDialog", "tlSmall");
    dlg.body.append(label, bar);
    return {
        set(done, total, text) {
            bar.firstChild.style.width = (total ? Math.round(done / total * 100) : 0) + "%";
            label.textContent = text || `${done} / ${total}`;
        },
        close: dlg.close
    };
}
