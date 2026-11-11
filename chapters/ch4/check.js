/* Validates chapter.js against the content-module brief. Run: node check.js */
'use strict';

const THREE = require('./three.min.js');

// ---------------------------------------------------------------------------
// Stub kit: textPlane -> Mesh(PlaneGeometry), person -> Group of boxes, 1.8 m tall.
// ---------------------------------------------------------------------------
const textsDrawn = [];
const kit = {
  textPlane(text, opts) {
    const o = opts || {};
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(o.w || 1, o.h || 0.5), new THREE.MeshBasicMaterial());
    mesh.userData.kit = 'textPlane';
    mesh.userData.text = String(text);
    textsDrawn.push(String(text));
    return mesh;
  },
  person() {
    const g = new THREE.Group();
    const m = new THREE.MeshLambertMaterial({ color: '#888888' });
    // [w, h, d, x, yCentre, z]
    const parts = [
      [0.18, 0.85, 0.2, -0.12, 0.425, 0], [0.18, 0.85, 0.2, 0.12, 0.425, 0],  // legs
      [0.5, 0.65, 0.28, 0, 1.175, 0],                                          // torso
      [0.14, 0.6, 0.16, -0.33, 1.2, 0], [0.14, 0.6, 0.16, 0.33, 1.2, 0],      // arms
      [0.28, 0.3, 0.28, 0, 1.65, 0],                                           // head, top at 1.8
    ];
    for (const [w, h, d, x, y, z] of parts) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      mesh.position.set(x, y, z);
      mesh.userData.kit = 'person';
      g.add(mesh);
    }
    g.userData.kit = 'person';
    return g;
  },
};

// ---------------------------------------------------------------------------
// Tiny assertion harness.
// ---------------------------------------------------------------------------
const failures = [];
let passes = 0;
function ok(cond, msg) {
  if (cond) passes++;
  else failures.push(msg);
}
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isStr = (v) => typeof v === 'string' && v.length > 0;
const isHex = (v) => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);
const isFn = (v) => typeof v === 'function';
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const words = (s) => String(s).trim().split(/\s+/).filter(Boolean).length;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function countMeshes(obj) {
  let n = 0;
  obj.traverse((o) => { if (o.isMesh) n++; });
  return n;
}
function measure(obj) {
  obj.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(obj);
  const s = new THREE.Vector3();
  const c = new THREE.Vector3();
  b.getSize(s);
  b.getCenter(c);
  return { box: b, size: s, center: c };
}
// True if no mesh's bounding box touches the region x in [xMin, xMax], y in [0, yMax], z in [-1, 1].
function corridorClear(obj, xMin, xMax, yMax) {
  obj.updateMatrixWorld(true);
  const region = new THREE.Box3(new THREE.Vector3(xMin, 0, -1), new THREE.Vector3(xMax, yMax, 1));
  let clear = true;
  obj.traverse((o) => {
    if (o.isMesh && new THREE.Box3().setFromObject(o).intersectsBox(region)) clear = false;
  });
  return clear;
}

// Checks a build() result: Group, fresh each call, mesh limits, Lambert-only own meshes, no textures.
function checkBuild(label, buildFn, maxMeshes, arg) {
  const a = buildFn(arg);
  const b = buildFn(arg);
  ok(a instanceof THREE.Group, `${label}: build() must return a THREE.Group`);
  if (!(a instanceof THREE.Group)) return null;
  ok(a !== b, `${label}: build() must return a NEW Group each call`);
  const n = countMeshes(a);
  ok(n >= 1, `${label}: needs at least 1 mesh`);
  ok(n <= maxMeshes, `${label}: ${n} meshes > ${maxMeshes}`);
  a.traverse((o) => {
    if (!o.isMesh || o.userData.kit) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      ok(m && m.isMeshLambertMaterial, `${label}: own meshes must use MeshLambertMaterial`);
      ok(m && !m.map, `${label}: no image textures`);
    }
  });
  return a;
}

