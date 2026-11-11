/* Validates chapter.js with real THREE (r149) and a stub kit. Run: node check.js */
'use strict';

const THREE = require('./three.min.js');

// ---------- stub kit (records what each build asked for) ----------
let log = { texts: [], persons: [] };
const kit = {
  textPlane(text, opts) {
    opts = opts || {};
    log.texts.push(String(text));
    const m = new THREE.Mesh(new THREE.PlaneGeometry(opts.w || 1, opts.h || 0.5), new THREE.MeshBasicMaterial({ color: opts.bg || '#ffffff' }));
    m.userData.text = String(text);
    return m;
  },
  person(opts) {
    opts = opts || {};
    log.persons.push(opts);
    const g = new THREE.Group();
    const top = new THREE.MeshLambertMaterial({ color: opts.top || '#888888' });
    const add = (w, h, d, x, y) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), top); b.position.set(x, y, 0); g.add(b); };
    add(0.15, 0.85, 0.18, -0.1, 0.425); add(0.15, 0.85, 0.18, 0.1, 0.425); // legs
    add(0.45, 0.6, 0.25, 0, 1.15); // torso
    add(0.12, 0.6, 0.12, -0.29, 1.15); add(0.12, 0.6, 0.12, 0.29, 1.15); // arms
    add(0.28, 0.3, 0.28, 0, 1.65); // head, top at 1.8
    return g;
  }
};

// ---------- tiny test harness ----------
let failures = 0, passes = 0;
function check(name, fn) {
  try { fn(); passes++; console.log('PASS ' + name); } catch (e) { failures++; console.log('FAIL ' + name + ': ' + e.message); }
}
function ok(cond, msg) { if (!cond) throw new Error(msg); }

const warnings = [];
const origWarn = console.warn;
console.warn = (...a) => { warnings.push(a.join(' ')); };

const ch = require('./chapter.js')(THREE, kit);

const METERS = ['stock', 'board', 'washington', 'beijing'];
const HEX = /^#[0-9a-f]{6}$/i;
const ROAD_HALF = 3; // three 2 m lanes
const LANE_W = 2.0;
const CORRIDOR = 0.75; // hero's half-width corridor inside a lane
const HERO_HEIGHT = 1.8; // anything lower than this in the corridor blocks a standing hero
const READ_WPM = 220, READ_SECONDS = 15;
const MAX_WORDS = Math.floor(READ_WPM * READ_SECONDS / 60); // 55 words per stop path

function countMeshes(o) { let n = 0; o.traverse((c) => { if (c.isMesh) n++; }); return n; }
function measure(o) { o.updateMatrixWorld(true); return new THREE.Box3().setFromObject(o); }
function sizeOf(b) { return { w: b.max.x - b.min.x, h: b.max.y - b.min.y, d: b.max.z - b.min.z }; }
function built(label, fn, maxMeshes) {
  log = { texts: [], persons: [] };
  const a = fn();
  const rec = log;
  log = { texts: [], persons: [] };
  const b = fn();
  ok(a && a.isGroup, label + ' build() must return a THREE.Group');
  ok(a !== b, label + ' build() must return a new Group each call');
  const n = countMeshes(a);
  ok(n >= 1 && n <= maxMeshes, label + ' has ' + n + ' meshes (allowed 1..' + maxMeshes + ')');
  return { obj: a, rec: rec, meshes: n };
}
const seeded = (seed) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const words = (t) => String(t).split(/\s+/).filter(Boolean).length;

