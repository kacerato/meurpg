// Simulação da rota de movimento para a prévia no mapa: port do runtime (testproject/js/rmmz_objects.js)
// Game_Map.checkPassage/isPassable/roundX/deltaX, Game_CharacterBase.canPass/isMapPassable/
// isCollidedWith*/moveStraight/moveDiagonally/jump/updateMove/updateJump, Game_Character.
// processMoveCommand/updateRoutineMove/advanceMoveRouteIndex/moveRandom/moveTowardCharacter… e
// Game_Event.updateSelfMovement (frequência). Os outros eventos ficam parados na posição inicial, com a
// página que estaria ativa num jogo novo (switches/variáveis/self switches desligados); o jogador fica
// numa posição de referência. O sorteio usa um gerador com semente (o resultado é um dos possíveis).

// ---------- mapa ----------
export class SimMap {
    // map: dados do MapXXX.json; flags: tileset.flags; events: map.events (pode ser a cópia em edição);
    // system: System.json; mapId; selfId: evento que anda (fica fora da colisão); player: {x, y} | null
    constructor({ map, flags, events, system, mapId, selfId = 0, player = null }) {
        this.map = map;
        this.flags = flags || [];
        this.width = map.width; this.height = map.height;
        const st = map.scrollType || 0;
        this.loopH = st === 2 || st === 3;
        this.loopV = st === 1 || st === 3;
        this.player = player;
        this.chars = []; // {x, y, through, priorityType, tileId}
        for (const ev of events || map.events || []) {
            if (!ev || ev.id === selfId) { continue; }
            const pg = activePage(ev, system);
            if (!pg) { this.chars.push({ x: ev.x, y: ev.y, through: true, priorityType: 1, tileId: 0 }); continue; } // clearPageSettings: through
            this.chars.push({ x: ev.x, y: ev.y, through: !!pg.through, priorityType: pg.priorityType, tileId: pg.image.tileId || 0 });
        }
        // Game_CharacterBase.isCollidedWithVehicles: barco e navio no mapa (posição inicial do System)
        this.vehicles = [];
        for (const k of ["boat", "ship"]) {
            const v = system && system[k];
            if (v && v.startMapId === mapId) { this.vehicles.push({ x: v.startX, y: v.startY }); }
        }
    }
    isValid(x, y) { return x >= 0 && x < this.width && y >= 0 && y < this.height; }
    roundX(x) { return this.loopH ? mod(x, this.width) : x; }
    roundY(y) { return this.loopV ? mod(y, this.height) : y; }
    roundXWithDirection(x, d) { return this.roundX(x + (d === 6 ? 1 : d === 4 ? -1 : 0)); }
    roundYWithDirection(y, d) { return this.roundY(y + (d === 2 ? 1 : d === 8 ? -1 : 0)); }
    deltaX(x1, x2) { let r = x1 - x2; if (this.loopH && Math.abs(r) > this.width / 2) { r += r < 0 ? this.width : -this.width; } return r; }
    deltaY(y1, y2) { let r = y1 - y2; if (this.loopV && Math.abs(r) > this.height / 2) { r += r < 0 ? this.height : -this.height; } return r; }
    tileId(x, y, z) { return this.map.data[(z * this.height + y) * this.width + x] || 0; }
    // allTiles = eventos de tile (prioridade abaixo, com tileId) + camadas 3..0
    allTiles(x, y) {
        const tiles = this.chars.filter(c => c.tileId > 0 && c.priorityType === 0 && !c.through && c.x === x && c.y === y).map(c => c.tileId);
        for (let i = 0; i < 4; i++) { tiles.push(this.tileId(x, y, 3 - i)); }
        return tiles;
    }
    checkPassage(x, y, bit) {
        for (const tile of this.allTiles(x, y)) {
            const flag = this.flags[tile] || 0;
            if ((flag & 0x10) !== 0) { continue; }
            if ((flag & bit) === 0) { return true; }
            if ((flag & bit) === bit) { return false; }
        }
        return false;
    }
    isPassable(x, y, d) { return this.checkPassage(x, y, (1 << (d / 2 - 1)) & 0x0f); }
    isLadder(x, y) { if (!this.isValid(x, y)) { return false; } for (let i = 0; i < 4; i++) { if ((this.flags[this.tileId(x, y, 3 - i)] & 0x20) !== 0) { return true; } } return false; }
    eventsXyNt(x, y) { return this.chars.filter(c => c.x === x && c.y === y && !c.through); }
}
function mod(a, n) { return ((a % n) + n) % n; }