// ---------------------------------------------------------------------------
// Load the chapter.
// ---------------------------------------------------------------------------
let chapter;
try {
  const factory = require('./chapter.js');
  ok(isFn(factory), 'module.exports must be a factory function');
  chapter = factory(THREE, kit);
} catch (err) {
  console.error('FAIL: chapter.js threw while loading:', err);
  process.exit(1);
}
const ch = chapter;

// ---------------------------------------------------------------------------
// Dialogue graph helpers (used by the stop and dialogue checks).
// ---------------------------------------------------------------------------
function reachable(id, acc) {
  if (acc.has(id) || !ch.dialogues[id]) return acc;
  acc.add(id);
  for (const n of ch.dialogues[id]) {
    if (n.next) reachable(n.next, acc);
    for (const c of n.choices || []) if (c.next) reachable(c.next, acc);
  }
  return acc;
}
// Every play-through path from a dialogue id, as a list of what the player reads:
// { lines, words }. Choice option texts count as read at the node that offers them.
function paths(id, seen) {
  if (seen.has(id)) return [{ lines: Infinity, words: Infinity }];
  const nodes = ch.dialogues[id] || [];
  const nextSeen = new Set(seen).add(id);
  let lines = 0;
  let wordCount = 0;
  for (const n of nodes) {
    lines++;
    wordCount += words(n.text);
    for (const c of n.choices || []) wordCount += words(c.text);
    const branches = (n.choices || []).filter((c) => c.next).map((c) => c.next);
    if (n.next) branches.push(n.next);
    if (branches.length) {
      let out = [];
      for (const b of branches) {
        out = out.concat(paths(b, nextSeen).map((p) => ({ lines: p.lines + lines, words: p.words + wordCount })));
      }
      return out;
    }
  }
  return [{ lines, words: wordCount }];
}
function speakersFrom(id) {
  const out = new Set();
  for (const did of reachable(id, new Set())) for (const n of ch.dialogues[did]) out.add(n.speaker);
  return out;
}

// ---------------------------------------------------------------------------
// Required fields and chapter-specific values from the brief.
// ---------------------------------------------------------------------------
ok(ch && typeof ch === 'object', 'factory must return an object');
ok(ch.id === 'ch4', 'id must be ch4');
ok(ch.title === 'The Wall of Curbs', 'title');
ok(ch.dateline === 'Port of Entry, October 2026', 'dateline');
ok(ch.outfit === 'jacket', "outfit must be 'jacket'");
ok(ch.hideMeters === false, 'hideMeters must be false');
ok(isNum(ch.length) && ch.length >= 700 && ch.length <= 900, 'length must be 700-900');
ok(ch.speed && isNum(ch.speed.base) && isNum(ch.speed.max), 'speed.base/max required');
ok(ch.speed.base >= 11 && ch.speed.max <= 20 && ch.speed.base <= ch.speed.max, 'speed must be within 11-20 and base <= max');
ok(ch.speed.base === 13 && ch.speed.max === 17, 'speed must be 13-17 per brief');
ok(ch.frontPage && isStr(ch.frontPage.headline) && isStr(ch.frontPage.sub), 'frontPage.headline/sub');

const th = ch.theme || {};
for (const k of ['sky', 'fog', 'ground', 'road', 'laneLine', 'lightColor', 'ambient']) ok(isHex(th[k]), `theme.${k} must be #rrggbb`);
for (const k of ['fogNear', 'fogFar', 'lightIntensity']) ok(isNum(th[k]), `theme.${k} must be a number`);
ok(th.fogNear < th.fogFar, 'theme.fogNear < fogFar');

ok(Array.isArray(ch.scenery) && ch.scenery.length >= 4 && ch.scenery.length <= 7, 'scenery: 4-7 kinds');
ok(Array.isArray(ch.obstacles) && ch.obstacles.length >= 5 && ch.obstacles.length <= 7, 'obstacles: 5-7 kinds');
ok(ch.collectible && isStr(ch.collectible.name) && isFn(ch.collectible.build), 'collectible.name/build');
ok(Array.isArray(ch.stops) && ch.stops.length >= 3 && ch.stops.length <= 4, 'stops: 3-4');
ok(ch.dialogues && typeof ch.dialogues === 'object', 'dialogues object');
ok(ch.mechanic && isStr(ch.mechanic.summary) && ch.mechanic.summary.length > 80, 'mechanic.summary (precise)');
ok(ch.mechanic && ch.mechanic.params && typeof ch.mechanic.params === 'object', 'mechanic.params object');
ok(isFn(ch.onStart) && isFn(ch.onUpdate), 'onStart/onUpdate functions');
ok(ch.endCard && isStr(ch.endCard.title) && Array.isArray(ch.endCard.lines) && ch.endCard.lines.length > 0, 'endCard');

