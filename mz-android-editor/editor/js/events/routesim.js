// Simulação da rota de movimento para a prévia no mapa: port do runtime (testproject/js/rmmz_objects.js).
//
// Um "mundo" (SimWorld) roda quadro a quadro como Scene_Map.updateMain → Game_Map.update (refreshIfNeeded,
// eventos em ordem de ID) → Game_Player.update → Game_Followers.update:
//   - SimMap: Game_Map.checkPassage/isPassable/roundX/deltaX/isLadder/eventsXyNt/tileEventsXy;
//   - SimChar: Game_CharacterBase/Game_Character (canPass, colisão, moveStraight/Diagonally, jump, rota,
//     processMoveCommand inclusive Switch ON/OFF, Script, imagem, opacidade, padrão de animação);
//   - SimEvent: Game_Event (página ativa por switches/variáveis/self switches simulados, setupPageSettings,
//     updateSelfMovement: Random/Approach/Custom com a frequência, isNearTheScreen, lock do evento que
//     roda o comando);
//   - SimPlayer + SimFollower: Game_Player/Game_Follower (seguidores perseguem o anterior, jumpAll);
//   - veículos (barco e navio na posição inicial do System) bloqueiam como Game_CharacterBase.
//     isCollidedWithVehicles.
// Estado do jogo simulado = jogo novo: switches OFF, variáveis 0, self switches OFF, sem itens, grupo
// inicial do System. Switch ON/OFF (27/28) e Script (45) mexem só nesse estado (nada é gravado).
// O sorteio usa um gerador com semente (o resultado é um dos possíveis).