// ---------- required fields ----------
check('required fields present', () => {
  ok(ch.id === 'ch5', 'id');
  ok(typeof ch.title === 'string' && ch.title, 'title');
  ok(ch.dateline === 'October 29, 2026', 'dateline');
  ok(ch.outfit === 'jacket', 'outfit');
  ok(ch.hideMeters === false, 'hideMeters');
  ok(Number.isFinite(ch.length) && ch.length >= 700 && ch.length <= 900, 'length 700-900');
  ok(ch.speed && ch.speed.base >= 11 && ch.speed.max <= 20 && ch.speed.base <= ch.speed.max, 'speed range 11-20');
  ok(ch.speed.base === 14 && ch.speed.max === 18, 'speed 14-18 per brief');
  ok(ch.frontPage && typeof ch.frontPage.headline === 'string' && typeof ch.frontPage.sub === 'string', 'frontPage');
  const t = ch.theme || {};
  ['sky', 'fog', 'ground', 'road', 'laneLine', 'lightColor', 'ambient'].forEach((k) => ok(HEX.test(t[k]), 'theme.' + k + ' hex'));
  ['fogNear', 'fogFar', 'lightIntensity'].forEach((k) => ok(Number.isFinite(t[k]), 'theme.' + k + ' number'));
  ok(t.fogNear < t.fogFar, 'fogNear < fogFar');
  ok(Array.isArray(ch.scenery) && ch.scenery.length >= 4 && ch.scenery.length <= 7, 'scenery 4-7 kinds');
  ok(Array.isArray(ch.obstacles) && ch.obstacles.length >= 5 && ch.obstacles.length <= 7, 'obstacles 5-7 kinds');
  ok(ch.collectible && typeof ch.collectible.name === 'string' && typeof ch.collectible.build === 'function', 'collectible');
  ok(Array.isArray(ch.stops) && ch.stops.length >= 3 && ch.stops.length <= 4, 'stops 3-4');
  ok(ch.dialogues && typeof ch.dialogues === 'object', 'dialogues');
  ok(ch.mechanic && typeof ch.mechanic.summary === 'string' && ch.mechanic.summary.length > 100, 'mechanic.summary');
  ok(ch.mechanic.params && typeof ch.mechanic.params === 'object', 'mechanic.params');
  ok(typeof ch.onStart === 'function' && typeof ch.onUpdate === 'function', 'hooks');
  ok(ch.endCard && typeof ch.endCard.title === 'string' && Array.isArray(ch.endCard.lines) && ch.endCard.lines.length > 0, 'endCard');
});

check('ids unique, scenery and obstacle descriptors valid', () => {
  const sIds = new Set(ch.scenery.map((s) => s.id));
  const oIds = new Set(ch.obstacles.map((o) => o.id));
  ok(sIds.size === ch.scenery.length, 'scenery ids unique');
  ok(oIds.size === ch.obstacles.length, 'obstacle ids unique');
  ch.scenery.forEach((s) => {
    ok(['left', 'right', 'both'].includes(s.side), s.id + ' side');
    ok(s.every > 0 && s.offset >= 6, s.id + ' every > 0 and offset >= 6');
    ok(typeof s.build === 'function', s.id + ' build');
  });
  ch.obstacles.forEach((o) => {
    ok(['low', 'high', 'block', 'mover'].includes(o.type), o.id + ' type');
    ok(o.weight > 0, o.id + ' weight');
    ok(o.size && o.size.w > 0 && o.size.h > 0 && o.size.d > 0, o.id + ' size');
  });
});

// ---------- stops and dialogues ----------
check('stops sorted, first >= 150, last == length', () => {
  const at = ch.stops.map((s) => s.at);
  for (let i = 1; i < at.length; i++) ok(at[i] > at[i - 1], 'stops not strictly sorted');
  ok(at[0] >= 150, 'first stop < 150');
  ok(at[at.length - 1] === ch.length, 'last stop != length');
  ch.stops.forEach((s) => {
    ok(typeof s.title === 'string' && s.title, 'stop title');
    ok(s.landmark && Number.isFinite(s.landmark.x) && typeof s.landmark.build === 'function', 'stop landmark');
  });
});

check('every dialogueId and next resolves', () => {
  ch.stops.forEach((s) => ok(Array.isArray(ch.dialogues[s.dialogueId]), 'missing dialogue ' + s.dialogueId));
  Object.keys(ch.dialogues).forEach((id) => {
    const d = ch.dialogues[id];
    ok(Array.isArray(d) && d.length > 0, id + ' must be a non-empty array');
    d.forEach((n, i) => {
      ok(typeof n.speaker === 'string' && n.speaker && typeof n.text === 'string' && n.text, id + '[' + i + '] speaker/text');
      if (n.next !== undefined) ok(Array.isArray(ch.dialogues[n.next]), id + '[' + i + '].next ' + n.next);
      (n.choices || []).forEach((c) => {
        ok(typeof c.text === 'string' && c.text, id + ' choice text');
        if (c.next !== undefined) ok(Array.isArray(ch.dialogues[c.next]), id + ' choice.next ' + c.next);
      });
    });
  });
});

