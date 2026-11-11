'use strict';
// Validates chapter.js against the content brief. Run: node check.js
const THREE = require('./three.min.js');
const factory = require('./chapter.js');

const failures = [];
const check = (cond, msg) => { if (!cond) failures.push(msg); };
const warnings = [];
const origWarn = console.warn;
console.warn = (...args) => { warnings.push(args.join(' ')); };

// ------------------------------------------------------------------ stub kit
const HEX = /^#[0-9a-f]{6}$/i;
const kit = {
  textPlane(text, opts) {
    check(typeof text === 'string' && text.length > 0, 'textPlane called without text');
    check(opts && opts.w > 0 && opts.h > 0, `textPlane "${text}" needs positive w and h`);
    check(opts && HEX.test(opts.bg) && HEX.test(opts.fg), `textPlane "${text}" needs hex bg and fg`);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(opts.w, opts.h), new THREE.MeshBasicMaterial({ color: opts.bg }));
    m.userData.kit = 'text';
    m.userData.text = text;
    return m;
  },
  person(look) {
    look = look || {};
    ['skin', 'hair', 'top', 'bottom'].forEach(k => check(HEX.test(look[k]), `person needs hex ${k}`));
    const g = new THREE.Group();
    g.userData.kit = 'person';
    const add = (w, h, d, x, y, color) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
      m.position.set(x, y, 0);
      m.userData.kit = 'person';
      g.add(m);
    };
    add(0.18, 0.85, 0.2, -0.12, 0.425, look.bottom);
    add(0.18, 0.85, 0.2, 0.12, 0.425, look.bottom);
    add(0.5, 0.65, 0.28, 0, 1.175, look.top);
    add(0.12, 0.6, 0.14, -0.33, 1.2, look.top);
    add(0.12, 0.6, 0.14, 0.33, 1.2, look.top);
    add(0.26, 0.28, 0.26, 0, 1.64, look.skin);
    add(0.28, 0.06, 0.28, 0, 1.77, look.hair); // top of head at 1.8m
    return g;
  },
};

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------------ helpers
const EPS = 1e-6;
const METERS = ['stock', 'board', 'washington', 'beijing'];
const ALLOWED_GEOMETRY = new Set(['BoxGeometry', 'CylinderGeometry', 'ConeGeometry', 'SphereGeometry']);
const MAX_WORDS_PER_STOP = 55; // about 15 s of reading at 220 words per minute
const allTexts = []; // every string the player can see, for the tone checks

function inspect(label, obj, maxMeshes) {
  const out = { ok: false };
  check(obj instanceof THREE.Group, `${label}: build() must return a THREE.Group`);
  if (!(obj instanceof THREE.Group)) return out;
  check(obj.position.lengthSq() === 0, `${label}: root group must sit at the origin`);
  let meshes = 0, people = 0;
  const texts = [];
  obj.traverse(o => {
    if (o.isMesh) {
      meshes++;
      if (!o.userData.kit) {
        check(o.material instanceof THREE.MeshLambertMaterial, `${label}: non-kit mesh must use MeshLambertMaterial`);
        check(o.material.flatShading === true, `${label}: material must be flat-shaded`);
        check(!o.material.map, `${label}: no image textures`);
        check(ALLOWED_GEOMETRY.has(o.geometry.type), `${label}: geometry ${o.geometry.type} not allowed`);
      }
    }
    if (o.isGroup && o.userData.kit === 'person') people++;
    if (o.userData.kit === 'text') texts.push(o.userData.text);
  });
  check(meshes >= 1, `${label}: needs at least 1 mesh`);
  check(meshes <= maxMeshes, `${label}: ${meshes} meshes exceeds ${maxMeshes}`);
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj);
  check(box.min.y >= -0.01, `${label}: geometry below ground (min.y ${box.min.y.toFixed(3)})`);
  // The kiss-cam label must never share an object with rumour imagery.
  if (texts.some(t => /megaspeed/i.test(t))) {
    check(!texts.some(t => /honeypot|unverified|silhouette|rumou?r/i.test(t)), `${label}: Megaspeed label next to rumour imagery`);
  }
  allTexts.push(...texts);
  return { ok: true, box, size: box.getSize(new THREE.Vector3()), center: box.getCenter(new THREE.Vector3()), meshes, people, texts };
}

