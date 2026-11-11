/*
 * Validates chapter.js against the content-module contract.
 * Run: node check.js   (exit code 0 = pass)
 */
'use strict';

const THREE = require('./three.min.js');

// ---------------------------------------------------------------------------
// Test plumbing
// ---------------------------------------------------------------------------
const failures = [];
let passed = 0;
function check(cond, msg) {
  if (cond) passed++;
  else failures.push(msg);
  return !!cond;
}

// Fail on any three.js warning (e.g. unknown material properties).
const warnings = [];
const realWarn = console.warn;
const realError = console.error;
console.warn = function () { warnings.push(Array.prototype.join.call(arguments, ' ')); };
console.error = function () { warnings.push(Array.prototype.join.call(arguments, ' ')); };

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Stub kit
// ---------------------------------------------------------------------------
const kitLog = { persons: 0, texts: [] };
const kit = {
  textPlane(text, opts) {
    check(typeof text === 'string' && text.length > 0, 'kit.textPlane called without text');
    check(opts && opts.w > 0 && opts.h > 0, 'kit.textPlane("' + text + '") needs numeric w and h');
    kitLog.texts.push(text);
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(opts.w, opts.h),
      new THREE.MeshBasicMaterial({ color: (opts && opts.bg) || '#ffffff' })
    );
    m.userData.kit = 'textPlane';
    m.userData.text = text;
    return m;
  },
  person(look) {
    look = look || {};
    kitLog.persons++;
    const g = new THREE.Group();
    g.userData.kit = 'person';
    const mat = new THREE.MeshBasicMaterial({ color: look.top || '#888888' });
    function part(w, h, d, x, y, z) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      m.userData.kit = 'person';
      g.add(m);
    }
    part(0.18, 0.85, 0.2, -0.11, 0.425, 0); // legs
    part(0.18, 0.85, 0.2, 0.11, 0.425, 0);
    part(0.5, 0.6, 0.28, 0, 1.15, 0); // torso
    part(0.13, 0.6, 0.15, -0.32, 1.15, 0); // arms
    part(0.13, 0.6, 0.15, 0.32, 1.15, 0);
    part(0.28, 0.3, 0.28, 0, 1.65, 0); // head, top at 1.8
    if (look.accessory) part(0.3, 0.06, 0.3, 0, 1.6, 0.02);
    return g;
  }
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const METERS = ['stock', 'board', 'washington', 'beijing'];
const HEX = /^#[0-9a-fA-F]{6}$/;
const ROAD_HALF = 3; // 3 lanes x 2 m
const r2 = (n) => Math.round(n * 100) / 100;

function meshCount(obj) {
  let n = 0;
  obj.traverse((o) => { if (o.isMesh) n++; });
  return n;
}
function bounds(obj) {
  const b = new THREE.Box3().setFromObject(obj);
  const s = new THREE.Vector3();
  const c = new THREE.Vector3();
  b.getSize(s);
  b.getCenter(c);
  return { min: b.min, max: b.max, size: s, center: c };
}
function finiteBox(b) {
  return [b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z].every(Number.isFinite);
}

// Builds with fn, checks it is a fresh Group with sane meshes/materials. Returns {group, b, persons}.
function checkBuild(label, fn, maxMeshes, arg) {
  const before = kitLog.persons;
  let g;
  try {
    g = fn(arg);
  } catch (e) {
    check(false, label + ': build() threw ' + e.message);
    return null;
  }
  const persons = kitLog.persons - before;
  if (!check(g && g.isGroup, label + ': build() must return a THREE.Group')) return null;
  const n = meshCount(g);
  check(n >= 1, label + ': needs at least 1 mesh');
  check(n <= maxMeshes, label + ': ' + n + ' meshes (max ' + maxMeshes + ')');
  g.traverse((o) => {
    if (!o.isMesh || o.userData.kit) return;
    check(o.material && o.material.isMeshLambertMaterial, label + ': non-kit mesh uses ' + (o.material && o.material.type));
    check(o.material && o.material.flatShading === true, label + ': material not flat-shaded');
  });
  const again = fn(arg);
  check(again !== g && (g.children.length === 0 || again.children[0] !== g.children[0]),
    label + ': build() must return a NEW group each call');
  const b = bounds(g);
  check(finiteBox(b), label + ': bounding box not finite');
  return { group: g, b: b, persons: persons, meshes: n };
}

