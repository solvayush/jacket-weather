/* Content checks for chapter.js. Run: node check.js */
'use strict';

const THREE = require('./three.min.js');
const makeChapter = require('./chapter.js');

// ---------------------------------------------------------------- stub kit

const texts = []; // every string drawn through kit.textPlane
let personCalls = 0;
const kit = {
  textPlane(text, opts = {}) {
    if (typeof text !== 'string' || !text.trim()) throw new Error('textPlane needs non-empty text');
    const m = new THREE.Mesh(new THREE.PlaneGeometry(opts.w || 1, opts.h || 0.3), new THREE.MeshBasicMaterial());
    m.userData.kit = true;
    m.userData.kitText = text;
    texts.push(text);
    return m;
  },
  person() {
    personCalls++;
    const g = new THREE.Group();
    g.userData.kitPerson = true;
    const add = (w, h, d, y) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial());
      m.position.y = y;
      m.userData.kit = true;
      g.add(m);
    };
    add(0.4, 0.9, 0.25, 0.45); // legs
    add(0.5, 0.6, 0.3, 1.2); // torso
    add(0.3, 0.3, 0.3, 1.65); // head, top at 1.8
    return g;
  },
};

// ---------------------------------------------------------------- reporting

const failures = [];
let passes = 0;
function check(cond, msg) {
  if (cond) passes++;
  else failures.push(msg);
}
const isNum = (v) => typeof v === 'number' && isFinite(v);
const isStr = (v) => typeof v === 'string' && v.trim().length > 0;
const isHex = (v) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const f2 = (v) => Math.round(v * 100) / 100;

function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function inspect(obj) {
  let meshes = 0;
  const mats = new Set();
  obj.traverse((o) => {
    if (o.isMesh) {
      meshes++;
      if (!o.userData.kit) mats.add(o.material);
    }
  });
  const box = new THREE.Box3().setFromObject(obj);
  const size = new THREE.Vector3();
  const centre = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(centre);
  return { meshes, mats, box, size, centre };
}

// Build twice, verify each call returns a fresh Group and return measurements of the first.
function built(label, fn, maxMeshes) {
  let a;
  let b;
  try {
    a = fn();
    b = fn();
  } catch (e) {
    check(false, `${label}: build() threw ${e.message}`);
    return null;
  }
  check(a instanceof THREE.Group, `${label}: build() must return a THREE.Group`);
  check(a !== b, `${label}: build() must return a NEW group each call`);
  if (!(a instanceof THREE.Group)) return null;
  const info = inspect(a);
  check(info.meshes >= 1 && info.meshes <= maxMeshes, `${label}: ${info.meshes} meshes (allowed 1-${maxMeshes})`);
  check(a.position.lengthSq() === 0, `${label}: group origin must not be offset`);
  return info;
}

// Texts of kit signs that a kit.person hides: the person stands in front of the sign (larger z)
// and overlaps it in x and y. The stub person is 0.5 m wide; 0.1 m per side allows for arms.
const ARMS = new THREE.Vector3(0.1, 0, 0);
function hiddenSigns(root) {
  root.updateMatrixWorld(true);
  const people = [];
  const signs = [];
  root.traverse((o) => {
    if (o.userData.kitPerson) people.push(new THREE.Box3().setFromObject(o).expandByVector(ARMS));
    if (o.userData.kitText) signs.push({ text: o.userData.kitText, box: new THREE.Box3().setFromObject(o) });
  });
  const hidden = [];
  for (const s of signs) {
    for (const p of people) {
      const inFront = p.max.z > s.box.max.z + 1e-3;
      const overlapX = Math.min(p.max.x, s.box.max.x) - Math.max(p.min.x, s.box.min.x);
      const overlapY = Math.min(p.max.y, s.box.max.y) - Math.max(p.min.y, s.box.min.y);
      if (inFront && overlapX > 0 && overlapY > 0) hidden.push(s.text);
    }
  }
  return hidden;
}

// ---------------------------------------------------------------- build chapter