function newEachCall(label, build, arg) {
  const a = build(arg), b = build(arg);
  check(a !== b, `${label}: build() must return a new Group each call`);
}

const fmt = v => v.toFixed(2);
const countWords = s => (typeof s === 'string' ? s.split(/\s+/).filter(Boolean).length : 0);

// ------------------------------------------------------------------ build chapter
check(typeof factory === 'function', 'chapter.js must export a factory function');
const ch = factory(THREE, kit);

// required fields and brief values
check(ch.id === 'ch6', 'id must be ch6');
check(ch.title === 'Meme Storm', 'title must be "Meme Storm"');
check(ch.dateline === 'The Internet, November 8-9, 2026', 'dateline mismatch');
check(ch.outfit === 'jacket', 'outfit must be jacket');
check(ch.hideMeters === false, 'hideMeters must be false');
check(typeof ch.length === 'number' && ch.length >= 700 && ch.length <= 900, 'length must be 700-900');
check(ch.speed && ch.speed.base === 15 && ch.speed.max === 19, 'speed must be 15-19');
check(ch.speed && ch.speed.base >= 11 && ch.speed.max <= 20 && ch.speed.base <= ch.speed.max, 'speed must be within 11-20');
check(ch.frontPage && typeof ch.frontPage.headline === 'string' && typeof ch.frontPage.sub === 'string', 'frontPage needs headline and sub');
if (ch.frontPage) allTexts.push(ch.frontPage.headline, ch.frontPage.sub);
const t = ch.theme || {};
['sky', 'fog', 'ground', 'road', 'laneLine', 'lightColor', 'ambient'].forEach(k => check(HEX.test(t[k]), `theme.${k} must be #rrggbb`));
check(t.fogNear >= 0 && t.fogFar > t.fogNear, 'theme fogNear/fogFar invalid');
check(t.lightIntensity > 0, 'theme.lightIntensity must be > 0');
check(ch.mechanic && typeof ch.mechanic.summary === 'string' && ch.mechanic.summary.length > 80, 'mechanic.summary missing or too vague');
check(ch.mechanic && ch.mechanic.params && typeof ch.mechanic.params === 'object', 'mechanic.params missing');
check(typeof ch.onStart === 'function' && typeof ch.onUpdate === 'function', 'onStart/onUpdate must be functions');
check(ch.endCard && typeof ch.endCard.title === 'string' && Array.isArray(ch.endCard.lines) && ch.endCard.lines.length > 0, 'endCard needs title and lines');