// ---------------------------------------------------------------------------
// Load
// ---------------------------------------------------------------------------
const factory = require('./chapter.js');
if (!check(typeof factory === 'function', 'chapter.js must export a factory function')) finish();
const ch = factory(THREE, kit);
check(ch && typeof ch === 'object', 'factory must return an object');

// ---------------------------------------------------------------------------
// Required fields
// ---------------------------------------------------------------------------
check(ch.id === 'ch2', 'id must be "ch2"');
check(ch.title === 'The Jacket', 'title must be "The Jacket"');
check(ch.dateline === '2016 - 2025', 'dateline must be "2016 - 2025"');
check(ch.outfit === 'young', "outfit must be 'young'");
check(ch.hideMeters === false, 'hideMeters must be false');
check(Number.isFinite(ch.length) && ch.length >= 700 && ch.length <= 900, 'length must be 700-900');
check(ch.speed && ch.speed.base >= 11 && ch.speed.max <= 20 && ch.speed.base <= ch.speed.max, 'speed must be within 11-20 with base <= max');
check(ch.speed && ch.speed.base === 12 && ch.speed.max === 16, 'speed must be 12-16 per the brief');
check(ch.frontPage && typeof ch.frontPage.headline === 'string' && ch.frontPage.headline && typeof ch.frontPage.sub === 'string' && ch.frontPage.sub,
  'frontPage needs headline and sub');

const t = ch.theme || {};
['sky', 'fog', 'ground', 'road', 'laneLine', 'lightColor', 'ambient'].forEach((k) => {
  check(HEX.test(t[k]), 'theme.' + k + ' must be a #rrggbb colour');
});
check(Number.isFinite(t.fogNear) && Number.isFinite(t.fogFar) && t.fogNear < t.fogFar, 'theme.fogNear < fogFar');
check(Number.isFinite(t.lightIntensity) && t.lightIntensity > 0, 'theme.lightIntensity must be > 0');

check(Array.isArray(ch.scenery) && ch.scenery.length >= 4 && ch.scenery.length <= 7, 'scenery needs 4-7 kinds');
check(Array.isArray(ch.obstacles) && ch.obstacles.length >= 5 && ch.obstacles.length <= 7, 'obstacles needs 5-7 kinds');
check(ch.collectible && typeof ch.collectible.name === 'string' && typeof ch.collectible.build === 'function', 'collectible needs name and build');
check(Array.isArray(ch.stops) && ch.stops.length >= 3 && ch.stops.length <= 4, 'stops needs 3-4 entries');
check(ch.dialogues && typeof ch.dialogues === 'object', 'dialogues object required');
check(ch.mechanic && typeof ch.mechanic.summary === 'string' && ch.mechanic.summary.length > 80 && typeof ch.mechanic.params === 'object',
  'mechanic needs a precise summary and params');
check(typeof ch.onStart === 'function' && typeof ch.onUpdate === 'function', 'onStart and onUpdate must be functions');
check(ch.endCard && typeof ch.endCard.title === 'string' && Array.isArray(ch.endCard.lines) && ch.endCard.lines.length > 0, 'endCard needs title and lines');

// ---------------------------------------------------------------------------
// Scenery
// ---------------------------------------------------------------------------
const ids = new Set();
(ch.scenery || []).forEach((s, i) => {
  const label = 'scenery ' + (s.id || i);
  check(typeof s.id === 'string' && !ids.has(s.id), label + ': needs a unique id');
  ids.add(s.id);
  check(['left', 'right', 'both'].includes(s.side), label + ': bad side');
  check(Number.isFinite(s.every) && s.every > 0, label + ': every must be > 0');
  check(Number.isFinite(s.offset) && s.offset >= 6, label + ': offset must be >= 6');
  check(typeof s.build === 'function', label + ': build missing');
  if (typeof s.build !== 'function') return;
  const rng = mulberry32(1234 + i);
  for (let k = 0; k < 12; k++) {
    const r = checkBuild(label + ' #' + k, s.build, 40, rng);
    if (!r) break;
    const reach = Math.max(Math.abs(r.b.min.x), Math.abs(r.b.max.x));
    check(s.offset - reach >= ROAD_HALF + 0.2, label + ': reaches onto the road (inner edge at ' + r2(s.offset - reach) + 'm)');
  }
});

