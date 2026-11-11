/* Structural checks for chapter.js. Run: node check.js */
'use strict';
const THREE = require('./three.min.js');

// ---------------------------------------------------------------- stub kit
const signTexts = []; // every string the chapter draws, for the tone checks
const kit = {
  textPlane(text, opts) {
    const o = opts || {};
    const m = new THREE.Mesh(new THREE.PlaneGeometry(o.w || 1, o.h || 0.5), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    m.userData.text = String(text);
    signTexts.push(String(text));
    return m;
  },
  // 1.8 m person of boxes: legs, torso, arms, head, hair, optional accessory.
  person(opts) {
    const o = opts || {};
    const g = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color: 0x888888 });
    const add = (w, h, d, x, y, z) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      b.position.set(x, y + h / 2, z);
      g.add(b);
    };
    add(0.18, 0.85, 0.2, -0.11, 0, 0);
    add(0.18, 0.85, 0.2, 0.11, 0, 0);
    add(0.46, 0.65, 0.26, 0, 0.85, 0);
    add(0.12, 0.6, 0.14, -0.3, 0.9, 0);
    add(0.12, 0.6, 0.14, 0.3, 0.9, 0);
    add(0.26, 0.28, 0.26, 0, 1.5, 0);
    add(0.28, 0.06, 0.28, 0, 1.74, 0);
    if (o.accessory) add(0.2, 0.06, 0.06, 0, 1.6, 0.14);
    return g;
  },
};

// ---------------------------------------------------------------- helpers
const failures = [];
let passes = 0;
function ok(cond, msg) {
  if (cond) passes++;
  else failures.push(msg);
}
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
function meshCount(obj) {
  let n = 0;
  obj.traverse((o) => { if (o.isMesh) n++; });
  return n;
}
function measure(obj) {
  const b = new THREE.Box3().setFromObject(obj);
  return { box: b, w: b.max.x - b.min.x, h: b.max.y, d: b.max.z - b.min.z, cx: (b.min.x + b.max.x) / 2, cz: (b.min.z + b.max.z) / 2 };
}
const HEX = /^#[0-9a-fA-F]{6}$/;
const METERS = ['stock', 'board', 'washington', 'beijing'];
const isStr = (s) => typeof s === 'string' && s.trim().length > 0;
const isNum = (n) => typeof n === 'number' && isFinite(n);
const words = (s) => (typeof s === 'string' ? s.trim().split(/\s+/).filter(Boolean).length : 0);
const MAX_STOP_WORDS = 55; // about 14 s at 240 words/min, leaving time for speaker changes
// Well-known real lines that were not supplied in the brief and must not be reused.
const UNSUPPLIED_QUOTES = ['please clap'];

// Checks a build() function: Group, fresh each call, mesh limits, nothing below ground.
function checkBuild(label, build, maxMeshes, arg) {
  let a, b;
  try {
    a = build(arg);
    b = build(arg);
  } catch (e) {
    ok(false, label + ': build() threw ' + e.message);
    return null;
  }
  ok(a instanceof THREE.Group, label + ': build() must return a THREE.Group');
  if (!(a instanceof THREE.Group)) return null;
  ok(a !== b && (a.children.length === 0 || a.children[0] !== b.children[0]), label + ': build() must return a new Group each call');
  const n = meshCount(a);
  ok(n >= 1 && n <= maxMeshes, label + ': has ' + n + ' meshes (allowed 1-' + maxMeshes + ')');
  const m = measure(a);
  ok(m.box.min.y >= -0.05, label + ': geometry goes below ground (min.y ' + m.box.min.y.toFixed(3) + ')');
  return m;
}

// ---------------------------------------------------------------- load
const factory = require('./chapter.js');
ok(typeof factory === 'function', 'chapter.js must export a factory function');
const ch = factory(THREE, kit);

