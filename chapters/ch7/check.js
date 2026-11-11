'use strict';
// Validates chapter.js against the chapter content-module contract. Run: node check.js
const THREE = require('./three.min.js');

let failures = 0;
let passes = 0;
function ok(cond, msg) {
  if (cond) passes++;
  else {
    failures++;
    console.log('FAIL ' + msg);
  }
}

// Any THREE warning during building (bad material params etc.) counts as a failure.
const warnings = [];
const realWarn = console.warn;
console.warn = (...args) => warnings.push(args.join(' '));

// ---- Stub kit ----
const signTexts = [];
const kit = {
  textPlane(text, o) {
    o = o || {};
    signTexts.push(String(text));
    const m = new THREE.Mesh(new THREE.PlaneGeometry(o.w || 1, o.h || 0.5),
      new THREE.MeshBasicMaterial({ color: o.bg || '#ffffff' }));
    m.userData.text = String(text);
    return m;
  },
  person(o) {
    const g = new THREE.Group();
    g.userData.isPerson = true;
    const m = new THREE.MeshLambertMaterial({ color: (o && o.top) || '#888888' });
    const part = (w, h, d, x, y0) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      b.position.set(x, y0 + h / 2, 0);
      g.add(b);
    };
    part(0.18, 0.85, 0.22, -0.11, 0);
    part(0.18, 0.85, 0.22, 0.11, 0);
    part(0.5, 0.62, 0.3, 0, 0.85);
    part(0.3, 0.33, 0.3, 0, 1.47);
    return g;
  }
};

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ch = require('./chapter.js')(THREE, kit);

const isStr = (v) => typeof v === 'string' && v.length > 0;
const isNum = (v) => typeof v === 'number' && isFinite(v);
const isHex = (v) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
const METERS = ['stock', 'board', 'washington', 'beijing'];
const EPS = 1e-3;
// "Readable in under 15 seconds" at 240 words per minute.
const MAX_WORDS_PER_STOP = 60;

function meshCount(o) {
  let n = 0;
  o.traverse((c) => { if (c.isMesh) n++; });
  return n;
}
function textsOf(o) {
  const out = [];
  o.traverse((c) => { if (c.userData && typeof c.userData.text === 'string') out.push(c.userData.text); });
  return out;
}
function measure(o) {
  const b = new THREE.Box3().setFromObject(o);
  const s = b.getSize(new THREE.Vector3());
  const c = b.getCenter(new THREE.Vector3());
  return { b, w: s.x, h: s.y, d: s.z, c };
}
const fmt = (m) => `w=${m.w.toFixed(3)} h=${m.h.toFixed(3)} d=${m.d.toFixed(3)} ` +
  `minY=${m.b.min.y.toFixed(3)} maxY=${m.b.max.y.toFixed(3)} cx=${m.c.x.toFixed(3)} cz=${m.c.z.toFixed(3)}`;

// Builds twice, checks it is a fresh Group with a sane mesh count and nothing underground.
function checkBuild(label, fn, maxMeshes) {
  let a, b;
  try {
    a = fn();
    b = fn();
  } catch (e) {
    ok(false, `${label}: build() threw ${e.message}`);
    return null;
  }
  ok(a && a.isGroup, `${label}: build() returns a THREE.Group`);
  if (!a || !a.isGroup) return null;
  ok(a !== b, `${label}: build() returns a NEW group each call`);
  const n = meshCount(a);
  ok(n >= 1 && n <= maxMeshes, `${label}: mesh count ${n} within 1..${maxMeshes}`);
  const m = measure(a);
  ok(m.b.min.y >= -0.02, `${label}: nothing below ground (minY=${m.b.min.y.toFixed(3)})`);
  return { g: a, m, n };
}

// ---- Required fields ----
ok(ch.id === 'ch7', 'id is ch7');
ok(isStr(ch.title), 'title');
ok(isStr(ch.dateline), 'dateline');
ok(ch.outfit === 'young' || ch.outfit === 'jacket', 'outfit is young|jacket');
ok(typeof ch.hideMeters === 'boolean', 'hideMeters boolean');
ok(isNum(ch.length) && ch.length >= 700 && ch.length <= 900, 'length 700-900');
ok(ch.speed && isNum(ch.speed.base) && isNum(ch.speed.max), 'speed.base/max numbers');
ok(ch.speed.base >= 11 && ch.speed.max <= 20 && ch.speed.base <= ch.speed.max, 'speed within 11-20, base <= max');
ok(ch.frontPage && isStr(ch.frontPage.headline) && isStr(ch.frontPage.sub), 'frontPage headline/sub');
const T = ch.theme || {};
['sky', 'fog', 'ground', 'road', 'laneLine', 'lightColor', 'ambient'].forEach((k) =>
  ok(isHex(T[k]), `theme.${k} is #hex`));
