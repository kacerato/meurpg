// Reprodutor de áudio do Sound Test / Resource Manager.
// Usa a classe WebAudio do runtime (rmmz_core.js, já carregado pela página) para que
// volume, pitch e pan soem exatamente como no jogo. Sem runtime: cai para <audio>.

const players = { bgm: null, bgs: null, me: null, se: [] };
let fallbackOk = false;

function hasWebAudio() {
    if (typeof window.WebAudio !== "function") { return false; }
    if (!window.WebAudio._context) {
        try { window.WebAudio.initialize(); } catch { return false; }
    }
    return !!window.WebAudio._context;
}

function canOgg() {
    try { return !!(window.Utils && Utils.canPlayOgg ? Utils.canPlayOgg() : new Audio().canPlayType("audio/ogg")); }
    catch { return false; }
}

// files: nomes (com extensão) disponíveis na pasta, para escolher .ogg ou .m4a.
export function audioUrl(type, name, files) {
    const exts = canOgg() ? ["ogg", "m4a"] : ["m4a", "ogg"];
    let ext = exts[0];
    if (files) {
        ext = exts.find(e => files.has(`${name}.${e}`)) || ext;
    }
    return `/project/audio/${type}/${encodeURIComponent(name)}.${ext}`;
}

class HtmlAudio {
    constructor(url) { this.a = new Audio(url); this.a.preservesPitch = false; }
    set volume(v) { this.a.volume = Math.max(0, Math.min(1, v)); }
    set pitch(p) { this.a.playbackRate = Math.max(0.5, Math.min(1.5, p)); }
    set pan(_p) { /* <audio> não tem pan */ }
    play(loop) { this.a.loop = loop; this.a.play().catch(() => {}); }
    stop() { this.a.pause(); }
    isPlaying() { return !this.a.paused; }
}

function make(url) {
    if (hasWebAudio()) {
        const w = new window.WebAudio(url);
        return w;
    }
    fallbackOk = true;
    return new HtmlAudio(url);
}

// a: {name, volume, pitch, pan} (escala do MZ: 0–100, 50–150, -100–100)
export function play(type, a, files) {
    if (!a || !a.name) { return; }
    const p = make(audioUrl(type, a.name, files));
    p.volume = (a.volume ?? 90) / 100;
    p.pitch = (a.pitch ?? 100) / 100;
    p.pan = (a.pan ?? 0) / 100;
    if (type === "se") {
        players.se = players.se.filter(s => s.isPlaying && s.isPlaying());
        players.se.push(p);
        p.play(false, 0);
    } else {
        stop(type);
        if (type === "me") { stop("bgm"); }
        players[type] = p;
        p.play(type === "bgm" || type === "bgs", 0);
    }
    return p;
}

// Ajusta volume/pitch/pan do que está tocando (sliders ao vivo, como no MZ).
export function update(type, a) {
    const list = type === "se" ? players.se : [players[type]];
    for (const p of list) {
        if (!p) { continue; }
        p.volume = (a.volume ?? 90) / 100;
        p.pitch = (a.pitch ?? 100) / 100;
        p.pan = (a.pan ?? 0) / 100;
    }
}

export function stop(type) {
    if (!type) {
        for (const t of ["bgm", "bgs", "me", "se"]) { stop(t); }
        return;
    }
    if (type === "se") {
        for (const s of players.se) { try { s.stop(); } catch {} }
        players.se = [];
        return;
    }
    if (players[type]) {
        try { players[type].stop(); } catch {}
        players[type] = null;
    }
}

export function usingFallback() { return fallbackOk && !hasWebAudio(); }