// ---------------------------------------------------------------------------
// Obstacles
// ---------------------------------------------------------------------------
const TYPES = ['low', 'high', 'block', 'mover'];
const seenTypes = new Set();
const obstacleReport = [];
function isLow(b) { return b.min.y >= -0.02 && b.min.y <= 0.05 && b.max.y <= 0.8 && b.size.x <= 1.8 && b.size.x >= 1.0; }
// Must not be jumpable: top above the 1.6 m jump peak.
function isBlock(b) { return b.min.y >= -0.02 && b.min.y <= 0.05 && b.max.y >= 1.5 && b.max.y > 1.6 && b.size.x <= 1.8 && b.size.x >= 1.0; }
(ch.obstacles || []).forEach((o, i) => {
  const label = 'obstacle ' + (o.id || i);
  check(typeof o.id === 'string' && !ids.has(o.id), label + ': needs a unique id');
  ids.add(o.id);
  check(TYPES.includes(o.type), label + ': bad type ' + o.type);
  seenTypes.add(o.type);
  check(Number.isFinite(o.weight) && o.weight > 0, label + ': weight must be > 0');
  check(o.size && ['w', 'h', 'd'].every((k) => Number.isFinite(o.size[k]) && o.size[k] > 0), label + ': size {w,h,d} required');
  if (typeof o.build !== 'function') { check(false, label + ': build missing'); return; }
  const r = checkBuild(label, o.build, 25);
  if (!r) return;
  const b = r.b;
  obstacleReport.push(o.id + ' (' + o.type + '): w ' + r2(b.size.x) + ' d ' + r2(b.size.z) + ' y ' + r2(b.min.y) + '..' + r2(b.max.y) + ', ' + r.meshes + ' meshes');
  check(Math.abs(b.center.x) <= 0.1, label + ': not centred on x (' + r2(b.center.x) + ')');
  check(Math.abs(b.center.z) <= 0.2, label + ': not centred on z (' + r2(b.center.z) + ')');
  check(b.size.z <= 2, label + ': deeper than 2 m');
  if (o.size) {
    check(Math.abs(o.size.w - b.size.x) <= 0.1, label + ': size.w ' + o.size.w + ' vs measured ' + r2(b.size.x));
    check(Math.abs(o.size.h - b.max.y) <= 0.1, label + ': size.h ' + o.size.h + ' vs measured top ' + r2(b.max.y));
    check(Math.abs(o.size.d - b.size.z) <= 0.15, label + ': size.d ' + o.size.d + ' vs measured ' + r2(b.size.z));
  }
  if (o.type === 'low') {
    check(isLow(b), label + ': low must sit on the ground, h <= 0.8, 1.0 <= w <= 1.8 (got h ' + r2(b.max.y) + ', w ' + r2(b.size.x) + ')');
  } else if (o.type === 'block') {
    check(isBlock(b), label + ': block must sit on the ground, h >= 1.5 and above jump peak 1.6, 1.0 <= w <= 1.8 (got h ' + r2(b.max.y) + ', w ' + r2(b.size.x) + ')');
  } else if (o.type === 'high') {
    check(b.min.y >= 1.1, label + ': high underside must be >= 1.1 (got ' + r2(b.min.y) + ')');
    check(b.size.x >= 1.6 && b.size.x <= 2.0, label + ': high must span one lane, 1.6-2.0 m wide (got ' + r2(b.size.x) + ')');
  } else if (o.type === 'mover') {
    check(isLow(b) || isBlock(b), label + ': mover must be low-sized or block-sized');
  }
});
TYPES.forEach((type) => check(seenTypes.has(type), 'needs at least one ' + type + ' obstacle'));