let ch;
try {
  ch = makeChapter(THREE, kit);
} catch (e) {
  console.error('chapter factory threw:', e);
  process.exit(1);
}

// ---------------------------------------------------------------- required fields

check(ch.id === 'ch1', 'id must be ch1');
check(ch.title === 'Thirty Days Left', 'title must be "Thirty Days Left"');
check(ch.dateline === 'Sunnyvale, 1997', 'dateline must be "Sunnyvale, 1997"');
check(ch.outfit === 'young', "outfit must be 'young'");
check(ch.hideMeters === false, 'hideMeters must be false');
check(isNum(ch.length) && ch.length >= 700 && ch.length <= 900, 'length must be 700-900');
check(ch.speed && isNum(ch.speed.base) && isNum(ch.speed.max), 'speed.base/max required');
check(ch.speed.base >= 11 && ch.speed.max <= 20 && ch.speed.base <= ch.speed.max, 'speed must be within 11-20 and base <= max');
check(ch.speed.base === 11 && ch.speed.max === 15, 'chapter brief: speed 11-15');
check(ch.frontPage && isStr(ch.frontPage.headline) && isStr(ch.frontPage.sub), 'frontPage.headline/sub required');

const t = ch.theme || {};
for (const k of ['sky', 'fog', 'ground', 'road', 'laneLine', 'lightColor', 'ambient']) check(isHex(t[k]), `theme.${k} must be '#rrggbb'`);
check(isNum(t.fogNear) && isNum(t.fogFar) && t.fogNear < t.fogFar, 'theme.fogNear < fogFar required');
check(isNum(t.lightIntensity) && t.lightIntensity > 0, 'theme.lightIntensity required');

check(Array.isArray(ch.scenery) && ch.scenery.length >= 4 && ch.scenery.length <= 7, 'scenery: 4-7 kinds');
check(Array.isArray(ch.obstacles) && ch.obstacles.length >= 5 && ch.obstacles.length <= 7, 'obstacles: 5-7 kinds');
check(ch.collectible && isStr(ch.collectible.name) && typeof ch.collectible.build === 'function', 'collectible name/build required');
check(Array.isArray(ch.stops) && ch.stops.length >= 3 && ch.stops.length <= 4, 'stops: 3-4');
check(ch.dialogues && typeof ch.dialogues === 'object', 'dialogues required');
check(ch.mechanic && isStr(ch.mechanic.summary) && ch.mechanic.summary.length > 200, 'mechanic.summary must be a precise description');
check(ch.mechanic && ch.mechanic.params && typeof ch.mechanic.params === 'object', 'mechanic.params required');
check(ch.mechanic.params.startSeconds === 45 && ch.mechanic.params.perWafer === 1.5, 'brief: clock starts at 45 s, +1.5 s per wafer');
check(typeof ch.onStart === 'function' && typeof ch.onUpdate === 'function', 'onStart/onUpdate required');
check(ch.endCard && isStr(ch.endCard.title) && Array.isArray(ch.endCard.lines) && ch.endCard.lines.length > 0, 'endCard required');

const ids = new Set();
for (const list of [ch.scenery, ch.obstacles]) {
  for (const it of list) {
    check(isStr(it.id) && !ids.has(it.id), `duplicate or missing id: ${it.id}`);
    ids.add(it.id);
  }
}

// ---------------------------------------------------------------- stops

const stops = ch.stops;
for (let i = 0; i < stops.length; i++) {
  const s = stops[i];
  check(isNum(s.at) && isStr(s.title), `stop ${i}: at/title required`);
  check(s.landmark && isNum(s.landmark.x) && typeof s.landmark.build === 'function', `stop ${i}: landmark x/build required`);
  check(ch.dialogues[s.dialogueId] !== undefined, `stop ${i}: dialogueId "${s.dialogueId}" does not resolve`);
  if (i > 0) check(s.at > stops[i - 1].at, 'stops must be sorted by at');
}
check(stops[0].at >= 150, 'first stop must be at >= 150');
check(stops[stops.length - 1].at === ch.length, 'last stop must be at == length');
const wanted = ['accountant', 'lab bench', 'loading dock'];
check(wanted.every((w, i) => stops[i] && stops[i].title.toLowerCase().includes(w)), 'stops must be accountant desk, lab bench, loading dock');