// ---------- mapa ----------
export class SimMap {
    // map: dados do MapXXX.json; flags: tileset.flags; world: SimWorld (personagens)
    constructor({ map, flags, mapId = 0 }) {
        this.map = map;
        this.mapId = mapId;
        this.flags = flags || [];
        this.width = map.width; this.height = map.height;
        const st = map.scrollType || 0;
        this.loopH = st === 2 || st === 3;
        this.loopV = st === 1 || st === 3;
        this.world = null;
    }
    isValid(x, y) { return x >= 0 && x < this.width && y >= 0 && y < this.height; }
    roundX(x) { return this.loopH ? mod(x, this.width) : x; }
    roundY(y) { return this.loopV ? mod(y, this.height) : y; }
    roundXWithDirection(x, d) { return this.roundX(x + (d === 6 ? 1 : d === 4 ? -1 : 0)); }
    roundYWithDirection(y, d) { return this.roundY(y + (d === 2 ? 1 : d === 8 ? -1 : 0)); }
    deltaX(x1, x2) { let r = x1 - x2; if (this.loopH && Math.abs(r) > this.width / 2) { r += r < 0 ? this.width : -this.width; } return r; }
    deltaY(y1, y2) { let r = y1 - y2; if (this.loopV && Math.abs(r) > this.height / 2) { r += r < 0 ? this.height : -this.height; } return r; }
    tileId(x, y, z) { return this.map.data[(z * this.height + y) * this.width + x] || 0; }
    events() { return this.world ? this.world.events : []; }
    // Game_Map.tileEventsXy: eventos de tile (refreshTileEvents) não "through" na posição
    tileEventsXy(x, y) { return this.world ? this.world.tileEvents.filter(e => e.posNt(x, y)) : []; }
    // allTiles = eventos de tile + camadas 3..0
    allTiles(x, y) {
        const tiles = this.tileEventsXy(x, y).map(e => e._tileId);
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
    eventsXy(x, y) { return this.events().filter(e => e.pos(x, y)); }
    eventsXyNt(x, y) { return this.events().filter(e => e.posNt(x, y)); }
}
function mod(a, n) { return ((a % n) + n) % n; }

// Estado inicial (jogo novo) usado para escolher páginas fora da simulação (ex.: ícone na lista).
const NEW_GAME = { sw: () => false, vr: () => 0, self: () => false, item: () => false };

// Game_Event.meetsConditions com um estado {sw(id), vr(id), self(key), item(id)} e o grupo inicial.
function meetsConditions(page, ev, mapId, state, system) {
    const c = page.conditions || {};
    if (c.switch1Valid && !state.sw(c.switch1Id)) { return false; }
    if (c.switch2Valid && !state.sw(c.switch2Id)) { return false; }
    if (c.variableValid && state.vr(c.variableId) < c.variableValue) { return false; }
    if (c.selfSwitchValid && state.self([mapId, ev.id, c.selfSwitchCh].join()) !== true) { return false; }
    if (c.itemValid && !state.item(c.itemId)) { return false; }
    if (c.actorValid && !((system && system.partyMembers) || []).includes(c.actorId)) { return false; }
    return true;
}
function findProperPageIndex(ev, mapId, state, system) {
    for (let i = ev.pages.length - 1; i >= 0; i--) {
        if (meetsConditions(ev.pages[i], ev, mapId, state, system)) { return i; }
    }
    return -1;
}

// Página ativa num jogo novo: a última cujas condições valem sem switches/variáveis/self switches/itens
// (Game_Event.findProperPageIndex/meetsConditions); "ator presente" vale se estiver no grupo inicial.
export function activePage(ev, system) {
    const i = findProperPageIndex(ev, 0, NEW_GAME, system);
    return i >= 0 ? ev.pages[i] : null;
}

// Propriedades da página usadas pela simulação (Game_Event.setupPageSettings).
export function pageMoveProps(pg) {
    if (!pg) { return { d: 2 }; }
    return {
        d: pg.image.direction || 2, directionFix: pg.directionFix, moveSpeed: pg.moveSpeed, moveFrequency: pg.moveFrequency,
        through: pg.through, priorityType: pg.priorityType, image: pg.image, walkAnime: pg.walkAnime, stepAnime: pg.stepAnime, trigger: pg.trigger
    };
}

// Gerador com semente (mulberry32) no lugar de Math.random.
export function rng(seed) {
    let a = seed >>> 0;
    const next = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    return { randomInt: max => Math.floor(max * next()) };
}

const isObjectName = name => /^[!$]*!/.test(name || ""); // ImageManager.isObjectCharacter

// ---------- personagem (Game_CharacterBase + Game_Character) ----------
export class SimChar {
    constructor(world) {
        this.w = world;
        this.m = world.map;
        this._x = this._realX = 0; this._y = this._realY = 0;
        this._moveSpeed = 4; this._moveFrequency = 6;
        this._opacity = 255; this._blendMode = 0;
        this._direction = 2; this._pattern = 1; this._priorityType = 1;
        this._tileId = 0; this._characterName = ""; this._characterIndex = 0; this._isObjectCharacter = false;
        this._walkAnime = true; this._stepAnime = false; this._directionFix = false; this._through = false; this._transparent = false;
        this._animationCount = 0; this._stopCount = 0; this._jumpCount = 0; this._jumpPeak = 0;
        this._movementSuccess = true;
        this._moveRouteForcing = false; this._moveRoute = null; this._moveRouteIndex = 0;
        this._originalMoveRoute = null; this._originalMoveRouteIndex = 0; this._waitCount = 0;
        this.log = null;   // só o personagem da rota em edição registra: {index, code, x0, y0, d0, x, y, d, ok, frame, jump, err}
        this.ended = false;
    }
    get x() { return this._x; }
    get y() { return this._y; }
    pos(x, y) { return this._x === x && this._y === y; }
    posNt(x, y) { return this.pos(x, y) && !this.isThrough(); }
    direction() { return this._direction; }
    moveSpeed() { return this._moveSpeed; }
    setMoveSpeed(v) { this._moveSpeed = v; }
    moveFrequency() { return this._moveFrequency; }
    setMoveFrequency(v) { this._moveFrequency = v; }
    opacity() { return this._opacity; }
    setOpacity(v) { this._opacity = v; }
    blendMode() { return this._blendMode; }
    setBlendMode(v) { this._blendMode = v; }
    isNormalPriority() { return this._priorityType === 1; }
    setPriorityType(v) { this._priorityType = v; }
    isMoving() { return this._realX !== this._x || this._realY !== this._y; }
    isJumping() { return this._jumpCount > 0; }
    isStopping() { return !this.isMoving() && !this.isJumping(); }
    jumpHeight() { return (this._jumpPeak * this._jumpPeak - Math.pow(Math.abs(this._jumpCount - this._jumpPeak), 2)) / 2; }
    realMoveSpeed() { return this._moveSpeed; }
    distancePerFrame() { return Math.pow(2, this.realMoveSpeed()) / 256; }
    isThrough() { return this._through; }
    setThrough(v) { this._through = !!v; }
    isDirectionFixed() { return this._directionFix; }
    setDirectionFix(v) { this._directionFix = !!v; }
    isTransparent() { return this._transparent; }
    setTransparent(v) { this._transparent = !!v; }
    hasWalkAnime() { return this._walkAnime; }
    setWalkAnime(v) { this._walkAnime = !!v; }
    hasStepAnime() { return this._stepAnime; }
    setStepAnime(v) { this._stepAnime = !!v; }
    isObjectCharacter() { return this._isObjectCharacter; }
    shiftY() { return this._isObjectCharacter ? 0 : 6; }
    pattern() { return this._pattern < 3 ? this._pattern : 1; }
    setPattern(p) { this._pattern = p; }
    isOriginalPattern() { return this.pattern() === 1; }
    resetPattern() { this.setPattern(1); }
    resetStopCount() { this._stopCount = 0; }
    isMovementSucceeded() { return this._movementSuccess; }
    setMovementSuccess(v) { this._movementSuccess = v; }
    isMoveRouteForcing() { return this._moveRouteForcing; }
    reverseDir(d) { return 10 - d; }
    setImage(name, index) { this._tileId = 0; this._characterName = name || ""; this._characterIndex = index || 0; this._isObjectCharacter = isObjectName(name); }
    setTileImage(tileId) { this._tileId = tileId; this._characterName = ""; this._characterIndex = 0; this._isObjectCharacter = true; }
    tileId() { return this._tileId; }
    isTile() { return this._tileId > 0 && this._priorityType === 0; }
    characterName() { return this._characterName; }
    characterIndex() { return this._characterIndex; }
    setDirection(d) { if (!this._directionFix && d) { this._direction = d; } this.resetStopCount(); }
    setPosition(x, y) { this._x = Math.round(x); this._y = Math.round(y); this._realX = x; this._realY = y; }
    locate(x, y) { this.setPosition(x, y); this.straighten(); }
    straighten() { if (this.hasWalkAnime() || this.hasStepAnime()) { this._pattern = 1; } this._animationCount = 0; }
    copyPosition(c) { this._x = c._x; this._y = c._y; this._realX = c._realX; this._realY = c._realY; this._direction = c._direction; }
    deltaXFrom(x) { return this.m.deltaX(this.x, x); }
    deltaYFrom(y) { return this.m.deltaY(this.y, y); }

