'use strict';
/*
 * Jacket Weather, chapter 7: "Capitol Hill".
 * Content module only: palette, scenery, obstacles, stops, dialogue and the
 * committee-door twist. The engine supplies THREE (r149) and kit.
 */
module.exports = function (THREE, kit) {
  const PI = Math.PI;
  const UP = new THREE.Vector3(0, 1, 0);
  const SPEED = { base: 15, max: 19 };

  // ---- Palette: cold marble morning, navy, crimson and Capitol gold ----
  const C = {
    marble: '#efe9dc', marbleWarm: '#f4efe4', marbleShade: '#d8d0bf', roof: '#b9b3a4',
    granite: '#8e9196', plinth: '#a7a49c', navy: '#1f2f6b', red: '#c8102e', white: '#f7f5ef',
    cream: '#fffdf3', gold: '#d4a83a', brass: '#c99a2e', mahogany: '#6b2f1d',
    mahoganyDark: '#4a2416', velvet: '#9b1b30', bronze: '#5f9e8c', bark: '#5a4636',
    ink: '#1b1b2f', steel: '#c9ccd1', tyre: '#222428', glass: '#20303f',
    parchment: '#f4d77a', lamp: '#1f3b2e', suit: '#23262f', pigeon: '#8a8f99'
  };
  const SKINS = ['#f1c9a5', '#e0ac7e', '#c68b5e', '#9a6440', '#6e4428'];
  const HAIRS = ['#2b1d14', '#5b3b22', '#1a1a1a', '#c9c2b8', '#b5813f'];
  const COATS = ['#e8562a', '#3ad1c4', '#ffd23f', '#8f6bff', '#ff4f9a', '#2f8f4e'];
  const PANTS = ['#2b2b33', '#3b4a63', '#4a3b2b'];
  const SIGN_BOARDS = ['#ff4f9a', '#ffd23f', '#3ad1c4', '#ff7a1a', '#8f6bff'];
  const LIVERIES = ['#e8562a', '#1fa3c9', '#d6266f', '#f2b705', '#4a3fb8'];

  const SLOGANS = [
    'MORE CORES', 'REGULATE MY TOASTER', 'FREE THE FRAMES', 'HONK IF YOU LOVE TENSORS',
    'MY GPU IS A SPACE HEATER', 'ASK ME ABOUT MY CACHE', 'FPS NOT FEARS', 'JACKETS FOR ALL',
    'BRING BACK FLOPPY DISKS', 'I CAME FOR THE COFFEE'
  ];
  const FRIEZES = [
    'OFFICE OF THE OFFICE', 'BUREAU OF MEETINGS', 'DEPT. OF FORMS', 'ANNEX OF THE ANNEX',
    'HALL OF SUBCOMMITTEES', 'OFFICE OF ACRONYMS'
  ];
  const PLAQUES = [
    'SOME FOUNDER, PROBABLY', 'INVENTOR OF THE MEMO', 'SPIRIT OF PAPERWORK',
    'HE YIELDED HIS TIME', 'UNKNOWN FILIBUSTERER'
  ];
  const CHANNELS = ['CHIP NEWS 24', 'WCHP LIVE', 'BREAKING-ISH', 'THE TICKER', 'NEWS AT NANO'];

  // ---- Shared materials and geometry ----
  const MATS = {};
  const GEOS = {};
  function mat(hex) {
    let m = MATS[hex];
    if (!m) {
      m = new THREE.MeshLambertMaterial({ color: hex });
      if (m.flatShading !== undefined) m.flatShading = true;
      MATS[hex] = m;
    }
    return m;
  }
  function cached(key, make) {
    return GEOS[key] || (GEOS[key] = make());
  }
  // Non-indexed geometry gets one normal per face, so curved parts look faceted.
  function facet(geometry) {
    const g = geometry.toNonIndexed();
    g.computeVertexNormals();
    return g;
  }
  const boxGeo = (w, h, d) => cached('b' + [w, h, d], () => new THREE.BoxGeometry(w, h, d));
  const cylGeo = (rt, rb, h, s) =>
    cached('c' + [rt, rb, h, s], () => facet(new THREE.CylinderGeometry(rt, rb, h, s)));
  const sphGeo = (r, s) =>
    cached('s' + [r, s], () => facet(new THREE.SphereGeometry(r, s, Math.max(4, s - 2))));
  const domeGeo = (r, s, hs) =>
    cached('d' + [r, s, hs], () => facet(new THREE.SphereGeometry(r, s, hs, 0, PI * 2, 0, PI / 2)));
  const coneGeo = (r, h, s) => cached('k' + [r, h, s], () => facet(new THREE.ConeGeometry(r, h, s)));
  const prismGeo = () => cached('prism', () => facet(new THREE.CylinderGeometry(1, 1, 1, 3)));

  function put(g, geometry, color, x, y, z) {
    const m = new THREE.Mesh(geometry, mat(color));
    m.position.set(x, y, z);
    g.add(m);
    return m;
  }
  // Box whose bottom sits at y0.
  function box(g, w, h, d, color, x, y0, z) {
    return put(g, boxGeo(w, h, d), color, x, y0 + h / 2, z);
  }
  // Upright cylinder whose bottom sits at y0.
  function cyl(g, r, h, color, x, y0, z, seg, rTop) {
    return put(g, cylGeo(rTop === undefined ? r : rTop, r, h, seg || 8), color, x, y0 + h / 2, z);
  }
  function ball(g, r, color, x, y, z, seg) {
    return put(g, sphGeo(r, seg || 8), color, x, y, z);
  }
  // Thin cylinder from point a to point b.
  function rod(g, ax, ay, az, bx, by, bz, r, color) {
    const dir = new THREE.Vector3(bx - ax, by - ay, bz - az);
    const m = put(g, cylGeo(r, r, 1, 6), color, (ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
    m.scale.y = dir.length();
    m.quaternion.setFromUnitVectors(UP, dir.normalize());
    return m;
  }
  // Triangular pediment of width w, height h, depth d, base at y0.
  function pediment(g, w, h, d, color, x, y0, z) {
    const m = put(g, prismGeo(), color, x, y0 + h / 3, z);
    m.rotation.x = -PI / 2;
    m.scale.set(w / Math.sqrt(3), d, h / 1.5);
    return m;
  }
  function sign(g, text, w, h, bg, fg, x, y, z, ry) {
    const m = kit.textPlane(text, { w, h, bg, fg });
    m.position.set(x, y, z);
    if (ry) m.rotation.y = ry;
    g.add(m);
    return m;
  }
  function human(g, opts, x, z, ry, y) {
    const p = kit.person(opts);
    p.position.set(x, y || 0, z);
    if (ry) p.rotation.y = ry;
    g.add(p);
    return p;
  }
  function rngOf(rng) {
    return typeof rng === 'function' ? rng : Math.random;
  }
  function pick(rng, list) {
    return list[Math.floor(rng() * list.length) % list.length];
  }
  function randomPerson(rng, accessories) {
    return {
      skin: pick(rng, SKINS), hair: pick(rng, HAIRS), top: pick(rng, COATS),
      bottom: pick(rng, PANTS), accessory: pick(rng, accessories)
    };
  }

  function bareTree(g, x, z) {
    cyl(g, 0.18, 3.0, C.bark, x, 0, z, 6, 0.12);
    rod(g, x, 2.0, z, x - 0.9, 3.4, z + 0.2, 0.07, C.bark);
    rod(g, x, 2.4, z, x + 0.8, 3.7, z - 0.3, 0.06, C.bark);
    rod(g, x, 2.8, z, x + 0.1, 4.1, z + 0.5, 0.05, C.bark);
  }

  // News van parked along the road: cab faces +Z, logo panels on the given sides (-1 left, 1 right).
  function newsTruck(g, livery, logo, logoSides) {
    box(g, 2.2, 2.3, 4.0, C.white, 0, 0.5, -0.8);
    box(g, 2.22, 0.5, 4.02, livery, 0, 1.2, -0.8);
    box(g, 2.1, 1.6, 1.4, livery, 0, 0.5, 1.9);
    box(g, 1.9, 0.6, 0.05, C.glass, 0, 1.35, 2.62);
    [[-1.05, 1.9], [1.05, 1.9], [-1.05, -2.0], [1.05, -2.0]].forEach(([x, z]) => {
      put(g, cylGeo(0.42, 0.42, 0.3, 10), C.tyre, x, 0.42, z).rotation.z = PI / 2;
    });
    cyl(g, 0.08, 2.4, C.steel, 0.5, 2.8, -2.0, 6);
    put(g, cylGeo(0.9, 0.12, 0.35, 12), C.white, 0.5, 5.3, -2.0).rotation.x = 0.9;
    logoSides.forEach((s) => sign(g, logo, 3.0, 0.7, livery, C.white, s * 1.12, 2.1, -0.8, s * PI / 2));
  }

  // ---- The twist: three optional committee doors ----
  const LANE_NAMES = { '-1': 'left', 0: 'centre', 1: 'right' };
  const METER_LABELS = { stock: 'Stock', board: 'Board', washington: 'Washington', beijing: 'Beijing' };
  const DOORS = [
    { id: 'waysMeans', at: 330, lane: -1, name: 'Committee on Ways, Means & Graphics',
      short: 'WAYS, MEANS & GRAPHICS', washington: 6, costMeter: 'board', cost: 4 },
    { id: 'brrr', at: 450, lane: 1, name: 'Subcommittee on Things That Go Brrr',
      short: 'THINGS THAT GO BRRR', washington: 6, costMeter: 'beijing', cost: 5 },
    { id: 'longMeetings', at: 680, lane: -1, name: 'Select Committee on Very Long Meetings',
      short: 'VERY LONG MEETINGS', washington: 8, costMeter: 'beijing', cost: 6 }
  ];
  const SLOW_SPEED = 11;
  const SLOW_SECONDS = 3;
  const SKIP_CHECK_AT = 770;
  const SKIP_PENALTY = 10;
  const KEEP_CLEAR = 15;
  const DOOR_KIND = 'committeeDoor';
  const BUILD_SIGNATURE = 'mechanic.pickup.build(arg): arg is a door index (0-2), or an object with ' +
    '.door (index), .doorId (door id), or .z (= -door distance, with optional .lane). ' +
    'mechanic.params.doors[i].build() takes no arguments.';

  function doorEffectText(d) {
    return '+' + d.washington + ' WASHINGTON  -' + d.cost + ' ' + METER_LABELS[d.costMeter].toUpperCase() +
      '  SLOW ' + SLOW_SECONDS + 'S';
  }

  // Works out which door a pickup build() call means; -1 if it cannot tell.
  function doorIndex(arg) {
    if (typeof arg === 'number') return DOORS[arg] ? arg : -1;
    if (!arg || typeof arg !== 'object') return -1;
    if (typeof arg.door === 'number' && DOORS[arg.door]) return arg.door;
    for (let i = 0; i < DOORS.length; i++) {
      const d = DOORS[i];
      if (arg.doorId === d.id || arg.id === d.id) return i;
      if (typeof arg.z === 'number' && Math.abs(Math.abs(arg.z) - d.at) < 1 &&
        (arg.lane === undefined || arg.lane === d.lane)) return i;
    }
    return -1;
  }

  // A doorway the hero runs through; the opening (|x| < 0.68) is clear up to 2.7 m.
  // If the door cannot be identified, the sign shows no numbers rather than the wrong ones.
  function buildDoor(arg) {
    const d = DOORS[doorIndex(arg)];
    const g = new THREE.Group();
    box(g, 0.22, 2.7, 0.4, C.marble, -0.85, 0, 0);
    box(g, 0.22, 2.7, 0.4, C.marble, 0.85, 0, 0);
    box(g, 1.92, 0.34, 0.46, C.marble, 0, 2.7, 0);
    sign(g, d ? d.short : 'A COMMITTEE', 1.8, 0.28, C.cream, C.navy, 0, 2.87, 0.235);
    box(g, 1.9, 0.95, 0.08, C.navy, 0, 3.1, 0);
    sign(g, 'BRIEF THE COMMITTEE', 1.8, 0.36, C.navy, C.gold, 0, 3.82, 0.045);
    sign(g, d ? doorEffectText(d) : 'COSTS VARY BY COMMITTEE', 1.8, 0.36, C.cream, C.navy, 0, 3.36, 0.045);
    box(g, 0.06, 2.5, 0.7, C.mahogany, -0.71, 0, -0.38);
    box(g, 0.06, 2.5, 0.7, C.mahogany, 0.71, 0, -0.38);
    box(g, 1.5, 0.02, 2.4, C.velvet, 0, 0, 0);
    return g;
  }

  function mechanicSummary() {
    const where = DOORS.map((d, i) => 'door ' + (i + 1) + ' at ' + d.at + ' m in the ' +
      LANE_NAMES[d.lane] + ' lane').join(', ');
    const effects = DOORS.map((d, i) => 'door ' + (i + 1) + ' (' + d.name + ') +' + d.washington +
      ' Washington and -' + d.cost + ' ' + METER_LABELS[d.costMeter]).join('; ');
    return 'Committee doors. Three optional "Brief the committee" doorways each stand in one lane: ' +
      where + '. They are pickups, not obstacles, and never cost hearts. At chapter start each door is ' +
      'spawned with game.spawn({kind:"' + DOOR_KIND + '", lane, z:-distance, door:index, doorId}); a door ' +
      'counts as shown unless spawn is missing, throws, or returns false, and doors that were not shown ' +
      'have no effect at all. On the first frame the run distance reaches a shown door\'s position, the ' +
      'door is entered if the hero is in that door\'s lane (jumping or sliding does not matter) and ' +
      'skipped otherwise; each door resolves once. Entering applies the effects printed on its sign at ' +
      'once: ' + effects + '. Entering also caps run speed at ' + SLOW_SPEED + ' m/s for the next ' +
      SLOW_SECONDS + ' seconds of running (entering another door restarts the ' + SLOW_SECONDS +
      ' seconds); when the time runs out, speed returns to the speed the hero had just before the first ' +
      'door of that slow-down (or the engine\'s current speed if higher), never above ' + SPEED.max +
      ' m/s. While the cap is active game.state.ch7.speedCap is ' + SLOW_SPEED + ', otherwise null. At ' +
      SKIP_CHECK_AT + ' m, if at least one door was shown and no door was entered, Washington drops by ' +
      SKIP_PENALTY + ', once. Lanes are -1 left, 0 centre, +1 right. The engine should keep each door\'s ' +
      'lane free of obstacles within ' + KEEP_CLEAR + ' m of the door. ' + BUILD_SIGNATURE;
  }

  function heroLane(game) {
    const h = game.hero || {};
    if (typeof h.lane === 'number') return Math.round(h.lane);
    if (typeof h.x === 'number') return Math.round(h.x / 2);
    return 0;
  }
  function bump(game, key, delta) {
    if (game.meters && typeof game.meters[key] === 'number') game.meters[key] += delta;
  }
  function say(game, text) {
    if (typeof game.say === 'function') game.say(text);
  }
  function freshState() {
    return {
      shown: {}, doorsShown: 0, resolved: {}, entered: 0,
      slowLeft: 0, resumeSpeed: null, speedCap: null, skipChecked: false
    };
  }

  return {
    id: 'ch7',
    title: 'Capitol Hill',
    dateline: 'Washington, November 10, 2026',
    outfit: 'jacket',
    hideMeters: false,
    length: 800,
    speed: { base: SPEED.base, max: SPEED.max },

    frontPage: {
      headline: 'CHIP CHIEF HEADS FOR THE HILL',
      sub: 'Three House committees request briefings; the President says he believes the CEO "had no idea"'
    },

    theme: {
      sky: '#b8cde0', fog: '#dce5ee', fogNear: 35, fogFar: 170,
      ground: '#a3b096', road: '#e6e0d2', laneLine: '#c9a640',
      lightColor: '#ffe6c4', lightIntensity: 0.95, ambient: '#93a7c4'
    },

    scenery: [
      {
        id: 'colonnade', side: 'both', every: 70, offset: 22,
        build(rng) {
          rng = rngOf(rng);
          const g = new THREE.Group();
          const stone = pick(rng, [C.marble, C.marbleWarm, '#e7e1d3']);
          box(g, 14, 1.2, 7, C.marbleShade, 0, 0, 0);
          box(g, 8, 0.4, 1.2, stone, 0, 0, 4.1);
          box(g, 8, 0.8, 0.6, stone, 0, 0, 3.8);
          box(g, 13, 6.6, 5, stone, 0, 1.2, -1);
          for (let i = 0; i < 6; i++) {
            const x = -5 + i * 2;
            cyl(g, 0.4, 6, stone, x, 1.2, 2.6, 10);
            box(g, 1.0, 0.3, 1.0, stone, x, 7.2, 2.6);
          }
          box(g, 13.6, 0.9, 6.6, stone, 0, 7.5, -0.2);
          sign(g, pick(rng, FRIEZES), 9, 0.6, stone, C.navy, 0, 7.95, 3.12);
          pediment(g, 13.6, 2.4, 1.2, stone, 0, 8.4, 2.5);
          box(g, 13.4, 0.5, 5.4, C.roof, 0, 8.4, -0.9);
          bareTree(g, -6.3, 5.5);
          bareTree(g, 6.3, 5.5);
          return g;
        }
      },
      {
        id: 'flagpole', side: 'both', every: 24, offset: 7.4,
        build(rng) {
          rng = rngOf(rng);
          const g = new THREE.Group();
          cyl(g, 0.35, 0.3, C.granite, 0, 0, 0, 8);
          cyl(g, 0.07, 7, C.steel, 0, 0.3, 0, 6);
          ball(g, 0.14, C.gold, 0, 7.42, 0, 6);
          if (rng() < 0.7) {
            // Stars-and-stripes style: five stripes and a navy canton.
            for (let i = 0; i < 5; i++) {
              box(g, 2.0, 0.24, 0.04, i % 2 ? C.white : C.red, 1.07, 5.9 + i * 0.24, 0);
            }
            box(g, 0.85, 0.72, 0.06, C.navy, 0.5, 6.38, 0);
          } else {
            // District-style: white field, two red bars, three red stars.
            box(g, 2.0, 1.2, 0.04, C.white, 1.07, 5.9, 0);
            box(g, 2.0, 0.2, 0.06, C.red, 1.07, 6.05, 0);
            box(g, 2.0, 0.2, 0.06, C.red, 1.07, 6.4, 0);
            for (let i = 0; i < 3; i++) {
              box(g, 0.2, 0.2, 0.06, C.red, 0.57 + i * 0.5, 6.78, 0).rotation.z = PI / 4;
            }
          }
          return g;
        }
      },
      {
        id: 'statue', side: 'left', every: 50, offset: 13,
        build(rng) {
          rng = rngOf(rng);
          const g = new THREE.Group();
          box(g, 2.4, 0.5, 2.4, C.granite, 0, 0, 0);
          box(g, 1.7, 2.0, 1.7, C.plinth, 0, 0.5, 0);
          sign(g, pick(rng, PLAQUES), 1.4, 0.4, '#3b3a36', '#e8d9a8', 0, 1.6, 0.86);
          cyl(g, 0.6, 1.4, C.bronze, 0, 2.5, 0, 8, 0.35);
          box(g, 0.7, 0.8, 0.45, C.bronze, 0, 3.9, 0);
          ball(g, 0.25, C.bronze, 0, 4.95, 0);
          rod(g, 0.3, 4.5, 0, 0.75, 5.3, 0.15, 0.1, C.bronze);
          put(g, cylGeo(0.09, 0.09, 0.6, 6), C.bronze, 0.8, 5.4, 0.15).rotation.z = PI / 2;
          rod(g, -0.3, 4.5, 0, -0.45, 3.7, 0.1, 0.1, C.bronze);
          // A pigeon has claimed the statue, as is tradition.
          ball(g, 0.12, C.pigeon, 0, 5.28, 0.02, 6);
          ball(g, 0.07, C.pigeon, 0, 5.42, 0.12, 6);
          return g;
        }
      },
      {
        id: 'tvTruck', side: 'right', every: 85, offset: 13,
        build(rng) {
          rng = rngOf(rng);
          const g = new THREE.Group();
          newsTruck(g, pick(rng, LIVERIES), pick(rng, CHANNELS), [-1, 1]);
          return g;
        }
      },
      {
        id: 'protesters', side: 'both', every: 34, offset: 10,
        build(rng) {
          rng = rngOf(rng);
          const g = new THREE.Group();
          const first = Math.floor(rng() * SLOGANS.length) % SLOGANS.length;
          const second = (first + 1 + Math.floor(rng() * (SLOGANS.length - 1))) % SLOGANS.length;
          [[-1, first], [1, second]].forEach(([s, slogan]) => {
            const x = s * 1.0;
            const z = s * 0.4;
            const sx = x + s * 0.3;
            const board = pick(rng, SIGN_BOARDS);
            human(g, randomPerson(rng, ['beanie', 'scarf', 'earmuffs', null]), x, z);
            rod(g, sx, 0.9, z + 0.15, sx, 2.5, z + 0.15, 0.03, C.bark);
            box(g, 1.3, 0.75, 0.05, board, sx, 2.2, z + 0.22);
            sign(g, SLOGANS[slogan], 1.2, 0.65, C.cream, C.ink, sx, 2.575, z + 0.25);
          });
          return g;
        }
      },
      {
        id: 'lampPost', side: 'both', every: 16, offset: 6.5,
        build(rng) {
          rng = rngOf(rng);
          const g = new THREE.Group();
          cyl(g, 0.22, 0.7, C.lamp, 0, 0, 0, 8, 0.16);
          cyl(g, 0.07, 3.3, C.lamp, 0, 0.7, 0, 6);
          box(g, 0.36, 0.12, 0.36, C.lamp, 0, 4.0, 0);
          ball(g, 0.3, '#fbf6e6', 0, 4.4, 0, 8);
          put(g, coneGeo(0.22, 0.3, 6), C.lamp, 0, 4.82, 0);
          // Street banner, face toward the road.
          box(g, 0.04, 1.2, 0.55, pick(rng, [C.red, C.navy, C.gold]), 0, 2.2, 0.35);
          return g;
        }
      },
      {
        id: 'capitolDome', side: 'right', every: 260, offset: 40,
        build() {
          const g = new THREE.Group();
          const stone = '#f2eee4';
          box(g, 22, 6, 14, stone, 0, 0, 0);
          box(g, 23, 0.6, 15, C.marbleShade, 0, 6, 0);
          pediment(g, 10, 2.2, 1.0, stone, 0, 6.6, 7.0);
          cyl(g, 6.2, 3.6, stone, 0, 6.6, 0, 16);
          for (let i = 0; i < 12; i++) {
            const a = (i / 12) * PI * 2;
            cyl(g, 0.25, 3.6, C.white, Math.sin(a) * 6.6, 6.6, Math.cos(a) * 6.6, 6);
          }
          cyl(g, 6.8, 0.5, C.marbleShade, 0, 10.2, 0, 16);
          cyl(g, 5.4, 1.2, stone, 0, 10.7, 0, 16);
          put(g, domeGeo(5.4, 16, 6), '#f7f3ea', 0, 11.9, 0);
          cyl(g, 0.9, 1.4, stone, 0, 17.1, 0, 8);
          put(g, domeGeo(0.9, 8, 3), stone, 0, 18.5, 0);
          put(g, coneGeo(0.15, 0.6, 6), C.bronze, 0, 19.65, 0);
          return g;
        }
      }
    ],

    obstacles: [
      {
        id: 'subpoenaScroll', type: 'low', weight: 3, size: { w: 1.72, h: 0.54, d: 0.97 },
        build() {
          const g = new THREE.Group();
          put(g, cylGeo(0.26, 0.26, 1.4, 10), C.parchment, 0, 0.26, 0).rotation.z = PI / 2;
          put(g, cylGeo(0.12, 0.12, 0.16, 8), C.navy, -0.78, 0.26, 0).rotation.z = PI / 2;
          put(g, cylGeo(0.12, 0.12, 0.16, 8), C.navy, 0.78, 0.26, 0).rotation.z = PI / 2;
          box(g, 0.12, 0.54, 0.54, C.red, 0.3, 0, 0);
          put(g, cylGeo(0.13, 0.13, 0.05, 10), '#a3122a', 0.3, 0.26, 0.28).rotation.x = PI / 2;
          box(g, 1.2, 0.02, 0.6, '#f7e6a6', 0, 0, 0.4);
          sign(g, 'SUBPOENA', 0.8, 0.26, C.navy, C.gold, -0.25, 0.27, 0.27);
          return g;
        }
      },
      {
        id: 'velvetRope', type: 'low', weight: 3, size: { w: 1.74, h: 0.77, d: 0.32 },
        build() {
          const g = new THREE.Group();
          [-0.72, 0.72].forEach((x) => {
            cyl(g, 0.16, 0.04, C.brass, x, 0, 0, 10);
            cyl(g, 0.035, 0.62, C.brass, x, 0.04, 0, 6);
            ball(g, 0.07, C.brass, x, 0.7, 0, 6);
          });
          rod(g, -0.72, 0.6, 0, -0.3, 0.46, 0, 0.04, C.velvet);
          rod(g, -0.3, 0.46, 0, 0.3, 0.46, 0, 0.04, C.velvet);
          rod(g, 0.3, 0.46, 0, 0.72, 0.6, 0, 0.04, C.velvet);
          sign(g, 'MEMBERS ONLY', 0.56, 0.2, C.cream, C.velvet, 0, 0.3, 0.02);
          return g;
        }
      },
      {
        // Budget cuts: the banner is held up by two helium balloons. size.h is the balloon tops;
        // the slide-under clearance is the banner's underside at 1.25 m.
        id: 'hearingBanner', type: 'high', weight: 3, size: { w: 2.0, h: 3.08, d: 0.56 },
        build() {
          const g = new THREE.Group();
          const y0 = 1.25;
          box(g, 1.9, 0.8, 0.04, C.red, 0, y0, 0);
          sign(g, 'HEARING IN SESSION', 1.8, 0.62, C.red, C.white, 0, y0 + 0.4, 0.03);
          put(g, cylGeo(0.045, 0.045, 2.0, 6), C.gold, 0, y0, 0).rotation.z = PI / 2;
          put(g, cylGeo(0.045, 0.045, 2.0, 6), C.gold, 0, y0 + 0.8, 0).rotation.z = PI / 2;
          rod(g, -0.7, y0 + 0.8, 0, -0.7, 2.55, 0, 0.01, C.ink);
          rod(g, 0.7, y0 + 0.8, 0, 0.7, 2.55, 0, 0.01, C.ink);
          ball(g, 0.28, C.navy, -0.7, 2.8, 0);
          ball(g, 0.28, C.gold, 0.7, 2.8, 0);
          return g;
        }
      },
      {
        // Solid body tops out near 1.75 m, above the 1.6 m jump peak, so it reads as "go around".
        id: 'podium', type: 'block', weight: 2, size: { w: 1.3, h: 2.07, d: 0.9 },
        build() {
          const g = new THREE.Group();
          box(g, 1.3, 0.12, 0.9, C.mahoganyDark, 0, 0, 0);
          box(g, 1.0, 1.45, 0.65, C.mahogany, 0, 0.12, 0);
          box(g, 1.1, 0.08, 0.8, '#7d3b24', 0, 1.57, 0).rotation.x = 0.25;
          put(g, cylGeo(0.3, 0.3, 0.02, 12), C.gold, 0, 1.0, 0.33).rotation.x = PI / 2;
          put(g, cylGeo(0.26, 0.26, 0.03, 12), C.navy, 0, 1.0, 0.335).rotation.x = PI / 2;
          sign(g, 'NO COMMENT', 0.8, 0.18, C.gold, C.navy, 0, 0.36, 0.33);
          // A thicket of TV microphones, each with its station flag.
          for (let i = 0; i < 5; i++) {
            const tx = -0.36 + i * 0.18;
            const ty = 1.9 + (i % 2) * 0.12;
            rod(g, -0.2 + i * 0.1, 1.65, 0.1, tx, ty, 0.3, 0.015, C.tyre);
            ball(g, 0.05, '#2a2a2a', tx, ty, 0.3, 6);
            box(g, 0.12, 0.08, 0.08, LIVERIES[i], tx, ty - 0.19, 0.3);
          }
          return g;
        }
      },
      {
        id: 'billTower', type: 'block', weight: 2, size: { w: 1.67, h: 1.76, d: 0.77 },
        build() {
          const g = new THREE.Group();
          const covers = ['#3b6fd8', '#f0b429', '#e04f5f', '#f7f3e8', '#43b581'];
          [[-0.52, 6], [0, 8], [0.52, 7]].forEach(([x, n], k) => {
            for (let i = 0; i < n; i++) {
              const wobble = (((i * 7 + k * 3) % 5) - 2) * 0.04;
              box(g, 0.5, 0.22, 0.7, covers[(i + k) % covers.length], x + wobble * 0.5, i * 0.22, 0)
                .rotation.y = wobble;
            }
          });
          sign(g, '900 PAGES EACH', 0.9, 0.22, C.cream, C.red, 0, 1.0, 0.4);
          return g;
        }
      },
      {
        id: 'lobbyist', type: 'mover', weight: 1.5, size: { w: 1.01, h: 1.8, d: 0.33 },
        build() {
          const g = new THREE.Group();
          human(g, { skin: '#e0ac7e', hair: '#5b3b22', top: C.suit, bottom: C.suit, accessory: 'tie' }, -0.2, 0);
          sign(g, 'LOBBYIST', 0.22, 0.08, C.white, C.navy, -0.08, 1.3, 0.18);
          // Rolling suitcase, presumably full of amendments.
          box(g, 0.42, 0.6, 0.26, '#ff7a1a', 0.35, 0.1, 0);
          put(g, cylGeo(0.05, 0.05, 0.04, 8), C.tyre, 0.2, 0.05, -0.08).rotation.z = PI / 2;
          put(g, cylGeo(0.05, 0.05, 0.04, 8), C.tyre, 0.5, 0.05, -0.08).rotation.z = PI / 2;
          rod(g, 0.25, 0.7, -0.05, 0.25, 1.0, -0.05, 0.015, C.steel);
          rod(g, 0.45, 0.7, -0.05, 0.45, 1.0, -0.05, 0.015, C.steel);
          box(g, 0.26, 0.04, 0.04, '#333333', 0.35, 0.98, -0.05);
          sign(g, 'I LOVE AMENDMENTS', 0.36, 0.14, C.cream, C.red, 0.35, 0.45, 0.135);
          return g;
        }
      }
    ],

    collectible: {
      name: 'Talking-point cards',
      build() {
        const g = new THREE.Group();
        box(g, 0.48, 0.32, 0.02, '#cfe3ff', 0.04, 0.72, -0.03).rotation.z = 0.12;
        box(g, 0.48, 0.32, 0.025, C.cream, 0, 0.74, 0);
        box(g, 0.48, 0.07, 0.03, C.red, 0, 0.99, 0.003);
        for (let i = 0; i < 3; i++) {
          box(g, 0.36, 0.022, 0.03, '#7f8fa8', -0.03, 0.9 - i * 0.06, 0.004);
        }
        box(g, 0.06, 0.06, 0.032, C.gold, 0.18, 0.77, 0.004).rotation.z = PI / 4;
        return g;
      }
    },

    stops: [
      {
        at: 220, title: 'Live From the Hill', dialogueId: 'tvTruck',
        landmark: {
          x: 7,
          build() {
            const g = new THREE.Group();
            newsTruck(g, '#1fa3c9', 'CHIP NEWS 24 LIVE', [-1]);
            human(g, { look: 'female', skin: '#c68b5e', hair: '#2b1d14', top: '#e8562a', bottom: '#2b2b33', accessory: 'scarf' },
              -1.8, 1.0, -0.6);
            rod(g, -1.55, 1.15, 1.2, -1.5, 1.45, 1.35, 0.025, '#333333');
            ball(g, 0.07, C.red, -1.5, 1.5, 1.37, 6);
            const op = human(g, { skin: '#f1c9a5', hair: '#b5813f', top: '#3d4a5c', bottom: '#2b2b33', accessory: 'beanie' },
              -2.6, 2.2, -0.9);
            // Shoulder camera, parented to the camera operator.
            put(op, boxGeo(0.25, 0.25, 0.5), '#2a2a2a', 0.28, 1.55, 0.2);
            put(op, cylGeo(0.08, 0.08, 0.15, 8), C.glass, 0.28, 1.55, 0.5).rotation.x = PI / 2;
            return g;
          }
        }
      },
      {
        at: 520, title: 'The Senator on the Steps', dialogueId: 'senator',
        landmark: {
          x: -7,
          build() {
            const g = new THREE.Group();
            box(g, 6, 0.3, 4.0, C.marble, 0, 0, -0.5);
            box(g, 6, 0.3, 3.0, '#e4ddcc', 0, 0.3, -1.0);
            box(g, 6, 0.3, 1.7, C.marble, 0, 0.6, -1.65);
            cyl(g, 0.35, 4.6, C.marble, -2, 0.9, -2.0, 10);
            cyl(g, 0.35, 4.6, C.marble, 2, 0.9, -2.0, 10);
            box(g, 5.6, 0.6, 1.0, '#e4ddcc', 0, 5.5, -2.0);
            cyl(g, 0.04, 2.6, C.steel, 2.6, 0.9, -1.2, 6);
            box(g, 0.9, 0.55, 0.03, C.navy, 3.05, 2.9, -1.2);
            box(g, 0.9, 0.18, 0.035, C.red, 3.05, 2.9, -1.2);
            box(g, 0.7, 1.1, 0.45, C.mahogany, 1.0, 0.6, 0.1);
            sign(g, 'THE SENATOR', 0.65, 0.2, C.navy, C.gold, 1.0, 1.4, 0.33);
            human(g, { skin: '#f1c9a5', hair: '#c9c2b8', top: C.navy, bottom: C.navy, accessory: 'flag pin' },
              1.0, -0.4, 0.6, 0.6);
            const aide = human(g, { skin: '#9a6440', hair: '#1a1a1a', top: '#7a8a99', bottom: '#2b2b33', accessory: 'glasses' },
              2.2, 1.0, 0.6, 0.3);
            put(aide, boxGeo(0.3, 0.38, 0.06), C.red, 0.28, 1.05, 0.18);
            return g;
          }
        }
      },
      {
        at: 800, title: 'The Committee Room Door', dialogueId: 'committeeDoor',
        landmark: {
          x: 7,
          build() {
            const g = new THREE.Group();
            box(g, 6.0, 5.2, 0.8, '#e4ddcc', 0, 0, -0.6);
            box(g, 0.6, 4.2, 0.4, C.marble, -1.5, 0, 0);
            box(g, 0.6, 4.2, 0.4, C.marble, 1.5, 0, 0);
            box(g, 3.8, 0.5, 0.5, C.marble, 0, 4.2, 0);
            pediment(g, 4.0, 1.0, 0.5, C.marble, 0, 4.7, 0);
            box(g, 1.2, 3.8, 0.12, C.mahogany, -0.6, 0, -0.14);
            box(g, 1.2, 3.8, 0.12, C.mahoganyDark, 0.6, 0, -0.14);
            sign(g, 'HEARING IN SESSION', 2.6, 0.38, C.red, C.white, 0, 4.45, 0.26);
            box(g, 1.8, 0.03, 3.0, C.velvet, 0, 0, 1.5);
            human(g, { skin: '#6e4428', hair: '#1a1a1a', top: '#4b3b6b', bottom: '#2b2b33', accessory: 'glasses' },
              2.2, 0.8, -0.6);
            [[-2.0, 1.2], [-2.6, 1.9]].forEach(([x, z], i) => {
              const lawyer = human(g, { skin: SKINS[i * 2], hair: HAIRS[i + 1], top: '#1c1c22', bottom: '#1c1c22', accessory: 'tie' },
                x, z, -0.6);
              put(lawyer, boxGeo(0.45, 0.32, 0.12), '#3a2a1c', 0.36, 0.55, 0);
            });
            return g;
          }
        }
      }
    ],

    dialogues: {
      tvTruck: [
        { speaker: 'Reporter', text: 'We\'re live on the Hill! The President says he believes you "had no idea." Reaction?' },
        { speaker: 'Jensen', text: 'I have lots of ideas. Most of them have 208 billion transistors.' },
        { speaker: 'Camera Op', text: 'Say something with "AI" in it. The algorithm is hungry.' },
        { speaker: 'Jensen', text: 'Free AI should be great for hardware. Free AI should be great for chips.' },
        { speaker: 'Reporter', text: 'Tonight\'s chyron: CHIP CEO LIKES CHIPS. Shocking scenes.' }
      ],
      senator: [
        { speaker: 'The Senator', text: 'Jensen! Quick question in nine parts. Part one: is a GPU a kind of potato?' },
        { speaker: 'Jensen', text: 'Closer to a very fast toaster. Please don\'t regulate the toaster.' },
        { speaker: 'The Senator', text: 'Part two: will you build something shiny in my state?' },
        { speaker: 'Jensen', text: 'We could be of great service to the local market.' },
        { speaker: 'Aide', text: 'Senator, the cameras moved. Parts three to nine will come by email.' }
      ],
      committeeDoor: [
        { speaker: 'The Clerk', text: 'The committee will see you now. All three. One small room.' },
        { speaker: 'Lawyer', text: 'Or we go in. We bill in six-minute increments. That offer was one.' },
        {
          speaker: 'Jensen', text: 'Jacket zipped. Who goes in?',
          choices: [
            { text: 'Brief them fully', effects: { washington: 12, board: -6, stock: -3, beijing: -5 }, next: 'committeeFull' },
            { text: 'Send the lawyers', effects: { washington: -10, board: 6, stock: 3, beijing: 4 }, next: 'committeeLawyers' }
          ]
        }
      ],
      committeeFull: [
        { speaker: 'The Clerk', text: '400 slides in five minutes. The stenographer needs a nap.' },
        { speaker: 'The Clerk', text: 'Members call it "the most slides per minute in recorded history."' }
      ],
      committeeLawyers: [
        { speaker: 'Lawyer', text: 'Our client declines the room. He is, however, near the building.' },
        { speaker: 'The Clerk', text: 'Noted: very shiny shoes. Very billable.' }
      ]
    },

    mechanic: {
      summary: mechanicSummary(),
      params: {
        doors: DOORS.map((d, i) => Object.assign({}, d, { build: () => buildDoor(i) })),
        lanes: { left: -1, centre: 0, right: 1 },
        slowSpeed: SLOW_SPEED,
        slowSeconds: SLOW_SECONDS,
        skipCheckAt: SKIP_CHECK_AT,
        skipPenalty: SKIP_PENALTY,
        keepClear: KEEP_CLEAR,
        spawnKind: DOOR_KIND
      },
      pickup: { kind: DOOR_KIND, build: buildDoor, signature: BUILD_SIGNATURE }
    },

    onStart(game) {
      game.state = game.state || {};
      const st = (game.state.ch7 = freshState());
      if (typeof game.spawn === 'function') {
        DOORS.forEach((d, i) => {
          try {
            const r = game.spawn({ kind: DOOR_KIND, lane: d.lane, z: -d.at, door: i, doorId: d.id });
            if (r !== false) st.shown[d.id] = true;
          } catch (e) {
            // Engine does not support this kind; the door was not drawn, so it will not count.
          }
        });
      }
      st.doorsShown = Object.keys(st.shown).length;
      if (st.doorsShown) {
        say(game, 'Committees want briefings. Their doors are optional. Skipping all of them will be noticed.');
      }
    },

    onUpdate(game, dt) {
      game.state = game.state || {};
      const st = game.state.ch7 || (game.state.ch7 = freshState());
      const dist = typeof game.distance === 'number' ? game.distance : 0;
      const step = typeof dt === 'number' && dt > 0 ? dt : 0;
      const hasSpeed = typeof game.speed === 'number';

      DOORS.forEach((d) => {
        if (!st.shown[d.id] || st.resolved[d.id] || dist < d.at) return;
        st.resolved[d.id] = true;
        if (heroLane(game) === d.lane) {
          bump(game, 'washington', d.washington);
          bump(game, d.costMeter, -d.cost);
          st.entered += 1;
          if (!(st.slowLeft > 0)) st.resumeSpeed = hasSpeed ? game.speed : null;
          st.slowLeft = SLOW_SECONDS;
          say(game, 'Briefed the ' + d.name + '. +' + d.washington + ' Washington, -' + d.cost + ' ' +
            METER_LABELS[d.costMeter] + '.');
        } else {
          say(game, 'Skipped the ' + d.name + '. Someone wrote that down.');
        }
      });

      if (st.slowLeft > 0) {
        st.slowLeft -= step;
        if (st.slowLeft > 0) {
          st.speedCap = SLOW_SPEED;
          if (hasSpeed && game.speed > SLOW_SPEED) game.speed = SLOW_SPEED;
        } else {
          st.slowLeft = 0;
          st.speedCap = null;
          if (hasSpeed && typeof st.resumeSpeed === 'number') {
            game.speed = Math.min(Math.max(game.speed, st.resumeSpeed), SPEED.max);
          }
          st.resumeSpeed = null;
        }
      }

      if (!st.skipChecked && dist >= SKIP_CHECK_AT) {
        st.skipChecked = true;
        if (st.doorsShown > 0 && st.entered === 0) {
          bump(game, 'washington', -SKIP_PENALTY);
          say(game, 'You skipped every committee. Washington calls it "a bold choice." -' + SKIP_PENALTY + ' Washington.');
        }
      }
    },

    endCard: {
      title: 'Capitol Hill: Survived',
      lines: [
        'Three committees, one jacket, zero toasters regulated.',
        'The Senator\'s staff remain split on the potato question.',
        'Parts three to nine of the question are in your inbox.'
      ]
    }
  };
};
