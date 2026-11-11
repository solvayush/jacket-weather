/*
 * Jacket Weather, chapter 4: "The Wall of Curbs".
 * Content module only: scenery, obstacles, stops, dialogue and the rule-gate twist.
 * The engine supplies THREE (r149, global build) and kit (textPlane, person).
 */
module.exports = function (THREE, kit) {
  'use strict';

  // ---------------------------------------------------------------------------
  // Shared materials: one instance per colour, reused by every build().
  // ---------------------------------------------------------------------------
  const materials = {};
  function mat(hex, glow) {
    const key = hex + (glow ? ':glow' : '');
    if (!materials[key]) {
      const m = new THREE.MeshLambertMaterial({ color: hex });
      if (glow) { m.emissive.set(hex); m.emissiveIntensity = 0.85; }
      if ('flatShading' in m) m.flatShading = true;
      materials[key] = m;
    }
    return materials[key];
  }
  function shade(hex, k) { return '#' + new THREE.Color(hex).multiplyScalar(k).getHexString(); }

  const M = {
    white: mat('#f1f1ea'),
    red: mat('#e63946'),
    navy: mat('#1d3557'),
    yellow: mat('#ffd23f'),
    steel: mat('#8d99ae'),
    darkSteel: mat('#4a4e69'),
    black: mat('#22223b'),
    wood: mat('#c68b59'),
    woodDark: mat('#8d5a3b'),
    paper: mat('#fdf6e3'),
    paperShade: mat('#e3d5b8'),
    ink: mat('#6d6875'),
    chip: mat('#2a9d8f'),
    gold: mat('#e9c46a'),
    glass: mat('#a8dadc'),
    hull: mat('#26324d'),
    water: mat('#3b3170'),
    cone: mat('#ff7f11'),
    lampWarm: mat('#ffe8a3', true),
    lampGreen: mat('#2bd96b', true),
    lampRed: mat('#ff3b3b', true),
    lampAmber: mat('#ffaa00', true),
  };
  const CONTAINER_HEX = ['#e63946', '#1b998b', '#f46036', '#3d8af7', '#9bc53d', '#ffd23f', '#7b4fa0', '#d0006f'];
  const CONTAINER = CONTAINER_HEX.map((h) => mat(h));
  const CONTAINER_DOOR = CONTAINER_HEX.map((h) => mat(shade(h, 0.72)));

  // People (kit.person looks).
  const OFFICER = { skin: '#a86b3c', hair: '#1b1b1b', top: '#1d3557', bottom: '#22223b', accessory: 'cap' };
  const REPORTER = { skin: '#f1c27d', hair: '#8d5524', top: '#e76f51', bottom: '#264653', accessory: 'microphone' };
  const CAMERA_OP = { skin: '#8d5524', hair: '#111111', top: '#2a9d8f', bottom: '#22223b', accessory: 'headphones' };
  const PHOTOGRAPHER = { look: 'female', skin: '#e0ac69', hair: '#d4a017', top: '#6c4f9e', bottom: '#3d405b', accessory: 'camera' };
  const TRADE_OFFICIAL = { skin: '#c68642', hair: '#9e9e9e', top: '#3d405b', bottom: '#22223b', accessory: 'tie' };

  // ---------------------------------------------------------------------------
  // Geometry helpers. For box/cyl, `y` is the bottom of the part.
  // ---------------------------------------------------------------------------
  function box(g, m, w, h, d, x, y, z) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y + h / 2, z);
    g.add(mesh);
    return mesh;
  }
  function cyl(g, m, r, h, x, y, z, rTop) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop === undefined ? r : rTop, r, h, 8), m);
    mesh.position.set(x, y + h / 2, z);
    g.add(mesh);
    return mesh;
  }
  // Centred placement, for parts that get rotated.
  function partAt(g, geometry, m, x, y, z) {
    const mesh = new THREE.Mesh(geometry, m);
    mesh.position.set(x, y, z);
    g.add(mesh);
    return mesh;
  }
  function ball(g, m, r, x, y, z) { return partAt(g, new THREE.SphereGeometry(r, 8, 6), m, x, y, z); }
  function label(g, text, w, h, bg, fg, x, y, z) {
    const mesh = kit.textPlane(text, { w: w, h: h, bg: bg, fg: fg });
    mesh.position.set(x, y, z);
    g.add(mesh);
    return mesh;
  }
  function person(g, look, x, z, turn) {
    const p = kit.person(look);
    p.position.set(x, 0, z);
    p.rotation.y = turn || 0;
    g.add(p);
    return p;
  }
  function pick(rng, list) { return list[Math.floor(rng() * list.length) % list.length]; }

  // ---------------------------------------------------------------------------
  // Layout constants.
  // ---------------------------------------------------------------------------
  const LENGTH = 820;
  const LANE_W = 2;
  const LANE_NAME = { '-1': 'LEFT', '0': 'CENTRE', '1': 'RIGHT' };

  const PALLET_LABELS = [
    'GPUS: HANDLE WITH FORMS',
    'THIS WAY UP (PENDING REVIEW)',
    'FRAGILE: CONTAINS RULES',
    'MAX 8 GPUS PER STACK',
  ];

  // ---------------------------------------------------------------------------
  // Rule gates (the chapter twist).
  // ---------------------------------------------------------------------------
  // Each rule's text ends with the name of the open lane, so the sign alone is enough.
  const RULES = [
    { text: 'ONLY CRATES UNDER 8 GPUS: LEFT', lane: -1 },
    { text: 'TUESDAYS: CENTRE', lane: 0 },
    { text: 'CHIPS WITH FEELINGS: RIGHT', lane: 1 },
    { text: 'BELOW THE PERFORMANCE CAP: RIGHT', lane: 1 },
    { text: 'RULE CHANGED 5 MINUTES AGO: LEFT', lane: -1 },
    { text: 'FORMS IN TRIPLICATE: CENTRE', lane: 0 },
    { text: 'LEATHER JACKETS: RIGHT', lane: 1 },
    { text: 'GPUS THAT SAID PLEASE: LEFT', lane: -1 },
    { text: 'ODD-NUMBERED MEMOS: CENTRE', lane: 0 },
  ];

  const GATE = {
    firstGateAt: 280,      // metres; after the customs stop (215 m), which explains the gates
    gateEvery: 80,         // metres between gates
    finishMargin: 40,      // no gate within this many metres of the finish
    signLead: 30,          // rule sign stands this far before its gate
    announceLead: 60,      // game.say(rule) when the hero is this far from the gate
    spawnAhead: 100,       // sign and gate are spawned when the gate is this far ahead
    stopClearBefore: 60,   // skip a gate if a story stop lies in [at - 60, at + 10]
    stopClearAfter: 10,
    heartCost: 1,
    washingtonCost: 5,
    keepOpenLaneClear: 12, // request: no random obstacles in the open lane within 12 m of a gate
  };

  const PASS_QUIPS = ['Stamped. Next!', 'Cleared. Until the next memo.', 'Approved, pending approval.'];

  // Spans all three lanes; place it centred on the road (x = 0).
  function buildRuleSign(rule) {
    const g = new THREE.Group();
    for (const x of [-3.4, 3.4]) box(g, M.darkSteel, 0.2, 5.3, 0.2, x, 0, 0);
    box(g, M.black, 6.6, 1.3, 0.12, 0, 4.0, -0.08);                          // board 4.0..5.3
    label(g, rule.text, 6.2, 0.8, '#ffd23f', '#1a1a2e', 0, 4.65, 0.0);
    const arrow = partAt(g, new THREE.ConeGeometry(0.3, 0.45, 4), M.lampGreen, rule.lane * LANE_W, 3.8, 0.0);
    arrow.rotation.x = Math.PI;                                              // points down at the open lane
    return g;
  }

  // Spans all three lanes; place it centred on the road (x = 0). Only the outer posts touch
  // the ground, and everything over the open lane sits above a jumping hero's head (3.4 m).
  function buildRuleGate(openLane) {
    const g = new THREE.Group();
    for (const x of [-3.2, 3.2]) box(g, M.darkSteel, 0.2, 4.4, 0.2, x, 0, 0);
    box(g, M.navy, 6.6, 0.45, 0.3, 0, 4.4, 0);                               // beam 4.4..4.85
    const xLen = Math.hypot(1.6, 3.0), xTilt = Math.atan2(3.0, 1.6);
    for (let lane = -1; lane <= 1; lane++) {
      const x = lane * LANE_W;
      const open = lane === openLane;
      ball(g, open ? M.lampGreen : M.lampRed, 0.18, x, 4.2, 0.2);
      label(g, open ? 'OPEN' : 'CLOSED', 1.3, 0.32, open ? '#2bd96b' : '#e63946', '#ffffff', x, 4.62, 0.16);
      if (open) {
        const arrow = partAt(g, new THREE.ConeGeometry(0.3, 0.4, 4), M.lampGreen, x, 3.8, 0.1);
        arrow.rotation.x = Math.PI;                                          // points down into the lane
      } else {
        box(g, M.darkSteel, 0.05, 0.9, 0.05, x, 3.5, 0);                     // hanger from the beam
        for (const s of [1, -1]) {                                           // big red X across the lane
          const bar = partAt(g, new THREE.BoxGeometry(xLen, 0.14, 0.08), M.red, x, 2.0, 0.05 * s);
          bar.rotation.z = xTilt * s;
        }
      }
    }
    return g;
  }

  // ---------------------------------------------------------------------------
  // Story stops.
  // ---------------------------------------------------------------------------
  const STOPS = [
    {
      at: 215,
      title: 'Form X-ACT',
      landmark: {
        x: 5.5,
        build() {
          // Customs booth, an officer, and a form so long it rolls along the quay.
          const g = new THREE.Group();
          const bz = -1.6;
          box(g, M.darkSteel, 2.1, 0.2, 2.1, 0, 0, bz);
          box(g, M.white, 1.9, 2.3, 1.9, 0, 0.2, bz);
          box(g, M.glass, 1.94, 0.75, 1.94, 0, 1.25, bz);
          box(g, M.navy, 2.4, 0.22, 2.4, 0, 2.5, bz);
          box(g, M.yellow, 2.44, 0.1, 2.44, 0, 2.72, bz);
          label(g, 'CUSTOMS', 1.9, 0.42, '#1d3557', '#ffd23f', 0, 3.1, bz + 1.0);
          person(g, OFFICER, -0.2, 0, -0.35);
          box(g, M.paper, 0.45, 1.05, 0.02, -0.25, 0.05, 0.3);               // form hanging from the hands
          box(g, M.paper, 0.45, 0.02, 2.6, -0.25, 0, 1.6);                   // ...and trailing on the ground
          const roll = partAt(g, new THREE.CylinderGeometry(0.14, 0.14, 0.47, 10), M.paperShade, -0.25, 0.14, 2.95);
          roll.rotation.z = Math.PI / 2;
          box(g, M.darkSteel, 0.05, 0.9, 0.05, 0.6, 0, 2.6);
          label(g, 'PAGE 1 / 4,000', 1.1, 0.32, '#fdf6e3', '#1d3557', 0.6, 1.05, 2.63);
          return g;
        },
      },
      dialogueId: 'ch4_customs',
    },
    {
      at: 535,
      title: 'Dockside Press Scrum',
      landmark: {
        x: -5.5,
        build() {
          // Press backdrop and three journalists turned toward the road (+x).
          const g = new THREE.Group();
          box(g, M.navy, 3.6, 2.6, 0.12, 0, 0, -1.0);
          label(g, 'PORT PRESS POOL', 3.0, 0.5, '#1d3557', '#ffd23f', 0, 2.2, -0.93);
          person(g, REPORTER, 1.0, 0.2, 0.5);
          ball(g, M.red, 0.07, 1.35, 1.45, 0.55);                            // mic foam
          person(g, CAMERA_OP, -0.2, -0.2, 0.4);
          box(g, M.black, 0.26, 0.26, 0.55, 0.02, 1.5, -0.05);               // shoulder camera
          person(g, PHOTOGRAPHER, -1.3, 0.3, 0.6);
          return g;
        },
      },
      dialogueId: 'ch4_scrum',
    },
    {
      at: LENGTH,
      title: 'The Final Gate',
      landmark: {
        x: 5.2,
        build() {
          // Gate arch, one green and one red lamp, a desk, a trade official and a giant stamp.
          const g = new THREE.Group();
          for (const x of [-1.6, 1.6]) box(g, M.red, 0.5, 4.0, 0.5, x, 0, 0);
          box(g, M.navy, 3.9, 0.5, 0.6, 0, 4.0, 0);
          label(g, 'FINAL GATE', 3.0, 0.42, '#ffd23f', '#1d3557', 0, 4.25, 0.31);
          ball(g, M.lampGreen, 0.18, -1.6, 4.68, 0);
          ball(g, M.lampRed, 0.18, 1.6, 4.68, 0);
          person(g, TRADE_OFFICIAL, 0, -0.55, -0.3);
          box(g, M.wood, 1.6, 0.9, 0.7, 0, 0, 0.25);
          box(g, M.woodDark, 1.7, 0.06, 0.8, 0, 0.9, 0.25);
          label(g, 'APPROVED?', 1.2, 0.26, '#fdf6e3', '#e63946', 0, 0.5, 0.61);
          box(g, M.red, 0.4, 0.15, 0.3, 0.45, 0.96, 0.25);                   // giant stamp
          cyl(g, M.woodDark, 0.06, 0.35, 0.45, 1.11, 0.25);
          ball(g, M.woodDark, 0.12, 0.45, 1.5, 0.25);
          box(g, M.paper, 0.35, 0.01, 0.45, -0.4, 0.96, 0.25);
          return g;
        },
      },
      dialogueId: 'ch4_final',
    },
  ];

  // Gate schedule, fixed at load time so it can be read from mechanic.params.gates.
  const GATES = [];
  for (let at = GATE.firstGateAt; at <= LENGTH - GATE.finishMargin; at += GATE.gateEvery) {
    const nearStop = STOPS.some((s) => s.at >= at - GATE.stopClearBefore && s.at <= at + GATE.stopClearAfter);
    if (nearStop) continue;
    const rule = RULES[GATES.length % RULES.length];
    GATES.push({ at: at, lane: rule.lane, text: rule.text });
  }

  const SUMMARY = [
    'Rule gates.',
    `A three-lane customs gate spans the road at fixed distances: the first at ${GATE.firstGateAt} m, then every ${GATE.gateEvery} m, none later than ${GATE.finishMargin} m before the finish.`,
    `A gate is dropped if a story stop lies anywhere from ${GATE.stopClearBefore} m before it to ${GATE.stopClearAfter} m after it.`,
    `This chapter has ${GATES.length} gates, at ${GATES.map((g) => g.at).join(', ')} m.`,
    'Each gate has exactly one open lane (green lamp, green arrow, OPEN tag); the other two lanes are closed (red lamp, red X, CLOSED tag).',
    `An overhead sign ${GATE.signLead} m before each gate shows a silly rule whose text ends with the open lane (LEFT, CENTRE or RIGHT), with a green arrow over that lane.`,
    `The same text is shown with game.say when the hero is ${GATE.announceLead} m from the gate. Rules are used in the order of params.rules, one per gate.`,
    `Sign and gate are spawned when the gate is ${GATE.spawnAhead} m ahead, both centred on the road (lane 0); the open lane is passed separately as openLane.`,
    `When game.distance reaches the gate, the hero's lane is read once: if hero.x exists, lane = round(hero.x / ${LANE_W}) clamped to -1..+1; otherwise hero.lane (-1 left, 0 centre, +1 right); if neither exists, nothing happens.`,
    `Closed lane: lose ${GATE.heartCost} heart (game.hurt()) and Washington -${GATE.washingtonCost}. Open lane: nothing lost. Jumping or sliding makes no difference, and the gate never blocks movement.`,
    `The engine should place no random obstacles in the open lane within ${GATE.keepOpenLaneClear} m either side of a gate, so the open lane is always passable.`,
  ].join(' ');

  // ---------------------------------------------------------------------------
  // Hook helpers (engine API is not final; every call is guarded).
  // ---------------------------------------------------------------------------
  function say(game, text) { if (typeof game.say === 'function') game.say(text); }

  // Lane as -1 / 0 / +1. Prefers hero.x (true position mid lane change) when present.
  function heroLane(game) {
    const h = game.hero || {};
    if (typeof h.x === 'number') return Math.max(-1, Math.min(1, Math.round(h.x / LANE_W)));
    return typeof h.lane === 'number' ? h.lane : null;
  }

  let spawnWarned = false;
  function spawnGate(game, gate) {
    if (typeof game.spawn !== 'function') return;
    const signAt = gate.at - GATE.signLead;
    try {
      // Both props are built centred on the road, so they spawn in lane 0.
      game.spawn({ kind: 'ruleSign', lane: 0, z: -signAt, at: signAt, openLane: gate.lane, rule: gate.text, object: buildRuleSign(gate) });
      game.spawn({ kind: 'ruleGate', lane: 0, z: -gate.at, at: gate.at, openLane: gate.lane, object: buildRuleGate(gate.lane) });
    } catch (err) {
      // Gate logic still runs without visuals if the engine rejects custom kinds.
      if (!spawnWarned && typeof console !== 'undefined') console.warn('ch4: rule gate spawn failed', err);
      spawnWarned = true;
    }
  }

  function judge(game, gate, st) {
    const lane = heroLane(game);
    if (lane === null) return;                      // lane unknown: never punish
    if (lane === gate.lane) {
      st.passed++;
      say(game, PASS_QUIPS[(st.passed - 1) % PASS_QUIPS.length]);
      return;
    }
    st.missed++;
    for (let i = 0; i < GATE.heartCost; i++) if (typeof game.hurt === 'function') game.hurt();
    if (game.meters && typeof game.meters.washington === 'number') game.meters.washington -= GATE.washingtonCost;
    say(game, 'Wrong gate! The rule said ' + LANE_NAME[gate.lane] + '. -1 heart, -5 Washington.');
  }

  // ---------------------------------------------------------------------------
  // The chapter.
  // ---------------------------------------------------------------------------
  return {
    id: 'ch4',
    title: 'The Wall of Curbs',
    dateline: 'Port of Entry, October 2026',
    outfit: 'jacket',
    hideMeters: false,
    length: LENGTH,
    speed: { base: 13, max: 17 },

    frontPage: {
      headline: 'CHIP CHIEF HITS THE WALL OF CURBS',
      sub: "Port signs now read 'TUESDAYS: CENTRE'; officials insist this is perfectly normal",
    },

    // Container port at dusk: apricot sky, dusty-rose haze, sodium light, purple shadows.
    theme: {
      sky: '#ff8c61',
      fog: '#e98466',
      fogNear: 35,
      fogFar: 150,
      ground: '#2f3640',
      road: '#4b5361',
      laneLine: '#ffd23f',
      lightColor: '#ffc58a',
      lightIntensity: 0.9,
      ambient: '#7a5c99',
    },

    scenery: [
      {
        id: 'containerStack', side: 'right', every: 14, offset: 14,
        build(rng) {
          const r = rng || Math.random;
          const g = new THREE.Group();
          const L = 6, W = 2.4, H = 2.6;
          for (let col = 0; col < 2; col++) {
            for (let row = 0; row < 2; row++) {
              const x = (col - 0.5) * (W + 0.1), z = (row - 0.5) * (L + 0.2);
              const tiers = 1 + Math.floor(r() * 3);
              for (let t = 0; t < tiers; t++) {
                const c = Math.floor(r() * CONTAINER.length) % CONTAINER.length;
                box(g, CONTAINER[c], W, H - 0.05, L, x, t * H, z);
                box(g, CONTAINER_DOOR[c], W - 0.3, H - 0.45, 0.06, x, t * H + 0.2, z + L / 2);
              }
            }
          }
          return g;
        },
      },
      {
        id: 'gantryCrane', side: 'left', every: 90, offset: 15,
        build(rng) {
          const r = rng || Math.random;
          const g = new THREE.Group();
          for (const x of [-3.2, 3.2]) {
            box(g, M.darkSteel, 0.8, 0.5, 7.4, x, 0, 0);                     // rail bogie
            for (const z of [-3, 3]) box(g, M.red, 0.6, 13.5, 0.6, x, 0.5, z);
          }
          for (const z of [-3, 3]) box(g, M.red, 7.0, 0.7, 0.6, 0, 13.3, z); // portal beams
          box(g, M.red, 15, 0.9, 1.4, 0, 14, 0);                             // boom
          box(g, M.white, 3.4, 2.2, 3, 2.2, 14.9, 0);                        // machinery house
          box(g, M.red, 0.5, 2.6, 0.5, -1.2, 14.9, 0);                       // apex post
          ball(g, M.lampRed, 0.25, -1.2, 17.75, 0);                          // aviation light
          box(g, M.darkSteel, 1.6, 0.6, 1.8, -4.5, 13.4, 0);                 // trolley
          box(g, M.glass, 1.3, 1.1, 1.3, -4.5, 12.3, 0);                     // driver cab
          box(g, M.black, 0.08, 6, 0.08, -4.5, 6.3, 0);                      // hoist cable
          box(g, M.yellow, 2.6, 0.3, 6.2, -4.5, 6.0, 0);                     // spreader
          box(g, pick(r, CONTAINER), 2.4, 2.6, 6, -4.5, 3.4, 0);             // container mid-lift
          return g;
        },
      },
      {
        id: 'cargoShip', side: 'left', every: 220, offset: 27,
        build(rng) {
          const r = rng || Math.random;
          const g = new THREE.Group();
          box(g, M.water, 18, 0.03, 48, 0, 0, 0);
          box(g, M.red, 10.1, 1.0, 40.1, 0, 0, 0);                           // waterline band
          box(g, M.hull, 10, 3.6, 40, 0, 1.0, 0);
          for (let bay = 0; bay < 4; bay++) {
            const z = -16 + bay * 6.4;
            const tiers = 1 + Math.floor(r() * 3);
            for (let t = 0; t < tiers; t++) box(g, pick(r, CONTAINER), 9, 2.5, 6, 0, 4.6 + t * 2.55, z);
          }
          box(g, M.white, 9, 8, 5, 0, 4.6, 14);                              // bridge at the stern
          box(g, M.glass, 9.1, 0.8, 5.1, 0, 11.2, 14);
          box(g, M.white, 12, 0.35, 2, 0, 12.6, 15.2);                       // bridge wings
          box(g, M.red, 2, 4, 2.4, 0, 12.6, 10.5);                           // funnel
          box(g, M.yellow, 2.05, 0.6, 2.45, 0, 15.4, 10.5);
          return g;
        },
      },
      {
        id: 'customsBooth', side: 'right', every: 60, offset: 8,
        build() {
          const g = new THREE.Group();
          box(g, M.darkSteel, 2.3, 0.25, 2.3, 0, 0, 0);
          box(g, M.white, 2, 2.3, 2, 0, 0.25, 0);
          box(g, M.glass, 2.04, 0.8, 2.04, 0, 1.3, 0);
          box(g, M.navy, 2.5, 0.25, 2.5, 0, 2.55, 0);
          box(g, M.yellow, 2.54, 0.1, 2.54, 0, 2.8, 0);
          ball(g, M.lampAmber, 0.16, 0, 3.05, -0.6);
          label(g, 'CUSTOMS', 1.9, 0.42, '#1d3557', '#ffd23f', 0, 3.15, 1.0);
          for (const x of [-0.7, 0.7]) partAt(g, new THREE.ConeGeometry(0.2, 0.55, 8), M.cone, x, 0.275, 1.6);
          return g;
        },
      },
      {
        id: 'floodMast', side: 'both', every: 45, offset: 6.2,
        build() {
          const g = new THREE.Group();
          cyl(g, M.darkSteel, 0.35, 0.4, 0, 0, 0);
          cyl(g, M.steel, 0.12, 11, 0, 0.4, 0, 0.09);
          box(g, M.darkSteel, 1.8, 0.25, 0.3, 0, 11.4, 0);
          for (const x of [-0.6, 0, 0.6]) box(g, M.lampWarm, 0.45, 0.3, 0.22, x, 11.1, 0.15);
          ball(g, M.lampRed, 0.1, 0, 11.75, 0);
          return g;
        },
      },
      {
        id: 'palletPile', side: 'left', every: 34, offset: 8.5,
        build(rng) {
          const r = rng || Math.random;
          const g = new THREE.Group();
          for (const z of [-0.75, 0.75]) {
            box(g, M.woodDark, 1.8, 0.15, 1.3, 0, 0, z);
            const crates = 1 + Math.floor(r() * 3);
            for (let i = 0; i < crates; i++) {
              const x = i === 0 ? -0.43 : i === 1 ? 0.43 : 0;
              const y = i < 2 ? 0.15 : 0.85;
              box(g, M.wood, 0.82, 0.7, 1.1, x, y, z);
              box(g, M.chip, 0.4, 0.25, 0.02, x, y + 0.38, z + 0.56);       // green chip decal
            }
          }
          label(g, pick(r, PALLET_LABELS), 1.7, 0.3, '#ffd23f', '#22223b', 0, 0.32, 1.33);
          return g;
        },
      },
    ],

    // For 'high' obstacles, size.h is the object's own height and `clearance` is its underside (y).
    obstacles: [
      {
        id: 'barrierArm', type: 'high', weight: 3,
        size: { w: 1.9, h: 0.51, d: 0.26 }, clearance: 1.17,
        build() {
          // Red-and-white customs boom with a HALT tag. Slide under it.
          const g = new THREE.Group();
          const segW = 0.32, armY = 1.22, armH = 0.16;
          for (let i = 0; i < 5; i++) box(g, i % 2 ? M.white : M.red, segW, armH, 0.16, -0.95 + segW * (i + 0.5), armY, 0);
          box(g, M.darkSteel, 0.3, 0.26, 0.26, 0.8, armY - 0.05, 0);        // counterweight
          label(g, 'HALT', 0.7, 0.3, '#e63946', '#ffffff', -0.25, armY + armH + 0.15, 0);
          ball(g, M.lampRed, 0.07, -0.82, armY + armH + 0.07, 0);
          return g;
        },
      },
      {
        id: 'craneLoad', type: 'high', weight: 2,
        size: { w: 1.9, h: 3.62, d: 1.1 }, clearance: 1.25,
        build() {
          // A pallet of paperwork dangling from a crane hook. Slide under it.
          const g = new THREE.Group();
          const y0 = 1.25;
          box(g, M.woodDark, 1.8, 0.12, 1.1, 0, y0, 0);
          for (const x of [-0.58, 0, 0.58]) box(g, M.paper, 0.52, 0.42, 0.9, x, y0 + 0.12, 0);
          box(g, M.red, 1.72, 0.08, 0.94, 0, y0 + 0.3, 0);                   // red-tape strap
          label(g, 'URGENT', 0.7, 0.2, '#e63946', '#ffffff', 0, 1.47, 0.48);
          for (const x of [-0.88, 0.88]) box(g, M.black, 0.04, 1.59, 0.04, x, y0 + 0.06, 0);
          box(g, M.yellow, 1.9, 0.12, 0.12, 0, 2.9, 0);                      // spreader bar
          box(g, M.darkSteel, 0.3, 0.35, 0.3, 0, 3.02, 0);                   // hook block
          box(g, M.black, 0.05, 1.5, 0.05, 0, 3.37, 0);                      // hoist cable
          return g;
        },
      },
      {
        id: 'gpuCrate', type: 'low', weight: 3,
        size: { w: 1.52, h: 0.76, d: 1.02 },
        build() {
          // Wooden crate of properly declared GPUs, left in the road. Jump it.
          const g = new THREE.Group();
          box(g, M.wood, 1.5, 0.66, 1.0, 0, 0, 0);
          for (const y of [0.08, 0.5]) box(g, M.woodDark, 1.52, 0.08, 1.02, 0, y, 0);
          box(g, M.chip, 0.6, 0.05, 0.6, 0, 0.66, 0);
          box(g, M.gold, 0.28, 0.05, 0.28, 0, 0.71, 0);
          label(g, 'DECLARED: GPUS', 0.9, 0.22, '#ffd23f', '#22223b', 0, 0.33, 0.515);
          return g;
        },
      },
      {
        id: 'paperStack', type: 'low', weight: 2,
        size: { w: 1.69, h: 0.72, d: 0.77 },
        build() {
          // Three leaning stacks of forms and a rubber stamp. Jump them.
          const g = new THREE.Group();
          box(g, M.paper, 0.55, 0.3, 0.75, -0.58, 0, 0);
          box(g, M.paperShade, 0.5, 0.25, 0.7, -0.55, 0.3, 0.02);
          box(g, M.paperShade, 0.55, 0.35, 0.75, 0, 0, 0);
          box(g, M.paper, 0.52, 0.37, 0.72, -0.02, 0.35, -0.01);
          box(g, M.red, 0.57, 0.06, 0.77, 0, 0.32, 0);                       // red tape round the middle stack
          box(g, M.paper, 0.5, 0.4, 0.7, 0.58, 0, 0);
          box(g, M.red, 0.18, 0.06, 0.12, 0.58, 0.4, 0);                     // stamp base
          cyl(g, M.woodDark, 0.04, 0.15, 0.58, 0.46, 0);                     // stamp handle
          ball(g, M.woodDark, 0.06, 0.58, 0.64, 0);
          label(g, 'FORM 27B', 0.48, 0.14, '#fdf6e3', '#e63946', 0, 0.18, 0.386);
          return g;
        },
      },
      {
        id: 'redTapeWall', type: 'block', weight: 2,
        size: { w: 1.76, h: 2.05, d: 0.26 },
        build() {
          // Two stanchions criss-crossed with red tape. Change lane.
          const g = new THREE.Group();
          for (const x of [-0.75, 0.75]) {
            cyl(g, M.black, 0.13, 0.06, x, 0, 0);
            box(g, M.navy, 0.14, 1.9, 0.14, x, 0, 0);
            ball(g, M.gold, 0.1, x, 1.95, 0);
          }
          for (const y of [0.3, 0.7, 1.1, 1.5]) box(g, M.red, 1.5, 0.12, 0.04, 0, y, 0);
          const span = Math.hypot(1.5, 1.3), tilt = Math.atan2(1.3, 1.5);
          for (const s of [1, -1]) {
            const tape = partAt(g, new THREE.BoxGeometry(span, 0.1, 0.04), M.red, 0, 0.95, 0.03 * s);
            tape.rotation.z = tilt * s;
          }
          const seal = partAt(g, new THREE.CylinderGeometry(0.17, 0.17, 0.05, 10), M.gold, 0, 0.95, 0.06);
          seal.rotation.x = Math.PI / 2;
          label(g, 'RED TAPE', 1.0, 0.2, '#fdf6e3', '#e63946', 0, 1.79, 0.03);
          return g;
        },
      },
      {
        id: 'forklift', type: 'mover', weight: 2,
        size: { w: 1.4, h: 2.24, d: 2.61 },
        build() {
          // Block-sized forklift carrying forms; the engine slides it across lanes.
          const g = new THREE.Group();
          box(g, M.darkSteel, 1.3, 0.65, 0.35, 0, 0.25, -1.125);              // counterweight
          box(g, M.yellow, 1.3, 0.6, 1.6, 0, 0.25, -0.15);                   // chassis
          box(g, M.black, 0.5, 0.15, 0.45, 0, 0.85, -0.45);                  // seat
          box(g, M.black, 0.5, 0.45, 0.1, 0, 1.0, -0.72);                    // backrest
          for (const x of [-0.55, 0.55]) for (const z of [-0.85, 0.55]) box(g, M.black, 0.08, 1.15, 0.08, x, 0.85, z);
          box(g, M.yellow, 1.2, 0.06, 1.5, 0, 2.0, -0.15);                   // roof guard
          ball(g, M.lampAmber, 0.09, 0, 2.15, -0.15);                        // beacon
          for (const x of [-0.4, 0.4]) box(g, M.darkSteel, 0.1, 2.0, 0.12, x, 0.1, 0.75);
          box(g, M.darkSteel, 0.9, 0.1, 0.1, 0, 1.9, 0.75);
          for (const x of [-0.3, 0.3]) box(g, M.steel, 0.12, 0.05, 0.5, x, 0.1, 1.06);
          box(g, M.paper, 0.8, 0.35, 0.42, 0, 0.15, 1.06);                   // forms on the forks
          label(g, 'FORMS', 0.6, 0.2, '#fdf6e3', '#1d3557', 0, 0.33, 1.28);
          for (const x of [-0.6, 0.6]) {
            for (const z of [-0.8, 0.4]) {
              const wheel = partAt(g, new THREE.CylinderGeometry(0.25, 0.25, 0.2, 10), M.black, x, 0.25, z);
              wheel.rotation.z = Math.PI / 2;
            }
          }
          return g;
        },
      },
    ],

    collectible: {
      name: 'Export Licence',
      build() {
        // A stamped licence with a green glow behind it.
        const g = new THREE.Group();
        box(g, M.lampGreen, 0.42, 0.54, 0.01, 0, 0, -0.02);
        box(g, M.paper, 0.36, 0.48, 0.03, 0, 0.03, 0);
        for (let i = 0; i < 3; i++) box(g, M.ink, 0.24, 0.025, 0.034, -0.03, 0.42 - i * 0.065, 0);
        const stamp = partAt(g, new THREE.CylinderGeometry(0.08, 0.08, 0.036, 12), M.red, 0.07, 0.15, 0);
        stamp.rotation.x = Math.PI / 2;
        const seal = partAt(g, new THREE.CylinderGeometry(0.045, 0.045, 0.04, 8), M.gold, -0.11, 0.1, 0);
        seal.rotation.x = Math.PI / 2;
        return g;
      },
    },

    stops: STOPS,

    dialogues: {
      ch4_customs: [
        { speaker: 'Customs Officer', text: 'Halt! Anything to declare? Form X-ACT, please. Only 4,000 pages.' },
        { speaker: 'Customs Officer', text: 'Question 1: is this a graphics card, or a supercomputer pretending to be shy?' },
        { speaker: 'Jensen', text: "Both. It's declared on page 2,317, under 'Very Fast'." },
        { speaker: 'Customs Officer', text: 'Rule gates ahead: take the green lane. Red lanes cost a heart and a stern letter.' },
      ],
      ch4_scrum: [
        { speaker: 'Reporter', text: 'Jensen! The rules changed three times since breakfast. Thoughts?' },
        { speaker: 'Jensen', text: 'I think we made a mistake, and this mistake is hard to unwind.' },
        { speaker: 'Camera Operator', text: "Who's 'we'? The industry? The Senator? That forklift?" },
        { speaker: 'Photographer', text: 'And your rivals across the ocean? Enemies?' },
        { speaker: 'Jensen', text: "They're not our enemies." },
        { speaker: 'Reporter', text: "Headline: 'JACKET CALLS FOR CALM. JACKET STILL SHINY.'" },
      ],
      ch4_final: [
        { speaker: 'Trade Official', text: 'Final gate. One stamp, two forms. No pressure.' },
        { speaker: 'Jensen', text: 'Is there a form for choosing the form?' },
        {
          speaker: 'Trade Official',
          text: 'This is it. Choose before the rules update.',
          choices: [
            {
              text: 'Comply: slower chip, faster paperwork.',
              effects: { stock: -5, board: 10, washington: 10, beijing: -10 },
              next: 'ch4_final_comply',
            },
            {
              text: 'Lobby: argue the curbs backfire.',
              effects: { stock: 10, board: -5, washington: -10, beijing: 10 },
              next: 'ch4_final_lobby',
            },
          ],
        },
      ],
      ch4_final_comply: [
        { speaker: 'Trade Official', text: "Stamped! Your chip is officially 'considerate'." },
        { speaker: 'Jensen', text: 'We could be of great service to the local market.' },
      ],
      ch4_final_lobby: [
        { speaker: 'Trade Official', text: 'Noted. Filed. Forwarded to a committee that forwards things to committees.' },
      ],
    },

    mechanic: {
      name: 'Rule Gates',
      summary: SUMMARY,
      params: {
        laneWidth: LANE_W,
        laneValues: { left: -1, centre: 0, right: 1 },
        firstGateAt: GATE.firstGateAt,
        gateEvery: GATE.gateEvery,
        finishMargin: GATE.finishMargin,
        signLead: GATE.signLead,
        announceLead: GATE.announceLead,
        spawnAhead: GATE.spawnAhead,
        stopClearBefore: GATE.stopClearBefore,
        stopClearAfter: GATE.stopClearAfter,
        heartCost: GATE.heartCost,
        washingtonCost: GATE.washingtonCost,
        keepOpenLaneClear: GATE.keepOpenLaneClear,
        rules: RULES,
        gates: GATES,
      },
      // Builders for the spawned props, in case the engine prefers to build them itself.
      buildRuleSign: buildRuleSign,
      buildRuleGate: buildRuleGate,
    },

    onStart(game) {
      game.state = game.state || {};
      game.state.ch4 = {
        gates: GATES.map((g) => ({ at: g.at, lane: g.lane, text: g.text, spawned: false, announced: false, resolved: false })),
        passed: 0,
        missed: 0,
      };
      say(game, 'Rule gates ahead: read the sign, take the GREEN lane.');
    },

    onUpdate(game, dt) {
      const st = game.state && game.state.ch4;
      if (!st || typeof game.distance !== 'number') return;
      const d = game.distance;
      for (const gate of st.gates) {
        if (gate.resolved) continue;
        if (!gate.spawned && d >= gate.at - GATE.spawnAhead) { gate.spawned = true; spawnGate(game, gate); }
        if (!gate.announced && d >= gate.at - GATE.announceLead) { gate.announced = true; say(game, gate.text); }
        if (d >= gate.at) { gate.resolved = true; judge(game, gate, st); }
      }
    },

    endCard: {
      title: 'Customs Cleared (Pending Review)',
      lines: [
        'You ran the Wall of Curbs, and only some of it ran you.',
        'Forms filled: 4,000. Pens retired: 3.',
        'The rules changed twice while you read this card.',
        'Next stop: wherever the paperwork says.',
      ],
    },
  };
};