// ---------------------------------------------------------------- dialogues

const METERS = ['stock', 'board', 'washington', 'beijing'];
const HERO = 'Jensen';
const D = ch.dialogues;
for (const [id, nodes] of Object.entries(D)) {
  check(Array.isArray(nodes) && nodes.length > 0, `dialogue ${id}: must be a non-empty array`);
  nodes.forEach((n, k) => {
    const where = `dialogue ${id}[${k}]`;
    check(isStr(n.speaker) && isStr(n.text), `${where}: speaker/text required`);
    check(typeof n.text === 'string' && n.text.length <= 140, `${where}: text longer than 140 chars`);
    if (n.next !== undefined) check(D[n.next] !== undefined, `${where}: next "${n.next}" does not resolve`);
    if (n.choices !== undefined) {
      check(Array.isArray(n.choices) && n.choices.length > 0, `${where}: choices must be a non-empty array`);
      check(k === nodes.length - 1, `${where}: a choice must be the last node of its dialogue`);
      for (const c of n.choices || []) {
        check(isStr(c.text) && c.text.length <= 140, `${where}: choice text missing or longer than 140 chars`);
        if (c.next !== undefined) check(D[c.next] !== undefined, `${where}: choice next "${c.next}" does not resolve`);
        for (const [m, v] of Object.entries(c.effects || {})) {
          check(METERS.includes(m), `${where}: unknown meter "${m}"`);
          check(isNum(v) && v >= -15 && v <= 15, `${where}: effect ${m}=${v} out of range -15..15`);
        }
      }
    }
  });
}

// Every path a player can take through a dialogue: [{ lines, words, speakers }].
function paths(id, seen = new Set()) {
  if (seen.has(id)) return [{ lines: Infinity, words: Infinity, speakers: new Set() }];
  const next = new Set(seen).add(id);
  let lines = 0;
  let words = 0;
  const speakers = new Set();
  for (const n of D[id] || []) {
    lines++;
    words += n.text.split(/\s+/).length;
    speakers.add(n.speaker);
    if (n.choices) {
      const out = [];
      const choiceWords = n.choices.reduce((s, c) => s + c.text.split(/\s+/).length, 0);
      for (const c of n.choices) {
        const tails = c.next ? paths(c.next, next) : [{ lines: 0, words: 0, speakers: new Set() }];
        for (const tl of tails) {
          out.push({ lines: lines + tl.lines, words: words + choiceWords + tl.words, speakers: new Set([...speakers, ...tl.speakers]) });
        }
      }
      return out;
    }
    if (n.next) {
      return paths(n.next, next).map((tl) => ({
        lines: lines + tl.lines,
        words: words + tl.words,
        speakers: new Set([...speakers, ...tl.speakers]),
      }));
    }
  }
  return [{ lines, words, speakers }];
}
function reachable(id, out = new Set()) {
  if (out.has(id) || !D[id]) return out;
  out.add(id);
  for (const n of D[id]) {
    if (n.next) reachable(n.next, out);
    for (const c of n.choices || []) if (c.next) reachable(c.next, out);
  }
  return out;
}

const used = new Set();
const stopSpeakers = [];
stops.forEach((s, i) => {
  if (!D[s.dialogueId]) return;
  reachable(s.dialogueId, used);
  const speakers = new Set();
  for (const p of paths(s.dialogueId)) {
    check(p.lines >= 2 && p.lines <= 6, `stop ${i}: a dialogue path has ${p.lines} lines (allowed 2-6)`);
    // ~240 words per minute: under 15 s to read.
    check(p.words <= 60, `stop ${i}: a dialogue path has ${p.words} words (max 60 to read in < 15 s)`);
    p.speakers.forEach((sp) => speakers.add(sp));
  }
  stopSpeakers[i] = [...speakers].filter((sp) => sp !== HERO);
});
for (const id of Object.keys(D)) check(used.has(id), `dialogue "${id}" is not reachable from any stop`);