// Página ativa num jogo novo: a última cujas condições valem sem switches/variáveis/self switches/itens
// (Game_Event.findProperPageIndex/meetsConditions); "ator presente" vale se estiver no grupo inicial.
export function activePage(ev, system) {
    for (let i = ev.pages.length - 1; i >= 0; i--) {
        const c = ev.pages[i].conditions || {};
        if (c.switch1Valid || c.switch2Valid || c.selfSwitchValid || c.itemValid) { continue; }
        if (c.variableValid && !(0 >= c.variableValue)) { continue; }
        if (c.actorValid && !((system && system.partyMembers) || []).includes(c.actorId)) { continue; }
        return ev.pages[i];
    }
    return null;
}

// Propriedades da página usadas pela simulação (Game_Event.setupPageSettings).
export function pageMoveProps(pg) {
    if (!pg) { return { d: 2 }; }
    return { d: pg.image.direction || 2, directionFix: pg.directionFix, moveSpeed: pg.moveSpeed, moveFrequency: pg.moveFrequency, through: pg.through, priorityType: pg.priorityType };
}

// Gerador com semente (mulberry32) no lugar de Math.random.
export function rng(seed) {
    let a = seed >>> 0;
    const next = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    return { randomInt: max => Math.floor(max * next()) };
}

// ---------- personagem ----------
// start: {x, y, d, moveSpeed, moveFrequency, through, priorityType, directionFix, isPlayer}
// forced: true = Set Movement Route (forceMoveRoute: um comando por quadro parado);
//         false = rota da página (moveType Custom: um comando a cada 30 * (5 - frequência) quadros).
export class SimChar {
    constructor(map, start, route, { forced = true, seed = 1 } = {}) {
        this.m = map;
        this.rand = rng(seed);
        this._x = this._realX = start.x; this._y = this._realY = start.y;
        this._direction = start.d || 2;
        this._moveSpeed = start.moveSpeed || 4;
        this._moveFrequency = start.moveFrequency || 3;
        this._through = !!start.through;
        this._priorityType = start.priorityType === undefined ? 1 : start.priorityType;
        this._directionFix = !!start.directionFix;
        this.isPlayer = !!start.isPlayer;
        this._stopCount = 0; this._jumpCount = 0; this._jumpPeak = 0; this._waitCount = 0;
        this._movementSuccess = true;
        this._moveRoute = route;
        this._moveRouteIndex = 0;
        this.forced = forced;
        this._moveRouteForcing = forced;
        this.frame = 0;
        this.log = [];     // comandos executados: {index, code, x, y, d, x0, y0, ok, frame, kind}
        this.ended = false;
    }
    get x() { return this._x; }
    get y() { return this._y; }
    isMoving() { return this._realX !== this._x || this._realY !== this._y; }
    isJumping() { return this._jumpCount > 0; }
    isStopping() { return !this.isMoving() && !this.isJumping(); }
    jumpHeight() { return (this._jumpPeak * this._jumpPeak - Math.pow(Math.abs(this._jumpCount - this._jumpPeak), 2)) / 2; }
    distancePerFrame() { return Math.pow(2, this._moveSpeed) / 256; }
    reverseDir(d) { return 10 - d; }
    isNormalPriority() { return this._priorityType === 1; }
    setDirection(d) { if (!this._directionFix && d) { this._direction = d; } this._stopCount = 0; }