// ---------------------------------------------------------------------------
// Collectible
// ---------------------------------------------------------------------------
if (ch.collectible && typeof ch.collectible.build === 'function') {
  const r = checkBuild('collectible', ch.collectible.build, 25);
  if (r) {
    const big = Math.max(r.b.size.x, r.b.size.y, r.b.size.z);
    check(big >= 0.3 && big <= 0.8, 'collectible should be about 0.5 m (largest side ' + r2(big) + ')');
    check(r.b.min.y >= -0.01 && r.b.min.y <= 0.1, 'collectible origin should be on the ground');
  }
}

// ---------------------------------------------------------------------------
// Dialogue graph
// ---------------------------------------------------------------------------
const D = ch.dialogues || {};
const reachable = new Set();

// Enumerate every path through a dialogue. A choice or node `next` jumps to another dialogue id;
// otherwise the array plays in order. Returns [{ lines, chars, nodes:[...] }].
function paths(id, depth) {
  if (depth > 10) { check(false, 'dialogue cycle through ' + id); return []; }
  const lines = D[id];
  if (!check(Array.isArray(lines) && lines.length > 0, 'dialogue "' + id + '" must be a non-empty array')) return [];
  reachable.add(id);
  const out = [];
  function walk(i, acc) {
    if (i >= lines.length) { out.push(acc); return; }
    const node = lines[i];
    const here = { lines: acc.lines + 1, chars: acc.chars + String(node.text || '').length, nodes: acc.nodes.concat([node]) };
    if (Array.isArray(node.choices)) {
      node.choices.forEach((c) => {
        const withChoice = { lines: here.lines, chars: here.chars + String(c.text || '').length, nodes: here.nodes };
        if (c.next) {
          paths(c.next, depth + 1).forEach((p) => out.push({ lines: withChoice.lines + p.lines, chars: withChoice.chars + p.chars, nodes: withChoice.nodes.concat(p.nodes) }));
        } else {
          walk(i + 1, withChoice);
        }
      });
      return;
    }
    if (node.next) {
      paths(node.next, depth + 1).forEach((p) => out.push({ lines: here.lines + p.lines, chars: here.chars + p.chars, nodes: here.nodes.concat(p.nodes) }));
      return;
    }
    walk(i + 1, here);
  }
  walk(0, { lines: 0, chars: 0, nodes: [] });
  return out;
}

Object.keys(D).forEach((id) => {
  (D[id] || []).forEach((node, i) => {
    const where = 'dialogue ' + id + '[' + i + ']';
    check(typeof node.speaker === 'string' && node.speaker.length > 0, where + ': speaker required');
    check(typeof node.text === 'string' && node.text.length > 0, where + ': text required');
    check(String(node.text).length <= 140, where + ': text over 140 chars');
    if (node.next !== undefined) check(Object.prototype.hasOwnProperty.call(D, node.next), where + ': next "' + node.next + '" does not resolve');
    (node.choices || []).forEach((c, j) => {
      check(typeof c.text === 'string' && c.text.length > 0 && c.text.length <= 140, where + ' choice ' + j + ': text required, <= 140 chars');
      if (c.next !== undefined) check(Object.prototype.hasOwnProperty.call(D, c.next), where + ' choice ' + j + ': next "' + c.next + '" does not resolve');
      Object.keys(c.effects || {}).forEach((m) => {
        check(METERS.includes(m), where + ' choice ' + j + ': unknown meter ' + m);
        const v = c.effects[m];
        check(Number.isFinite(v) && v >= -15 && v <= 15, where + ' choice ' + j + ': effect ' + m + '=' + v + ' out of -15..15');
      });
    });
  });
});