// ---------------------------------------------------------------------------
// Scenery.
// ---------------------------------------------------------------------------
const ROAD_HALF = 3;
const ids = new Set();
for (const s of ch.scenery) {
  const tag = `scenery ${s.id}`;
  ok(isStr(s.id) && !ids.has(s.id), `${tag}: unique id`);
  ids.add(s.id);
  ok(['left', 'right', 'both'].includes(s.side), `${tag}: side`);
  ok(isNum(s.every) && s.every > 0, `${tag}: every > 0`);
  ok(isNum(s.offset) && s.offset >= 6, `${tag}: offset >= 6`);
  ok(isFn(s.build), `${tag}: build()`);
  for (let seed = 1; seed <= 20; seed++) {
    const g = checkBuild(`${tag} seed ${seed}`, s.build, 40, mulberry32(seed));
    if (!g) break;
    const m = measure(g);
    ok(m.box.min.y >= -0.01, `${tag}: must sit on the ground (min.y ${m.box.min.y.toFixed(2)})`);
    const halfW = Math.max(Math.abs(m.box.min.x), Math.abs(m.box.max.x));
    ok(s.offset - halfW >= ROAD_HALF, `${tag}: intrudes on the road (inner edge ${(s.offset - halfW).toFixed(2)})`);
    ok(m.size.z <= s.every + 40, `${tag}: implausibly deep`);
  }
}

// ---------------------------------------------------------------------------
// Obstacles: GEOMETRY RULES on measured bounding boxes.
// ---------------------------------------------------------------------------
const TOL = 0.01;
const types = new Set();
// Both ground-standing kinds must start at the ground, not float.
function onGround(m) { return m.box.min.y >= -TOL && m.box.min.y <= 0.05; }
function lowOk(m) { return onGround(m) && m.box.max.y <= 0.8 + TOL && m.size.y <= 0.8 + TOL && m.size.x <= 1.8 + TOL; }
function blockOk(m) { return onGround(m) && m.size.y >= 1.5 - TOL && m.size.x <= 1.8 + TOL && m.size.x >= 1.0; }
for (const o of ch.obstacles) {
  const tag = `obstacle ${o.id}`;
  ok(isStr(o.id), `${tag}: id`);
  ok(['low', 'high', 'block', 'mover'].includes(o.type), `${tag}: type`);
  types.add(o.type);
  ok(isNum(o.weight) && o.weight > 0, `${tag}: weight > 0`);
  ok(o.size && isNum(o.size.w) && isNum(o.size.h) && isNum(o.size.d), `${tag}: size {w,h,d}`);
  const g = checkBuild(tag, o.build, 25);
  if (!g) continue;
  const m = measure(g);
  const desc = `w ${m.size.x.toFixed(2)} h ${m.size.y.toFixed(2)} d ${m.size.z.toFixed(2)} minY ${m.box.min.y.toFixed(2)} maxY ${m.box.max.y.toFixed(2)}`;
  if (o.type === 'low') ok(lowOk(m), `${tag}: low rule broken (${desc})`);
  if (o.type === 'block') ok(blockOk(m), `${tag}: block rule broken (${desc})`);
  if (o.type === 'mover') ok(lowOk(m) || blockOk(m), `${tag}: mover must be low- or block-sized (${desc})`);
  if (o.type === 'high') {
    ok(m.box.min.y >= 1.1 - TOL, `${tag}: underside must be >= 1.1 (${desc})`);
    ok(m.size.x >= 1.5 && m.size.x <= 2.0 + TOL, `${tag}: must span one lane (${desc})`);
    ok(isNum(o.clearance) && near(o.clearance, m.box.min.y, 0.05), `${tag}: clearance should match underside`);
  }
  ok(near(m.center.x, 0, 0.15) && near(m.center.z, 0, 0.15), `${tag}: origin must be at the centre (${m.center.x.toFixed(2)}, ${m.center.z.toFixed(2)})`);
  ok(near(o.size.w, m.size.x, 0.05) && near(o.size.h, m.size.y, 0.05) && near(o.size.d, m.size.z, 0.05),
    `${tag}: declared size ${JSON.stringify(o.size)} != measured (${desc})`);
}
for (const t of ['low', 'high', 'block', 'mover']) ok(types.has(t), `need at least one '${t}' obstacle`);