// ------------------------------------------------------------------ scenery
check(Array.isArray(ch.scenery) && ch.scenery.length >= 4 && ch.scenery.length <= 7, 'scenery needs 4-7 kinds');
const ids = new Set();
const bands = []; // world x range of each solid scenery kind, per side
const report = [];
(ch.scenery || []).forEach(s => {
  const label = `scenery ${s.id}`;
  check(typeof s.id === 'string' && !ids.has(s.id), `${label}: id missing or duplicate`);
  ids.add(s.id);
  check(['left', 'right', 'both'].includes(s.side), `${label}: bad side`);
  check(s.every > 0, `${label}: every must be > 0`);
  check(s.offset >= 6, `${label}: offset must be >= 6`);
  check(typeof s.build === 'function', `${label}: build missing`);
  if (typeof s.build !== 'function') return;
  newEachCall(label, s.build, mulberry32(1));
  let minX = Infinity, maxX = -Infinity, maxY = -Infinity, megaspeed = false;
  for (let seed = 1; seed <= 8; seed++) {
    const r = inspect(label, s.build(mulberry32(seed)), 40);
    if (!r.ok) continue;
    minX = Math.min(minX, r.box.min.x);
    maxX = Math.max(maxX, r.box.max.x);
    maxY = Math.max(maxY, r.box.max.y);
    if (r.texts.some(x => /megaspeed/i.test(x))) megaspeed = true;
    // must stay off the 6m-wide road (x in [-3, 3]) on every side it is placed
    if (s.side !== 'left') check(s.offset + r.box.min.x >= 3, `${label}: intrudes on road (right side)`);
    if (s.side !== 'right') check(-s.offset + r.box.max.x <= -3, `${label}: intrudes on road (left side)`);
  }
  // The brief allows one kiss-cam piece with the executive: spacing wider than the run allows at most one copy.
  if (megaspeed) check(s.every > ch.length, `${label}: shows the Megaspeed executive, so every must exceed the length`);
  if (minX > maxX) return;
  const decal = maxY <= 0.05; // flat floor tiles may lie under other scenery
  if (s.side !== 'left') bands.push({ id: s.id, side: 'right', min: s.offset + minX, max: s.offset + maxX, decal });
  if (s.side !== 'right') bands.push({ id: s.id, side: 'left', min: -s.offset + minX, max: -s.offset + maxX, decal });
});
// Solid kinds on the same side need their own x band, or copies that land near each other pass through.
bands.forEach((a, i) => bands.slice(i + 1).forEach(b => {
  if (a.side !== b.side || a.decal || b.decal) return;
  check(a.max <= b.min || b.max <= a.min,
    `scenery ${a.id} and ${b.id} overlap on the ${a.side} (${fmt(a.min)}..${fmt(a.max)} vs ${fmt(b.min)}..${fmt(b.max)})`);
}));
bands.slice().sort((a, b) => a.min - b.min).forEach(b =>
  report.push(`scenery ${b.side.padEnd(5)} ${b.id.padEnd(18)} x ${fmt(b.min)}..${fmt(b.max)}${b.decal ? ' (decal)' : ''}`));

// ------------------------------------------------------------------ obstacles
check(Array.isArray(ch.obstacles) && ch.obstacles.length >= 5 && ch.obstacles.length <= 7, 'obstacles needs 5-7 kinds');
const types = new Set();
(ch.obstacles || []).forEach(o => {
  const label = `obstacle ${o.id} (${o.type})`;
  check(['low', 'high', 'block', 'mover'].includes(o.type), `${label}: bad type`);
  types.add(o.type);
  check(o.weight > 0, `${label}: weight must be > 0`);
  check(o.size && o.size.w > 0 && o.size.h > 0 && o.size.d > 0, `${label}: size {w,h,d} required`);
  newEachCall(label, o.build);
  const r = inspect(label, o.build(), 25);
  if (!r.ok) return;
  const w = r.size.x, top = r.box.max.y, bottom = r.box.min.y, d = r.size.z;
  report.push(`${o.id.padEnd(15)} ${o.type.padEnd(5)} w ${fmt(w)} y ${fmt(bottom)}..${fmt(top)} d ${fmt(d)} meshes ${r.meshes}`);
  check(Math.abs(r.center.x) <= 0.1 && Math.abs(r.center.z) <= 0.15, `${label}: not centred on origin (${fmt(r.center.x)}, ${fmt(r.center.z)})`);
  if (o.size) {
    check(Math.abs(o.size.w - w) <= 0.15, `${label}: size.w ${o.size.w} vs measured ${fmt(w)}`);
    check(Math.abs(o.size.h - top) <= 0.15, `${label}: size.h ${o.size.h} vs measured top ${fmt(top)}`);
    check(Math.abs(o.size.d - d) <= 0.15, `${label}: size.d ${o.size.d} vs measured ${fmt(d)}`);
  }
  check(d >= 0.3, `${label}: depth ${fmt(d)} too thin for collision at speed`);
  const isLow = top <= 0.8 + EPS && w <= 1.8 + EPS && bottom <= 0.05;
  const isBlock = top >= 1.5 && w <= 1.8 + EPS && w >= 1.2 && bottom <= 0.05;
  if (o.type === 'low') check(isLow, `${label}: low needs h <= 0.8, w <= 1.8, on the ground`);
  if (o.type === 'block') check(isBlock, `${label}: block needs h >= 1.5, 1.2 <= w <= 1.8, on the ground`);
  if (o.type === 'mover') check(isLow || isBlock, `${label}: mover must be low- or block-sized`);
  if (o.type === 'high') {
    check(bottom >= 1.1, `${label}: underside ${fmt(bottom)} must be >= 1.1`);
    check(w >= 1.5 && w <= 2.0 + EPS, `${label}: must span one lane (w ${fmt(w)})`);
  }
});
['low', 'high', 'block', 'mover'].forEach(k => check(types.has(k), `needs at least one ${k} obstacle`));