const last = stops[stops.length - 1];
const lastNodes = [...reachable(last.dialogueId)].flatMap((id) => D[id]);
const choiceNodes = lastNodes.filter((n) => n.choices);
check(choiceNodes.length === 1, `last stop must contain exactly one choice node (found ${choiceNodes.length})`);
stops.slice(0, -1).forEach((s, i) => {
  const n = [...reachable(s.dialogueId)].flatMap((id) => D[id]).filter((x) => x.choices).length;
  check(n === 0, `stop ${i}: only the last stop has a choice (found ${n})`);
});
if (choiceNodes.length === 1) {
  const cs = choiceNodes[0].choices;
  check(cs.length === 2, `last stop choice must have exactly 2 options (found ${cs.length})`);
  if (cs.length === 2) {
    const v = (c, m) => (c.effects && isNum(c.effects[m]) ? c.effects[m] : 0);
    check(cs.every((c) => METERS.some((m) => v(c, m) !== 0)), 'each option must have meter effects');
    // Neither option may be at least as good on every meter (Pareto non-dominated).
    const dominates = (a, b) => METERS.every((m) => v(a, m) >= v(b, m));
    check(!dominates(cs[0], cs[1]) && !dominates(cs[1], cs[0]), 'one choice option dominates the other');
  }
}

// ---------------------------------------------------------------- geometry

const buildAll = [];

// Scenery
ch.scenery.forEach((s) => {
  const label = `scenery ${s.id}`;
  check(['left', 'right', 'both'].includes(s.side), `${label}: side must be left/right/both`);
  check(isNum(s.every) && s.every > 0, `${label}: every must be > 0`);
  check(isNum(s.offset) && s.offset >= 6, `${label}: offset must be >= 6`);
  check(typeof s.build === 'function', `${label}: build required`);
  for (let seed = 1; seed <= 25; seed++) {
    const info = built(`${label} (seed ${seed})`, () => s.build(seeded(seed)), 40);
    if (!info) continue;
    check(near(info.box.min.y, 0, 0.05), `${label} (seed ${seed}): must stand on y=0 (min y ${f2(info.box.min.y)})`);
    check(Math.abs(info.centre.x) <= 0.3 && Math.abs(info.centre.z) <= 0.3, `${label} (seed ${seed}): origin not at centre`);
    const reach = Math.max(Math.abs(info.box.min.x), Math.abs(info.box.max.x));
    check(s.offset - reach >= 3, `${label} (seed ${seed}): reaches the road (offset ${s.offset} - ${f2(reach)} < 3)`);
    check(info.size.y <= 22, `${label} (seed ${seed}): taller than 22 m`);
    const covered = hiddenSigns(s.build(seeded(seed)));
    check(covered.length === 0, `${label} (seed ${seed}): a person hides sign(s): ${covered.join(' | ')}`);
  }
  buildAll.push(() => s.build(seeded(7)));
});