['fogNear', 'fogFar', 'lightIntensity'].forEach((k) => ok(isNum(T[k]), `theme.${k} is a number`));
ok(T.fogNear < T.fogFar, 'fogNear < fogFar');
ok(Array.isArray(ch.scenery) && ch.scenery.length >= 4 && ch.scenery.length <= 7, 'scenery has 4-7 kinds');
ok(Array.isArray(ch.obstacles) && ch.obstacles.length >= 5 && ch.obstacles.length <= 7, 'obstacles has 5-7 kinds');
ok(ch.collectible && isStr(ch.collectible.name) && typeof ch.collectible.build === 'function', 'collectible name/build');
ok(Array.isArray(ch.stops) && ch.stops.length >= 3 && ch.stops.length <= 4, 'stops has 3-4 entries');
ok(ch.dialogues && typeof ch.dialogues === 'object', 'dialogues object');
ok(ch.mechanic && isStr(ch.mechanic.summary) && ch.mechanic.summary.length >= 80, 'mechanic.summary is a real description');
ok(ch.mechanic && ch.mechanic.params && typeof ch.mechanic.params === 'object', 'mechanic.params object');
ok(typeof ch.onStart === 'function' && typeof ch.onUpdate === 'function', 'onStart/onUpdate functions');
ok(ch.endCard && isStr(ch.endCard.title) && Array.isArray(ch.endCard.lines) && ch.endCard.lines.length > 0 &&
  ch.endCard.lines.every(isStr), 'endCard title/lines');

// ---- Stops ----
const stops = ch.stops || [];
stops.forEach((s, i) => {
  ok(isNum(s.at) && isStr(s.title) && isStr(s.dialogueId), `stop ${i}: at/title/dialogueId`);
  ok(s.landmark && isNum(s.landmark.x) && typeof s.landmark.build === 'function', `stop ${i}: landmark x/build`);
  if (i > 0) ok(s.at > stops[i - 1].at, `stop ${i}: sorted by distance`);
});
ok(stops.length && stops[0].at >= 150, 'first stop at >= 150 m');
ok(stops.length && stops[stops.length - 1].at === ch.length, 'last stop at == length');

// ---- Dialogues ----
const D = ch.dialogues || {};
const allLines = [];
Object.keys(D).forEach((id) => {
  ok(Array.isArray(D[id]) && D[id].length > 0, `dialogue ${id}: non-empty array`);
  (D[id] || []).forEach((node, j) => {
    const where = `dialogue ${id}[${j}]`;
    ok(isStr(node.speaker) && isStr(node.text), `${where}: speaker/text`);
    allLines.push({ where, text: node.text });
    if (node.next !== undefined) ok(D[node.next] !== undefined, `${where}: next "${node.next}" resolves`);
    if (node.choices !== undefined) {
      ok(Array.isArray(node.choices) && node.choices.length > 0, `${where}: choices array`);
      node.choices.forEach((c, k) => {
        ok(isStr(c.text), `${where}.choices[${k}]: text`);
        allLines.push({ where: `${where}.choices[${k}]`, text: c.text });
        if (c.next !== undefined) ok(D[c.next] !== undefined, `${where}.choices[${k}]: next "${c.next}" resolves`);
        if (c.effects) {
          Object.keys(c.effects).forEach((m) => {
            ok(METERS.includes(m), `${where}.choices[${k}]: meter "${m}" is valid`);
            ok(isNum(c.effects[m]) && c.effects[m] >= -15 && c.effects[m] <= 15,
              `${where}.choices[${k}]: effect ${m}=${c.effects[m]} within -15..15`);
          });
        }
      });
    }
  });
});
stops.forEach((s) => ok(D[s.dialogueId] !== undefined, `stop "${s.title}": dialogueId "${s.dialogueId}" resolves`));
allLines.forEach((l) => ok(l.text.length <= 140, `${l.where}: text <= 140 chars (${l.text.length})`));