// ---------------------------------------------------------------------------
// Stops and landmarks
// ---------------------------------------------------------------------------
const stops = ch.stops || [];
stops.forEach((s, i) => {
  const label = 'stop ' + i + ' (' + s.title + ')';
  check(Number.isFinite(s.at), label + ': at must be a number');
  if (i > 0) check(s.at > stops[i - 1].at, label + ': stops must be sorted ascending');
  check(typeof s.title === 'string' && s.title.length > 0, label + ': title required');
  check(Object.prototype.hasOwnProperty.call(D, s.dialogueId), label + ': dialogueId "' + s.dialogueId + '" does not resolve');

  const ps = Object.prototype.hasOwnProperty.call(D, s.dialogueId) ? paths(s.dialogueId, 0) : [];
  const speakers = new Set();
  ps.forEach((p) => {
    check(p.lines >= 2 && p.lines <= 6, label + ': a dialogue path has ' + p.lines + ' lines (want 2-6)');
    // ~15 s of reading at ~20 characters per second
    check(p.chars <= 300, label + ': a dialogue path has ' + p.chars + ' characters (want <= 300 to read in ~15 s)');
    p.nodes.forEach((n) => { if (n.speaker !== 'Jensen') speakers.add(n.speaker); });
  });

  if (!s.landmark || typeof s.landmark.build !== 'function') { check(false, label + ': landmark.build missing'); return; }
  check(Number.isFinite(s.landmark.x) && Math.abs(s.landmark.x) >= 6, label + ': landmark.x should be a side offset >= 6');
  const r = checkBuild(label + ' landmark', s.landmark.build, 25);
  if (!r) return;
  const big = Math.max(r.b.size.x, r.b.size.y, r.b.size.z);
  check(big >= 3 && big <= 8, label + ': landmark should be a 3-8 m set piece (largest side ' + r2(big) + ')');
  const inner = s.landmark.x < 0 ? -(s.landmark.x + r.b.max.x) : s.landmark.x + r.b.min.x;
  check(inner >= ROAD_HALF + 0.2, label + ': landmark reaches onto the road (inner edge ' + r2(inner) + ' m from centre)');
  check(r.persons >= speakers.size, label + ': landmark has ' + r.persons + ' people for ' + speakers.size + ' non-hero speakers');
});
if (stops.length) {
  check(stops[0].at >= 150, 'first stop must be at >= 150 m');
  check(stops[stops.length - 1].at === ch.length, 'last stop must be at == length');

  // Exactly one 2-option choice in the last stop's dialogue (including branches), not dominated.
  const last = stops[stops.length - 1];
  const choiceNodes = new Set();
  (Object.prototype.hasOwnProperty.call(D, last.dialogueId) ? paths(last.dialogueId, 0) : []).forEach((p) => {
    p.nodes.forEach((n) => { if (Array.isArray(n.choices)) choiceNodes.add(n); });
  });
  check(choiceNodes.size === 1, 'last stop dialogue must contain exactly one choice node (found ' + choiceNodes.size + ')');
  choiceNodes.forEach((n) => {
    check(n.choices.length === 2, 'the last stop choice must have exactly 2 options');
    if (n.choices.length !== 2) return;
    const [a, b] = n.choices.map((c) => METERS.map((m) => (c.effects && c.effects[m]) || 0));
    const dominates = (x, y) => x.every((v, k) => v >= y[k]) && x.some((v, k) => v > y[k]);
    check(a.some((v) => v !== 0) && b.some((v) => v !== 0), 'both final options need meter effects');
    check(!dominates(a, b) && !dominates(b, a) && a.join() !== b.join(), 'one final option is better (or equal) on every meter');
  });
}
Object.keys(D).forEach((id) => check(reachable.has(id), 'dialogue "' + id + '" is never reached from a stop'));

// ---------------------------------------------------------------------------
// Mechanic smoke test against a fake game
// ---------------------------------------------------------------------------
function fakeGame(withHeroObject) {
  const game = {
    hero: { lane: 0, y: 0, hearts: 3 },
    distance: 0, speed: 12, time: 0,
    meters: { stock: 50, board: 50, washington: 50, beijing: 50 },
    state: {},
    said: [],
    say(text) { this.said.push(text); },
    hurt() { this.hero.hearts--; },
    heal() { this.hero.hearts++; },
    addCollect() {}, spawn() {}, fail() {}
  };
  if (withHeroObject) game.hero.group = new THREE.Group();
  return game;
}
function step(game, metres) {
  game.distance += metres;
  game.time += metres / game.speed;
  ch.onUpdate(game, metres / game.speed);
}
const P = ch.mechanic && ch.mechanic.params ? ch.mechanic.params : {};
const deliverAt = P.deliverAt;
const endLinesTable = P.endLines || {};
check(stops.length && deliverAt === stops[0].at, 'mechanic.params.deliverAt should equal the lab stop distance');
check(Object.keys(endLinesTable).sort().join() === ['0', '100', '25', '50', '75'].sort().join(),
  'mechanic.params.endLines needs exactly the 0, 25, 50, 75 and 100% lines');
