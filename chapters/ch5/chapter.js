/*
 * Jacket Weather - Chapter 5: "The Paper Trail" (October 29, 2026).
 * Content module only: the engine places everything built here.
 * Every build() returns a new THREE.Group, origin on the ground at its centre, front facing +Z.
 */
'use strict';

module.exports = function (THREE, kit) {
  // ---------- palette: rainy ink-blue night, sodium lamps, newsprint, stamp inks ----------
  const C = {
    night: '#101833', fog: '#232c4a', pavement: '#1a2030', road: '#232a3d', laneLine: '#f0c35a',
    lamp: '#ffc46b', ambient: '#4a5784',
    paper: '#f3ecd6', paperDark: '#d8c79a', paperYellow: '#f7e7a1', paperPink: '#ffc7de',
    ink: '#151b2e', white: '#ffffff',
    red: '#e0262f', yellow: '#ffd23f', pink: '#ff5fa8', pinkPale: '#ffd1e6', purple: '#6a1b9a',
    confirmed: '#1f9d55', reported: '#e07b12', green: '#22c46b', greenDark: '#0f6b3a',
    flash: '#e9fbff', brick: '#6b2d2a', brickDark: '#4a1f1d', brickWall: '#5a3330',
    steel: '#3d4558', iron: '#22262f', wood: '#8a5a33', twine: '#b8925a', tarp: '#2f6db5',
    glow: '#ffcf7a', glowCool: '#9fd3ff', puddle: '#34446a', rain: '#a9c4ff', stone: '#5d6478',
    kiosk: ['#1e6b52', '#7a2333', '#24406b'], tower: ['#1f2740', '#2a2440', '#1b2a36'],
    trench: '#9a7b4f', fedora: '#26262c', car: '#20242e', glass: '#56688f',
    photo: '#2b3350', plinth: '#2c3346', gold: '#f5c542', smoke: '#9aa3b8'
  };

  // ---------- shared materials ----------
  const mats = {};
  function mat(color, o) {
    o = o || {};
    const key = [color, o.emissive || '', o.opacity || 1].join('|');
    if (!mats[key]) {
      const p = { color: color, flatShading: true };
      if (o.emissive) p.emissive = o.emissive;
      if (o.opacity && o.opacity < 1) { p.transparent = true; p.opacity = o.opacity; p.depthWrite = false; }
      mats[key] = new THREE.MeshLambertMaterial(p);
    }
    return mats[key];
  }
  const glowMat = (c) => mat(c, { emissive: c });

  // ---------- geometry helpers ----------
  function place(obj, x, y, z) { obj.position.set(x || 0, y || 0, z || 0); return obj; }
  function box(w, h, d, m, x, y, z) { return place(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m), x, y, z); }
  function cyl(rTop, rBot, h, m, x, y, z, seg) {
    return place(new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, seg || 8), m), x, y, z);
  }
  function cone(r, h, m, x, y, z, seg) { return place(new THREE.Mesh(new THREE.ConeGeometry(r, h, seg || 8), m), x, y, z); }
  function ball(r, m, x, y, z, wSeg, hSeg) {
    return place(new THREE.Mesh(new THREE.SphereGeometry(r, wSeg || 10, hSeg || 8), m), x, y, z);
  }
  function sign(text, w, h, bg, fg, x, y, z) { return place(kit.textPlane(text, { w: w, h: h, bg: bg, fg: fg }), x, y, z); }
  function group() { const g = new THREE.Group(); for (let i = 0; i < arguments.length; i++) g.add(arguments[i]); return g; }
  function person(opts) {
    // Unknown accessory names must not break the build: retry without one.
    try { return kit.person(opts); } catch (e) { const o = Object.assign({}, opts); delete o.accessory; return kit.person(o); }
  }
  function rngOf(rng) { return typeof rng === 'function' ? rng : Math.random; }
  function pick(rng, list) { return list[Math.floor(rng() * list.length) % list.length]; }
  function range(rng, a, b) { return a + (b - a) * rng(); }

  // A rubber-stamp mark: ink border plus a cream plate with ink lettering.
  function stampMark(label, ink, w, h, tilt) {
    const s = group(box(w + 0.12, h + 0.12, 0.02, mat(ink)), sign(label, w, h, C.paper, ink, 0, 0, 0.015));
    s.rotation.z = tilt || 0;
    return s;
  }

  // "The Silhouette": the tabloids' invented trench-coat figure. Always built next to an UNVERIFIED stamp.
  // Scenery that shows it stays on the left; the stops with the Megaspeed executive are on the right.
  function silhouette(scale) {
    const fig = person({ skin: '#2e2e3a', hair: '#141419', top: C.trench, bottom: '#2a2a33', accessory: 'sunglasses' });
    const bb = new THREE.Box3().setFromObject(fig);
    const top = isFinite(bb.max.y) ? bb.max.y : 1.8;
    const cx = isFinite(bb.max.x) ? (bb.min.x + bb.max.x) / 2 : 0;
    const cz = isFinite(bb.max.z) ? (bb.min.z + bb.max.z) / 2 : 0;
    const g = group(fig,
      cyl(0.25, 0.25, 0.04, mat(C.fedora), cx, top - 0.06, cz, 10),
      cyl(0.14, 0.16, 0.17, mat(C.fedora), cx, top + 0.05, cz, 10));
    g.scale.set(scale, scale, scale * 0.35); // flattened like a poster cut-out
    return g;
  }

  // People who appear in the landmarks.
  const LOOK = {
    ceo: { skin: '#e8c4a0', hair: '#2f2f33', top: '#141414', bottom: '#1f1f24' },
    exec: { look: 'female', skin: '#f0cfae', hair: '#2a1b14', top: '#3c4f80', bottom: '#3c4f80', accessory: 'suit' },
    vendor: { skin: '#e0b48a', hair: '#5a3b24', top: '#c94f2a', bottom: '#2f3542', accessory: 'cap' },
    editor: { skin: '#c98d5e', hair: '#d9d9d9', top: '#5b7f4a', bottom: '#3a3a3a', accessory: 'glasses' },
    adviser: { look: 'female', skin: '#f1c9a5', hair: '#7a4b2a', top: '#b03a5b', bottom: '#2b2d42' }
  };

  // ---------- obstacles ----------
  function buildRumourBubble() {
    const pink = mat(C.pink);
    const bubble = ball(1, pink, 0, 1.05, 0, 12, 9);
    bubble.scale.set(0.85, 0.95, 0.35);
    const tail = cone(0.22, 0.45, pink, -0.45, 0.225, 0, 4);
    tail.rotation.x = Math.PI; // tip touches the road
    const fig = place(silhouette(0.42), 0.05, 0.95, 0.38);
    const stamp = place(stampMark('UNVERIFIED', C.purple, 1.1, 0.28, 0.18), 0, 0.62, 0.36);
    const huh = sign('?!', 0.32, 0.32, C.pink, C.ink, 0.5, 1.55, 0.26);
    return group(bubble, tail, fig, stamp, huh);
  }

  function buildPaperRoll() {
    return group(
      box(1.6, 0.14, 1.6, mat(C.wood), 0, 0.07, 0),
      cyl(0.75, 0.75, 1.55, mat(C.paper), 0, 0.915, 0, 16),
      cyl(0.76, 0.76, 0.12, mat(C.ink), 0, 0.55, 0, 16),
      cyl(0.76, 0.76, 0.08, mat(C.red), 0, 1.35, 0, 16),
      cyl(0.18, 0.18, 0.02, mat(C.iron), 0, 1.70, 0, 10),
      sign('FRESH NEWSPRINT', 0.9, 0.26, C.paper, C.ink, 0, 0.95, 0.77));
  }

  function tripodCamera(x) {
    const g = new THREE.Group();
    const steel = mat(C.iron);
    const top = new THREE.Vector3(x, 0.52, 0);
    for (let i = 0; i < 3; i++) {
      const a = i * (Math.PI * 2 / 3) + Math.PI / 6;
      const foot = new THREE.Vector3(x + 0.24 * Math.cos(a), 0.02, 0.24 * Math.sin(a)); // feet stay above the road
      const dir = top.clone().sub(foot);
      const leg = cyl(0.025, 0.025, dir.length(), steel, 0, 0, 0, 5);
      leg.position.copy(foot).add(top).multiplyScalar(0.5);
      leg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
      g.add(leg);
    }
    const lens = cyl(0.07, 0.08, 0.18, mat(C.ink), x, 0.6, 0.17, 8);
    lens.rotation.x = Math.PI / 2;
    g.add(box(0.34, 0.2, 0.18, mat(C.steel), x, 0.6, 0), lens, box(0.16, 0.08, 0.06, glowMat(C.flash), x, 0.74, 0.03));
    return g;
  }
  function buildPaparazzi() {
    return group(tripodCamera(-0.42), tripodCamera(0.42), sign('FLASH!', 0.42, 0.16, C.flash, C.ink, 0, 0.25, 0.1));
  }

  function buildTabloidBundles() {
    const tw = mat(C.twine);
    const top = group(box(0.72, 0.28, 0.55, mat(C.paperPink), 0, 0, 0), box(0.04, 0.29, 0.57, tw, 0, 0, 0),
      sign('WOW!', 0.5, 0.16, C.yellow, C.purple, 0, 0, 0.29));
    place(top, 0, 0.44, 0);
    top.rotation.y = 0.12;
    return group(
      box(0.72, 0.3, 0.55, mat(C.paper), -0.38, 0.15, 0), box(0.04, 0.31, 0.57, tw, -0.38, 0.155, 0),
      box(0.72, 0.3, 0.55, mat(C.paperYellow), 0.38, 0.15, 0), box(0.04, 0.31, 0.57, tw, 0.38, 0.155, 0),
      sign('SHOCK!', 0.6, 0.2, C.yellow, C.red, -0.38, 0.15, 0.29), sign('GASP!', 0.6, 0.2, C.pink, C.ink, 0.38, 0.15, 0.29),
      top);
  }

  // High obstacles keep every part inside x = -0.98..0.98 so neighbouring lanes never overlap.
  function buildBreakingBanner() {
    const steel = mat(C.steel);
    const bulb = glowMat(C.lamp);
    return group(
      cyl(0.05, 0.05, 2.4, steel, -0.9, 1.2, 0), cyl(0.05, 0.05, 2.4, steel, 0.9, 1.2, 0),
      box(0.12, 0.08, 0.3, steel, -0.9, 0.04, 0), box(0.12, 0.08, 0.3, steel, 0.9, 0.04, 0),
      box(1.82, 0.62, 0.06, mat(C.red), 0, 1.62, 0), sign('BREAKING', 1.7, 0.5, C.red, C.white, 0, 1.62, 0.035),
      box(1.82, 0.14, 0.05, mat(C.yellow), 0, 1.24, 0), sign('...MORE AT 11...', 1.7, 0.12, C.yellow, C.ink, 0, 1.24, 0.03),
      ball(0.08, bulb, -0.9, 2.45, 0), ball(0.08, bulb, 0.9, 2.45, 0));
  }

  function buildProofLine() {
    const wood = mat(C.wood);
    const g = group(
      cyl(0.04, 0.04, 2.3, wood, -0.9, 1.15, 0), cyl(0.04, 0.04, 2.3, wood, 0.9, 1.15, 0),
      box(0.12, 0.06, 0.5, wood, -0.9, 0.03, 0), box(0.12, 0.06, 0.5, wood, 0.9, 0.03, 0),
      box(1.86, 0.03, 0.03, mat(C.iron), 0, 2.2, 0));
    const words = ['PROOF', 'WET INK', 'DO NOT TOUCH'];
    // Sheets overlap a little so the line has no gap to run through.
    [-0.58, 0, 0.58].forEach((x, i) => {
      const sheet = sign(words[i], 0.58, 0.75, C.paper, C.ink, x, 1.795, 0.05);
      sheet.rotation.z = (i - 1) * 0.06;
      g.add(sheet, box(0.06, 0.1, 0.05, mat(C.red), x, 2.2, 0.05));
    });
    return g;
  }

  function buildNewspaperCart() {
    const dark = mat(C.iron);
    const axle1 = cyl(0.13, 0.13, 1.38, dark, 0, 0.13, 0.3, 8);
    const axle2 = cyl(0.13, 0.13, 1.38, dark, 0, 0.13, -0.3, 8);
    axle1.rotation.z = axle2.rotation.z = Math.PI / 2;
    const bundle2 = box(0.55, 0.2, 0.6, mat(C.paperYellow), 0.32, 0.62, 0.02);
    bundle2.rotation.y = 0.1;
    return group(
      box(1.3, 0.32, 0.85, mat(C.kiosk[0]), 0, 0.36, 0), axle1, axle2,
      box(0.55, 0.22, 0.6, mat(C.paper), -0.3, 0.63, 0), bundle2,
      box(0.04, 0.26, 0.04, dark, -0.5, 0.63, -0.42), box(0.04, 0.26, 0.04, dark, 0.5, 0.63, -0.42),
      box(1.04, 0.04, 0.04, dark, 0, 0.75, -0.42),
      sign('EXTRA!', 0.9, 0.22, C.yellow, C.red, 0, 0.36, 0.43));
  }

  // ---------- collectible: fact-check stamp ----------
  function buildStamp() {
    const wood = mat(C.wood);
    return group(
      box(0.32, 0.03, 0.22, glowMat(C.greenDark), 0, 0.015, 0),
      box(0.34, 0.1, 0.24, mat(C.green, { emissive: '#0b5a2e' }), 0, 0.08, 0),
      cyl(0.05, 0.07, 0.12, wood, 0, 0.19, 0, 8),
      cyl(0.06, 0.05, 0.16, wood, 0, 0.33, 0, 8),
      ball(0.09, mat(C.gold, { emissive: '#5a4210' }), 0, 0.45, 0),
      sign('FACT', 0.28, 0.08, C.green, C.paper, 0, 0.08, 0.125));
  }

  // ---------- scenery ----------
  const POSTER_LINES = [
    'RAIN: STILL WET, SOURCES CONFIRM', 'LOCAL GPU RUNS HOT, BLAMES WEATHER', 'MAN IN JACKET WEARS JACKET AGAIN',
    'CHIP PRICES: UP, DOWN, SIDEWAYS', 'UMBRELLA SALES SOAR IN SHOCK DRIZZLE', 'EXCLUSIVE: TUESDAY FOLLOWS MONDAY',
    'AI WRITES HEADLINE ABOUT AI HEADLINES'
  ];
  const PRESS_NAMES = ['THE DAILY DRIZZLE', 'THE EVENING GASP', 'MORNING SMUDGE PRESS', 'THE WEEKLY WOW'];

  function buildNewsstand(rng) {
    rng = rngOf(rng);
    const g = group(
      box(2.6, 2.2, 1.8, mat(pick(rng, C.kiosk)), 0, 1.1, 0),
      box(3.0, 0.22, 2.3, mat(C.iron), 0, 2.31, 0.1),
      box(2.5, 0.12, 0.5, mat(C.wood), 0, 1.0, 1.05),
      sign('NEWS', 1.6, 0.4, C.paper, C.red, 0, 2.65, 1.0));
    for (let i = 0; i < 3; i++) {
      const slat = box(1.0, 0.06, 0.9, mat(i % 2 ? C.paper : C.red), -1.0 + i, 2.05, 1.25);
      slat.rotation.x = 0.35;
      g.add(slat);
    }
    const mags = [C.yellow, C.pink, C.glowCool, C.paper];
    const shift = Math.floor(rng() * 4);
    for (let i = 0; i < 4; i++) g.add(box(0.5, 0.65, 0.05, mat(mags[(i + shift) % 4]), -0.9 + i * 0.6, 1.55, 0.93));
    g.add(place(person(LOOK.vendor), 1.75, 0, 1.4));
    // A-board tabloid poster featuring The Silhouette, stamped UNVERIFIED.
    g.add(box(1.0, 1.3, 0.06, mat(C.wood), -1.9, 0.65, 1.2),
      sign('WHO IS THE SILHOUETTE?', 0.9, 0.24, C.ink, C.yellow, -1.9, 1.15, 1.24),
      place(silhouette(0.4), -1.9, 0.2, 1.27),
      place(stampMark('UNVERIFIED', C.purple, 0.8, 0.18, 0.2), -1.9, 0.5, 1.34));
    return g;
  }

  function buildPrintingPress(rng) {
    rng = rngOf(rng);
    const w = 10, d = 8, h = range(rng, 8, 13);
    const glow = glowMat(C.glow);
    const steel = mat(C.steel);
    const g = group(
      box(w, h, d, mat(C.brick), 0, h / 2, 0),
      box(w + 0.4, 0.4, d + 0.4, mat(C.brickDark), 0, h + 0.2, 0),
      box(5, 2.2, 0.1, glow, 0, 1.3, d / 2 + 0.05),
      box(2, 2.4, 0.1, mat(C.iron), 3.6, 1.2, d / 2 + 0.05),
      box(3.2, 1.6, 1.2, steel, -2.5, 0.8, d / 2 + 0.7),
      sign(pick(rng, PRESS_NAMES), 6, 0.9, C.paper, C.ink, 0, h - 1.0, d / 2 + 0.06),
      cyl(0.5, 0.6, 3, mat(C.brickDark), 3, h + 1.5, -1.5, 8),
      ball(0.8, mat(C.smoke, { opacity: 0.5 }), 3, h + 3.4, -1.5),
      ball(1.1, mat(C.smoke, { opacity: 0.35 }), 3.6, h + 4.6, -1.8));
    // Ribbon windows wrap all four faces (slightly larger than the building).
    for (let y = 3.2; y < h - 2; y += 2.4) g.add(box(w + 0.08, 0.9, d + 0.08, glow, 0, y, 0));
    for (let i = 0; i < 2; i++) {
      const roller = cyl(0.3, 0.3, 3.4, steel, -2.5, 1.75, d / 2 + 0.45 + i * 0.55, 10);
      roller.rotation.z = Math.PI / 2;
      g.add(roller);
    }
    const web = box(2.8, 0.02, 2.0, mat(C.paper), -2.5, 1.2, d / 2 + 1.9);
    web.rotation.x = 0.5;
    g.add(web);
    return g;
  }

  function buildStreetlamp(rng) {
    rng = rngOf(rng);
    const iron = mat(C.iron);
    const cap = cone(0.36, 0.3, iron, 0, 5.17, 0, 4);
    cap.rotation.y = Math.PI / 4;
    const g = group(
      cyl(0.16, 0.2, 0.3, iron, 0, 0.15, 0), cyl(0.06, 0.08, 4.2, iron, 0, 2.4, 0),
      box(0.4, 0.55, 0.4, glowMat(C.lamp), 0, 4.75, 0), cap,
      ball(0.6, mat(C.lamp, { emissive: C.lamp, opacity: 0.18 }), 0, 4.75, 0),
      cyl(0.9, 0.9, 0.02, mat(C.puddle, { emissive: '#2a2414' }), 0.3, 0.01, 0.4, 12));
    const rain = mat(C.rain, { opacity: 0.45 });
    for (let i = 0; i < 5; i++) {
      const a = rng() * Math.PI * 2, r = 0.3 + rng() * 0.6;
      g.add(box(0.015, 0.7, 0.015, rain, Math.cos(a) * r, range(rng, 1.8, 4.0), Math.sin(a) * r));
    }
    return g;
  }

  function buildPosterWall(rng) {
    rng = rngOf(rng);
    const first = Math.floor(rng() * POSTER_LINES.length);
    const second = (first + 1 + Math.floor(rng() * (POSTER_LINES.length - 1))) % POSTER_LINES.length;
    return group(
      box(6.4, 3.0, 0.4, mat(C.brickWall), 0, 1.5, 0),
      box(6.6, 0.15, 0.55, mat(C.stone), 0, 3.07, 0),
      sign(POSTER_LINES[first], 1.8, 2.2, pick(rng, [C.yellow, C.paper, C.glowCool]), C.ink, -2.1, 1.6, 0.21),
      sign(POSTER_LINES[second], 1.8, 2.2, pick(rng, [C.paperPink, C.paper, C.yellow]), C.ink, 2.1, 1.6, 0.21),
      box(1.9, 2.4, 0.02, mat(C.pinkPale), 0, 1.6, 0.21),
      sign('THE SILHOUETTE?!', 1.7, 0.36, C.ink, C.yellow, 0, 2.55, 0.23),
      place(silhouette(0.75), 0, 0.5, 0.3),
      place(stampMark('UNVERIFIED', C.purple, 1.5, 0.36, 0.2), 0, 1.2, 0.4));
  }

  function buildTower(rng) {
    rng = rngOf(rng);
    const w = range(rng, 5, 9), h = range(rng, 12, 22), d = range(rng, 5, 8);
    const g = group(box(w, h, d, mat(pick(rng, C.tower)), 0, h / 2, 0),
      cyl(0.04, 0.04, 2.5, mat(C.iron), w * 0.25, h + 1.25, 0, 5),
      ball(0.12, glowMat(C.red), w * 0.25, h + 2.55, 0));
    const bands = 3 + Math.floor(rng() * 3);
    for (let i = 0; i < bands; i++) {
      g.add(box(w + 0.06, 0.4, d + 0.06, glowMat(rng() < 0.6 ? C.glow : C.glowCool), 0, range(rng, 2, h - 1.5), 0));
    }
    if (rng() < 0.4) g.add(sign(pick(rng, ['24H PRINT', 'INK & CO', 'NEWS 24/7']), 3, 0.8, C.ink, C.pink, 0, h - 1.2, d / 2 + 0.05));
    return g;
  }

  function buildPaperPallet(rng) {
    rng = rngOf(rng);
    const tw = mat(C.twine);
    const tarp = box(1.7, 0.05, 1.3, mat(C.tarp), 0, 0.92, 0);
    tarp.rotation.z = range(rng, -0.08, 0.08);
    return group(box(1.6, 0.14, 1.2, mat(C.wood), 0, 0.07, 0),
      box(0.75, 0.38, 1.1, mat(C.paper), -0.4, 0.33, 0), box(0.75, 0.38, 1.1, mat(C.paperYellow), 0.4, 0.33, 0),
      box(0.04, 0.39, 1.12, tw, -0.4, 0.335, 0), box(0.04, 0.39, 1.12, tw, 0.4, 0.335, 0),
      box(0.75, 0.36, 1.1, mat(C.paper), 0, 0.7, 0), tarp,
      sign('EARLY EDITION', 1.2, 0.22, C.paper, C.ink, 0, 0.33, 0.57),
      cyl(1.1, 1.1, 0.02, mat(C.puddle, { emissive: '#1d1a12' }), 0.5, 0.01, 0.9, 12));
  }

  // ---------- landmarks: giant newspaper clippings ----------
  // side: -1 = left of the road, +1 = right. The clipping turns a little toward the road.
  // headW/headX let a stop make room for a stamp beside the headline.
  function clipping(side, w, h, headline, torn, headW, headX) {
    const root = new THREE.Group();
    root.rotation.y = side < 0 ? 0.35 : -0.35;
    root.add(box(w + 0.4, 0.2, 1.4, mat(C.plinth), 0, 0.1, -0.5));
    const page = new THREE.Group();
    page.position.set(0, 0.2, -0.6);
    page.rotation.set(-0.07, 0, side < 0 ? 0.025 : -0.025);
    page.add(box(w, h, 0.12, mat(C.paper), 0, h / 2, 0));
    if (torn) {
      const strip = box(w * 0.6, 0.18, 0.13, mat(C.paperDark), -w * 0.15, h + 0.02, 0);
      strip.rotation.z = 0.04;
      page.add(strip);
    }
    page.add(sign(headline, headW || w - 0.6, 0.5, C.paper, C.ink, headX || 0, h - 0.45, 0.07));
    root.add(page);
    return { root: root, page: page, outer: group(root) };
  }
  const onPage = (obj, x, y) => place(obj, x, y, 0.08);

  function buildStop1() {
    // The CONFIRMED stamp sits beside the headline and covers the formation facts; the denial stands alone at the foot.
    const c = clipping(-1, 5.0, 3.6, 'SINGAPORE, 2023', true, 2.3, -1.25);
    c.page.add(
      onPage(stampMark('CONFIRMED - CORPORATE FILINGS', C.confirmed, 2.2, 0.42, -0.08), 1.25, 3.15),
      onPage(sign('MEGASPEED FORMED: RENTS OUT GPU POWER', 4.4, 0.36, C.paper, C.ink), 0, 2.45),
      onPage(sign('Becomes an official cloud partner', 4.2, 0.3, C.paper, C.ink), 0, 2.02),
      onPage(sign("Later the chipmaker's largest buyer in Southeast Asia", 4.4, 0.3, C.paper, C.ink), 0, 1.62),
      onPage(sign('Megaspeed denies any wrongdoing', 3.6, 0.3, C.paper, C.ink), 0, 0.75));
    c.root.add(
      place(person(LOOK.vendor), 2.9, 0, 0.75),
      cyl(0.02, 0.02, 1.0, mat(C.iron), 3.05, 1.7, 0.75, 5),
      cone(0.75, 0.35, mat(C.red), 3.05, 2.3, 0.75, 8),
      box(0.7, 0.5, 0.5, mat(C.paper), 2.0, 0.25, 0.8),
      sign('EXTRA!', 0.6, 0.2, C.yellow, C.red, 2.0, 0.3, 1.06));
    return c.outer;
  }

  function buildStop2() {
    const c = clipping(1, 5.2, 3.8, 'TAIPEI, JUNE 2024', true);
    c.page.add(
      onPage(sign('Tech-show party: the CEO beside a Megaspeed executive', 4.6, 0.3, C.paper, C.ink), 0, 2.85),
      place(box(2.6, 2.0, 0.02, mat(C.photo)), -0.9, 1.5, 0.07),
      onPage(stampMark('CONFIRMED - PHOTO', C.confirmed, 1.9, 0.4, -0.12), 1.6, 2.05),
      onPage(stampMark('REPORTED - WHISKEY SHOT', C.reported, 2.0, 0.36, 0.1), 1.55, 1.2));
    c.root.add(
      place(person(LOOK.ceo), -1.5, 0, 0.7),
      place(person(LOOK.exec), -0.5, 0, 0.7),
      sign('Megaspeed executive', 1.5, 0.26, C.ink, C.paper, -0.5, 2.05, 0.7));
    return c.outer;
  }

  function buildStop3() {
    const c = clipping(1, 5.2, 3.8, 'TAIPEI, MAY 2025', true);
    c.page.add(
      onPage(sign('Dinner he hosted at the tech show; the two leave in the same car', 4.8, 0.3, C.paper, C.ink), 0, 2.85),
      onPage(stampMark('CONFIRMED - TV FOOTAGE', C.confirmed, 2.2, 0.4, -0.1), -1.0, 2.2));
    const wheels = mat(C.iron);
    const a1 = cyl(0.3, 0.3, 1.4, wheels, -1.85, 0.3, 0.9, 10);
    const a2 = cyl(0.3, 0.3, 1.4, wheels, -0.15, 0.3, 0.9, 10);
    a1.rotation.x = a2.rotation.x = Math.PI / 2;
    c.root.add(
      box(2.6, 0.6, 1.3, mat(C.car), -1.0, 0.5, 0.9),
      box(1.5, 0.5, 1.2, mat(C.glass, { emissive: '#1a2238' }), -1.2, 1.05, 0.9), a1, a2,
      place(person(LOOK.ceo), 0.8, 0, 0.9),
      place(person(LOOK.exec), 1.6, 0, 0.9),
      sign('Megaspeed executive', 1.5, 0.26, C.ink, C.paper, 1.6, 2.05, 0.9));
    return c.outer;
  }

  function buildStop4() {
    const c = clipping(1, 5.6, 4.2, 'FRONT PAGE - OCTOBER 29, 2026', false);
    c.page.add(
      onPage(sign('US OFFICIALS ALLEGE MEGASPEED EXEC', 5.0, 0.42, C.paper, C.ink), 0, 3.25),
      onPage(sign('HAS TIES TO CHINESE INTELLIGENCE', 5.0, 0.42, C.paper, C.ink), 0, 2.8),
      onPage(sign('China calls it a smear. Megaspeed denies wrongdoing.', 5.0, 0.3, C.paper, C.ink), 0, 2.36),
      onPage(sign('The CEO: dealings were "completely normal"', 4.6, 0.3, C.paper, C.ink), 0, 2.02),
      onPage(stampMark('CONFIRMED - PUBLISHED', C.confirmed, 2.3, 0.38, -0.1), -0.2, 1.45),
      onPage(stampMark('REPORTED - ALLEGATION', C.reported, 2.3, 0.38, 0.08), 0.2, 0.75));
    c.root.add(place(person(LOOK.editor), -2.45, 0, 0.8), place(person(LOOK.adviser), 2.45, 0, 0.8));
    return c.outer;
  }

  // ---------- Fact Check twist ----------
  const FACT = { streakNeeded: 5, shieldSeconds: 5, popsObstacle: 'rumour-bubble', boardPerPop: 2, boardBonusCap: 10 };
  // Engine support the twist needs beyond the base hook API.
  const ENGINE_NEEDS = [
    'onCollect(game): call once per fact-check stamp picked up. Fallback: keep a numeric game.collected count, which onUpdate polls.',
    'onHit(game, obstacle): call before applying damage, with obstacle.kind or obstacle.id equal to the obstacle id. ' +
      'If it returns true, skip the damage and remove the obstacle.',
    'game.state.factCheck.active (boolean): read it to show the shield.'
  ];

  function say(game, text) { if (game && typeof game.say === 'function') game.say(text); }
  function heartsOf(game) { return game.hero && typeof game.hero.hearts === 'number' ? game.hero.hearts : null; }
  function collectedOf(game) { return typeof game.collected === 'number' ? game.collected : null; }
  function freshState(game) {
    return { streak: 0, shieldLeft: 0, active: false, boardEarned: 0, hearts: heartsOf(game), collected: collectedOf(game), collectHook: false };
  }
  function fc(game) {
    game.state = game.state || {};
    if (!game.state.factCheck) game.state.factCheck = freshState(game);
    return game.state.factCheck;
  }
  function gotStamps(game, s, n) {
    s.streak += n;
    if (s.streak >= FACT.streakNeeded) {
      const extending = s.shieldLeft > 0;
      s.streak = 0;
      s.shieldLeft = FACT.shieldSeconds;
      s.active = true;
      say(game, extending ? 'Fact Check extended: 5 more seconds!' : 'FACT CHECK! Rumour bubbles pop for 5 seconds.');
    }
  }
  function obstacleNames(obstacle) {
    if (typeof obstacle === 'string') return [obstacle];
    return obstacle ? [obstacle.kind, obstacle.id] : [];
  }

  return {
    id: 'ch5',
    title: 'The Paper Trail',
    dateline: 'October 29, 2026',
    outfit: 'jacket',
    hideMeters: false,
    length: 800,
    speed: { base: 14, max: 18 },
    frontPage: {
      headline: 'STOP THE PRESSES: CHIP CHIEF IN THE PAPERS (AGAIN)',
      sub: 'A report says US officials allege a Megaspeed executive has ties to Chinese intelligence. ' +
        'China calls it a smear; Megaspeed denies wrongdoing. The CEO calls their dealings "completely normal".'
    },
    theme: {
      sky: C.night, fog: C.fog, fogNear: 20, fogFar: 130, ground: C.pavement, road: C.road, laneLine: C.laneLine,
      lightColor: C.lamp, lightIntensity: 0.75, ambient: C.ambient
    },
    scenery: [
      { id: 'newsstand', side: 'left', every: 60, offset: 7.5, build: buildNewsstand },
      { id: 'printing-press', side: 'right', every: 95, offset: 16, build: buildPrintingPress },
      { id: 'streetlamp', side: 'both', every: 24, offset: 6, build: buildStreetlamp },
      { id: 'poster-wall', side: 'left', every: 84, offset: 12, build: buildPosterWall },
      { id: 'tower', side: 'both', every: 36, offset: 28, build: buildTower },
      { id: 'paper-pallet', side: 'right', every: 50, offset: 7, build: buildPaperPallet }
    ],
    obstacles: [
      { id: 'rumour-bubble', type: 'block', weight: 3, size: { w: 1.7, h: 2.0, d: 0.8 }, build: buildRumourBubble },
      { id: 'paper-roll', type: 'block', weight: 2, size: { w: 1.6, h: 1.7, d: 1.6 }, build: buildPaperRoll },
      { id: 'paparazzi', type: 'low', weight: 3, size: { w: 1.35, h: 0.78, d: 0.5 }, build: buildPaparazzi },
      { id: 'tabloid-bundles', type: 'low', weight: 2, size: { w: 1.5, h: 0.6, d: 0.6 }, build: buildTabloidBundles },
      { id: 'breaking-banner', type: 'high', weight: 3, size: { w: 1.96, h: 2.5, d: 0.3 }, build: buildBreakingBanner },
      { id: 'proof-line', type: 'high', weight: 2, size: { w: 1.92, h: 2.3, d: 0.5 }, build: buildProofLine },
      { id: 'newspaper-cart', type: 'mover', weight: 2, size: { w: 1.4, h: 0.78, d: 0.9 }, build: buildNewspaperCart }
    ],
    collectible: { name: 'Fact-Check Stamp', build: buildStamp },
    stops: [
      { at: 200, title: 'Singapore, 2023', landmark: { x: -7.5, build: buildStop1 }, dialogueId: 'ch5_singapore' },
      { at: 400, title: 'Taipei, June 2024', landmark: { x: 7.5, build: buildStop2 }, dialogueId: 'ch5_party' },
      { at: 600, title: 'Taipei, May 2025', landmark: { x: 7.5, build: buildStop3 }, dialogueId: 'ch5_dinner' },
      { at: 800, title: 'October 29, 2026', landmark: { x: 7.5, build: buildStop4 }, dialogueId: 'ch5_report' }
    ],
    dialogues: {
      ch5_singapore: [
        { speaker: 'Newsstand Vendor', text: 'Extra! Singapore, 2023: Megaspeed is formed. It rents out GPU computing power.' },
        { speaker: 'Newsstand Vendor', text: "It becomes an official cloud partner, later the chipmaker's largest buyer in Southeast Asia." },
        { speaker: 'Jensen', text: 'GPUs by the hour. A karaoke booth, but for matrix maths.' },
        { speaker: 'Newsstand Vendor', text: 'Corporate filings: CONFIRMED. Megaspeed denies any wrongdoing. I just sell the paper, boss.' }
      ],
      ch5_party: [
        { speaker: 'Photo Caption', text: 'Taipei, June 2024. A tech-show party. The CEO, photographed beside a Megaspeed executive, a former finance professional.' },
        { speaker: 'Jensen', text: "Tech shows: a thousand photos an hour. I'm a photo booth in a jacket." },
        { speaker: 'Photo Caption', text: 'Photo: CONFIRMED. REPORTED: he joined the group and took a whiskey shot.' },
        { speaker: 'Jensen', text: 'Two stamps, one photo. Even my parties get peer review.' }
      ],
      ch5_dinner: [
        { speaker: 'TV Chyron', text: 'LIVE-ISH: Taipei, May 2025. Same tech show. A dinner the CEO hosted.' },
        { speaker: 'TV Chyron', text: 'Footage shows the CEO and the Megaspeed executive together, leaving in the same car.' },
        { speaker: 'Jensen', text: 'I host dinners for half the tech show. The bill gets its own keynote.' },
        { speaker: 'TV Chyron', text: 'TV footage: CONFIRMED. It shows a dinner and a car. MORE AT 11.' }
      ],
      ch5_report: [
        { speaker: 'Night Editor', text: 'October 29, 2026: a newspaper reports US officials allege the Megaspeed executive has ties to Chinese intelligence.' },
        { speaker: 'Night Editor', text: 'Stamps: CONFIRMED it ran. REPORTED: the allegation.' },
        { speaker: 'Night Editor', text: 'China calls it a smear. Megaspeed denies wrongdoing.' },
        { speaker: 'Jensen', text: 'Our dealings were "completely normal".' },
        {
          speaker: 'PR Adviser', text: 'Your move.',
          choices: [
            { text: 'No comment', effects: { stock: -6, board: 8 }, next: 'ch5_report_nocomment' },
            { text: 'Call a press conference', effects: { stock: 8, board: -6 }, next: 'ch5_report_presser' }
          ]
        }
      ],
      ch5_report_nocomment: [
        { speaker: 'PR Adviser', text: 'Zero new headlines. Lawyers applaud. The ticker sulks.' }
      ],
      ch5_report_presser: [
        { speaker: 'Jensen', text: 'Ask away. The board winces. Yes, the jacket is waterproof.' }
      ]
    },
    mechanic: {
      summary: 'Fact Check streak. Each fact-check stamp collected adds 1 to a streak. Losing a heart to any obstacle resets the streak to 0. ' +
        'When the streak reaches 5, it resets to 0 and the Fact Check shield turns on for 5 seconds; reaching 5 again while it is on restarts the 5-second timer. ' +
        'While the shield is on, running into a rumour-bubble obstacle costs no heart: the bubble pops (is removed) and gives +2 Board Trust, ' +
        'up to +10 Board Trust in total for this chapter. The shield does not protect against any other obstacle. The streak starts at 0 each chapter. ' +
        'Engine needs (beyond the base API, see params.engineNeeds): call chapter.onCollect(game) on each stamp pickup, or keep a numeric game.collected count; ' +
        'call chapter.onHit(game, obstacle) before applying damage, with obstacle.kind or obstacle.id set to the obstacle id, ' +
        'and when it returns true skip the damage and remove the obstacle.',
      params: Object.assign({}, FACT, { engineNeeds: ENGINE_NEEDS })
    },
    onStart(game) {
      game.state = game.state || {};
      game.state.factCheck = freshState(game);
      say(game, 'Rainy night, wet ink. 5 fact-check stamps in a row, no bumps: a Fact Check shield that pops rumour bubbles.');
    },
    onUpdate(game, dt) {
      const s = fc(game);
      const step = Number.isFinite(dt) ? Math.min(Math.max(dt, 0), 0.25) : 0;
      // Run the timer first so a shield switched on this frame keeps its full 5 seconds.
      if (s.shieldLeft > 0) {
        s.shieldLeft = Math.max(0, s.shieldLeft - step);
        if (s.shieldLeft === 0) say(game, 'Fact Check over. Rumours are back in print.');
      }
      const hearts = heartsOf(game);
      if (hearts !== null && s.hearts !== null && hearts < s.hearts) s.streak = 0;
      s.hearts = hearts;
      if (!s.collectHook) {
        const got = collectedOf(game);
        if (got !== null && s.collected !== null && got > s.collected) gotStamps(game, s, got - s.collected);
        s.collected = got;
      }
      s.active = s.shieldLeft > 0;
    },
    // Engine hook: a stamp was picked up. Once called, onUpdate stops polling game.collected.
    onCollect(game) {
      const s = fc(game);
      s.collectHook = true;
      gotStamps(game, s, 1);
    },
    // Engine hook, called before damage. Returning true means "popped": skip the damage and remove the obstacle.
    onHit(game, obstacle) {
      const s = fc(game);
      if (s.shieldLeft > 0 && obstacleNames(obstacle).includes(FACT.popsObstacle)) {
        const bonus = Math.min(FACT.boardPerPop, FACT.boardBonusCap - s.boardEarned);
        let gained = 0;
        if (bonus > 0 && game.meters && typeof game.meters.board === 'number') {
          game.meters.board = Math.min(100, game.meters.board + bonus);
          s.boardEarned += bonus;
          gained = bonus;
        }
        say(game, gained > 0 ? 'Pop! Rumour fact-checked. Board Trust +' + gained : 'Pop! Rumour fact-checked.');
        return true;
      }
      s.streak = 0;
      return false;
    },
    endCard: {
      title: 'Filed: The Paper Trail',
      lines: [
        'CONFIRMED: corporate filings, a party photo, TV footage, and that the report was published.',
        'REPORTED: a whiskey shot, and an allegation from US officials.',
        'China calls it a smear. Megaspeed denies wrongdoing. The CEO: "completely normal".',
        'The Silhouette remains UNVERIFIED. Rumours are not news.'
      ]
    }
  };
};