// Obstacles
const LANE = 2;
const typesSeen = new Set();
const fitsLow = (sz) => sz.y <= 0.8 && sz.x <= 1.8;
const fitsBlock = (sz) => sz.y >= 1.5 && sz.x <= 1.8 && sz.x >= 1.2;
ch.obstacles.forEach((o) => {
  const label = `obstacle ${o.id}`;
  check(['low', 'high', 'block', 'mover'].includes(o.type), `${label}: bad type ${o.type}`);
  check(isNum(o.weight) && o.weight > 0, `${label}: weight must be > 0`);
  check(o.size && isNum(o.size.w) && isNum(o.size.h) && isNum(o.size.d), `${label}: size {w,h,d} required`);
  typesSeen.add(o.type);
  const info = built(label, () => o.build(), 25);
  buildAll.push(() => o.build());
  if (!info) return;
  const { box, size: sz, centre } = info;
  const dims = `w ${f2(sz.x)} h ${f2(box.max.y)} d ${f2(sz.z)}, min y ${f2(box.min.y)}`;
  check(Math.abs(centre.x) <= 0.05 && Math.abs(centre.z) <= 0.05, `${label}: origin not at centre (${f2(centre.x)}, ${f2(centre.z)})`);
  check(sz.x <= LANE + 0.1, `${label}: wider than one lane (${dims})`);
  if (o.type === 'low') {
    check(near(box.min.y, 0, 0.02), `${label}: low must sit on the ground (${dims})`);
    check(fitsLow(sz), `${label}: low needs h <= 0.8, w <= 1.8 (${dims})`);
  } else if (o.type === 'block') {
    check(near(box.min.y, 0, 0.02), `${label}: block must sit on the ground (${dims})`);
    check(fitsBlock(sz), `${label}: block needs h >= 1.5, 1.2 <= w <= 1.8 (${dims})`);
  } else if (o.type === 'high') {
    check(box.min.y >= 1.1, `${label}: high underside must be >= 1.1 (${dims})`);
    check(sz.x >= 1.5 && sz.x <= 2.1, `${label}: high must span one lane, 1.5-2.1 m (${dims})`);
    check(box.max.y <= 3.5, `${label}: high is too tall (${dims})`);
  } else if (o.type === 'mover') {
    check(near(box.min.y, 0, 0.02), `${label}: mover must sit on the ground (${dims})`);
    check(fitsLow(sz) || fitsBlock(sz), `${label}: mover must be low- or block-sized (${dims})`);
  }
  if (o.size) {
    const ok = near(o.size.w, sz.x, 0.05) && near(o.size.h, box.max.y, 0.05) && near(o.size.d, sz.z, 0.05);
    check(ok, `${label}: declared size ${JSON.stringify(o.size)} differs from measured (${dims})`);
  }
});
for (const ty of ['low', 'high', 'block', 'mover']) check(typesSeen.has(ty), `need at least one '${ty}' obstacle`);

// Collectible
{
  const info = built('collectible', () => ch.collectible.build(), 25);
  buildAll.push(() => ch.collectible.build());
  if (info) {
    const big = Math.max(info.size.x, info.size.y, info.size.z);
    check(big >= 0.3 && big <= 0.8, `collectible: should be about 0.5 m (largest side ${f2(big)})`);
    check(info.box.min.y >= 0 && info.box.max.y <= 1.6, 'collectible: must be reachable between the ground and jump peak');
    check(Math.abs(info.centre.x) <= 0.05 && Math.abs(info.centre.z) <= 0.05, 'collectible: origin not at centre');
  }
}

// Landmarks
stops.forEach((s, i) => {
  const label = `landmark ${i} (${s.title})`;
  personCalls = 0;
  const info = built(label, () => s.landmark.build(), 25);
  const people = personCalls / 2; // built() builds twice
  buildAll.push(() => s.landmark.build());
  if (!info) return;
  const big = Math.max(info.size.x, info.size.y, info.size.z);
  check(big >= 3 && big <= 8, `${label}: should be 3-8 m (largest side ${f2(big)})`);
  check(near(info.box.min.y, 0, 0.05), `${label}: must stand on y=0`);
  check(Math.abs(info.centre.x) <= 0.3 && Math.abs(info.centre.z) <= 0.3, `${label}: origin not at centre`);
  const reach = Math.max(Math.abs(info.box.min.x), Math.abs(info.box.max.x));
  check(Math.abs(s.landmark.x) - reach >= 3, `${label}: intrudes on the road (|x| ${s.landmark.x} - ${f2(reach)} < 3)`);
  const cast = stopSpeakers[i] || [];
  check(people >= Math.max(1, cast.length), `${label}: ${people} people but dialogue cast is ${cast.join(', ')}`);
  const covered = hiddenSigns(s.landmark.build());
  check(covered.length === 0, `${label}: a person hides sign(s): ${covered.join(' | ')}`);
});

