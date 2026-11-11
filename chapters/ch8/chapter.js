/* Jacket Weather - Chapter 8: "Earnings Call".
 * Content module only: geometry, dialogue, the boss-fight rules and endings.
 * Usage: require('./chapter.js')(THREE, kit)
 */
module.exports = function (THREE, kit) {
  'use strict';

  // ---------------------------------------------------------------- layout
  const LENGTH = 840;
  const STOP_BACKSTAGE = 260;
  const STOP_TELEPROMPTER = 540;
  const SPEED = { base: 16, max: 20 };

  // ---------------------------------------------------------------- palette
  const C = {
    green: '#21f07a', greenDeep: '#0f8f4c', red: '#ff2d4a', redDeep: '#8e1028',
    gold: '#ffc23a', magenta: '#ff3fd2', cyan: '#29e3ff', violet: '#3a1d63',
    ink: '#0d0a18', steel: '#3b3f52', iron: '#262833', curtain: '#5a0f2e',
    stage: '#24183d', white: '#f2eefc', leather: '#141118', orange: '#ffb02e',
  };

  // Shared materials (flat-shaded Lambert; emissive where it should glow in the dark arena).
  function lambert(color, extra) {
    const m = new THREE.MeshLambertMaterial(Object.assign({ color: color }, extra || {}));
    m.flatShading = true; // used by three.js versions whose Lambert supports it; harmless otherwise
    return m;
  }
  function glow(color, intensity) {
    return lambert(color, { emissive: color, emissiveIntensity: intensity });
  }
  function ghost(color, opacity) {
    return lambert(color, {
      emissive: color, emissiveIntensity: 0.6, transparent: true, opacity: opacity,
      depthWrite: false, side: THREE.DoubleSide,
    });
  }
  const M = {
    green: glow(C.green, 0.75),
    greenHalo: ghost(C.green, 0.25),
    red: glow(C.red, 0.55),
    redDim: lambert(C.redDeep),
    gold: glow(C.gold, 0.45),
    magenta: glow(C.magenta, 0.8),
    cyan: glow(C.cyan, 0.8),
    violet: lambert(C.violet),
    ink: lambert(C.ink),
    steel: lambert(C.steel),
    iron: lambert(C.iron),
    curtain: lambert(C.curtain),
    curtainFold: lambert('#40081f'),
    stage: lambert(C.stage),
    white: lambert(C.white),
    leather: lambert(C.leather),
    orange: glow(C.orange, 0.35),
    screen: glow('#101a3a', 0.6),
    grid: glow('#4b3a7a', 0.5),
    glass: lambert('#a8e6ff', { transparent: true, opacity: 0.35 }),
    shadow: lambert('#000000', { transparent: true, opacity: 0.45, depthWrite: false }),
    beamRed: glow('#ff5468', 1.0),
    haloRed: ghost(C.red, 0.3),
    rotor: ghost('#ff7a8a', 0.45),
    beams: [ghost(C.magenta, 0.14), ghost(C.cyan, 0.14), ghost(C.gold, 0.12)],
    bossFrame: glow(C.cyan, 0.9), // boss-only so it can flash when hit
  };

  // ---------------------------------------------------------------- mesh helpers
  // box/cyl/cone: y is the BOTTOM of the shape. ball/sign/person: y is as given (centre / feet).
  function flat(geo) {
    const g = geo.toNonIndexed();
    g.computeVertexNormals();
    return g;
  }
  function box(w, h, d, m, x, y, z) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x || 0, (y || 0) + h / 2, z || 0);
    return mesh;
  }
  function cyl(rt, rb, h, m, x, y, z, seg, theta) {
    const geo = new THREE.CylinderGeometry(rt, rb, h, seg || 8, 1, false, theta || 0);
    const mesh = new THREE.Mesh(flat(geo), m);
    mesh.position.set(x || 0, (y || 0) + h / 2, z || 0);
    return mesh;
  }
  function cone(r, h, m, x, y, z, seg) {
    const mesh = new THREE.Mesh(flat(new THREE.ConeGeometry(r, h, seg || 8)), m);
    mesh.position.set(x || 0, (y || 0) + h / 2, z || 0);
    return mesh;
  }
  function ball(r, m, x, y, z, ws, hs) {
    const mesh = new THREE.Mesh(flat(new THREE.SphereGeometry(r, ws || 8, hs || 6)), m);
    mesh.position.set(x || 0, y || 0, z || 0);
    return mesh;
  }
  function sign(text, w, h, bg, fg, x, y, z) {
    const t = kit.textPlane(text, { w: w, h: h, bg: bg, fg: fg });
    t.position.set(x || 0, y || 0, z || 0);
    return t;
  }
  function person(opts, x, y, z) {
    const p = kit.person(opts);
    p.position.set(x || 0, y || 0, z || 0);
    return p;
  }
  // A thin bar from (x1,y1) to (x2,y2) in the XY plane.
  function segment(x1, y1, x2, y2, t, m, z) {
    const len = Math.hypot(x2 - x1, y2 - y1);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(len, t, t), m);
    mesh.position.set((x1 + x2) / 2, (y1 + y2) / 2, z || 0);
    mesh.rotation.z = Math.atan2(y2 - y1, x2 - x1);
    return mesh;
  }
  function rngOf(rng) {
    return typeof rng === 'function' ? rng : Math.random;
  }
  function pick(r, list) {
    return list[Math.floor(r() * list.length) % list.length];
  }
  // Meter value with a neutral default when the engine passes an incomplete set.
  function val(m, k) {
    return m && typeof m[k] === 'number' ? m[k] : 50;
  }

  const SKINS = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac', '#a5694f'];
  const HAIRS = ['#1b1b1b', '#5a3825', '#d9b36c', '#8a2be2', '#c0c0c0'];
  const BOTTOMS = ['#1f2533', '#2c3e70', '#3b3b3b'];
  const CHEER_TOPS = [C.green, '#2bd96b', C.gold];
  const BOO_TOPS = [C.red, '#e0354f', C.magenta];
  const CHEERS = ['BUY!', 'TO THE MOON', 'NICE JACKET', 'MORE CHIPS'];
  const BOOS = ['BOO!', 'SELL!', 'GUIDANCE?', 'PRICED IN'];
  const TICKERS = [
    ['JKT +4.2%', true], ['CHIP +8.8%', true], ['HYPE +99%', true], ['FOMO +12%', true],
    ['BEAR -1.1%', false], ['COPE -3.0%', false], ['NAPS -0.5%', false],
  ];
  const HEADLINES = ['EPS: BEAT?', 'JACKET INDEX +4%', 'LIVE: EARNINGS DAY', 'GUIDANCE: ???', 'TICKER WATCH'];

  // ---------------------------------------------------------------- scenery
  // Bleachers with a cheering/booing crowd holding signs.
  function buildCrowd(rng) {
    const r = rngOf(rng);
    const g = new THREE.Group();
    g.add(box(5, 0.5, 1.2, M.stage, 0, 0, 1.2));
    g.add(box(5, 1.0, 1.2, M.stage, 0, 0, 0));
    g.add(box(5, 1.5, 1.2, M.stage, 0, 0, -1.2));
    for (let i = 0; i < 3; i++) {
      const tier = Math.floor(r() * 3) % 3;
      const cheer = r() < 0.6;
      const x = -1.6 + i * 1.6 + (r() - 0.5) * 0.5;
      const yb = 0.5 * (tier + 1);
      const z = 1.2 - tier * 1.2;
      g.add(person({
        look: (i + tier) % 2 ? 'female' : 'male', skin: pick(r, SKINS), hair: pick(r, HAIRS),
        top: pick(r, cheer ? CHEER_TOPS : BOO_TOPS), bottom: pick(r, BOTTOMS),
      }, x, yb, z));
      g.add(box(0.05, 0.6, 0.05, M.steel, x + 0.3, yb + 1.5, z + 0.2));
      if (i === 1) {
        g.add(sign(pick(r, cheer ? CHEERS : BOOS), 1.1, 0.42, cheer ? C.green : C.red, C.ink, x + 0.3, yb + 2.3, z + 0.23));
      } else {
        g.add(box(0.7, 0.42, 0.05, cheer ? M.green : M.red, x + 0.3, yb + 2.1, z + 0.22));
      }
    }
    return g;
  }

  // Giant LED screen on legs showing a candle chart and a headline.
  function buildGiantScreen(rng) {
    const r = rngOf(rng);
    const g = new THREE.Group();
    g.add(box(1.2, 0.2, 1.2, M.iron, -6, 0, 0));
    g.add(box(1.2, 0.2, 1.2, M.iron, 6, 0, 0));
    g.add(box(0.4, 9, 0.4, M.steel, -6, 0, 0));
    g.add(box(0.4, 9, 0.4, M.steel, 6, 0, 0));
    g.add(box(12.4, 7, 0.4, M.iron, 0, 4, -0.1));
    g.add(box(12, 6.6, 0.1, M.screen, 0, 4.2, 0.15));
    for (let i = 0; i < 8; i++) {
      const up = r() < 0.62;
      const h = 0.6 + r() * 2.4;
      g.add(box(0.7, h, 0.06, up ? M.green : M.red, -4.9 + i * 1.4, 4.6 + r() * 1.2, 0.24));
    }
    g.add(sign(pick(r, HEADLINES), 6.5, 1.1, '#101a3a', C.white, 0, 9.95, 0.25));
    g.add(sign('LIVE', 1.2, 0.5, C.red, C.white, 5.2, 10.3, 0.26));
    return g;
  }

  // Lighting tower with moving-head lamps and two coloured beams.
  function buildLightTower(rng) {
    const r = rngOf(rng);
    const g = new THREE.Group();
    g.add(box(1.0, 0.25, 1.0, M.iron, 0, 0, 0));
    g.add(box(0.3, 8, 0.3, M.steel, 0, 0, 0));
    g.add(box(2.4, 0.25, 0.3, M.steel, 0, 8, 0));
    for (let i = 0; i < 3; i++) {
      const x = -1 + i;
      g.add(box(0.35, 0.35, 0.35, M.ink, x, 7.65, 0.1));
      g.add(box(0.22, 0.22, 0.04, i === 1 ? M.gold : M.magenta, x, 7.72, 0.29));
    }
    const a = cone(1.0, 7, pick(r, M.beams), -1, 0.6, 0.3, 12);
    a.rotation.z = -0.25;
    g.add(a);
    const b = cone(1.0, 7, pick(r, M.beams), 1, 0.6, 0.3, 12);
    b.rotation.z = 0.25;
    g.add(b);
    return g;
  }

  // Roadside LED ticker sign on a low rail.
  function buildTickerRail(rng) {
    const r = rngOf(rng);
    const t = pick(r, TICKERS);
    const g = new THREE.Group();
    g.add(box(0.25, 0.5, 16, M.violet, 0, 0, 0));
    g.add(box(0.1, 0.05, 16, M.cyan, 0, 0.5, 0));
    g.add(box(0.12, 1.2, 0.12, M.steel, -1.0, 0, 0));
    g.add(box(0.12, 1.2, 0.12, M.steel, 1.0, 0, 0));
    g.add(box(2.4, 0.8, 0.2, M.ink, 0, 1.2, 0));
    g.add(sign(t[0], 2.2, 0.6, C.ink, t[1] ? C.green : C.red, 0, 1.6, 0.11));
    g.add(box(2.4, 0.06, 0.22, t[1] ? M.green : M.red, 0, 2.0, 0));
    return g;
  }

  // Press camera crane with an operator.
  function buildCameraCrane(rng) {
    const r = rngOf(rng);
    const g = new THREE.Group();
    g.add(box(1.6, 0.3, 1.2, M.iron, 0, 0.15, 0));
    for (const wx of [-0.7, 0.7]) {
      for (const wz of [-0.5, 0.5]) {
        const w = cyl(0.15, 0.15, 0.12, M.ink, wx, 0, wz, 8);
        w.rotation.z = Math.PI / 2;
        w.position.y = 0.15;
        g.add(w);
      }
    }
    g.add(box(0.3, 2.2, 0.3, M.steel, 0, 0.45, 0));
    const arm = box(0.2, 0.2, 4.2, M.steel, 0, 2.6, 0.6);
    arm.rotation.x = -0.35;
    g.add(arm);
    g.add(box(0.5, 0.5, 0.5, M.iron, 0, 1.75, -1.5));
    g.add(box(0.5, 0.4, 0.7, M.ink, 0, 3.15, 2.5));
    const lens = cyl(0.12, 0.12, 0.25, M.cyan, 0, 3.25, 2.9, 8);
    lens.rotation.x = Math.PI / 2;
    g.add(lens);
    g.add(person({ skin: pick(r, SKINS), hair: pick(r, HAIRS), top: '#2c3e70', bottom: '#1f2533', accessory: 'headset' }, 1.1, 0, 0.2));
    g.add(sign('PRESS', 1.2, 0.3, C.gold, C.ink, 0, 0.3, 0.61));
    return g;
  }

  // Speaker stack with pyro flames on top.
  function buildSpeakerPyro(rng) {
    const r = rngOf(rng);
    const g = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      g.add(box(2, 1.2, 1.2, M.ink, 0, i * 1.2, 0));
      for (const wx of [-0.5, 0.5]) {
        const woofer = cyl(0.38, 0.38, 0.06, M.steel, wx, 0, 0.62, 10);
        woofer.rotation.x = Math.PI / 2;
        woofer.position.y = i * 1.2 + 0.6;
        g.add(woofer);
      }
    }
    g.add(box(1.6, 0.3, 0.8, M.iron, 0, 3.6, 0));
    const tall = 1.2 + r() * 1.0;
    g.add(cone(0.35, tall, M.orange, -0.4, 3.9, 0, 6));
    g.add(cone(0.25, tall * 0.7, M.gold, 0.4, 3.9, 0, 6));
    return g;
  }

  // ---------------------------------------------------------------- obstacles (The Ticker's attacks)
  // Red candle slammed into a lane (block).
  function buildRedCandle() {
    const g = new THREE.Group();
    g.add(cyl(0.82, 0.82, 0.04, M.ink, 0, 0, 0, 10));
    g.add(box(1.2, 2.0, 1.0, M.red, 0, 0, 0));
    g.add(box(1.26, 0.12, 1.06, M.redDim, 0, 1.88, 0));
    g.add(box(1.26, 0.12, 1.06, M.redDim, 0, 0.04, 0));
    g.add(box(0.16, 0.8, 0.16, M.red, 0, 2.0, 0));
    g.add(sign('-12%', 0.9, 0.42, C.redDeep, C.white, 0, 1.25, 0.51));
    const shards = [[-0.62, 0.48, 0.3, 0.5, 0.2], [0.6, -0.45, -0.2, 0.9, 0.3], [0.52, 0.55, 0.5, 0.2, -0.3]];
    for (const s of shards) {
      const m = box(0.18, 0.1, 0.16, M.redDim, s[0], 0.08, s[1]);
      m.rotation.set(s[2], s[3], s[4]);
      g.add(m);
    }
    return g;
  }

  // Margin-call weight dropped into a lane (block).
  function buildMarginCall() {
    const g = new THREE.Group();
    g.add(cyl(0.85, 0.85, 0.04, M.ink, 0, 0, 0, 10));
    g.add(cyl(0.62, 1.0, 1.4, M.iron, 0, 0.02, 0, 4, Math.PI / 4)); // square frustum, no mesh rotation
    g.add(box(0.12, 0.42, 0.18, M.steel, -0.3, 1.42, 0));
    g.add(box(0.12, 0.42, 0.18, M.steel, 0.3, 1.42, 0));
    g.add(box(0.72, 0.12, 0.18, M.steel, 0, 1.84, 0));
    for (let i = 0; i < 4; i++) {
      g.add(i % 2 ? box(0.2, 0.4, 0.06, M.steel, 0, 1.96 + i * 0.38, 0) : box(0.06, 0.4, 0.2, M.steel, 0, 1.96 + i * 0.38, 0));
    }
    const label = sign('MARGIN CALL', 1.05, 0.3, C.gold, C.ink, 0, 0.7, 0.6);
    label.rotation.x = -0.19;
    g.add(label);
    return g;
  }

  // Analyst question bouncing along the ground (low).
  function buildAnalystQuestion() {
    const g = new THREE.Group();
    g.add(cyl(0.55, 0.55, 0.02, M.shadow, 0, 0, 0, 10));
    const b = ball(0.42, M.orange, 0, 0.4, 0, 10, 8);
    b.scale.set(1.15, 0.8, 1);
    g.add(b);
    const tail = cone(0.12, 0.2, M.orange, -0.3, 0.04, 0.1, 6);
    tail.rotation.x = Math.PI;
    g.add(tail);
    g.add(sign('?', 0.46, 0.46, C.orange, C.ink, 0, 0.4, 0.43));
    return g;
  }

  // "GUIDANCE CUT" laser beam at head height (high: slide under).
  function buildGuidanceCut() {
    const g = new THREE.Group();
    const y0 = 1.15;
    g.add(box(0.2, 0.85, 0.3, M.steel, -0.86, y0, 0));
    g.add(box(0.2, 0.85, 0.3, M.steel, 0.86, y0, 0));
    g.add(box(0.22, 0.06, 0.32, M.magenta, -0.86, y0 + 0.85, 0));
    g.add(box(0.22, 0.06, 0.32, M.magenta, 0.86, y0 + 0.85, 0));
    g.add(box(0.08, 0.16, 0.16, M.red, -0.72, 1.32, 0));
    g.add(box(0.08, 0.16, 0.16, M.red, 0.72, 1.32, 0));
    g.add(box(1.36, 0.1, 0.1, M.beamRed, 0, 1.35, 0));
    g.add(box(1.36, 0.3, 0.3, M.haloRed, 0, 1.25, 0));
    g.add(sign('GUIDANCE CUT', 1.48, 0.34, C.red, C.white, 0, 1.82, 0.02));
    return g;
  }

  // Short-seller drone: a "short" drone skimming the floor in a top hat (mover, low-sized).
  function buildShortSeller() {
    const g = new THREE.Group();
    g.add(cyl(0.6, 0.6, 0.02, M.shadow, 0, 0, 0, 10));
    g.add(box(0.7, 0.22, 0.5, M.ink, 0, 0.3, 0));
    g.add(box(0.34, 0.08, 0.04, M.red, 0, 0.37, 0.26));
    g.add(box(1.1, 0.05, 0.08, M.steel, 0, 0.47, 0.25));
    g.add(box(1.1, 0.05, 0.08, M.steel, 0, 0.47, -0.25));
    for (const sx of [-0.55, 0.55]) {
      for (const sz of [-0.25, 0.25]) g.add(cyl(0.2, 0.2, 0.03, M.rotor, sx, 0.52, sz, 10));
    }
    g.add(cyl(0.2, 0.2, 0.03, M.ink, 0, 0.52, 0, 8));
    g.add(cyl(0.13, 0.13, 0.18, M.ink, 0, 0.55, 0, 8));
    g.add(cyl(0.135, 0.135, 0.04, M.red, 0, 0.56, 0, 8));
    g.add(sign('SHORT', 0.56, 0.2, C.red, C.white, 0, 0.18, 0.26));
    return g;
  }

  // ---------------------------------------------------------------- collectible
  function buildGreenCandle() {
    const g = new THREE.Group();
    g.add(box(0.05, 0.1, 0.05, M.green, 0, 0.2, 0));
    g.add(box(0.2, 0.3, 0.2, M.green, 0, 0.3, 0));
    g.add(box(0.05, 0.12, 0.05, M.green, 0, 0.6, 0));
    g.add(ball(0.26, M.greenHalo, 0, 0.46, 0, 8, 6));
    return g;
  }

  // ---------------------------------------------------------------- boss: The Ticker
  function buildTicker() {
    const g = new THREE.Group();
    const rig = new THREE.Group(); // bobs inside g so the engine can own g.position
    g.add(rig);
    const B = 3.2; // panel bottom: the boss hovers, its origin stays on the ground
    const Z = 0.3; // face features sit just in front of the panel
    rig.add(box(5.6, 4.4, 0.5, M.ink, 0, B, 0));
    rig.add(box(5.9, 0.15, 0.6, M.bossFrame, 0, B - 0.15, 0));
    rig.add(box(5.9, 0.15, 0.6, M.bossFrame, 0, B + 4.4, 0));
    rig.add(box(0.15, 4.4, 0.6, M.bossFrame, -2.875, B, 0));
    rig.add(box(0.15, 4.4, 0.6, M.bossFrame, 2.875, B, 0));
    for (let i = 1; i <= 3; i++) rig.add(box(5.4, 0.04, 0.02, M.grid, 0, B + i * 1.1, 0.26));
    // Eyes: a tall green candle and a short red one each, with a white glint.
    for (const cx of [-1.3, 1.3]) {
      rig.add(box(0.07, 1.5, 0.07, M.green, cx - 0.28, 5.55, Z));
      rig.add(box(0.4, 1.0, 0.12, M.green, cx - 0.28, 5.8, Z));
      rig.add(box(0.07, 1.0, 0.07, M.red, cx + 0.28, 5.8, Z));
      rig.add(box(0.4, 0.6, 0.12, M.red, cx + 0.28, 6.0, Z));
      rig.add(box(0.14, 0.14, 0.04, M.white, cx - 0.22, 6.45, Z + 0.08));
    }
    // Angry candle brows.
    const browL = box(1.1, 0.22, 0.12, M.red, -1.3, 7.05, Z);
    browL.rotation.z = -0.3;
    rig.add(browL);
    const browR = box(1.1, 0.22, 0.12, M.red, 1.3, 7.05, Z);
    browR.rotation.z = 0.3;
    rig.add(browR);
    // Grin: seven candlesticks on a U curve, alternating green and red.
    const mouth = [];
    for (let i = 0; i < 7; i++) {
      const x = -1.8 + i * 0.6;
      const yb = 3.75 + 0.09 * (i - 3) * (i - 3);
      const m = i % 2 ? M.red : M.green;
      rig.add(box(0.06, 0.95, 0.06, m, x, yb - 0.2, Z));
      const body = box(0.36, 0.55, 0.12, m, x, yb, Z);
      rig.add(body);
      mouth.push(body);
    }
    // Ticker band and crown.
    rig.add(box(3.6, 0.8, 0.3, M.violet, 0, 7.85, 0));
    rig.add(sign('THE TICKER', 3.3, 0.6, C.violet, C.gold, 0, 8.25, 0.16));
    for (const sx of [-1.2, 0, 1.2]) rig.add(cone(0.2, 0.6, M.gold, sx, 8.65, 0, 6));
    // Line-chart arms: bull arm up on the left, bear arm down on the right.
    const armL = [[-2.95, 4.6], [-3.4, 4.1], [-3.75, 4.9], [-3.95, 5.9]];
    const armR = [[2.95, 6.0], [3.4, 6.4], [3.7, 5.4], [3.95, 4.4]];
    for (let i = 0; i < 3; i++) {
      rig.add(segment(armL[i][0], armL[i][1], armL[i + 1][0], armL[i + 1][1], 0.16, M.green, 0));
      rig.add(segment(armR[i][0], armR[i][1], armR[i + 1][0], armR[i + 1][1], 0.16, M.red, 0));
    }
    rig.add(cone(0.25, 0.5, M.green, -3.95, 5.85, 0, 6));
    const down = cone(0.25, 0.5, M.red, 3.95, 3.95, 0, 6);
    down.rotation.z = Math.PI;
    rig.add(down);
    // Dangling candle "tentacles" under the panel.
    for (let i = 0; i < 3; i++) {
      const x = -1.6 + i * 1.6;
      const m = i === 1 ? M.red : M.green;
      rig.add(box(0.08, 1.2, 0.08, m, x, 1.85, 0));
      rig.add(box(0.3, 0.4, 0.3, m, x, 2.2, 0));
    }
    rig.add(cyl(2.4, 2.4, 0.05, M.greenHalo, 0, 1.2, 0, 16));

    g.userData.isBoss = true;
    g.userData.hitUntil = -1;
    g.userData.hit = function (t) { g.userData.hitUntil = (t || 0) + 0.8; };
    g.userData.tick = function (t) {
      rig.position.y = Math.sin(t * 1.6) * 0.25;
      mouth.forEach(function (m, i) { m.scale.y = 1 + 0.18 * Math.sin(t * 5 + i); });
      const hit = t < g.userData.hitUntil;
      M.bossFrame.color.set(hit ? C.red : C.cyan);
      M.bossFrame.emissive.set(hit ? C.red : C.cyan);
    };
    return g;
  }

  // ---------------------------------------------------------------- landmarks
  // Backstage: curtain, road case, spare jacket on a rack, and the nervous CFO.
  function buildBackstage() {
    const g = new THREE.Group();
    g.add(box(6, 4.5, 0.3, M.curtain, 0, 0, -1.5));
    g.add(box(0.35, 4.5, 0.4, M.curtainFold, -1.8, 0, -1.3));
    g.add(box(0.35, 4.5, 0.4, M.curtainFold, 1.8, 0, -1.3));
    g.add(sign('BACKSTAGE', 2.6, 0.6, '#1a0b2e', C.gold, 0, 3.9, -1.08));
    g.add(box(1.4, 0.9, 0.9, M.iron, 1.7, 0, 0.2));
    g.add(box(1.44, 0.08, 0.94, M.steel, 1.7, 0.42, 0.2));
    g.add(sign('FRAGILE: GUIDANCE', 1.2, 0.22, C.iron, C.gold, 1.7, 0.66, 0.66));
    g.add(box(0.06, 1.75, 0.06, M.steel, -2.6, 0, 0));
    g.add(box(0.06, 1.75, 0.06, M.steel, -1.2, 0, 0));
    g.add(box(1.5, 0.06, 0.06, M.steel, -1.9, 1.72, 0));
    g.add(box(0.62, 0.78, 0.2, M.leather, -1.9, 0.9, 0));
    g.add(person({ skin: '#e8b894', hair: '#6b4a2b', top: '#2c3e70', bottom: '#1f2533', accessory: 'glasses' }, 0, 0, 0.3));
    g.add(box(0.34, 0.44, 0.04, M.white, 0.35, 0.95, 0.62));
    g.add(ball(0.05, M.cyan, 0.24, 1.82, 0.42, 6, 4));
    g.add(ball(0.04, M.cyan, -0.22, 1.76, 0.42, 6, 4));
    return g;
  }

  // Mid-stage: crashed teleprompters, a stand-by screen and the Stage Manager.
  function buildTeleprompter() {
    const g = new THREE.Group();
    g.add(box(6, 0.3, 3, M.stage, 0, 0, 0));
    g.add(box(6, 0.06, 0.06, M.cyan, 0, 0.3, 1.47));
    g.add(box(4.2, 3.1, 0.2, M.screen, 0, 0.3, -1.3));
    g.add(sign('PLEASE STAND BY', 3.2, 0.6, '#101a3a', C.cyan, 0, 2.6, -1.18));
    const texts = ['ERROR 404', 'APPLAUSE.EXE NOT FOUND'];
    for (let i = 0; i < 2; i++) {
      const x = i ? 1.6 : -1.6;
      g.add(box(0.5, 0.05, 0.5, M.iron, x, 0.3, 0.2));
      g.add(cyl(0.05, 0.05, 1.25, M.steel, x, 0.35, 0.2, 6));
      const pane = box(0.8, 0.6, 0.02, M.glass, x, 1.45, 0.2);
      pane.rotation.x = -0.6;
      g.add(pane);
      const t = sign(texts[i], 0.76, 0.3, C.ink, i ? C.gold : C.red, x, 1.78, 0.24);
      t.rotation.x = -0.6;
      g.add(t);
    }
    const wedge = box(1.0, 0.5, 0.6, M.ink, 0, 0.3, 1.0);
    wedge.rotation.x = -0.3;
    g.add(wedge);
    g.add(sign('INSERT VISION HERE', 0.9, 0.24, C.ink, C.cyan, 0, 0.62, 1.36));
    g.add(cone(0.06, 0.25, M.gold, -1.85, 1.95, 0.25, 4));
    g.add(cone(0.05, 0.2, M.gold, -1.4, 2.0, 0.3, 4));
    g.add(person({ skin: '#c68642', hair: '#1b1b1b', top: C.ink, bottom: '#1f2533', accessory: 'headset' }, 0.4, 0.3, 0.1));
    return g;
  }

  // Final podium: stage, lectern, results screen, spotlight and The Analyst.
  function buildPodium() {
    const g = new THREE.Group();
    g.add(box(7, 0.6, 4, M.stage, 0, 0, 0));
    g.add(box(7, 0.08, 0.08, M.gold, 0, 0.6, 1.96));
    g.add(box(6.5, 3.5, 0.2, M.screen, 0, 0.6, -1.8));
    g.add(sign('EARNINGS DAY', 4, 0.9, '#101a3a', C.green, 0, 3.3, -1.68));
    g.add(sign('GUIDANCE: ?', 3, 0.6, '#101a3a', C.gold, 0, 2.2, -1.68));
    g.add(box(0.9, 1.1, 0.6, M.leather, 0, 0.6, 0.4));
    const top = box(1.0, 0.08, 0.7, M.gold, 0, 1.7, 0.4);
    top.rotation.x = 0.25;
    g.add(top);
    g.add(sign('Q&A', 0.6, 0.3, C.leather, C.gold, 0, 1.25, 0.71));
    for (const mx of [-0.2, 0.2]) {
      const mic = cyl(0.02, 0.02, 0.4, M.steel, mx, 1.75, 0.55, 5);
      mic.rotation.x = 0.5;
      g.add(mic);
    }
    g.add(person({ look: 'female', skin: '#ffdbac', hair: '#d9b36c', top: '#5b6cff', bottom: '#3b3b3b', accessory: 'glasses' }, 2.9, 0, 2.6));
    g.add(box(0.06, 0.25, 0.06, M.ink, 2.7, 1.3, 2.9));
    g.add(cone(1.1, 5.4, M.beams[2], 0, 0.6, 0.4, 12));
    return g;
  }

  // ---------------------------------------------------------------- obstacles table
  // size = measured bounding box: w = x extent, h = top height above ground, d = z extent.
  const obstacles = [
    { id: 'red-candle', type: 'block', weight: 3, size: { w: 1.56, h: 2.8, d: 1.64 }, build: buildRedCandle },
    { id: 'margin-call', type: 'block', weight: 2, size: { w: 1.62, h: 3.5, d: 1.7 }, build: buildMarginCall },
    { id: 'analyst-question', type: 'low', weight: 3, size: { w: 1.05, h: 0.74, d: 1.1 }, build: buildAnalystQuestion },
    { id: 'guidance-cut', type: 'high', weight: 2, size: { w: 1.94, h: 2.06, d: 0.32 }, build: buildGuidanceCut },
    { id: 'short-seller', type: 'mover', weight: 2, size: { w: 1.48, h: 0.73, d: 1.2 }, build: buildShortSeller },
  ];
  const weightOf = {};
  obstacles.forEach(function (o) { weightOf[o.id] = o.weight; });

  // ---------------------------------------------------------------- boss-fight rules (single source of truth)
  const BASE_MIX = ['red-candle', 'analyst-question', 'margin-call'];
  const params = {
    candlesToWin: 8,
    firstAttackAfter: 40, // metres after a phase starts
    quietBeforeStop: 30,  // no attacks in the last N metres before the phase's stop
    candlesPerGap: 3,
    candleSpacing: 2.5,
    spawnAhead: 70,       // items spawn when they are this many metres ahead of the hero
    speedEase: 4,         // m/s gained per second while below the phase speed
    reward: { stock: 5, board: 3 },
    lanes: [-1, 0, 1],    // used for game.spawn lanes and for reading game.hero.lane
    collectHook: 'onCollect', // the engine should call chapter.onCollect(game) once per green candle
    collectFallback: { maxHeroY: 1.0 }, // own pickup test, used only without onCollect or a counter
    phases: [
      { name: 'Pre-Market', from: 0, to: STOP_BACKSTAGE, speed: 16, attackEvery: 28, adds: null, mix: BASE_MIX.slice() },
      { name: 'The Call', from: STOP_BACKSTAGE, to: STOP_TELEPROMPTER, speed: 18, attackEvery: 24, adds: 'guidance-cut', mix: BASE_MIX.concat(['guidance-cut']) },
      { name: 'Q&A', from: STOP_TELEPROMPTER, to: LENGTH, speed: 20, attackEvery: 20, adds: 'short-seller', mix: BASE_MIX.concat(['guidance-cut', 'short-seller']) },
    ],
  };
  const ADD_LABEL = {
    'guidance-cut': 'GUIDANCE CUT beams. Slide!',
    'short-seller': 'short-seller drone. Jump it!',
  };

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function pickWeighted(mix, r) {
    let total = 0;
    mix.forEach(function (id) { total += weightOf[id] || 1; });
    let x = r() * total;
    for (let i = 0; i < mix.length; i++) {
      x -= weightOf[mix[i]] || 1;
      if (x < 0) return mix[i];
    }
    return mix[mix.length - 1];
  }
  // Every item of one phase, sorted by track position `at` (metres from the start).
  function planPhase(i) {
    const p = params.phases[i];
    const r = mulberry32(0x8e8 + i);
    const items = [];
    const first = p.from + params.firstAttackAfter;
    const last = p.to - params.quietBeforeStop;
    let prev = null;
    for (let at = first; at <= last; at += p.attackEvery) {
      const kind = prev === null && p.adds ? p.adds : pickWeighted(p.mix, r);
      items.push({ at: at, kind: kind, lane: pick(r, params.lanes) });
      if (prev !== null) {
        const mid = (prev + at) / 2;
        const lane = pick(r, params.lanes);
        const half = (params.candlesPerGap - 1) / 2;
        for (let k = 0; k < params.candlesPerGap; k++) {
          items.push({ at: mid + (k - half) * params.candleSpacing, kind: 'collectible', lane: lane });
        }
      }
      prev = at;
    }
    items.sort(function (a, b) { return a.at - b.at; });
    return items;
  }
  function phaseAt(d) {
    for (let i = 0; i < params.phases.length; i++) if (d < params.phases[i].to) return i;
    return params.phases.length - 1;
  }
  function say(game, text) {
    if (game && typeof game.say === 'function') game.say(text);
  }
  function freshCounts() {
    return { hook: 0, counter: 0, lane: 0 };
  }
  function stateOf(game) {
    if (!game.state || typeof game.state !== 'object') game.state = {};
    if (!game.state.ch8) {
      game.state.ch8 = {
        phase: -1, phaseName: '', count: 0, need: params.candlesToWin,
        beaten: params.phases.map(function () { return false; }),
        announced: params.phases.map(function () { return false; }),
        queue: [],
        // Collect sources, in priority order: onCollect calls, an engine counter, the chapter's own lane test.
        hooked: false, counterSeen: false, lastTotal: null, src: freshCounts(),
        pending: [], // spawned candles not yet passed, for the lane test
      };
    }
    return game.state.ch8;
  }
  // Best-effort read of an engine collect counter (not in the documented API).
  function collectedTotal(game) {
    const c = [game.collected, game.collects, game.collectCount, game.state && game.state.collected];
    for (let i = 0; i < c.length; i++) if (typeof c[i] === 'number' && isFinite(c[i])) return c[i];
    return null;
  }
  function startPhase(st, i) {
    st.phase = i;
    st.phaseName = params.phases[i].name;
    st.count = 0;
    st.src = freshCounts();
    st.queue = planPhase(i);
  }
  function beatPhase(game, st, i) {
    st.beaten[i] = true;
    st.queue = [];
    const m = game.meters;
    if (m) {
      Object.keys(params.reward).forEach(function (k) {
        if (typeof m[k] === 'number') m[k] = Math.max(0, Math.min(100, m[k] + params.reward[k]));
      });
    }
    say(game, i === params.phases.length - 1
      ? 'Eight green candles launched! The Ticker is stunned. To the podium!'
      : 'Eight green candles launched! The Ticker reels. Phase ' + (i + 1) + ' cleared!');
    if (game.boss && game.boss.userData && typeof game.boss.userData.hit === 'function') game.boss.userData.hit(game.time || 0);
  }
  // Each source keeps its own tally; the highest-priority source seen so far decides, so nothing is counted twice.
  function registerCollect(game, st, source, n) {
    const i = st.phase;
    if (i < 0 || st.beaten[i]) return;
    st.src[source] += n;
    st.count = st.hooked ? st.src.hook : st.counterSeen ? st.src.counter : st.src.lane;
    if (st.count >= params.candlesToWin) beatPhase(game, st, i);
  }
  // Fallback pickup using only documented fields: a candle counts when the run passes it
  // while the hero is in its lane and below maxHeroY.
  function collectByLane(game, st, d) {
    const h = game.hero;
    while (st.pending.length && st.pending[0].at <= d) {
      const c = st.pending.shift();
      if (!h || typeof h.lane !== 'number') continue;
      const y = typeof h.y === 'number' ? h.y : 0;
      if (Math.round(h.lane) === c.lane && y < params.collectFallback.maxHeroY && phaseAt(c.at) === st.phase) {
        registerCollect(game, st, 'lane', 1);
      }
    }
  }

  // ---------------------------------------------------------------- chapter
  return {
    id: 'ch8',
    title: 'Earnings Call',
    dateline: 'Earnings Day',
    outfit: 'jacket',
    hideMeters: false,
    length: LENGTH,
    speed: { base: SPEED.base, max: SPEED.max },
    frontPage: {
      headline: 'TICKER MONSTER CRASHES EARNINGS DAY',
      sub: 'Analysts sharpen questions, CFO sharpens pencils, one man polishes a jacket.',
    },
    theme: {
      sky: '#07040f', fog: '#160a29', fogNear: 18, fogFar: 115,
      ground: '#0d0818', road: '#1c1430', laneLine: '#29ff8a',
      lightColor: '#ffd9f4', lightIntensity: 0.85, ambient: '#3d2c66',
    },
    scenery: [
      { id: 'crowd-stand', side: 'both', every: 12, offset: 9, build: buildCrowd },
      { id: 'giant-screen', side: 'both', every: 70, offset: 15, build: buildGiantScreen },
      { id: 'light-tower', side: 'both', every: 32, offset: 7, build: buildLightTower },
      { id: 'ticker-rail', side: 'both', every: 20, offset: 6, build: buildTickerRail },
      { id: 'camera-crane', side: 'right', every: 90, offset: 10, build: buildCameraCrane },
      { id: 'speaker-pyro', side: 'left', every: 50, offset: 11, build: buildSpeakerPyro },
    ],
    obstacles: obstacles,
    collectible: { name: 'Green Candle', build: buildGreenCandle },
    boss: { name: 'The Ticker', build: buildTicker },
    stops: [
      { at: STOP_BACKSTAGE, title: 'Backstage', landmark: { x: -6.5, build: buildBackstage }, dialogueId: 'ch8_backstage' },
      { at: STOP_TELEPROMPTER, title: 'Teleprompter Down', landmark: { x: 6.5, build: buildTeleprompter }, dialogueId: 'ch8_teleprompter' },
      { at: LENGTH, title: 'The Podium', landmark: { x: -7, build: buildPodium }, dialogueId: 'ch8_podium' },
    ],
    // Nodes in a dialogue play top to bottom; `next` (on a node or a choice) jumps to another dialogue id.
    dialogues: {
      ch8_backstage: [
        { speaker: 'The CFO', text: 'We are live in ninety seconds. I have practised "no comment" in eleven languages.' },
        { speaker: 'The CFO', text: 'Analysts will ask about all the cheap, free AI models.' },
        { speaker: 'Jensen', text: 'Free AI should be great for hardware. Free AI should be great for chips.' },
        { speaker: 'The CFO', text: 'And The Ticker? Eight green candles to the face. I will be here, hugging a spreadsheet.' },
      ],
      ch8_teleprompter: [
        { speaker: 'Stage Manager', text: 'The teleprompter crashed! It just says INSERT VISION HERE.' },
        { speaker: 'Jensen', text: 'Good. Now I can say what I actually think.' },
        { speaker: 'Stage Manager', text: 'That is exactly what Legal was afraid of.' },
        { speaker: 'Teleprompter', text: 'REBOOTING... APPLAUSE.EXE NOT FOUND.' },
        { speaker: 'Jensen', text: 'Point at the chart, say "incredible", keep running. Proven framework.' },
      ],
      ch8_podium: [
        { speaker: 'The Ticker', text: 'ONE LAST QUESTION, JACKET MAN. WHAT IS YOUR GUIDANCE?' },
        { speaker: 'The Analyst', text: 'The whole market is listening. No pressure. Well, some pressure. All of it, actually.' },
        {
          speaker: 'Jensen', text: 'Next quarter, we will...',
          choices: [
            { text: 'Raise guidance', effects: { stock: 12, board: -6 }, next: 'ch8_podium_raise' },
            { text: 'Under-promise', effects: { stock: -5, board: 10 }, next: 'ch8_podium_under' },
          ],
        },
      ],
      ch8_podium_raise: [
        { speaker: 'The Ticker', text: 'GREEN! SO MUCH GREEN! I FEEL... BULLISH.' },
        { speaker: 'The Analyst', text: 'Bold call. Somewhere, a board member just bought antacids in bulk.' },
      ],
      ch8_podium_under: [
        { speaker: 'The Ticker', text: 'UNDER-PROMISE? BORING. SUSTAINABLE. I HATE THAT I RESPECT IT.' },
        { speaker: 'The Analyst', text: 'The board is nodding. The stock is sulking. Classic.' },
      ],
    },
    mechanic: {
      summary:
        'Boss fight against The Ticker in 3 phases, one per run segment: phase 1 from the start to the backstage stop (260 m), ' +
        'phase 2 from there to the teleprompter stop (540 m), phase 3 from there to the podium (840 m). ' +
        'In each phase attacks are placed from 40 m after the phase starts until 30 m before its stop, one every 28 / 24 / 20 m ' +
        '(phase 1 / 2 / 3), each in a uniformly random lane (-1, 0 or 1), its kind picked by obstacle weight from the phase mix: ' +
        'phase 1 red candles, analyst questions and margin calls; phase 2 adds guidance-cut beams; phase 3 adds the short-seller drone. ' +
        'The first attack of phases 2 and 3 is always the newly added kind. ' +
        'In every gap between two consecutive attacks, 3 green candles are placed 2.5 m apart in one random lane, centred on the gap midpoint. ' +
        'Each item spawns when it is 70 m ahead of the hero. Green candles collected during a phase count toward that phase. ' +
        'The engine should call chapter.onCollect(game) once per green candle picked up. If it never does and exposes no collect counter ' +
        '(game.collected), the chapter counts a candle itself when game.distance passes the candle\'s position while round(game.hero.lane) ' +
        'equals the candle\'s lane and game.hero.y is below 1.0 m. ' +
        'The 8th candle of a phase launches them at The Ticker: the phase is beaten, its not-yet-spawned items are cancelled (calm until the next stop), ' +
        'and Stock +5 and Board +3 (kept within 0-100). Reaching the stop first ends the phase with no reward or penalty; the count resets each phase. ' +
        'While the hero is moving, speed rises by 4 m/s per second until it reaches the phase speed (16 / 18 / 20 m/s); this rule never slows the hero.',
      params: params,
    },
    onStart: function (game) {
      if (!game) return;
      const st = stateOf(game);
      startPhase(st, 0);
      st.announced[0] = true;
      say(game, 'THE TICKER rises over the arena! Grab 8 green candles to strike back.');
    },
    // Engine hook: call once per green candle collected (see mechanic.params.collectHook).
    onCollect: function (game) {
      if (!game) return;
      const st = stateOf(game);
      st.hooked = true;
      st.pending.length = 0;
      registerCollect(game, st, 'hook', 1);
    },
    onUpdate: function (game, dt) {
      if (!game) return;
      const st = stateOf(game);
      const step = dt > 0 ? Math.min(dt, 0.1) : 0;
      const d = typeof game.distance === 'number' ? game.distance : 0;
      const i = phaseAt(d);
      const p = params.phases[i];

      if (i !== st.phase) startPhase(st, i);
      if (!st.announced[i] && d >= p.from + 5) {
        st.announced[i] = true;
        say(game, p.adds
          ? 'Phase ' + (i + 1) + ': ' + p.name + '. New attack: ' + ADD_LABEL[p.adds] + ' Need 8 green candles.'
          : 'THE TICKER attacks! Grab 8 green candles to strike back.');
      }

      if (!st.hooked) {
        const total = collectedTotal(game);
        if (total !== null) {
          if (!st.counterSeen) {
            st.counterSeen = true;
            st.pending.length = 0;
          } else if (total > st.lastTotal) {
            registerCollect(game, st, 'counter', total - st.lastTotal);
          }
          st.lastTotal = total;
        }
        if (!st.counterSeen) collectByLane(game, st, d);
      }

      if (typeof game.speed === 'number' && game.speed > 0 && game.speed < p.speed) {
        game.speed = Math.min(p.speed, SPEED.max, game.speed + params.speedEase * step);
      }

      while (st.queue.length && st.queue[0].at <= d + params.spawnAhead) {
        const item = st.queue.shift();
        if (item.at > d && typeof game.spawn === 'function') {
          game.spawn({ kind: item.kind, lane: item.lane, z: -item.at });
          if (item.kind === 'collectible' && !st.hooked && !st.counterSeen) st.pending.push(item);
        }
      }

      if (game.boss && game.boss.userData && typeof game.boss.userData.tick === 'function') game.boss.userData.tick(game.time || 0);
    },
    endCard: {
      title: 'Earnings Call: Over',
      lines: [
        'The Ticker floats off to bother another quarter.',
        'Somewhere backstage, a CFO finally sits down.',
      ],
    },
    // First match wins; the last always matches. Meters assumed 0-100.
    // Entering at 50/50 and beating all 3 phases (65/59) reaches Record Quarter with either final choice.
    endings: [
      {
        id: 'record-quarter', title: 'Record Quarter',
        when: function (m) { return val(m, 'stock') >= 60 && val(m, 'board') >= 50 && Math.min(val(m, 'washington'), val(m, 'beijing')) >= 30; },
        frontPage: { headline: 'RECORD QUARTER! TICKER TURNS GREEN', sub: 'Chip chief beats estimates, beats the boss, keeps the jacket shiny.' },
        lines: [
          'The Ticker shrinks to a polite little sparkline and asks for an autograph.',
          'Analysts upgrade the stock to "Buy", then to "Buy Two".',
          'Jensen bows. The jacket takes a separate bow.',
        ],
      },
      {
        id: 'soft-landing', title: 'Soft Landing',
        when: function (m) { return val(m, 'stock') >= 45 && val(m, 'board') >= 40; },
        frontPage: { headline: 'SOFT LANDING: NOBODY PANICS', sub: 'Numbers solid, guidance sensible, crowd only boos the parking.' },
        lines: [
          'The Ticker wobbles sideways, which analysts call "constructive".',
          'The CFO exhales for the first time since Tuesday.',
        ],
      },
      {
        id: 'under-review', title: 'Under Review',
        when: function (m) { return val(m, 'stock') >= 25 || val(m, 'board') >= 40; },
        frontPage: { headline: 'BOARD PUTS EARNINGS VIBES UNDER REVIEW', sub: 'Directors form a committee to study whether the jacket was too shiny.' },
        lines: [
          'The Ticker flickers red and green like a confused traffic light.',
          'A memo arrives titled "Let\'s Talk (Calmly)".',
        ],
      },
      {
        id: 'gardening-leave', title: 'Gardening Leave',
        when: function () { return true; },
        frontPage: { headline: 'JACKET HUNG UP: CEO ON GARDENING LEAVE', sub: 'Board suggests "a restful quarter" among the tomatoes. Spokesperson: "Temporary."' },
        lines: [
          'The Ticker gloats, then trips over its own wick.',
          'Jensen plants a row of chillies. They grow straight up, like a good chart.',
          'Rumour has it the comeback keynote is already booked.',
        ],
      },
    ],
  };
};