check(new Set(Object.values(endLinesTable)).size === 5, 'mechanic.params.endLines must be five different jokes');
check(ch.mechanic && ch.mechanic.summary.indexOf('(' + deliverAt + ' m)') !== -1, 'mechanic.summary must name the delivery distance');
function endLineIs(pct, label) {
  check(ch.endCard.lines[0] === endLinesTable[pct], label + ': end card should open with the ' + pct + '% line, got "' + ch.endCard.lines[0] + '"');
}
try {
  // Run 1: five hits before the lab clamp at 0%.
  const g1 = fakeGame(true);
  ch.onStart(g1);
  check(g1.state.delivery && g1.state.delivery.condition === 100, 'condition starts at 100');
  check(g1.state.hud === 'DELIVERY: 100%', 'HUD shows "DELIVERY: 100%" at start (got "' + g1.state.hud + '")');
  endLineIs(100, 'run 1 start');
  check(g1.hero.group.children.length === 1, 'supercomputer box attached to the hero object');
  for (let k = 0; k < 5; k++) { step(g1, 20); g1.hurt(); step(g1, 1); }
  check(g1.distance < deliverAt - 1, 'run 1 hits must land before the lab');
  check(g1.state.delivery.condition === 0, 'five hits clamp condition at 0 (got ' + g1.state.delivery.condition + ')');
  check(g1.state.hud === 'DELIVERY: 0%', 'HUD shows "DELIVERY: 0%" (got "' + g1.state.hud + '")');
  step(g1, deliverAt);
  check(g1.state.delivery.delivered === true, 'box delivered at the lab stop');
  check(g1.hero.group.children.length === 0, 'box removed from the hero after delivery');
  endLineIs(0, 'run 1');

  // Run 2: one hit, heal, then deliver; later hits change nothing.
  const g2 = fakeGame(false);
  ch.onStart(g2);
  check(g2.state.delivery.condition === 100, 'onStart resets condition');
  endLineIs(100, 'run 2 start (onStart resets end card)');
  step(g2, 50); g2.hurt(); step(g2, 1);
  check(g2.state.delivery.condition === 75, 'one hit -> 75% (got ' + g2.state.delivery.condition + ')');
  check(g2.state.hud === 'DELIVERY: 75%', 'HUD shows "DELIVERY: 75%" (got "' + g2.state.hud + '")');
  g2.heal(); step(g2, 1);
  check(g2.state.delivery.condition === 75, 'healing does not count as a hit');
  step(g2, deliverAt);
  check(g2.state.delivery.delivered === true, 'delivered on reaching the lab');
  g2.hurt(); step(g2, 5);
  check(g2.state.delivery.condition === 75, 'hits after delivery do not change condition');
  check(g2.state.hud === 'DELIVERED: 75%', 'HUD shows locked "DELIVERED: 75%" after delivery (got "' + g2.state.hud + '")');
  endLineIs(75, 'run 2');

  // Run 3: two hits -> 50%.
  const g4 = fakeGame(false);
  ch.onStart(g4);
  step(g4, 10); g4.hurt(); step(g4, 1); step(g4, 10); g4.hurt(); step(g4, 1);
  step(g4, deliverAt);
  check(g4.state.delivery.condition === 50 && g4.state.hud === 'DELIVERED: 50%', 'two hits -> "DELIVERED: 50%" (got "' + g4.state.hud + '")');
  endLineIs(50, 'run 3');

  g1.said.concat(g2.said, g4.said).forEach((line) => check(typeof line === 'string' && line.length <= 140, 'game.say line too long: ' + line));

  // Run 4: engine without hearts, hero object or onStart.
  const g3 = { hero: {}, distance: 0, state: {} };
  ch.onUpdate(g3, 0.016);
  g3.distance = deliverAt + 10;
  ch.onUpdate(g3, 0.016);
  check(g3.state.delivery.delivered === true && g3.state.delivery.condition === 100, 'works without hearts, say() or onStart');
} catch (e) {
  check(false, 'mechanic hooks threw: ' + e.stack);
}
ch.endCard.lines.forEach((line) => check(typeof line === 'string' && line.length <= 140, 'end card line too long: ' + line));
['hitLines', 'deliveryLines', 'endLines'].forEach((k) => {
  Object.keys(P[k] || {}).forEach((c) => check(P[k][c].length <= 140, 'mechanic.params.' + k + '[' + c + '] too long'));
});