// ---------------------------------------------------------------------------
// Collectible.
// ---------------------------------------------------------------------------
{
  const g = checkBuild('collectible', ch.collectible.build, 25);
  if (g) {
    const m = measure(g);
    const big = Math.max(m.size.x, m.size.y, m.size.z);
    ok(big >= 0.3 && big <= 0.8, `collectible: should be about 0.5 m (largest side ${big.toFixed(2)})`);
    ok(m.box.min.y >= -TOL, 'collectible: origin on the ground');
  }
}

// ---------------------------------------------------------------------------
// Stops.
// ---------------------------------------------------------------------------
const stops = ch.stops;
for (let i = 0; i < stops.length; i++) {
  const s = stops[i];
  const tag = `stop ${i} (${s.title})`;
  ok(isNum(s.at), `${tag}: at`);
  if (i > 0) ok(s.at > stops[i - 1].at, `${tag}: stops must be sorted`);
  ok(isStr(s.title), `${tag}: title`);
  ok(s.landmark && isNum(s.landmark.x) && isFn(s.landmark.build), `${tag}: landmark.x/build`);
  ok(isStr(s.dialogueId) && ch.dialogues[s.dialogueId], `${tag}: dialogueId '${s.dialogueId}' must resolve`);
  const g = s.landmark && isFn(s.landmark.build) ? checkBuild(`${tag} landmark`, s.landmark.build, 25) : null;
  if (g) {
    const m = measure(g);
    const big = Math.max(m.size.x, m.size.y, m.size.z);
    ok(big >= 3 && big <= 8.5, `${tag} landmark: should be a 3-8 m set piece (largest side ${big.toFixed(2)})`);
    ok(m.box.min.y >= -TOL, `${tag} landmark: on the ground`);
    let people = 0;
    g.traverse((o) => { if (o.userData.kit === 'person' && o.isGroup) people++; });
    const cast = [...speakersFrom(s.dialogueId)].filter((sp) => sp !== 'Jensen');
    ok(people >= Math.max(1, cast.length),
      `${tag} landmark: has ${people} people but the dialogue has ${cast.length} non-hero speakers (${cast.join(', ')})`);
    const halfW = Math.max(Math.abs(m.box.min.x), Math.abs(m.box.max.x));
    ok(Math.abs(s.landmark.x) - halfW >= ROAD_HALF, `${tag} landmark: intrudes on the road`);
  }
}
ok(stops[0].at >= 150, 'first stop must be at >= 150 m');
ok(stops[stops.length - 1].at === ch.length, 'last stop must be at length');

// ---------------------------------------------------------------------------
// Dialogues.
// ---------------------------------------------------------------------------
const METERS = ['stock', 'board', 'washington', 'beijing'];
for (const [id, nodes] of Object.entries(ch.dialogues)) {
  ok(Array.isArray(nodes) && nodes.length > 0, `dialogue ${id}: non-empty array`);
  for (const n of nodes) {
    ok(isStr(n.speaker) && isStr(n.text), `dialogue ${id}: node needs speaker and text`);
    ok(n.text.length <= 140, `dialogue ${id}: text over 140 chars: "${n.text}"`);
    if (n.next !== undefined) ok(!!ch.dialogues[n.next], `dialogue ${id}: next '${n.next}' must resolve`);
    if (n.choices) {
      ok(Array.isArray(n.choices) && n.choices.length > 0, `dialogue ${id}: choices array`);
      for (const c of n.choices) {
        ok(isStr(c.text) && c.text.length <= 140, `dialogue ${id}: choice text missing or over 140 chars`);
        if (c.next !== undefined) ok(!!ch.dialogues[c.next], `dialogue ${id}: choice next '${c.next}' must resolve`);
        if (c.effects) for (const k of Object.keys(c.effects)) ok(METERS.includes(k), `dialogue ${id}: unknown meter '${k}'`);
      }
    }
  }
}

