// Reprodutor de áudio do Sound Test / Resource Manager.
// Usa a classe WebAudio do runtime (rmmz_core.js, já carregado pela página) para que
// volume, pitch e pan soem exatamente como no jogo. Sem runtime: cai para <audio>.

const players = { bgm: null, bgs: null, me: null, se: [] };
// BGM interrompida por um ME: retomada do mesmo ponto quando o ME termina (AudioManager.playMe/
// stopMe do runtime: guarda a posição e volta com fade-in de 0,5 s).
let suspendedBgm = null;   // {url, volume, pitch, pan, pos}
const REPLAY_FADE = 0.5;
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
    constructor(url) {
        this.a = new Audio(url); this.a.preservesPitch = false; this.listeners = [];
        this.a.addEventListener("ended", () => this._fireStop());
    }
    _fireStop() { while (this.listeners.length) { this.listeners.shift()(); } }
    addStopListener(fn) { this.listeners.push(fn); }
    seek() { return this.a.currentTime; }
    fadeIn() { /* sem fade no <audio> */ }
    set volume(v) { this.a.volume = Math.max(0, Math.min(1, v)); }
    set pitch(p) { this.a.playbackRate = Math.max(0.5, Math.min(1.5, p)); }
    set pan(_p) { /* <audio> não tem pan */ }
    play(loop, offset = 0) { this.a.loop = loop; if (offset) { this.a.currentTime = offset; } this.a.play().catch(() => {}); }
    stop() { this.a.pause(); this._fireStop(); }
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
    const url = audioUrl(type, a.name, files);
    const p = make(url);
    p._info = { url, volume: (a.volume ?? 90) / 100, pitch: (a.pitch ?? 100) / 100, pan: (a.pan ?? 0) / 100 };
    p.volume = p._info.volume;
    p.pitch = p._info.pitch;
    p.pan = p._info.pan;
    if (type === "se") {
        players.se = players.se.filter(s => s.isPlaying && s.isPlaying());
        players.se.push(p);
        p.play(false, 0);
    } else {
        if (type === "me") {
            // como AudioManager.playMe: a BGM para e é lembrada (posição) para voltar depois
            if (players.bgm && !suspendedBgm) {
                let pos = 0;
                try { pos = players.bgm.seek() || 0; } catch { /* ainda carregando */ }
                suspendedBgm = { ...players.bgm._info, pos };
            }
            stop("bgm", { keepSuspended: true });
        }
        if (type === "bgm") { suspendedBgm = null; }
        stop(type, { keepSuspended: true });
        players[type] = p;
        if (type === "me") {
            p.addStopListener(() => {
                // fim natural do ME (não um Stop do usuário nem outro ME por cima)
                if (players.me === p && !p._manualStop) {
                    players.me = null;
                    resumeBgm();
                }
            });
        }
        p.play(type === "bgm" || type === "bgs", 0);
    }
    return p;
}

function resumeBgm() {
    const b = suspendedBgm;
    suspendedBgm = null;
    if (!b || players.bgm) { return; }
    const p = make(b.url);
    p._info = { url: b.url, volume: b.volume, pitch: b.pitch, pan: b.pan };
    p.volume = b.volume;
    p.pitch = b.pitch;
    p.pan = b.pan;
    players.bgm = p;
    p.play(true, b.pos);
    try { p.fadeIn(REPLAY_FADE); } catch { /* sem fade */ }
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

export function stop(type, { keepSuspended = false } = {}) {
    if (!type) {
        for (const t of ["bgm", "bgs", "me", "se"]) { stop(t); }
        return;
    }
    // Parar a BGM ou o ME pelo usuário também esquece a BGM a retomar.
    if (!keepSuspended && (type === "bgm" || type === "me")) { suspendedBgm = null; }
    if (type === "se") {
        for (const s of players.se) { try { s.stop(); } catch {} }
        players.se = [];
        return;
    }
    if (players[type]) {
        const p = players[type];
        players[type] = null;
        p._manualStop = true;
        try { p.stop(); } catch {}
    }
}

// Estado atual (testes/depuração): URLs tocando e a BGM esperando o fim do ME.
export function playing() {
    const u = p => (p && p._info ? p._info.url : null);
    return { bgm: u(players.bgm), bgs: u(players.bgs), me: u(players.me), se: players.se.length, suspendedBgm: suspendedBgm && suspendedBgm.url };
}

export function usingFallback() { return fallbackOk && !hasWebAudio(); }