// All node sequences a player can see from a dialogue, following node-level and choice-level next.
function paths(id, seen) {
  seen = seen || new Set();
  ok(!seen.has(id), 'dialogue cycle at ' + id);
  const next = new Set(seen).add(id);
  const d = ch.dialogues[id];
  let out = [[]];
  for (const n of d) {
    let tails = [[]];
    if (n.choices && n.choices.length) {
      tails = [];
      n.choices.forEach((c) => { (c.next ? paths(c.next, next) : [[]]).forEach((p) => tails.push(p)); });
    } else if (n.next) tails = paths(n.next, next);
    out = out.flatMap((p) => tails.map((t) => p.concat([n], t)));
    if (n.next || (n.choices && n.choices.length)) break; // control leaves this array
  }
  return out;
}
function reachable(id, acc) {
  acc = acc || new Set();
  if (acc.has(id)) return acc;
  acc.add(id);
  ch.dialogues[id].forEach((n) => {
    if (n.next) reachable(n.next, acc);
    (n.choices || []).forEach((c) => { if (c.next) reachable(c.next, acc); });
  });
  return acc;
}

check('each stop shows 2-6 lines on every path', () => {
  ch.stops.forEach((s) => paths(s.dialogueId).forEach((p) => ok(p.length >= 2 && p.length <= 6, s.dialogueId + ' path has ' + p.length + ' lines')));
});

check('each stop path readable in under 15 s (<= ' + MAX_WORDS + ' words at ' + READ_WPM + ' wpm, choice options included)', () => {
  ch.stops.forEach((s) => paths(s.dialogueId).forEach((p) => {
    const n = p.reduce((sum, node) => sum + words(node.text) + (node.choices || []).reduce((a, c) => a + words(c.text), 0), 0);
    ok(n <= MAX_WORDS, s.dialogueId + ' path has ' + n + ' words');
  }));
});

check('last stop: exactly one 2-option choice, effects in range, not dominated', () => {
  const last = ch.stops[ch.stops.length - 1];
  const nodes = [];
  reachable(last.dialogueId).forEach((id) => ch.dialogues[id].forEach((n) => { if (n.choices) nodes.push(n); }));
  ok(nodes.length === 1, 'found ' + nodes.length + ' choice nodes');
  const opts = nodes[0].choices;
  ok(opts.length === 2, 'choice must have 2 options, has ' + opts.length);
  const vec = opts.map((c) => {
    ok(c.effects && typeof c.effects === 'object', 'effects missing');
    Object.keys(c.effects).forEach((k) => {
      ok(METERS.includes(k), 'unknown meter ' + k);
      ok(Number.isFinite(c.effects[k]) && c.effects[k] >= -15 && c.effects[k] <= 15, k + ' out of range');
    });
    return METERS.map((m) => c.effects[m] || 0);
  });
  const aWins = vec[0].some((v, i) => v > vec[1][i]);
  const bWins = vec[1].some((v, i) => v > vec[0][i]);
  ok(aWins && bWins, 'one option dominates the other');
  ch.stops.slice(0, -1).forEach((s) => reachable(s.dialogueId).forEach((id) => ch.dialogues[id].forEach((n) => ok(!n.choices, id + ' has a choice before the last stop'))));
});

check('no dialogue text longer than 140 characters', () => {
  Object.keys(ch.dialogues).forEach((id) => ch.dialogues[id].forEach((n, i) => {
    ok(n.text.length <= 140, id + '[' + i + '] is ' + n.text.length + ' chars');
    (n.choices || []).forEach((c) => ok(c.text.length <= 140, id + ' choice is ' + c.text.length + ' chars'));
  }));
});

// ---------- builds and geometry ----------
const obstacleBuilds = {};
check('obstacle builds: Group, 1-25 meshes', () => {
  ch.obstacles.forEach((o) => { obstacleBuilds[o.id] = built('obstacle ' + o.id, () => o.build(), 25); });
});

function lowOk(s) { return s.h <= 0.8 && s.w <= 1.8; }
function blockOk(s) { return s.h >= 1.5 && s.w <= 1.8 && s.w >= 1.2; }