    canPass(x, y, d) {
        const m = this.m, x2 = m.roundXWithDirection(x, d), y2 = m.roundYWithDirection(y, d);
        if (!m.isValid(x2, y2)) { return false; }
        if (this.isThrough()) { return true; }
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
    isCollidedWithCharacters(x, y) { return this.isCollidedWithEvents(x, y) || this.isCollidedWithVehicles(x, y); }
    isCollidedWithEvents(x, y) { return this.m.eventsXyNt(x, y).some(e => e.isNormalPriority()); }
    isCollidedWithVehicles(x, y) { return this.w.vehicles.some(v => v.kind !== "airship" && v.posNt(x, y)); }
    moveStraight(d) {
        this.setMovementSuccess(this.canPass(this._x, this._y, d));
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
        this.setMovementSuccess(this.canPassDiagonally(this._x, this._y, horz, vert));
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
    increaseSteps() { if (this.m.isLadder(this._x, this._y)) { this.setDirection(8); } this.resetStopCount(); }
    jump(xPlus, yPlus) {
        if (Math.abs(xPlus) > Math.abs(yPlus)) { if (xPlus !== 0) { this.setDirection(xPlus < 0 ? 4 : 6); } }
        else if (yPlus !== 0) { this.setDirection(yPlus < 0 ? 8 : 2); }
        this._x += xPlus; this._y += yPlus;
        const distance = Math.round(Math.sqrt(xPlus * xPlus + yPlus * yPlus));
        this._jumpPeak = 10 + distance - this._moveSpeed;
        this._jumpCount = this._jumpPeak * 2;
        this.resetStopCount();
        this.straighten();
    }
    // sem jogador no mapa (prévia de evento sem posição de referência): "para o jogador" não anda
    gamePlayer() { return this.w.playerOnMap ? this.w.player : this; }
    moveRandom() { const d = 2 + this.w.rand.randomInt(4) * 2; if (this.canPass(this.x, this.y, d)) { this.moveStraight(d); } }
    moveTowardCharacter(c) { this._moveToward(c, false); }
    moveAwayFromCharacter(c) { this._moveToward(c, true); }
    turnTowardCharacter(c) { this._turnToward(c, false); }
    turnAwayFromCharacter(c) { this._turnToward(c, true); }
    moveTowardPlayer() { this.moveTowardCharacter(this.gamePlayer()); }
    moveAwayFromPlayer() { this.moveAwayFromCharacter(this.gamePlayer()); }
    turnTowardPlayer() { this.turnTowardCharacter(this.gamePlayer()); }
    turnAwayFromPlayer() { this.turnAwayFromCharacter(this.gamePlayer()); }
    moveForward() { this.moveStraight(this.direction()); }
    moveBackward() { const fix = this.isDirectionFixed(); this.setDirectionFix(true); this.moveStraight(this.reverseDir(this.direction())); this.setDirectionFix(fix); }
    turnRight90() { this.setDirection({ 2: 4, 4: 8, 6: 2, 8: 6 }[this.direction()]); }
    turnLeft90() { this.setDirection({ 2: 6, 4: 2, 6: 8, 8: 4 }[this.direction()]); }
    turn180() { this.setDirection(this.reverseDir(this.direction())); }
    turnRightOrLeft90() { if (this.w.rand.randomInt(2) === 0) { this.turnRight90(); } else { this.turnLeft90(); } }
    turnRandom() { this.setDirection(2 + this.w.rand.randomInt(4) * 2); }
    _moveToward(c, away) {
        const sx = this.deltaXFrom(c.x), sy = this.deltaYFrom(c.y);
        const hx = (sx > 0) !== away ? 4 : 6, vy = (sy > 0) !== away ? 8 : 2;
        if (Math.abs(sx) > Math.abs(sy)) {
            this.moveStraight(hx);
            if (!this._movementSuccess && sy !== 0) { this.moveStraight(vy); }
        } else if (sy !== 0) {
            this.moveStraight(vy);
            if (!this._movementSuccess && sx !== 0) { this.moveStraight(hx); }
        }
    }
    _turnToward(c, away) {
        const sx = this.deltaXFrom(c.x), sy = this.deltaYFrom(c.y);
        if (Math.abs(sx) > Math.abs(sy)) { this.setDirection((sx > 0) !== away ? 4 : 6); } else if (sy !== 0) { this.setDirection((sy > 0) !== away ? 8 : 2); }
    }

    // ---- rota ----
    memorizeMoveRoute() { this._originalMoveRoute = this._moveRoute; this._originalMoveRouteIndex = this._moveRouteIndex; }
    restoreMoveRoute() { this._moveRoute = this._originalMoveRoute; this._moveRouteIndex = this._originalMoveRouteIndex; this._originalMoveRoute = null; }
    setMoveRoute(r) {
        if (this._moveRouteForcing) { this._originalMoveRoute = r; this._originalMoveRouteIndex = 0; }
        else { this._moveRoute = r; this._moveRouteIndex = 0; }
    }
    forceMoveRoute(r) {
        if (!this._originalMoveRoute) { this.memorizeMoveRoute(); }
        this._moveRoute = r; this._moveRouteIndex = 0; this._moveRouteForcing = true; this._waitCount = 0;
    }
    processRouteEnd() {
        if (this._moveRoute.repeat) { this._moveRouteIndex = -1; }
        else if (this._moveRouteForcing) { this._moveRouteForcing = false; this.restoreMoveRoute(); if (this.log) { this.ended = true; } }
        else if (this.log) { this.ended = true; }
    }
    processMoveCommand(c) {
        const p = c.parameters || [];
        switch (c.code) {
            case 0: this.processRouteEnd(); break;
            case 1: this.moveStraight(2); break;
            case 2: this.moveStraight(4); break;
            case 3: this.moveStraight(6); break;
            case 4: this.moveStraight(8); break;
            case 5: this.moveDiagonally(4, 2); break;
            case 6: this.moveDiagonally(6, 2); break;
            case 7: this.moveDiagonally(4, 8); break;
            case 8: this.moveDiagonally(6, 8); break;
            case 9: this.moveRandom(); break;
            case 10: this.moveTowardPlayer(); break;
            case 11: this.moveAwayFromPlayer(); break;
            case 12: this.moveForward(); break;
            case 13: this.moveBackward(); break;
            case 14: this.jump(p[0] || 0, p[1] || 0); break;
            case 15: this._waitCount = (p[0] || 0) - 1; break;
            case 16: this.setDirection(2); break;
            case 17: this.setDirection(4); break;
            case 18: this.setDirection(6); break;
            case 19: this.setDirection(8); break;
            case 20: this.turnRight90(); break;
            case 21: this.turnLeft90(); break;
            case 22: this.turn180(); break;
            case 23: this.turnRightOrLeft90(); break;
            case 24: this.turnRandom(); break;
            case 25: this.turnTowardPlayer(); break;
            case 26: this.turnAwayFromPlayer(); break;
            case 27: this.w.setSwitch(p[0], true); break;
            case 28: this.w.setSwitch(p[0], false); break;
            case 29: this.setMoveSpeed(p[0]); break;
            case 30: this.setMoveFrequency(p[0]); break;
            case 31: this.setWalkAnime(true); break;
            case 32: this.setWalkAnime(false); break;
            case 33: this.setStepAnime(true); break;
            case 34: this.setStepAnime(false); break;
            case 35: this.setDirectionFix(true); break;
            case 36: this.setDirectionFix(false); break;
            case 37: this.setThrough(true); break;
            case 38: this.setThrough(false); break;
            case 39: this.setTransparent(true); break;
            case 40: this.setTransparent(false); break;
            case 41: this.setImage(p[0], p[1]); break;
            case 42: this.setOpacity(p[0]); break;
            case 43: this.setBlendMode(p[0]); break;
            case 45: this._lastScriptError = this.w.runScript(this, p[0]); break;
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
        this.setMovementSuccess(true);
        const index = this._moveRouteIndex;
        const command = this._moveRoute && this._moveRoute.list[index];
        if (!command) { if (this.log) { this.ended = true; } return; }
        const x0 = this._x, y0 = this._y, d0 = this._direction;
        this._lastScriptError = null;
        this.processMoveCommand(command);
        if (this.log) {
            this.log.push({ index, code: command.code, x0, y0, d0, x: this._x, y: this._y, d: this._direction, ok: this._movementSuccess, frame: this.w.frame, jump: command.code === 14, err: this._lastScriptError || null });
        }
        this.advanceMoveRouteIndex();
    }

    // ---- quadro (Game_CharacterBase.update) ----
    update() {
        if (this.isStopping()) { this.updateStop(); }
        if (this.isJumping()) { this.updateJump(); } else if (this.isMoving()) { this.updateMove(); }
        this.updateAnimation();
    }
    updateStop() { this._stopCount++; if (this._moveRouteForcing) { this.updateRoutineMove(); } }
    updateJump() {
        this._jumpCount--;
        this._realX = (this._realX * this._jumpCount + this._x) / (this._jumpCount + 1.0);
        this._realY = (this._realY * this._jumpCount + this._y) / (this._jumpCount + 1.0);
        if (this._jumpCount === 0) { this._realX = this._x = this.m.roundX(this._x); this._realY = this._y = this.m.roundY(this._y); }
    }
    updateMove() {
        const dpf = this.distancePerFrame();
        if (this._x < this._realX) { this._realX = Math.max(this._realX - dpf, this._x); }
        if (this._x > this._realX) { this._realX = Math.min(this._realX + dpf, this._x); }
        if (this._y < this._realY) { this._realY = Math.max(this._realY - dpf, this._y); }
        if (this._y > this._realY) { this._realY = Math.min(this._realY + dpf, this._y); }
    }
    updateAnimation() {
        if (this.isMoving() && this.hasWalkAnime()) { this._animationCount += 1.5; }
        else if (this.hasStepAnime() || !this.isOriginalPattern()) { this._animationCount++; }
        if (this._animationCount >= (9 - this.realMoveSpeed()) * 3) {
            if (!this.hasStepAnime() && this._stopCount > 0) { this.resetPattern(); } else { this._pattern = (this._pattern + 1) % 4; }
            this._animationCount = 0;
        }
    }
    // Game_CharacterBase.isNearTheScreen com a câmera centrada no jogador (Game_Player.center/updateScroll)
    isNearTheScreen() {
        const w = this.w, cam = w.camera();
        const gw = w.screenW, gh = w.screenH;
        const sx = this.m.loopH ? mod(this._realX - cam.x, this.m.width) : this._realX - cam.x;
        const sy = this.m.loopV ? mod(this._realY - cam.y, this.m.height) : this._realY - cam.y;
        const px = sx * 48 + 24 - gw / 2, py = sy * 48 + 24 - gh / 2;
        return px >= -gw && px <= gw && py >= -gh && py <= gh;
    }
}

// ---------- evento (Game_Event) ----------
export class SimEvent extends SimChar {
    // data: evento do mapa; opts.pageIndex: página inicial fixa (a página em edição); opts.routeFor: {page, route}
    // troca a rota daquela página pela rota em edição.
    constructor(world, data, { pageIndex, routeFor } = {}) {
        super(world);
        this.data = data;
        this._eventId = data.id;
        this._moveType = 0; this._trigger = null; this._pageIndex = -2;
        this._originalPattern = 1; this._originalDirection = 2; this._prelockDirection = 0; this._locked = false;
        this.routeFor = routeFor || null;
        this.locate(data.x, data.y);
        if (pageIndex !== undefined && pageIndex >= 0 && data.pages[pageIndex]) { this._pageIndex = pageIndex; this.setupPage(); } else { this.refresh(); }
    }
    eventId() { return this._eventId; }
    event() { return this.data; }
    page() { return this.data.pages[this._pageIndex]; }
    isCollidedWithCharacters(x, y) { return super.isCollidedWithCharacters(x, y) || this.isCollidedWithPlayerCharacters(x, y); }
    isCollidedWithEvents(x, y) { return this.m.eventsXyNt(x, y).length > 0; }
    isCollidedWithPlayerCharacters(x, y) { return this.isNormalPriority() && this.w.player.isCollided(x, y); }
    isOriginalPattern() { return this.pattern() === this._originalPattern; }
    resetPattern() { this.setPattern(this._originalPattern); }
    locate(x, y) { super.locate(x, y); this._prelockDirection = 0; }
    forceMoveRoute(r) { super.forceMoveRoute(r); this._prelockDirection = 0; }
    lock() { if (!this._locked) { this._prelockDirection = this.direction(); this.turnTowardPlayer(); this._locked = true; } }
    refresh() {
        const i = findProperPageIndex(this.data, this.m.mapId, this.w.state, this.w.system);
        if (this._pageIndex !== i) { this._pageIndex = i; this.setupPage(); }
    }
    setupPage() { if (this._pageIndex >= 0) { this.setupPageSettings(); } else { this.clearPageSettings(); } }
    clearPageSettings() { this.setImage("", 0); this._moveType = 0; this._trigger = null; this.setThrough(true); }
    setupPageSettings() {
        const page = this.page(), image = page.image || {};
        if (image.tileId > 0) { this.setTileImage(image.tileId); } else { this.setImage(image.characterName, image.characterIndex); }
        if (this._originalDirection !== image.direction) {
            this._originalDirection = image.direction; this._prelockDirection = 0;
            this.setDirectionFix(false); this.setDirection(image.direction);
        }
        if (this._originalPattern !== image.pattern) { this._originalPattern = image.pattern; this.setPattern(image.pattern); }
        this.setMoveSpeed(page.moveSpeed);
        this.setMoveFrequency(page.moveFrequency);
        this.setPriorityType(page.priorityType);
        this.setWalkAnime(page.walkAnime);
        this.setStepAnime(page.stepAnime);
        this.setDirectionFix(page.directionFix);
        this.setThrough(page.through);
        const rf = this.routeFor;
        this.setMoveRoute(rf && rf.page === this._pageIndex ? rf.route : page.moveRoute);
        this._moveType = page.moveType;
        this._trigger = page.trigger;
    }
    updateStop() {
        if (this._locked) { this.resetStopCount(); }
        super.updateStop();
        if (!this.isMoveRouteForcing()) { this.updateSelfMovement(); }
    }
    updateSelfMovement() {
        if (!this._locked && this.isNearTheScreen() && this._stopCount > 30 * (5 - this.moveFrequency())) {
            switch (this._moveType) {
                case 1: this.moveTypeRandom(); break;
                case 2: this.moveTypeTowardPlayer(); break;
                case 3: this.updateRoutineMove(); break;
            }
        }
    }
    moveTypeRandom() {
        switch (this.w.rand.randomInt(6)) {
            case 0: case 1: this.moveRandom(); break;
            case 2: case 3: case 4: this.moveForward(); break;
            case 5: this.resetStopCount(); break;
        }
    }
    moveTypeTowardPlayer() {
        const p = this.gamePlayer();
        if (Math.abs(this.deltaXFrom(p.x)) + Math.abs(this.deltaYFrom(p.y)) < 20) {
            switch (this.w.rand.randomInt(6)) {
                case 0: case 1: case 2: case 3: this.moveTowardPlayer(); break;
                case 4: this.moveRandom(); break;
                case 5: this.moveForward(); break;
            }
        } else { this.moveRandom(); }
    }
}

// ---------- jogador e seguidores (Game_Player / Game_Follower / Game_Followers) ----------
export class SimPlayer extends SimChar {
    constructor(world, x, y, d, leader) {
        super(world);
        this.isPlayer = true;
        this.followers = [];
        this.setTransparent(!!world.system.optTransparent); // Game_Player.initMembers
        if (leader) { this.setImage(leader.characterName, leader.characterIndex); }
        this.locate(x, y);
        this.setDirection(d || 2);
    }
    isCollided(x, y) { return !this.isThrough() && (this.pos(x, y) || this.followers.some(f => f.visible && f.pos(x, y))); }
    moveStraight(d) { if (this.canPass(this.x, this.y, d)) { this.updateFollowersMove(); } super.moveStraight(d); }
    moveDiagonally(h, v) { if (this.canPassDiagonally(this.x, this.y, h, v)) { this.updateFollowersMove(); } super.moveDiagonally(h, v); }
    jump(x, y) {
        super.jump(x, y);
        for (const f of this.followers) { f.jump(this.deltaXFrom(f.x), this.deltaYFrom(f.y)); } // jumpAll
    }
    updateFollowersMove() { for (let i = this.followers.length - 1; i >= 0; i--) { this.followers[i].chaseCharacter(i > 0 ? this.followers[i - 1] : this); } }
    locate(x, y) { super.locate(x, y); for (const f of this.followers) { f.locate(x, y); f.setDirection(this.direction()); } }
    update() { super.update(); for (const f of this.followers) { f.update(); } }
}
export class SimFollower extends SimChar {
    constructor(world, player, actor) {
        super(world);
        this.player = player;
        this.visible = !!actor;
        this.setTransparent(!!world.system.optTransparent);
        this.setThrough(true);
        if (actor) { this.setImage(actor.characterName, actor.characterIndex); }
        this.copyPosition(player);
    }
    chaseCharacter(c) {
        const sx = this.deltaXFrom(c.x), sy = this.deltaYFrom(c.y);
        if (sx !== 0 && sy !== 0) { this.moveDiagonally(sx > 0 ? 4 : 6, sy > 0 ? 8 : 2); }
        else if (sx !== 0) { this.moveStraight(sx > 0 ? 4 : 6); }
        else if (sy !== 0) { this.moveStraight(sy > 0 ? 8 : 2); }
        this.setMoveSpeed(this.player.realMoveSpeed());
    }
    update() {
        super.update();
        const p = this.player;
        this.setMoveSpeed(p.realMoveSpeed()); this.setOpacity(p.opacity()); this.setBlendMode(p.blendMode());
        this.setWalkAnime(p.hasWalkAnime()); this.setStepAnime(p.hasStepAnime()); this.setDirectionFix(p.isDirectionFixed()); this.setTransparent(p.isTransparent());
    }
}
class SimVehicle extends SimChar {
    constructor(world, kind, v) {
        super(world);
        this.kind = kind;
        this.onMap = v.startMapId === world.map.mapId;
        this.setImage(v.characterName, v.characterIndex);
        this.setPosition(v.startX, v.startY);
        this.setPriorityType(kind === "airship" ? 0 : 1);
        this.setWalkAnime(false); this.setStepAnime(false);
        this._direction = 4; // Game_Vehicle.resetDirection
    }
    pos(x, y) { return this.onMap && super.pos(x, y); } // Game_Vehicle.pos
}

// ---------- mundo ----------
// opts: { map, flags, mapId, events, system, actors, seed,
//   main: { kind: "event"|"player", id, start, route, forced, pageIndex, data },  // personagem da rota em edição
//   player: {x, y, d} | null (posição de referência quando a rota não é do jogador),
//   ownerId: evento que executa o Set Movement Route (fica "travado" se o gatilho for 0–2) }
export class SimWorld {
    constructor(o) {
        this.map = new SimMap({ map: o.map, flags: o.flags, mapId: o.mapId });
        this.map.world = this;
        this.system = o.system || {};
        this.rand = rng(o.seed || 1);
        this.frame = 0;
        this.sw = []; this.vars = []; this.self = {};
        this.state = { sw: id => !!this.sw[id], vr: id => this.vars[id] || 0, self: k => this.self[k] === true, item: () => false };
        this._needsRefresh = false;
        const adv = this.system.advanced || {};
        this.screenW = adv.screenWidth || 816; this.screenH = adv.screenHeight || 624;
        this.scripts = { ran: 0, errors: [] };
        this.switchLog = [];
        const main = o.main || {};
        const actors = o.actors || [];
        const party = (this.system.partyMembers || []).map(id => actors[id]).filter(Boolean).slice(0, 4);
        // jogador: na rota do jogador, parte do início; senão, na posição de referência (ou fora do mapa)
        const pStart = main.kind === "player" ? main.start : o.player;
        this.player = new SimPlayer(this, pStart ? pStart.x : -100, pStart ? pStart.y : -100, pStart ? (pStart.d || 2) : 2, party[0]);
        this.playerOnMap = !!pStart;
        if (this.system.optFollowers && this.playerOnMap) {
            for (let i = 1; i < 4; i++) { this.player.followers.push(new SimFollower(this, this.player, party[i])); }
        }
        // veículos
        this.vehicles = [];
        for (const k of ["boat", "ship", "airship"]) {
            const v = this.system[k];
            if (v) { this.vehicles.push(new SimVehicle(this, k, v)); }
        }
        // eventos
        this.events = [];
        for (const ev of o.events || []) {
            if (!ev) { continue; }
            const isMain = main.kind === "event" && ev.id === main.id;
            const data = isMain && main.data ? main.data : ev;
            const opts = isMain ? { pageIndex: main.pageIndex, routeFor: main.forced ? null : { page: main.pageIndex, route: main.route } } : {};
            this.events.push(new SimEvent(this, data, opts));
        }
        if (main.kind === "event" && !this.events.some(e => e._eventId === main.id) && main.data) {
            this.events.push(new SimEvent(this, main.data, { pageIndex: main.pageIndex, routeFor: main.forced ? null : { page: main.pageIndex, route: main.route } }));
            this.events.sort((a, b) => a._eventId - b._eventId);
        }
        this.refreshTileEvents();
        // personagem principal
        this.main = main.kind === "player" ? this.player : this.events.find(e => e._eventId === main.id) || null;
        if (this.main) {
            const ch = this.main, st = main.start || {};
            // propriedades da página em edição (velocidade, Through…), como a prévia antiga
            if (st.x !== undefined) { ch.locate(st.x, st.y); }
            if (st.d) { ch._direction = st.d; }
            if (st.moveSpeed) { ch.setMoveSpeed(st.moveSpeed); }
            if (st.moveFrequency) { ch.setMoveFrequency(st.moveFrequency); }
            if (st.through !== undefined) { ch.setThrough(st.through); }
            if (st.priorityType !== undefined) { ch.setPriorityType(st.priorityType); }
            if (st.directionFix !== undefined) { ch.setDirectionFix(st.directionFix); }
            ch.log = [];
            if (main.forced) {
                // Game_Interpreter.command205: o evento que roda o comando fica travado (gatilho 0–2: lock)
                const owner = this.events.find(e => e._eventId === o.ownerId);
                if (owner && owner._pageIndex >= 0 && [0, 1, 2].includes(owner._trigger) && this.playerOnMap) { owner.lock(); }
                ch.forceMoveRoute(main.route);
            } else if (ch._moveType !== 3) {
                ch._moveType = 3; ch.setMoveRoute(main.route);
            }
        }
    }
    refreshTileEvents() { this.tileEvents = this.events.filter(e => e.isTile()); }
    setSwitch(id, v) { this.sw[id] = !!v; this.switchLog.push({ frame: this.frame, id, v: !!v }); this._needsRefresh = true; }
    requestRefresh() { this._needsRefresh = true; }
    refreshIfNeeded() {
        if (!this._needsRefresh) { return; }
        for (const e of this.events) { e.refresh(); }
        this.refreshTileEvents();
        this._needsRefresh = false;
    }
    // canto superior esquerdo da tela (Game_Map.displayX/Y), seguindo o jogador
    camera() {
        const m = this.map, p = this.player;
        const stx = Math.round(this.screenW / 48 * 16) / 16, sty = Math.round(this.screenH / 48 * 16) / 16;
        const cx = (stx - 1) / 2, cy = (sty - 1) / 2;
        const clamp = (v, end) => (end < 0 ? end / 2 : Math.max(0, Math.min(end, v)));
        const px = this.playerOnMap ? p._realX : m.width / 2, py = this.playerOnMap ? p._realY : m.height / 2;
        return { x: m.loopH ? px - cx : clamp(px - cx, m.width - stx), y: m.loopV ? py - cy : clamp(py - cy, m.height - sty) };
    }
    // Um quadro: Game_Map.update (refreshIfNeeded, eventos) e Game_Player.update (+ seguidores)
    update() {
        this.frame++;
        this.refreshIfNeeded();
        for (const e of this.events) { e.update(); }
        if (this.playerOnMap) { this.player.update(); }
    }
    // Script (45): eval com this = personagem, num estado simulado. Devolve a mensagem de erro ou null.
    runScript(ch, code) {
        this.scripts.ran++;
        try {
            const g = this.globals();
            const fn = new Function(...Object.keys(g), String(code || ""));
            fn.call(this.proxy(ch), ...Object.values(g));
            return null;
        } catch (e) {
            const msg = String((e && e.message) || e);
            this.scripts.errors.push({ frame: this.frame, msg });
            return msg;
        }
    }
    proxy(ch) {
        if (!ch) { return INERT; }
        if (!this._proxies) { this._proxies = new Map(); }
        if (!this._proxies.has(ch)) {
            this._proxies.set(ch, new Proxy(ch, {
                get: (t, k) => { const v = t[k]; if (typeof v === "function") { return v.bind(t); } return v === undefined && typeof k === "string" && !k.startsWith("_") ? INERT : v; },
                set: (t, k, v) => { t[k] = v; return true; }
            }));
        }
        return this._proxies.get(ch);
    }
    globals() {
        if (this._globals) { return this._globals; }
        const w = this, m = this.map;
        const sw = { value: id => !!w.sw[id], setValue: (id, v) => w.setSwitch(id, v) };
        const vr = { value: id => w.vars[id] || 0, setValue: (id, v) => { w.vars[id] = typeof v === "number" ? Math.floor(v) : v; w.requestRefresh(); } };
        const ss = { value: k => w.self[[].concat(k).join()] === true, setValue: (k, v) => { w.self[[].concat(k).join()] = !!v; w.requestRefresh(); } };
        const gm = new Proxy({
            mapId: () => m.mapId, width: () => m.width, height: () => m.height,
            events: () => w.events.map(e => w.proxy(e)), event: id => w.proxy(w.events.find(e => e._eventId === id)),
            eventsXy: (x, y) => m.eventsXy(x, y).map(e => w.proxy(e)), eventsXyNt: (x, y) => m.eventsXyNt(x, y).map(e => w.proxy(e)),
            eventIdXy: (x, y) => { const l = m.eventsXy(x, y); return l.length ? l[0]._eventId : 0; },
            isPassable: (x, y, d) => m.isPassable(x, y, d), isValid: (x, y) => m.isValid(x, y), roundX: x => m.roundX(x), roundY: y => m.roundY(y),
            roundXWithDirection: (x, d) => m.roundXWithDirection(x, d), roundYWithDirection: (y, d) => m.roundYWithDirection(y, d),
            deltaX: (a, b) => m.deltaX(a, b), deltaY: (a, b) => m.deltaY(a, b), tileId: (x, y, z) => m.tileId(x, y, z),
            requestRefresh: () => w.requestRefresh(), refresh: () => { w._needsRefresh = true; w.refreshIfNeeded(); }
        }, { get: (t, k) => (k in t ? t[k] : INERT) });
        this._globals = {
            $gameSwitches: sw, $gameVariables: vr, $gameSelfSwitches: ss, $gameMap: gm, $gamePlayer: this.proxy(this.player),
            $gameParty: INERT, $gameActors: INERT, $gameTemp: INERT, $gameSystem: INERT, $gameScreen: INERT, $gameTimer: INERT,
            $gameMessage: INERT, $gameTroop: INERT, AudioManager: INERT, SoundManager: INERT, SceneManager: INERT,
            BattleManager: INERT, $dataMap: { ...m.map }, $dataSystem: this.system
        };
        return this._globals;
    }
}
// Objeto inerte para tudo o que a prévia não simula ($gameParty, AudioManager, requestBalloon…).
const INERT = new Proxy(function () {}, {
    get: (t, k) => (k === Symbol.toPrimitive ? () => 0 : k === "then" ? undefined : INERT),
    apply: () => INERT, construct: () => INERT, set: () => true
});

// Roda o mundo até a rota acabar (ou uma volta completa com Repeat, ou até travar sem "Skip If Cannot Move").
// Devolve {log, frames, stuck, ended, char, world}.
export function runRoute(world, route, { maxFrames = 60 * 600 } = {}) {
    const ch = world.main;
    let stuck = false, lastFail = -1, fails = 0;
    const n = route.list.length;
    while (world.frame < maxFrames) {
        const before = ch.log.length;
        world.update();
        if (ch.ended && ch.isStopping()) { break; }
        if (ch.log.length > before) {
            const e = ch.log[ch.log.length - 1];
            if (!e.ok && !route.skippable && e.code !== 0) {
                fails = lastFail === e.index ? fails + 1 : 1; lastFail = e.index;
                // mesma tentativa repetida: com outros eventos andando o caminho pode abrir, então espera mais
                if (fails >= (world.events.some(ev => ev !== ch && ev._moveType > 0) ? 60 : 3)) { stuck = true; ch.log.splice(ch.log.length - (fails - 1), fails - 1); break; }
            } else { fails = 0; lastFail = -1; }
            // Repeat: uma volta completa (voltou ao índice 0 depois de passar pelo fim)
            if (route.repeat && e.index === n - 2 && ch._moveRouteIndex === 0) {
                while (!ch.isStopping() && world.frame < maxFrames) { world.update(); }
                break;
            }
            if (route.repeat && n <= 1) { break; }
        }
    }
    // travado: o tempo conta até a primeira tentativa que falhou
    const frames = stuck && ch.log.length ? ch.log[ch.log.length - 1].frame : world.frame;
    return { log: ch.log, frames, stuck, ended: ch.ended, char: ch, world };
}