// ------------------------------------------------------------------ collectible
check(ch.collectible && typeof ch.collectible.name === 'string' && typeof ch.collectible.build === 'function', 'collectible needs name and build');
if (ch.collectible && ch.collectible.build) {
  newEachCall('collectible', ch.collectible.build);
  const r = inspect('collectible', ch.collectible.build(), 25);
  if (r.ok) {
    const m = Math.max(r.size.x, r.size.y, r.size.z);
    check(m >= 0.35 && m <= 0.8, `collectible: should be about 0.5m (max dim ${fmt(m)})`);
    report.push(`collectible     ${fmt(r.size.x)} x ${fmt(r.size.y)} x ${fmt(r.size.z)} meshes ${r.meshes}`);
  }
}

// ------------------------------------------------------------------ dialogues
const D = ch.dialogues || {};
check(typeof D === 'object' && Object.keys(D).length > 0, 'dialogues missing');
Object.keys(D).forEach(id => {
  const nodes = D[id];
  check(Array.isArray(nodes) && nodes.length > 0, `dialogue ${id}: must be a non-empty array`);
  (nodes || []).forEach((n, i) => {
    const where = `dialogue ${id}[${i}]`;
    check(typeof n.speaker === 'string' && n.speaker.length > 0, `${where}: speaker missing`);
    check(typeof n.text === 'string' && n.text.length > 0, `${where}: text missing`);
    check(!n.text || n.text.length <= 140, `${where}: text longer than 140 chars (${n.text && n.text.length})`);
    allTexts.push(n.text);
    if (n.next !== undefined) check(D[n.next] !== undefined, `${where}: next "${n.next}" does not resolve`);
    if (n.choices !== undefined) {
      check(Array.isArray(n.choices) && n.choices.length > 0, `${where}: choices must be a non-empty array`);
      (n.choices || []).forEach((c, j) => {
        check(typeof c.text === 'string' && c.text.length > 0 && c.text.length <= 140, `${where} choice ${j}: text 1-140 chars`);
        allTexts.push(c.text);
        if (c.next !== undefined) check(D[c.next] !== undefined, `${where} choice ${j}: next "${c.next}" does not resolve`);
        Object.keys(c.effects || {}).forEach(k => {
          check(METERS.includes(k), `${where} choice ${j}: unknown meter ${k}`);
          const v = c.effects[k];
          check(typeof v === 'number' && v >= -15 && v <= 15, `${where} choice ${j}: ${k} effect ${v} outside -15..15`);
        });
      });
    }
  });
});

function reachable(id, seen) {
  seen = seen || new Set();
  if (seen.has(id) || !D[id]) return seen;
  seen.add(id);
  D[id].forEach(n => {
    if (n.next) reachable(n.next, seen);
    (n.choices || []).forEach(c => { if (c.next) reachable(c.next, seen); });
  });
  return seen;
}

// Min/max lines shown, and max words read (lines plus every option of a choice), along any path from `id`.
function pathStats(id, stack) {
  check(!stack.includes(id), `dialogue cycle through ${id}`);
  if (stack.includes(id) || !D[id]) return { min: 0, max: 0, words: 0 };
  const nodes = D[id];
  const res = { min: Infinity, max: 0, words: 0 };
  const walk = (i, lines, words) => {
    if (i >= nodes.length) {
      res.min = Math.min(res.min, lines); res.max = Math.max(res.max, lines); res.words = Math.max(res.words, words);
      return;
    }
    const n = nodes[i], l = lines + 1;
    let w = words + countWords(n.text);
    const jump = next => {
      const s = pathStats(next, stack.concat(id));
      res.min = Math.min(res.min, l + s.min); res.max = Math.max(res.max, l + s.max); res.words = Math.max(res.words, w + s.words);
    };
    if (Array.isArray(n.choices) && n.choices.length) {
      w += n.choices.reduce((a, c) => a + countWords(c.text), 0);
      n.choices.forEach(c => (c.next ? jump(c.next) : walk(i + 1, l, w)));
    } else if (n.next) jump(n.next);
    else walk(i + 1, l, w);
  };
  walk(0, 0, 0);
  return res;
}