check('obstacle bounding boxes obey type rules', () => {
  ch.obstacles.forEach((o) => {
    const b = obstacleBuilds[o.id];
    ok(b, o.id + ' did not build');
    const box = measure(b.obj);
    const s = sizeOf(box);
    const tag = o.id + ' (' + o.type + ', w ' + s.w.toFixed(2) + ' h ' + s.h.toFixed(2) + ' d ' + s.d.toFixed(2) + ')';
    ok(Math.abs(box.min.y) <= 0.02, tag + ' must sit on the ground, min.y ' + box.min.y.toFixed(3));
    ok(Math.abs((box.min.x + box.max.x) / 2) <= 0.15, tag + ' not centred in x');
    ok(Math.abs((box.min.z + box.max.z) / 2) <= 0.25, tag + ' not centred in z');
    ['w', 'h', 'd'].forEach((k) => ok(Math.abs(s[k] - o.size[k]) <= 0.3, tag + ' declared ' + k + ' ' + o.size[k] + ' differs from measured'));
    if (o.type === 'low') ok(lowOk(s), tag + ' low needs h <= 0.8, w <= 1.8');
    if (o.type === 'block') ok(blockOk(s), tag + ' block needs h >= 1.5, 1.2 <= w <= 1.8');
    if (o.type === 'mover') ok(lowOk(s) || blockOk(s), tag + ' mover must be low- or block-sized');
    if (o.type === 'high') {
      ok(s.w <= LANE_W + 1e-6, tag + ' high must fit inside one ' + LANE_W + ' m lane');
      let under = Infinity;
      const spans = [];
      b.obj.traverse((c) => {
        if (!c.isMesh) return;
        const mb = new THREE.Box3().setFromObject(c);
        if (mb.max.x > -CORRIDOR && mb.min.x < CORRIDOR) {
          under = Math.min(under, mb.min.y);
          if (mb.min.y < HERO_HEIGHT) spans.push([mb.min.x, mb.max.x]);
        }
      });
      ok(Number.isFinite(under), tag + ' has nothing across the lane');
      ok(under >= 1.1, tag + ' underside in the lane is ' + under.toFixed(2) + ' (< 1.1)');
      ok(under <= 1.7, tag + ' underside ' + under.toFixed(2) + ' is too high to force a slide');
      // The parts low enough to hit a standing hero must cover the whole corridor with no gap.
      spans.sort((p, q) => p[0] - q[0]);
      let reach = -CORRIDOR;
      for (const [lo, hi] of spans) { if (lo > reach + 1e-6) break; reach = Math.max(reach, hi); }
      ok(reach >= CORRIDOR, tag + ' leaves a gap in the lane from x ' + reach.toFixed(2));
    }
  });
});

check('at least one obstacle of each type', () => {
  ['low', 'high', 'block', 'mover'].forEach((t) => ok(ch.obstacles.some((o) => o.type === t), 'no ' + t));
});

check('collectible build: Group, about 0.5 m', () => {
  const b = built('collectible', () => ch.collectible.build(), 25);
  const s = sizeOf(measure(b.obj));
  const m = Math.max(s.w, s.h, s.d);
  ok(m >= 0.3 && m <= 0.8, 'collectible largest side ' + m.toFixed(2));
});

const sceneryRecs = {}; // every seed's record, per scenery id
check('scenery builds: Group, 1-40 meshes, several seeds', () => {
  ch.scenery.forEach((s) => {
    sceneryRecs[s.id] = [];
    [1, 7, 42, 99, 1234].forEach((seed) => {
      const b = built('scenery ' + s.id + ' seed ' + seed, () => s.build(seeded(seed)), 40);
      sceneryRecs[s.id].push(b.rec);
      ok(measure(b.obj).min.y >= -0.05, s.id + ' below ground (seed ' + seed + ')');
    });
  });
});

const landmarkBuilds = [];
check('landmarks: Group, 1-25 meshes, 3-8 m, clear of the road', () => {
  ch.stops.forEach((st, i) => {
    const b = built('landmark ' + (i + 1), () => st.landmark.build(), 25);
    landmarkBuilds.push(b);
    const box = measure(b.obj);
    const s = sizeOf(box);
    const m = Math.max(s.w, s.h, s.d);
    ok(m >= 3 && m <= 8, 'landmark ' + (i + 1) + ' largest side ' + m.toFixed(2));
    ok(Math.abs(box.min.y) <= 0.02, 'landmark ' + (i + 1) + ' not on the ground');
    const x = st.landmark.x;
    const inner = x < 0 ? -(x + box.max.x) : x + box.min.x;
    ok(inner >= ROAD_HALF, 'landmark ' + (i + 1) + ' intrudes on the road (inner edge ' + inner.toFixed(2) + ')');
  });
});