// ---------------------------------------------------------------- required fields
ok(ch.id === 'ch8', 'id must be ch8');
ok(ch.title === 'Earnings Call', 'title must be "Earnings Call"');
ok(ch.dateline === 'Earnings Day', 'dateline must be "Earnings Day"');
ok(ch.outfit === 'jacket', 'outfit must be jacket');
ok(ch.hideMeters === false, 'hideMeters must be false');
ok(isNum(ch.length) && ch.length >= 700 && ch.length <= 900, 'length must be 700-900');
ok(ch.speed && ch.speed.base === 16 && ch.speed.max === 20, 'speed must be {base:16, max:20}');
ok(ch.speed && ch.speed.base >= 11 && ch.speed.max <= 20 && ch.speed.base <= ch.speed.max, 'speed must be within 11-20 m/s');
ok(ch.frontPage && isStr(ch.frontPage.headline) && isStr(ch.frontPage.sub), 'frontPage needs headline and sub');
const th = ch.theme || {};
for (const k of ['sky', 'fog', 'ground', 'road', 'laneLine', 'lightColor', 'ambient']) ok(HEX.test(th[k]), 'theme.' + k + ' must be #rrggbb');
for (const k of ['fogNear', 'fogFar', 'lightIntensity']) ok(isNum(th[k]), 'theme.' + k + ' must be a number');
ok(th.fogNear < th.fogFar, 'theme.fogNear must be < fogFar');
ok(typeof ch.onStart === 'function' && typeof ch.onUpdate === 'function', 'onStart/onUpdate must be functions');
ok(typeof ch.onCollect === 'function', 'onCollect must be a function (named in mechanic.params.collectHook)');
ok(ch.endCard && isStr(ch.endCard.title) && Array.isArray(ch.endCard.lines), 'endCard needs title and lines');
ok(ch.mechanic && isStr(ch.mechanic.summary) && ch.mechanic.params && typeof ch.mechanic.params === 'object', 'mechanic needs summary and params');
ok(ch.collectible && isStr(ch.collectible.name) && typeof ch.collectible.build === 'function', 'collectible needs name and build');
ok(ch.boss && typeof ch.boss.build === 'function', 'boss.build must be a function');
ok(ch.dialogues && typeof ch.dialogues === 'object', 'dialogues must be an object');

// ---------------------------------------------------------------- scenery
ok(Array.isArray(ch.scenery) && ch.scenery.length >= 4 && ch.scenery.length <= 7, 'scenery must have 4-7 kinds');
const sceneryIds = new Set();
for (const s of ch.scenery || []) {
  const label = 'scenery ' + s.id;
  ok(isStr(s.id) && !sceneryIds.has(s.id), label + ': id must be unique');
  sceneryIds.add(s.id);
  ok(['left', 'right', 'both'].includes(s.side), label + ': bad side');
  ok(isNum(s.every) && s.every > 0, label + ': every must be > 0');
  ok(isNum(s.offset) && s.offset >= 6, label + ': offset must be >= 6');
  for (let seed = 1; seed <= 25; seed++) {
    const m = checkBuild(label + ' (seed ' + seed + ')', s.build, 40, mulberry32(seed));
    if (m) {
      const reach = Math.max(Math.abs(m.box.min.x), Math.abs(m.box.max.x));
      ok(s.offset - reach >= 3.2, label + ': intrudes on the road (reaches ' + (s.offset - reach).toFixed(2) + ' m from centre)');
    }
  }
}