// ------------------------------------------------------------------ stops
const stops = ch.stops || [];
check(stops.length >= 3 && stops.length <= 4, 'stops needs 3-4 entries');
const usedDialogues = new Set();
stops.forEach((s, i) => {
  const label = `stop ${i} "${s.title}"`;
  check(typeof s.title === 'string' && s.title.length > 0, `${label}: title missing`);
  check(typeof s.at === 'number', `${label}: at missing`);
  if (i > 0) check(s.at > stops[i - 1].at, `${label}: stops must be sorted ascending`);
  check(D[s.dialogueId] !== undefined, `${label}: dialogueId "${s.dialogueId}" does not resolve`);
  const reach = reachable(s.dialogueId);
  reach.forEach(id => usedDialogues.add(id));
  const st = pathStats(s.dialogueId, []);
  check(st.min >= 2 && st.max <= 6, `${label}: dialogue must be 2-6 lines (got ${st.min}-${st.max})`);
  check(st.words <= MAX_WORDS_PER_STOP, `${label}: up to ${st.words} words, over ${MAX_WORDS_PER_STOP} (15 s of reading)`);
  check(s.landmark && typeof s.landmark.x === 'number' && typeof s.landmark.build === 'function', `${label}: landmark needs x and build`);
  if (!s.landmark || !s.landmark.build) return;
  newEachCall(label, s.landmark.build);
  const r = inspect(`${label} landmark`, s.landmark.build(), 25);
  if (!r.ok) return;
  const m = Math.max(r.size.x, r.size.y, r.size.z);
  check(m >= 3 && m <= 8, `${label}: landmark should be a 3-8m set piece (max dim ${fmt(m)})`);
  if (s.landmark.x < 0) check(s.landmark.x + r.box.max.x <= -3, `${label}: landmark intrudes on road`);
  else check(s.landmark.x + r.box.min.x >= 3, `${label}: landmark intrudes on road`);
  const speakers = new Set();
  reach.forEach(id => D[id].forEach(n => { if (n.speaker !== 'Jensen') speakers.add(n.speaker); }));
  check(r.people >= speakers.size, `${label}: landmark shows ${r.people} people for ${speakers.size} speakers`);
  report.push(`${label.padEnd(30)} ${fmt(r.size.x)} x ${fmt(r.size.y)} x ${fmt(r.size.z)} meshes ${r.meshes} people ${r.people} words ${st.words}`);
});
if (stops.length) {
  check(stops[0].at >= 150, 'first stop must be at >= 150');
  const last = stops[stops.length - 1];
  check(last.at === ch.length, 'last stop must be at == length');
  // exactly one choice node across the last stop's dialogue and everything it branches to
  const choiceNodes = [];
  reachable(last.dialogueId).forEach(id => D[id].forEach(n => { if (Array.isArray(n.choices) && n.choices.length) choiceNodes.push(n); }));
  check(choiceNodes.length === 1, `last stop must contain exactly one choice node (found ${choiceNodes.length})`);
  if (choiceNodes.length === 1) {
    const cs = choiceNodes[0].choices;
    check(cs.length === 2, 'final choice must have exactly 2 options');
    if (cs.length === 2) {
      const a = cs[0].effects || {}, b = cs[1].effects || {};
      const atLeast = (x, y) => METERS.every(k => (x[k] || 0) >= (y[k] || 0));
      check(!atLeast(a, b) && !atLeast(b, a), 'final choice: one option is at least as good on every meter');
      check(cs.map(c => c.text).join('|') === 'Log off|Post through it', 'final choice must be "Log off" vs "Post through it"');
    }
  }
  stops.slice(0, -1).forEach(s => reachable(s.dialogueId).forEach(id => D[id].forEach(n =>
    check(!n.choices || !n.choices.length, `stop "${s.title}": only the last stop may have a choice`))));
}
Object.keys(D).forEach(id => check(usedDialogues.has(id), `dialogue ${id} is never reached from a stop`));

