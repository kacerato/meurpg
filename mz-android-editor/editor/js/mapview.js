// Visualizador de mapa. Usa o Tilemap do corescript do próprio projeto (rmmz_core.js),
// então o desenho (autotiles, camadas, animação de água) é idêntico ao do jogo.

const TILE = 48;

export class MapView {
    constructor(canvas, viewport) {
        this.canvas = canvas;
        this.viewport = viewport;
        this.zoom = 1;
        this.scrollX = 0;
        this.scrollY = 0;
        this.showGrid = true;
        this.mapData = null;
        this.tileset = null;
        this.onStatus = () => {};
        this.onPointerTile = () => {};

        PIXI.utils.skipHello();
        PIXI.settings.GC_MAX_IDLE = 600;
        this.app = new PIXI.Application({
            view: canvas,
            width: viewport.clientWidth,
            height: viewport.clientHeight,
            backgroundColor: 0x111111,
            resolution: 1,
            autoStart: true
        });
        this.world = new PIXI.Container();
        this.app.stage.addChild(this.world);
        this.tilemap = null;
        this.overlay = new PIXI.Graphics();
        this.app.ticker.add(this._tick, this);

        this._bindInput();
        this._resizeObserver = new ResizeObserver(() => this.resize());
        this._resizeObserver.observe(viewport);
    }

    get tileWidth() { return TILE; }
    get tileHeight() { return TILE; }

    resize() {
        const w = Math.max(1, this.viewport.clientWidth);
        const h = Math.max(1, this.viewport.clientHeight);
        this.app.renderer.resize(w, h);
        this._applyView();
    }

    // Carrega um mapa já lido (objeto MapXXX.json) com o tileset correspondente.
    load(mapData, tileset) {
        this.mapData = mapData;
        this.tileset = tileset;
        if (this.tilemap) {
            this.world.removeChild(this.tilemap);
            this.tilemap.destroy();
            this.tilemap = null;
        }
        const tilemap = new Tilemap();
        tilemap.tileWidth = TILE;
        tilemap.tileHeight = TILE;
        tilemap.setData(mapData.width, mapData.height, mapData.data);
        tilemap.horizontalWrap = mapData.scrollType === 2 || mapData.scrollType === 3;
        tilemap.verticalWrap = mapData.scrollType === 1 || mapData.scrollType === 3;
        const bitmaps = tileset.tilesetNames.map(name => ImageManager.loadTileset(name));
        tilemap.setBitmaps(bitmaps);
        tilemap.flags = tileset.flags;
        this._loadParallax(mapData);
        this.world.addChild(tilemap);
        this.world.addChild(this.overlay);
        this.tilemap = tilemap;
        this.scrollX = 0;
        this.scrollY = 0;
        this._applyView();
        this._drawOverlay();
    }

    setZoom(z, cx, cy) {
        const old = this.zoom;
        z = Math.min(4, Math.max(0.125, z));
        if (cx === undefined) {
            cx = this.app.renderer.width / 2;
            cy = this.app.renderer.height / 2;
        }
        // mantém o ponto sob o cursor fixo
        this.scrollX = (this.scrollX + cx) * (z / old) - cx;
        this.scrollY = (this.scrollY + cy) * (z / old) - cy;
        this.zoom = z;
        this._applyView();
    }

    setGrid(on) {
        this.showGrid = on;
        this._drawOverlay();
    }

    scrollBy(dx, dy) {
        this.scrollX += dx;
        this.scrollY += dy;
        this._applyView();
    }

    // Fundo de parallax, como o editor original mostra sob os tiles vazios.
    _loadParallax(mapData) {
        if (this.parallax) {
            this.world.removeChild(this.parallax);
            this.parallax.destroy();
            this.parallax = null;
        }
        if (!mapData.parallaxShow || !mapData.parallaxName) {
            return;
        }
        const bitmap = ImageManager.loadParallax(mapData.parallaxName);
        const { w, h } = { w: mapData.width * TILE, h: mapData.height * TILE };
        const attach = () => {
            if (this.mapData !== mapData) {
                return;
            }
            const texture = new PIXI.Texture(bitmap.baseTexture);
            const sprite = new PIXI.TilingSprite(texture, w, h);
            if (!mapData.parallaxLoopX && !mapData.parallaxLoopY) {
                sprite.width = Math.min(w, bitmap.width);
                sprite.height = Math.min(h, bitmap.height);
            }
            this.parallax = sprite;
            this.world.addChildAt(sprite, 0);
            this._applyView();
        };
        if (bitmap.isReady()) {
            attach();
        } else {
            bitmap.addLoadListener(attach);
        }
    }

    _mapPixelSize() {
        if (!this.mapData) {
            return { w: 0, h: 0 };
        }
        return { w: this.mapData.width * TILE, h: this.mapData.height * TILE };
    }