// ---------------------------------------------------------------- obstacles
ok(Array.isArray(ch.obstacles) && ch.obstacles.length >= 5 && ch.obstacles.length <= 7, 'obstacles must have 5-7 kinds');
const obstacleIds = new Set();
const types = new Set();
const report = [];
for (const o of ch.obstacles || []) {
  const label = 'obstacle ' + o.id;
  ok(isStr(o.id) && !obstacleIds.has(o.id), label + ': id must be unique');
  obstacleIds.add(o.id);
  ok(['low', 'high', 'block', 'mover'].includes(o.type), label + ': bad type');
  types.add(o.type);
  ok(isNum(o.weight) && o.weight > 0, label + ': weight must be > 0');
  ok(o.size && isNum(o.size.w) && isNum(o.size.h) && isNum(o.size.d), label + ': size {w,h,d} required');
  const m = checkBuild(label, o.build, 25);
  if (!m) continue;
  report.push(label + ': w ' + m.w.toFixed(2) + ' h ' + m.h.toFixed(2) + ' d ' + m.d.toFixed(2) + ' underside ' + m.box.min.y.toFixed(2));
  ok(Math.abs(m.cx) <= 0.1 && Math.abs(m.cz) <= 0.25, label + ': origin must be at the object centre');
  if (o.size) {
    ok(Math.abs(o.size.w - m.w) <= 0.1 && Math.abs(o.size.h - m.h) <= 0.1 && Math.abs(o.size.d - m.d) <= 0.1,
      label + ': declared size ' + JSON.stringify(o.size) + ' differs from measured w ' + m.w.toFixed(2) + ' h ' + m.h.toFixed(2) + ' d ' + m.d.toFixed(2));
  }
  const lowSized = m.h <= 0.8 && m.w <= 1.8;
  const blockSized = m.h >= 1.5 && m.w <= 1.8 && m.w >= 1.2 && m.box.min.y <= 0.05;
  if (o.type === 'low') ok(lowSized, label + ': low needs h <= 0.8 and w <= 1.8');
  if (o.type === 'block') ok(blockSized, label + ': block needs h >= 1.5, 1.2 <= w <= 1.8, standing on the ground');
  if (o.type === 'high') {
    ok(m.box.min.y >= 1.1, label + ': high underside must be >= 1.1 (is ' + m.box.min.y.toFixed(2) + ')');
    ok(m.w >= 1.5 && m.w <= 2.0, label + ': high must span one lane (w 1.5-2.0)');
  }
  if (o.type === 'mover') ok(lowSized || blockSized, label + ': mover must be low- or block-sized');
}
for (const t of ['low', 'high', 'block', 'mover']) ok(types.has(t), 'need at least one ' + t + ' obstacle');

// ---------------------------------------------------------------- collectible & boss
const cm = checkBuild('collectible', ch.collectible.build, 25);
if (cm) {
  const size = Math.max(cm.w, cm.d, cm.box.max.y - cm.box.min.y);
  ok(size >= 0.35 && size <= 0.75, 'collectible should be about 0.5 m (is ' + size.toFixed(2) + ')');
  ok(Math.abs(cm.cx) <= 0.05 && Math.abs(cm.cz) <= 0.05, 'collectible origin must be at its centre');
}
const bm = checkBuild('boss', ch.boss.build, 60);
if (bm) {
  ok(bm.w >= 7 && bm.w <= 9, 'boss should be about 8 m wide (is ' + bm.w.toFixed(2) + ')');
  ok(Math.abs(bm.cx) <= 0.3, 'boss origin must be at its centre');
  const boss = ch.boss.build();
  if (boss.userData && typeof boss.userData.tick === 'function') {
    try { boss.userData.hit(1); boss.userData.tick(1.2); boss.userData.tick(5); } catch (e) { ok(false, 'boss tick/hit threw ' + e.message); }
  }
}

// ---------------------------------------------------------------- stops
const stops = ch.stops || [];
ok(stops.length >= 3 && stops.length <= 4, 'need 3-4 stops');
for (let i = 1; i < stops.length; i++) ok(stops[i].at > stops[i - 1].at, 'stops must be sorted');
ok(stops.length && stops[0].at >= 150, 'first stop must be >= 150');
ok(stops.length && stops[stops.length - 1].at === ch.length, 'last stop must equal length');
for (const s of stops) {
  const label = 'stop ' + s.title;
  ok(isStr(s.title), 'stop needs a title');
  ok(s.landmark && isNum(s.landmark.x) && typeof s.landmark.build === 'function', label + ': landmark {x, build} required');
  ok(ch.dialogues && Array.isArray(ch.dialogues[s.dialogueId]), label + ': dialogueId ' + s.dialogueId + ' does not resolve');
  const m = checkBuild(label + ' landmark', s.landmark.build, 25);
  if (m) {
    ok(m.w >= 3 && m.w <= 8.5 && m.h >= 3 && m.h <= 8.5, label + ': landmark should be a 3-8 m set piece (w ' + m.w.toFixed(2) + ' h ' + m.h.toFixed(2) + ')');
    const near = Math.min(Math.abs(s.landmark.x + m.box.min.x), Math.abs(s.landmark.x + m.box.max.x));
    ok(Math.sign(s.landmark.x + m.box.min.x) === Math.sign(s.landmark.x + m.box.max.x) && near >= 3.2, label + ': landmark intrudes on the road');
  }
}