// ---------- tone and safety rules that can be checked mechanically ----------
const isSilhouette = (p) => p.accessory === 'sunglasses';
const hasExec = (b) => b.rec.texts.includes('Megaspeed executive');
check('The Silhouette always carries an UNVERIFIED stamp and never appears at a stop', () => {
  const all = Object.keys(obstacleBuilds).map((k) => ['obstacle ' + k, obstacleBuilds[k].rec]);
  Object.keys(sceneryRecs).forEach((k) => sceneryRecs[k].forEach((rec, i) => all.push(['scenery ' + k + ' #' + i, rec])));
  all.forEach(([label, rec]) => {
    const n = rec.persons.filter(isSilhouette).length;
    const stamps = rec.texts.filter((t) => t === 'UNVERIFIED').length;
    ok(stamps >= n, label + ' has ' + n + ' Silhouettes but ' + stamps + ' UNVERIFIED stamps');
  });
  landmarkBuilds.forEach((b, i) => ok(!b.rec.persons.some(isSilhouette), 'landmark ' + (i + 1) + ' contains The Silhouette'));
  ok(obstacleBuilds['rumour-bubble'].rec.persons.some(isSilhouette), 'rumour bubble should show The Silhouette');
});

check('Megaspeed executive appears, labelled, only at stops 2 and 3', () => {
  landmarkBuilds.forEach((b, i) => ok(hasExec(b) === (i === 1 || i === 2), 'landmark ' + (i + 1) + ' label presence is ' + hasExec(b)));
});

check('Silhouette scenery never shares a side of the street with an executive stop', () => {
  const execSides = new Set();
  ch.stops.forEach((st, i) => { if (hasExec(landmarkBuilds[i])) execSides.add(st.landmark.x < 0 ? 'left' : 'right'); });
  ch.scenery.forEach((s) => {
    if (!sceneryRecs[s.id].some((rec) => rec.persons.some(isSilhouette))) return;
    ok(s.side !== 'both' && !execSides.has(s.side), s.id + ' shows The Silhouette on the ' + s.side + ' side, next to an executive stop');
  });
});

function allVisibleText() {
  const texts = [ch.title, ch.frontPage.headline, ch.frontPage.sub, ch.endCard.title].concat(ch.endCard.lines);
  Object.keys(ch.dialogues).forEach((id) => ch.dialogues[id].forEach((n) => { texts.push(n.text, n.speaker); (n.choices || []).forEach((c) => texts.push(c.text)); }));
  Object.values(obstacleBuilds).concat(landmarkBuilds).forEach((b) => b.rec.texts.forEach((t) => texts.push(t)));
  Object.values(sceneryRecs).forEach((recs) => recs.forEach((rec) => rec.texts.forEach((t) => texts.push(t))));
  return texts;
}

check('no "spy" wording anywhere in visible text', () => {
  allVisibleText().forEach((t) => ok(!/\bspy\b|\bspies\b|\bespionage\b/i.test(t), 'found spy wording in: ' + t));
});

check('no line puts CONFIRMED after a denial (reads as a rebuttal)', () => {
  allVisibleText().forEach((t) => ok(!/\bden(y|ies|ied)\b[\s\S]*\bCONFIRMED\b/i.test(t), 'denial followed by CONFIRMED in: ' + t));
});

check('front page pairs the allegation with every response', () => {
  const fp = ch.frontPage.headline + ' ' + ch.frontPage.sub;
  if (!/alleg/i.test(fp)) return;
  ok(/smear/i.test(fp), 'front page lacks China\'s response');
  ok(/Megaspeed denies/i.test(fp), 'front page lacks Megaspeed\'s denial');
  ok(/completely normal/i.test(fp), 'front page lacks the CEO\'s "completely normal"');
});

check('no THREE warnings during builds', () => {
  ok(warnings.length === 0, warnings.join(' | '));
});

// ---------- Fact Check twist, simulated against fake games ----------
function fakeGame(extra) {
  const said = [];
  const game = Object.assign({
    hero: { lane: 0, y: 0, hearts: 3 }, distance: 0, speed: 14, meters: { stock: 50, board: 50, washington: 50, beijing: 50 },
    state: {}, time: 0, say: (t) => said.push(t), hurt() {}, addCollect() {}, spawn() {}, fail() {}
  }, extra || {});
  const tick = (dt) => { game.time += dt; ch.onUpdate(game, dt); };
  const run = (seconds) => { const n = Math.round(seconds / 0.1); for (let i = 0; i < n; i++) tick(0.1); };
  return { game, said, tick, run, fc: () => game.state.factCheck };
}