// Every path a stop's dialogue can take (following next/choices.next).
function paths(id, seen) {
  seen = seen || [];
  if (seen.includes(id) || !D[id]) return [[]];
  const nodes = D[id];
  const out = [];
  const branches = [];
  nodes.forEach((n) => {
    if (n.next) branches.push(n.next);
    (n.choices || []).forEach((c) => { if (c.next) branches.push(c.next); });
  });
  if (!branches.length) return [nodes.slice()];
  branches.forEach((b) => paths(b, seen.concat(id)).forEach((p) => out.push(nodes.concat(p))));
  return out;
}
function reachable(id) {
  const reach = new Set();
  (function walk(x) {
    if (reach.has(x) || !D[x]) return;
    reach.add(x);
    D[x].forEach((n) => {
      if (n.next) walk(n.next);
      (n.choices || []).forEach((c) => c.next && walk(c.next));
    });
  })(id);
  return reach;
}
const words = (t) => t.trim().split(/\s+/).filter(Boolean).length;
stops.forEach((s) => {
  paths(s.dialogueId).forEach((p, i) => {
    ok(p.length >= 2 && p.length <= 6, `stop "${s.title}" path ${i}: ${p.length} lines (2-6)`);
    // Count every line and every on-screen choice label along the path.
    const n = p.reduce((a, node) => a + words(node.text) +
      (node.choices || []).reduce((b, c) => b + words(c.text), 0), 0);
    ok(n <= MAX_WORDS_PER_STOP, `stop "${s.title}" path ${i}: ${n} words (<= ${MAX_WORDS_PER_STOP}, under 15 s)`);
  });
});

// Exactly one 2-option choice in the last stop's dialogue (including its branches), not dominated.
if (stops.length) {
  const last = stops[stops.length - 1];
  const choiceNodes = [];
  reachable(last.dialogueId).forEach((id) => D[id].forEach((n) => { if (n.choices) choiceNodes.push(n); }));
  ok(choiceNodes.length === 1, `last stop has exactly one choice node (found ${choiceNodes.length})`);
  if (choiceNodes.length === 1) {
    const cs = choiceNodes[0].choices;
    ok(cs.length === 2, 'final choice has exactly 2 options');
    if (cs.length === 2) {
      const v = (c, m) => (c.effects && isNum(c.effects[m]) ? c.effects[m] : 0);
      const dominates = (a, b) => METERS.every((m) => v(a, m) >= v(b, m)) && METERS.some((m) => v(a, m) > v(b, m));
      const same = METERS.every((m) => v(cs[0], m) === v(cs[1], m));
      ok(!dominates(cs[0], cs[1]) && !dominates(cs[1], cs[0]) && !same, 'neither final option is better on every meter');
      ok(cs.every((c) => c.effects && Object.keys(c.effects).length > 0), 'both final options have meter effects');
    }
  }
}

// ---- Scenery ----
(ch.scenery || []).forEach((s, i) => {
  const label = `scenery ${s.id || i}`;
  ok(isStr(s.id), `${label}: id`);
  ok(['left', 'right', 'both'].includes(s.side), `${label}: side`);
  ok(isNum(s.every) && s.every > 0, `${label}: every > 0`);
  ok(isNum(s.offset) && s.offset >= 6, `${label}: offset >= 6`);
  [1, 2, 3, 42, 99].forEach((seed) => {
    const rng = mulberry32(seed);
    const r = checkBuild(`${label} (seed ${seed})`, () => s.build(rng), 40);
    if (!r) return;
    // Whatever way the engine turns it, the copy must stay off the 6 m wide road.
    const half = Math.max(Math.abs(r.m.b.min.x), Math.abs(r.m.b.max.x), Math.abs(r.m.b.min.z), Math.abs(r.m.b.max.z));
    ok(s.offset - half >= 3.2, `${label} (seed ${seed}): stays off the road (inner edge ${(s.offset - half).toFixed(2)} m)`);
    ok(r.m.b.max.y <= 22, `${label} (seed ${seed}): height ${r.m.b.max.y.toFixed(2)} <= 22`);
  });
});
const sceneryIds = (ch.scenery || []).map((s) => s.id);
ok(new Set(sceneryIds).size === sceneryIds.length, 'scenery ids unique');

