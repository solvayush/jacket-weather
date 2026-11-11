'use strict';
// Chapter 6, "Meme Storm": a neon cyberspace run through love-themed memes about the CEO.
// Content module for Jacket Weather. The engine passes in THREE (r149) and its kit.

module.exports = function (THREE, kit) {
  const LENGTH = 820;

  // ------------------------------------------------------------------ palette
  const C = {
    pink: '#ff2bd6', cyan: '#22e6ff', purple: '#7b2cff', violet: '#3a1670', night: '#140a2a',
    ink: '#0d0b14', white: '#f6f0ff', yellow: '#ffd23f', honey: '#ffae1a', amber: '#b85f00',
    red: '#ff3355', green: '#3dff8a', blush: '#ff7aa8', grey: '#8f86b3', cloud: '#b7a6ea',
    wood: '#6b3b1f', gold: '#e0b43c', paper: '#f2e6c9', screen: '#1b1446',
  };

  const lambert = (hex, extra) => new THREE.MeshLambertMaterial(Object.assign({ color: hex, flatShading: true }, extra));
  const neon = (hex, k) => lambert(hex, { emissive: hex, emissiveIntensity: k === undefined ? 0.6 : k });

  // Shared by every object in the chapter.
  const M = {
    pink: neon(C.pink), cyan: neon(C.cyan), purple: neon(C.purple, 0.45), violet: lambert(C.violet),
    night: lambert(C.night), screen: neon(C.screen, 0.5), ink: lambert(C.ink), white: lambert(C.white),
    yellow: lambert(C.yellow), red: neon(C.red, 0.4), green: neon(C.green, 0.5), blush: lambert(C.blush),
    grey: lambert(C.grey), cloud: lambert(C.cloud), wood: lambert(C.wood), gold: neon(C.gold, 0.3),
    paper: lambert(C.paper), lid: lambert(C.amber),
    honey: lambert(C.honey, { emissive: '#ff8a00', emissiveIntensity: 0.25 }),
    honeyGlass: lambert(C.honey, { emissive: '#ff8a00', emissiveIntensity: 0.25, transparent: true, opacity: 0.88 }),
    pinkGlass: lambert(C.pink, { emissive: C.pink, emissiveIntensity: 0.3, transparent: true, opacity: 0.45 }),
    beam: lambert('#fff3b0', { emissive: '#fff3b0', emissiveIntensity: 0.8, transparent: true, opacity: 0.22, depthWrite: false }),
  };

  // ------------------------------------------------------------------ helpers
  function at(obj, x, y, z) { obj.position.set(x || 0, y || 0, z || 0); return obj; }
  const box = (w, h, d, m, x, y, z) => at(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m), x, y, z);
  const cyl = (rt, rb, h, m, x, y, z, seg) => at(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 10), m), x, y, z);
  const cone = (r, h, m, x, y, z, seg) => at(new THREE.Mesh(new THREE.ConeGeometry(r, h, seg || 10), m), x, y, z);
  const ball = (r, m, x, y, z) => at(new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), m), x, y, z);
  const sign = (text, w, h, bg, fg, x, y, z) => at(kit.textPlane(text, { w, h, bg, fg }), x, y, z);
  const tilt = (obj, rz) => { obj.rotation.z = rz; return obj; };
  const squash = (obj, sz) => { obj.scale.z = sz; return obj; };

  function person(look, x, y, z, scale) {
    const p = kit.person(Object.assign({}, look));
    if (scale) p.scale.setScalar(scale);
    return at(p, x, y, z);
  }

  function group() {
    const g = new THREE.Group();
    for (let i = 0; i < arguments.length; i++) g.add(arguments[i]);
    return g;
  }

  // Low-poly heart (3 meshes): a 45-degree diamond plus two lobes. Width w; origin at the diamond centre,
  // so it spans -0.41w (point) to +0.5w (lobes) vertically.
  function heart(w, m, depth, x, y, z) {
    const s = w / 1.7071, d = depth || w * 0.3, off = s * 0.35355;
    const lobeL = squash(ball(s / 2, m, -off, off, 0), d / s);
    const lobeR = squash(ball(s / 2, m, off, off, 0), d / s);
    return at(group(tilt(box(s, s, d, m), Math.PI / 4), lobeL, lobeR), x, y, z);
  }

  function note(x, y) { // a music note: head, stem, flag
    return group(squash(ball(0.08, M.pink, x, y, 0), 0.6), box(0.03, 0.3, 0.03, M.pink, x + 0.07, y + 0.15, 0),
      box(0.12, 0.05, 0.03, M.pink, x + 0.12, y + 0.28, 0));
  }

  const rand = rng => (typeof rng === 'function' ? rng : Math.random);
  const pick = (rng, arr) => arr[Math.floor(rng() * arr.length) % arr.length];
  function shuffled(rng, arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  // ------------------------------------------------------------------ people
  const HERO_LOOK = { skin: '#e3b48c', hair: '#d4d4d8', top: '#151515', bottom: '#26262b', accessory: 'jacket' };
  const EXEC_LOOK = { look: 'female', skin: '#f0caa8', hair: '#1b1b1f', top: '#2f3b5c', bottom: '#2f3b5c', accessory: 'suit' };
  const SILHOUETTE_LOOK = { skin: '#4a4060', hair: '#1a1626', top: '#6b5a3a', bottom: '#2a2438', accessory: 'sunglasses' };
  const COMMS_LOOK = { look: 'female', skin: '#c68e67', hair: '#2e1f14', top: '#2bb3c9', bottom: '#2a2a3a', accessory: 'headset' };
  const ENGINEER_LOOK = { skin: '#f2cfae', hair: '#7a4a24', top: '#76b900', bottom: '#33334a', accessory: 'lanyard' };
  const CHAIR_LOOK = { skin: '#e8c4a0', hair: '#dcdcdc', top: '#1f2a44', bottom: '#1f2a44', accessory: 'tie' };
  const INVESTIGATOR_LOOK = { skin: '#8d5a3b', hair: '#161616', top: '#5a5a6a', bottom: '#2a2a33', accessory: 'clipboard' };
  const TEEN_LOOK = { look: 'female', skin: '#f0c8a0', hair: '#9b5cff', top: '#3a3a4a', bottom: '#1f1f2a', accessory: 'headphones' };

  // ------------------------------------------------------------------ text pools
  const TABS = ['trending.now', 'memes.zip', 'comments (99+)', 'hot-takes.exe', 'jacket-watch.live', 'for-you.page'];
  const HEADLINES = ['#1 TRENDING: THE JACKET', 'CEO SAYS SORRY. INTERNET: <3', 'NEW REMIX JUST DROPPED',
    'LOADING FEELINGS...', 'ARE YOU STILL WATCHING?', '4,000 NEW MEMES (AND COUNTING)', 'TOP COMMENT: "nice jacket tho"'];
  const NOTIFICATIONS = ['The Internet mentioned you 9,999+ times', 'New follower: literally everyone',
    'Your jacket was tagged in 40K posts', 'Group chat: "is he ok??"', 'Reminder: drink water. Maybe log off.',
    'Someone made you a fan edit (again)'];
  // Invented captions; none of these are real song lyrics.
  const LYRICS = ['my heart runs on a thousand cores', "you're the GPU to my CPU", 'leather jacket, heart of gold (plated)',
    "you had me at 'accelerated computing'", "I'd wait for you like a chip backorder"];
  let lyricIndex = 0;

  // ------------------------------------------------------------------ scenery
  // Each solid kind has its own x band on its side, so copies never pass through each other
  // (the grid tiles are a flat floor decal and may sit under anything):
  //   right: like counters 5.6..8.4, Silhouette posters 9..12, browser windows 12.8..18.2
  //   left:  phone screens -11..-6.6, browser windows -18.2..-12.8, kiss cam -25.2..-18.8
  const scenery = [
    { id: 'browser_window', side: 'both', every: 22, offset: 15.5, build(rng) {
      rng = rand(rng);
      const w = 4 + rng() * 1.4, h = 2.6 + rng() * 0.8, y0 = 3 + rng() * 3;
      const pinkBar = rng() < 0.5, top = y0 + h - 0.22, left = -w / 2;
      return group(
        cyl(0.03, 0.03, y0, M.cyan, 0, y0 / 2, 0, 6), // data beam down to the grid
        box(w, h, 0.2, M.screen, 0, y0 + h / 2, 0),
        box(w, 0.44, 0.26, pinkBar ? M.pink : M.cyan, 0, top, 0),
        ball(0.09, M.red, left + 0.3, top, 0.14),
        ball(0.09, M.yellow, left + 0.55, top, 0.14),
        ball(0.09, M.green, left + 0.8, top, 0.14),
        sign(pick(rng, TABS), w * 0.55, 0.28, pinkBar ? C.pink : C.cyan, '#ffffff', 0.35, top, 0.14),
        sign(pick(rng, HEADLINES), w - 0.6, 0.62, C.night, C.cyan, 0, y0 + h * 0.56, 0.11),
        box(w * 0.62, 0.12, 0.02, M.grey, -w * 0.12, y0 + 0.62, 0.11),
        box(w * 0.45, 0.12, 0.02, M.grey, -w * 0.2, y0 + 0.36, 0.11),
        heart(0.4, M.pink, 0.1, w / 2 - 0.5, y0 + 0.5, 0.12));
    } },

    { id: 'like_counter', side: 'right', every: 28, offset: 7, build(rng) {
      rng = rand(rng);
      const H = 4 + rng() * 2, top = 0.4 + H;
      const label = pick(rng, ['LIKES', 'HEARTS', 'SHARES', 'SWOONS']) + ' ' + (1 + rng() * 9).toFixed(1) + 'M';
      return group(
        cyl(0.7, 0.9, 0.4, M.violet, 0, 0.2, 0),
        cyl(0.12, 0.12, H, M.cyan, 0, 0.4 + H / 2, 0, 6),
        heart(1.8, M.pink, 0.5, 0, top + 0.65, 0),
        box(2.4, 0.7, 0.2, M.night, 0, 0.4 + H * 0.6, 0.15),
        sign(label, 2.2, 0.5, C.night, C.pink, 0, 0.4 + H * 0.6, 0.26),
        heart(0.4, M.pink, 0.12, -1.25, top - 0.4 + rng() * 0.6, 0.2),
        heart(0.3, M.pink, 0.1, 1.2, top + rng() * 0.8, 0.2));
    } },

    { id: 'phone_screen', side: 'left', every: 45, offset: 9, build(rng) {
      rng = rand(rng);
      const g = group(
        box(2.2, 0.6, 1.4, M.violet, 0, 0.3, 0), // stand
        box(4, 8, 0.5, M.ink, 0, 4.6, 0),
        box(3.6, 7.3, 0.06, M.screen, 0, 4.6, 0.27),
        box(1.0, 0.2, 0.04, M.ink, 0, 8.1, 0.31),
        sign('11:08   BATTERY 2%', 3.0, 0.28, C.screen, '#ffffff', 0, 7.7, 0.31),
        box(1.2, 0.08, 0.04, M.white, 0, 1.2, 0.31),
        heart(1.0, M.pink, 0.3, 1.9, 7.4, 0.45));
      shuffled(rng, NOTIFICATIONS).slice(0, 3).forEach((text, i) => {
        const y = 6.6 - i * 1.25;
        g.add(box(3.2, 0.95, 0.04, M.white, 0, y, 0.31), sign(text, 3.0, 0.7, C.white, C.night, 0, y, 0.34));
      });
      return g;
    } },

    // The only place the spy rumour appears: a cartoon figure, always stamped UNVERIFIED. Kept sparse.
    { id: 'silhouette_poster', side: 'right', every: 160, offset: 10.5, build() {
      const feet = 1.55, s = 1.25, headTop = feet + 1.8 * s;
      return group(
        box(0.15, 1.2, 0.15, M.ink, -1.3, 0.6, 0),
        box(0.15, 1.2, 0.15, M.ink, 1.3, 0.6, 0),
        box(3, 4, 0.15, M.paper, 0, 3.2, 0),
        sign('THE SILHOUETTE', 2.7, 0.45, C.night, C.yellow, 0, 4.82, 0.09),
        person(SILHOUETTE_LOOK, -0.25, feet, 0.2, s),
        cyl(0.34, 0.34, 0.04, M.ink, -0.25, headTop + 0.02, 0.2), // hat brim
        cyl(0.2, 0.23, 0.22, M.ink, -0.25, headTop + 0.15, 0.2), // hat crown
        box(0.36, 0.08, 0.05, M.ink, -0.25, feet + 1.62 * s, 0.38), // sunglasses
        heart(0.5, M.pink, 0.14, 0.55, 2.8, 0.45), // heart-shaped gadget
        cyl(0.015, 0.015, 0.3, M.ink, 0.68, 3.15, 0.45, 5),
        ball(0.045, M.red, 0.68, 3.32, 0.45),
        tilt(sign('UNVERIFIED', 2.3, 0.5, C.red, '#ffffff', 0, 2.1, 0.5), -0.2),
        sign('RUMOUR, NOT FACT', 2.4, 0.3, C.night, '#ffffff', 0, 1.37, 0.09));
    } },

    // The hero beside a cartoon businesswoman, labelled and nothing more. Spaced wider than the run,
    // so at most one copy appears.
    { id: 'kisscam_jumbotron', side: 'left', every: LENGTH + 10, offset: 22, build() {
      return group(
        box(0.3, 3, 0.3, M.ink, -2.4, 1.5, 0),
        box(0.3, 3, 0.3, M.ink, 2.4, 1.5, 0),
        box(6.4, 4.6, 0.4, M.pink, 0, 5.3, 0),
        box(6.0, 4.2, 0.1, M.screen, 0, 5.3, 0.22),
        sign('KISS CAM', 3, 0.6, C.pink, '#ffffff', 0, 7.0, 0.29),
        person(HERO_LOOK, -0.9, 3.7, 0.3, 1.45),
        person(EXEC_LOOK, 0.9, 3.7, 0.3, 1.45),
        sign('Megaspeed executive', 2.0, 0.32, C.white, C.night, 0.9, 3.45, 0.4));
    } },

    // Glowing grid beside the road: flat 12m tiles that line up end to end. One cross line glows pink.
    { id: 'grid_floor', side: 'both', every: 12, offset: 10, build(rng) {
      rng = rand(rng);
      const pulse = Math.floor(rng() * 4);
      const g = new THREE.Group();
      for (let i = 0; i < 5; i++) g.add(box(0.07, 0.03, 12, M.cyan, -5 + i * 2.5, 0.015, 0));
      for (let j = 0; j < 4; j++) g.add(box(10, 0.03, 0.07, j === pulse ? M.pink : M.purple, 0, 0.015, -4.5 + j * 3));
      return g;
    } },
  ];

  // ------------------------------------------------------------------ obstacles
  // size = measured bounding box: w (x), h (top height above ground), d (z).
  const obstacles = [
    { id: 'heart_eyes', type: 'block', weight: 3, size: { w: 1.52, h: 2.14, d: 1.6 }, build() {
      return group(
        cyl(0.8, 0.8, 0.05, M.pink, 0, 0.025, 0), // glow pad
        box(1.5, 1.5, 1.0, M.yellow, 0, 0.8, 0),
        heart(0.48, M.red, 0.1, -0.36, 1.05, 0.52),
        heart(0.48, M.red, 0.1, 0.36, 1.05, 0.52),
        box(0.7, 0.14, 0.08, M.ink, 0, 0.5, 0.5),
        squash(ball(0.13, M.blush, -0.56, 0.62, 0.5), 0.3),
        squash(ball(0.13, M.blush, 0.56, 0.62, 0.5), 0.3),
        heart(0.36, M.pink, 0.12, -0.45, 1.85, 0),
        heart(0.28, M.pink, 0.1, 0.42, 2.0, 0.1));
    } },

    { id: 'tabloid_poster', type: 'block', weight: 2, size: { w: 1.6, h: 2.3, d: 0.7 }, build() {
      return group(
        box(1.6, 0.5, 0.7, M.violet, 0, 0.25, 0), // newsstand base
        box(1.6, 0.06, 0.7, M.cyan, 0, 0.52, 0),
        box(1.6, 1.8, 0.1, M.paper, 0, 1.4, 0),
        sign('THE DAILY SCROLL', 1.5, 0.3, C.red, '#ffffff', 0, 2.08, 0.06),
        sign('TWO HUANGS', 1.5, 0.42, C.paper, '#111111', 0, 1.68, 0.06),
        sign("DON'T MAKE A RIGHT", 1.5, 0.34, C.paper, '#111111', 0, 1.28, 0.06),
        sign('EXCLUSIVE*', 0.8, 0.22, C.yellow, '#111111', -0.32, 0.88, 0.06),
        sign('*not exclusive', 0.62, 0.14, C.paper, '#555555', 0.42, 0.68, 0.06),
        heart(0.32, M.pink, 0.06, 0.55, 0.95, 0.07));
    } },

    { id: 'kiss_cam', type: 'high', weight: 3, size: { w: 1.9, h: 3.18, d: 0.62 }, build() {
      return group(
        box(1.9, 0.2, 0.36, M.pink, 0, 2.6, 0),
        box(1.9, 0.14, 0.36, M.pink, 0, 1.2, 0), // underside at 1.13m
        box(0.14, 1.26, 0.36, M.pink, -0.88, 1.9, 0),
        box(0.14, 1.26, 0.36, M.pink, 0.88, 1.9, 0),
        box(1.62, 1.24, 0.06, M.pinkGlass, 0, 1.9, 0),
        sign('KISS CAM', 1.1, 0.18, C.pink, '#ffffff', 0, 2.6, 0.19),
        sign('CAMERA SHY? DUCK!', 1.4, 0.34, C.night, C.yellow, 0, 1.9, 0.05),
        cyl(0.1, 0.16, 0.26, M.ink, 0, 3.05, 0.1), // spotlight
        squash(cone(0.62, 1.5, M.beam, 0, 2.15, 0.05), 0.5),
        heart(0.26, M.red, 0.08, -0.8, 2.86, 0),
        heart(0.26, M.red, 0.08, 0.8, 2.86, 0));
    } },

    { id: 'lyric_bar', type: 'high', weight: 2, size: { w: 1.9, h: 2.33, d: 0.42 }, build() {
      const line = LYRICS[lyricIndex++ % LYRICS.length];
      return group(
        box(1.9, 0.56, 0.4, M.night, 0, 1.55, 0),
        box(1.9, 0.05, 0.42, M.cyan, 0, 1.25, 0), // underside at 1.225m
        box(1.9, 0.05, 0.42, M.cyan, 0, 1.855, 0),
        sign(line, 1.76, 0.36, C.night, '#ffffff', 0, 1.55, 0.21),
        note(-0.78, 1.98),
        note(0.74, 2.02));
    } },

    { id: 'honeypot', type: 'low', weight: 2, size: { w: 1.62, h: 0.6, d: 0.85 }, build() {
      const g = group(squash(cyl(0.85, 0.85, 0.02, M.honey, 0, 0.01, 0), 0.5)); // spilled honey
      [-0.42, 0.42].forEach(x => {
        g.add(
          cyl(0.36, 0.38, 0.5, M.honeyGlass, x, 0.25, 0),
          cyl(0.39, 0.39, 0.1, M.lid, x, 0.55, 0),
          ball(0.07, M.honey, x + 0.3, 0.46, 0.2),
          sign('HONEYPOT?', 0.56, 0.17, '#fff4d6', '#7a3b00', x, 0.33, 0.385),
          sign('UNVERIFIED', 0.44, 0.1, C.red, '#ffffff', x, 0.14, 0.385));
      });
      return g;
    } },

    { id: 'blushing_chart', type: 'low', weight: 3, size: { w: 1.6, h: 0.74, d: 0.5 }, build() {
      const seg = (len, x, y, rz) => tilt(box(len, 0.055, 0.03, M.green, x, y, 0.08), rz);
      return group(
        box(0.12, 0.12, 0.5, M.ink, -0.66, 0.06, 0),
        box(0.12, 0.12, 0.5, M.ink, 0.66, 0.06, 0),
        box(1.6, 0.62, 0.12, M.white, 0, 0.43, 0),
        sign('THE CHART, FLUSTERED', 1.3, 0.12, C.white, '#333333', 0, 0.665, 0.065),
        seg(0.5, -0.5, 0.3, 0.45),
        seg(0.42, -0.1, 0.36, -0.2),
        seg(0.55, 0.35, 0.44, 0.35),
        ball(0.03, M.ink, -0.15, 0.56, 0.07),
        ball(0.03, M.ink, 0.15, 0.56, 0.07),
        squash(ball(0.07, M.blush, -0.3, 0.5, 0.07), 0.3),
        squash(ball(0.07, M.blush, 0.3, 0.5, 0.07), 0.3));
    } },

    { id: 'ratio_cloud', type: 'mover', weight: 2, size: { w: 1.6, h: 0.78, d: 0.78 }, build() {
      return group(
        ball(0.3, M.cloud, -0.5, 0.36, 0),
        ball(0.38, M.cloud, -0.18, 0.4, 0),
        ball(0.36, M.cloud, 0.2, 0.4, 0.02),
        ball(0.3, M.cloud, 0.5, 0.34, 0),
        sign('RATIO', 0.9, 0.3, C.night, C.pink, 0, 0.42, 0.42));
    } },
  ];

  // ------------------------------------------------------------------ collectible
  const collectible = { name: 'Context', build() {
    const ring = cyl(0.3, 0.3, 0.02, M.cyan, 0, 0.31, -0.08);
    ring.rotation.x = Math.PI / 2;
    const bubble = ball(0.22, M.white, 0, 0.3, 0);
    bubble.scale.set(1.2, 0.9, 0.5);
    const tail = tilt(cone(0.07, 0.16, M.white, -0.12, 0.1, 0), Math.PI);
    return group(ring, bubble, tail,
      tilt(box(0.05, 0.12, 0.05, M.green, -0.08, 0.27, 0.12), 0.785), // tick, short stroke
      tilt(box(0.05, 0.25, 0.05, M.green, 0.04, 0.325, 0.12), -0.7)); // tick, long stroke
  } };

  // ------------------------------------------------------------------ landmarks
  function buildAllHands() {
    return group(
      box(6, 0.6, 3.4, M.violet, 0, 0.3, 0),
      box(6, 0.08, 0.08, M.cyan, 0, 0.62, 1.7),
      box(5.6, 3.2, 0.2, M.screen, 0, 2.5, -1.5),
      sign('ALL-HANDS: LIVE', 4.4, 0.6, C.pink, '#ffffff', 0, 3.6, -1.38),
      sign('EVERY EMPLOYEE IS WATCHING', 4.0, 0.36, C.night, C.cyan, 0, 2.95, -1.38),
      heart(0.9, M.pink, 0.2, 2.1, 1.9, -1.3),
      box(0.8, 1.1, 0.6, M.white, 1.3, 1.15, 0.2), // podium, waiting for the hero
      person(COMMS_LOOK, -1.4, 0.6, 0.3),
      person(ENGINEER_LOOK, 0.4, 0, 2.3));
  }

  function buildBoardroom() {
    return group(
      box(5, 4.2, 0.4, M.violet, 0, 2.1, -0.4),
      box(1.9, 3.15, 0.2, M.gold, 0, 1.575, -0.15),
      box(1.6, 3.0, 0.15, M.wood, 0, 1.5, -0.05),
      sign('BOARDROOM', 1.2, 0.28, C.gold, '#1a1a1a', 0, 2.65, 0.04),
      sign('DO NOT DISTURB', 1.2, 0.24, C.red, '#ffffff', 0, 2.0, 0.04),
      sign('INDEPENDENT INVESTIGATION', 4.4, 0.45, C.cyan, C.night, 0, 3.75, -0.19),
      person(CHAIR_LOOK, -1.7, 0, 0.6),
      person(INVESTIGATOR_LOOK, 1.5, 0, 0.6),
      cyl(0.05, 0.05, 0.46, M.grey, 2.2, 0.23, 0.2, 6), // the investigator's own chair
      box(0.5, 0.08, 0.5, M.grey, 2.2, 0.5, 0.2),
      box(0.5, 0.6, 0.08, M.grey, 2.2, 0.8, -0.05));
  }

  function buildMemeFactory() {
    const teen = person(TEEN_LOOK, -0.4, 0, 1.4);
    teen.rotation.y = 0.3; // slouched toward the belt, deeply bored
    return group(
      box(2.0, 3.2, 2.0, M.purple, -2.0, 1.6, -0.3), // the meme press
      sign('MEME FACTORY', 1.9, 0.4, C.yellow, C.night, -2.0, 2.8, 0.71),
      cyl(0.3, 0.36, 1.2, M.ink, -2.4, 3.8, -0.6),
      heart(0.6, M.pink, 0.2, -2.4, 4.8, -0.6),
      box(4.0, 0.15, 1.0, M.ink, 1.0, 1.0, 0.3), // conveyor belt
      box(3.6, 0.92, 0.6, M.grey, 1.0, 0.46, 0.3), // belt housing
      sign('SORRY?? OMG', 0.75, 0.5, C.yellow, '#111111', 0.6, 1.33, 0.3),
      sign('JACKET <3', 0.75, 0.5, C.pink, '#ffffff', 1.5, 1.33, 0.3),
      sign('RATIO', 0.75, 0.5, C.cyan, C.night, 2.4, 1.33, 0.3),
      sign('SHIFT ENDS IN 5 MIN', 1.8, 0.3, C.night, C.yellow, 1.4, 2.55, 0.3),
      teen,
      box(0.8, 1.0, 0.5, M.violet, 0.5, 0.5, 1.5), // control panel
      cyl(0.14, 0.14, 0.08, M.green, 0.32, 1.04, 1.5), // post through it
      cyl(0.14, 0.14, 0.08, M.red, 0.68, 1.04, 1.5)); // log off
  }

  // ------------------------------------------------------------------ dialogue
  const dialogues = {
    ch6_allhands: [
      { speaker: 'Comms Lead', text: "We're live to every employee. Please don't wave. The internet clips waves." },
      { speaker: 'Jensen', text: 'I owe my family and all of you an apology.' },
      { speaker: 'Engineer', text: 'Thanks. Quick note: the chat is 98% heart emojis and nobody can find mute.' },
      { speaker: 'Comms Lead', text: "Clip's out. The internet already made a slow-mo edit of your jacket. 2M likes." },
    ],
    ch6_boardroom: [
      { speaker: 'Board Chair', text: "The board has opened an independent investigation. We found people who've somehow never seen your jacket." },
      { speaker: 'Investigator', text: "Hello. I'm independent. I brought my own pens, my own snacks and my own chair." },
      { speaker: 'Jensen', text: 'Should I come in?' },
      { speaker: 'Board Chair', text: "No. That's the independent part. Please keep running somewhere else." },
    ],
    ch6_factory: [
      { speaker: 'Teen', text: 'Meme Factory, hi. 40,000 memes about you since lunch. Mostly hearts.' },
      { speaker: 'Jensen', text: 'These memes are... excellent. Can you do one about our chips?' },
      { speaker: 'Teen', text: "Chips don't trend. Jackets do. Shift ends in five: log off, or post through it?",
        choices: [
          { text: 'Log off', effects: { stock: -6, board: 10, washington: 5 }, next: 'ch6_factory_logoff' },
          { text: 'Post through it', effects: { stock: 8, board: -10, washington: -5 }, next: 'ch6_factory_post' },
        ] },
    ],
    ch6_factory_logoff: [
      { speaker: 'Teen', text: 'Respect. The memes will miss you for about four minutes.' },
    ],
    ch6_factory_post: [
      { speaker: 'Teen', text: 'Bold. Belt speed set to eleven. Hope you like hearts.' },
    ],
  };

  // ------------------------------------------------------------------ the twist: going viral
  const params = {
    startViews: 10000,
    growthPerSecond: 0.12, // continuous rate with no context collected
    slowdownPerToken: 0.1, // rate = growthPerSecond / (1 + slowdownPerToken * tokens)
    hitMultiplier: 2,
    hitStockCost: 3,
    maxViews: 8e9,
    maxDt: 0.1, // longer frames (tab switches, stops) are clamped
    hookTimeoutMs: 1000, // hurt()/addCollect() calls this long after the last onUpdate are ignored
    milestones: [1e5, 1e6, 1e7, 1e8, 1e9],
    milestoneLines: [
      '100K views. Someone turned your jacket into a lo-fi playlist.',
      '1M views. The heart-eyes emoji is now your unofficial logo.',
      '10M views. There is a remix. It slaps, apparently.',
      '100M views. Your jacket has more followers than you do.',
      '1 BILLION views. The servers are running on your chips. Awkward.',
    ],
    tokenLineEvery: 10,
    tokenLine: 'Context added. The comments calm down a little.',
    hitLines: ['Ouch! That trip is a reaction GIF now.', 'Splat! Someone added sad violin music.',
      'Oof! Clipped, captioned and reposted.', 'Bonk! That is a sticker pack now.'],
    endJokes: [
      { below: 2.5e5, text: 'Barely viral. The internet moved on to a cat in a tiny leather jacket.' },
      { below: 2.5e6, text: 'Comfortably viral. Your jacket now has its own fan account.' },
      { below: 2.5e7, text: 'Very viral. Someone made a ten-hour remix. It has a dance.' },
      { below: 1e9, text: 'Mega viral. Three documentaries and a musical are in development.' },
      { text: 'You broke the internet. Good news: it runs on your chips.' },
    ],
  };

  const TAG = '__ch6MemeStormOriginal';
  const busy = { hurt: false, addCollect: false }; // shared, so a call through nested wrappers counts once
  const endCard = { title: 'You Went Viral', lines: [] };
  let viral = null; // live state, also exposed as game.state.viral
  let currentGame = null;

  function shortCount(n) {
    const units = [[1e9, 'B'], [1e6, 'M'], [1e3, 'K']];
    for (let i = 0; i < units.length; i++) {
      const v = units[i][0];
      if (n >= v) {
        const x = n / v;
        return (x < 10 ? x.toFixed(1).replace(/\.0$/, '') : String(Math.floor(x))) + units[i][1];
      }
    }
    return String(Math.round(n));
  }
  const fullCount = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const now = () => Date.now();
  const say = (game, text) => { if (typeof game.say === 'function') game.say(text); };
  const heartsOf = game => (game.hero && typeof game.hero.hearts === 'number' ? game.hero.hearts : null);
  function collectedOf(game) {
    if (typeof game.collected === 'number') return game.collected;
    if (game.state && typeof game.state.collected === 'number') return game.state.collected;
    return null;
  }
  // The hook wrappers only count while this chapter is being updated. If the engine stops calling
  // onUpdate (quit, fail, a clamp short of the finish, the next chapter reusing game.state), they go quiet.
  const isActive = game => !!viral && !viral.done && game === currentGame && !!game.state &&
    game.state.viral === viral && now() - viral.lastTick <= params.hookTimeoutMs;

  function refreshEndCard() {
    const v = viral ? viral.views : params.startViews;
    const joke = params.endJokes.find(j => j.below === undefined || v < j.below).text;
    endCard.lines.length = 0; // updated in place so a shallow copy of the chapter still sees it
    endCard.lines.push(
      'Final view count: ' + fullCount(v) + ' views.',
      joke,
      'Hits: ' + (viral ? viral.hits : 0) + ' (each one doubled the views). Context tokens: ' + (viral ? viral.tokens : 0) + '.',
      'The independent investigation continues. So do the memes.');
  }

  function registerHit(game) {
    viral.hits += 1;
    viral.views = Math.min(params.maxViews, viral.views * params.hitMultiplier);
    if (game.meters && typeof game.meters.stock === 'number') {
      game.meters.stock = Math.max(0, game.meters.stock - params.hitStockCost);
    }
    say(game, params.hitLines[(viral.hits - 1) % params.hitLines.length] + ' Views x' + params.hitMultiplier +
      ', now ' + shortCount(viral.views) + '. Stock -' + params.hitStockCost + '.');
  }

  function registerTokens(game, n) {
    if (!(n > 0)) return;
    const before = viral.tokens;
    viral.tokens += n;
    if (Math.floor(viral.tokens / params.tokenLineEvery) > Math.floor(before / params.tokenLineEvery)) say(game, params.tokenLine);
  }

  // Best effort against an unfinished engine API: hits are read from hero.hearts when the engine tracks it,
  // otherwise from game.hurt() calls; context from game.addCollect() calls or a numeric collected counter.
  function countHurt(game, orig, self, args) {
    const before = heartsOf(game);
    const out = orig.apply(self, args);
    const after = heartsOf(game);
    if (before === null || after === null || after < before) registerHit(game);
    viral.lastHearts = after;
    return out;
  }

  function countCollect(game, orig, self, args) {
    const out = orig.apply(self, args);
    registerTokens(game, typeof args[0] === 'number' ? args[0] : 1);
    viral.lastCollected = collectedOf(game);
    return out;
  }

  function wrap(game, key, counter) {
    const orig = game[key];
    if (typeof orig !== 'function' || orig[TAG]) return;
    const wrapped = function () {
      if (busy[key]) return orig.apply(this, arguments);
      if (!isActive(game)) {
        if (game[key] === wrapped) game[key] = orig; // step aside; onUpdate re-wraps if the chapter resumes
        return orig.apply(this, arguments);
      }
      busy[key] = true;
      try { return counter(game, orig, this, arguments); } finally { busy[key] = false; }
    };
    wrapped[TAG] = orig;
    game[key] = wrapped;
  }

  function installWrappers(game) {
    wrap(game, 'hurt', countHurt);
    wrap(game, 'addCollect', countCollect);
  }

  function removeWrappers(game) {
    ['hurt', 'addCollect'].forEach(k => { if (game[k] && game[k][TAG]) game[k] = game[k][TAG]; });
  }

  function start(game) {
    if (!game.state || typeof game.state !== 'object') game.state = {};
    viral = {
      views: params.startViews, label: 'VIEWS ' + shortCount(params.startViews), hits: 0, tokens: 0,
      rate: params.growthPerSecond, milestone: 0, done: false, lastTick: now(),
      lastHearts: heartsOf(game), lastCollected: collectedOf(game),
    };
    currentGame = game;
    game.state.viral = viral;
    installWrappers(game);
    refreshEndCard();
  }

  function finish(game) {
    viral.done = true;
    removeWrappers(game);
    refreshEndCard();
  }

  refreshEndCard();

  // ------------------------------------------------------------------ chapter
  return {
    id: 'ch6',
    title: 'Meme Storm',
    dateline: 'The Internet, November 8-9, 2026',
    outfit: 'jacket',
    hideMeters: false,
    length: LENGTH,
    speed: { base: 15, max: 19 },
    frontPage: {
      headline: 'SORRY, SAYS CEO. HEART-EYES, SAYS INTERNET',
      sub: 'The chip boss apologises to staff and the board opens an independent investigation. The internet opens 40 million tabs.',
    },
    theme: {
      sky: '#12002b', fog: '#2a0b55', fogNear: 30, fogFar: 160, ground: '#0a0420', road: '#1a0f3d',
      laneLine: '#22e6ff', lightColor: '#ffc2f4', lightIntensity: 0.95, ambient: '#5b3c9a',
    },
    scenery,
    obstacles,
    collectible,
    stops: [
      { at: 200, title: 'All-Hands, Live', landmark: { x: -8, build: buildAllHands }, dialogueId: 'ch6_allhands' },
      { at: 500, title: 'The Boardroom Door', landmark: { x: 7.5, build: buildBoardroom }, dialogueId: 'ch6_boardroom' },
      { at: LENGTH, title: 'The Meme Factory', landmark: { x: -8, build: buildMemeFactory }, dialogueId: 'ch6_factory' },
    ],
    dialogues,
    mechanic: {
      summary: 'Going viral. A view counter starts at 10,000. While the hero is running (game.speed > 0 and game.paused ' +
        'is not true, before the finish), views grow continuously: each frame views = views * e^(rate * dt), dt capped at ' +
        '0.1 s, where rate per second = 0.12 / (1 + 0.1 * context tokens collected so far). So 10 tokens halve the growth ' +
        'rate and 30 cut it to a quarter. Context never lowers the count; it only slows future growth. Every 10th token says ' +
        '"Context added. The comments calm down a little." Every hit (the hero losing a heart, or a game.hurt() call if ' +
        'hearts are not tracked) doubles the current views, lowers Stock by 3 (not below 0) and says one of four rotating ' +
        'hit jokes followed by "Views x2, now <count>. Stock -3." with the count shortened (66K, 1.2M). Hits and tokens only ' +
        'count while this chapter is updating: game.hurt() and game.addCollect() calls more than 1 s after its last ' +
        'onUpdate are ignored; if updates resume, a drop in hero.hearts or a rise in the collected counter since the last ' +
        'update still counts. Views are capped at 8 billion. The first time views pass 100K, 1M, 10M, 100M and 1B a ' +
        'one-line joke is said (if one frame passes several, only the highest). Growth stops when distance reaches the ' +
        'chapter length. The end card shows the final count, hits, tokens and a joke chosen by the count: under 250K, ' +
        'under 2.5M, under 25M, under 1B, or 1B and over. Live values for a HUD: game.state.viral ' +
        '{views, label, hits, tokens, rate}.',
      params,
    },
    onStart(game) { start(game); },
    onUpdate(game, dt) {
      if (!viral || currentGame !== game) start(game);
      if (viral.done) return;
      viral.lastTick = now();
      installWrappers(game); // re-wraps if the wrappers stepped aside during a long pause
      dt = Math.min(Math.max(Number(dt) || 0, 0), params.maxDt);

      const h = heartsOf(game);
      if (h !== null) {
        if (viral.lastHearts !== null && h < viral.lastHearts) registerHit(game);
        viral.lastHearts = h;
      }
      const c = collectedOf(game);
      if (c !== null) {
        if (viral.lastCollected !== null && c > viral.lastCollected) registerTokens(game, c - viral.lastCollected);
        viral.lastCollected = c;
      }

      viral.rate = params.growthPerSecond / (1 + params.slowdownPerToken * viral.tokens);
      if (game.speed > 0 && !game.paused) viral.views = Math.min(params.maxViews, viral.views * Math.exp(viral.rate * dt));

      let crossed = -1; // only announce the highest milestone passed this frame
      while (viral.milestone < params.milestones.length && viral.views >= params.milestones[viral.milestone]) crossed = viral.milestone++;
      if (crossed >= 0) say(game, params.milestoneLines[crossed]);
      viral.label = 'VIEWS ' + shortCount(viral.views);

      if (typeof game.distance === 'number' && game.distance >= LENGTH) finish(game);
      else refreshEndCard();
    },
    endCard,
  };
};