// Materials must be shared: a second round of builds may not introduce new non-kit materials.
const firstMats = new Set();
buildAll.forEach((fn) => inspect(fn()).mats.forEach((m) => firstMats.add(m)));
let fresh = 0;
buildAll.forEach((fn) => inspect(fn()).mats.forEach((m) => !firstMats.has(m) && fresh++));
check(fresh === 0, `${fresh} materials created per build; share materials via factory variables`);
firstMats.forEach((m) => check(m.isMeshLambertMaterial, `non-Lambert material used: ${m.type}`));

// ---------------------------------------------------------------- tone guard

const allText = [
  ...texts,
  ch.frontPage.headline,
  ch.frontPage.sub,
  ch.endCard.title,
  ...ch.endCard.lines,
  ...Object.values(D).flatMap((ns) => ns.flatMap((n) => [n.text, ...(n.choices || []).map((c) => c.text)])),
];
const banned = /\b(spy|spies|spying|smuggl\w*|leak\w*|espionage|wife|kids?|children|daughter|son)\b/i;
allText.forEach((s) => check(!banned.test(s), `tone: "${s}" touches a forbidden topic`));

// ---------------------------------------------------------------- mechanic simulation

function fakeGame() {
  return {
    hero: { lane: 0, y: 0, hearts: 3 },
    distance: 0,
    speed: 11,
    meters: { stock: 50, board: 50, washington: 50, beijing: 50 },
    state: {},
    time: 0,
    collected: 0,
    said: [],
    spawned: [],
    fails: [],
    say(text) {
      this.said.push(text);
    },
    hurt() {},
    addCollect(n) {
      this.collected += n;
    },
    spawn(o) {
      this.spawned.push(o);
    },
    fail(reason) {
      this.fails.push(reason);
    },
  };
}
const DT = 1 / 60;
function run(game, chapter, seconds, speed, onFrame) {
  for (let f = 0; f < Math.round(seconds / DT); f++) {
    game.distance = Math.min(chapter.length, game.distance + speed * DT);
    game.time += DT;
    if (onFrame) onFrame(game);
    chapter.onUpdate(game, DT);
  }
}

