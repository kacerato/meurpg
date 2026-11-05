// Mini-visualizador de mapa (Tilemap do corescript num PIXI.Application próprio) com camada de
// desenho em coordenadas de mapa. Usado pela prévia da rota de movimento.

const T = 48;

export class MiniMap {
    constructor(host, { zoom = 0.75 } = {}) {
        this.host = host;
        this.zoom = zoom;
        this.sx = 0; this.sy = 0;
        this.map = null;
        this.app = new PIXI.Application({ width: host.clientWidth || 400, height: host.clientHeight || 300, backgroundColor: 0x202020, resolution: 1 });
        host.append(this.app.view);
        this.app.view.style.touchAction = "none";
        this.world = new PIXI.Container();
        this.layer = new PIXI.Container(); // desenhos do chamador (coordenadas de mapa em px)
        this.app.stage.addChild(this.world);
        this.tilemap = null;
        this.app.ticker.add(() => { if (this.tilemap) { this.tilemap.update(); } });
        this._ro = new ResizeObserver(() => { if (this.app) { this.app.renderer.resize(Math.max(1, host.clientWidth), Math.max(1, host.clientHeight)); this.apply(); } });
        this._ro.observe(host);
        this._bindPointer();
    }

    async load(api, mapId) {
        const map = await api.project.map(mapId);
        const tilesets = await api.project.tilesets();
        const ts = tilesets[map.tilesetId];
        if (!this.app) { return; }
        this.map = map;
        if (this.tilemap) { this.world.removeChild(this.tilemap); this.tilemap.destroy(); }
        const tm = new Tilemap();
        tm.tileWidth = T; tm.tileHeight = T;
        tm.setData(map.width, map.height, map.data);
        tm.horizontalWrap = false; tm.verticalWrap = false;
        const bitmaps = ts.tilesetNames.map(n => ImageManager.loadTileset(n));
        tm.setBitmaps(bitmaps);
        tm.flags = ts.flags;
        for (const b of bitmaps) { b.addLoadListener(() => this.apply()); }
        this.tilemap = tm;
        this.world.addChildAt(tm, 0);
        this.world.addChild(this.layer);
        this.apply();
    }

    centerOn(x, y) {
        if (!this.app) { return; }
        this.sx = (x + 0.5) * T * this.zoom - this.app.renderer.width / 2;
        this.sy = (y + 0.5) * T * this.zoom - this.app.renderer.height / 2;
        this.apply();
    }

    apply() {
        if (!this.app || !this.tilemap || !this.map) { return; }
        const rw = this.app.renderer.width, rh = this.app.renderer.height, z = this.zoom;
        const mw = this.map.width * T * z, mh = this.map.height * T * z;
        this.sx = mw < rw ? 0 : Math.max(0, Math.min(mw - rw, this.sx));
        this.sy = mh < rh ? 0 : Math.max(0, Math.min(mh - rh, this.sy));
        this.world.scale.set(z, z);
        this.world.position.set(mw < rw ? Math.floor((rw - mw) / 2) : 0, mh < rh ? Math.floor((rh - mh) / 2) : 0);
        this.tilemap.width = Math.ceil(rw / z); this.tilemap.height = Math.ceil(rh / z);
        this.tilemap.origin.x = this.sx / z; this.tilemap.origin.y = this.sy / z;
        this.tilemap.refresh();
        this.layer.position.set(-this.sx / z, -this.sy / z);
    }

    _bindPointer() {
        const v = this.app.view;
        let down = null;
        v.addEventListener("pointerdown", e => { v.setPointerCapture(e.pointerId); down = { x: e.clientX, y: e.clientY }; });
        v.addEventListener("pointermove", e => {
            if (!down) { return; }
            this.sx -= e.clientX - down.x; this.sy -= e.clientY - down.y;
            down = { x: e.clientX, y: e.clientY };
            this.apply();
        });
        const up = () => { down = null; };
        v.addEventListener("pointerup", up);
        v.addEventListener("pointercancel", up);
    }

    destroy() {
        if (!this.app) { return; }
        this._ro.disconnect();
        try { this.app.destroy(true, { children: true }); } catch (e) { /* ignora */ }
        this.app = null;
    }
}