// ------------------------------------------------------------------ twist smoke test
function makeGame(hearts) {
  const said = [];
  const game = {
    hero: { lane: 0, y: 0 }, distance: 0, speed: 15, time: 0, state: {}, said, failed: null,
    meters: { stock: 50, board: 50, washington: 50, beijing: 50 },
    say(text) { said.push(text); },
    hurt() { if (typeof this.hero.hearts === 'number') this.hero.hearts -= 1; },
    addCollect(n) { this.collected = (this.collected || 0) + n; },
    spawn() {},
    fail(reason) { this.failed = reason; },
  };
  if (hearts !== undefined) game.hero.hearts = hearts;
  return game;
}
function run(game, seconds) {
  const dt = 1 / 60;
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    game.time += dt;
    game.distance += game.speed * dt;
    ch.onUpdate(game, dt);
  }
}
const near = (a, b, tol) => Math.abs(a - b) <= Math.abs(b) * tol;
const P = ch.mechanic.params;
const realNow = Date.now;
const games = [];
try {
  check(P.hookTimeoutMs > 0, 'twist: params.hookTimeoutMs must be set');
  const g = makeGame(3);
  games.push(g);
  const plainHurt = g.hurt;
  ch.onStart(g);
  const v = () => g.state.viral.views;
  check(v() === P.startViews, 'twist: views must start at startViews');
  run(g, 10);
  check(near(v(), P.startViews * Math.exp(P.growthPerSecond * 10), 0.005), `twist: 10s growth wrong (${v()})`);

  let before = v();
  const saidBeforeHit = g.said.length;
  g.hurt(); // engine-reported hit through game.hurt()
  const hitLine = g.said[saidBeforeHit] || '';
  ch.onUpdate(g, 0); // refresh the label without growth
  const shown = g.state.viral.label.replace(/^VIEWS /, '');
  check(hitLine.includes('now ' + shown), `twist: hit line must show the new count ${shown} ("${hitLine}")`);
  run(g, 1 / 60);
  check(g.state.viral.hits === 1, 'twist: hurt() must count as exactly one hit');
  check(g.meters.stock === 50 - P.hitStockCost, `twist: hit must cost ${P.hitStockCost} stock`);
  check(v() > before * P.hitMultiplier, 'twist: hit must multiply views');

  before = v();
  g.hero.hearts -= 1; // engine-side heart loss without hurt()
  run(g, 1 / 60);
  check(g.state.viral.hits === 2 && g.meters.stock === 50 - 2 * P.hitStockCost, 'twist: heart loss must count as a hit');
  check(v() > before * P.hitMultiplier, 'twist: second hit must multiply views');

  g.addCollect(10); // routed through addCollect
  check(g.state.viral.tokens === 10, 'twist: addCollect must add context tokens');
  before = v();
  run(g, 1);
  const halfRate = P.growthPerSecond / (1 + P.slowdownPerToken * 10);
  check(near(v() / before, Math.exp(halfRate), 0.005), 'twist: 10 tokens must slow growth to the documented rate');
  g.collected += 5; // engine-side counter bump without addCollect
  run(g, 1 / 60);
  check(g.state.viral.tokens === 15, 'twist: collected counter must add tokens without double counting');

  check(g.said.some(s => /^100K views/.test(s)), 'twist: 100K milestone line expected');
  g.distance = ch.length;
  run(g, 1 / 60);
  const final = v();
  run(g, 2);
  check(v() === final, 'twist: views must freeze at the finish');
  check(g.hurt === plainHurt, 'twist: engine functions must be restored at the finish');
  g.hurt();
  check(g.meters.stock === 50 - 2 * P.hitStockCost, 'twist: hits after the finish must not cost stock');
  const full = String(Math.round(final)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  check(ch.endCard.lines[0].includes(full), `twist: end card must report the final count (${full})`);
  check(g.failed === null, 'twist: must not fail the run');
  allTexts.push(...ch.endCard.lines);
  report.push(`twist: final ${full} views, hits ${g.state.viral.hits}, tokens ${g.state.viral.tokens}`);

  const g2 = makeGame(undefined); // engine without hearts: hurt() is the only hit signal
  games.push(g2);
  ch.onUpdate(g2, 1 / 60); // also works if onStart was never called
  g2.hurt();
  check(g2.state.viral.hits === 1, 'twist: hurt() must count a hit when hearts are not tracked');

  // The engine stops calling onUpdate short of the finish (quit, fail, clamp, next chapter keeps game.state).
  const g3 = makeGame(3);
  games.push(g3);
  const plainHurt3 = g3.hurt, plainCollect3 = g3.addCollect;
  ch.onStart(g3);
  run(g3, 5);
  check(g3.distance < ch.length, 'twist: stale test must stop short of the finish');
  const snap = { stock: g3.meters.stock, hits: g3.state.viral.hits, views: g3.state.viral.views,
    tokens: g3.state.viral.tokens, said: g3.said.length };
  const t0 = realNow();
  Date.now = () => t0 + 2 * P.hookTimeoutMs;
  g3.hurt();
  g3.addCollect(3);
  check(g3.meters.stock === snap.stock, 'twist: hurt() after updates stop must not cost stock');
  check(g3.state.viral.hits === snap.hits && g3.state.viral.views === snap.views, 'twist: hurt() after updates stop must not count');
  check(g3.state.viral.tokens === snap.tokens, 'twist: addCollect() after updates stop must not add tokens');
  check(g3.said.length === snap.said, 'twist: nothing may be said after updates stop');
  check(g3.hero.hearts === 2 && g3.collected === 3, 'twist: the engine functions must still run');
  check(g3.hurt === plainHurt3 && g3.addCollect === plainCollect3, 'twist: stale wrappers must hand back the engine functions');
  g3.hurt(); // a later chapter keeps hitting the same game object
  check(g3.meters.stock === snap.stock && g3.said.length === snap.said, 'twist: later hits must not touch ch6');

  // Updates resume (e.g. after a long story stop): counting starts again.
  const g4 = makeGame(undefined);
  games.push(g4);
  Date.now = realNow;
  ch.onStart(g4);
  run(g4, 1);
  Date.now = () => realNow() + 2 * P.hookTimeoutMs;
  g4.hurt();
  check(g4.state.viral.hits === 0 && g4.meters.stock === 50, 'twist: stale hurt() without hearts must not count');
  run(g4, 1 / 60);
  g4.hurt();
  check(g4.state.viral.hits === 1 && g4.meters.stock === 50 - P.hitStockCost, 'twist: hits must count again once updates resume');
} catch (e) {
  check(false, 'twist smoke test threw: ' + (e && e.stack));
} finally {
  Date.now = realNow;
}
games.forEach(g => {
  g.said.forEach(s => check(s.length <= 140, `twist: said line longer than 140 chars: "${s}"`));
  allTexts.push(...g.said);
});
allTexts.push(ch.mechanic.summary, ...P.milestoneLines, ...P.hitLines, ...P.endJokes.map(j => j.text), P.tokenLine);

// ------------------------------------------------------------------ tone guard
const BANNED = /\b(spy|spies|spying|espionage|smuggl\w*|leak\w*|sex\w*|affair)\b/i;
allTexts.forEach(s => check(!BANNED.test(s), `tone: "${s}" uses a banned word`));
check(warnings.length === 0, 'three.js warnings: ' + warnings.join(' | '));

// ------------------------------------------------------------------ result
console.warn = origWarn;
console.log(report.join('\n'));
if (failures.length) {
  console.log(`\nFAIL: ${failures.length} problem(s)`);
  failures.forEach(f => console.log(' - ' + f));
  process.exitCode = 1;
} else {
  console.log('\nOK: all checks passed');
}