try {
  // 1. No wafers at 13 m/s: fails once at ~45 s of running, display starts at 30.
  {
    const c = makeChapter(THREE, kit);
    const g = fakeGame();
    c.onStart(g);
    check(g.state.cashDays === 30 && /DAYS OF CASH LEFT: 30/.test(g.state.hud), 'sim: display must start at 30 days');
    let failAt = null;
    for (let f = 0; f < 60 * 70 && failAt === null; f++) {
      g.distance += 13 * DT;
      c.onUpdate(g, DT);
      if (g.fails.length) failAt = (f + 1) * DT;
    }
    check(failAt !== null && near(failAt, 45, 0.1), `sim: with no wafers the run should fail at ~45 s (got ${failAt})`);
    run(g, c, 1, 13);
    check(g.fails.length === 1, 'sim: game.fail must be called exactly once per attempt');
    // Restart from the lab bench stop (reached at 500 m with ~6.5 s left): clock is raised to 30 s.
    g.distance = 500;
    c.onStart(g);
    check(near(g.state.cashSeconds, 30, 1e-6), `sim: restart from a stop must give >= 30 s (got ${g.state.cashSeconds})`);
    run(g, c, 300 / 11 + 1, 11);
    check(g.fails.length === 1, 'sim: a restarted 300 m leg at 11 m/s must be finishable with no wafers');
  }
  // 2. Clock freezes while not moving; each wafer adds exactly 1.5 s.
  {
    const c = makeChapter(THREE, kit);
    const g = fakeGame();
    c.onStart(g);
    run(g, c, 10, 0);
    check(near(g.state.cashSeconds, 45, 1e-9), 'sim: clock must not drain while the hero is stopped');
    g.addCollect(1);
    c.onUpdate(g, 0);
    check(near(g.state.cashSeconds, 46.5, 1e-9), `sim: a wafer must add 1.5 s (got ${g.state.cashSeconds})`);
    check(g.state.cashDays === 31, 'sim: a wafer must add one day');
    // Engine that only bumps a counter (no addCollect call): still credited once per wafer.
    g.collected += 2;
    c.onUpdate(g, 0);
    check(near(g.state.cashSeconds, 49.5, 1e-9), 'sim: counter-only pickups must be credited once each');
  }
  // 3. Full run at base speed, pausing at each stop, collecting only the chapter's guaranteed wafers.
  {
    const c = makeChapter(THREE, kit);
    const g = fakeGame();
    c.onStart(g);
    let taken = 0;
    const pickUp = (game) => {
      while (taken < game.spawned.length && -game.spawned[taken].z <= game.distance) {
        game.addCollect(1);
        taken++;
      }
    };
    for (const s of c.stops) {
      while (g.distance < s.at) run(g, c, DT, 11, pickUp);
      run(g, c, 5, 0); // dialogue
    }
    check(g.fails.length === 0, 'sim: a run that collects the guaranteed wafers must not fail');
    check(g.spawned.length === 38, `sim: expected 38 guaranteed wafers (got ${g.spawned.length})`);
    check(g.spawned.every((o) => [-1, 0, 1].includes(o.lane) && o.z < 0 && o.kind === 'collectible'), 'sim: bad spawn data');
    const left = g.state.cashSeconds;
    run(g, c, 5, 11);
    check(g.state.cashSeconds === left, 'sim: clock must freeze after the finish');
  }
  // 4. Robustness: bare game object without optional functions, rewind without onStart.
  {
    const c = makeChapter(THREE, kit);
    const g = { distance: 0 };
    c.onUpdate(g, DT);
    g.distance = 300;
    c.onUpdate(g, DT);
    g.distance = 220;
    c.onUpdate(g, DT);
    check(g.state && g.state.cashSeconds >= 30, 'sim: rewind without onStart must restore the clock');
  }
} catch (e) {
  check(false, `sim: onStart/onUpdate threw ${e.stack}`);
}

// 5. Read-only engine objects must not stop the chapter, and wafers must still count.
try {
  {
    // Non-writable addCollect: the hook cannot be installed, the counter must credit the wafer.
    const c = makeChapter(THREE, kit);
    const g = fakeGame();
    Object.defineProperty(g, 'addCollect', { value: g.addCollect, writable: false, enumerable: true });
    c.onStart(g);
    g.addCollect(1);
    c.onUpdate(g, 0);
    check(near(g.state.cashSeconds, 46.5, 1e-9), `sim: read-only addCollect: counter must credit a wafer (got ${g.state.cashSeconds})`);
    g.distance = 13;
    c.onUpdate(g, DT);
    check(g.state.cashSeconds < 46.5, 'sim: read-only addCollect: clock must still drain while running');
  }
  {
    // Frozen game object with a writable state object: HUD values still published.
    const c = makeChapter(THREE, kit);
    const g = Object.freeze({ distance: 0, state: {}, addCollect() {} });
    c.onStart(g);
    c.onUpdate(g, DT);
    check(g.state.cashDays === 30, 'sim: frozen game object: clock must still publish to game.state');
  }
  {
    // Frozen game object without state: nothing to publish to, but nothing may throw.
    const c = makeChapter(THREE, kit);
    const g = Object.freeze({ distance: 0, addCollect() {} });
    c.onStart(g);
    c.onUpdate(g, DT);
    check(g.state === undefined, 'sim: frozen game object without state must be left untouched');
  }
} catch (e) {
  check(false, `sim: a read-only game object made the chapter throw: ${e.stack}`);
}

// ---------------------------------------------------------------- report

if (failures.length) {
  console.error(`FAIL: ${failures.length} problem(s), ${passes} checks passed`);
  failures.forEach((f) => console.error(' - ' + f));
  process.exit(1);
}
console.log(`PASS: ${passes} checks`);