// Every path through a stop's dialogue is 2-6 lines and readable in under 15 s
// (240 words per minute silent reading = 60 words, choice options included).
const MAX_WORDS = Math.floor((240 / 60) * 15);
for (const s of stops) {
  for (const p of paths(s.dialogueId, new Set())) {
    ok(p.lines >= 2 && p.lines <= 6, `stop '${s.title}': dialogue path has ${p.lines} lines (want 2-6)`);
    ok(p.words <= MAX_WORDS, `stop '${s.title}': dialogue path has ${p.words} words (max ${MAX_WORDS} for 15 s)`);
  }
}

// Verified quotes: if a hero line contains one, the line must be exactly the quote (no added framing).
const QUOTES = [
  'Free AI should be great for hardware. Free AI should be great for chips.',
  'These Chinese models are excellent.',
  'I think we made a mistake, and this mistake is hard to unwind.',
  "they're not our enemies.",
  'We could be of great service to the local market.',
  'I owe my family and all of you an apology.',
];
const norm = (t) => String(t).toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/[.!?\s]+$/, '').trim();
const heroLines = [];
for (const nodes of Object.values(ch.dialogues)) for (const n of nodes) if (n.speaker === 'Jensen') heroLines.push(n.text);
for (const q of QUOTES) {
  for (const line of heroLines) {
    if (norm(line).includes(norm(q))) ok(norm(line) === norm(q), `hero quote must stand alone, verbatim: "${line}"`);
  }
}
// The brief puts two quotes at the press scrum.
{
  const scrumQuotes = ['I think we made a mistake, and this mistake is hard to unwind.', "they're not our enemies."];
  const found = stops.some((s) => {
    const lines = [];
    for (const id of reachable(s.dialogueId, new Set())) for (const n of ch.dialogues[id]) if (n.speaker === 'Jensen') lines.push(norm(n.text));
    return /scrum/i.test(s.title) && scrumQuotes.every((q) => lines.includes(norm(q)));
  });
  ok(found, 'press scrum stop must have Jensen say both scrum quotes verbatim');
}

// Exactly one 2-option choice in the last stop's dialogue (including dialogues it jumps to).
{
  const last = stops[stops.length - 1];
  const choiceNodes = [];
  for (const id of reachable(last.dialogueId, new Set())) {
    for (const n of ch.dialogues[id]) if (n.choices) choiceNodes.push(n);
  }
  ok(choiceNodes.length === 1, `last stop: exactly one choice node (found ${choiceNodes.length})`);
  const node = choiceNodes[0];
  if (node) {
    ok(node.choices.length === 2, 'last stop: choice must have exactly 2 options');
    const eff = node.choices.map((c) => METERS.map((k) => ((c.effects || {})[k] || 0)));
    for (const e of eff) for (const v of e) ok(isNum(v) && v >= -15 && v <= 15, `last stop: effect ${v} out of -15..15`);
    if (eff.length === 2) {
      const [a, b] = eff;
      const aDominates = a.every((v, i) => v >= b[i]);
      const bDominates = b.every((v, i) => v >= a[i]);
      ok(!aDominates && !bDominates, 'last stop: neither option may be better (or equal) on every meter');
    }
  }
}

