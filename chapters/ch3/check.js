'use strict';
// Validates chapter.js against the chapter-module contract. Run: node check.js
const THREE = require('./three.min.js');

const warnings = [];
const realWarn = console.warn;
console.warn = (...args) => warnings.push(args.join(' '));

const failures = [];
let checks = 0;
function check(cond, msg) { checks++; if (!cond) failures.push(msg); return !!cond; }
const approx = (a, b, tol) => Math.abs(a - b) <= tol;
const isHex = v => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
const isStr = v => typeof v === 'string' && v.trim().length > 0;
const METERS = ['stock', 'board', 'washington', 'beijing'];
const HERO = 'Jensen';

// ---------- stub kit ----------
const kit = {
  textPlane(text, opts) {
    const o = opts || {};
    check(isStr(text), 'kit.textPlane called without text');
    check(o.w > 0 && o.h > 0, `kit.textPlane("${text}") needs positive w and h`);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(o.w || 1, o.h || 0.5), new THREE.MeshBasicMaterial({ color: o.bg || '#ffffff' }));
    mesh.userData.kit = 'textPlane';
    return mesh;
  },
  person(look) {
    check(look && typeof look === 'object', 'kit.person called without a look object');
    const g = new THREE.Group();
    g.userData.kit = 'person';
    const mat = new THREE.MeshLambertMaterial({ color: '#888888' });
    const part = (w, h, d, x, y) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, 0); g.add(m); };
    part(0.18, 0.85, 0.2, -0.12, 0.425); part(0.18, 0.85, 0.2, 0.12, 0.425); // legs
    part(0.5, 0.6, 0.28, 0, 1.15); // torso
    part(0.14, 0.6, 0.16, -0.33, 1.15); part(0.14, 0.6, 0.16, 0.33, 1.15); // arms
    part(0.3, 0.35, 0.3, 0, 1.625); // head, top at 1.8 m
    return g;
  }
};
function mulberry32(seed) {
  return function () {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function fromKit(o) { for (let p = o; p; p = p.parent) if (p.userData && p.userData.kit) return true; return false; }

// Build an object, check it is a fresh Group of Lambert meshes, and measure it.
function inspect(label, build, args, maxMeshes) {
  let obj, again;
  try { obj = build(...args); again = build(...args); } catch (e) { check(false, `${label}: build() threw ${e.stack}`); return null; }
  if (!check(obj && obj.isGroup, `${label}: build() must return a THREE.Group`)) return null;
  check(obj !== again && obj.children[0] !== again.children[0], `${label}: build() must return a new Group each call`);
  let meshes = 0, persons = 0;
  const bad = new Set();
  obj.traverse(o => {
    if (o.userData.kit === 'person') persons++;
    if (!o.isMesh) return;
    meshes++;
    if (fromKit(o)) return;
    for (const m of [].concat(o.material)) {
      if (!m.isMeshLambertMaterial) bad.add('non-Lambert material');
      if (m.map) bad.add('image texture');
    }
  });
  check(meshes >= 1 && meshes <= maxMeshes, `${label}: ${meshes} meshes (allowed 1-${maxMeshes})`);
  check(bad.size === 0, `${label}: ${[...bad].join(', ')}`);
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3()), centre = box.getCenter(new THREE.Vector3());
  check(!box.isEmpty() && [size.x, size.y, size.z].every(Number.isFinite), `${label}: empty or non-finite bounds`);
  check(approx(centre.x, 0, 0.05) && approx(centre.z, 0, 0.05), `${label}: origin not at footprint centre (${centre.x.toFixed(2)}, ${centre.z.toFixed(2)})`);
  return { obj, box, size, meshes, persons };
}

// Fraction of the object's width that is solid at height y (union of mesh x-extents that cross y).
function solidFraction(obj, y, width) {
  obj.updateMatrixWorld(true);
  const spans = [];
  obj.traverse(o => {
    if (!o.isMesh) return;
    const b = new THREE.Box3().setFromObject(o);
    if (b.min.y <= y && b.max.y >= y) spans.push([b.min.x, b.max.x]);
  });
  spans.sort((a, b) => a[0] - b[0]);
  let covered = 0, end = -Infinity;
  for (const [a, b] of spans) {
    if (b <= end) continue;
    covered += b - Math.max(a, end);
    end = b;
  }
  return covered / width;
}

// ---------- dialogue traversal ----------
function walk(dialogues, startId) {
  const paths = [], choiceNodes = new Set(), errors = [];
  (function go(id, start, acc, depth) {
    const list = dialogues[id];
    if (!Array.isArray(list)) { errors.push(`next "${id}" does not resolve`); return; }
    if (depth > 20) { errors.push(`dialogue loop through "${id}"`); return; }
    for (let i = start; i < list.length; i++) {
      const node = list[i];
      acc = acc.concat([node]);
      if (Array.isArray(node.choices) && node.choices.length) {
        choiceNodes.add(node);
        for (const c of node.choices) c.next !== undefined ? go(c.next, 0, acc, depth + 1) : go(id, i + 1, acc, depth + 1);
        return;
      }
      if (node.next !== undefined) { go(node.next, 0, acc, depth + 1); return; }
    }
    paths.push(acc);
  })(startId, 0, [], 0);
  return { paths, choiceNodes, errors };
}
const words = s => (s.match(/\S+/g) || []).length;

// ---------- load ----------
let ch;
try { ch = require('./chapter.js')(THREE, kit); } catch (e) { console.error('chapter.js failed to load:\n' + e.stack); process.exit(1); }

// ---------- top-level fields ----------
check(ch.id === 'ch3', 'id must be "ch3"');
check(ch.title === 'Kimi Panic', 'title must be "Kimi Panic"');
check(ch.dateline === 'Wall Street, July 2026', 'dateline mismatch');
check(ch.outfit === 'jacket', 'outfit must be "jacket"');
check(ch.hideMeters === false, 'hideMeters must be false');
check(Number.isFinite(ch.length) && ch.length >= 700 && ch.length <= 900, 'length must be 700-900');
check(ch.speed && ch.speed.base === 13 && ch.speed.max === 17, 'speed must be { base: 13, max: 17 }');
check(ch.speed && ch.speed.base >= 11 && ch.speed.max <= 20 && ch.speed.base <= ch.speed.max, 'speed outside 11-20 m/s');
check(ch.frontPage && isStr(ch.frontPage.headline) && isStr(ch.frontPage.sub), 'frontPage needs headline and sub');
const t = ch.theme || {};
for (const k of ['sky', 'fog', 'ground', 'road', 'laneLine', 'lightColor', 'ambient']) check(isHex(t[k]), `theme.${k} must be a #rrggbb string`);
check(t.fogNear >= 0 && t.fogFar > t.fogNear, 'theme fogNear/fogFar invalid');
check(t.lightIntensity > 0, 'theme.lightIntensity must be > 0');
check(ch.mechanic && isStr(ch.mechanic.summary) && ch.mechanic.summary.length >= 100, 'mechanic.summary missing or too short');
check(ch.mechanic && ch.mechanic.params && typeof ch.mechanic.params === 'object', 'mechanic.params missing');
check(typeof ch.onStart === 'function' && typeof ch.onUpdate === 'function', 'onStart/onUpdate must be functions');
check(ch.endCard && isStr(ch.endCard.title) && Array.isArray(ch.endCard.lines) && ch.endCard.lines.length > 0 && ch.endCard.lines.every(isStr), 'endCard needs title and lines');

// ---------- scenery ----------
const scenery = ch.scenery || [];
check(scenery.length >= 4 && scenery.length <= 7, `scenery needs 4-7 kinds, got ${scenery.length}`);
check(new Set(scenery.map(s => s.id)).size === scenery.length, 'scenery ids must be unique');
for (const s of scenery) {
  const label = `scenery ${s.id}`;
  check(isStr(s.id) && ['left', 'right', 'both'].includes(s.side), `${label}: bad id or side`);
  check(s.every > 0 && s.offset >= 6, `${label}: every must be > 0 and offset >= 6`);
  for (let seed = 1; seed <= 25; seed++) {
    const r = inspect(`${label} (seed ${seed})`, s.build, [mulberry32(seed)], 40);
    if (!r) break;
    check(approx(r.box.min.y, 0, 0.02), `${label}: must stand on the ground (min y ${r.box.min.y.toFixed(2)})`);
    check(s.offset - r.size.x / 2 >= 3, `${label}: intrudes onto the road (inner edge ${(s.offset - r.size.x / 2).toFixed(2)} m)`);
  }
}

// ---------- obstacles ----------
const obstacles = ch.obstacles || [];
check(obstacles.length >= 5 && obstacles.length <= 7, `obstacles needs 5-7 kinds, got ${obstacles.length}`);
check(new Set(obstacles.map(o => o.id)).size === obstacles.length, 'obstacle ids must be unique');
for (const type of ['low', 'high', 'block', 'mover']) check(obstacles.some(o => o.type === type), `no obstacle of type ${type}`);
for (const o of obstacles) {
  const label = `obstacle ${o.id} (${o.type})`;
  check(isStr(o.id) && ['low', 'high', 'block', 'mover'].includes(o.type) && o.weight > 0, `${label}: bad id, type or weight`);
  const sz = o.size || {};
  if (!check(sz.w > 0 && sz.h > 0 && sz.d > 0, `${label}: size needs positive w, h, d`)) continue;
  const r = inspect(label, o.build, [], 25);
  if (!r) continue;
  const w = r.size.x, top = r.box.max.y, bottom = r.box.min.y;
  check(approx(sz.w, w, 0.05) && approx(sz.h, top, 0.05) && approx(sz.d, r.size.z, 0.05),
    `${label}: declared size ${JSON.stringify(sz)} != measured w ${w.toFixed(2)} h ${top.toFixed(2)} d ${r.size.z.toFixed(2)}`);
  const onGround = approx(bottom, 0, 0.02);
  const isLow = onGround && top <= 0.8 && w <= 1.8;
  const isBlock = onGround && top >= 1.5 && w <= 1.8 && w >= 1.0;
  const dims = `w ${w.toFixed(2)}, y ${bottom.toFixed(2)}..${top.toFixed(2)}`;
  if (o.type === 'low') check(isLow, `${label}: low needs ground contact, h <= 0.8, w <= 1.8 (${dims})`);
  if (o.type === 'block') check(isBlock, `${label}: block needs ground contact, h >= 1.5, 1.0 <= w <= 1.8 (${dims})`);
  if (o.type === 'mover') check(isLow || isBlock, `${label}: mover must be low- or block-sized (${dims})`);
  if (o.type === 'block' || (o.type === 'mover' && isBlock)) {
    // A block must read as a wall: an open gap near the ground looks like a 'high' slide-under.
    const thin = [];
    for (let i = 0; 0.2 + i * 0.1 <= Math.min(1.5, top) - 0.05 + 1e-9; i++) {
      const y = 0.2 + i * 0.1;
      if (solidFraction(r.obj, y, w) < 0.6) thin.push(y.toFixed(1));
    }
    check(thin.length === 0, `${label}: under 60% solid across its width at y = ${thin.join(', ')} m (reads like a slide-under)`);
  }
  if (o.type === 'high') {
    check(bottom >= 1.1, `${label}: underside must be >= 1.1 m (${dims})`);
    check(w >= 1.5 && w <= 2.0, `${label}: must span one lane, 1.5-2.0 m wide (${dims})`);
    if (o.clearance !== undefined) check(o.clearance >= 1.1 && approx(o.clearance, bottom, 0.05), `${label}: clearance does not match underside`);
  }
}

// ---------- collectible ----------
const col = ch.collectible || {};
check(isStr(col.name) && typeof col.build === 'function', 'collectible needs name and build');
if (typeof col.build === 'function') {
  const r = inspect('collectible', col.build, [], 25);
  if (r) {
    const maxDim = Math.max(r.size.x, r.size.y, r.size.z);
    check(maxDim >= 0.3 && maxDim <= 0.8, `collectible should be about 0.5 m (max dim ${maxDim.toFixed(2)})`);
    check(r.box.min.y >= 0 && r.box.min.y < 1.8, 'collectible must float within reach of a running hero');
  }
}

// ---------- dialogues ----------
const dialogues = ch.dialogues || {};
for (const [id, list] of Object.entries(dialogues)) {
  if (!check(Array.isArray(list) && list.length > 0, `dialogue ${id} must be a non-empty array`)) continue;
  list.forEach((node, i) => {
    const label = `dialogue ${id}[${i}]`;
    check(isStr(node.speaker) && isStr(node.text), `${label}: needs speaker and text`);
    check(isStr(node.text) && node.text.length <= 140, `${label}: text longer than 140 chars`);
    if (node.next !== undefined) check(Array.isArray(dialogues[node.next]), `${label}: next "${node.next}" does not resolve`);
    if (node.choices !== undefined) {
      check(Array.isArray(node.choices) && node.choices.length >= 2, `${label}: choices needs at least 2 options`);
      for (const c of [].concat(node.choices)) {
        check(isStr(c.text) && c.text.length <= 140, `${label}: choice text missing or longer than 140 chars`);
        if (c.next !== undefined) check(Array.isArray(dialogues[c.next]), `${label}: choice next "${c.next}" does not resolve`);
        for (const [k, v] of Object.entries(c.effects || {})) {
          check(METERS.includes(k), `${label}: unknown meter "${k}"`);
          check(Number.isFinite(v) && v >= -15 && v <= 15, `${label}: effect ${k}=${v} outside -15..15`);
        }
      }
    }
  });
}

// ---------- stops ----------
const stops = ch.stops || [];
check(stops.length >= 3 && stops.length <= 4, `stops needs 3-4 entries, got ${stops.length}`);
check(stops.every((s, i) => i === 0 || s.at > stops[i - 1].at), 'stops must be sorted by at');
check(stops.length > 0 && stops[0].at >= 150, 'first stop must be at >= 150 m');
check(stops.length > 0 && stops[stops.length - 1].at === ch.length, 'last stop must be at length');
stops.forEach((s, i) => {
  const label = `stop ${i} (${s.title})`;
  const isLast = i === stops.length - 1;
  check(isStr(s.title) && s.landmark && Number.isFinite(s.landmark.x) && typeof s.landmark.build === 'function', `${label}: needs title and landmark { x, build }`);
  if (!check(Array.isArray(dialogues[s.dialogueId]), `${label}: dialogueId "${s.dialogueId}" does not resolve`)) return;
  const { paths, choiceNodes, errors } = walk(dialogues, s.dialogueId);
  errors.forEach(e => check(false, `${label}: ${e}`));
  for (const p of paths) {
    const reading = p.reduce((n, node) => n + words(node.text) + (node.choices || []).reduce((m, c) => m + words(c.text), 0), 0);
    check(p.length >= 2 && p.length <= 6, `${label}: a dialogue path has ${p.length} lines (allowed 2-6)`);
    check(reading <= 55, `${label}: a dialogue path has ${reading} words, too long to read in 15 s`);
  }
  if (isLast) {
    check(choiceNodes.size === 1, `${label}: last stop needs exactly one choice node, found ${choiceNodes.size}`);
    for (const node of choiceNodes) {
      if (!check(node.choices.length === 2, `${label}: final choice must have exactly 2 options`)) continue;
      const [a, b] = node.choices.map(c => c.effects || {});
      check(Object.keys(a).length > 0 && Object.keys(b).length > 0, `${label}: both options need meter effects`);
      const ge = (x, y) => METERS.every(m => (x[m] || 0) >= (y[m] || 0));
      check(!ge(a, b) && !ge(b, a), `${label}: one option is at least as good on every meter`);
    }
  }
  if (typeof s.landmark.build !== 'function') return;
  const r = inspect(`${label} landmark`, s.landmark.build, [], 25);
  if (!r) return;
  const maxDim = Math.max(r.size.x, r.size.y, r.size.z);
  check(maxDim >= 3 && maxDim <= 8, `${label}: landmark should be 3-8 m (max dim ${maxDim.toFixed(2)})`);
  check(approx(r.box.min.y, 0, 0.02), `${label}: landmark must stand on the ground`);
  check(Math.abs(s.landmark.x) - r.size.x / 2 >= 3, `${label}: landmark intrudes onto the road`);
  const cast = new Set();
  walk(dialogues, s.dialogueId).paths.forEach(p => p.forEach(n => n.speaker !== HERO && cast.add(n.speaker)));
  check(r.persons >= cast.size, `${label}: landmark has ${r.persons} people for ${cast.size} speakers (${[...cast].join(', ')})`);
});

// ---------- mechanic simulation ----------
(function simulate() {
  const meters = { stock: 50, board: 50, washington: 50, beijing: 50 };
  const game = {
    hero: { lane: 0, y: 0, hearts: 3 }, distance: 0, speed: ch.speed.base, meters, state: {}, time: 0, said: [], collected: 0,
    say(line) { this.said.push(String(line)); }, hurt() {}, addCollect(n) { this.collected += n; }, spawn() {}, fail(r) { this.failed = r; },
    scene: { fog: new THREE.Fog(t.fog, t.fogNear, t.fogFar), background: new THREE.Color(t.sky) }
  };
  let topSpeed = 0;
  const run = (seconds, moving, accel) => {
    const dt = 1 / 60;
    for (let i = 0; i < Math.round(seconds * 60); i++) {
      game.time += dt;
      if (accel) game.speed = Math.min(game.speed + accel * dt, ch.speed.max); // engine-style ramp with clamp
      if (moving) game.distance += game.speed * dt;
      ch.onUpdate(game, dt);
      topSpeed = Math.max(topSpeed, game.speed);
    }
  };
  try {
    ch.onStart(game);
    ch.onStart(game); // a restart must not stack the cube wrapper
    const panic = () => game.state.panic;
    check(panic() === 0, 'mechanic: game.state.panic should start at 0');
    check(game.said.length > 0, 'mechanic: onStart should announce the panic meter');
    const fogBase = game.scene.fog.color.clone();

    run(10, true);
    check(approx(panic(), 40, 0.5), `mechanic: panic after 10 s running should be ~40, got ${panic()}`);
    check(approx(game.speed, ch.speed.base + 0.8, 0.05), `mechanic: speed at panic 40 should be ~${ch.speed.base + 0.8}, got ${game.speed}`);
    check(game.scene.fog.color.r > fogBase.r + 0.02, 'mechanic: panic should redden the fog');

    const before = panic();
    game.addCollect(1);
    check(approx(panic(), before - 12, 1e-6), `mechanic: one cube should lower panic by exactly 12, got ${before} -> ${panic()}`);
    check(game.collected === 1, 'mechanic: wrapped addCollect must still reach the engine');

    const atStop = panic();
    game.speed = 0; // engine halts the hero for a story stop
    run(5, false);
    check(approx(panic(), atStop, 1e-6), 'mechanic: panic must not rise during a stop (or a cube was counted twice)');
    check(game.speed === 0, `mechanic: no speed bonus while stopped, got ${game.speed}`);

    game.speed = ch.speed.base;
    const stock0 = meters.stock;
    run(30, true); // 28 -> fills after 18 s -> resets -> ~48
    check(meters.stock === stock0 - 10, `mechanic: one fill should cost exactly 10 stock, got ${stock0} -> ${meters.stock}`);
    check(approx(panic(), 48, 1), `mechanic: meter should reset to 0 when full, got ${panic()}`);
    check(game.said.some(l => /SELL-OFF/.test(l)), 'mechanic: a sell-off line should be shown');
    check(game.said.some(l => /75/.test(l)), 'mechanic: a 75% warning should be shown');

    run(20, true, 0.5);
    check(topSpeed <= ch.speed.max + 1e-9, `mechanic: speed exceeded speed.max (${topSpeed})`);
    check(approx(game.speed, ch.speed.max, 0.01), `mechanic: speed should settle at speed.max, got ${game.speed}`);
    check(meters.board === 50 && meters.washington === 50 && meters.beijing === 50, 'mechanic: only stock may change');
    check(game.failed === undefined, 'mechanic: the twist must never fail the run');
  } catch (e) {
    check(false, `mechanic: onStart/onUpdate threw ${e.stack}`);
  }
})();

// ---------- cube detection across engine styles ----------
// Each variant reports a pickup a different way. Every pickup must lower panic by exactly 12, once.
(function cubeDetection() {
  const freshGame = () => ({
    hero: { lane: 0, y: 0, hearts: 3 }, distance: 0, speed: ch.speed.base, time: 0, state: {},
    meters: { stock: 50, board: 50, washington: 50, beijing: 50 },
    say() {}, hurt() {}, spawn() {}, fail() {}
  });
  const tick = (g, seconds, moving) => {
    for (let i = 0; i < Math.round(seconds * 60); i++) {
      g.time += 1 / 60;
      if (moving) g.distance += g.speed / 60;
      ch.onUpdate(g, 1 / 60);
    }
  };
  const noop = () => {};
  const variants = [
    ['addCollect only, no counter', g => { g.addCollect = noop; }, g => g.addCollect(1)],
    ['addCollect() with no argument', g => { g.addCollect = noop; }, g => g.addCollect()],
    ['addCollect bumps game.collected', g => { g.collected = 0; g.addCollect = function (n) { this.collected += n; }; }, g => g.addCollect(1)],
    ['private pickup bumps game.collected, addCollect never called', g => { g.collected = 0; g.addCollect = noop; }, g => { g.collected += 1; }],
    ['private pickup, engine has no addCollect', g => { g.collected = 0; }, g => { g.collected += 1; }],
    ['addCollect, then game.collected bumped', g => { g.collected = 0; g.addCollect = noop; }, g => { g.addCollect(1); g.collected += 1; }],
    ['game.collected bumped, then addCollect', g => { g.collected = 0; g.addCollect = noop; }, g => { g.collected += 1; g.addCollect(1); }],
    ['private pickup bumps hero.collected', g => { g.hero.collected = 0; g.addCollect = noop; }, g => { g.hero.collected += 1; }]
  ];
  for (const [name, setup, pickup] of variants) {
    const g = freshGame();
    setup(g);
    try {
      ch.onStart(g);
      tick(g, 10, true);
      const start = g.state.panic;
      pickup(g);
      tick(g, 0.5, false);
      check(approx(g.state.panic, start - 12, 1e-6), `cubes [${name}]: first pickup should lower panic 12, got ${start} -> ${g.state.panic}`);
      pickup(g);
      tick(g, 2, false); // past any short-lived bookkeeping window
      check(approx(g.state.panic, start - 24, 1e-6), `cubes [${name}]: second pickup should lower panic 12 more, got ${start} -> ${g.state.panic}`);
    } catch (e) {
      check(false, `cubes [${name}]: threw ${e.stack}`);
    }
  }
})();

console.warn = realWarn;
check(warnings.length === 0, `three.js warnings: ${[...new Set(warnings)].join(' | ')}`);

if (failures.length) {
  console.error(`check.js: ${failures.length} of ${checks} checks FAILED`);
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log(`check.js: all ${checks} checks passed`);
