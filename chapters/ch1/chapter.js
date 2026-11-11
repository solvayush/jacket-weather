/*
 * Jacket Weather, chapter 1: "Thirty Days Left" (Sunnyvale, 1997).
 * A nearly bankrupt chip start-up at night: beige office park, yellow-lit
 * clean rooms, flickering parking-lot lamps. Twist: a cash clock shown as
 * DAYS OF CASH LEFT that wafers top up (see mechanic.summary).
 */
'use strict';

module.exports = function (THREE, kit) {
  // ---------------------------------------------------------------- helpers

  const geoCache = {};
  function cached(key, make) {
    return geoCache[key] || (geoCache[key] = make());
  }
  function box(w, h, d) {
    return cached(`b${w}|${h}|${d}`, () => new THREE.BoxGeometry(w, h, d));
  }
  function cyl(rTop, rBottom, h, seg = 8) {
    return cached(`c${rTop}|${rBottom}|${h}|${seg}`, () => new THREE.CylinderGeometry(rTop, rBottom, h, seg));
  }
  function cone(r, h, seg = 8) {
    return cached(`k${r}|${h}|${seg}`, () => new THREE.ConeGeometry(r, h, seg));
  }
  function ball(r) {
    return cached(`s${r}`, () => new THREE.SphereGeometry(r, 8, 6));
  }

  function lam(color, emissive, emissiveIntensity = 1) {
    const opts = { color, flatShading: true };
    if (emissive) {
      opts.emissive = emissive;
      opts.emissiveIntensity = emissiveIntensity;
    }
    return new THREE.MeshLambertMaterial(opts);
  }

  function part(parent, geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    parent.add(m);
    return m;
  }
  function sign(parent, text, opts, x, y, z) {
    const m = kit.textPlane(text, opts);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }
  function who(parent, look, x, y, z) {
    const p = kit.person(look);
    p.position.set(x, y, z);
    parent.add(p);
    return p;
  }
  // Shift children so the bounding box is centred on x/z and (optionally) sits on y = 0.
  function settle(g, floor = true) {
    const b = new THREE.Box3().setFromObject(g);
    const dx = -(b.min.x + b.max.x) / 2;
    const dz = -(b.min.z + b.max.z) / 2;
    const dy = floor ? -b.min.y : 0;
    g.children.forEach((c) => {
      c.position.x += dx;
      c.position.y += dy;
      c.position.z += dz;
    });
    return g;
  }
  const pick = (rng, list) => list[Math.min(list.length - 1, Math.floor(rng() * list.length))];
  const between = (rng, a, b) => a + (b - a) * rng();
  const r1 = (v) => Math.round(v * 10) / 10;

  // ---------------------------------------------------------------- palette

  const M = {
    beige: lam('#dccba4'),
    beigeDark: lam('#b8a47c'),
    putty: lam('#d4ccb4'),
    glass: lam('#1e2c5e'),
    litWin: lam('#fff3b0', '#ffe98a', 0.9),
    teal: lam('#1f9e95'),
    mauve: lam('#9b5c8f'),
    door: lam('#2b2635'),
    cleanroom: lam('#ffcf3a', '#ffb000', 0.8),
    concrete: lam('#a29e94'),
    darkMetal: lam('#3a3e4a'),
    metal: lam('#9aa2ae'),
    lamp: lam('#55584f', '#eaffd6', 1),
    lampBad: lam('#55584f', '#eaffd6', 1), // flickers, see animate()
    pool: lam('#6e6a8e', '#2c2c40', 1),
    poolBad: lam('#6e6a8e', '#2c2c40', 1), // flickers with lampBad
    trunk: lam('#8a6a45'),
    leaf: lam('#2f9a52'),
    leaf2: lam('#3fb866'),
    coconut: lam('#6b4a2a'),
    planter: lam('#c97b5a'),
    shrub: lam('#2e7d4f'),
    shrub2: lam('#3a8f5a'),
    carTeal: lam('#1d8a8a'),
    carMaroon: lam('#7a2741'),
    carBeige: lam('#cdbb91'),
    carPurple: lam('#5b3f8c'),
    tyre: lam('#18181c'),
    chrome: lam('#c9ced6'),
    paper: lam('#f6f3e8'),
    pinkPaper: lam('#ff8fb8'),
    yellowPaper: lam('#ffe066'),
    black: lam('#16161c'),
    crate: lam('#b9864e'),
    crateDark: lam('#8a5f33'),
    pcb: lam('#2f7d3a'),
    van: lam('#33363f'),
    orange: lam('#ff7a1a'),
    headlight: lam('#fff6c8', '#fff0a0', 1),
    beacon: lam('#ffb000', '#ff9a00', 1), // flashes, see animate()
    red: lam('#e3342f'),
    gold: lam('#ffd23f'),
    ribbon: [lam('#c8c8c8'), lam('#e84a5f'), lam('#3ab0ff'), lam('#ffd23f')],
    chairFabric: lam('#8e4f86'),
    wafer: lam('#c4c0e0', '#2a2650', 0.6),
    die: [lam('#7b5cff', '#7b5cff', 0.35), lam('#33d1c4', '#33d1c4', 0.35), lam('#ff6fb5', '#ff6fb5', 0.35)],
    cubicle: lam('#5f7f8c'),
    laminate: lam('#cdb98e'),
    piggy: lam('#ff9ec4'),
    epoxy: lam('#24242c'),
    emulator: lam('#2c3340'),
    ledGreen: lam('#76b900', '#76b900', 1),
    ledRed: lam('#ff3b3b', '#ff3b3b', 1),
    screenGlow: lam('#39ff88', '#1fcc66', 1),
    warmLight: lam('#ffd27a', '#ffbf55', 0.9),
    cardboard: lam('#c9a26b'),
    chipGlow: lam('#76b900', '#76b900', 1),
  };

  const SCREEN = { bg: '#0b2a1a', fg: '#39ff88' };

  const LOOK = {
    accountant: { look: 'female', skin: '#e8b98f', hair: '#7a7a7a', top: '#7a5c9e', bottom: '#3b3f55', accessory: 'glasses' },
    engineer: { skin: '#b8875e', hair: '#1e1e1e', top: '#f4f6ff', bottom: '#2b4a7a', accessory: 'goggles' },
    foreman: { skin: '#8d5a3b', hair: '#2a1a10', top: '#ff8c1a', bottom: '#2f3a4f', accessory: 'hardhat' },
    repoMan: { skin: '#e8c09a', hair: '#4a3626', top: '#3d3d46', bottom: '#22222a', accessory: 'cap' },
    bunnySuit: { skin: '#e9c9a0', hair: '#f4f6ff', top: '#f4f6ff', bottom: '#f4f6ff', accessory: 'mask' },
  };

  const LEASE_SIGNS = [
    'FOR LEASE · VERY FLEXIBLE TERMS',
    'VISITOR & CREDITOR PARKING',
    '3D GRAPHICS · 2D BUDGET',
    'SUITE 101 · RENT DUE FRIDAY',
  ];
  const LAB_SIGNS = ['CLEANROOM B · BUNNY SUITS ONLY', 'YELLOW LIGHT ZONE · NO DONUTS', 'LAB 3 · DO NOT LICK THE WAFERS'];

  // ---------------------------------------------------------------- scenery

  function buildOfficeBlock(rng) {
    const g = new THREE.Group();
    const W = r1(between(rng, 10, 16));
    const D = r1(between(rng, 8, 12));
    const floors = rng() < 0.5 ? 2 : 3;
    const H = floors * 3.4 + 0.6;
    part(g, box(W, H, D), M.beige, 0, H / 2, 0);
    // Strip windows: slightly oversized boxes read as bands on all four faces.
    for (let f = 0; f < floors; f++) part(g, box(W + 0.12, 1.3, D + 0.12), M.glass, 0, 1.9 + f * 3.4, 0);
    part(g, box(W + 0.3, 0.45, D + 0.3), M.teal, 0, H + 0.22, 0);
    // Mauve stair tower at a front corner, taller than the roof. Very 1990s.
    const side = rng() < 0.5 ? -1 : 1;
    const towerX = side * (W / 2 - 1.2);
    part(g, box(2.4, H + 1.4, 2.4), M.mauve, towerX, (H + 1.4) / 2, D / 2 - 1.0);
    const doorX = -side * 1.6;
    part(g, box(3.2, 0.25, 1.6), M.teal, doorX, 3.0, D / 2 + 0.8);
    part(g, box(2.0, 2.4, 0.1), M.door, doorX, 1.2, D / 2 + 0.05);
    // A few people still working late: lit windows on upper floors and the sides.
    const lit = 3 + Math.floor(rng() * 4);
    for (let i = 0; i < lit; i++) {
      const f = Math.floor(rng() * floors);
      const y = 1.9 + f * 3.4;
      if (f > 0 && rng() < 0.6) {
        const x = -side * between(rng, 0.2, W / 2 - 1.6);
        part(g, box(r1(between(rng, 1.4, 2.4)), 1.0, 0.1), M.litWin, x, y, D / 2 + 0.08);
      } else {
        const s = rng() < 0.5 ? -1 : 1;
        part(g, box(0.1, 1.0, 1.8), M.litWin, s * (W / 2 + 0.08), y, between(rng, -D / 2 + 1.2, D / 2 - 1.2));
      }
    }
    part(g, box(2.2, 1.0, 1.6), M.metal, between(rng, -W / 4, W / 4), H + 0.5, between(rng, -D / 4, D / 4));
    return settle(g);
  }

  function buildCleanroomWing(rng) {
    const g = new THREE.Group();
    const W = 7;
    const D = 12;
    const H = 4.6;
    part(g, box(W, H, D), M.beigeDark, 0, H / 2, 0);
    // Lithography-yellow windows: one box shows on the long sides, one on the ends.
    part(g, box(W + 0.1, 1.2, D - 1.6), M.cleanroom, 0, 2.9, 0);
    part(g, box(W - 2, 1.2, D + 0.1), M.cleanroom, 0, 2.9, 0);
    for (const z of [-3, 0, 3]) part(g, box(W + 0.2, 1.3, 0.18), M.darkMetal, 0, 2.9, z);
    part(g, box(W + 0.3, 0.35, D + 0.3), M.teal, 0, H + 0.17, 0);
    const stackZ = between(rng, -3, 3);
    part(g, cyl(0.3, 0.3, 2.2), M.metal, -1.5, H + 1.1, stackZ);
    part(g, cone(0.45, 0.4), M.darkMetal, -1.5, H + 2.4, stackZ);
    part(g, cyl(0.3, 0.3, 1.6), M.metal, 1.5, H + 0.8, -stackZ);
    part(g, box(1.4, 2.1, 0.1), M.door, 1.8, 1.05, D / 2 + 0.05);
    sign(g, pick(rng, LAB_SIGNS), { w: 4.2, h: 0.5, bg: '#1f9e95', fg: '#fffbe6' }, 0, 4.1, D / 2 + 0.06);
    if (rng() < 0.5) who(g, LOOK.bunnySuit, -1.4, 0, D / 2 + 0.9);
    return settle(g);
  }

  function buildFlickerLamp(rng) {
    const g = new THREE.Group();
    const bad = rng() < 0.35;
    part(g, cyl(0.26, 0.3, 0.5), M.concrete, 0, 0.25, 0);
    part(g, cyl(0.07, 0.09, 5.0, 6), M.darkMetal, 0, 3.0, 0);
    part(g, box(2.3, 0.12, 0.14), M.darkMetal, 0, 5.45, 0);
    part(g, box(0.75, 0.2, 0.38), bad ? M.lampBad : M.lamp, -1.05, 5.32, 0);
    part(g, box(0.75, 0.2, 0.38), bad ? M.lampBad : M.lamp, 1.05, 5.32, 0);
    part(g, cyl(1.7, 1.7, 0.02, 12), bad ? M.poolBad : M.pool, 0, 0.01, 0);
    return g;
  }

  function buildPalm(rng) {
    const g = new THREE.Group();
    part(g, box(1.4, 0.55, 1.4), M.planter, 0, 0.275, 0);
    const tree = new THREE.Group();
    tree.position.y = 0.55;
    tree.rotation.set(between(rng, -0.08, 0.08), 0, between(rng, -0.12, 0.12));
    g.add(tree);
    for (let i = 0; i < 3; i++) {
      const r = 0.22 - i * 0.03;
      part(tree, cyl(r - 0.03, r, 1.9, 6), M.trunk, 0, 0.95 + i * 1.9, 0);
    }
    const top = 5.7;
    part(tree, ball(0.24), M.coconut, 0, top, 0);
    const twist = rng() * Math.PI;
    for (let k = 0; k < 6; k++) {
      const frond = new THREE.Group();
      frond.position.y = top;
      frond.rotation.y = twist + (k * Math.PI) / 3;
      tree.add(frond);
      part(frond, box(2.4, 0.07, 0.55), k % 2 ? M.leaf : M.leaf2, 1.1, -0.45, 0, 0, 0, -0.4);
    }
    return settle(g);
  }

  function buildLeaseSign(rng) {
    const g = new THREE.Group();
    part(g, box(3.4, 0.45, 0.7), M.concrete, 0, 0.225, 0);
    part(g, box(3.1, 1.3, 0.4), M.beige, 0, 1.1, 0);
    part(g, box(3.12, 0.22, 0.42), M.teal, 0, 1.65, 0);
    sign(g, pick(rng, LEASE_SIGNS), { w: 2.8, h: 0.85, bg: '#efe4c8', fg: '#5a2a4a' }, 0, 1.02, 0.205);
    part(g, ball(0.45), M.shrub, -2.05, 0.45, 0.1);
    part(g, ball(0.38), M.shrub2, 2.0, 0.38, 0.05);
    return settle(g);
  }

  function buildParkedCar(rng) {
    const g = new THREE.Group();
    const paint = pick(rng, [M.carTeal, M.carMaroon, M.carBeige, M.carPurple]);
    part(g, box(1.7, 0.62, 4.0), paint, 0, 0.6, 0);
    part(g, box(1.5, 0.55, 2.1), M.glass, 0, 1.18, -0.25);
    part(g, box(1.52, 0.07, 1.9), paint, 0, 1.49, -0.25);
    for (const sx of [-0.78, 0.78]) {
      for (const sz of [-1.3, 1.3]) part(g, cyl(0.31, 0.31, 0.24, 10), M.tyre, sx, 0.31, sz, 0, 0, Math.PI / 2);
    }
    part(g, box(1.72, 0.14, 0.1), M.chrome, 0, 0.4, 2.02);
    if (rng() < 0.4) sign(g, 'FOR SALE · ASK CFO', { w: 0.9, h: 0.26, bg: '#fffbe6', fg: '#c0262d' }, 0, 1.18, 0.81);
    return settle(g);
  }

  // ---------------------------------------------------------------- obstacles

  function buildInvoiceStack() {
    const g = new THREE.Group();
    part(g, box(0.46, 0.56, 0.62), M.paper, -0.5, 0.28, 0);
    part(g, box(0.46, 0.7, 0.62), M.pinkPaper, 0, 0.35, 0);
    part(g, box(0.46, 0.46, 0.62), M.yellowPaper, 0.5, 0.23, 0);
    part(g, box(0.5, 0.012, 0.66), M.paper, 0.02, 0.706, 0, 0, 0.15, 0);
    part(g, box(0.12, 0.05, 0.04), M.black, -0.5, 0.585, 0.29);
    part(g, box(0.12, 0.05, 0.04), M.black, 0.5, 0.485, 0.29);
    sign(g, 'PAST DUE', { w: 0.42, h: 0.16, bg: '#e3342f', fg: '#ffffff' }, 0, 0.42, 0.315);
    return settle(g);
  }

  function buildReturnsCrate() {
    const g = new THREE.Group();
    part(g, box(1.3, 0.6, 0.9), M.crate, 0, 0.3, 0);
    part(g, box(1.34, 0.08, 0.94), M.crateDark, 0, 0.1, 0);
    part(g, box(1.34, 0.08, 0.94), M.crateDark, 0, 0.52, 0);
    sign(g, 'RETURN TO SENDER', { w: 1.0, h: 0.2, bg: '#f4f1e6', fg: '#c0262d' }, 0, 0.31, 0.471);
    // Unloved circuit boards poking out of the top.
    part(g, box(0.5, 0.22, 0.04), M.pcb, -0.3, 0.62, 0.1, 0, 0, 0.12);
    part(g, box(0.5, 0.22, 0.04), M.pcb, 0.05, 0.6, -0.15, 0, 0, -0.1);
    part(g, box(0.5, 0.22, 0.04), M.pcb, 0.35, 0.63, 0.12, 0, 0.3, 0.08);
    return settle(g);
  }

  function crt(g, x, y0, w, h, d, text) {
    part(g, box(w, h, d), M.putty, x, y0 + h / 2, 0);
    sign(g, text, { w: w * 0.78, h: h * 0.7, bg: SCREEN.bg, fg: SCREEN.fg }, x, y0 + h * 0.52, d / 2 + 0.005);
  }

  function buildCrtTrolley() {
    const g = new THREE.Group();
    part(g, box(1.5, 0.06, 0.9), M.darkMetal, 0, 0.95, 0);
    part(g, box(1.5, 0.06, 0.9), M.darkMetal, 0, 0.3, 0);
    part(g, box(0.06, 0.86, 0.9), M.darkMetal, -0.72, 0.55, 0);
    part(g, box(0.06, 0.86, 0.9), M.darkMetal, 0.72, 0.55, 0);
    part(g, cyl(0.07, 0.07, 1.36), M.tyre, 0, 0.07, 0.36, 0, 0, Math.PI / 2);
    part(g, cyl(0.07, 0.07, 1.36), M.tyre, 0, 0.07, -0.36, 0, 0, Math.PI / 2);
    part(g, box(0.26, 0.56, 0.62), M.putty, -0.35, 0.61, 0);
    crt(g, -0.36, 0.98, 0.7, 0.6, 0.66, 'C:\\> RUN PAYROLL');
    crt(g, 0.36, 0.98, 0.7, 0.6, 0.66, 'ABORT, RETRY, FAIL?');
    crt(g, 0, 1.58, 0.6, 0.5, 0.56, '30 DAYS');
    return settle(g);
  }

  function buildRepoVan() {
    const g = new THREE.Group();
    part(g, box(1.7, 1.6, 4.4), M.van, 0, 1.1, 0);
    part(g, box(1.72, 0.16, 4.42), M.orange, 0, 0.98, 0);
    part(g, box(1.46, 0.55, 0.04), M.glass, 0, 1.5, 2.21);
    sign(g, 'REPO', { w: 0.8, h: 0.26, bg: '#ff7a1a', fg: '#16161c' }, 0, 0.7, 2.215);
    part(g, box(0.3, 0.16, 0.04), M.headlight, -0.6, 0.72, 2.21);
    part(g, box(0.3, 0.16, 0.04), M.headlight, 0.6, 0.72, 2.21);
    part(g, box(1.74, 0.18, 0.12), M.darkMetal, 0, 0.4, 2.2);
    for (const sx of [-0.76, 0.76]) {
      for (const sz of [-1.45, 1.45]) part(g, cyl(0.34, 0.34, 0.22, 10), M.tyre, sx, 0.34, sz, 0, 0, Math.PI / 2);
    }
    part(g, box(0.4, 0.06, 0.3), M.darkMetal, 0, 1.93, 0.6);
    part(g, cyl(0.13, 0.15, 0.2), M.beacon, 0, 2.06, 0.6);
    return settle(g);
  }

  function buildFinalNotice() {
    const g = new THREE.Group();
    part(g, box(1.9, 0.62, 0.08), M.red, 0, 1.62, 0);
    sign(g, 'FINAL NOTICE', { w: 1.7, h: 0.4, bg: '#e3342f', fg: '#fffbe6' }, 0, 1.62, 0.045);
    part(g, cyl(0.03, 0.03, 1.96, 6), M.metal, 0, 1.95, 0, 0, 0, Math.PI / 2);
    // Wires up into the dark; nothing touches the ground, so the lane below is clear.
    part(g, cyl(0.012, 0.012, 0.75, 4), M.darkMetal, -0.9, 2.33, 0);
    part(g, cyl(0.012, 0.012, 0.75, 4), M.darkMetal, 0.9, 2.33, 0);
    part(g, box(0.06, 0.1, 0.02), M.gold, -0.88, 1.27, 0);
    part(g, box(0.06, 0.1, 0.02), M.gold, 0.88, 1.27, 0);
    return settle(g, false);
  }

  function buildCableTray() {
    const g = new THREE.Group();
    part(g, box(1.9, 0.08, 0.5), M.metal, 0, 2.0, 0);
    part(g, box(1.9, 0.14, 0.03), M.metal, 0, 2.07, 0.25);
    part(g, box(1.9, 0.14, 0.03), M.metal, 0, 2.07, -0.25);
    part(g, cyl(0.015, 0.015, 0.6, 4), M.darkMetal, -0.85, 2.44, 0);
    part(g, cyl(0.015, 0.015, 0.6, 4), M.darkMetal, 0.85, 2.44, 0);
    // Drooping ribbon cables, each ending in a connector at about 1.3 m.
    const xs = [-0.62, -0.2, 0.22, 0.62];
    const tilts = [0.12, -0.08, 0.1, -0.14];
    xs.forEach((x, i) => {
      const t = tilts[i];
      part(g, box(0.24, 0.62, 0.015), M.ribbon[i], x, 1.66, 0.2, 0, 0, t);
      part(g, box(0.27, 0.07, 0.05), M.black, x + 0.31 * Math.sin(t), 1.66 - 0.31 * Math.cos(t) - 0.03, 0.2, 0, 0, t);
    });
    return settle(g, false);
  }

  function buildOfficeChair() {
    const g = new THREE.Group();
    for (let k = 0; k < 5; k++) {
      const leg = new THREE.Group();
      leg.rotation.y = (k * 2 * Math.PI) / 5 + Math.PI / 2;
      g.add(leg);
      part(leg, box(0.36, 0.05, 0.07), M.black, 0.18, 0.12, 0);
      part(leg, cyl(0.05, 0.05, 0.05), M.darkMetal, 0.34, 0.05, 0, Math.PI / 2, 0, 0);
    }
    part(g, cyl(0.035, 0.035, 0.32, 6), M.metal, 0, 0.3, 0);
    part(g, box(0.56, 0.1, 0.54), M.chairFabric, 0, 0.5, 0);
    part(g, box(0.05, 0.22, 0.04), M.black, 0, 0.58, -0.27);
    part(g, box(0.5, 0.26, 0.08), M.chairFabric, 0, 0.65, -0.29);
    sign(g, 'AUCTION LOT 7', { w: 0.36, h: 0.12, bg: '#ffe066', fg: '#16161c' }, 0, 0.66, -0.245);
    return settle(g);
  }

  // ---------------------------------------------------------------- collectible

  function buildWafer() {
    const g = new THREE.Group();
    const Y = 0.6; // hovers at hip height; group origin stays on the ground
    part(g, cyl(0.25, 0.25, 0.024, 20), M.wafer, 0, Y, 0, Math.PI / 2, 0, 0);
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) part(g, box(0.085, 0.085, 0.012), M.die[(i + j + 3) % 3], i * 0.1, Y + j * 0.1, 0.016);
    }
    return g;
  }

  // ---------------------------------------------------------------- landmarks

  function buildAccountantDesk() {
    const g = new THREE.Group();
    part(g, box(3.6, 1.7, 0.1), M.cubicle, 0, 0.85, -0.9);
    // The cash sign sits right of centre so the accountant (left end, by the adding machine) never hides it.
    sign(g, 'DAYS OF CASH LEFT: 30', { w: 1.9, h: 0.42, bg: '#fffbe6', fg: '#c0262d' }, 0.3, 1.46, -0.845);
    part(g, box(2.4, 0.08, 1.1), M.laminate, 0, 0.76, 0);
    part(g, box(0.5, 0.72, 1.0), M.beigeDark, -0.9, 0.36, 0);
    part(g, box(0.5, 0.72, 1.0), M.beigeDark, 0.9, 0.36, 0);
    // Adding machine whose paper tape has run off the desk and across the floor.
    part(g, box(0.36, 0.14, 0.42), M.putty, -0.55, 0.87, 0.15);
    part(g, box(0.1, 0.8, 0.008), M.paper, -0.55, 0.4, 0.56);
    part(g, box(0.1, 0.008, 1.3), M.paper, -0.5, 0.004, 1.2);
    part(g, box(0.5, 0.44, 0.46), M.putty, 0.45, 1.02, -0.1);
    sign(g, 'RUNWAY: 30 DAYS', { w: 0.38, h: 0.26, bg: SCREEN.bg, fg: SCREEN.fg }, 0.45, 1.04, 0.135);
    part(g, ball(0.13), M.piggy, -0.05, 0.93, 0.25);
    part(g, box(0.5, 1.3, 0.6), M.beige, 1.55, 0.65, -0.45);
    part(g, box(0.46, 0.26, 0.45), M.beige, 1.55, 0.95, 0.07);
    who(g, LOOK.accountant, -1.25, 0, -0.6);
    return settle(g);
  }

  function buildLabBench() {
    const g = new THREE.Group();
    part(g, box(3.0, 0.08, 1.0), M.epoxy, 0.6, 0.92, 0);
    part(g, box(0.08, 0.88, 0.9), M.metal, -0.8, 0.44, 0);
    part(g, box(0.08, 0.88, 0.9), M.metal, 2.0, 0.44, 0);
    // The fridge-sized emulator the whole chip lives inside.
    part(g, box(1.1, 2.1, 0.9), M.emulator, -1.9, 1.05, -0.1);
    part(g, box(0.8, 0.06, 0.02), M.ledGreen, -1.9, 1.7, 0.36);
    part(g, box(0.8, 0.06, 0.02), M.ledRed, -1.9, 1.55, 0.36);
    part(g, box(0.8, 0.06, 0.02), M.ledGreen, -1.9, 1.4, 0.36);
    sign(g, 'EMULATOR · DO NOT KICK', { w: 0.95, h: 0.24, bg: '#76b900', fg: '#16161c' }, -1.9, 1.05, 0.355);
    part(g, box(0.5, 0.34, 0.42), M.putty, 0.0, 1.13, 0.05);
    part(g, box(0.28, 0.18, 0.02), M.screenGlow, -0.06, 1.15, 0.27);
    part(g, box(0.56, 0.5, 0.5), M.putty, 0.95, 1.21, -0.1);
    sign(g, 'FRAME 1 OF 1... PLEASE WAIT', { w: 0.44, h: 0.32, bg: SCREEN.bg, fg: SCREEN.fg }, 0.95, 1.23, 0.155);
    part(g, box(0.6, 0.015, 0.16), M.ribbon[0], -1.1, 0.965, 0.1);
    who(g, LOOK.engineer, 0.6, 0, -0.85);
    return settle(g);
  }

  function buildLoadingDock() {
    const g = new THREE.Group();
    part(g, box(6.4, 4.0, 0.3), M.beigeDark, 0, 2.0, -1.6);
    part(g, box(2.6, 2.4, 0.04), M.warmLight, -0.6, 2.3, -1.43);
    part(g, box(2.8, 0.34, 0.42), M.metal, -0.6, 3.68, -1.3);
    part(g, box(0.45, 0.16, 0.3), M.lampBad, -0.6, 3.95, -1.3);
    sign(g, 'DOCK 1 · SHIPPING', { w: 1.5, h: 0.36, bg: '#1f9e95', fg: '#fffbe6' }, 2.1, 2.9, -1.43);
    part(g, box(6.0, 1.1, 2.6), M.concrete, 0, 0.55, -0.15);
    part(g, box(0.28, 0.42, 0.16), M.black, -1.9, 0.6, 1.23);
    part(g, box(0.28, 0.42, 0.16), M.black, 0.7, 0.6, 1.23);
    // One pallet, one crate, one glowing chip.
    part(g, box(1.0, 0.14, 1.0), M.crateDark, -0.6, 1.17, 0.1);
    part(g, box(0.8, 0.6, 0.8), M.cardboard, -0.6, 1.54, 0.1);
    sign(g, 'RIVA 128 · THIS SIDE UP', { w: 0.72, h: 0.26, bg: '#f4f1e6', fg: '#16161c' }, -0.6, 1.56, 0.505);
    part(g, box(0.3, 0.05, 0.3), M.chipGlow, -0.6, 1.865, 0.1);
    who(g, LOOK.foreman, 0.9, 1.1, 0.0);
    who(g, LOOK.repoMan, 2.4, 0, 1.7);
    return settle(g);
  }

  // ---------------------------------------------------------------- chapter data

  const LENGTH = 800;

  const STOPS = [
    { at: 220, title: "The Accountant's Desk", landmark: { x: -6.5, build: buildAccountantDesk }, dialogueId: 'accountant' },
    { at: 500, title: 'The Lab Bench', landmark: { x: 6.5, build: buildLabBench }, dialogueId: 'labbench' },
    { at: LENGTH, title: 'The Loading Dock', landmark: { x: -7, build: buildLoadingDock }, dialogueId: 'loadingdock' },
  ];

  const P = {
    hudLabel: 'DAYS OF CASH LEFT',
    startSeconds: 45,
    secondsPerDay: 1.5,
    perWafer: 1.5,
    restartFloor: 30,
    maxDt: 0.1,
    spawnFirst: 40,
    spawnEvery: 40,
    spawnStopBefore: 20,
    spawnCount: 2,
    spawnGap: 3,
    spawnLookahead: 60,
    spawnLanes: [0, 1, 0, -1],
    warnDays: [20, 10, 5, 3, 2, 1],
  };

  const WARNINGS = {
    20: '20 days of cash. The coffee is decaf now, to save money.',
    10: '10 DAYS OF CASH LEFT! Grab wafers!',
    5: '5 DAYS! The accountant is breathing into a paper bag.',
    3: '3 DAYS OF CASH LEFT!',
    2: '2 DAYS!',
    1: '1 DAY! Wafers, now!',
  };
  const FAIL_TEXT = 'Out of cash. The bank turned the lights off.';

  // ---------------------------------------------------------------- cash clock

  let cash = null; // the clock for the current attempt
  let saved = {}; // stop index -> clock seconds when that stop was reached
  let animClock = 0;

  const daysOf = (s) => Math.max(0, Math.ceil(s / P.secondsPerDay - 1e-9));
  const distanceOf = (game) => (typeof game.distance === 'number' && isFinite(game.distance) ? game.distance : 0);
  function counterOf(game) {
    for (const k of ['collected', 'collects', 'collectCount']) if (typeof game[k] === 'number') return game[k];
    return null;
  }
  function say(game, text) {
    if (typeof game.say === 'function') game.say(text);
  }
  function stopIndexAt(d) {
    let i = -1;
    STOPS.forEach((s, k) => {
      if (d >= s.at - 0.5) i = k;
    });
    return i;
  }
  // Index of the first guaranteed-wafer mark strictly ahead of distance d.
  const firstSpawnIndex = (d) => Math.max(0, Math.floor((d - P.spawnFirst) / P.spawnEvery) + 1);

  // Count wafer pickups that go through game.addCollect, whatever else the engine does.
  // A frozen or read-only game object rejects the hook; the counter poll (counterOf) then credits wafers.
  function hookCollect(game) {
    const original = game.addCollect;
    if (typeof original !== 'function' || original.cashClockHook) return;
    const hooked = function (n) {
      if (cash && !(n <= 0)) cash.wrapped += typeof n === 'number' ? n : 1;
      return original.apply(this, arguments);
    };
    hooked.cashClockHook = true;
    try {
      game.addCollect = hooked;
    } catch (e) {
      // read-only property: rely on counterOf() in onUpdate
    }
  }

  // Expose the clock for the HUD. A read-only game object loses only the HUD text, never the run.
  function publish(game) {
    try {
      if (!game.state || typeof game.state !== 'object') game.state = {};
      const days = daysOf(cash.seconds);
      game.state.cashSeconds = cash.seconds;
      game.state.cashDays = days;
      game.state.hud = `${P.hudLabel}: ${days}`;
    } catch (e) {
      // read-only game or game.state: the clock keeps running unpublished
    }
  }

  function begin(game) {
    const d = distanceOf(game);
    const i = stopIndexAt(d);
    if (i < 0) saved = {};
    const seconds = i < 0 ? P.startSeconds : Math.max(saved[i] == null ? 0 : saved[i], P.restartFloor);
    cash = {
      seconds,
      stop: i,
      lastD: d,
      lastDays: daysOf(seconds),
      wrapped: 0,
      polled: 0,
      credited: 0,
      lastCounter: counterOf(game),
      nextSpawn: firstSpawnIndex(d),
      spawnBroken: false,
      warned: {},
      failed: false,
      done: d >= LENGTH - 0.5,
    };
    hookCollect(game);
    publish(game);
    if (i < 0) say(game, `${P.hudLabel}: ${cash.lastDays}. Every wafer buys one more day.`);
    else say(game, `Back at ${STOPS[i].title.replace(/^The /, 'the ')}. ${P.hudLabel}: ${cash.lastDays}.`);
  }

  function spawnAhead(game, d) {
    if (cash.spawnBroken || typeof game.spawn !== 'function') return;
    for (;;) {
      const mark = P.spawnFirst + cash.nextSpawn * P.spawnEvery;
      if (mark > LENGTH - P.spawnStopBefore || mark > d + P.spawnLookahead) return;
      const lane = P.spawnLanes[cash.nextSpawn % P.spawnLanes.length];
      try {
        for (let n = 0; n < P.spawnCount; n++) game.spawn({ kind: 'collectible', lane, z: -(mark + n * P.spawnGap) });
      } catch (e) {
        cash.spawnBroken = true; // engine API changed; fall back to the engine's own wafers
        return;
      }
      cash.nextSpawn++;
    }
  }

  function warn(game) {
    const days = daysOf(cash.seconds);
    for (const w of P.warnDays) {
      if (days >= w + 3) cash.warned[w] = false;
      if (!cash.warned[w] && cash.lastDays > w && days <= w) {
        cash.warned[w] = true;
        say(game, WARNINGS[w]);
      }
    }
    cash.lastDays = days;
  }

  // Shared-material animation: some parking lamps buzz and drop out, the repo beacon flashes.
  function animate(step) {
    animClock += step;
    const buzz = Math.sin(animClock * 37) + Math.sin(animClock * 11.3) + Math.sin(animClock * 3.1);
    const on = buzz < 1.9 ? 1 : 0.08;
    M.lampBad.emissiveIntensity = on;
    M.poolBad.emissiveIntensity = on;
    M.beacon.emissiveIntensity = animClock % 0.5 < 0.25 ? 1.3 : 0.15;
  }

  // ---------------------------------------------------------------- export

  return {
    id: 'ch1',
    title: 'Thirty Days Left',
    dateline: 'Sunnyvale, 1997',
    outfit: 'young',
    hideMeters: false,
    length: LENGTH,
    speed: { base: 11, max: 15 },

    frontPage: {
      headline: 'CHIP START-UP HAS 30 DAYS OF CASH AND ONE (1) CHIP',
      sub: "Sunnyvale graphics firm bets everything on a part it has only seen inside a fridge-sized emulator. Landlord 'monitoring the situation'.",
    },

    theme: {
      sky: '#141233',
      fog: '#2a2350',
      fogNear: 30,
      fogFar: 160,
      ground: '#3a2f52',
      road: '#b3a27f',
      laneLine: '#28c2b0',
      lightColor: '#e9f5d0',
      lightIntensity: 0.85,
      ambient: '#5b4b80',
    },

    scenery: [
      { id: 'office-block', side: 'left', every: 38, offset: 22, build: buildOfficeBlock },
      { id: 'cleanroom-wing', side: 'right', every: 46, offset: 17.5, build: buildCleanroomWing },
      { id: 'flicker-lamp', side: 'both', every: 22, offset: 6.6, build: buildFlickerLamp },
      { id: 'office-palm', side: 'both', every: 30, offset: 10.2, build: buildPalm },
      { id: 'lease-sign', side: 'left', every: 95, offset: 7.6, build: buildLeaseSign },
      { id: 'parked-car', side: 'right', every: 70, offset: 8, build: buildParkedCar },
    ],

    // size = measured bounding box: w = x extent, h = top (max y), d = z extent.
    obstacles: [
      { id: 'invoice-stack', type: 'low', weight: 3, size: { w: 1.46, h: 0.71, d: 0.73 }, build: buildInvoiceStack },
      { id: 'returns-crate', type: 'low', weight: 2, size: { w: 1.34, h: 0.76, d: 0.94 }, build: buildReturnsCrate },
      { id: 'crt-trolley', type: 'block', weight: 3, size: { w: 1.5, h: 2.08, d: 0.9 }, build: buildCrtTrolley },
      { id: 'repo-van', type: 'block', weight: 1.2, size: { w: 1.74, h: 2.14, d: 4.47 }, build: buildRepoVan },
      { id: 'final-notice', type: 'high', weight: 2.5, size: { w: 1.96, h: 2.71, d: 0.09 }, build: buildFinalNotice },
      { id: 'cable-tray', type: 'high', weight: 1.5, size: { w: 1.9, h: 2.74, d: 0.53 }, build: buildCableTray },
      { id: 'office-chair', type: 'mover', weight: 2, size: { w: 0.76, h: 0.78, d: 0.72 }, build: buildOfficeChair },
    ],

    collectible: { name: 'Silicon wafer', build: buildWafer },

    stops: STOPS,

    dialogues: {
      accountant: [
        { speaker: 'The Accountant', text: 'Good news: we have thirty days of cash. Bad news: I checked twice.' },
        { speaker: 'Jensen', text: "Thirty days? In chip years that's practically a decade." },
        { speaker: 'The Accountant', text: 'The landlord, the fab and the coffee guy all want paying. The coffee guy scares me most.' },
        { speaker: 'Jensen', text: 'Then we run. Grab every wafer. Each one buys us another day.' },
      ],
      labbench: [
        { speaker: 'Lab Engineer', text: "We can't afford a test chip, so the whole RIVA 128 lives inside this fridge-sized emulator." },
        { speaker: 'Jensen', text: 'How fast does it run?' },
        { speaker: 'Lab Engineer', text: 'One frame per coffee break. We are extremely caffeinated.' },
        { speaker: 'Jensen', text: '3.5 million transistors, zero do-overs. Send it to the fab before the emulator asks for a raise.' },
        { speaker: 'Lab Engineer', text: 'Straight to production? I just aged a whole fiscal quarter.' },
      ],
      loadingdock: [
        { speaker: 'Dock Foreman', text: 'One crate, one chip, one truck. And one repo man.' },
        { speaker: 'Repo Man', text: "Evening. I'm here for the chairs, unless that box makes money." },
        { speaker: 'Jensen', text: "It's the RIVA 128. Fast, wide and chair-saving." },
        {
          speaker: 'Dock Foreman',
          text: 'Overnight costs our last cash. Ground is cheap but slow.',
          choices: [
            { text: 'Overnight. Speed is the strategy.', effects: { stock: 12, board: -8 }, next: 'dock_overnight' },
            { text: 'Ground. Every dollar is a day.', effects: { stock: -5, board: 10 }, next: 'dock_ground' },
          ],
        },
      ],
      dock_overnight: [{ speaker: 'Repo Man', text: 'Bold. See you in thirty days.' }],
      dock_ground: [{ speaker: 'Repo Man', text: 'Thrifty. See you in thirty days.' }],
    },

    mechanic: {
      summary:
        'CASH CLOCK. A timer starts at 45 s. The HUD shows "DAYS OF CASH LEFT: N" with N = ceil(timer / 1.5), so it ' +
        'starts at 30. On every frame where game.distance increased, the timer drops by that frame\'s dt (dt capped at ' +
        '0.1 s); it is frozen while the hero is not moving forward (story stops, pauses) and after the finish line. ' +
        'Each wafer collected adds 1.5 s (exactly one day), with no cap. When the hero reaches a stop, the timer value ' +
        'is saved for that stop. If the timer reaches 0 before the last stop, game.fail() is called once and the run ' +
        'restarts from the last stop reached (or from the start if none). On a restart from a stop the timer is set to ' +
        'the value saved there, raised to 30 s if lower; a restart from the start gets 45 s. Guaranteed supply: on top ' +
        "of the engine's own wafers, the chapter spawns 2 wafers 3 m apart in one lane every 40 m, at 40, 80, ... 760 m " +
        '(19 pairs, worth 57 s), lanes cycling centre, right, centre, left, each pair spawned 60 m ahead of the hero. ' +
        'game.say warns when N drops to 20, 10, 5, 3, 2 and 1 (each re-arms once N is 3 above it again). ' +
        'Fairness: a full run is about 62 s at the 11-15 m/s ramp (73 s at a flat 11 m/s), so about 12-19 wafers are ' +
        'needed in total; the longest leg is 300 m (27.3 s at 11 m/s), so a restarted leg can always be finished.',
      params: P,
    },

    onStart(game) {
      begin(game);
    },

    onUpdate(game, dt) {
      const step = Math.min(Math.max(Number(dt) || 0, 0), P.maxDt);
      animate(step);
      if (!cash) begin(game);
      const d = distanceOf(game);
      if (d < cash.lastD - 1) begin(game); // engine rewound to a stop without calling onStart

      // Wafers: count pickups via the addCollect hook or a numeric counter, whichever saw more.
      const counter = counterOf(game);
      if (counter != null) {
        if (cash.lastCounter != null && counter > cash.lastCounter) cash.polled += counter - cash.lastCounter;
        cash.lastCounter = counter;
      }
      const total = Math.max(cash.wrapped, cash.polled);
      if (total > cash.credited) {
        cash.seconds += (total - cash.credited) * P.perWafer;
        cash.credited = total;
      }

      // Drain only while running forward.
      if (d > cash.lastD + 1e-6 && !cash.done && !cash.failed) cash.seconds = Math.max(0, cash.seconds - step);
      cash.lastD = d;

      const i = stopIndexAt(d);
      while (cash.stop < i) {
        cash.stop++;
        saved[cash.stop] = cash.seconds;
      }
      if (d >= LENGTH - 0.5) cash.done = true;

      spawnAhead(game, d);

      if (!cash.done && !cash.failed && cash.seconds <= 0) {
        cash.failed = true;
        if (typeof game.fail === 'function') game.fail(FAIL_TEXT);
      }
      warn(game);
      publish(game);
    },

    endCard: {
      title: 'SHIPPED: THE RIVA 128',
      lines: [
        'The RIVA 128 launched in August 1997, and the company made it to 1998.',
        'Reports say it shipped over a million units in its first four months.',
        'Staff still joke that the company is always thirty days from closing.',
        'The repo man is still waiting in the fire lane.',
      ],
    },
  };
};