// ---------------------------------------------------------------- dialogues
const D = ch.dialogues || {};
for (const id of Object.keys(D)) {
  const nodes = D[id];
  ok(Array.isArray(nodes) && nodes.length > 0, 'dialogue ' + id + ' must be a non-empty array');
  for (const n of nodes || []) {
    ok(isStr(n.speaker) && isStr(n.text), 'dialogue ' + id + ': every node needs speaker and text');
    ok(typeof n.text !== 'string' || n.text.length <= 140, 'dialogue ' + id + ': text over 140 chars: ' + n.text);
    if (n.next !== undefined) ok(Array.isArray(D[n.next]), 'dialogue ' + id + ': next "' + n.next + '" does not resolve');
    for (const c of n.choices || []) {
      ok(isStr(c.text) && c.text.length <= 140, 'dialogue ' + id + ': choice text missing or over 140 chars');
      if (c.next !== undefined) ok(Array.isArray(D[c.next]), 'dialogue ' + id + ': choice next "' + c.next + '" does not resolve');
    }
  }
}
// Every path through a dialogue: nodes play in order; `next` on a node or the chosen choice jumps
// to another dialogue. Returns [{lines, words}] per path; a broken or looping path is Infinity.
function walk(id, seen) {
  if (!Array.isArray(D[id]) || seen.has(id)) return [{ lines: Infinity, words: Infinity }];
  const s = new Set(seen).add(id);
  const nodes = D[id];
  function from(k) {
    if (k >= nodes.length) return [{ lines: 0, words: 0 }];
    const n = nodes[k];
    const here = { lines: 1, words: words(n.text) + (n.choices || []).reduce((a, c) => a + words(c.text), 0) };
    const tails = n.choices && n.choices.length
      ? n.choices.map((c) => (c.next !== undefined ? walk(c.next, s) : from(k + 1)))
      : [n.next !== undefined ? walk(n.next, s) : from(k + 1)];
    return [].concat(...tails).map((t) => ({ lines: here.lines + t.lines, words: here.words + t.words }));
  }
  return from(0);
}
function reachableNodes(id, seen) {
  if (!Array.isArray(D[id]) || seen.has(id)) return [];
  seen.add(id);
  let out = D[id].slice();
  for (const n of D[id]) {
    if (n.next !== undefined) out = out.concat(reachableNodes(n.next, seen));
    for (const c of n.choices || []) if (c.next !== undefined) out = out.concat(reachableNodes(c.next, seen));
  }
  return out;
}
for (const s of stops) {
  const paths = walk(s.dialogueId, new Set());
  ok(paths.every((p) => p.lines >= 2 && p.lines <= 6), 'stop ' + s.title + ': every dialogue path must be 2-6 lines (got ' + paths.map((p) => p.lines).join(',') + ')');
  ok(paths.every((p) => p.words <= MAX_STOP_WORDS), 'stop ' + s.title + ': a dialogue path has over ' + MAX_STOP_WORDS + ' words (got ' + paths.map((p) => p.words).join(',') + '), too long to read in 15 s');
  report.push('stop ' + s.title + ': ' + paths.map((p) => p.lines + ' lines / ' + p.words + ' words').join(', '));
}
let finalChoices = null;
if (stops.length) {
  const last = stops[stops.length - 1];
  const choiceNodes = reachableNodes(last.dialogueId, new Set()).filter((n) => n.choices && n.choices.length);
  ok(choiceNodes.length === 1, 'last stop dialogue must contain exactly one choice node (has ' + choiceNodes.length + ')');
  if (choiceNodes.length === 1) {
    const cs = choiceNodes[0].choices;
    finalChoices = cs;
    ok(cs.length === 2, 'final choice must have exactly 2 options');
    const vec = (c) => METERS.map((k) => (c.effects && isNum(c.effects[k]) ? c.effects[k] : 0));
    for (const c of cs) {
      ok(c.effects && typeof c.effects === 'object' && Object.keys(c.effects).length > 0, 'final choice "' + c.text + '" needs meter effects');
      for (const k of Object.keys(c.effects || {})) {
        ok(METERS.includes(k), 'final choice: unknown meter ' + k);
        ok(isNum(c.effects[k]) && c.effects[k] >= -15 && c.effects[k] <= 15, 'final choice: effect ' + k + ' out of -15..15');
      }
    }
    if (cs.length === 2) {
      const a = vec(cs[0]);
      const b = vec(cs[1]);
      const dominates = (x, y) => x.every((v, i) => v >= y[i]) && x.some((v, i) => v > y[i]);
      ok(!dominates(a, b) && !dominates(b, a), 'final choice: one option is better on every meter');
    }
  }
  // Choices only belong at the final stop.
  for (const s of stops.slice(0, -1)) {
    ok(reachableNodes(s.dialogueId, new Set()).every((n) => !n.choices), 'stop ' + s.title + ': only the last stop may have choices');
  }
}