    canPass(x, y, d) {
        const m = this.m, x2 = m.roundXWithDirection(x, d), y2 = m.roundYWithDirection(y, d);
        if (!m.isValid(x2, y2)) { return false; }
        if (this._through) { return true; }
        if (!this.isMapPassable(x, y, d)) { return false; }
        if (this.isCollidedWithCharacters(x2, y2)) { return false; }
        return true;
    }
    canPassDiagonally(x, y, horz, vert) {
        const x2 = this.m.roundXWithDirection(x, horz), y2 = this.m.roundYWithDirection(y, vert);
        if (this.canPass(x, y, vert) && this.canPass(x, y2, horz)) { return true; }
        if (this.canPass(x, y, horz) && this.canPass(x2, y, vert)) { return true; }
        return false;
    }
    isMapPassable(x, y, d) {
        const m = this.m, x2 = m.roundXWithDirection(x, d), y2 = m.roundYWithDirection(y, d);
        return m.isPassable(x, y, d) && m.isPassable(x2, y2, this.reverseDir(d));
    }
    isCollidedWithCharacters(x, y) {
        // Game_Event: qualquer evento não "through" bloqueia; Game_Player: só os de prioridade normal.
        const evs = this.m.eventsXyNt(x, y);
        const byEvents = this.isPlayer ? evs.some(e => e.priorityType === 1) : evs.length > 0;
        if (byEvents || this.m.vehicles.some(v => v.x === x && v.y === y)) { return true; }
        // Game_Event.isCollidedWithPlayerCharacters
        const p = this.m.player;
        return !this.isPlayer && this.isNormalPriority() && !!p && p.x === x && p.y === y;
    }
    moveStraight(d) {
        this._movementSuccess = this.canPass(this._x, this._y, d);
        const m = this.m;
        this.setDirection(d);
        if (this._movementSuccess) {
            this._x = m.roundXWithDirection(this._x, d);
            this._y = m.roundYWithDirection(this._y, d);
            this._realX = this._x + (d === 4 ? 1 : d === 6 ? -1 : 0);
            this._realY = this._y + (d === 8 ? 1 : d === 2 ? -1 : 0);
            this.increaseSteps();
        }
    }
    moveDiagonally(horz, vert) {
        const m = this.m;
        this._movementSuccess = this.canPassDiagonally(this._x, this._y, horz, vert);
        if (this._movementSuccess) {
            this._x = m.roundXWithDirection(this._x, horz);
            this._y = m.roundYWithDirection(this._y, vert);
            this._realX = this._x + (horz === 4 ? 1 : -1);
            this._realY = this._y + (vert === 8 ? 1 : -1);
            this.increaseSteps();
        }
        if (this._direction === this.reverseDir(horz)) { this.setDirection(horz); }
        if (this._direction === this.reverseDir(vert)) { this.setDirection(vert); }
    }
    increaseSteps() { if (this.m.isLadder(this._x, this._y)) { this.setDirection(8); } this._stopCount = 0; }
    jump(xPlus, yPlus) {
        if (Math.abs(xPlus) > Math.abs(yPlus)) { if (xPlus !== 0) { this.setDirection(xPlus < 0 ? 4 : 6); } }
        else if (yPlus !== 0) { this.setDirection(yPlus < 0 ? 8 : 2); }
        this._x += xPlus; this._y += yPlus;
        const distance = Math.round(Math.sqrt(xPlus * xPlus + yPlus * yPlus));
        this._jumpPeak = 10 + distance - this._moveSpeed;
        this._jumpCount = this._jumpPeak * 2;
        this._stopCount = 0;
    }
    player() { return this.m.player || { x: this._x, y: this._y }; }
    moveRandom() { const d = 2 + this.rand.randomInt(4) * 2; if (this.canPass(this._x, this._y, d)) { this.moveStraight(d); } }
    moveToward(c, away) {
        const sx = this.m.deltaX(this._x, c.x), sy = this.m.deltaY(this._y, c.y);
        const hx = (sx > 0) !== away ? 4 : 6, vy = (sy > 0) !== away ? 8 : 2;
        if (Math.abs(sx) > Math.abs(sy)) {
            this.moveStraight(hx);
            if (!this._movementSuccess && sy !== 0) { this.moveStraight(vy); }
        } else if (sy !== 0) {
            this.moveStraight(vy);
            if (!this._movementSuccess && sx !== 0) { this.moveStraight(hx); }
        }
    }
    turnToward(c, away) {
        const sx = this.m.deltaX(this._x, c.x), sy = this.m.deltaY(this._y, c.y);
        if (Math.abs(sx) > Math.abs(sy)) { this.setDirection((sx > 0) !== away ? 4 : 6); } else if (sy !== 0) { this.setDirection((sy > 0) !== away ? 8 : 2); }
    }