// ---------------------------------------------------------------------------
// Mechanic: schedule sanity, summary completeness and builders.
// ---------------------------------------------------------------------------
const P = ch.mechanic.params;
const LANE_NAME = { '-1': 'LEFT', '0': 'CENTRE', '1': 'RIGHT' };
ok(Array.isArray(P.gates) && P.gates.length > 0, 'mechanic.params.gates list');
for (const gate of P.gates || []) {
  ok([-1, 0, 1].includes(gate.lane), `gate ${gate.at}: lane must be -1/0/1`);
  ok(isStr(gate.text) && gate.text.endsWith(LANE_NAME[gate.lane]), `gate ${gate.at}: rule text must end with its lane name`);
  ok(gate.at - P.signLead > 0 && gate.at <= ch.length - P.finishMargin, `gate ${gate.at}: inside the run`);
  const clash = stops.some((s) => s.at >= gate.at - P.stopClearBefore && s.at <= gate.at + P.stopClearAfter);
  ok(!clash, `gate ${gate.at}: too close to a story stop`);
}
for (let i = 1; i < (P.gates || []).length; i++) {
  ok(P.gates[i].at - P.gates[i - 1].at >= 60, 'gates must be spaced >= 60 m');
}
// The first stop explains the gates, so the first gate is not announced before it.
ok(P.gates[0].at - P.announceLead >= stops[0].at,
  `first gate (${P.gates[0].at} m, announced at ${P.gates[0].at - P.announceLead} m) must come after the first stop (${stops[0].at} m)`);

// The summary must state every number needed to reimplement the twist.
{
  const summary = ch.mechanic.summary;
  const keys = ['laneWidth', 'firstGateAt', 'gateEvery', 'finishMargin', 'signLead', 'announceLead', 'spawnAhead',
    'stopClearBefore', 'stopClearAfter', 'heartCost', 'washingtonCost', 'keepOpenLaneClear'];
  for (const k of keys) {
    ok(isNum(P[k]), `mechanic.params.${k} must be a number`);
    ok(new RegExp('(^|[^0-9.])' + P[k] + '([^0-9]|$)').test(summary), `mechanic.summary must state ${k} (${P[k]})`);
  }
  ok(/hero\.x/.test(summary) && /round/.test(summary), 'mechanic.summary must explain the hero.x -> lane conversion');
  for (const gate of P.gates || []) ok(summary.includes(String(gate.at)), `mechanic.summary must list gate ${gate.at}`);
}

// Gate and sign props: lane-correct, and nothing in the hero's way.
const JUMP_HEAD = 3.5; // jump peak 1.6 m + 1.8 m hero, rounded up
for (const lane of [-1, 0, 1]) {
  const g = checkBuild(`ruleGate lane ${lane}`, ch.mechanic.buildRuleGate, 25, lane);
  if (!g) continue;
  const m = measure(g);
  ok(near(m.center.x, 0, 0.15), `ruleGate lane ${lane}: must be built centred on the road`);
  ok(corridorClear(g, lane * 2 - 1, lane * 2 + 1, JUMP_HEAD), `ruleGate lane ${lane}: open lane must be clear up to ${JUMP_HEAD} m`);
  let open = 0;
  let closed = 0;
  g.traverse((o) => {
    if (o.userData.kit !== 'textPlane') return;
    const x = o.getWorldPosition(new THREE.Vector3()).x;
    if (o.userData.text === 'OPEN') { open++; ok(near(x, lane * 2, 0.2), `ruleGate lane ${lane}: OPEN tag must be over lane ${lane}`); }
    if (o.userData.text === 'CLOSED') { closed++; ok(!near(x, lane * 2, 0.5), `ruleGate lane ${lane}: CLOSED tag over the open lane`); }
  });
  ok(open === 1 && closed === 2, `ruleGate lane ${lane}: needs 1 OPEN and 2 CLOSED tags (got ${open}/${closed})`);
}
for (const gate of P.gates || []) {
  const g = checkBuild(`ruleSign ${gate.at}`, ch.mechanic.buildRuleSign, 25, gate);
  if (!g) continue;
  ok(corridorClear(g, -ROAD_HALF, ROAD_HALF, JUMP_HEAD), `ruleSign ${gate.at}: road must be clear up to ${JUMP_HEAD} m`);
}

