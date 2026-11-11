/*
 * Jacket Weather, chapter 2: "The Jacket" (2016 - 2025).
 * The AI boom: the run climbs a glowing green stock chart through sunrise clouds.
 * Twist: Jensen carries the first AI supercomputer to a garage lab; every hit
 * before the hand-over costs 25% "delivery condition", which picks the end-card joke.
 * Content module only: the engine owns the road, hero, HUD, camera and collisions.
 */
'use strict';

module.exports = function (THREE, kit) {
  const LENGTH = 840;
  const DELIVER_AT = 150; // the garage lab stop (2016), where the box is handed over
  const EXPO_AT = 500; // lands in 2020-2021, the graphics card shortage
  const YEAR_EVERY = 76; // see YEAR_MARKERS
  // Chart line: metres per copy, height range, and every Nth segment is a small dip.
  const CHART = { step: 10, low: 0.5, top: 4.0, dipEvery: 7 };

  // ---------------------------------------------------------------------------
  // Shared unit geometry (scaled per mesh) and flat-shaded materials
  // ---------------------------------------------------------------------------
  const GEO = {
    box: new THREE.BoxGeometry(1, 1, 1),
    cyl: new THREE.CylinderGeometry(1, 1, 1, 12),
    cone: new THREE.ConeGeometry(1, 1, 8),
    ball: new THREE.SphereGeometry(1, 12, 8),
    puff: new THREE.SphereGeometry(1, 8, 6)
  };

  function lam(color, extra) {
    return new THREE.MeshLambertMaterial(Object.assign({ color: color, flatShading: true }, extra));
  }

  const MAT = {
    // the chart and the boom
    candle: lam('#1fd36b', { emissive: '#0b5c2e' }),
    wickGreen: lam('#0f7a3d'),
    neon: lam('#5cffa8', { emissive: '#22c46e' }),
    neonGhost: lam('#5cffa8', { emissive: '#22c46e', transparent: true, opacity: 0.35 }),
    red: lam('#f0384b', { emissive: '#5a0a14' }),
    wickRed: lam('#8c1424'),
    shadow: lam('#3d2b52', { transparent: true, opacity: 0.35 }),
    // sky and clouds
    cloud: lam('#fff4f8'),
    cloudPink: lam('#ffd3e4'),
    storm: lam('#5d5272'),
    stormDark: lam('#463d5a'),
    // servers and buildings
    rack: lam('#2a2340'),
    ledGreen: lam('#62ffa2', { emissive: '#36d27a' }),
    ledBlue: lam('#74dcff', { emissive: '#3aa6d4' }),
    signBack: lam('#1b1030'),
    post: lam('#6a5a8c'),
    pink: lam('#ff4fa3', { emissive: '#5a0f36' }),
    dc: lam('#4b3b7a'),
    fan: lam('#9a94b0'),
    hub: lam('#2a2340'),
    door: lam('#211a36'),
    // obstacles
    ice: lam('#bfeaff', { transparent: true, opacity: 0.78 }),
    snow: lam('#ffffff'),
    gold: lam('#ffc94a', { emissive: '#5a3d00' }),
    rug: lam('#b8324a'),
    rugBand: lam('#f2c14e'),
    paper: lam('#fff6e3'),
    drone: lam('#33304a'),
    prop: lam('#cfd3e0'),
    balloon: lam('#ff5fb0', { emissive: '#4a0d2c' }),
    shine: lam('#ffffff', { emissive: '#ffd6ea' }),
    string: lam('#f5f0ff'),
    weight: lam('#7a6aa8'),
    // collectible
    shroud: lam('#2c2c34'),
    fanBlack: lam('#121216'),
    silver: lam('#c9ccd6'),
    // landmarks
    garageWall: lam('#d79a62'),
    garageTrim: lam('#8a4f2e'),
    garageDoor: lam('#efe6d2'),
    wood: lam('#9b6b43'),
    pizza: lam('#e9d3a8'),
    stage: lam('#5b2a86'),
    stageEdge: lam('#ff4fa3', { emissive: '#7a1650' }),
    screen: lam('#140d26'),
    counter: lam('#8a5a3b'),
    awningDark: lam('#1b1b1f'),
    awningGold: lam('#f2c14e'),
    leather: lam('#17171c'),
    fabricPurple: lam('#7b3fd1'),
    fabricGreen: lam('#2fbf71'),
    fabricPink: lam('#ff7ab8'),
    cardboard: lam('#c8955a'),
    tape: lam('#f0e2b6')
  };

  function add(parent, geo, mat, sx, sy, sz, x, y, z) {
    const m = new THREE.Mesh(geo, mat);
    m.scale.set(sx, sy, sz);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }
  function box(p, mat, w, h, d, x, y, z) { return add(p, GEO.box, mat, w, h, d, x, y, z); }
  function cyl(p, mat, r, h, x, y, z) { return add(p, GEO.cyl, mat, r, h, r, x, y, z); }
  function cone(p, mat, r, h, x, y, z) { return add(p, GEO.cone, mat, r, h, r, x, y, z); }
  function ball(p, mat, r, x, y, z) { return add(p, GEO.ball, mat, r, r, r, x, y, z); }
  function puff(p, mat, rx, ry, rz, x, y, z) { return add(p, GEO.puff, mat, rx, ry, rz, x, y, z); }
  function sign(p, text, w, h, bg, fg, x, y, z) {
    const m = kit.textPlane(text, { w: w, h: h, bg: bg, fg: fg });
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
  function pick(list, rng) {
    return list[Math.floor(rng() * list.length) % list.length];
  }

  // ---------------------------------------------------------------------------
  // Scenery
  // ---------------------------------------------------------------------------

  // One 10 m segment of the giant price line along the left road edge. Each copy
  // starts at the height where the previous copy ended and climbs, except every
  // seventh, which dips a little. Once the line passes CHART.top the next segment
  // is a red crash back down to CHART.low. State restarts in onStart; copies must
  // be built in road order.
  let chartY = CHART.low;
  let chartCount = 0;
  function buildChartEdge(rng) {
    const g = new THREE.Group();
    const k = chartCount++;
    const y0 = chartY;
    let y1;
    let mat = MAT.neon;
    if (y0 >= CHART.top) {
      y1 = CHART.low; // market correction
      mat = MAT.red;
    } else if (k % CHART.dipEvery === CHART.dipEvery - 1) {
      y1 = Math.max(CHART.low, y0 - (0.1 + rng() * 0.25));
    } else {
      y1 = y0 + 0.12 + rng() * 0.3;
    }
    chartY = y1;
    const seg = box(g, mat, 0.14, 0.14, Math.hypot(CHART.step, y1 - y0), 0, (y0 + y1) / 2, 0);
    seg.name = 'chart_line';
    seg.rotation.x = Math.atan2(y1 - y0, CHART.step); // +Z end at y0, -Z end at y1
    ball(g, mat, 0.24, 0, y1, -CHART.step / 2);
    box(g, MAT.neonGhost, 0.06, y1, 0.06, 0, y1 / 2, -CHART.step / 2);
    return g;
  }

  function buildGreenCandle(rng) {
    const g = new THREE.Group();
    const w = 1.2 + rng() * 1.0;
    const h = 2.5 + rng() * 5;
    const base = 2 + rng() * 4;
    const wickLo = 0.6 + rng() * 1.2;
    const wickHi = 0.6 + rng() * 1.5;
    cyl(g, MAT.wickGreen, 0.12, wickLo, 0, base - wickLo / 2, 0);
    box(g, MAT.candle, w, h, w, 0, base + h / 2, 0);
    cyl(g, MAT.wickGreen, 0.12, wickHi, 0, base + h + wickHi / 2, 0);
    puff(g, MAT.cloud, 1.6, 0.7, 1.3, -0.4, 0.3, 0);
    puff(g, MAT.cloudPink, 1.1, 0.55, 1.0, 0.9, 0.25, 0.3);
    puff(g, MAT.cloud, 0.9, 0.5, 0.9, 0.2, 0.55, -0.4);
    return g;
  }

  function buildServerRacks(rng) {
    const g = new THREE.Group();
    const n = 2 + Math.floor(rng() * 2);
    for (let i = 0; i < n; i++) {
      const x = (i - (n - 1) / 2) * 1.35;
      const h = 2.6 + rng() * 1.2;
      box(g, MAT.rack, 1.2, h, 1.0, x, 0.2 + h / 2, 0);
      for (let k = 0; k < 4; k++) {
        box(g, k % 2 ? MAT.ledBlue : MAT.ledGreen, 0.9, 0.07, 0.03, x, 0.6 + k * (h - 0.6) / 4, 0.51);
      }
    }
    puff(g, MAT.cloud, 2.4, 0.5, 1.4, 0, 0.15, 0.1);
    puff(g, MAT.cloudPink, 1.3, 0.45, 1.0, 1.4, 0.2, 0.6);
    return g;
  }

  // One marker per copy, in road order, restarting in onStart; extra copies repeat
  // the last entry. 2016 gets two markers so that, with copies 76 m apart, the lab
  // (150 m) falls in 2016, the expo (500 m) in 2020-2021 and the tailor (840 m) in
  // 2025, whether the engine puts the first copy at 0 m or at 76 m.
  const YEAR_MARKERS = [
    [2016, 'SPECIAL DELIVERY'],
    [2016, 'HANDLE WITH CARE'],
    [2017, 'MINERS EVERYWHERE'],
    [2018, 'RAYS, TRACED'],
    [2019, 'CRYPTO WINTER'],
    [2020, 'EVERYONE GAMES AT HOME'],
    [2021, 'SOLD OUT. AGAIN.'],
    [2022, 'CHATBOTS ARRIVE'],
    [2023, 'TRILLION CLUB'],
    [2024, 'TOP OF THE CHARTS'],
    [2025, 'JACKET WEATHER'],
    [2025, 'FORECAST: LEATHER']
  ];
  let yearCount = 0;
  function buildYearMarker() {
    const entry = YEAR_MARKERS[Math.min(yearCount, YEAR_MARKERS.length - 1)];
    yearCount++;
    const g = new THREE.Group();
    cyl(g, MAT.post, 0.12, 3, 0, 1.5, 0);
    box(g, MAT.signBack, 2.9, 1.8, 0.12, 0, 3.7, 0);
    sign(g, String(entry[0]), 2.6, 1.0, '#1b1030', '#5cffa8', 0, 3.95, 0.07);
    sign(g, entry[1], 2.6, 0.42, '#1b1030', '#ffd166', 0, 3.15, 0.07);
    cone(g, MAT.neon, 0.3, 0.5, 0, 4.85, 0);
    return g;
  }

  function buildCloudBank(rng) {
    const g = new THREE.Group();
    const n = 4 + Math.floor(rng() * 4);
    for (let i = 0; i < n; i++) {
      const r = 1.4 + rng() * 2.2;
      puff(g, i % 3 === 2 ? MAT.cloudPink : MAT.cloud, r, r * 0.65, r * 0.9,
        (rng() - 0.5) * 7, r * 0.25 + rng() * 0.8, (rng() - 0.5) * 6);
    }
    return g;
  }

  const SLOGANS = [
    'TO THE MOON', 'AI IN EVERYTHING', 'IS IT A BUBBLE?', 'BUY THE DIP?',
    'NUMBER GO UP', 'PIVOT TO AI', 'GPUs: THE NEW GOLD', 'EXPERTS SAY: WOW'
  ];
  function buildHypeBillboard(rng) {
    const g = new THREE.Group();
    cyl(g, MAT.post, 0.15, 4, -2, 2, 0);
    cyl(g, MAT.post, 0.15, 4, 2, 2, 0);
    box(g, MAT.pink, 5.2, 2.3, 0.3, 0, 5, 0);
    sign(g, pick(SLOGANS, rng), 4.8, 1.9, '#1b1030', '#5cffa8', 0, 5, 0.16);
    cone(g, MAT.neon, 0.4, 0.8, 2.2, 6.55, 0);
    return g;
  }

  const DC_SIGNS = ['DATA CENTER', 'AI FACTORY', 'MORE COMPUTE'];
  function buildDataCenter(rng) {
    const g = new THREE.Group();
    const w = 8 + rng() * 4;
    const h = 5 + rng() * 4;
    const d = 7;
    box(g, MAT.dc, w, h, d, 0, h / 2, 0);
    box(g, MAT.neon, w, 0.25, 0.06, 0, h * 0.62, d / 2 + 0.03);
    box(g, MAT.door, 1.6, 2.2, 0.1, -w / 4, 1.1, d / 2 + 0.05);
    sign(g, pick(DC_SIGNS, rng), 4, 0.8, '#382c5e', '#ffffff', w / 6, h * 0.82, d / 2 + 0.02);
    for (let i = 0; i < 3; i++) {
      const x = (i - 1) * (w / 3.5);
      cyl(g, MAT.fan, 0.9, 0.4, x, h + 0.2, 0);
      cyl(g, MAT.hub, 0.25, 0.45, x, h + 0.225, 0);
    }
    puff(g, MAT.cloud, w * 0.45, 0.8, 2.2, -w * 0.2, 0.2, d / 2);
    puff(g, MAT.cloudPink, w * 0.3, 0.7, 1.8, w * 0.3, 0.2, d / 2 + 0.4);
    return g;
  }

  // ---------------------------------------------------------------------------
  // Obstacles (size = measured bounding box; h is the top height above ground)
  // ---------------------------------------------------------------------------
  const CANDLE_TAGS = ['-12%', 'SELL', '-30%', 'OOF'];
  let candleTag = 0; // restarts in onStart
  function buildRedCandle() {
    const g = new THREE.Group();
    cyl(g, MAT.shadow, 0.55, 0.02, 0, 0.01, 0);
    cyl(g, MAT.wickRed, 0.09, 0.35, 0, 0.175, 0);
    box(g, MAT.red, 1.2, 1.7, 1.0, 0, 1.2, 0);
    cyl(g, MAT.wickRed, 0.09, 0.35, 0, 2.225, 0);
    sign(g, CANDLE_TAGS[candleTag++ % CANDLE_TAGS.length], 0.9, 0.4, '#5a0a14', '#ffffff', 0, 1.35, 0.51);
    return g;
  }

  function buildCryptoWinter() {
    const g = new THREE.Group();
    box(g, MAT.ice, 1.6, 1.8, 1.2, 0, 0.9, 0);
    const coin = cyl(g, MAT.gold, 0.42, 0.1, 0, 0.6, 0);
    coin.rotation.x = Math.PI / 2;
    box(g, MAT.snow, 1.66, 0.14, 1.26, 0, 1.87, 0);
    sign(g, 'CRYPTO WINTER', 1.44, 0.34, '#e8f7ff', '#1d4e89', 0, 1.3, 0.61);
    [-0.55, -0.1, 0.4].forEach(function (x) {
      const icicle = cone(g, MAT.ice, 0.07, 0.22, x, 1.69, 0.62);
      icicle.rotation.x = Math.PI; // point down
    });
    return g;
  }

  function buildTheDip() {
    const g = new THREE.Group();
    cyl(g, MAT.wickRed, 0.07, 0.12, 0, 0.06, 0);
    box(g, MAT.red, 1.4, 0.52, 0.7, 0, 0.38, 0);
    cyl(g, MAT.wickRed, 0.07, 0.12, 0, 0.7, 0);
    sign(g, 'BUY THE DIP?', 1.2, 0.3, '#fff6e3', '#b0102a', 0, 0.38, 0.36);
    return g;
  }

  function buildRugPull() {
    const g = new THREE.Group();
    const roll = cyl(g, MAT.rug, 0.28, 1.6, 0, 0.3, -0.3);
    roll.rotation.z = Math.PI / 2; // lie across the lane
    [-0.5, 0.5].forEach(function (x) {
      const band = cyl(g, MAT.rugBand, 0.3, 0.12, x, 0.3, -0.3);
      band.rotation.z = Math.PI / 2;
    });
    box(g, MAT.rug, 1.6, 0.04, 0.58, 0, 0.02, 0.29);
    box(g, MAT.rugBand, 1.6, 0.045, 0.08, 0, 0.0225, 0.54);
    const tag = sign(g, 'RUG PULL', 0.8, 0.24, '#f2c14e', '#3a0d18', 0, 0.66, -0.3);
    tag.rotation.x = -0.25; // tilt back toward the camera
    return g;
  }

  // Banner carried by two little drones; underside at 1.15 m.
  function buildDowngradeBanner() {
    const g = new THREE.Group();
    box(g, MAT.red, 1.9, 0.08, 0.18, 0, 1.19, 0);
    box(g, MAT.paper, 1.9, 0.62, 0.16, 0, 1.53, 0);
    sign(g, 'ANALYST DOWNGRADE', 1.76, 0.42, '#fff6e3', '#c1121f', 0, 1.53, 0.09);
    [-0.75, 0.75].forEach(function (x) {
      box(g, MAT.string, 0.03, 0.2, 0.03, x, 1.94, 0);
      box(g, MAT.drone, 0.34, 0.1, 0.3, x, 2.09, 0);
      cyl(g, MAT.prop, 0.16, 0.02, x, 2.15, 0);
    });
    return g;
  }

  // A hovering storm cloud of Fear, Uncertainty and Doubt; underside at 1.2 m.
  function buildFudCloud() {
    const g = new THREE.Group();
    puff(g, MAT.storm, 0.5, 0.42, 0.45, -0.45, 1.62, 0);
    puff(g, MAT.storm, 0.5, 0.42, 0.45, 0.45, 1.62, 0);
    puff(g, MAT.stormDark, 0.55, 0.5, 0.5, 0, 1.85, -0.05);
    sign(g, 'FUD', 0.7, 0.32, '#463d5a', '#ffe066', 0, 1.62, 0.47);
    return g;
  }

  // Tethered to a weight on the ground; the engine slides it across lanes.
  function buildHypeBalloon() {
    const g = new THREE.Group();
    box(g, MAT.weight, 0.36, 0.16, 0.36, 0, 0.08, 0);
    box(g, MAT.string, 0.03, 0.34, 0.03, 0, 0.33, 0);
    const knot = cone(g, MAT.balloon, 0.1, 0.12, 0, 0.54, 0);
    knot.rotation.x = Math.PI; // point down at the string
    add(g, GEO.ball, MAT.balloon, 0.7, 0.75, 0.7, 0, 1.33, 0);
    ball(g, MAT.shine, 0.1, -0.28, 1.72, 0.52);
    sign(g, 'HYPE', 0.9, 0.38, '#ff5fb0', '#ffffff', 0, 1.4, 0.71);
    return g;
  }

  // ---------------------------------------------------------------------------
  // Collectible: a graphics card standing on its edge, fans facing the camera
  // ---------------------------------------------------------------------------
  function buildGpu() {
    const g = new THREE.Group();
    box(g, MAT.gold, 0.3, 0.03, 0.04, -0.05, 0.015, 0);
    box(g, MAT.shroud, 0.5, 0.24, 0.1, 0, 0.15, 0);
    box(g, MAT.neon, 0.5, 0.03, 0.11, 0, 0.255, 0);
    box(g, MAT.silver, 0.02, 0.28, 0.1, 0.26, 0.14, 0);
    [-0.12, 0.12].forEach(function (x) {
      const fan = cyl(g, MAT.fanBlack, 0.085, 0.02, x, 0.14, 0.06);
      fan.rotation.x = Math.PI / 2;
      const hub = cyl(g, MAT.neon, 0.03, 0.03, x, 0.14, 0.07);
      hub.rotation.x = Math.PI / 2;
    });
    return g;
  }

  // ---------------------------------------------------------------------------
  // Landmarks (open side faces +Z)
  // ---------------------------------------------------------------------------
  function buildGarageLab() {
    const g = new THREE.Group();
    box(g, MAT.garageWall, 5, 3, 0.2, 0, 1.5, -2);
    box(g, MAT.garageWall, 0.2, 3, 4, -2.5, 1.5, 0);
    box(g, MAT.garageWall, 0.2, 3, 4, 2.5, 1.5, 0);
    box(g, MAT.garageTrim, 5.4, 0.3, 4.4, 0, 3.15, 0);
    box(g, MAT.garageDoor, 4.8, 0.45, 0.25, 0, 2.7, 2);
    sign(g, 'GARAGE AI LAB', 3.2, 0.6, '#8a4f2e', '#fff6e3', 0, 3.6, 2.0);
    sign(g, 'AGI: TODO', 1.6, 0.9, '#ffffff', '#1b1030', -0.8, 1.8, -1.89);
    box(g, MAT.wood, 1.6, 0.75, 0.8, 1.2, 0.375, -1.0);
    sign(g, 'SUPERCOMPUTER GOES HERE', 1.4, 0.28, '#fff6e3', '#8a4f2e', 1.2, 0.95, -0.95);
    box(g, MAT.pizza, 0.55, 0.06, 0.55, -1.8, 0.03, 1.2);
    // Researcher and Lab Founder
    person(g, { skin: '#f1c9a5', hair: '#3b2a1a', top: '#6c8cff', bottom: '#2b2b3a', accessory: 'glasses' }, -0.9, 1.3, 0.3);
    person(g, { skin: '#d9a27a', hair: '#1b1b1b', top: '#3a3a48', bottom: '#4b5a7a' }, 0.7, 1.6, -0.3);
    return g;
  }

  function buildGameExpo() {
    const g = new THREE.Group();
    box(g, MAT.stage, 6, 0.5, 2.6, 0, 0.25, -1.2);
    box(g, MAT.stageEdge, 6, 0.1, 0.06, 0, 0.45, 0.13);
    box(g, MAT.screen, 5, 2.6, 0.2, 0, 2.1, -2.3);
    sign(g, 'GAME EXPO', 4.4, 1.1, '#140d26', '#5cffa8', 0, 2.6, -2.19);
    sign(g, 'GPUs: SOLD OUT', 3.2, 0.5, '#ff4fa3', '#ffffff', 0, 1.45, -2.19);
    // Fan, Gamer, Streamer
    person(g, { look: 'female', skin: '#c68e64', hair: '#2b1d14', top: '#ff4fa3', bottom: '#2b2b3a' }, -1.7, 1.3, 0.25);
    person(g, { look: 'female', skin: '#f3d2b3', hair: '#e8b04a', top: '#2fbf71', bottom: '#1f2a44', accessory: 'headset' }, 0, 1.7, 0);
    person(g, { skin: '#8d5a3b', hair: '#111111', top: '#7b3fd1', bottom: '#2b2b3a' }, 1.7, 1.3, -0.25);
    return g;
  }

  function buildTailorStall() {
    const g = new THREE.Group();
    box(g, MAT.counter, 3, 1, 0.8, 0, 0.5, 0.4);
    box(g, MAT.awningGold, 3.1, 0.06, 0.85, 0, 1.03, 0.4);
    cyl(g, MAT.post, 0.07, 2.7, -1.5, 1.35, 0.75);
    cyl(g, MAT.post, 0.07, 2.7, 1.5, 1.35, 0.75);
    for (let i = 0; i < 4; i++) {
      const stripe = box(g, i % 2 ? MAT.awningGold : MAT.awningDark, 0.775, 0.08, 1.6, -1.1625 + i * 0.775, 2.78, 0.35);
      stripe.rotation.x = 0.2; // front edge lower
    }
    sign(g, 'TAILOR: JACKETS', 2.6, 0.45, '#1b1b1f', '#f2c14e', 0, 3.25, 0.6);
    [MAT.fabricPurple, MAT.fabricGreen, MAT.fabricPink].forEach(function (m, i) {
      const roll = cyl(g, m, 0.1, 0.7, -1.0 + i * 0.75, 1.16, 0.45);
      roll.rotation.z = Math.PI / 2;
    });
    // dress form wearing The Jacket
    cyl(g, MAT.wood, 0.25, 0.06, 2.1, 0.03, 0.5);
    cyl(g, MAT.wood, 0.04, 1.1, 2.1, 0.6, 0.5);
    box(g, MAT.leather, 0.56, 0.7, 0.32, 2.1, 1.45, 0.5);
    box(g, MAT.leather, 0.4, 0.12, 0.34, 2.1, 1.86, 0.5);
    sign(g, 'THE ONE', 0.5, 0.2, '#f2c14e', '#1b1b1f', 2.1, 1.35, 0.67);
    // Tailor, behind the counter
    person(g, { skin: '#e0b48c', hair: '#9a9a9a', top: '#f2c14e', bottom: '#1b1b1f', accessory: 'tape' }, -0.3, -0.45, 0);
    return g;
  }

  // The box Jensen carries over his head until the lab stop (best effort, see onStart).
  function buildCarryBox() {
    const g = new THREE.Group();
    g.name = 'ch2-supercomputer-box';
    box(g, MAT.cardboard, 0.8, 0.5, 0.55, 0, 0.25, 0);
    box(g, MAT.tape, 0.82, 0.08, 0.57, 0, 0.25, 0);
    sign(g, 'FRAGILE: SUPERCOMPUTER', 0.74, 0.2, '#c8955a', '#b0102a', 0, 0.38, 0.28);
    const far = sign(g, 'FRAGILE: SUPERCOMPUTER', 0.74, 0.2, '#c8955a', '#b0102a', 0, 0.38, -0.28);
    far.rotation.y = Math.PI;
    return g;
  }

  // ---------------------------------------------------------------------------
  // Dialogue (`next` on a choice names another dialogue id to play)
  // ---------------------------------------------------------------------------
  const DIALOGUES = {
    lab: [
      { speaker: 'Researcher', text: 'Is that the supercomputer? We were kind of expecting pizza.' },
      { speaker: 'Jensen', text: 'Better than pizza. The first one ever, delivered by hand. Sign here.' },
      { speaker: 'Lab Founder', text: 'What if someday people give AI away for free?' },
      { speaker: 'Jensen', text: 'Free AI should be great for hardware. Free AI should be great for chips.' }
    ],
    expo: [
      { speaker: 'Fan', text: "It's him! The graphics card guy!" },
      { speaker: 'Gamer', text: 'Will graphics cards ever be back in stock?' },
      { speaker: 'Jensen', text: 'Soon! Right after the miners, the AI labs, and the guy who bought forty.' },
      { speaker: 'Streamer', text: "Chat wants to know why you don't have a cool jacket yet." },
      { speaker: 'Jensen', text: 'Funny you should ask. Next stop: the tailor.' }
    ],
    tailor: [
      { speaker: 'Tailor', text: "Black leather. Says 'I make chips' and 'I headline rock concerts.'" },
      { speaker: 'Jensen', text: 'Is it warm under keynote lights?' },
      { speaker: 'Tailor', text: 'Toasty. Your staff will call it jacket weather.' },
      {
        speaker: 'Tailor',
        text: 'Last question: how often will you wear it?',
        choices: [
          { text: "Every keynote, forever. It's the brand.", effects: { stock: 12, board: -5 }, next: 'tailor_forever' },
          { text: 'Special occasions only. The board likes ties.', effects: { stock: -5, board: 10 }, next: 'tailor_sometimes' }
        ]
      }
    ],
    tailor_forever: [
      { speaker: 'Tailor', text: "Then I'll sew a dozen identical ones. Nobody will ever notice." }
    ],
    tailor_sometimes: [
      { speaker: 'Tailor', text: 'Special occasions it is. Somehow, every day will be one.' }
    ]
  };

  // ---------------------------------------------------------------------------
  // Mechanic: delivery condition
  // ---------------------------------------------------------------------------
  const PARAMS = {
    startCondition: 100,
    lossPerHit: 25,
    minCondition: 0,
    deliverAt: DELIVER_AT,
    hudKey: 'hud', // game.state.hud holds the HUD text
    hitLines: {
      75: 'Box condition 75%. Just a dent. Science loves dents.',
      50: "Box condition 50%. It's rattling. Rattling is probably fine.",
      25: 'Box condition 25%. Some parts are now optional.',
      0: 'Box condition 0%. Technically, still a box.'
    },
    deliveryLines: {
      100: 'Delivered at 100%! Not a scratch. The lab is suspicious.',
      75: "Delivered at 75%. 'Is that a dent?' 'It's a cooling feature.'",
      50: 'Delivered at 50%. The lab signs for it. Carefully.',
      25: "Delivered at 25%. They're calling it a 'research opportunity'.",
      0: "Delivered at 0%. It's a kit now. Some assembly required."
    },
    endLines: {
      100: 'Box arrived at 100%. The lab framed the bubble wrap.',
      75: "Box arrived at 75%. One dent. The lab calls it 'character'.",
      50: 'Box arrived at 50%. It still boots. Loudly.',
      25: 'Box arrived at 25%. The lab now owns a very expensive rattle.',
      0: "Box arrived at 0%. The lab calls it 'modular'. Analysts upgraded it anyway."
    }
  };

  function bucket(condition) {
    return Math.max(0, Math.min(100, Math.round(condition / 25) * 25));
  }
  function endLines(condition) {
    return [
      PARAMS.endLines[bucket(condition)],
      'UNLOCKED: the black leather jacket.',
      'Forecast for every keynote from now on: jacket weather.'
    ];
  }
  function say(game, text) {
    if (game && typeof game.say === 'function' && text) game.say(text);
  }
  function heartsOf(game) {
    const h = game && game.hero ? game.hero.hearts : undefined;
    return typeof h === 'number' ? h : null;
  }
  // The engine API is not final: look for the hero's Object3D under a few likely names.
  function heroObject(game) {
    const h = game && game.hero;
    if (!h) return null;
    const candidates = [h.object3d, h.object, h.group, h.mesh, h.model, h];
    for (let i = 0; i < candidates.length; i++) {
      if (candidates[i] && candidates[i].isObject3D) return candidates[i];
    }
    return null;
  }

  let carried = null;
  function dropCarried() {
    if (carried && carried.parent) carried.parent.remove(carried);
    carried = null;
  }
  function setHud(game, d) {
    game.state[PARAMS.hudKey] = (d.delivered ? 'DELIVERED: ' : 'DELIVERY: ') + d.condition + '%';
  }
  // Lazily created so onUpdate still works if the engine never calls onStart.
  function delivery(game) {
    if (!game.state) game.state = {};
    if (!game.state.delivery) {
      game.state.delivery = { condition: PARAMS.startCondition, delivered: false, lastHearts: heartsOf(game) };
      setHud(game, game.state.delivery);
    }
    return game.state.delivery;
  }

  // ---------------------------------------------------------------------------
  // Chapter
  // ---------------------------------------------------------------------------
  const chapter = {
    id: 'ch2',
    title: 'The Jacket',
    dateline: '2016 - 2025',
    outfit: 'young',
    hideMeters: false,
    length: LENGTH,
    speed: { base: 12, max: 16 },

    frontPage: {
      headline: "CHIP BOSS HAND-DELIVERS 'BRAIN IN A BOX'",
      sub: 'Stock chart now visible above the clouds. Fashion desk asks: where is the jacket?'
    },

    theme: {
      sky: '#ffbf94',
      fog: '#ffd9bd',
      fogNear: 25,
      fogFar: 140,
      ground: '#fbe4ee',
      road: '#16b85e',
      laneLine: '#eafff1',
      lightColor: '#ffd9a8',
      lightIntensity: 1.1,
      ambient: '#b39ddb'
    },

    scenery: [
      { id: 'chart_edge', side: 'left', every: CHART.step, offset: 6, build: buildChartEdge },
      { id: 'year_marker', side: 'right', every: YEAR_EVERY, offset: 8, build: buildYearMarker },
      { id: 'server_racks', side: 'left', every: 45, offset: 9.5, build: buildServerRacks },
      { id: 'green_candle', side: 'both', every: 22, offset: 13, build: buildGreenCandle },
      { id: 'hype_billboard', side: 'left', every: 90, offset: 18, build: buildHypeBillboard },
      { id: 'data_center', side: 'right', every: 70, offset: 21, build: buildDataCenter },
      { id: 'cloud_bank', side: 'both', every: 30, offset: 28, build: buildCloudBank }
    ],

    obstacles: [
      { id: 'red_candle', type: 'block', weight: 3, size: { w: 1.2, h: 2.4, d: 1.1 }, build: buildRedCandle },
      { id: 'crypto_winter', type: 'block', weight: 2, size: { w: 1.66, h: 1.94, d: 1.32 }, build: buildCryptoWinter },
      { id: 'the_dip', type: 'low', weight: 3, size: { w: 1.4, h: 0.76, d: 0.72 }, build: buildTheDip },
      { id: 'rug_pull', type: 'low', weight: 2, size: { w: 1.6, h: 0.78, d: 1.18 }, build: buildRugPull },
      { id: 'downgrade_banner', type: 'high', weight: 3, size: { w: 1.9, h: 2.16, d: 0.32 }, build: buildDowngradeBanner },
      { id: 'fud_cloud', type: 'high', weight: 2, size: { w: 1.9, h: 2.35, d: 1.02 }, build: buildFudCloud },
      { id: 'hype_balloon', type: 'mover', weight: 1.5, size: { w: 1.4, h: 2.08, d: 1.41 }, build: buildHypeBalloon }
    ],

    collectible: { name: 'GPUs', build: buildGpu },

    stops: [
      { at: DELIVER_AT, title: 'The Garage AI Lab', landmark: { x: -8, build: buildGarageLab }, dialogueId: 'lab' },
      { at: EXPO_AT, title: 'The Game Expo', landmark: { x: 8, build: buildGameExpo }, dialogueId: 'expo' },
      { at: LENGTH, title: "The Tailor's Stall", landmark: { x: -7.5, build: buildTailorStall }, dialogueId: 'tailor' }
    ],

    dialogues: DIALOGUES,

    mechanic: {
      summary:
        'Delivery condition. Jensen starts the chapter carrying the first AI supercomputer in a box at 100% condition. ' +
        'Until he reaches the Garage AI Lab stop (' + DELIVER_AT + ' m), every hit he takes (each time his hearts go down) ' +
        'lowers the condition by 25 percentage points, never below 0%. The HUD shows "DELIVERY: N%". At the lab stop the ' +
        'box is handed over and the condition locks ("DELIVERED: N%"); later hits do not change it. Condition never ends ' +
        'the run and changes nothing else: it only picks the first end-card line, one for each of 100, 75, 50, 25 and 0%.',
      params: PARAMS
    },

    onStart: function (game) {
      // Restart the per-run scenery sequences (chart line, year markers, candle tags).
      chartY = CHART.low;
      chartCount = 0;
      yearCount = 0;
      candleTag = 0;

      if (!game.state) game.state = {};
      game.state.delivery = null;
      const d = delivery(game);
      chapter.endCard.lines = endLines(d.condition);
      dropCarried();
      const hero = heroObject(game);
      if (hero) {
        carried = buildCarryBox();
        carried.position.set(0, 1.9, 0); // held over his head like a trophy
        hero.add(carried);
      }
      say(game, 'Deliver the supercomputer to the garage lab. Handle with care!');
    },

    onUpdate: function (game, dt) {
      const d = delivery(game);
      if (d.delivered) return;

      const hearts = heartsOf(game);
      if (hearts !== null && d.lastHearts !== null && hearts < d.lastHearts) {
        const before = d.condition;
        d.condition = Math.max(PARAMS.minCondition, d.condition - PARAMS.lossPerHit);
        if (d.condition !== before) {
          setHud(game, d);
          say(game, PARAMS.hitLines[bucket(d.condition)]);
          chapter.endCard.lines = endLines(d.condition);
        }
      }
      d.lastHearts = hearts;

      if ((game.distance || 0) >= PARAMS.deliverAt - 1) {
        d.delivered = true;
        setHud(game, d);
        say(game, PARAMS.deliveryLines[bucket(d.condition)]);
        chapter.endCard.lines = endLines(d.condition);
        dropCarried();
      }
    },

    endCard: {
      title: 'JACKET ACQUIRED',
      lines: endLines(PARAMS.startCondition)
    }
  };

  return chapter;
};