// ---------------------------------------------------------------------------
// Per-run scenery sequences. Assumes the engine builds scenery once per run,
// in distance order, after onStart.
// ---------------------------------------------------------------------------
function findKind(id) { return (ch.scenery || []).find((s) => s.id === id); }

// Every mesh's text and world transform, so two builds can be compared exactly.
function signature(g) {
  const parts = [];
  g.updateMatrixWorld(true);
  g.traverse((o) => {
    if (!o.isMesh) return;
    const e = o.matrixWorld.elements.map((v) => Math.round(v * 1000) / 1000);
    parts.push((o.userData.text || '') + ':' + e.join(','));
  });
  return parts.join('|');
}
function buildRun() {
  ch.onStart(fakeGame(false));
  const out = [];
  (ch.scenery || []).forEach((s, i) => {
    const rng = mulberry32(99 + i);
    for (let k = 0; k < 15; k++) out.push(s.id + ' #' + k + '=' + signature(s.build(rng)));
  });
  (ch.obstacles || []).forEach((o) => {
    for (let k = 0; k < 6; k++) out.push(o.id + ' #' + k + '=' + signature(o.build()));
  });
  return out;
}
try {
  const run1 = buildRun();
  // Advance any factory state between runs, as a previous attempt would.
  (ch.scenery || []).forEach((s) => { const rng = mulberry32(5); for (let k = 0; k < 7; k++) s.build(rng); });
  (ch.obstacles || []).forEach((o) => { o.build(); });
  const run2 = buildRun();
  const diff = run1.findIndex((s, i) => s !== run2[i]);
  check(run1.length === run2.length && diff === -1,
    'builds after onStart must repeat exactly on every run (first difference: ' + (diff >= 0 ? run1[diff].split('=')[0] : '-') + ')');
} catch (e) {
  check(false, 'restart test threw: ' + e.stack);
}

// Year markers: start at 2016, count up one year at a time, cover 2016..2025 within the run,
// and each stop lands in a year that fits its story.
function yearOf(g) {
  let y = null;
  g.traverse((o) => { if (typeof o.userData.text === 'string' && /^20\d\d$/.test(o.userData.text)) y = Number(o.userData.text); });
  return y;
}
const yearKind = findKind('year_marker');
if (check(yearKind && yearKind.every > 0, 'year_marker scenery missing')) {
  try {
    ch.onStart(fakeGame(false));
    const rng = mulberry32(7);
    const years = [];
    const builds = Math.floor(ch.length / yearKind.every) + 3;
    for (let k = 0; k < builds; k++) years.push(yearOf(yearKind.build(rng)));
    check(years.every((y) => Number.isInteger(y) && y >= 2016 && y <= 2025), 'every year marker shows a year 2016-2025 (got ' + years.join(',') + ')');
    check(years[0] === 2016, 'first year marker after onStart must be 2016 (got ' + years[0] + ')');
    check(years.every((y, k) => k === 0 || (y - years[k - 1] >= 0 && y - years[k - 1] <= 1)),
      'year markers must count up at most one year per copy (got ' + years.join(',') + ')');
    const expo = stops.find((s) => s.dialogueId === 'expo');
    check(expo, 'expo stop missing');
    // Two plausible engine placements: copy k at k*every, or at (k+1)*every.
    [0, 1].forEach((shift) => {
      const where = ' (first marker at ' + shift * yearKind.every + ' m)';
      const inRun = years.filter((y, k) => (k + shift) * yearKind.every <= ch.length);
      for (let y = 2016; y <= 2025; y++) check(inRun.includes(y), 'year ' + y + ' has no marker within the run' + where);
      const yearAt = (d) => {
        const k = Math.floor(d / yearKind.every) - shift;
        return k < 0 ? null : years[Math.min(k, years.length - 1)];
      };
      check(stops[0] && stops[0].dialogueId === 'lab' && yearAt(stops[0].at) === 2016,
        'the 2016 lab delivery must land in 2016, got ' + (stops[0] && yearAt(stops[0].at)) + where);
      if (expo) {
        const y = yearAt(expo.at);
        check(y === 2020 || y === 2021, 'the expo asks about the GPU shortage, so it must land in 2020-2021, got ' + y + where);
      }
      check(yearAt(ch.length) === 2025, 'the final stop must land in 2025, got ' + yearAt(ch.length) + where);
    });
    ch.onStart(fakeGame(false));
    check(yearOf(yearKind.build(rng)) === 2016, 'a second onStart must restart the year markers at 2016');
  } catch (e) {
    check(false, 'year marker test threw: ' + e.stack);
  }
}