// ---------------------------------------------------------------- endings
const E = ch.endings || [];
const wantIds = ['record-quarter', 'soft-landing', 'under-review', 'gardening-leave'];
ok(Array.isArray(E) && E.length === 4, 'need exactly 4 endings');
ok(E.map((e) => e.id).join() === wantIds.join(), 'endings must be ordered ' + wantIds.join(', '));
for (const e of E) {
  ok(typeof e.when === 'function', 'ending ' + e.id + ': when must be a function');
  ok(e.frontPage && isStr(e.frontPage.headline) && isStr(e.frontPage.sub), 'ending ' + e.id + ': frontPage needs headline and sub');
  ok(Array.isArray(e.lines) && e.lines.length > 0 && e.lines.every((l) => isStr(l) && l.length <= 140), 'ending ' + e.id + ': lines must be short strings');
  ok(!e.frontPage || (e.frontPage.headline.length <= 140 && e.frontPage.sub.length <= 140), 'ending ' + e.id + ': frontPage text over 140 chars');
}
const firstEnding = (m) => E.findIndex((e) => e.when(m));
if (E.length === 4) {
  const r = mulberry32(2024);
  const hits = E.map(() => 0);
  let badFirst = 0;
  let badLast = 0;
  let nonBool = 0;
  for (let i = 0; i < 1000; i++) {
    const m = {};
    for (const k of METERS) m[k] = Math.floor(r() * 101);
    const results = E.map((e) => e.when(m));
    if (!results.every((x) => typeof x === 'boolean')) nonBool++;
    const first = results.indexOf(true);
    if (first < 0) badFirst++;
    else hits[first]++;
    if (results[3] !== true) badLast++;
  }
  ok(nonBool === 0, 'endings: when() must return a boolean');
  ok(badFirst === 0, 'endings: ' + badFirst + ' of 1000 meter sets have no matching ending');
  ok(badLast === 0, 'endings: the last ending must always match');
  E.forEach((e, i) => ok(hits[i] > 0, 'endings: ' + e.id + ' was never the first match in 1000 random sets'));
  report.push('endings first-match counts: ' + E.map((e, i) => e.id + ' ' + hits[i]).join(', '));
  ok(firstEnding({ stock: 100, board: 100, washington: 100, beijing: 100 }) === 0, 'endings: all-100 meters should give the best ending');
  ok(firstEnding({ stock: 0, board: 0, washington: 0, beijing: 0 }) === 3, 'endings: all-0 meters should give the worst ending');
}