// ---- Obstacles ----
const types = new Set();
function isLow(m) { return m.b.max.y <= 0.8 + EPS && m.w <= 1.8 + EPS && m.b.min.y <= 0.05; }
function isBlock(m) { return m.b.max.y >= 1.5 - EPS && m.w <= 1.8 + EPS && m.w >= 0.9 && m.b.min.y <= 0.05; }
(ch.obstacles || []).forEach((o, i) => {
  const label = `obstacle ${o.id || i} (${o.type})`;
  types.add(o.type);
  ok(isStr(o.id), `${label}: id`);
  ok(['low', 'high', 'block', 'mover'].includes(o.type), `${label}: type valid`);
  ok(isNum(o.weight) && o.weight > 0, `${label}: weight > 0`);
  ok(o.size && isNum(o.size.w) && isNum(o.size.h) && isNum(o.size.d), `${label}: size {w,h,d}`);
  const r = checkBuild(label, () => o.build(), 25);
  if (!r) return;
  const m = r.m;
  ok(Math.abs(m.c.x) <= 0.15 && Math.abs(m.c.z) <= 0.3, `${label}: origin at centre (${fmt(m)})`);
  if (o.type === 'low') ok(isLow(m), `${label}: low h<=0.8, w<=1.8 (${fmt(m)})`);
  if (o.type === 'block') ok(isBlock(m), `${label}: block h>=1.5, 0.9<=w<=1.8 (${fmt(m)})`);
  if (o.type === 'mover') ok(isLow(m) || isBlock(m), `${label}: mover is low- or block-sized (${fmt(m)})`);
  if (o.type === 'high') {
    ok(m.b.min.y >= 1.1 - EPS, `${label}: underside y >= 1.1 (${fmt(m)})`);
    ok(m.w >= 1.6 && m.w <= 2.0 + EPS, `${label}: spans one 2 m lane, 1.6<=w<=2.0 (${fmt(m)})`);
  }
  if (o.size) {
    const close = Math.abs(o.size.w - m.w) <= 0.1 && Math.abs(o.size.h - m.b.max.y) <= 0.1 && Math.abs(o.size.d - m.d) <= 0.1;
    ok(close, `${label}: declared size ${JSON.stringify(o.size)} matches measured (${fmt(m)})`);
  }
});
['low', 'high', 'block', 'mover'].forEach((t) => ok(types.has(t), `at least one ${t} obstacle`));

// ---- Collectible ----
if (ch.collectible && typeof ch.collectible.build === 'function') {
  const r = checkBuild('collectible', () => ch.collectible.build(), 25);
  if (r) {
    const big = Math.max(r.m.w, r.m.h, r.m.d);
    ok(big >= 0.3 && big <= 0.8, `collectible is about 0.5 m (largest side ${big.toFixed(2)})`);
    ok(Math.abs(r.m.c.x) <= 0.1 && Math.abs(r.m.c.z) <= 0.1, 'collectible origin centred');
  }
}

// ---- Landmarks ----
stops.forEach((s) => {
  if (!s.landmark || typeof s.landmark.build !== 'function') return;
  const label = `landmark "${s.title}"`;
  const r = checkBuild(label, () => s.landmark.build(), 25);
  if (!r) return;
  const big = Math.max(r.m.w, r.m.h, r.m.d);
  ok(big >= 3 && big <= 8, `${label}: 3-8 m set piece (largest side ${big.toFixed(2)})`);
  const inner = s.landmark.x > 0 ? s.landmark.x + r.m.b.min.x : -(s.landmark.x + r.m.b.max.x);
  ok(Math.abs(s.landmark.x) >= 3 && inner >= 3.2, `${label}: stays off the road (inner edge ${inner.toFixed(2)} m)`);
  // One kit.person per distinct speaker other than the hero, across every branch of the stop.
  let people = 0;
  r.g.traverse((c) => { if (c.userData && c.userData.isPerson) people++; });
  const speakers = new Set();
  reachable(s.dialogueId).forEach((id) => D[id].forEach((n) => { if (n.speaker !== 'Jensen') speakers.add(n.speaker); }));
  ok(people >= 1 && people >= speakers.size,
    `${label}: kit.person count ${people} covers speakers ${[...speakers].join(', ')}`);
});