// ---------------------------------------------------------------------------
// Hook smoke test: run the whole chapter with a fake game.
// ---------------------------------------------------------------------------
function simulate(policy) {
  const said = [];
  const spawns = [];
  let hurts = 0;
  const game = {
    hero: { lane: 0, y: 0, hearts: 99 },
    distance: 0,
    speed: ch.speed.base,
    meters: { stock: 50, board: 50, washington: 50, beijing: 50 },
    state: {},
    time: 0,
    say(t) { said.push(t); },
    hurt() { hurts++; this.hero.hearts--; },
    addCollect() {},
    spawn(o) { spawns.push(o); },
    fail() {},
  };
  ch.onStart(game);
  const dt = 1 / 60;
  let guard = 0;
  while (game.distance < ch.length && guard++ < 1e6) {
    game.hero.lane = policy(game);
    game.distance = Math.min(ch.length, game.distance + game.speed * dt);
    game.time += dt;
    ch.onUpdate(game, dt);
  }
  return { hurts, said, spawns, washington: game.meters.washington };
}
{
  const gates = P.gates || [];
  const centre = simulate(() => 0);
  const wrong = gates.filter((g) => g.lane !== 0).length;
  ok(centre.hurts === wrong, `sim (always centre): expected ${wrong} hurts, got ${centre.hurts}`);
  ok(centre.washington === 50 - P.washingtonCost * wrong, `sim (always centre): Washington should be ${50 - P.washingtonCost * wrong}, got ${centre.washington}`);
  ok(centre.spawns.length === gates.length * 2, `sim: expected ${gates.length * 2} spawns, got ${centre.spawns.length}`);
  for (const s of centre.spawns) {
    ok(s.object instanceof THREE.Group && countMeshes(s.object) <= 25, `sim: spawn ${s.kind} object`);
    ok(isNum(s.z) && isNum(s.at), `sim: spawn ${s.kind} fields`);
    // Props are built centred on the road, so they must spawn in lane 0 or they shift sideways.
    ok(s.lane === 0, `sim: spawn ${s.kind} at ${s.at} m must use lane 0 (got ${s.lane})`);
  }
  for (const g of gates) {
    const gs = centre.spawns.filter((s) => s.kind === 'ruleGate' && s.at === g.at);
    ok(gs.length === 1 && gs[0].openLane === g.lane, `sim: ruleGate at ${g.at} m must carry openLane ${g.lane}`);
    const ss = centre.spawns.filter((s) => s.kind === 'ruleSign' && s.at === g.at - P.signLead);
    ok(ss.length === 1 && ss[0].openLane === g.lane, `sim: ruleSign for ${g.at} m must stand at ${g.at - P.signLead} m`);
    ok(centre.said.includes(g.text), `sim: rule "${g.text}" must be announced`);
  }

  const perfect = simulate((game) => {
    const next = gates.find((g) => g.at > game.distance);
    return next ? next.lane : 0;
  });
  ok(perfect.hurts === 0 && perfect.washington === 50, `sim (perfect): expected no penalty, got ${perfect.hurts} hurts`);

  // Hero position mid lane change takes priority over hero.lane.
  const viaX = simulate((game) => {
    const next = gates.find((g) => g.at > game.distance);
    game.hero.x = (next ? next.lane : 0) * 2 + 0.3;
    return 5; // deliberately wrong lane index; x must win
  });
  ok(viaX.hurts === 0, 'sim (hero.x): lane must be read from hero.x when present');
}

// Hooks must survive a minimal game object.
try {
  const bare = { distance: 0, state: {} };
  ch.onStart(bare);
  for (let d = 0; d <= ch.length; d += 5) { bare.distance = d; ch.onUpdate(bare, 0.016); }
  passes++;
} catch (err) {
  failures.push('hooks must not throw on a minimal game object: ' + err.message);
}

ok(textsDrawn.every((t) => t.length > 0), 'every textPlane needs text');

// ---------------------------------------------------------------------------
if (failures.length) {
  console.error(`FAIL: ${failures.length} problem(s), ${passes} checks passed`);
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log(`PASS: ${passes} checks`);