// ---------------------------------------------------------------- mechanic params
const P = ch.mechanic.params;
ok(Array.isArray(P.phases) && P.phases.length === 3, 'mechanic.params.phases must list 3 phases');
if (Array.isArray(P.phases) && P.phases.length === 3) {
  const used = new Set();
  P.phases.forEach((p, i) => {
    ok(Array.isArray(p.mix) && p.mix.every((id) => obstacleIds.has(id)), 'phase ' + (i + 1) + ': mix must list obstacle ids');
    p.mix.forEach((id) => used.add(id));
    ok(p.from === (i ? stops[i - 1].at : 0) && p.to === stops[i].at, 'phase ' + (i + 1) + ': must run between stops');
    ok(p.speed >= ch.speed.base && p.speed <= ch.speed.max, 'phase ' + (i + 1) + ': speed outside chapter range');
    if (i > 0) {
      const prev = P.phases[i - 1];
      const added = p.mix.filter((id) => !prev.mix.includes(id));
      ok(prev.mix.every((id) => p.mix.includes(id)) && added.length === 1 && added[0] === p.adds, 'phase ' + (i + 1) + ': must add exactly one attack type');
      ok(p.speed > prev.speed, 'phase ' + (i + 1) + ': must be faster than phase ' + i);
    }
  });
  ok(used.size === obstacleIds.size, 'every obstacle should appear in some phase mix');
}
ok(P.candlesToWin === 8, 'candlesToWin must be 8');
ok(P.collectHook === 'onCollect' && /onCollect/.test(ch.mechanic.summary), 'mechanic must tell the engine to call onCollect');
ok(P.collectFallback && isNum(P.collectFallback.maxHeroY) && /game\.hero\.lane/.test(ch.mechanic.summary), 'mechanic must document the lane-based collect fallback');

// ---------------------------------------------------------------- hook simulation
// A mock engine runs the chapter. The hero picks up a candle when the run passes it while hero.lane
// equals the candle's lane and hero.y < 1. How the engine reports pickups to the chapter:
//   counter     - increments game.collected        counterIdle - has game.collected but never changes it
//   hook        - calls ch.onCollect before onUpdate
//   hookLate    - calls ch.onCollect after onUpdate (the fallback sees the candle first)
//   none        - documented API only: no counter, no hook
// Hero policy: follow (stand in each candle's lane), avoid (never), jump (follow but stay airborne).
const MODES = {
  counter: { report: 'counter', policy: 'follow', wins: true },
  hook: { report: 'hook', policy: 'follow', wins: true },
  hookLate: { report: 'hookLate', policy: 'follow', wins: true },
  lane: { report: 'none', policy: 'follow', wins: true },
  counterIdle: { report: 'counterIdle', policy: 'follow', wins: false },
  jump: { report: 'none', policy: 'jump', wins: false },
  dodge: { report: 'none', policy: 'avoid', wins: false },
};
const phaseOf = (pos) => P.phases.findIndex((p) => pos >= p.from && pos < p.to);
function simulate(name) {
  const cfg = MODES[name];
  const spawns = [];
  const says = [];
  const game = {
    hero: { lane: 0, y: 0, hearts: 3 }, distance: 0, speed: ch.speed.base, time: 0,
    meters: { stock: 50, board: 50, washington: 50, beijing: 50 }, state: {},
    say: (t) => says.push(t), hurt() {}, fail() {}, addCollect() {},
    spawn: (o) => spawns.push(Object.assign({ d: game.distance }, o)),
  };
  if (cfg.report === 'counter' || cfg.report === 'counterIdle') game.collected = 0;
  ch.onStart(game);
  const taken = P.phases.map(() => 0);
  const takenAtWin = P.phases.map(() => null);
  const noteWins = () => game.state.ch8.beaten.forEach((b, i) => { if (b && takenAtWin[i] === null) takenAtWin[i] = taken[i]; });
  const dt = 1 / 60;
  let si = 0;
  let pausedSpeedRose = false;
  let maxSpeed = 0;
  const speedAt = [];
  while (game.distance < ch.length) {
    game.time += dt;
    const target = spawns.find((s) => s.kind === 'collectible' && -s.z > game.distance);
    if (target) game.hero.lane = cfg.policy === 'avoid' ? (target.lane === -1 ? 1 : -1) : target.lane;
    game.hero.y = cfg.policy === 'jump' ? 1.5 : 0;
    const next = stops[si] ? stops[si].at : ch.length;
    game.distance = Math.min(next, game.distance + game.speed * dt);
    let picked = 0;
    for (const s of spawns) {
      if (s.kind === 'collectible' && !s.passed && -s.z <= game.distance) {
        s.passed = true;
        if (game.hero.lane === s.lane && game.hero.y < 1) {
          picked++;
          taken[phaseOf(-s.z)]++;
        }
      }
    }
    if (cfg.report === 'counter') game.collected += picked;
    if (cfg.report === 'hook') for (let k = 0; k < picked; k++) { ch.onCollect(game); noteWins(); }
    ch.onUpdate(game, dt);
    noteWins();
    if (cfg.report === 'hookLate') for (let k = 0; k < picked; k++) { ch.onCollect(game); noteWins(); }
    maxSpeed = Math.max(maxSpeed, game.speed);
    speedAt.push([game.distance, game.speed]);
    if (game.distance >= next && si < stops.length) {
      // Engine pause at a stop: speed 0 for 2 s, then resume at base speed.
      const resume = game.speed;
      game.speed = 0;
      for (let k = 0; k < 120; k++) {
        game.time += dt;
        ch.onUpdate(game, dt);
        if (game.speed !== 0) pausedSpeedRose = true;
      }
      game.speed = Math.min(resume, ch.speed.base);
      si++;
      if (si >= stops.length) break;
    }
  }
  return { game, spawns, says, pausedSpeedRose, maxSpeed, speedAt, taken, takenAtWin };
}

