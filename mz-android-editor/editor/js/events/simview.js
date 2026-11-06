// Desenho dos personagens do mundo simulado (routesim.js SimWorld) na prévia da rota: um sprite por
// evento, jogador, seguidor e veículo, com o quadro do gráfico como Sprite_Character (padrão, direção,
// $ grande, tiles B–E), posição real (_realX/_realY, shiftY, altura do salto), opacidade e transparência.
// O personagem da rota em edição ganha um anel amarelo (ou o marcador antigo, se não tiver imagem).

import { isBigCharacter } from "./ui.js";

const T = 48;

export class CharSprites {
    constructor(layer, tileset) {
        this.layer = layer;
        this.tileset = tileset;
        this.sprites = new Map();
        this.ring = new PIXI.Graphics();
        this.layer.addChild(this.ring);
        this.layer.sortableChildren = true;
    }
    destroy() {
        for (const c of this.layer.removeChildren()) { c.destroy({ children: true }); }
        this.sprites.clear();
    }
    chars(world) {
        const out = [...world.vehicles.filter(v => v.onMap), ...world.events];
        if (world.playerOnMap) { out.push(...world.player.followers.filter(f => f.visible).reverse(), world.player); }
        return out;
    }
    sync(world) {
        const seen = new Set();
        for (const ch of this.chars(world)) {
            seen.add(ch);
            let s = this.sprites.get(ch);
            if (!s) {
                s = new PIXI.Sprite();
                s.anchor.set(0.5, 1);
                s._key = "";
                this.sprites.set(ch, s);
                this.layer.addChild(s);
            }
            this.updateFrame(s, ch);
            s.position.set((ch._realX + 0.5) * T, (ch._realY + 1) * T - ch.shiftY() - ch.jumpHeight());
            s.alpha = ch.isTransparent() ? 0 : ch.opacity() / 255;
            s.blendMode = [PIXI.BLEND_MODES.NORMAL, PIXI.BLEND_MODES.ADD, PIXI.BLEND_MODES.MULTIPLY, PIXI.BLEND_MODES.SCREEN][ch.blendMode()] || 0;
            s.zIndex = ch._priorityType * 100000 + ch._realY * 48 + (ch === world.player ? 1 : 0);
        }
        for (const [ch, s] of this.sprites) { if (!seen.has(ch)) { s.destroy(); this.sprites.delete(ch); } }
        // anel do personagem principal
        const m = world.main, g = this.ring;
        g.clear();
        if (m) {
            const x = (m._realX + 0.5) * T, y = (m._realY + 1) * T - 8;
            const hasImg = !!(m._characterName || m._tileId);
            g.zIndex = m._priorityType * 100000 + m._realY * 48 - 1;
            if (hasImg) {
                g.lineStyle(3, 0x000000, 0.6).drawEllipse(x, y, 19, 8);
                g.lineStyle(2, 0xffff00, 1).drawEllipse(x, y, 19, 8);
            } else {
                const cy = (m._realY + 0.5) * T - m.jumpHeight();
                g.zIndex = 9e9;
                g.lineStyle(2, 0x000000).beginFill(0xffff00).drawCircle(x, cy, 11).endFill();
                const d = m._direction, dx = { 4: -1, 6: 1 }[d] || 0, dy = { 2: 1, 8: -1 }[d] || 0;
                g.lineStyle(0).beginFill(0x000000).drawCircle(x + dx * 7, cy + dy * 7, 3.5).endFill();
            }
        }
        this.layer.sortChildren();
    }
    updateFrame(s, ch) {
        const key = [ch._characterName, ch._characterIndex, ch._direction, ch.pattern(), ch._tileId].join("|");
        if (s._key === key) { return; }
        s._key = key;
        if (ch._tileId > 0) {
            const ts = this.tileset;
            const set = Math.floor(ch._tileId / 256), n = ch._tileId % 256;
            const name = ts && ts.tilesetNames[5 + set];
            if (!name || set > 3) { s.texture = PIXI.Texture.EMPTY; return; }
            const bmp = ImageManager.loadTileset(name);
            this.whenReady(bmp, s, key, () => {
                const sx = ((Math.floor(n / 128) % 2) * 8 + (n % 8)) * T, sy = (Math.floor(n / 8) % 16) * T;
                return new PIXI.Texture(bmp.baseTexture, new PIXI.Rectangle(sx, sy, T, T));
            });
        } else if (ch._characterName) {
            const bmp = ImageManager.loadCharacter(ch._characterName);
            this.whenReady(bmp, s, key, () => {
                if (!bmp.width) { return PIXI.Texture.EMPTY; }
                const big = isBigCharacter(ch._characterName);
                const pw = bmp.width / (big ? 3 : 12), ph = bmp.height / (big ? 4 : 8);
                const bx = big ? 0 : (ch._characterIndex % 4) * 3, by = big ? 0 : Math.floor(ch._characterIndex / 4) * 4;
                const fx = (bx + ch.pattern()) * pw, fy = (by + Math.max(0, (ch._direction - 2) / 2)) * ph;
                return new PIXI.Texture(bmp.baseTexture, new PIXI.Rectangle(fx, fy, pw, ph));
            });
        } else {
            s.texture = PIXI.Texture.EMPTY;
        }
    }
    whenReady(bmp, s, key, make, tries = 0) {
        if (s.destroyed || s._key !== key) { return; }
        if (bmp.isReady()) { s.texture = make(); return; }
        if (bmp.isError && bmp.isError()) { s.texture = PIXI.Texture.EMPTY; return; }
        if (tries < 300) { setTimeout(() => this.whenReady(bmp, s, key, make, tries + 1), 30); }
    }
}
