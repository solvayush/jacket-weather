/* Jacket Weather extras: floating meme cards and roadside logo billboards.
   Loaded as a classic script after the game's inline script, so it shares its globals
   (scene, camera, game, run, burst, pop, sfx, THREE). Everything here is optional: any failure
   is caught and the game carries on without it. */
(function () {
  'use strict';
  if (typeof THREE === 'undefined' || typeof scene === 'undefined' || typeof run === 'undefined') return;

  /* ---------- drawing helpers (canvas 2D, all original art) ---------- */
  const GREEN = '#76b900', RED = '#e5484d', GOLD = '#f5c542', INK = '#14181a';

  function rr(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
    g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
    g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
  }
  function heart(g, cx, cy, s, col) {
    g.fillStyle = col; g.beginPath();
    g.moveTo(cx, cy + s * 0.9);
    g.bezierCurveTo(cx - s * 1.5, cy - s * 0.2, cx - s * 0.7, cy - s * 1.2, cx, cy - s * 0.35);
    g.bezierCurveTo(cx + s * 0.7, cy - s * 1.2, cx + s * 1.5, cy - s * 0.2, cx, cy + s * 0.9);
    g.fill();
  }
  function text(g, s, x, y, size, col, align) {
    g.font = 'bold ' + size + 'px "Trebuchet MS",Arial,sans-serif';
    g.fillStyle = col; g.textAlign = align || 'center'; g.textBaseline = 'middle'; g.fillText(s, x, y);
  }
  // A hand-drawn parody emblem: a green tile with a spiral "eye". Not the company's artwork.
  function emblem(g, x, y, s) {
    g.fillStyle = GREEN; rr(g, x, y, s, s, s * 0.12); g.fill();
    g.strokeStyle = '#ffffff'; g.lineCap = 'round';
    const cx = x + s * 0.52, cy = y + s * 0.5;
    for (let i = 0; i < 3; i++) {
      g.lineWidth = s * 0.075;
      g.beginPath(); g.ellipse(cx, cy, s * (0.36 - i * 0.11), s * (0.26 - i * 0.08), 0, Math.PI * 0.55, Math.PI * 2.2); g.stroke();
    }
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(cx, cy, s * 0.05, 0, 7); g.fill();
  }
  // The hero's jacket, as a little icon (used in the lobby and kiss-cam cards).
  function jacket(g, cx, cy, s) {
    g.fillStyle = INK;
    g.beginPath(); g.moveTo(cx - s, cy - s); g.lineTo(cx + s, cy - s); g.lineTo(cx + s * 1.5, cy - s * 0.3);
    g.lineTo(cx + s * 1.1, cy); g.lineTo(cx + s, cy - s * 0.2); g.lineTo(cx + s, cy + s);
    g.lineTo(cx - s, cy + s); g.lineTo(cx - s, cy - s * 0.2); g.lineTo(cx - s * 1.1, cy);
    g.lineTo(cx - s * 1.5, cy - s * 0.3); g.closePath(); g.fill();
    g.strokeStyle = '#555c60'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(cx, cy - s); g.lineTo(cx, cy + s); g.stroke();
    g.beginPath(); g.moveTo(cx - s * 0.45, cy - s); g.lineTo(cx, cy - s * 0.45); g.lineTo(cx + s * 0.45, cy - s); g.stroke();
  }

  /* Each picture draws into a 224x176 area whose top-left is (16,16). */
  const PICS = {
    hotel(g) {
      const sky = g.createLinearGradient(0, 16, 0, 192); sky.addColorStop(0, '#1a1440'); sky.addColorStop(1, '#5a2a6a');
      g.fillStyle = sky; g.fillRect(16, 16, 224, 176);
      g.fillStyle = '#fff6c9'; for (let i = 0; i < 14; i++) g.fillRect(24 + (i * 53) % 208, 22 + (i * 31) % 60, 2, 2);
      g.fillStyle = '#2b2f4a'; g.fillRect(70, 60, 116, 132);
      for (let r = 0; r < 5; r++) for (let c = 0; c < 4; c++) {
        g.fillStyle = (r * 4 + c) % 3 === 0 ? '#3a3f63' : GOLD; g.fillRect(82 + c * 25, 72 + r * 22, 15, 13);
      }
      g.fillStyle = '#1b1d2e'; g.fillRect(114, 168, 28, 24);
      g.fillStyle = RED; rr(g, 86, 30, 84, 26, 5); g.fill();
      text(g, 'HOTEL', 128, 44, 19, '#fff');
    },
    doorhanger(g) {
      g.fillStyle = '#7a5a3c'; g.fillRect(16, 16, 224, 176);
      g.fillStyle = '#8c6a48'; g.fillRect(40, 16, 176, 176);
      g.fillStyle = GOLD; g.beginPath(); g.arc(188, 120, 10, 0, 7); g.fill();
      g.fillStyle = RED; rr(g, 84, 40, 88, 140, 10); g.fill();
      g.fillStyle = '#8c6a48'; g.beginPath(); g.arc(128, 66, 15, 0, 7); g.fill();
      text(g, 'DO', 128, 104, 22, '#fff'); text(g, 'NOT', 128, 128, 22, '#fff'); text(g, 'DISTURB', 128, 154, 17, '#fff');
    },
    keycard(g) {
      g.fillStyle = '#20262b'; g.fillRect(16, 16, 224, 176);
      g.save(); g.translate(128, 104); g.rotate(-0.12);
      g.fillStyle = '#f2efe6'; rr(g, -84, -52, 168, 104, 10); g.fill();
      g.fillStyle = GREEN; g.fillRect(-84, -52, 168, 26);
      g.fillStyle = GOLD; rr(g, -66, -12, 30, 24, 4); g.fill();
      text(g, 'ROOM', 30, -4, 18, INK); text(g, '4090', 30, 22, 30, INK);
      g.restore();
    },
    roomservice(g) {
      g.fillStyle = '#3b2430'; g.fillRect(16, 16, 224, 176);
      g.fillStyle = '#d9d2c4'; g.fillRect(16, 150, 224, 42);
      g.fillStyle = '#c9ced2'; g.beginPath(); g.ellipse(128, 150, 86, 12, 0, 0, 7); g.fill();
      g.fillStyle = '#e8ecef'; g.beginPath(); g.arc(128, 146, 62, Math.PI, 0); g.fill();
      g.fillStyle = '#aab1b6'; g.beginPath(); g.arc(128, 82, 8, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.ellipse(104, 118, 10, 22, -0.5, 0, 7); g.fill();
      text(g, 'ROOM SERVICE', 128, 40, 20, GOLD);
    },
    lobby(g) {
      g.fillStyle = '#e9dcc4'; g.fillRect(16, 16, 224, 176);
      g.fillStyle = '#b8a27c'; g.fillRect(16, 150, 224, 42);
      g.strokeStyle = GOLD; g.lineWidth = 7; g.lineCap = 'round';
      g.beginPath(); g.moveTo(66, 150); g.lineTo(66, 54); g.quadraticCurveTo(128, 20, 190, 54); g.lineTo(190, 150); g.stroke();
      g.fillStyle = '#7b2b3b'; rr(g, 60, 138, 136, 14, 4); g.fill();
      g.fillStyle = INK; g.beginPath(); g.arc(80, 160, 8, 0, 7); g.arc(176, 160, 8, 0, 7); g.fill();
      jacket(g, 128, 92, 30);
    },
    hotgpu(g) {
      g.fillStyle = '#2a0f18'; g.fillRect(16, 16, 224, 176);
      heart(g, 128, 104, 62, RED);
      g.strokeStyle = INK; g.lineWidth = 6;
      g.strokeRect(84, 82, 36, 22); g.strokeRect(136, 82, 36, 22);
      g.beginPath(); g.moveTo(120, 92); g.lineTo(136, 92); g.stroke();
      g.strokeStyle = '#fff'; g.lineWidth = 5; g.beginPath(); g.arc(128, 122, 20, 0.2, Math.PI - 0.2); g.stroke();
    },
    kisscam(g) {
      g.fillStyle = '#101826'; g.fillRect(16, 16, 224, 176);
      g.fillStyle = 'rgba(245,197,66,.28)'; g.beginPath(); g.moveTo(128, 16); g.lineTo(60, 192); g.lineTo(196, 192); g.closePath(); g.fill();
      jacket(g, 128, 128, 34);
      heart(g, 62, 62, 16, '#ff7aa2'); heart(g, 196, 74, 12, '#ff7aa2'); heart(g, 178, 40, 8, '#ff7aa2');
      g.fillStyle = RED; rr(g, 70, 24, 116, 26, 5); g.fill(); text(g, 'KISS CAM', 128, 38, 18, '#fff');
    },
    honeypot(g) {
      g.fillStyle = '#fbe9b0'; g.fillRect(16, 16, 224, 176);
      g.fillStyle = '#e39a1a'; rr(g, 78, 66, 100, 110, 26); g.fill();
      g.fillStyle = '#b9730f'; rr(g, 70, 52, 116, 22, 8); g.fill();
      g.fillStyle = GOLD; g.beginPath(); g.moveTo(86, 74); g.quadraticCurveTo(104, 120, 120, 74); g.quadraticCurveTo(140, 104, 150, 74); g.closePath(); g.fill();
      g.fillStyle = '#fff7df'; rr(g, 92, 112, 72, 34, 6); g.fill(); text(g, 'HONEY', 128, 130, 17, '#8a5a0c');
      text(g, '?', 206, 56, 44, RED);
    },
    logo(g) {
      g.fillStyle = '#0b0f0c'; g.fillRect(16, 16, 224, 176);
      emblem(g, 76, 28, 104);
      text(g, 'NVIDIA', 128, 162, 34, '#ffffff');
    }
  };
  const CAPTIONS = {
    hotel: 'THE INTERNET CHECKED IN',
    doorhanger: 'HE IS READING THE COMMENTS',
    keycard: 'ROOM 4090. OF COURSE.',
    roomservice: 'ONE HUMBLE PIE, PLEASE',
    lobby: 'JACKET SPOTTED IN LOBBY',
    hotgpu: 'GPU: HOT. GOSSIP: HOTTER.',
    kisscam: 'KISS CAM FOUND THE JACKET',
    honeypot: 'HONEYPOT? UNVERIFIED.',
    logo: 'STOCK STATUS: COMPLICATED'
  };

  /* ---------- textures / materials (built once, lazily) ---------- */
  const cardGeo = new THREE.PlaneGeometry(1.5, 1.8);
  const mats = {};
  function cardMat(kind) {
    if (mats[kind]) return mats[kind];
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 256;
    const g = cv.getContext('2d');
    g.fillStyle = '#fbfaf5'; g.fillRect(0, 0, 256, 256);          // polaroid frame
    g.save(); g.beginPath(); g.rect(16, 16, 224, 176); g.clip(); PICS[kind](g); g.restore();
    g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 2; g.strokeRect(16, 16, 224, 176);
    let fs = 18; g.font = 'bold ' + fs + 'px "Trebuchet MS",Arial,sans-serif';
    while (fs > 9 && g.measureText(CAPTIONS[kind]).width > 226) { fs--; g.font = 'bold ' + fs + 'px "Trebuchet MS",Arial,sans-serif'; }
    text(g, CAPTIONS[kind], 128, 224, fs, INK);
    const tex = new THREE.CanvasTexture(cv);
    return (mats[kind] = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
  }
  let boardMat = null;
  function billboardMat() {
    if (boardMat) return boardMat;
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256;
    const g = cv.getContext('2d');
    g.fillStyle = '#0b0f0c'; g.fillRect(0, 0, 512, 256);
    g.strokeStyle = GREEN; g.lineWidth = 10; g.strokeRect(8, 8, 496, 240);
    emblem(g, 34, 48, 160);
    text(g, 'NVIDIA', 348, 108, 76, '#ffffff');
    text(g, 'the jacket people', 348, 178, 28, GREEN);
    return (boardMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv) }));
  }

  /* ---------- which chapters get what ---------- */
  const ALL = Object.keys(PICS);
  const FLOW = {
    ch5: { n: 3, kinds: ['hotel', 'honeypot', 'doorhanger', 'logo'] },
    ch6: { n: 7, kinds: ALL },
    ch7: { n: 2, kinds: ['hotel', 'kisscam', 'logo', 'lobby'] },
    ch8: { n: 2, kinds: ['logo', 'hotgpu', 'keycard'] }
  };
  const NO_BILLBOARD = { prologue: 1 };   // 1993: the company does not exist yet

  /* ---------- scene objects ---------- */
  const root = new THREE.Group(); root.name = 'extras'; scene.add(root);
  const cards = [];
  for (let i = 0; i < 7; i++) {
    const m = new THREE.Mesh(cardGeo, undefined); m.visible = false; root.add(m);
    cards.push({ m, on: false, vx: 0, ph: 0, y0: 3, wait: 0, kind: '' });
  }
  const boards = [];
  for (let i = 0; i < 2; i++) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.22, 5.2, 0.22), new THREE.MeshLambertMaterial({ color: 0x3a4046 }));
    pole.position.y = 2.6; g.add(pole);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 2.2), undefined); face.position.set(0, 6.2, 0.14); g.add(face);
    const back = new THREE.Mesh(new THREE.BoxGeometry(4.6, 2.4, 0.2), new THREE.MeshLambertMaterial({ color: 0x1b2024 })); back.position.y = 6.2; g.add(back);
    g.visible = false; root.add(g); boards.push({ g, face, side: i ? 1 : -1 });
  }

  let liked = 0, chId = '', lastDist = -1, rngS = 12345;
  const rnd = () => { rngS = (rngS * 1664525 + 1013904223) >>> 0; return rngS / 4294967296; };

  // small counter in the HUD
  const tag = document.createElement('div');
  tag.style.cssText = 'position:absolute;right:16px;bottom:16px;font:bold 15px "Trebuchet MS",Arial,sans-serif;color:#ff9db8;text-shadow:0 2px 0 #000;pointer-events:none;display:none';
  (document.getElementById('hud') || document.body).appendChild(tag);
  function showTag() { tag.textContent = '♥ MEMES LIKED ' + liked + '   (click or jump into them)'; tag.style.display = 'block'; }

  function heroZ() { return -run.hero.dist; }

  function launch(c, cfg, first) {
    const hz = heroZ();
    c.kind = cfg.kinds[Math.floor(rnd() * cfg.kinds.length)];
    c.m.material = cardMat(c.kind);
    const fromLeft = rnd() < 0.5;
    c.vx = (fromLeft ? 1 : -1) * (0.5 + rnd() * 1.1);
    c.y0 = rnd() < 0.35 ? 2.7 + rnd() * 0.4 : 3.6 + rnd() * 2.2;     // about a third are low enough to jump into
    c.ph = rnd() * 6.28;
    c.m.position.set((fromLeft ? -1 : 1) * (2.5 + rnd() * 4.5), c.y0, hz - (first ? 18 + rnd() * 50 : 55 + rnd() * 25));
    c.m.scale.setScalar(1);
    c.m.visible = true; c.on = true;
  }
  function retire(c, delay) { c.on = false; c.m.visible = false; c.wait = delay; }

  function like(c) {
    const p = c.m.position;
    try { burst(p.x, p.y, p.z, 0xff7aa2, 12, 4, 0.12); pop(p.x, p.y, p.z, '♥ +1'); sfx('collect'); } catch (e) { /* cosmetic */ }
    liked++; showTag(); retire(c, 1.2 + rnd() * 1.5);
  }

  function placeBoard(b, ahead) {
    b.face.material = billboardMat();
    b.g.position.set(b.side * 5.1, 0, heroZ() - ahead);
    b.g.rotation.y = -b.side * 0.35;
    b.g.visible = true;
  }

  function reset(ch) {
    chId = ch ? ch.id : '';
    cards.forEach(c => retire(c, rnd() * 2));
    liked = 0; tag.style.display = 'none';
    boards.forEach(b => { b.g.visible = false; });
    if (ch && !NO_BILLBOARD[chId]) { placeBoard(boards[0], 70); placeBoard(boards[1], 150); }
  }

  function step(dt) {
    const ch = game.chapter, playing = game.state === 'play' || game.state === 'dialogue';
    if (!ch || !playing) { if (root.visible) root.visible = false; return; }
    root.visible = true;
    // a new chapter, a restart or a retry (distance jumped backwards) starts the flow again
    if (ch.id !== chId || run.hero.dist < lastDist - 5) reset(ch);
    lastDist = run.hero.dist;
    const hz = heroZ(), h = run.hero, cfg = FLOW[chId];

    for (const b of boards) if (b.g.visible && b.g.position.z > hz + 12) placeBoard(b, 150 + rnd() * 60);

    if (!cfg) return;
    let live = 0;
    for (const c of cards) {
      if (!c.on) { c.wait -= dt; continue; }
      live++;
      const p = c.m.position;
      c.ph += dt;
      p.x += c.vx * dt; p.y = c.y0 + Math.sin(c.ph * 1.7) * 0.25;
      p.z -= run.speed * 0.55 * dt;                       // drift along with the hero so cards linger
      c.m.rotation.z = Math.sin(c.ph * 1.3) * 0.12; c.m.rotation.y = Math.sin(c.ph * 0.9) * 0.3;
      if (p.z > hz + 4 || Math.abs(p.x) > 9) { retire(c, 0.5 + rnd() * 2); continue; }
      // jumping into a low card likes it
      if (Math.abs(p.z - hz) < 0.9 && Math.abs(p.x - h.x) < 1.0 && (h.y || 0) + 1.9 > p.y - 0.9) like(c);
    }
    if (live < cfg.n) {
      const c = cards.find(q => !q.on && q.wait <= 0);
      if (c) launch(c, cfg, false);
    }
  }

  /* ---------- clicking / tapping a card ---------- */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  addEventListener('pointerdown', e => {
    try {
      if (game.state !== 'play' || game.paused || !root.visible) return;
      ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hits = ray.intersectObjects(cards.filter(c => c.on).map(c => c.m), false);
      if (hits.length) { const c = cards.find(q => q.m === hits[0].object); if (c) like(c); }
    } catch (err) { /* ignore */ }
  });

  /* ---------- hook into the game loop ---------- */
  let broken = false;
  const baseUpdate = update;
  update = function (dt) {
    baseUpdate(dt);
    if (broken || game.paused) return;
    try { step(dt); } catch (err) { broken = true; root.visible = false; if (window.console) console.warn('extras disabled:', err); }
  };

  window.__extras = { cards, boards, get liked() { return liked; }, step, reset, PICS, CAPTIONS };
})();