const runs = {};
for (const name of Object.keys(MODES)) {
  try {
    runs[name] = simulate(name);
  } catch (e) {
    ok(false, 'simulation (' + name + ') threw ' + e.stack);
  }
}
const attackCount = (r) => r.spawns.filter((s) => s.kind !== 'collectible').length;
if (runs.dodge) {
  const { spawns, pausedSpeedRose, maxSpeed, speedAt } = runs.dodge;
  ok(spawns.every((s) => s.kind === 'collectible' || obstacleIds.has(s.kind)), 'spawn kinds must be obstacle ids or collectible');
  ok(spawns.every((s) => P.lanes.includes(s.lane)), 'spawn lanes must be -1, 0 or 1');
  ok(spawns.every((s) => -s.z > s.d && -s.z <= s.d + P.spawnAhead + 1e-6), 'items must spawn ahead of the hero within spawnAhead');
  const attacks = spawns.filter((s) => s.kind !== 'collectible').map((s) => Object.assign({ at: -s.z }, s)).sort((a, b) => a.at - b.at);
  ok(attacks.every((a) => { const i = phaseOf(a.at); return i >= 0 && P.phases[i].mix.includes(a.kind); }), 'every attack must come from its phase mix');
  for (let i = 1; i < attacks.length; i++) ok(attacks[i].at - attacks[i - 1].at >= 20 - 1e-6, 'attacks closer than 20 m at ' + attacks[i].at);
  ok(attacks.every((a) => stops.every((s) => a.at < s.at - P.quietBeforeStop + 1e-6 || a.at >= s.at + P.firstAttackAfter - 1e-6) && a.at >= P.firstAttackAfter), 'attacks inside a quiet zone');
  const candles = spawns.filter((s) => s.kind === 'collectible');
  P.phases.forEach((p, i) => {
    const n = candles.filter((c) => phaseOf(-c.z) === i).length;
    ok(n >= 12, 'phase ' + (i + 1) + ' offers only ' + n + ' green candles (need >= 12 for a fair 8)');
    report.push('phase ' + (i + 1) + ' (' + p.name + '): ' + attacks.filter((a) => phaseOf(a.at) === i).length + ' attacks, ' + n + ' candles');
    if (p.adds) {
      const kinds = new Set(attacks.filter((a) => phaseOf(a.at) === i).map((a) => a.kind));
      ok(kinds.has(p.adds), 'phase ' + (i + 1) + ': its new attack type ' + p.adds + ' never appears');
    }
  });
  for (const c of candles) {
    ok(!attacks.some((a) => a.lane === c.lane && Math.abs(a.at + c.z) < 4), 'candle overlaps an attack at ' + -c.z);
  }
  ok(!pausedSpeedRose, 'onUpdate must not move the hero while stopped (speed 0)');
  ok(maxSpeed <= ch.speed.max + 1e-9, 'speed exceeded speed.max');
  const during = (lo, hi) => speedAt.filter(([d]) => d > lo && d < hi).map(([, v]) => v);
  ok(during(200, 255).every((v) => Math.abs(v - 16) < 1e-6), 'phase 1 speed should be 16');
  ok(during(400, 535).every((v) => Math.abs(v - 18) < 1e-6), 'phase 2 speed should reach 18');
  ok(during(700, 840).every((v) => Math.abs(v - 20) < 1e-6), 'phase 3 speed should reach 20');
}
for (const name of Object.keys(MODES)) {
  const r = runs[name];
  if (!r) continue;
  const st = r.game.state.ch8;
  if (MODES[name].wins) {
    ok(st.beaten.every((b) => b === true), name + ': collecting every candle must beat all 3 phases');
    ok(r.takenAtWin.every((n) => n === P.candlesToWin), name + ': each phase must be beaten on exactly the 8th candle (got ' + r.takenAtWin.join(',') + ')');
    ok(r.game.meters.stock === 65 && r.game.meters.board === 59, name + ': 3 phase wins should give Stock +15, Board +9 (got ' + r.game.meters.stock + ', ' + r.game.meters.board + ')');
    ok(r.says.filter((t) => /launched/.test(t)).length === 3, name + ': each phase win should be announced once');
    if (runs.dodge) ok(attackCount(r) < attackCount(runs.dodge), name + ': beating phases should cancel later attacks');
  } else {
    ok(r.taken.every((n) => n === 0) || name === 'counterIdle', name + ': the mock hero should pick up nothing');
    ok(st.beaten.every((b) => b === false), name + ': no phase may be beaten');
    ok(r.game.meters.stock === 50 && r.game.meters.board === 50, name + ': meters must not change');
  }
}
// Perfect play from 50/50 must reach the best ending with either final choice; no phase wins must not.
const clampAdd = (m, fx) => {
  const out = Object.assign({}, m);
  for (const k of Object.keys(fx || {})) out[k] = Math.max(0, Math.min(100, out[k] + fx[k]));
  return out;
};
if (runs.lane && runs.dodge && finalChoices && E.length === 4) {
  for (const c of finalChoices) {
    const best = clampAdd(runs.lane.game.meters, c.effects);
    ok(firstEnding(best) === 0, 'perfect play + "' + c.text + '" (' + JSON.stringify(best) + ') must give ' + E[0].id + ', got ' + (E[firstEnding(best)] || {}).id);
    const idle = clampAdd(runs.dodge.game.meters, c.effects);
    ok(firstEnding(idle) !== 0, 'no phase wins + "' + c.text + '" must not give ' + E[0].id);
  }
}
// Hooks must tolerate a bare game object.
try {
  const bare = { distance: 0, state: {} };
  ch.onStart(bare);
  ch.onUpdate(bare, 0.016);
  bare.distance = 300;
  ch.onUpdate(bare, 0.016);
  ch.onCollect(bare);
  ok(true, '');
} catch (e) {
  ok(false, 'hooks threw on a bare game object: ' + e.message);
}

// ---------------------------------------------------------------- tone: unsupplied real quotes
const allText = signTexts.concat(
  [ch.frontPage.headline, ch.frontPage.sub, ch.endCard.title], ch.endCard.lines,
  ...Object.values(D).map((nodes) => [].concat(...nodes.map((n) => [n.text].concat((n.choices || []).map((c) => c.text))))),
  ...E.map((e) => [e.frontPage.headline, e.frontPage.sub].concat(e.lines)),
  runs.lane ? runs.lane.says : []
);
for (const q of UNSUPPLIED_QUOTES) {
  const hit = allText.find((t) => String(t).toLowerCase().includes(q));
  ok(!hit, 'text reuses an unsupplied real quote ("' + q + '"): ' + hit);
}

// ---------------------------------------------------------------- result
for (const line of report) console.log('  ' + line);
if (failures.length) {
  console.error('\nFAIL: ' + failures.length + ' problem(s)');
  for (const f of failures) console.error(' - ' + f);
  process.exit(1);
}
console.log('\nPASS: ' + passes + ' checks');