// ---- Twist: committee door pickup ----
const P = (ch.mechanic && ch.mechanic.params) || {};
const doors = P.doors || [];
const LABEL = { stock: 'STOCK', board: 'BOARD', washington: 'WASHINGTON', beijing: 'BEIJING' };
const effectRe = /[+-]\d+\s+(WASHINGTON|BOARD|BEIJING|STOCK)/;
const pickup = ch.mechanic && ch.mechanic.pickup;
ok(doors.length === 3, 'mechanic has three committee doors');
ok(pickup && pickup.kind === P.spawnKind && typeof pickup.build === 'function', 'pickup kind matches params.spawnKind');
ok(/pickup\.build/.test(ch.mechanic.summary), 'mechanic.summary states the pickup build signature');
function signMatches(g, d) {
  return textsOf(g).some((t) => t.includes(`+${d.washington} WASHINGTON`) &&
    t.includes(`-${d.cost} ${LABEL[d.costMeter]}`) && /SLOW/.test(t));
}
doors.forEach((d, i) => {
  ok([-1, 1].includes(d.lane), `door ${i}: in a side lane`);
  ok(d.at > 0 && d.at < ch.length, `door ${i}: within the run`);
  ok(d.washington > 0 && ['board', 'beijing'].includes(d.costMeter) && d.cost > 0, `door ${i}: +washington, costs board or beijing`);
  stops.forEach((s) => ok(Math.abs(s.at - d.at) >= 40, `door ${i}: at least 40 m from stop "${s.title}"`));
  if (!pickup || typeof pickup.build !== 'function') return;
  const r = checkBuild(`door ${i} pickup`, () => pickup.build(i), 25);
  if (r) {
    ok(r.m.w <= 2.0 + EPS, `door ${i} pickup: fits one lane (w=${r.m.w.toFixed(2)})`);
    // The doorway must be open for a running hero: nothing in |x|<0.5 between 0.05 m and 2.3 m.
    let blocked = false;
    r.g.updateMatrixWorld(true);
    r.g.traverse((c) => {
      if (!c.isMesh) return;
      const b = new THREE.Box3().setFromObject(c);
      if (b.max.x > -0.5 && b.min.x < 0.5 && b.max.y > 0.05 && b.min.y < 2.3) blocked = true;
    });
    ok(!blocked, `door ${i} pickup: doorway is open`);
  }
  // Every way of asking for door i must show door i's own effects and the slow-down.
  const variants = {
    'build(i)': () => pickup.build(i),
    'build({door:i})': () => pickup.build({ door: i }),
    'build(spawn object without door)': () => pickup.build({ kind: P.spawnKind, lane: d.lane, z: -d.at }),
    'params.doors[i].build()': () => (typeof d.build === 'function' ? d.build() : null)
  };
  Object.keys(variants).forEach((k) => {
    const g = variants[k]();
    ok(g && g.isGroup && signMatches(g, d), `door ${i} ${k}: sign shows its own effects and the slow-down`);
  });
});
// A door that cannot be identified must not print any door's numbers.
[['build()', () => pickup.build()], ['build(rng)', () => pickup.build(mulberry32(7))], ['build({})', () => pickup.build({})]]
  .forEach(([k, fn]) => {
    const g = fn();
    ok(g && g.isGroup && meshCount(g) >= 1 && !textsOf(g).some((t) => effectRe.test(t)),
      `door ${k}: unidentified door shows no (possibly wrong) effects`);
  });