// Chart line: copies join end to end and mostly climb, like one rising price line.
const chartKind = findKind('chart_edge');
if (check(chartKind && chartKind.every > 0, 'chart_edge scenery missing')) {
  try {
    check(chartKind.side !== 'both', 'chart_edge is one continuous line, so it must be on one side only');
    const ends = (g) => {
      g.updateMatrixWorld(true);
      const line = g.getObjectByName('chart_line');
      if (!line || !line.isMesh) return null;
      return {
        near: new THREE.Vector3(0, 0, 0.5).applyMatrix4(line.matrixWorld),
        far: new THREE.Vector3(0, 0, -0.5).applyMatrix4(line.matrixWorld)
      };
    };
    ch.onStart(fakeGame(false));
    const rng = mulberry32(42);
    const n = Math.floor(ch.length / chartKind.every) + 1;
    const half = chartKind.every / 2;
    let prev = null;
    let rises = 0;
    let top = -Infinity;
    let low = Infinity;
    let start = null;
    for (let k = 0; k < n; k++) {
      const e = ends(chartKind.build(rng));
      if (!check(e, 'chart_edge needs a mesh named chart_line')) break;
      if (start === null) start = e.near.y;
      check(Math.abs(e.near.z - half) < 1e-6 && Math.abs(e.far.z + half) < 1e-6,
        'chart segment ' + k + ' must span exactly `every` (z ' + r2(e.near.z) + '..' + r2(e.far.z) + ')');
      if (prev) check(Math.abs(e.near.y - prev.y) < 1e-6, 'chart segment ' + k + ' starts at ' + r2(e.near.y) + ' m but the previous one ended at ' + r2(prev.y) + ' m');
      if (e.far.y > e.near.y) rises++;
      top = Math.max(top, e.near.y, e.far.y);
      low = Math.min(low, e.near.y, e.far.y);
      prev = e.far;
    }
    check(rises >= 0.7 * n, 'chart line should rise on at least 70% of segments (' + rises + '/' + n + ')');
    check(low >= 0.3 && top <= 5, 'chart line should stay between 0.3 and 5 m (got ' + r2(low) + '..' + r2(top) + ')');
    check(top >= 3, 'chart line should climb to at least 3 m during the run (max ' + r2(top) + ')');
    ch.onStart(fakeGame(false));
    const again = ends(chartKind.build(rng));
    check(again && Math.abs(again.near.y - start) < 1e-9, 'a second onStart must restart the chart line at its start height');
  } catch (e) {
    check(false, 'chart line test threw: ' + e.stack);
  }
}

check(warnings.length === 0, 'three.js printed warnings:\n  ' + warnings.slice(0, 5).join('\n  '));

finish();

function finish() {
  console.warn = realWarn;
  console.error = realError;
  if (obstacleReport.length) console.log('Obstacles:\n  ' + obstacleReport.join('\n  '));
  if (failures.length) {
    console.log('\nFAIL: ' + failures.length + ' problem(s), ' + passed + ' checks passed');
    failures.forEach((f) => console.log('  - ' + f));
    process.exit(1);
  }
  console.log('\nPASS: ' + passed + ' checks');
  process.exit(0);
}