check('twist documents the engine hooks it needs', () => {
  ok(typeof ch.onCollect === 'function' && typeof ch.onHit === 'function', 'onCollect/onHit missing');
  const needs = ch.mechanic.params.engineNeeds;
  ok(Array.isArray(needs) && needs.some((t) => /onCollect/.test(t)) && needs.some((t) => /onHit/.test(t)), 'params.engineNeeds must list onCollect and onHit');
  ok(/onCollect/.test(ch.mechanic.summary) && /onHit/.test(ch.mechanic.summary), 'summary must name onCollect and onHit');
});

check('twist via game.collected polling: streak, shield, pops, cap, timer', () => {
  const { game, said, tick, run, fc } = fakeGame({ collected: 0 });
  ch.onStart(game);
  for (let i = 0; i < 4; i++) { game.collected++; tick(0.1); }
  ok(!fc().active, 'shield on after 4 stamps');
  game.hero.hearts = 2; tick(0.1); // a hit resets the streak
  ok(fc().streak === 0, 'hit did not reset streak');
  for (let i = 0; i < 5; i++) { game.collected++; tick(0.1); }
  ok(fc().active, 'shield off after 5 clean stamps');
  ok(ch.onHit(game, { id: 3, kind: 'paper-roll' }) === false, 'shield must not block other obstacles');
  for (let i = 0; i < 5; i++) { game.collected++; tick(0.1); }
  ok(fc().active, 'shield should still be active');
  for (let i = 0; i < 7; i++) ok(ch.onHit(game, { id: 7, kind: 'rumour-bubble' }) === true, 'bubble should pop');
  ok(game.meters.board === 60, 'board bonus should cap at +10, got ' + (game.meters.board - 50));
  run(4.8); ok(fc().active, 'shield ended early');
  run(0.4); ok(!fc().active, 'shield lasted longer than 5 s');
  ok(ch.onHit(game, 'rumour-bubble') === false, 'bubble must hurt once shield is off');
  ok(said.some((t) => /FACT CHECK/.test(t)), 'no activation message');
});

check('twist via onCollect only (no game.collected), obstacle named by kind with numeric id', () => {
  const { game, run, tick, fc } = fakeGame();
  ok(!('collected' in game), 'fake game must not have a collected field');
  ch.onStart(game);
  for (let i = 0; i < 4; i++) { ch.onCollect(game); tick(0.1); }
  ok(fc().streak === 4 && !fc().active, 'onCollect did not count 4 stamps');
  ok(ch.onHit(game, { id: 11, kind: 'breaking-banner' }) === false, 'banner hit should not pop');
  ok(fc().streak === 0, 'onHit did not reset the streak');
  for (let i = 0; i < 3; i++) { ch.onCollect(game); tick(0.1); }
  game.hero.hearts -= 1; tick(0.1);
  ok(fc().streak === 0, 'heart loss did not reset the streak');
  ch.onStart(game); // a new chapter run starts clean
  ok(fc().streak === 0 && !fc().active && fc().boardEarned === 0, 'onStart did not reset the twist');
  for (let i = 0; i < 5; i++) ch.onCollect(game);
  ok(fc().active, 'shield did not turn on from onCollect alone');
  ok(ch.onHit(game, { id: 7, kind: 'rumour-bubble' }) === true, 'kind lookup failed with a numeric id');
  ok(ch.onHit(game, { id: 'rumour-bubble' }) === true, 'id lookup failed');
  ok(game.meters.board === 54, 'expected +4 Board Trust, got ' + (game.meters.board - 50));
  ok(ch.onHit(game, { id: 8, kind: 'proof-line' }) === false, 'shield must not block a high obstacle');
  tick(0.1);
  ok(fc().active, 'shield dropped too early');
  run(5.0);
  ok(!fc().active, 'shield outlived 5 s');
  ok(ch.onHit(game, { id: 7, kind: 'rumour-bubble' }) === false, 'bubble popped with the shield off');
});

check('twist does not double count when the engine calls onCollect and also keeps game.collected', () => {
  const { game, tick, fc } = fakeGame({ collected: 0 });
  ch.onStart(game);
  for (let i = 0; i < 4; i++) { game.collected++; ch.onCollect(game); tick(0.1); }
  ok(fc().streak === 4 && !fc().active, 'streak is ' + fc().streak + ' after 4 stamps');
  game.collected++; ch.onCollect(game); tick(0.1);
  ok(fc().active, 'fifth stamp did not turn the shield on');
});

console.warn = origWarn;
console.log('\n' + passes + ' passed, ' + failures + ' failed');
process.exit(failures ? 1 : 0);