function simulate(laneAt, opts) {
  opts = opts || {};
  const said = [];
  const spawns = [];
  const game = {
    hero: { lane: 0, y: 0, hearts: 3 }, distance: 0, speed: ch.speed.base,
    meters: { stock: 50, board: 50, washington: 50, beijing: 50 }, state: {}, time: 0,
    say: (t) => said.push(t), hurt() {}, addCollect() {}, fail() {}
  };
  if (opts.spawn === 'throw') game.spawn = () => { throw new Error('unknown kind'); };
  else if (opts.spawn === 'false') game.spawn = () => false;
  else if (opts.spawn !== 'none') game.spawn = (o) => { spawns.push(o); };
  ch.onStart(game);
  const dt = 1 / 60;
  let slowFrames = 0;
  const slows = [];
  let cur = null;
  let guard = 0;
  while (game.distance < ch.length && guard++ < 1e6) {
    // Engine's own speed for this frame: either reset to base, or ramped from the current speed.
    if (opts.ramp) game.speed = Math.min(ch.speed.max, game.speed + opts.ramp * dt);
    else game.speed = ch.speed.base;
    const before = game.speed;
    game.hero.lane = laneAt(game.distance);
    ch.onUpdate(game, dt);
    if (game.speed <= P.slowSpeed + 1e-9) {
      slowFrames++;
      if (!cur) cur = { pre: before };
    } else if (cur) {
      cur.restored = game.speed;
      slows.push(cur);
      cur = null;
    }
    game.time += dt;
    game.distance += game.speed * dt;
  }
  return { game, said, spawns, slows, slowSeconds: slowFrames * dt };
}
const inDoorLane = (only) => (dist) => {
  const d = doors.find((x, i) => (only === undefined || only === i) && dist >= x.at - 10 && dist <= x.at + 1);
  return d ? d.lane : 0;
};
const sum = (pick) => doors.reduce((a, d) => a + pick(d), 0);
function expectAllDoors(label, run) {
  ok(run.game.meters.washington === 50 + sum((d) => d.washington), `${label}: washington ${run.game.meters.washington}`);
  ok(run.game.meters.board === 50 - sum((d) => (d.costMeter === 'board' ? d.cost : 0)), `${label}: board ${run.game.meters.board}`);
  ok(run.game.meters.beijing === 50 - sum((d) => (d.costMeter === 'beijing' ? d.cost : 0)), `${label}: beijing ${run.game.meters.beijing}`);
  ok(run.game.meters.stock === 50, `${label}: stock untouched`);
  ok(Math.abs(run.slowSeconds - 3 * P.slowSeconds) < 0.1, `${label}: slowed for ${run.slowSeconds.toFixed(2)} s`);
  ok(run.slows.length === 3, `${label}: three separate slow-downs (${run.slows.length})`);
  run.slows.forEach((s, i) => ok(s.restored >= s.pre - 1e-9 && s.restored <= ch.speed.max + 1e-9,
    `${label}: slow-down ${i} restores speed (${s.pre.toFixed(3)} -> ${s.restored.toFixed(3)})`));
}

const all = simulate(inDoorLane());
ok(all.spawns.length === 3 && all.spawns.every((s) => s.kind === P.spawnKind), 'onStart spawns three door pickups');
all.spawns.forEach((s, i) => {
  const g = pickup.build(s);
  ok(g && signMatches(g, doors[i]), `spawn object ${i} builds the matching door sign`);
});
expectAllDoors('all doors', all);

// An engine that ramps from game.speed must get its pre-door speed back after the 3 s.
expectAllDoors('all doors, ramping engine', simulate(inDoorLane(), { ramp: 0.05 }));

const none = simulate(() => 0);
ok(none.game.meters.washington === 50 - P.skipPenalty, `no doors: washington ${none.game.meters.washington}`);
ok(none.game.meters.board === 50 && none.game.meters.beijing === 50, 'no doors: board/beijing untouched');
ok(none.slowSeconds === 0, 'no doors: never slowed');

const one = simulate(inDoorLane(1));
ok(one.game.meters.washington === 50 + doors[1].washington, `one door: washington ${one.game.meters.washington}, no skip penalty`);
ok(Math.abs(one.slowSeconds - P.slowSeconds) < 0.1, `one door: slowed for ${one.slowSeconds.toFixed(2)} s`);

// Doors the engine could not draw must have no effect, and must not trigger the skip penalty.
['none', 'throw', 'false'].forEach((mode) => {
  [['in door lanes', inDoorLane()], ['centre lane', () => 0]].forEach(([how, lanes]) => {
    const r = simulate(lanes, { spawn: mode });
    const m = r.game.meters;
    ok(m.washington === 50 && m.board === 50 && m.beijing === 50 && m.stock === 50 && r.slowSeconds === 0,
      `spawn ${mode}, ${how}: unseen doors change nothing (${JSON.stringify(m)})`);
  });
});

// onUpdate must survive a sparse game object.
try {
  ch.onUpdate({ distance: 900 }, 0.016);
  ok(true, 'onUpdate tolerates a minimal game object');
} catch (e) {
  ok(false, 'onUpdate tolerates a minimal game object: ' + e.message);
}

// ---- Signs ----
ok(signTexts.length > 0 && signTexts.every((t) => t.trim().length > 0), 'all textPlane signs have text');

console.warn = realWarn;
ok(warnings.length === 0, 'no THREE warnings' + (warnings.length ? ': ' + warnings.slice(0, 3).join(' | ') : ''));

console.log(`${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