    processMoveCommand(c) {
        const p = c.parameters || [];
        const R = { 2: 4, 4: 8, 6: 2, 8: 6 }, L = { 2: 6, 4: 2, 6: 8, 8: 4 };
        switch (c.code) {
            case 0:
                if (this._moveRoute.repeat) { this._moveRouteIndex = -1; } else if (this._moveRouteForcing) { this._moveRouteForcing = false; this.ended = true; } else { this.ended = true; }
                break;
            case 1: this.moveStraight(2); break;
            case 2: this.moveStraight(4); break;
            case 3: this.moveStraight(6); break;
            case 4: this.moveStraight(8); break;
            case 5: this.moveDiagonally(4, 2); break;
            case 6: this.moveDiagonally(6, 2); break;
            case 7: this.moveDiagonally(4, 8); break;
            case 8: this.moveDiagonally(6, 8); break;
            case 9: this.moveRandom(); break;
            case 10: this.moveToward(this.player(), false); break;
            case 11: this.moveToward(this.player(), true); break;
            case 12: this.moveStraight(this._direction); break;
            case 13: { const fix = this._directionFix; this._directionFix = true; this.moveStraight(this.reverseDir(this._direction)); this._directionFix = fix; break; }
            case 14: this.jump(p[0] || 0, p[1] || 0); break;
            case 15: this._waitCount = (p[0] || 0) - 1; break;
            case 16: this.setDirection(2); break;
            case 17: this.setDirection(4); break;
            case 18: this.setDirection(6); break;
            case 19: this.setDirection(8); break;
            case 20: this.setDirection(R[this._direction]); break;
            case 21: this.setDirection(L[this._direction]); break;
            case 22: this.setDirection(this.reverseDir(this._direction)); break;
            case 23: this.setDirection((this.rand.randomInt(2) === 0 ? R : L)[this._direction]); break;
            case 24: this.setDirection(2 + this.rand.randomInt(4) * 2); break;
            case 25: this.turnToward(this.player(), false); break;
            case 26: this.turnToward(this.player(), true); break;
            case 29: this._moveSpeed = p[0]; break;
            case 30: this._moveFrequency = p[0]; break;
            case 35: this._directionFix = true; break;
            case 36: this._directionFix = false; break;
            case 37: this._through = true; break;
            case 38: this._through = false; break;
        }
    }
    advanceMoveRouteIndex() {
        const r = this._moveRoute;
        if (r && (this._movementSuccess || r.skippable)) {
            this._moveRouteIndex++;
            if (r.repeat && this._moveRouteIndex >= r.list.length - 1) { this._moveRouteIndex = 0; }
        }
    }
    updateRoutineMove() {
        if (this._waitCount > 0) { this._waitCount--; return; }
        this._movementSuccess = true;
        const index = this._moveRouteIndex;
        const command = this._moveRoute.list[index];
        if (!command) { this.ended = true; return; }
        const x0 = this._x, y0 = this._y, d0 = this._direction;
        this.processMoveCommand(command);
        this.log.push({ index, code: command.code, x0, y0, d0, x: this._x, y: this._y, d: this._direction, ok: this._movementSuccess, frame: this.frame, jump: command.code === 14 });
        this.advanceMoveRouteIndex();
    }
    // Um quadro (Game_CharacterBase.update + Game_Character/Game_Event.updateStop).
    update() {
        this.frame++;
        if (this.isStopping()) {
            this._stopCount++;
            if (this._moveRouteForcing) { this.updateRoutineMove(); }
            else if (!this.forced && this._stopCount > 30 * (5 - this._moveFrequency)) { this.updateRoutineMove(); }
        }
        if (this.isJumping()) {
            this._jumpCount--;
            this._realX = (this._realX * this._jumpCount + this._x) / (this._jumpCount + 1.0);
            this._realY = (this._realY * this._jumpCount + this._y) / (this._jumpCount + 1.0);
            if (this._jumpCount === 0) { this._realX = this._x = this.m.roundX(this._x); this._realY = this._y = this.m.roundY(this._y); }
        } else if (this.isMoving()) {
            const dpf = this.distancePerFrame();
            if (this._x < this._realX) { this._realX = Math.max(this._realX - dpf, this._x); }
            if (this._x > this._realX) { this._realX = Math.min(this._realX + dpf, this._x); }
            if (this._y < this._realY) { this._realY = Math.max(this._realY - dpf, this._y); }
            if (this._y > this._realY) { this._realY = Math.min(this._realY + dpf, this._y); }
        }
    }
}

// Roda a rota até o fim (ou uma volta completa com Repeat, ou até travar sem "Skip If Cannot Move").
// Devolve {log, frames, stuck, ended, char}.
export function runRoute(map, start, route, { forced = true, seed = 1, maxFrames = 60 * 600 } = {}) {
    const ch = new SimChar(map, start, route, { forced, seed });
    let stuck = false, lastFail = -1, fails = 0;
    const n = route.list.length;
    while (ch.frame < maxFrames) {
        const before = ch.log.length;
        ch.update();
        if (ch.ended && ch.isStopping()) { break; }
        if (ch.log.length > before) {
            const e = ch.log[ch.log.length - 1];
            if (!e.ok && !route.skippable && e.code !== 0) {
                fails = lastFail === e.index ? fails + 1 : 1; lastFail = e.index;
                if (fails >= 3) { stuck = true; ch.log.splice(ch.log.length - 2, 2); break; } // mesma tentativa repetida
            } else { fails = 0; lastFail = -1; }
            // Repeat: uma volta completa (voltou ao índice 0 depois de passar pelo fim)
            if (route.repeat && e.index === n - 2 && ch._moveRouteIndex === 0) {
                while (!ch.isStopping() && ch.frame < maxFrames) { ch.update(); }
                break;
            }
            if (route.repeat && n <= 1) { break; }
        }
    }
    // travado: o tempo conta até a primeira tentativa que falhou
    const frames = stuck && ch.log.length ? ch.log[ch.log.length - 1].frame : ch.frame;
    return { log: ch.log, frames, stuck, ended: ch.ended, char: ch };
}