    _applyView() {
        const rw = this.app.renderer.width;
        const rh = this.app.renderer.height;
        const { w, h } = this._mapPixelSize();
        const z = this.zoom;
        const maxX = Math.max(0, w * z - rw);
        const maxY = Math.max(0, h * z - rh);
        this.scrollX = Math.min(maxX, Math.max(0, this.scrollX));
        this.scrollY = Math.min(maxY, Math.max(0, this.scrollY));
        // centraliza mapas menores que a janela
        const offX = w * z < rw ? Math.floor((rw - w * z) / 2) : 0;
        const offY = h * z < rh ? Math.floor((rh - h * z) / 2) : 0;
        this.world.scale.set(z, z);
        this.world.position.set(offX, offY);
        if (this.tilemap) {
            // o Tilemap desenha apenas a área visível a partir de origin, em pixels de mapa
            this.tilemap.width = Math.ceil(rw / z);
            this.tilemap.height = Math.ceil(rh / z);
            this.tilemap.origin.x = this.scrollX / z;
            this.tilemap.origin.y = this.scrollY / z;
            this.tilemap.refresh();
            this.overlay.position.set(-this.scrollX / z, -this.scrollY / z);
            if (this.parallax) {
                this.parallax.position.set(-this.scrollX / z, -this.scrollY / z);
            }
        }
    }

    // Redesenha grade e molduras de eventos (público; usado pelos módulos).
    redrawOverlay() {
        this._drawOverlay();
    }

    _drawOverlay() {
        const g = this.overlay;
        g.clear();
        if (!this.mapData) {
            return;
        }
        const { w, h } = this._mapPixelSize();
        if (this.showGrid) {
            g.lineStyle(1, 0x000000, 0.35);
            for (let x = 0; x <= this.mapData.width; x++) {
                g.moveTo(x * TILE, 0).lineTo(x * TILE, h);
            }
            for (let y = 0; y <= this.mapData.height; y++) {
                g.moveTo(0, y * TILE).lineTo(w, y * TILE);
            }
        }
        // eventos: moldura branca como no editor original
        g.lineStyle(2, 0xffffff, 0.9);
        for (const ev of this.mapData.events || []) {
            if (ev) {
                g.drawRect(ev.x * TILE + 2, ev.y * TILE + 2, TILE - 4, TILE - 4);
            }
        }
        g.lineStyle(2, 0xffffff, 0.6);
        g.drawRect(0, 0, w, h);
    }

    _tick() {
        if (this.tilemap) {
            this.tilemap.update();
        }
        this._scrollParallax();
    }

    // Panorama "Mostrar no editor" com Repetir + Rolar Sx/Sy: anda como no jogo
    // (Game_Map.updateParallax: _parallaxX += sx / tileWidth / 2 por quadro → sx/2 px por quadro a 60 fps).
    _scrollParallax() {
        const m = this.mapData;
        const p = this.parallax;
        if (!p || !m || p.destroyed) {
            return;
        }
        const frames = Math.min(4, this.app.ticker.deltaMS / (1000 / 60));
        if (m.parallaxLoopX && m.parallaxSx) {
            p.tilePosition.x = (p.tilePosition.x - m.parallaxSx / 2 * frames) % p.texture.width;
        }
        if (m.parallaxLoopY && m.parallaxSy) {
            p.tilePosition.y = (p.tilePosition.y - m.parallaxSy / 2 * frames) % p.texture.height;
        }
    }

    // Entrada: arrastar para rolar, roda para rolar/zoom, pinça para zoom.
    _bindInput() {
        const el = this.viewport;
        const pointers = new Map();
        let lastDist = 0;
        let moved = false;

        el.addEventListener("pointerdown", e => {
            el.setPointerCapture(e.pointerId);
            pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
            moved = false;
            if (pointers.size === 2) {
                const [a, b] = [...pointers.values()];
                lastDist = Math.hypot(a.x - b.x, a.y - b.y);
            }
        });
        el.addEventListener("pointermove", e => {
            const rect = el.getBoundingClientRect();
            this._reportTile(e.clientX - rect.left, e.clientY - rect.top);
            if (!pointers.has(e.pointerId)) {
                return;
            }
            const prev = pointers.get(e.pointerId);
            const cur = { x: e.clientX, y: e.clientY };
            pointers.set(e.pointerId, cur);
            if (pointers.size === 1) {
                const dx = cur.x - prev.x;
                const dy = cur.y - prev.y;
                if (Math.abs(dx) + Math.abs(dy) > 2) {
                    moved = true;
                }
                this.scrollBy(-dx, -dy);
            } else if (pointers.size === 2) {
                const [a, b] = [...pointers.values()];
                const dist = Math.hypot(a.x - b.x, a.y - b.y);
                if (lastDist > 0) {
                    const cx = (a.x + b.x) / 2 - rect.left;
                    const cy = (a.y + b.y) / 2 - rect.top;
                    this.setZoom(this.zoom * (dist / lastDist), cx, cy);
                }
                lastDist = dist;
            }
        });
        const up = e => {
            pointers.delete(e.pointerId);
            lastDist = 0;
        };
        el.addEventListener("pointerup", up);
        el.addEventListener("pointercancel", up);
        el.addEventListener("wheel", e => {
            e.preventDefault();
            const rect = el.getBoundingClientRect();
            if (e.ctrlKey) {
                const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
                this.setZoom(this.zoom * factor, e.clientX - rect.left, e.clientY - rect.top);
            } else {
                this.scrollBy(e.shiftKey ? e.deltaY : e.deltaX, e.shiftKey ? 0 : e.deltaY);
            }
        }, { passive: false });
    }

    _reportTile(px, py) {
        if (!this.mapData) {
            return;
        }
        const z = this.zoom;
        const x = Math.floor((px - this.world.position.x + this.scrollX) / (TILE * z));
        const y = Math.floor((py - this.world.position.y + this.scrollY) / (TILE * z));
        if (x >= 0 && y >= 0 && x < this.mapData.width && y < this.mapData.height) {
            this.onPointerTile(x, y);
        }
    }
}
