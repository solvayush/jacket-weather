'use strict';
// Jacket Weather, chapter 3: "Kimi Panic" (Wall Street, July 2026).
// Content module only: the engine owns the loop, collisions, HUD and dialogue UI.
module.exports = function (THREE, kit) {
  const LENGTH = 800;
  const SPEED = { base: 13, max: 17 };
  const THEME = {
    sky: '#2a0710', fog: '#5e1020', fogNear: 18, fogFar: 120,
    ground: '#2a1c22', road: '#1a1217', laneLine: '#ff3d4a',
    lightColor: '#ff8a78', lightIntensity: 0.9, ambient: '#5c2431'
  };
  // Panic meter tuning; mechanic.summary describes the same numbers in words.
  const PANIC = {
    start: 0, max: 100, risePerSecond: 4, cubeRelief: 12, warnAt: 75, rearmBelow: 50,
    fillPenalty: { stock: -10 }, maxSpeedBonus: 2, speedCap: SPEED.max,
    tintColor: '#ff1a2a', maxTint: 0.6
  };
  const FOG = new THREE.Color(THEME.fog);
  const SKY = new THREE.Color(THEME.sky);
  const RED = new THREE.Color(PANIC.tintColor);

  // ---------- shared materials ----------
  const lambert = (color, extra) => new THREE.MeshLambertMaterial(Object.assign({ color, flatShading: true }, extra || {}));
  const glow = (color, strength) => lambert(color, { emissive: color, emissiveIntensity: strength });
  const M = {
    towerA: lambert('#3b2530'), towerB: lambert('#2c2333'), roof: lambert('#1e1519'), stone: lambert('#5a4650'),
    windowLit: glow('#ffb35c', 0.7), lobby: glow('#ff9a5a', 0.5), tickerFrame: lambert('#0c0809'),
    beacon: glow('#ff2232', 1), steel: lambert('#6a6470'), darkSteel: lambert('#2b282e'),
    signRed: lambert('#d61f2e'), redLight: glow('#ff2a3a', 0.9), amberBulb: glow('#ffc24a', 1), lampGlow: glow('#ff5a3c', 1),
    bronze: lambert('#a8702c'), brass: lambert('#e3b23c'), marble: lambert('#e8dfd2'), marbleShade: lambert('#c9bcaa'),
    paper: lambert('#f3ecdc'), paperShade: lambert('#d8cdb4'), binderRed: lambert('#c3283a'), binderBlue: lambert('#2b4fb8'),
    leather: lambert('#6b3a1f'), leatherDark: lambert('#3e2213'), asphalt: lambert('#3a3136'),
    kiosk: lambert('#1f5c4c'), awning: lambert('#c9232f'), wood: lambert('#7b4b2b'),
    booth: lambert('#2346c4'), glass: lambert('#a6dcff', { transparent: true, opacity: 0.45 }), black: lambert('#0b0a0d'),
    van: lambert('#ece8ef'), tyre: lambert('#151316'), dish: lambert('#d9d9e0'), white: lambert('#f6f3ee'),
    plant: lambert('#2f8a4a'), pot: lambert('#9a4a2a'), stressBall: lambert('#ffd23a'), sweat: glow('#8fd8ff', 0.5),
    cubeShell: lambert('#3fe9ff', { emissive: '#19c4ff', emissiveIntensity: 0.8, transparent: true, opacity: 0.8 }),
    cubeCore: glow('#e8fdff', 1), cubeFace: lambert('#0a2636'), cubeCheek: glow('#ff8bd6', 0.6), sparkle: glow('#b8fff4', 1)
  };

  // ---------- helpers ----------
  const geoCache = new Map();
  function geo(kind, a, b, c, d) {
    const key = [kind, a, b, c, d].map(v => (typeof v === 'number' ? v.toFixed(3) : v)).join('|');
    let g = geoCache.get(key);
    if (!g) {
      if (kind === 'box') g = new THREE.BoxGeometry(a, b, c);
      else if (kind === 'cyl') g = new THREE.CylinderGeometry(a, b, c, d);
      else if (kind === 'cone') g = new THREE.ConeGeometry(a, b, c);
      else g = new THREE.SphereGeometry(a, 10, 8);
      geoCache.set(key, g);
    }
    return g;
  }
  function add(p, geometry, mat, x, y, z) {
    const m = new THREE.Mesh(geometry, mat);
    m.position.set(x, y, z);
    p.add(m);
    return m;
  }
  // Positions are the mesh centre.
  const box = (p, w, h, d, mat, x, y, z) => add(p, geo('box', w, h, d), mat, x, y, z);
  const cyl = (p, rt, rb, h, mat, x, y, z, seg) => add(p, geo('cyl', rt, rb, h, seg || 10), mat, x, y, z);
  const cone = (p, r, h, mat, x, y, z, seg) => add(p, geo('cone', r, h, seg || 8), mat, x, y, z);
  const ball = (p, r, mat, x, y, z) => add(p, geo('ball', r), mat, x, y, z);
  function text(p, str, w, h, bg, fg, x, y, z) {
    const m = kit.textPlane(str, { w, h, bg, fg });
    m.position.set(x, y, z);
    p.add(m);
    return m;
  }
  function person(p, look, x, z, turn) {
    const g = kit.person(look);
    g.position.set(x, 0, z);
    g.rotation.y = turn || 0;
    p.add(g);
    return g;
  }
  function segment(p, a, b, thick, mat, z) {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const m = box(p, Math.hypot(dx, dy) + thick, thick, thick, mat, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, z);
    m.rotation.z = Math.atan2(dy, dx);
    return m;
  }
  // Move the origin to the footprint centre; also drop to the ground unless keepHeight.
  function settle(g, keepHeight) {
    const b = new THREE.Box3().setFromObject(g);
    const cx = (b.min.x + b.max.x) / 2, cz = (b.min.z + b.max.z) / 2, cy = keepHeight ? 0 : b.min.y;
    for (const c of g.children) { c.position.x -= cx; c.position.y -= cy; c.position.z -= cz; }
    return g;
  }
  const rngOf = rng => (typeof rng === 'function' ? rng : Math.random);
  const pick = (r, list) => list[Math.min(list.length - 1, Math.floor(r() * list.length))];
  const TICKERS = ['CHIPZ', 'FLOPS', 'WAFFL', 'TOKNZ', 'SILIC', 'GPUZ', 'MEMRY'];
  function tickerLine(r, count) {
    const parts = [];
    for (let i = 0; i < count; i++) parts.push(pick(r, TICKERS) + ' \u25BC' + (2 + r() * 12).toFixed(1) + '%');
    return parts.join('   ');
  }

  // ---------- scenery ----------
  function buildTickerTower(rng) {
    const r = rngOf(rng), g = new THREE.Group();
    const w = 8 + Math.round(r() * 4) * 0.5, h = 12 + Math.round(r() * 8), d = 8;
    box(g, w, h, d, r() < 0.5 ? M.towerA : M.towerB, 0, h / 2, 0);
    box(g, 2.6, 3, 0.2, M.lobby, 0, 1.5, d / 2 + 0.1);
    box(g, w + 0.3, 1.3, d + 0.3, M.tickerFrame, 0, 4.4, 0);
    text(g, tickerLine(r, 2), w * 0.95, 0.9, '#120307', '#ff3344', 0, 4.4, d / 2 + 0.16);
    const bands = Math.max(1, Math.min(6, Math.floor((h - 8) / 2.2) + 1));
    for (let i = 0; i < bands; i++) box(g, w * 0.84, 0.7, 0.1, M.windowLit, 0, 6.8 + i * 2.2, d / 2 + 0.05);
    box(g, w * 0.4, 1.2, d * 0.4, M.roof, 0, h + 0.6, 0);
    cyl(g, 0.06, 0.06, 3, M.steel, 0, h + 2.7, 0, 6);
    ball(g, 0.22, M.beacon, 0, h + 4.3, 0);
    return settle(g);
  }
  const BOARD_HEADS = ['CHIPS \u25BC12.5%', 'KIMI K3: FREE!', 'PANIC INDEX \u25B2', 'SELL SELL SELL', 'GPUS \u25BC WHY?'];
  function buildTickerBoard(rng) {
    const r = rngOf(rng), g = new THREE.Group();
    for (const x of [-2, 2]) cyl(g, 0.15, 0.18, 3.2, M.darkSteel, x, 1.6, 0, 8);
    box(g, 5, 2.6, 0.3, M.tickerFrame, 0, 4.4, 0);
    text(g, pick(r, BOARD_HEADS), 4.6, 1.0, '#140308', '#ff3344', 0, 4.95, 0.16);
    text(g, tickerLine(r, 2), 4.6, 0.45, '#140308', '#ffb03a', 0, 4.05, 0.16);
    text(g, tickerLine(r, 2), 4.6, 0.45, '#140308', '#ff5566', 0, 3.45, 0.16);
    cone(g, 0.45, 0.9, M.redLight, 0, 6.15, 0, 4).rotation.z = Math.PI; // big arrow pointing down at the board
    box(g, 0.3, 0.7, 0.3, M.redLight, 0, 6.95, 0);
    return settle(g);
  }
  const SKINS = ['#f1c9a5', '#d9a27a', '#b07a52', '#7c4a2e', '#f6dcc6'];
  const HAIRS = ['#1b1410', '#4a2e1a', '#a09080', '#d6b06a', '#2a2a2a'];
  const SUITS = ['#1e2a46', '#3a3f4a', '#2a2a30', '#4a2430', '#20384a'];
  const SHOUTS = ['SELL!!', 'WHY?!', 'MY CHIPS!', 'BUY? NO!', 'HOLD ME'];
  function buildPanicTraders(rng) {
    const r = rngOf(rng), g = new THREE.Group();
    person(g, { skin: pick(r, SKINS), hair: pick(r, HAIRS), top: pick(r, SUITS), bottom: '#1a1a20', accessory: 'tie' }, -0.75, 0, 0.5);
    person(g, { skin: pick(r, SKINS), hair: pick(r, HAIRS), top: pick(r, SUITS), bottom: '#22222a', accessory: 'glasses' }, 0.8, -0.3, -0.6);
    box(g, 0.08, 0.16, 0.04, M.black, -0.55, 1.62, 0.12); // phone at the ear
    text(g, pick(r, SHOUTS), 1.3, 0.5, '#fff4e0', '#d61f2e', -0.75, 2.45, 0.1);
    for (let i = 0; i < 4; i++) { // flying paperwork
      box(g, 0.3, 0.01, 0.4, M.paper, (r() - 0.5) * 2.2, 1.9 + r(), (r() - 0.5) * 0.8)
        .rotation.set(r() * 1.2 - 0.6, r() * Math.PI, r() * 1.2 - 0.6);
    }
    cyl(g, 0.05, 0.04, 0.12, M.white, 0.2, 0.06, 0.4, 8); // dropped coffee
    return settle(g);
  }
  const HEADLINES = ['KIMI PANIC!', 'CHIPS -12.5%', 'FREE AI?!', 'BEAR HUGS', 'SELL? HOLD?', 'JACKET SEEN'];
  function buildNewsStand(rng) {
    const r = rngOf(rng), g = new THREE.Group();
    box(g, 2.2, 2.1, 1.4, M.kiosk, 0, 1.05, 0);
    box(g, 2.4, 0.12, 0.5, M.wood, 0, 1.0, 0.9);
    box(g, 2.6, 0.1, 1.1, M.awning, 0, 2.3, 0.75).rotation.x = 0.28;
    text(g, 'NEWS', 1.4, 0.4, '#c9232f', '#fff4e0', 0, 2.75, 0.2);
    text(g, pick(r, HEADLINES), 0.95, 0.65, '#fff8e8', '#16161a', -0.55, 1.55, 0.71);
    text(g, pick(r, HEADLINES), 0.95, 0.65, '#fff8e8', '#c9232f', 0.55, 1.55, 0.71);
    for (let i = -1; i <= 1; i++) {
      const h = 0.18 + Math.round(r() * 4) * 0.03;
      box(g, 0.5, h, 0.35, M.paper, i * 0.75, 1.06 + h / 2, 0.9);
    }
    return settle(g);
  }
  function buildLamp() {
    const g = new THREE.Group();
    cyl(g, 0.22, 0.28, 0.4, M.darkSteel, 0, 0.2, 0, 8);
    cyl(g, 0.08, 0.1, 4.6, M.darkSteel, 0, 2.5, 0, 8);
    box(g, 1.4, 0.1, 0.1, M.darkSteel, 0, 4.8, 0);
    for (const s of [-1, 1]) {
      box(g, 0.42, 0.16, 0.32, M.roof, s * 0.62, 4.7, 0);
      box(g, 0.32, 0.05, 0.24, M.lampGlow, s * 0.62, 4.6, 0);
    }
    return settle(g);
  }
  function buildBull() {
    const g = new THREE.Group();
    box(g, 3.2, 1.0, 1.8, M.marble, 0, 0.5, 0);
    text(g, 'STAY BULLISH?', 2.2, 0.42, '#e8dfd2', '#5a3a1a', 0, 0.5, 0.91);
    box(g, 2.0, 0.9, 0.9, M.bronze, -0.1, 1.95, 0);
    for (const [x, z] of [[-0.85, -0.3], [-0.85, 0.3], [0.65, -0.3], [0.65, 0.3]]) box(g, 0.2, 0.55, 0.2, M.bronze, x, 1.275, z);
    box(g, 0.6, 0.55, 0.6, M.bronze, 1.1, 2.05, 0); // head low: a nervous bull
    for (const s of [-1, 1]) cone(g, 0.07, 0.42, M.brass, 1.15, 2.45, s * 0.28, 6).rotation.x = s * 0.6;
    box(g, 0.06, 0.6, 0.06, M.bronze, -1.15, 2.05, 0).rotation.z = -0.4; // tail tucked
    ball(g, 0.1, M.sweat, 1.45, 2.5, 0.25);
    return settle(g);
  }

  // ---------- obstacles ----------
  function buildBriefcases() {
    const g = new THREE.Group();
    box(g, 0.9, 0.22, 0.6, M.leather, -0.3, 0.11, 0);
    box(g, 0.85, 0.2, 0.55, M.leatherDark, -0.2, 0.32, 0.02).rotation.y = 0.35;
    box(g, 0.85, 0.6, 0.22, M.leather, 0.45, 0.3, 0.05).rotation.y = -0.2;
    box(g, 0.26, 0.06, 0.05, M.leatherDark, 0.45, 0.63, 0.05).rotation.y = -0.2;
    for (const x of [-0.5, -0.1]) box(g, 0.08, 0.05, 0.02, M.brass, x, 0.15, 0.31);
    box(g, 0.32, 0.01, 0.42, M.paper, -0.2, 0.005, 0.5).rotation.y = 0.5;
    box(g, 0.32, 0.01, 0.42, M.paper, 0.5, 0.005, 0.42).rotation.y = -0.3;
    return settle(g);
  }
  function buildReports() {
    const g = new THREE.Group();
    for (const [x, h, rot, mat] of [[-0.5, 0.34, 0.1, M.paper], [0.05, 0.48, -0.15, M.paperShade], [0.55, 0.24, 0.3, M.paper]]) {
      box(g, 0.52, h, 0.4, mat, x, h / 2, 0).rotation.y = rot;
      box(g, 0.54, 0.03, 0.42, x > 0 ? M.binderBlue : M.binderRed, x, h + 0.015, 0).rotation.y = rot;
    }
    text(g, 'DOWNGRADE', 0.7, 0.18, '#c3283a', '#ffffff', 0.05, 0.3, 0.26);
    for (let i = 0; i < 3; i++) box(g, 0.3, 0.01, 0.4, M.paper, -0.55 + i * 0.55, 0.005, 0.45).rotation.y = 0.4 * (i - 1) + 0.2;
    return settle(g);
  }
  function buildMinusBanner() {
    const g = new THREE.Group();
    box(g, 1.9, 0.06, 0.08, M.darkSteel, 0, 1.23, 0); // weighted hem: underside at 1.2 m
    box(g, 1.9, 0.72, 0.05, M.signRed, 0, 1.62, 0);
    text(g, '-12.5%', 1.5, 0.56, '#d61f2e', '#fff4d0', 0, 1.62, 0.03);
    cyl(g, 0.04, 0.04, 1.94, M.steel, 0, 2.0, 0, 6).rotation.z = Math.PI / 2;
    for (const s of [-1, 1]) cyl(g, 0.012, 0.012, 1.6, M.steel, s * 0.85, 2.82, 0, 4);
    box(g, 1.9, 0.12, 0.12, M.darkSteel, 0, 3.68, 0);
    for (const s of [-1, 1]) ball(g, 0.07, M.redLight, s * 0.6, 3.55, 0.07);
    return settle(g, true);
  }
  function buildSellSign() {
    const g = new THREE.Group(), sign = new THREE.Group();
    sign.rotation.y = 0.1; // landed slightly askew
    g.add(sign);
    // Solid crate under the panel, so there is no gap at the bottom: it reads as a wall, not a slide-under banner.
    box(sign, 1.5, 0.8, 0.5, M.wood, 0, 0.4, 0);
    for (const y of [0.15, 0.65]) box(sign, 1.52, 0.08, 0.52, M.leatherDark, 0, y, 0);
    text(sign, 'SELL ORDERS', 1.1, 0.24, '#7b4b2b', '#fff4d0', 0, 0.4, 0.26);
    box(sign, 1.55, 1.0, 0.12, M.signRed, 0, 1.3, 0);
    text(sign, 'SELL', 1.25, 0.66, '#d61f2e', '#fff4d0', 0, 1.3, 0.07);
    for (const x of [-0.62, 0, 0.62]) { ball(sign, 0.05, M.amberBulb, x, 1.72, 0.08); ball(sign, 0.05, M.amberBulb, x, 0.88, 0.08); }
    for (const [x, rot] of [[-0.55, 0.4], [0.1, -0.3], [0.55, 0.9]]) box(g, 0.32, 0.12, 0.26, M.asphalt, x, 0.06, 0.48).rotation.y = rot;
    return settle(g);
  }
  function buildTerminal() {
    const g = new THREE.Group();
    box(g, 1.4, 0.08, 0.7, M.steel, 0, 0.36, 0);
    box(g, 1.3, 0.05, 0.6, M.darkSteel, 0, 0.17, 0);
    for (const x of [-0.66, 0.66]) box(g, 0.05, 0.26, 0.62, M.darkSteel, x, 0.2, 0);
    for (const x of [-0.6, 0.6]) for (const z of [-0.26, 0.26]) ball(g, 0.07, M.black, x, 0.07, z);
    box(g, 1.1, 0.05, 0.1, M.darkSteel, 0, 0.425, -0.12);
    ['\u25BC\u25BC\u25BC', 'SELL', '-12.5'].forEach((label, i) => {
      const x = (i - 1) * 0.45, mon = new THREE.Group();
      mon.position.set(x, 0.6, -0.12);
      mon.rotation.y = -x * 0.6;
      g.add(mon);
      box(mon, 0.42, 0.28, 0.05, M.black, 0, 0, 0);
      text(mon, label, 0.36, 0.22, '#1a0306', '#ff3344', 0, 0, 0.03);
    });
    box(g, 0.6, 0.03, 0.18, M.darkSteel, 0, 0.415, 0.2);
    ball(g, 0.06, M.redLight, 0.6, 0.46, 0.25); // alarm light
    return settle(g);
  }
  function buildMarginBooth() {
    const g = new THREE.Group();
    box(g, 1.25, 0.12, 1.0, M.darkSteel, 0, 0.06, 0);
    box(g, 1.15, 2.0, 0.9, M.booth, 0, 1.12, 0);
    box(g, 0.24, 0.34, 0.06, M.black, 0, 1.25, 0.48); // payphone
    box(g, 0.85, 1.3, 0.04, M.glass, 0, 1.1, 0.56);
    box(g, 1.3, 0.12, 1.1, M.darkSteel, 0, 2.18, 0);
    text(g, 'MARGIN CALL', 1.05, 0.26, '#0e0e24', '#ffd84a', 0, 1.93, 0.46);
    text(g, 'RING! RING!', 1.1, 0.36, '#ffd84a', '#0e0e24', 0, 2.6, 0.3);
    return settle(g);
  }
  // size is measured from the model so collision data always matches the mesh.
  function obstacle(id, type, weight, build) {
    const b = new THREE.Box3().setFromObject(build());
    const up = v => Math.ceil(v * 100 - 1e-6) / 100;
    const o = { id, type, weight, size: { w: up(b.max.x - b.min.x), h: up(b.max.y), d: up(b.max.z - b.min.z) }, build };
    if (type === 'high') o.clearance = Math.floor(b.min.y * 100 + 1e-6) / 100;
    return o;
  }

  // ---------- collectible ----------
  function buildCube() {
    const g = new THREE.Group(), y = 0.85;
    box(g, 0.46, 0.46, 0.46, M.cubeShell, 0, y, 0);
    box(g, 0.24, 0.24, 0.24, M.cubeCore, 0, y, 0);
    for (const s of [-1, 1]) {
      box(g, 0.06, 0.09, 0.02, M.cubeFace, s * 0.09, y + 0.06, 0.235);
      ball(g, 0.03, M.cubeCheek, s * 0.15, y - 0.04, 0.235);
      box(g, 0.04, 0.025, 0.02, M.cubeFace, s * 0.075, y - 0.07, 0.235).rotation.z = s * 0.6;
      box(g, 0.06, 0.06, 0.06, M.sparkle, s * 0.2, y + 0.33, 0).rotation.z = Math.PI / 4;
    }
    box(g, 0.1, 0.025, 0.02, M.cubeFace, 0, y - 0.09, 0.235); // smile
    return settle(g, true);
  }

  // ---------- landmarks ----------
  function buildTvCrew() {
    const g = new THREE.Group();
    box(g, 2.0, 2.0, 3.6, M.van, 1.3, 1.3, -1.2);
    for (const x of [0.32, 2.28]) for (const z of [-2.4, 0]) cyl(g, 0.35, 0.35, 0.24, M.tyre, x, 0.35, z, 10).rotation.z = Math.PI / 2;
    cyl(g, 0.05, 0.05, 0.6, M.steel, 1.3, 2.6, -2.0, 6);
    cyl(g, 0.65, 0.12, 0.18, M.dish, 1.3, 3.0, -2.0, 12).rotation.x = -0.9;
    text(g, 'LIVE', 1.2, 0.5, '#d61f2e', '#ffffff', 1.3, 1.8, 0.61);
    text(g, 'TICKER TV', 2.6, 0.6, '#2f6bff', '#ffffff', 0.29, 1.5, -1.2).rotation.y = -Math.PI / 2;
    person(g, { look: 'female', skin: '#e9b98f', hair: '#3a2416', top: '#d61f2e', bottom: '#1b1b22', accessory: 'earpiece' }, -0.7, 0.9, -0.6);
    cyl(g, 0.025, 0.025, 0.22, M.black, -0.85, 1.2, 1.15, 6);
    ball(g, 0.05, M.darkSteel, -0.85, 1.33, 1.15);
    person(g, { skin: '#8a5a3a', hair: '#151515', top: '#2f6bff', bottom: '#3a3a40', accessory: 'cap' }, -1.6, 2.2, 2.53);
    box(g, 0.22, 0.24, 0.5, M.black, -1.43, 1.6, 1.95).rotation.y = 2.53; // shoulder camera
    return settle(g);
  }
  function buildFundManager() {
    const g = new THREE.Group();
    box(g, 5.0, 4.0, 0.6, M.stone, 0, 2.0, -1.6);
    box(g, 1.2, 2.3, 0.1, M.glass, 1.2, 1.15, -1.25);
    text(g, 'HEDGE & HOPE CAPITAL', 3.8, 0.5, '#1a1a2c', '#e8c25a', 0, 3.4, -1.28);
    box(g, 1.9, 1.3, 0.06, M.white, -1.4, 1.65, 0.2);
    for (const s of [-1, 1]) box(g, 0.06, 1.2, 0.06, M.wood, -1.4 + s * 0.7, 0.6, 0.25).rotation.z = -s * 0.12;
    text(g, 'MY PORTFOLIO', 1.1, 0.16, '#ffffff', '#1a1a2c', -1.4, 2.2, 0.24);
    const pts = [[-2.2, 2.0], [-1.85, 1.85], [-1.55, 1.92], [-1.15, 1.35], [-0.75, 1.05]];
    for (let i = 0; i < 4; i++) segment(g, pts[i], pts[i + 1], 0.06, M.redLight, 0.25);
    const ang = Math.atan2(pts[4][1] - pts[3][1], pts[4][0] - pts[3][0]);
    cone(g, 0.1, 0.22, M.redLight, -0.75 + Math.cos(ang) * 0.08, 1.05 + Math.sin(ang) * 0.08, 0.25, 6).rotation.z = ang - Math.PI / 2;
    box(g, 1.5, 0.08, 0.45, M.wood, 1.7, 0.46, 0.2);
    for (const s of [-1, 1]) box(g, 0.08, 0.42, 0.4, M.darkSteel, 1.7 + s * 0.6, 0.21, 0.2);
    person(g, { skin: '#f0c8a8', hair: '#8a8a8a', top: '#2c3e66', bottom: '#1c1c24', accessory: 'glasses' }, 0.3, 0.5, 0.5);
    ball(g, 0.08, M.stressBall, 0.65, 1.0, 0.85);
    cyl(g, 0.25, 0.2, 0.5, M.pot, 2.1, 0.25, -1.0, 8);
    ball(g, 0.4, M.plant, 2.1, 0.85, -1.0);
    return settle(g);
  }
  const PEDIMENT = new THREE.CylinderGeometry(1, 1, 1, 3); // triangular prism, apex up, depth along z
  PEDIMENT.rotateX(Math.PI / 2);
  PEDIMENT.rotateZ(Math.PI);
  function buildExchange() {
    const g = new THREE.Group();
    box(g, 7.6, 0.35, 4.6, M.marble, 0, 0.175, 0);
    box(g, 7.0, 0.35, 3.8, M.marbleShade, 0, 0.525, -0.4);
    box(g, 6.6, 3.6, 0.4, M.marbleShade, 0, 2.5, -1.9);
    for (const x of [-2.4, -0.8, 0.8, 2.4]) cyl(g, 0.3, 0.34, 3.6, M.marble, x, 2.5, 0.8, 10);
    box(g, 7.0, 0.6, 3.4, M.marble, 0, 4.6, -0.5);
    add(g, PEDIMENT, M.marble, 0, 4.9 + 0.5 * (1.3 / 1.5), -0.5).scale.set(7.0 / Math.sqrt(3), 1.3 / 1.5, 3.4);
    text(g, 'THE EXCHANGE', 4.6, 0.42, '#e8dfd2', '#4a2a1a', 0, 4.6, 1.21);
    person(g, { skin: '#c48a5f', hair: '#1a1410', top: '#24324f', bottom: '#1a1a22', accessory: 'tie' }, -1.6, 2.9, -0.3);
    person(g, { look: 'female', skin: '#f3d2b5', hair: '#7a3cff', top: '#3fe9ff', bottom: '#2b2b33', accessory: 'headphones' }, 1.5, 2.9, 0.3);
    box(g, 0.05, 0.9, 0.05, M.wood, 1.9, 1.75, 2.98);
    text(g, 'OPEN WEIGHTS!', 1.3, 0.45, '#3fe9ff', '#0a2636', 1.9, 2.4, 3.0);
    return settle(g);
  }

  // ---------- panic meter ----------
  // Cubes are detected two ways: calls to game.addCollect (wrapped in onStart) and a numeric pickup
  // counter, if the engine keeps one. A pickup reported both ways is counted once.
  const COUNTERS = ['collected', 'collects', 'collectCount', 'hero.collected'];
  const CREDIT_SECONDS = 1; // how long an addCollect call can explain a later counter bump
  const cubesIn = n => (Number(n) > 0 ? Number(n) : 1);
  const active = game => !!(game && game.state && game.state.panicChapter === 'ch3');
  function readCounter(game, key) {
    const v = key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), game);
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
  }
  function findCounter(game, s) {
    s.panicCounterKey = COUNTERS.find(k => readCounter(game, k) !== null) || null;
    s.panicCounterLast = s.panicCounterKey ? readCounter(game, s.panicCounterKey) : 0;
  }
  function say(game, line) { if (game && typeof game.say === 'function') game.say(line); }
  function relieve(s, count) {
    s.panic = Math.max(0, s.panic - PANIC.cubeRelief * count);
    s.panicCubes += count;
    if (s.panic < PANIC.rearmBelow) s.panicWarned = false;
  }
  function watchCounter(game, s) {
    if (!s.panicCounterKey) { findCounter(game, s); return; } // first sighting becomes the baseline
    const now = readCounter(game, s.panicCounterKey);
    if (now === null) return;
    const delta = now - s.panicCounterLast;
    s.panicCounterLast = now;
    if (delta <= 0) return; // no pickup, or the engine reset its counter
    const explained = Math.min(delta, s.panicCredit); // already counted through addCollect
    s.panicCredit -= explained;
    if (delta > explained) relieve(s, delta - explained);
  }
  function onStart(game) {
    const s = game.state || (game.state = {});
    Object.assign(s, {
      panicChapter: 'ch3', panic: PANIC.start, panicWarned: false, panicSelloffs: 0, panicCubes: 0,
      panicSpeedBonus: 0, panicAppliedBonus: 0, panicTint: 0, panicTintColor: PANIC.tintColor,
      panicCredit: 0, panicCreditAge: 0, panicLastDistance: Number(game.distance) || 0
    });
    // Wrap addCollect once per game object; a restart reuses the same wrapper.
    if (typeof game.addCollect === 'function' && !game.addCollect.kimiPanic) {
      const engineAddCollect = game.addCollect;
      const wrapped = function (n) {
        if (!active(game)) return engineAddCollect.apply(this, arguments);
        const st = game.state, count = cubesIn(n), key = st.panicCounterKey;
        const before = key ? readCounter(game, key) : null;
        relieve(st, count);
        const result = engineAddCollect.apply(this, arguments);
        // Resync the counter for what this call added; leave a short credit in case the engine bumps it later.
        const after = key ? readCounter(game, key) : null;
        const own = before !== null && after !== null ? Math.min(Math.max(after - before, 0), count) : 0;
        st.panicCounterLast += own;
        st.panicCredit += count - own;
        st.panicCreditAge = 0;
        return result;
      };
      wrapped.kimiPanic = true;
      game.addCollect = wrapped;
    }
    findCounter(game, s); // always watched, even when addCollect exists
    say(game, 'Panic meter rising! Grab model cubes: free AI needs chips.');
  }
  function onUpdate(game, dt) {
    if (!active(game)) return;
    const s = game.state;
    const step = Math.min(Math.max(Number(dt) || 0, 0), 0.1);
    const dist = Number(game.distance) || 0;
    const running = dist > s.panicLastDistance; // false during story stops and pauses
    s.panicLastDistance = dist;
    watchCounter(game, s);
    if (s.panicCredit > 0 && (s.panicCreditAge += step) > CREDIT_SECONDS) s.panicCredit = 0;
    if (running) s.panic += PANIC.risePerSecond * step;
    if (s.panic < PANIC.rearmBelow) s.panicWarned = false;
    if (!s.panicWarned && s.panic >= PANIC.warnAt && s.panic < PANIC.max) {
      s.panicWarned = true;
      say(game, 'Panic at 75%! Grab open-weight cubes!');
    }
    if (s.panic >= PANIC.max) {
      if (game.meters) game.meters.stock = (Number(game.meters.stock) || 0) + PANIC.fillPenalty.stock;
      s.panic = 0;
      s.panicWarned = false;
      s.panicSelloffs += 1;
      say(game, 'PANIC SELL-OFF! Stock -10. Meter reset.');
    }
    // Speed bonus on top of the engine's own speed: remove last frame's bonus, add this frame's.
    s.panicSpeedBonus = PANIC.maxSpeedBonus * s.panic / PANIC.max;
    if (typeof game.speed === 'number') {
      const engineSpeed = game.speed - s.panicAppliedBonus;
      const applied = running && engineSpeed > 0 ? Math.min(s.panicSpeedBonus, Math.max(0, PANIC.speedCap - engineSpeed)) : 0;
      game.speed = Math.max(0, engineSpeed + applied);
      s.panicAppliedBonus = applied;
    }
    s.panicTint = PANIC.maxTint * s.panic / PANIC.max;
    const scene = game.scene;
    if (scene) {
      if (scene.fog && scene.fog.color && scene.fog.color.isColor) scene.fog.color.copy(FOG).lerp(RED, s.panicTint);
      if (scene.background && scene.background.isColor) scene.background.copy(SKY).lerp(RED, s.panicTint);
    }
  }

  return {
    id: 'ch3',
    title: 'Kimi Panic',
    dateline: 'Wall Street, July 2026',
    outfit: 'jacket',
    hideMeters: false,
    length: LENGTH,
    speed: SPEED,
    frontPage: {
      headline: 'KIMI PANIC! CHIPS SINK 12.5%',
      sub: 'Free open-weight Kimi K3 from a Chinese lab spooks traders. A leather jacket is seen jogging toward the exchange.'
    },
    theme: THEME,
    scenery: [
      { id: 'tickerTower', side: 'both', every: 36, offset: 19, build: buildTickerTower },
      { id: 'tickerBoard', side: 'left', every: 70, offset: 11.5, build: buildTickerBoard },
      { id: 'panicTraders', side: 'right', every: 46, offset: 7.5, build: buildPanicTraders },
      { id: 'newsStand', side: 'left', every: 90, offset: 7.6, build: buildNewsStand },
      { id: 'redLamp', side: 'both', every: 24, offset: 6, build: buildLamp },
      { id: 'nervousBull', side: 'right', every: 230, offset: 10.5, build: buildBull }
    ],
    obstacles: [
      obstacle('briefcases', 'low', 3, buildBriefcases),
      obstacle('analystReports', 'low', 2.5, buildReports),
      obstacle('minusBanner', 'high', 2, buildMinusBanner),
      obstacle('sellSign', 'block', 2, buildSellSign),
      obstacle('runawayTerminal', 'mover', 1.5, buildTerminal),
      obstacle('marginCallBooth', 'block', 1, buildMarginBooth)
    ],
    collectible: { name: 'Open-Weight Model Cube', build: buildCube },
    stops: [
      { at: 220, title: 'Live on Ticker TV', landmark: { x: 7, build: buildTvCrew }, dialogueId: 'tv_interview' },
      { at: 480, title: 'The Worried Fund Manager', landmark: { x: -7, build: buildFundManager }, dialogueId: 'fund_manager' },
      { at: LENGTH, title: 'The Exchange Steps', landmark: { x: 8, build: buildExchange }, dialogueId: 'exchange_steps' }
    ],
    dialogues: {
      tv_interview: [
        { speaker: 'Reporter', text: "We're live! Chips down 12.5% in a week. Did Kimi K3 just eat your lunch?" },
        { speaker: 'Jensen', text: 'These Chinese models are excellent.' },
        { speaker: 'Reporter', text: '...Our producer just fainted into a muffin.' },
        { speaker: 'Jensen', text: 'Free AI should be great for hardware. Free AI should be great for chips.' },
        { speaker: 'Camera Op', text: 'He said "chips" twice. Somebody buy something!' }
      ],
      fund_manager: [
        { speaker: 'Fund Manager', text: 'Jensen! My portfolio is 90% chips and 10% antacids. The antacids are winning.' },
        { speaker: 'Jensen', text: 'Relax. Free models are like puppies: free to adopt, very expensive to feed.' },
        { speaker: 'Fund Manager', text: 'So you sell the... kibble?' },
        { speaker: 'Jensen', text: 'Premium kibble. Every glowing cube I grab calms the panic a little.' }
      ],
      exchange_steps: [
        { speaker: 'Investor', text: 'Closing bell in sixty seconds! My spreadsheet is hyperventilating. Say something soothing!' },
        { speaker: 'Open-Model Fan', text: 'Or praise open weights! We made a banner. It took all night.' },
        {
          speaker: 'Jensen', text: 'One jacket, two microphones. Which headline?',
          choices: [
            { text: 'Reassure investors: the panic is overdone.', effects: { stock: 5, board: 9, washington: 6, beijing: -8 }, next: 'exchange_calm' },
            { text: 'Praise open models: free AI needs chips.', effects: { stock: 9, board: -3, washington: -6, beijing: 12 }, next: 'exchange_open' }
          ]
        }
      ],
      exchange_calm: [{ speaker: 'Investor', text: 'The ticker blinked green! I may cry into my briefcase.' }],
      exchange_open: [
        { speaker: 'Open-Model Fan', text: 'Open weights, open hearts!' },
        { speaker: 'Investor', text: 'Free AI needs chips? BUY! BUY!' }
      ]
    },
    mechanic: {
      summary: 'Panic meter, 0 to 100, starts at 0. While the hero is running (distance increasing; never during story stops) ' +
        'it rises 4 points per second. Each open-weight model cube collected lowers it by 12, not below 0, because free AI needs chips. ' +
        'The view reddens with it: fog and sky colours blend from the theme colours toward #ff1a2a by 0.6 x panic/100. ' +
        'Run speed gets +2 m/s x panic/100 on top of the normal speed, never pushing it above speed.max (17 m/s). ' +
        'A warning line shows when it first passes 75 (re-armed once it drops below 50). ' +
        'When it reaches 100: Stock Price -10, a "PANIC SELL-OFF" line shows and the meter resets to 0. ' +
        'The current value is kept in game.state.panic.',
      params: PANIC
    },
    onStart,
    onUpdate,
    endCard: {
      title: 'Panic, Postponed',
      lines: [
        'The closing bell rang and the ticker turned a cautious shade of pink.',
        'Analysts downgraded the panic from "historic" to "brisk".',
        'Lesson of the day: free AI still has to run on something.'
      ]
    }
  };
};
