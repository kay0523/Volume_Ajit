// The hideout stage: a retro DS-style pixel jazz cafe. The world is drawn into a small buffer (objects get a dark
// pixel outline), graded toward a faded palette and scaled up with a screen-door grid. Text stays crisp on top.
(function () {
  const canvas = document.getElementById('stage');
  const main = canvas.getContext('2d');
  const buf = document.createElement('canvas'), bctx = buf.getContext('2d');
  const objL = document.createElement('canvas'), octx = objL.getContext('2d');
  const tint = document.createElement('canvas'), tctx = tint.getContext('2d');
  let ctx = bctx;
  let grid = null;
  const G = 980;
  const CH = 1.15; // character scale
  const ROOM_W = 760; // minimum room width in logical units
  const FONT = 'Galmuri11, monospace';
  const FONT_B = '"Galmuri11 Bold", Galmuri11, monospace';

  const PAL = {
    wall: '#d8d2c6', wallLine: '#c6bfb1', wallDk: '#b3ab9c',
    wood: '#8a6a50', woodDk: '#5e4636', woodLt: '#a8876a', beam: '#4b3a30',
    floor: '#8b7f77', floorLine: '#766a62', floorLt: '#998d84',
    red: '#9c4a3f', redDk: '#76362f', mustard: '#c09a4e', navy: '#414860', teal: '#5f7e85', green: '#6f8a62', greenDk: '#536b4b',
    cream: '#ece4d2', ink: '#2e2724', metal: '#a29e96', metalDk: '#5f5c57', glow: '#f6d58e', fire: '#e0823f', fire2: '#f4c65a',
    outline: '#2b221e',
  };

  // view: logical units (≈400 tall). P = css px per buffer pixel; q = buffer px per logical unit.
  const view = { W: 800, WW: 800, H: 400, s: 1, dpr: 1, floor: 360, P: 3, q: 0.5, bw: 1, bh: 1, cssW: 1, cssH: 1, camX: 0, camHold: 0 };
  let layout = null;

  function resize() {
    const wrap = canvas.parentElement.getBoundingClientRect();
    if (!wrap.width || !wrap.height) return;
    view.cssW = wrap.width; view.cssH = wrap.height;
    view.dpr = Math.min(window.devicePixelRatio || 1, 2);
    view.s = Math.max(0.45, Math.min(wrap.height / 330, wrap.width / 300));
    const sFull = wrap.width / ROOM_W; // zoom out a little if that shows the whole room
    if (sFull < view.s && sFull >= wrap.height / 430) view.s = sFull;
    view.P = Math.max(2, Math.round(view.s / 0.55));
    view.q = view.s / view.P;
    view.bw = Math.ceil(wrap.width / view.P); view.bh = Math.ceil(wrap.height / view.P);
    for (const c of [buf, objL, tint]) { c.width = view.bw; c.height = view.bh; }
    canvas.width = Math.round(view.bw * view.P * view.dpr); canvas.height = Math.round(view.bh * view.P * view.dpr);
    canvas.style.width = view.bw * view.P + 'px'; canvas.style.height = view.bh * view.P + 'px';
    view.W = wrap.width / view.s; view.H = wrap.height / view.s;
    view.WW = Math.max(view.W, ROOM_W); // the room is at least this wide; narrow screens follow with a camera
    view.floor = view.H - 30;
    grid = null;
    buildLayout();
    for (const c of chars) {
      c.x = Math.min(Math.max(c.x, 14), view.WW - 14);
      if (c.task && c.task.phase === 'do') seatChar(c);
      else if (c.task) startTask(c, c.task.spot, c.task.manual);
      else { c.y = Math.min(c.y, view.floor); c.ground = false; c.steps = []; c.climbing = false; }
    }
  }

  // ---------- layout & rest spots ----------
  const occ = {}; // spotId -> [slot|null per seat]
  function buildLayout() {
    const W = view.WW, F = view.floor;
    const loftY = F - 134, loftX1 = Math.max(200, W * 0.36);
    const ladderX = loftX1 - 14;
    const br = Math.max(26, Math.min(38, W * 0.065));
    const barX0 = loftX1 + Math.max(16, W * 0.03), barX1 = barX0 + Math.max(96, W * 0.17);
    const jukeX = barX1 + 24;
    const shopX0 = jukeX + 28, shopX1 = shopX0 + 118;
    const winX0 = Math.max(shopX1 + 14, W * 0.8 - 30), winX1 = winX0 + Math.max(52, W * 0.08);
    const sofaX0 = Math.max(winX1 + 12, W - 104), sofaX1 = Math.min(W - 8, sofaX0 + 88);
    const board = { x: Math.min(W - br - 14, (sofaX0 + sofaX1) / 2), y: F - 150, r: br };
    const line = { x0: winX0 - 6, x1: winX1 + 6 };
    const sp = (id, n, e, pose, seats, hit, fx, desc) => ({ id, n, e, pose, seats, hit, fx, desc });
    const stoveX = Math.max(30, W * 0.05);
    const spots = [
      sp('stove', '난로 불멍', '🔥', 'warm', [{ x: stoveX + 34, y: F, dir: -1, level: 0 }],
        { x0: stoveX - 22, y0: F - 70, x1: stoveX + 22, y1: F }, { focus: 15, msg: '🔥 타닥타닥… 불멍 중' }, '정신력 +15'),
      sp('manga', '만화방', '📚', 'read', [{ x: W * 0.17, y: F - 2, dir: 1, level: 0 }, { x: W * 0.29, y: F - 2, dir: -1, level: 0 }],
        { x0: W * 0.13, y0: F - 112, x1: W * 0.33, y1: F }, { focus: 10, exp: 4, msg: '📚 만화책 정주행 중' }, '정신력 +10 · EXP'),
      sp('tent', '텐트 낮잠', '⛺', 'tent', [{ x: W * 0.09, y: loftY, dir: 1, level: 1 }],
        { x0: W * 0.09 - 30, y0: loftY - 56, x1: W * 0.09 + 30, y1: loftY }, { focus: 30, msg: '⛺ 텐트에서 꿀잠' }, '정신력 +30'),
      sp('hammock', '해먹', '🛌', 'lie', [{ x: W * 0.28, y: loftY - 24, dir: 1, level: 1 }],
        { x0: W * 0.28 - 40, y0: loftY - 64, x1: W * 0.28 + 40, y1: loftY }, { focus: 25, msg: '🛌 해먹에서 흔들흔들' }, '정신력 +25'),
      sp('bar', '재즈 바', '☕', 'sip', [0, 1, 2].map((k) => ({ x: barX0 + 16 + k * ((barX1 - barX0 - 32) / 2), y: F - 22, dir: -1, level: 0 })),
        { x0: barX0, y0: F - 62, x1: barX1, y1: F }, { caffeine: 35, msg: '☕ 핸드드립 한 잔' }, '카페인 +35'),
      sp('jukebox', '주크박스', '🎷', 'listen', [{ x: jukeX + 22, y: F, dir: -1, level: 0 }],
        { x0: jukeX - 15, y0: F - 60, x1: jukeX + 15, y1: F }, { music: true, focus: 5, msg: '🎷 재즈 한 곡' }, '재즈 켜기/끄기'),
      sp('window', '창가 자리', '🌧️', 'zone', [{ x: (winX0 + winX1) / 2, y: F - 18, dir: -1, level: 0 }],
        { x0: winX0, y0: F - 126, x1: winX1, y1: F }, { focus: 15, msg: '🌧️ 창밖 보며 멍…' }, '정신력 +15'),
      sp('gacha', '가챠샵', '🎰', 'crank', [0, 1, 2].map((k) => ({ x: shopX0 + 20 + k * 39 - 13, y: F, dir: 1, level: 0 })),
        { x0: shopX0, y0: F - 92, x1: shopX1, y1: F }, { msg: '🎰 가챠 구경 중' }, '피규어 뽑기'),
      sp('sofa', '소파', '🛋️', 'sit', [{ x: sofaX0 + 24, y: F - 15, dir: 1, level: 0 }, { x: sofaX1 - 24, y: F - 15, dir: -1, level: 0 }],
        { x0: sofaX0, y0: F - 42, x1: sofaX1, y1: F }, { focus: 10, msg: '🛋️ 소파에 푹' }, '정신력 +10'),
    ];
    for (const s of spots) if (!occ[s.id] || occ[s.id].length !== s.seats.length) occ[s.id] = s.seats.map(() => null);
    const shelf = { x0: W * 0.18, x1: Math.min(loftX1 - 30, W * 0.18 + 8 * 20), y: loftY - 74 };
    const machines = ['band', 'chim', 'idol'].map((key, k) => ({ key, x: shopX0 + 20 + k * 39, hit: { x0: shopX0 + 6 + k * 39, y0: F - 72, x1: shopX0 + 34 + k * 39, y1: F } }));
    layout = { board, line, loftY, loftX1, ladderX, barX0, barX1, jukeX, winX0, winX1, sofaX0, sofaX1, stoveX, spots, shelf, shopX0, shopX1, machines,
      byId: Object.fromEntries(spots.map((s) => [s.id, s])) };
  }
  const levelY = (lv) => (lv === 1 ? layout.loftY : view.floor);
  const levelOf = (c) => (c.x <= layout.loftX1 + 2 && c.y <= layout.loftY + 4 ? 1 : 0);
  const levelRange = (lv) => (lv === 1 ? [12, layout.loftX1 - 12] : [14, view.WW - 14]);

  // ---------- characters ----------
  // One character per person in the room, keyed by their id. Only people who are actually here get a character.
  const chars = [];
  const profiles = {}; // id -> { name, status, look }
  const hashN = (str) => { let h = 7; for (const ch of String(str)) h = (h * 31 + ch.codePointAt(0)) >>> 0; return h; };
  function defaultLook(id) {
    const b = NG.CHARS[hashN(id) % NG.CHARS.length];
    const o = {}; for (const k of ['hairStyle', 'hair', 'skin', 'top', 'pants', 'coat', 'acc', 'hat', 'hatColor']) o[k] = b[k];
    o.hair = NG.LOOK.hair[hashN(id + 'h') % NG.LOOK.hair.length];
    o.top = NG.LOOK.top[hashN(id + 't') % NG.LOOK.top.length];
    return o;
  }
  const getChar = (id) => chars.find((c) => c.id === id) || null;
  function ensureChar(id) {
    let c = getChar(id);
    if (c) return c;
    const p = profiles[id] || {};
    c = { id, i: hashN(id) % 97, d: NG.sanitizeLook(p.look, defaultLook(id)), name: p.name || '손님', status: p.status || null,
      anim: null, animT: 0, x: (layout ? view.WW : 700) - 24, y: view.floor, vx: 0, vy: 0, dir: -1, ground: true,
      aiT: 0.2, walkT: 0, blinkT: 2, emoteT: 1.6, emote: '👋', bubble: null, bubbleT: 0, dropUntil: 0, throwT: 0,
      locked: false, sit: false, steps: [], task: null, pose: null, climbing: false, manual: false, remote: null };
    if (layout) planTo(c, 0, view.WW * (0.35 + (c.i % 30) / 100)); // walk in from the door
    chars.push(c);
    return c;
  }
  function removeChar(id) {
    const k = chars.findIndex((c) => c.id === id);
    if (k < 0) return;
    freeSeat(chars[k]);
    chars.splice(k, 1);
  }

  function freeSeat(c) {
    if (!c.task) return;
    const o = occ[c.task.spot];
    if (o && o[c.task.seat] === c.id) o[c.task.seat] = null;
  }
  function standUp(c) {
    const doing = c.task && c.task.phase === 'do';
    const lv = doing ? layout.byId[c.task.spot]?.seats[c.task.seat]?.level ?? 0 : null;
    freeSeat(c);
    c.task = null; c.pose = null; c.steps = []; c.climbing = false;
    if (doing) { c.y = levelY(lv); c.ground = true; if (c.x > view.WW - 14) c.x = view.WW - 14; }
  }
  // Walk (and climb the ladder if needed) to x on level lv.
  function planTo(c, lv, x) {
    c.steps = [];
    if (levelOf(c) !== lv) { c.steps.push({ k: 'walk', x: layout.ladderX }); c.steps.push({ k: 'climb', lv }); }
    c.steps.push({ k: 'walk', x });
  }
  function startTask(c, spotId, manual) {
    const s = layout.byId[spotId];
    if (!s) return false;
    const o = occ[spotId];
    let seat = o.findIndex((v) => v === c.id);
    if (seat < 0) seat = o.findIndex((v) => v == null);
    if (seat < 0) return false;
    standUp(c);
    o[seat] = c.id;
    c.task = { spot: spotId, seat, phase: 'path', manual, until: 0 };
    c.sit = false; c.animT = 0;
    planTo(c, s.seats[seat].level, s.seats[seat].x);
    return true;
  }
  function seatChar(c) {
    const s = layout.byId[c.task.spot];
    if (!s) { standUp(c); return; }
    const seat = s.seats[c.task.seat];
    c.x = seat.x; c.y = seat.y; c.dir = seat.dir; c.vx = 0; c.vy = 0; c.ground = true; c.pose = s.pose;
  }

  function think(c) {
    const r = Math.random();
    c.sit = false;
    if (r < 0.45) {
      const free = layout.spots.filter((s) => occ[s.id].some((v) => v == null));
      const s = free[Math.floor(Math.random() * free.length)];
      if (s && startTask(c, s.id, false)) return;
    }
    if (r < 0.75) {
      const lv = Math.random() < 0.25 ? 1 - levelOf(c) : levelOf(c);
      const [a, b] = levelRange(lv);
      planTo(c, lv, a + Math.random() * (b - a)); return;
    }
    if (r < 0.85) { c.pose = 'zone'; c.aiT = 4 + Math.random() * 4; return; }
    if (r < 0.9 && c.ground) { c.vy = -470; c.ground = false; c.vx = (Math.random() - 0.5) * 160; c.aiT = 1.2; return; }
    if (r < 0.95 && c.status) { c.emote = c.status.e; c.emoteT = 1.6; }
    c.aiT = 1 + Math.random() * 2.5;
  }

  function updateChar(c, dt) {
    c.blinkT -= dt;
    if (c.blinkT < -0.12) c.blinkT = 2 + Math.random() * 3;
    if (c.emoteT > 0) c.emoteT -= dt;
    if (c.bubbleT > 0) c.bubbleT -= dt;
    if (c.throwT > 0) c.throwT -= dt;
    if (c.animT > 0) c.animT -= dt;

    // Someone else is playing this character: follow their stream instead of running AI/physics here.
    if (c.remote) {
      if (performance.now() - c.remote.at < 6000 && !(NG.app && NG.app.me === c.id)) { followRemote(c, dt); return; }
      c.gone = true; return; // they left the room

    }

    if (c.task && c.task.phase === 'do') {
      seatChar(c);
      if (!c.task.manual && performance.now() > c.task.until) { standUp(c); c.aiT = 0.5 + Math.random(); }
      return;
    }
    if (c.pose === 'zone' && !c.task) {
      c.vx = 0; c.aiT -= dt;
      if (c.aiT <= 0) { c.pose = null; c.aiT = 0.5; }
      return;
    }
    if (c.animT > 0 && c.ground) c.vx = 0;
    else if (c.locked) { if (c.ground) c.vx = 0; }
    else if (c.steps.length) {
      const st = c.steps[0];
      if (st.k === 'climb') {
        c.climbing = true; c.vx = 0; c.x = layout.ladderX; c.ground = false; c.vy = 0;
        const ty = levelY(st.lv), d = ty - c.y;
        if (Math.abs(d) < 3) { c.y = ty; c.climbing = false; c.ground = true; c.steps.shift(); }
        else { c.y += Math.sign(d) * Math.min(Math.abs(d), 85 * dt); c.walkT += dt * 5; }
        return;
      }
      if (c.ground) {
        const d = st.x - c.x;
        if (Math.abs(d) < 3) { c.x = st.x; c.vx = 0; c.steps.shift(); }
        else c.vx = Math.sign(d) * (c.manual || (c.task && c.task.manual) ? 100 : 72);
      }
      if (!c.steps.length) {
        if (c.task) {
          c.task.phase = 'do';
          c.task.until = performance.now() + (9 + Math.random() * 14) * 1000;
          seatChar(c);
          if (NG.stage.onArrive) NG.stage.onArrive(c.id, c.task.spot, c.task.manual);
          return;
        }
        c.aiT = c.manual ? 3 : 0.6 + Math.random() * 2; c.manual = false;
      }
    } else {
      if (c.ground) c.vx = 0;
      c.aiT -= dt;
      if (c.aiT <= 0) think(c);
    }

    if (c.vx) c.dir = Math.sign(c.vx);
    const prevY = c.y;
    c.x = Math.max(12, Math.min(view.WW - 12, c.x + c.vx * dt));
    if (!c.ground) {
      c.vy += G * dt;
      c.y += c.vy * dt;
      if (c.vy > 0) {
        if (c.y >= view.floor) { c.y = view.floor; land(c); }
        else if (performance.now() > c.dropUntil && c.x <= layout.loftX1 && prevY <= layout.loftY && c.y >= layout.loftY) { c.y = layout.loftY; land(c); }
      }
    } else if (c.y < view.floor - 2 && c.x > layout.loftX1 + 2) { c.ground = false; c.vy = 0; } // stepped off the loft
    if (c.ground) c.walkT += Math.abs(c.vx) * dt * 0.09; else if (!c.climbing) c.walkT = 0;
  }
  function land(c) { c.ground = true; c.vy = 0; if (!c.steps.length) c.vx = 0; }

  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  const box = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };

  // ---------- character sprite ----------
  const SIT_POSES = { sit: 1, read: 1, sip: 1, warm: 1, zone: 1 };
  function drawChar(c, t) {
    const d = c.d;
    const pose = c.pose;
    if (pose === 'tent') { // only the shoes poke out of the tent door
      ctx.save(); ctx.translate(c.x, c.y); ctx.scale(CH, CH);
      box(-9, -4, 7, 4, '#3a2b2b'); box(2, -4, 7, 4, '#3a2b2b');
      ctx.restore(); return;
    }
    const sw = Math.sin(c.walkT * 2.2);
    const anim = c.animT > 0 ? c.anim : null;
    const dance = anim === 'dance';
    const listen = pose === 'listen';
    const bob = dance ? Math.abs(Math.sin(t * 9)) * 4 : listen ? Math.abs(Math.sin(t * 4.2)) * 2
      : c.ground && !pose ? (c.vx ? Math.abs(sw) * 1.6 : Math.sin(t * 2 + c.i) * 0.6) : 0;
    ctx.save();
    ctx.translate(c.x, c.y);
    if (pose === 'lie') { // hammock: lie on the back, gently swinging
      ctx.rotate(Math.sin(t * 1.4) * 0.05);
      ctx.translate(-26 * CH, -2);
      ctx.rotate(Math.PI / 2);
    } else if (!c.climbing && !SIT_POSES[pose]) {
      ctx.fillStyle = 'rgba(40,30,25,.22)';
      ctx.beginPath(); ctx.ellipse(0, 0, 13, 3.5, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.scale(CH, CH);
    if (c.climbing) ctx.scale(1, 1); else ctx.scale(c.dir, 1);
    const sitting = (SIT_POSES[pose] || (c.sit && c.ground && !c.vx)) && !anim;
    ctx.translate(0, -bob + (sitting ? 7 : 0));
    if (dance) ctx.rotate(Math.sin(t * 9) * 0.12);

    ctx.fillStyle = d.hair;
    if (d.hairStyle === 'long') { rr(-16, -58, 32, 34, 10); ctx.fill(); }

    // legs
    ctx.fillStyle = d.pants;
    const leg = (ox, a) => { ctx.save(); ctx.translate(ox, -14); ctx.rotate(a); rr(-3, 0, 6, sitting ? 8 : 12, 2.5); ctx.fill();
      ctx.fillStyle = '#3a2b2b'; rr(-3.5, sitting ? 6 : 10, 8, 4, 2); ctx.fill(); ctx.fillStyle = d.pants; ctx.restore(); };
    let la = dance ? Math.sin(t * 9) * 0.5 : c.ground ? sw * 0.6 : 0.5;
    if (c.climbing) la = Math.sin(c.walkT * 2) * 0.35;
    if (pose === 'sit' || pose === 'read' || pose === 'sip') la = Math.sin(t * 2 + c.i) * 0.12; // dangling feet
    leg(-4, sitting ? -1.35 + la : la); leg(4, sitting ? -1.35 - la : -la);

    // body
    ctx.fillStyle = d.top;
    rr(-10, -32, 20, 20, 6); ctx.fill();
    if (d.coat) {
      ctx.fillStyle = '#eef0f2'; rr(-11, -32, 22, 22, 6); ctx.fill();
      ctx.fillStyle = d.top; ctx.fillRect(-3, -32, 6, 10);
    } else {
      ctx.fillStyle = 'rgba(0,0,0,.1)'; ctx.beginPath(); ctx.moveTo(-5, -32); ctx.lineTo(0, -26); ctx.lineTo(5, -32); ctx.fill();
    }

    // arms
    const throwing = c.throwT > 0;
    const arm = (ox, a) => { ctx.save(); ctx.translate(ox, -29); ctx.rotate(a);
      ctx.fillStyle = d.coat ? '#eef0f2' : d.top; rr(-3, 0, 6, 12, 3); ctx.fill();
      ctx.fillStyle = d.skin; ctx.beginPath(); ctx.arc(0, 13, 3, 0, 7); ctx.fill(); ctx.restore(); };
    let aL = c.ground ? -sw * 0.5 + 0.15 : 0.9;
    let aR = throwing ? -2.4 + (0.35 - c.throwT) * 6 : (c.ground ? sw * 0.5 - 0.15 : -0.9);
    if (c.climbing) { aL = -2.7 + Math.sin(c.walkT * 2) * 0.3; aR = -2.7 - Math.sin(c.walkT * 2) * 0.3; }
    if (pose) { aL = 0.12; aR = -0.12; }
    if (pose === 'read') { aL = -1.15; aR = -1.15; }
    if (pose === 'warm') { aL = -1.35 + Math.sin(t * 3) * 0.08; aR = -1.45 - Math.sin(t * 3) * 0.08; }
    if (pose === 'sip') aR = -1.9 + Math.sin(t * 0.8) * 0.15;
    if (pose === 'lie') { aL = -2.6; aR = -2.8; } // hands behind the head
    if (listen) { aL = 0.2 + Math.sin(t * 4.2) * 0.2; aR = -0.2 - Math.sin(t * 4.2) * 0.2; }
    if (pose === 'crank') aR = -1.5 + Math.sin(t * 7) * 0.5;
    if (anim === 'wave') aR = -2.6 + Math.sin(t * 14) * 0.45;
    if (anim === 'cheer') { aL = 2.8 + Math.sin(t * 12) * 0.2; aR = -2.8 - Math.sin(t * 12) * 0.2; }
    if (dance) { aL = 2.2 + Math.sin(t * 9) * 0.8; aR = -2.2 + Math.sin(t * 9 + Math.PI) * 0.8; }
    if (anim === 'sip') aR = -1.9;
    if (!c.climbing) arm(-10, aL);
    if (pose === 'read') { box(5, -38, 14, 11, '#9c4a3f'); box(6, -37, 12, 9, '#ece4d2'); box(11.5, -38, 1, 11, '#76362f'); }
    if (pose === 'sip' || anim === 'sip') { box(10, -46, 8, 9, '#ece4d2'); box(11, -45, 6, 2, '#6b4630'); box(18, -43, 2, 4, '#ece4d2'); }
    arm(10, aR);
    if (c.climbing) arm(-10, aL);

    // head
    ctx.translate(0, -46);
    let tilt = c.emoteT > 0 ? Math.sin(t * 10) * 0.08 : dance ? Math.sin(t * 9 + 1) * 0.1 : 0;
    if (listen) tilt = Math.sin(t * 4.2) * 0.12;
    if (pose === 'zone') tilt = 0.08;
    if (pose === 'read') tilt = 0.12;
    ctx.rotate(tilt);
    ctx.fillStyle = d.hair;
    if (d.hairStyle === 'twin') {
      ctx.beginPath(); ctx.ellipse(-19, 4, 6, 11, 0.3, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(19, 4, 6, 11, -0.3, 0, 7); ctx.fill();
    }
    if (d.hairStyle === 'bun') { ctx.beginPath(); ctx.arc(-4, -19, 7, 0, 7); ctx.fill(); }
    ctx.fillStyle = d.skin;
    ctx.beginPath(); ctx.ellipse(0, 0, 16, 15, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = d.hair;
    switch (d.hairStyle) {
      case 'bob':
        ctx.beginPath(); ctx.ellipse(0, -5, 17.5, 13, 0, Math.PI, 0); ctx.fill();
        rr(-18, -6, 7, 18, 4); ctx.fill(); rr(11, -6, 7, 14, 4); ctx.fill();
        ctx.beginPath(); ctx.ellipse(-5, -8, 10, 6, -0.3, 0, Math.PI * 2); ctx.fill();
        break;
      case 'long':
        ctx.beginPath(); ctx.ellipse(0, -5, 17.5, 13, 0, Math.PI, 0); ctx.fill();
        rr(-18, -6, 6, 24, 3); ctx.fill();
        ctx.beginPath(); ctx.ellipse(4, -8, 12, 5, 0.2, 0, Math.PI * 2); ctx.fill();
        break;
      case 'spiky':
        ctx.beginPath(); ctx.moveTo(-17, -2);
        for (let k = 0; k <= 6; k++) { const a = Math.PI + (k / 6) * Math.PI; ctx.lineTo(Math.cos(a) * 21, -4 + Math.sin(a) * 18); ctx.lineTo(Math.cos(a + 0.26) * 14, -4 + Math.sin(a + 0.26) * 12); }
        ctx.lineTo(17, -2); ctx.fill();
        break;
      case 'short':
        ctx.beginPath(); ctx.ellipse(0, -6, 17, 12, 0, Math.PI, 0); ctx.fill();
        ctx.beginPath(); ctx.ellipse(6, -7, 11, 5, 0.3, 0, Math.PI * 2); ctx.fill();
        rr(-17, -7, 5, 9, 3); ctx.fill();
        break;
      default:
        ctx.beginPath(); ctx.ellipse(0, -5, 17, 12, 0, Math.PI, 0); ctx.fill();
        rr(-17, -6, 5, 10, 3); ctx.fill();
        ctx.beginPath(); ctx.ellipse(5, -8, 11, 5, 0.25, 0, Math.PI * 2); ctx.fill();
    }
    // face (climbing shows the back of the head)
    if (!c.climbing) {
      const blink = c.blinkT < 0;
      const sleepy = (c.status && c.status.e === '😴') || pose === 'lie';
      const happy = anim === 'dance' || anim === 'cheer' || anim === 'wave' || listen;
      ctx.fillStyle = '#2b2233'; ctx.strokeStyle = '#2b2233'; ctx.lineWidth = 1.8;
      if (happy) {
        ctx.beginPath(); ctx.arc(3.5, 2, 2.4, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
        ctx.beginPath(); ctx.arc(11, 2, 2.4, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
      } else if (blink || sleepy || pose === 'read') {
        ctx.fillRect(1, pose === 'read' ? 3 : 1, 5, 1.8); ctx.fillRect(9, pose === 'read' ? 3 : 1, 5, 1.8);
      } else if (pose === 'zone') {
        ctx.fillRect(3, 0, 2, 2); ctx.fillRect(10, 0, 2, 2);
      } else {
        ctx.beginPath(); ctx.ellipse(3.5, 1, 2.3, 3.2, 0, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.ellipse(11, 1, 2.3, 3.2, 0, 0, 7); ctx.fill();
      }
      ctx.fillStyle = 'rgba(200,110,110,.35)';
      ctx.beginPath(); ctx.arc(1, 6.5, 2.6, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(14, 6.5, 2.6, 0, 7); ctx.fill();
      if (d.acc === 'mask') {
        ctx.fillStyle = '#e4e8ec'; rr(-1, 3, 17, 9, 3); ctx.fill();
      } else {
        ctx.strokeStyle = '#5a2e2e'; ctx.lineWidth = 1.4; ctx.beginPath();
        if ((c.status && c.status.e === '🤭') || pose === 'zone') { ctx.moveTo(5.5, 8.5); ctx.lineTo(9.5, 8.5); }
        else if (happy) ctx.arc(7.5, 6, 3, 0, Math.PI);
        else if (sleepy) ctx.arc(7.5, 8.5, 1.6, 0, 7);
        else ctx.arc(7.5, 6.5, 2.4, 0.15, Math.PI - 0.15);
        ctx.stroke();
      }
      if (d.acc === 'glasses') {
        ctx.strokeStyle = '#2b2a33'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(3.5, 1, 4.4, 0, 7); ctx.stroke();
        ctx.beginPath(); ctx.arc(11.8, 1, 4.4, 0, 7); ctx.stroke();
      } else if (d.acc === 'sunglasses') {
        ctx.fillStyle = '#1d1d2b'; rr(-1.5, -2.5, 9, 6, 2.5); ctx.fill(); rr(8, -2.5, 9, 6, 2.5); ctx.fill(); ctx.fillRect(6, -1.5, 3, 1.4);
      }
    }
    if (d.hat === 'cap') {
      ctx.fillStyle = d.hatColor;
      ctx.beginPath(); ctx.ellipse(0, -8, 17, 11, 0, Math.PI, 0); ctx.fill();
      rr(4, -10, 20, 5, 2.5); ctx.fill();
    } else if (d.hat === 'beanie') {
      ctx.fillStyle = d.hatColor;
      ctx.beginPath(); ctx.ellipse(0, -8, 17, 13, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.3)'; rr(-17, -10, 34, 5, 2.5); ctx.fill();
      ctx.fillStyle = d.hatColor; ctx.beginPath(); ctx.arc(0, -22, 4, 0, 7); ctx.fill();
    } else if (d.hat === 'ribbon') {
      ctx.fillStyle = d.hatColor;
      ctx.beginPath(); ctx.moveTo(6, -13); ctx.lineTo(-3, -20); ctx.lineTo(-3, -6); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(6, -13); ctx.lineTo(15, -20); ctx.lineTo(15, -6); ctx.closePath(); ctx.fill();
    } else if (d.hat === 'headphones') {
      ctx.strokeStyle = '#2d2f45'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, -2, 18, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
      ctx.fillStyle = d.hatColor; rr(-21, -6, 7, 13, 3); ctx.fill(); rr(14, -6, 7, 13, 3); ctx.fill();
    } else if (d.hat === 'surgical') {
      ctx.fillStyle = d.hatColor;
      ctx.beginPath(); ctx.ellipse(0, -7, 18, 12, 0, Math.PI, 0); ctx.fill();
    }
    ctx.restore();
  }

  // Crisp overlay effects for a character (drawn after the pixel upscale).
  function headTop(c) {
    if (c.pose === 'tent') { const s = layout.byId.tent; return s ? s.seats[0].y - 60 : c.y - 70; }
    if (c.pose === 'lie') return c.y - 34;
    return c.y - (SIT_POSES[c.pose] ? 66 : 74) * CH * 0.95;
  }
  function drawCharFx(c, t) {
    const top = headTop(c);
    const T = Math.min(2.4, Math.max(1, 1.45 / view.s));
    ctx.textAlign = 'center';
    const sleepy = (c.status && c.status.e === '😴') || c.pose === 'lie' || c.pose === 'tent';
    if (sleepy) {
      ctx.font = `${12 * T}px ${FONT}`; ctx.fillStyle = '#6c7bd8';
      const k = (t * 0.8 + c.i * 0.3) % 1;
      ctx.globalAlpha = 1 - k; ctx.fillText('z', c.x + 14 + k * 8, top - k * 14);
      ctx.globalAlpha = Math.max(0, 1 - ((k + 0.5) % 1)); ctx.fillText('Z', c.x + 18 + ((k + 0.5) % 1) * 8, top - 4 - ((k + 0.5) % 1) * 14);
      ctx.globalAlpha = 1;
    }
    if (c.pose === 'zone') {
      ctx.font = `${12 * T}px ${FONT}`; ctx.fillStyle = '#5f5c57';
      ctx.fillText('.'.repeat(1 + Math.floor(t * 1.5 + c.i) % 3), c.x + 16, top + 4);
    }
    if (c.pose === 'listen' || c.animT > 0 && c.anim === 'dance') {
      ctx.font = `${12 * T}px ${FONT}`; ctx.fillStyle = '#9c4a3f';
      ctx.fillText('♪', c.x - 18 + Math.sin(t * 3) * 3, top + 8 - (t * 20 % 14)); ctx.fillText('♫', c.x + 18, top + 14 - ((t * 20 + 7) % 14));
    }
    if (c.emoteT > 0 && c.emote) {
      ctx.font = `${20 * T}px sans-serif`;
      ctx.fillText(c.emote, c.x, top - 8 * T - (1.6 - c.emoteT) * 10);
    }
    ctx.textAlign = 'left';
  }

  // ---------- room: background layer (no outline) ----------
  function timeMood() {
    const h = new Date().getHours() + new Date().getMinutes() / 60;
    if (h < 6 || h >= 19.5) return { sky: ['#2e3452', '#46507a'], night: true };
    if (h < 8.5) return { sky: ['#c9b6a6', '#e2d6c6'], night: false };
    if (h >= 17) return { sky: ['#b98f7c', '#dcb79a'], night: false };
    return { sky: ['#a9bccb', '#d4dde2'], night: false };
  }
  const rain = Array.from({ length: 40 }, () => ({ x: Math.random(), y: Math.random(), v: 0.6 + Math.random() * 0.5 }));

  function windowAt(x0, y0, w, h, t, mood) {
    box(x0 - 4, y0 - 4, w + 8, h + 8, PAL.woodDk);
    const g = ctx.createLinearGradient(0, y0, 0, y0 + h);
    g.addColorStop(0, mood.sky[0]); g.addColorStop(1, mood.sky[1]);
    ctx.fillStyle = g; ctx.fillRect(x0, y0, w, h);
    ctx.fillStyle = mood.night ? '#262a40' : '#8d97a3';
    for (let i = 0; i < w; i += 9) { const bh = 10 + ((i * 37) % 23); ctx.fillRect(x0 + i, y0 + h - bh, 8, bh); }
    if (mood.night) { ctx.fillStyle = '#e8cf8a'; for (let i = 3; i < w; i += 9) if ((i * 7) % 3 === 0) ctx.fillRect(x0 + i, y0 + h - 8, 2, 2); }
    ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, w, h); ctx.clip();
    ctx.strokeStyle = mood.night ? 'rgba(170,185,220,.55)' : 'rgba(255,255,255,.6)'; ctx.lineWidth = 1;
    for (const r of rain) {
      const yy = y0 + ((r.y + t * r.v) % 1) * (h + 10) - 10;
      const xx = x0 + r.x * w;
      ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx - 2, yy + 6); ctx.stroke();
    }
    ctx.restore();
    box(x0 + w / 2 - 1.5, y0, 3, h, PAL.woodDk); box(x0, y0 + h / 2 - 1.5, w, 3, PAL.woodDk);
    box(x0 - 6, y0 + h + 2, w + 12, 5, PAL.wood);
  }

  function drawRoom(t, mood) {
    const W = view.WW, H = view.H, F = view.floor;
    const L = layout;
    box(0, 0, W, F, PAL.wall);
    ctx.fillStyle = PAL.wallLine;
    for (let x = 8; x < W; x += 18) ctx.fillRect(x, 0, 1.5, F);
    // ceiling beams
    box(0, 0, W, 9, PAL.beam);
    for (let x = 30; x < W; x += 120) box(x, 9, 8, 6, PAL.woodDk);
    // wainscot
    box(0, F - 42, W, 42, PAL.wood);
    box(0, F - 44, W, 4, PAL.woodDk);
    ctx.fillStyle = PAL.woodDk; for (let x = 12; x < W; x += 26) ctx.fillRect(x, F - 40, 1.5, 40);
    // windows
    windowAt(L.barX0 + 12, F - 216, L.barX1 - L.barX0 - 24, 50, t, mood);
    windowAt(L.winX0 + 4, F - 120, L.winX1 - L.winX0 - 8, 62, t, mood);
    // bar back shelves
    box(L.barX0 + 2, F - 104, L.barX1 - L.barX0 - 4, 4, PAL.woodDk);
    box(L.barX0 + 2, F - 82, L.barX1 - L.barX0 - 4, 4, PAL.woodDk);
    const bottles = [PAL.greenDk, PAL.red, PAL.mustard, PAL.teal, PAL.cream, PAL.navy];
    for (let x = L.barX0 + 8, k = 0; x < L.barX1 - 10; x += 9, k++) {
      const h = 10 + (k * 5) % 6;
      box(x, F - 104 - h, 6, h, bottles[k % bottles.length]); box(x + 2, F - 108 - h, 2, 4, bottles[k % bottles.length]);
      if (k % 2 === 0) box(x, F - 92, 7, 10, '#e9e1cf');
    }
    // sign over the bar
    // (pixel text is drawn in drawPixelText after the scale-up layer)
    // pendant lamp cords
    ctx.fillStyle = PAL.ink;
    for (const lx of lampXs()) ctx.fillRect(lx - 0.5, 9, 1, lampY() - 9);
    // poster & record on the right wall
    const px = L.winX1 + 10;
    if (L.sofaX0 - px > 26) { box(px, F - 178, 24, 32, PAL.navy); box(px + 3, F - 175, 18, 18, PAL.mustard); box(px + 3, F - 154, 18, 3, PAL.cream); }
    ctx.fillStyle = PAL.ink; ctx.beginPath(); ctx.arc(L.barX1 + 24, F - 150, 11, 0, 7); ctx.fill();
    ctx.fillStyle = PAL.red; ctx.beginPath(); ctx.arc(L.barX1 + 24, F - 150, 4, 0, 7); ctx.fill();
    // upper wall: clock, hanging plants and, on tall screens, bunting and a sign
    const clx = (L.winX0 + L.winX1) / 2, cly = F - 168;
    ctx.fillStyle = PAL.woodDk; ctx.beginPath(); ctx.arc(clx, cly, 15, 0, 7); ctx.fill();
    ctx.fillStyle = PAL.cream; ctx.beginPath(); ctx.arc(clx, cly, 12, 0, 7); ctx.fill();
    const now = new Date(), hA = ((now.getHours() % 12) + now.getMinutes() / 60) / 12 * Math.PI * 2, mA = now.getMinutes() / 60 * Math.PI * 2;
    ctx.strokeStyle = PAL.ink; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(clx, cly); ctx.lineTo(clx + Math.sin(hA) * 6, cly - Math.cos(hA) * 6);
    ctx.moveTo(clx, cly); ctx.lineTo(clx + Math.sin(mA) * 9, cly - Math.cos(mA) * 9); ctx.stroke();
    for (let x = 90, k = 0; x < W - 40; x += 150, k++) {
      const py = Math.min(F - 230, 40 + (k % 2) * 22);
      if (py < 24) continue;
      ctx.strokeStyle = PAL.woodDk; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, 9); ctx.lineTo(x, py); ctx.stroke();
      box(x - 7, py, 14, 10, PAL.redDk);
      ctx.fillStyle = PAL.green;
      for (let v = 0; v < 4; v++) { ctx.fillRect(x - 8 + v * 5, py + 8, 2, 8 + ((v * 7 + k) % 9)); }
      ctx.fillStyle = PAL.greenDk; ctx.beginPath(); ctx.ellipse(x, py, 10, 5, 0, Math.PI, 0); ctx.fill();
    }
    if (F - 300 > 30) {
      const by = F - 300;
      ctx.strokeStyle = PAL.ink; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, by); ctx.quadraticCurveTo(W / 2, by + 26, W, by); ctx.stroke();
      const flags = [PAL.red, PAL.mustard, PAL.teal, PAL.cream, PAL.green];
      for (let x = 8, k = 0; x < W; x += 22, k++) {
        const yy = by + Math.sin((x / W) * Math.PI) * 13;
        ctx.fillStyle = flags[k % flags.length]; ctx.beginPath(); ctx.moveTo(x - 6, yy); ctx.lineTo(x + 6, yy); ctx.lineTo(x, yy + 11); ctx.fill();
      }
    }
    // under-loft nook is darker
    ctx.fillStyle = 'rgba(60,45,35,.16)'; ctx.fillRect(0, L.loftY, L.loftX1, F - L.loftY);
    // string lights over the loft
    ctx.strokeStyle = PAL.ink; ctx.lineWidth = 1;
    ctx.beginPath();
    const sy = L.loftY - 96;
    for (let x = 0; x <= L.loftX1; x += 6) ctx.lineTo(x, sy + Math.sin((x / L.loftX1) * Math.PI * 3) * 6 + 6);
    ctx.stroke();
    const bulbs = [PAL.glow, '#e8a0a0', '#a8c8e0', '#c8e0a0'];
    for (let x = 10, k = 0; x < L.loftX1; x += 20, k++) {
      ctx.fillStyle = (Math.floor(t * 1.2) + k) % 3 === 0 ? '#6e665e' : bulbs[k % 4];
      ctx.fillRect(x - 1.5, sy + Math.sin((x / L.loftX1) * Math.PI * 3) * 6 + 7, 3, 4);
    }
    // floor
    box(0, F, W, H - F, PAL.floor);
    ctx.fillStyle = PAL.floorLine;
    for (let y = F + 7; y < H; y += 8) ctx.fillRect(0, y, W, 1.2);
    for (let y = F, row = 0; y < H; y += 8, row++) for (let x = (row % 2) * 22; x < W; x += 44) ctx.fillRect(x, y, 1.2, 8);
    box(0, F, W, 2, PAL.floorLt);
    // rug under the sofa
    box(L.sofaX0 - 10, F + 2, L.sofaX1 - L.sofaX0 + 20, 10, PAL.red);
    ctx.fillStyle = PAL.cream; for (let x = L.sofaX0 - 6; x < L.sofaX1 + 8; x += 8) ctx.fillRect(x, F + 6, 4, 2);
    // throw line
    box(L.line.x0, F + 3, L.line.x1 - L.line.x0, 2, 'rgba(236,228,210,.8)');
  }
  const lampXs = () => [layout.barX0 + (layout.barX1 - layout.barX0) * 0.3, layout.barX0 + (layout.barX1 - layout.barX0) * 0.75];
  const lampY = () => view.floor - 178;

  // ---------- room: object layer (gets the pixel outline) ----------
  function drawProps(t, musicOn) {
    const F = view.floor, L = layout;
    const used = (id) => occ[id] && occ[id].some((v) => v != null);
    // loft slab, posts, railing, ladder
    box(0, L.loftY, L.loftX1, 9, PAL.wood); box(0, L.loftY + 7, L.loftX1, 3, PAL.woodDk);
    box(L.loftX1 - 6, L.loftY, 6, F - L.loftY, PAL.woodDk);
    box(L.loftX1 * 0.5, L.loftY + 9, 5, F - L.loftY - 9, PAL.woodDk);
    box(L.ladderX - 8, L.loftY - 16, 3, F - L.loftY + 16, PAL.woodLt); box(L.ladderX + 5, L.loftY - 16, 3, F - L.loftY + 16, PAL.woodLt);
    for (let y = L.loftY - 8; y < F - 4; y += 13) box(L.ladderX - 6, y, 12, 2.5, PAL.woodLt);
    // stove
    const sx = L.stoveX;
    box(sx - 3, 9, 6, F - 52, PAL.metalDk);
    rr(sx - 17, F - 50, 34, 44, 5); ctx.fillStyle = '#4a4642'; ctx.fill();
    box(sx - 15, F - 6, 4, 6, '#3a3734'); box(sx + 11, F - 6, 4, 6, '#3a3734');
    box(sx - 10, F - 36, 20, 16, '#2b2826');
    const fl = Math.sin(t * 13) * 2 + Math.sin(t * 7.3) * 1.5;
    ctx.fillStyle = PAL.fire; ctx.beginPath(); ctx.moveTo(sx - 8, F - 21); ctx.lineTo(sx - 2, F - 33 - fl); ctx.lineTo(sx + 4, F - 26); ctx.lineTo(sx + 8, F - 21); ctx.fill();
    ctx.fillStyle = PAL.fire2; ctx.beginPath(); ctx.moveTo(sx - 4, F - 21); ctx.lineTo(sx, F - 28 + fl); ctx.lineTo(sx + 4, F - 21); ctx.fill();
    box(sx - 24, F - 14, 8, 14, PAL.woodLt); box(sx - 23, F - 20, 6, 6, PAL.wood); // log basket
    // manga bookshelf
    const m0 = L.byId.manga.hit.x0, m1 = L.byId.manga.hit.x1;
    box(m0, F - 92, m1 - m0, 88, PAL.woodDk);
    const spines = [PAL.red, PAL.navy, PAL.mustard, PAL.green, PAL.cream, PAL.teal, '#b07a6a'];
    for (let r = 0; r < 4; r++) {
      const y = F - 90 + r * 21;
      box(m0 + 3, y + 17, m1 - m0 - 6, 3, PAL.wood);
      for (let x = m0 + 4, k = r * 3; x < m1 - 8; x += 5, k++) {
        if ((k * 13) % 11 === 0) { x += 3; continue; }
        box(x, y + 3 + (k % 3), 4, 14 - (k % 3), spines[k % spines.length]);
      }
    }
    // bean bags
    ctx.fillStyle = PAL.red; ctx.beginPath(); ctx.ellipse(L.byId.manga.seats[0].x - 2, F - 7, 15, 9, 0, 0, 7); ctx.fill();
    ctx.fillStyle = PAL.teal; ctx.beginPath(); ctx.ellipse(L.byId.manga.seats[1].x + 2, F - 7, 15, 9, 0, 0, 7); ctx.fill();
    // tent
    const tx = L.byId.tent.seats[0].x, ty = L.loftY;
    ctx.fillStyle = '#c4a57c'; ctx.beginPath(); ctx.moveTo(tx - 32, ty); ctx.lineTo(tx, ty - 52); ctx.lineTo(tx + 32, ty); ctx.fill();
    ctx.fillStyle = used('tent') ? '#e6c47a' : '#5a4636'; ctx.beginPath(); ctx.moveTo(tx - 11, ty); ctx.lineTo(tx, ty - 30); ctx.lineTo(tx + 11, ty); ctx.fill();
    ctx.fillStyle = '#a4845e'; ctx.beginPath(); ctx.moveTo(tx, ty - 52); ctx.lineTo(tx + 32, ty); ctx.lineTo(tx + 20, ty); ctx.lineTo(tx - 2, ty - 40); ctx.fill();
    box(tx - 1, ty - 58, 2, 8, PAL.woodDk); ctx.fillStyle = PAL.red; ctx.beginPath(); ctx.moveTo(tx + 1, ty - 58); ctx.lineTo(tx + 9, ty - 55); ctx.lineTo(tx + 1, ty - 52); ctx.fill();
    // hammock
    const hx = L.byId.hammock.seats[0].x, hy = L.loftY;
    box(hx - 42, hy - 50, 4, 50, PAL.woodDk); box(hx + 38, hy - 50, 4, 50, PAL.woodDk);
    const sway = used('hammock') ? Math.sin(t * 1.4) * 2 : 0;
    ctx.strokeStyle = PAL.cream; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(hx - 38, hy - 46); ctx.lineTo(hx - 30, hy - 30 + sway); ctx.moveTo(hx + 38, hy - 46); ctx.lineTo(hx + 30, hy - 30 + sway); ctx.stroke();
    ctx.fillStyle = PAL.red; ctx.beginPath(); ctx.moveTo(hx - 31, hy - 31 + sway);
    ctx.quadraticCurveTo(hx, hy - 12 + sway, hx + 31, hy - 31 + sway); ctx.quadraticCurveTo(hx, hy - 20 + sway, hx - 31, hy - 31 + sway); ctx.fill();
    ctx.strokeStyle = PAL.cream; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(hx - 28, hy - 28 + sway); ctx.quadraticCurveTo(hx, hy - 13 + sway, hx + 28, hy - 28 + sway); ctx.stroke();
    // figure shelf on the loft wall
    box(L.shelf.x0, L.shelf.y, L.shelf.x1 - L.shelf.x0, 4, PAL.wood);
    box(L.shelf.x0 + 4, L.shelf.y + 4, 3, 5, PAL.woodDk); box(L.shelf.x1 - 7, L.shelf.y + 4, 3, 5, PAL.woodDk);
    // loft railing
    for (let x = L.loftX1 - 8; x > L.loftX1 - 56; x -= 12) box(x, L.loftY - 18, 2.5, 18, PAL.woodDk);
    box(L.loftX1 - 60, L.loftY - 20, 58, 3, PAL.wood);
    // bar counter + stools
    box(L.barX0, F - 46, L.barX1 - L.barX0, 6, PAL.woodLt);
    box(L.barX0 + 3, F - 40, L.barX1 - L.barX0 - 6, 40, PAL.wood);
    ctx.fillStyle = PAL.woodDk; for (let x = L.barX0 + 10; x < L.barX1 - 6; x += 14) ctx.fillRect(x, F - 36, 1.5, 34);
    box(L.barX0 + 6, F - 62, 18, 16, PAL.metal); box(L.barX0 + 9, F - 58, 12, 6, PAL.metalDk); box(L.barX0 + 13, F - 50, 3, 4, PAL.ink);
    box(L.barX1 - 22, F - 52, 7, 6, PAL.cream); box(L.barX1 - 12, F - 52, 7, 6, PAL.cream);
    for (const s of L.byId.bar.seats) {
      box(s.x - 2, F - 20, 3, 20, PAL.metalDk); box(s.x - 7, F - 2, 13, 2, PAL.metalDk);
      rr(s.x - 9, F - 25, 17, 6, 2); ctx.fillStyle = PAL.red; ctx.fill();
    }
    // jukebox
    const jx = L.jukeX;
    rr(jx - 14, F - 58, 28, 58, 12); ctx.fillStyle = PAL.redDk; ctx.fill();
    rr(jx - 10, F - 52, 20, 20, 8); ctx.fillStyle = musicOn ? PAL.glow : '#c9b48a'; ctx.fill();
    for (let k = 0; k < 4; k++) box(jx - 9 + k * 5, F - 28, 3, 10, musicOn && (Math.floor(t * 6) + k) % 2 ? PAL.fire2 : PAL.mustard);
    box(jx - 12, F - 14, 24, 10, PAL.woodDk);
    // gacha shop: awning + three capsule machines
    const g0 = L.shopX0, g1 = L.shopX1;
    box(g0, F - 112, g1 - g0, 6, PAL.woodDk);
    for (let x = g0, k = 0; x < g1; x += 12, k++) {
      ctx.fillStyle = k % 2 ? PAL.cream : PAL.red;
      ctx.beginPath(); ctx.moveTo(x, F - 106); ctx.lineTo(x + 12, F - 106); ctx.lineTo(x + 12, F - 98); ctx.arc(x + 6, F - 98, 6, 0, Math.PI); ctx.fill();
    }
    box(g0 + 2, F - 106, 3, 106, PAL.woodDk); box(g1 - 5, F - 106, 3, 106, PAL.woodDk);
    const caps = [PAL.red, PAL.mustard, '#c77a96', PAL.teal, PAL.cream, PAL.green];
    for (const m of L.machines) {
      const col = NG.GACHA ? NG.GACHA[m.key].color : PAL.red;
      box(m.x - 12, F - 34, 24, 34, col);
      box(m.x - 8, F - 26, 16, 8, PAL.ink); box(m.x - 4, F - 12, 8, 7, '#2b2826');
      ctx.fillStyle = PAL.metal; ctx.beginPath(); ctx.arc(m.x + 8, F - 22, 3, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(214,226,228,.85)'; ctx.beginPath(); ctx.arc(m.x, F - 50, 15, 0, 7); ctx.fill();
      for (let k = 0; k < 7; k++) {
        ctx.fillStyle = caps[(k + m.key.length) % caps.length];
        ctx.beginPath(); ctx.arc(m.x - 9 + (k % 4) * 6, F - 42 - Math.floor(k / 4) * 7 - (k % 2) * 2, 3, 0, 7); ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fillRect(m.x - 9, F - 60, 3, 6);
      box(m.x - 12, F - 68, 24, 4, col);
    }
    // window seat
    box(L.winX0, F - 18, L.winX1 - L.winX0, 18, PAL.wood); rr(L.winX0 + 2, F - 24, L.winX1 - L.winX0 - 4, 7, 3); ctx.fillStyle = PAL.teal; ctx.fill();
    box(L.winX1 - 2, F - 20, 12, 20, PAL.redDk); ctx.fillStyle = PAL.green;
    ctx.beginPath(); ctx.ellipse(L.winX1 + 4, F - 28, 9, 10, 0, 0, 7); ctx.fill();
    ctx.fillStyle = PAL.greenDk; ctx.beginPath(); ctx.ellipse(L.winX1 + 1, F - 34, 5, 6, -0.4, 0, 7); ctx.fill();
    // sofa
    const s0 = L.sofaX0, s1 = L.sofaX1;
    rr(s0 + 4, F - 42, s1 - s0 - 8, 24, 6); ctx.fillStyle = '#7d5a48'; ctx.fill();
    rr(s0, F - 22, s1 - s0, 18, 5); ctx.fillStyle = '#8c6652'; ctx.fill();
    rr(s0 - 2, F - 30, 9, 26, 4); ctx.fillStyle = '#6e4e3e'; ctx.fill(); rr(s1 - 7, F - 30, 9, 26, 4); ctx.fill();
    box(s0 + 4, F - 4, 3, 4, PAL.ink); box(s1 - 7, F - 4, 3, 4, PAL.ink);
    rr(s0 + 10, F - 36, 13, 13, 3); ctx.fillStyle = PAL.mustard; ctx.fill();
    // pendant lamp shades
    for (const lx of lampXs()) { ctx.fillStyle = '#3e4440'; ctx.beginPath(); ctx.moveTo(lx - 9, lampY() + 9); ctx.lineTo(lx - 4, lampY()); ctx.lineTo(lx + 4, lampY()); ctx.lineTo(lx + 9, lampY() + 9); ctx.fill(); box(lx - 3, lampY() + 9, 6, 3, PAL.glow); }
  }

  function drawFiguresShelf(t) {
    const s = layout.shelf;
    const owned = NG.app ? NG.app.shelfFigures() : [];
    const max = Math.max(1, Math.floor((s.x1 - s.x0 - 6) / 18));
    layout.figureHits = [];
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    owned.slice(0, max).forEach((f, i) => {
      const x = s.x0 + 11 + i * 18, y = s.y + Math.sin(t * 2 + i) * (f.r === 3 ? 1.2 : 0);
      ctx.font = '12px sans-serif'; ctx.fillText(f.e, x, y - 1);
      layout.figureHits.push({ x, y: y - 7, f });
    });
    ctx.textAlign = 'left';
  }

  // Warm light pools, added after the colour grade.
  function drawLights(t, musicOn, mood) {
    const F = view.floor, L = layout;
    const glow = (x, y, r, a, col = '246,213,142') => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(0.5, `rgba(${col},${a * 0.45})`); g.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    };
    const k = mood.night ? 1 : 0.55;
    ctx.globalCompositeOperation = 'lighter';
    for (const lx of lampXs()) glow(lx, lampY() + 14, 70, 0.22 * k);
    glow(L.stoveX, F - 26, 60 + Math.sin(t * 9) * 3, 0.3 * k, '240,140,70');
    if (occ.tent && occ.tent.some((v) => v != null)) glow(L.byId.tent.seats[0].x, L.loftY - 14, 34, 0.3 * k);
    if (musicOn) glow(L.jukeX, F - 40, 40, 0.22 * k, '240,180,120');
    for (let x = 10; x < L.loftX1; x += 40) glow(x, L.loftY - 88, 18, 0.12 * k);
    ctx.globalCompositeOperation = 'source-over';
  }

  // ---------- crisp overlay: name tags, bubbles, status ----------
  // Overlay text keeps a readable on-screen size: the smaller the window, the bigger it is relative to the room.
  const TS = () => Math.min(2.4, Math.max(1, 1.45 / view.s));
  function drawLabels(c) {
    const T = TS();
    ctx.font = `11px ${FONT}`;
    const isMe = NG.app && NG.app.me === c.id;
    const w = Math.round(ctx.measureText(c.name).width) + 10;
    const ny = c.pose === 'lie' ? c.y + 6 : c.pose === 'tent' ? c.y + 3 : c.y + 4;
    ctx.save(); ctx.translate(c.x, ny); ctx.scale(T, T);
    ctx.fillStyle = isMe ? '#c0703a' : 'rgba(43,34,30,.82)';
    ctx.fillRect(Math.round(-w / 2), 0, w, 15);
    ctx.fillStyle = '#f3ead8'; ctx.textAlign = 'center';
    ctx.fillText(c.name, 0, 11.5);
    ctx.restore();

    let top = headTop(c);
    if (c.bubble && c.bubbleT > 0) top = speech(c.x, top, c.bubble, Math.min(1, c.bubbleT * 2));
    if (c.status) {
      const txt = `${c.status.e} ${c.status.t}`;
      ctx.font = `11px ${FONT}`;
      const sw = Math.round(ctx.measureText(txt).width) + 12;
      const x0 = Math.min(Math.max(c.x - sw * T / 2, view.camX + 2), view.camX + view.W - sw * T - 2);
      ctx.save(); ctx.translate(x0, top - 18 * T); ctx.scale(T, T);
      ctx.fillStyle = '#2b221e'; ctx.fillRect(-1, 0, sw + 2, 17);
      ctx.fillStyle = '#efe6d2'; ctx.fillRect(0, 1, sw, 15);
      ctx.fillStyle = '#3b302a'; ctx.textAlign = 'center'; ctx.fillText(txt, sw / 2, 12.5);
      ctx.restore();
    }
    ctx.textAlign = 'left';
  }
  function wrap(text, maxW) {
    const lines = []; let cur = '';
    for (const ch of text) {
      if (ctx.measureText(cur + ch).width > maxW && cur) { lines.push(cur); cur = ch; } else cur += ch;
      if (lines.length >= 3) break;
    }
    if (lines.length < 3 && cur) lines.push(cur);
    else if (lines.length >= 3) lines[2] = lines[2].slice(0, -1) + '…';
    return lines;
  }
  function speech(x, bottom, text, alpha) {
    const T = TS();
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.font = `11px ${FONT}`;
    const lines = wrap(text, 130);
    const w = Math.round(Math.max(...lines.map((l) => ctx.measureText(l).width)) + 14);
    const h = lines.length * 14 + 8;
    const bx = Math.min(Math.max(x - w * T / 2, view.camX + 4), view.camX + view.W - w * T - 4);
    const by = bottom - (h + 10) * T;
    ctx.translate(bx, by); ctx.scale(T, T);
    const tx = (x - bx) / T; // tail position in local units
    ctx.fillStyle = '#2b221e'; ctx.fillRect(-1, -1, w + 2, h + 2);
    ctx.fillStyle = '#fbf6ea'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#2b221e'; ctx.fillRect(tx - 3, h, 7, 2); ctx.fillRect(tx - 1, h + 2, 3, 3);
    ctx.fillStyle = '#fbf6ea'; ctx.fillRect(tx - 2, h - 1, 5, 2); ctx.fillRect(tx, h + 1, 1, 2);
    ctx.fillStyle = '#2b221e';
    lines.forEach((l, i) => ctx.fillText(l, 7, 15 + i * 14));
    ctx.restore();
    return by - 6 * T;
  }
  function tag(x, y, text) {
    const T = TS();
    ctx.font = `11px ${FONT}`;
    const w = Math.round(ctx.measureText(text).width) + 12;
    const x0 = Math.min(Math.max(x - w * T / 2, view.camX + 2), view.camX + view.W - w * T - 2);
    ctx.save(); ctx.translate(x0, y - 15 * T); ctx.scale(T, T);
    ctx.fillStyle = '#2b221e'; ctx.fillRect(0, 0, w, 16);
    ctx.fillStyle = '#f6d58e'; ctx.fillText(text, 6, 11.5);
    ctx.restore();
  }

  // ---------- darts ----------
  const ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
  const R = { bull: 0.08, outer: 0.18, triIn: 0.53, triOut: 0.62, dblIn: 0.88, dblOut: 1 };
  const dart = { active: false, left: 3, total: 0, darts: [], aimT: 0, flying: null, results: [], floatTxt: [] };

  function scoreAt(px, py) {
    const b = layout.board;
    const dx = (px - b.x) / b.r, dy = (py - b.y) / b.r;
    const d = Math.hypot(dx, dy);
    if (d > R.dblOut) return { s: 0, label: '빗나감!' };
    if (d <= R.bull) return { s: 50, label: '불스아이!!' };
    if (d <= R.outer) return { s: 25, label: '아우터 불!' };
    let a = Math.atan2(dx, -dy) * 180 / Math.PI;
    a = (a + 360 + 9) % 360;
    const n = ORDER[Math.floor(a / 18)];
    if (d >= R.triIn && d <= R.triOut) return { s: n * 3, label: `트리플 ${n}!` };
    if (d >= R.dblIn) return { s: n * 2, label: `더블 ${n}!` };
    return { s: n, label: `싱글 ${n}` };
  }
  function drawBoard() {
    const b = layout.board;
    box(b.x - b.r * 1.3, b.y - b.r * 1.3, b.r * 2.6, b.r * 2.6, PAL.woodDk);
    box(b.x - b.r * 1.22, b.y - b.r * 1.22, b.r * 2.44, b.r * 2.44, PAL.wood);
    ctx.fillStyle = '#2b2826'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 1.08, 0, 7); ctx.fill();
    const ring = (r0, r1, A, B) => {
      for (let i = 0; i < 20; i++) {
        const a0 = (-90 - 9 + i * 18) * Math.PI / 180, a1 = a0 + 18 * Math.PI / 180;
        ctx.fillStyle = i % 2 ? B : A;
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r * r1, a0, a1); ctx.arc(b.x, b.y, b.r * r0, a1, a0, true); ctx.fill();
      }
    };
    ring(R.dblIn, R.dblOut, '#a8473d', '#5d7d58');
    ring(R.triOut, R.dblIn, '#2e2a28', '#e3d6b8');
    ring(R.triIn, R.triOut, '#a8473d', '#5d7d58');
    ring(R.outer, R.triIn, '#2e2a28', '#e3d6b8');
    ctx.fillStyle = '#5d7d58'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * R.outer, 0, 7); ctx.fill();
    ctx.fillStyle = '#a8473d'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * R.bull, 0, 7); ctx.fill();
    for (const d of dart.darts) drawDart(d.x, d.y, 1);
  }
  function drawDart(x, y, scale) {
    ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
    ctx.strokeStyle = '#c9c4ba'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(7, 9); ctx.stroke();
    ctx.fillStyle = '#c0703a'; ctx.beginPath(); ctx.moveTo(7, 9); ctx.lineTo(14, 11); ctx.lineTo(11, 15); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  function aimPos(t) {
    const b = layout.board;
    const st = NG.app && NG.app.myStatus();
    let wob = 0.85;
    if (st && st.e === '😴') wob = 1.15;
    if (st && st.e === '🔥') wob = 0.65;
    const jitter = st && st.e === '☕' ? (Math.random() - 0.5) * b.r * 0.12 : 0;
    return { x: b.x + Math.sin(t * 1.9) * b.r * wob + jitter, y: b.y + Math.sin(t * 2.7 + 1.2) * b.r * wob * 0.85 + jitter };
  }
  function drawAim() {
    if (!dart.active || dart.flying || dart.left <= 0) return;
    const p = aimPos(dart.aimT);
    dart.aim = p;
    const x = Math.round(p.x), y = Math.round(p.y);
    ctx.fillStyle = '#2b221e';
    ctx.fillRect(x - 12, y - 2, 9, 4); ctx.fillRect(x + 4, y - 2, 9, 4); ctx.fillRect(x - 2, y - 12, 4, 9); ctx.fillRect(x - 2, y + 4, 4, 9);
    ctx.fillStyle = '#fbf6ea';
    ctx.fillRect(x - 11, y - 1, 7, 2); ctx.fillRect(x + 5, y - 1, 7, 2); ctx.fillRect(x - 1, y - 11, 2, 7); ctx.fillRect(x - 1, y + 5, 2, 7);
    ctx.fillStyle = '#c0703a'; ctx.fillRect(x - 1, y - 1, 2, 2);
  }
  function drawDartHud(t) {
    const b = layout.board;
    ctx.textAlign = 'center';
    if (dart.active) {
      tag(b.x, b.y + b.r * 1.3 + 20, `남은 다트 ${dart.left} · ${dart.total}점`);
    } else if (Math.floor(t * 1.4) % 2 === 0) {
      tag(b.x, b.y - b.r * 1.3 - 4, '🎯 다트!');
    }
    ctx.textAlign = 'left';
  }
  function drawFloatTexts(dt) {
    ctx.textAlign = 'center';
    for (const f of dart.floatTxt) {
      f.t -= dt; f.y -= 22 * dt;
      ctx.globalAlpha = Math.max(0, Math.min(1, f.t));
      ctx.font = `${(f.big ? 16 : 13) * TS()}px ${FONT_B}`;
      ctx.lineWidth = 4; ctx.strokeStyle = '#2b221e'; ctx.strokeText(f.s, f.x, f.y);
      ctx.fillStyle = f.c || '#f6d58e'; ctx.fillText(f.s, f.x, f.y);
    }
    ctx.globalAlpha = 1; ctx.textAlign = 'left';
    dart.floatTxt = dart.floatTxt.filter((f) => f.t > 0);
  }
  function startDart() {
    if (dart.active || NG.app.me == null) return;
    dart.active = true; dart.left = 3; dart.total = 0; dart.darts = []; dart.aimT = Math.random() * 10; dart.results = [];
    const c = getChar(NG.app.me); if (!c) return;
    standUp(c);
    c.locked = true; c.sit = false; c.pose = null; c.climbing = false;
    c.x = (layout.line.x0 + layout.line.x1) / 2; c.y = view.floor; c.ground = true; c.vy = 0; c.vx = 0;
    c.dir = layout.board.x >= c.x ? 1 : -1;
    NG.ui.toast('🎯 화면을 클릭(탭)하거나 스페이스로 던지세요!');
  }
  function throwDart() {
    if (!dart.active || dart.flying || dart.left <= 0 || !dart.aim) return;
    const c = getChar(NG.app.me); if (!c) return;
    c.throwT = 0.35;
    dart.flying = { x0: c.x + 10 * c.dir, y0: c.y - 46, x1: dart.aim.x, y1: dart.aim.y, t: 0 };
    dart.left--;
  }
  function updateDart(dt) {
    if (dart.active) dart.aimT += dt;
    const f = dart.flying;
    if (!f) return;
    f.t += dt / 0.28;
    if (f.t >= 1) {
      dart.flying = null;
      dart.darts.push({ x: f.x1, y: f.y1 });
      const r = scoreAt(f.x1, f.y1);
      dart.total += r.s; dart.results.push(r);
      dart.floatTxt.push({ s: r.s ? `${r.label} +${r.s}` : r.label, x: f.x1, y: f.y1 - 14, t: 1.4, big: r.s >= 40, c: r.s >= 40 ? '#f2a0b8' : '#f6d58e' });
      if (dart.left <= 0) setTimeout(endDart, 700);
    }
  }
  function drawFlying() {
    const f = dart.flying;
    if (!f) return;
    const k = Math.min(1, f.t);
    drawDart(f.x0 + (f.x1 - f.x0) * k, f.y0 + (f.y1 - f.y0) * k - Math.sin(k * Math.PI) * 30, 1.6 - k * 0.6);
  }
  function endDart() {
    dart.active = false;
    const c = getChar(NG.app.me); if (!c) return;
    c.locked = false; c.aiT = 1.5;
    c.emote = dart.total >= 100 ? '🤩' : dart.total >= 40 ? '😎' : '🥲'; c.emoteT = 1.8;
    dart.floatTxt.push({ s: `합계 ${dart.total}점!`, x: layout.board.x, y: layout.board.y, t: 2, big: true, c: '#a8c8e0' });
    NG.app.onDartRound(dart.total, dart.results);
    setTimeout(() => { if (!dart.active) dart.darts = []; }, 3000);
  }

  // ---------- actions ----------
  const ACTIONS = [
    { a: 'right', e: '➡️', n: '오른쪽' },
    { a: 'dart', e: '🎯', n: '다트' },
    { a: 'down', e: '😶', n: '앉아서 멍' },
    { a: 'sip', e: '☕', n: '커피' },
    { a: 'left', e: '⬅️', n: '왼쪽' },
    { a: 'wave', e: '👋', n: '인사' },
    { a: 'jump', e: '⬆️', n: '점프' },
    { a: 'dance', e: '💃', n: '춤' },
  ];
  // ---------- multiplayer: each player drives their own character, everyone else mirrors it ----------
  // Positions travel layout-independent: a rest spot + seat, or x as a fraction of the room and height above the floor.
  function exportState(c) {
    const doing = c.task && c.task.phase === 'do';
    return {
      slot: c.id, fx: +(c.x / view.WW).toFixed(4), h: +(view.floor - c.y).toFixed(1), dir: c.dir,
      pose: c.pose || null, spot: doing ? c.task.spot : null, seat: doing ? c.task.seat : 0,
      anim: c.animT > 0 ? c.anim : null, animT: c.animT > 0 ? +c.animT.toFixed(2) : 0,
      walk: !!c.vx && c.ground, air: !c.ground && !c.climbing, climb: !!c.climbing, sit: !!c.sit,
    };
  }
  function followRemote(c, dt) {
    const s = c.remote.s;
    c.steps = []; c.locked = false;
    if (s.spot && layout.byId[s.spot]) {
      const o = occ[s.spot];
      const seat = Math.min(s.seat || 0, o.length - 1);
      if (!c.task || c.task.spot !== s.spot || c.task.seat !== seat) {
        freeSeat(c);
        if (o[seat] != null && o[seat] !== c.id) { const other = getChar(o[seat]); if (other && !other.remote) standUp(other); }
        o[seat] = c.id;
        c.task = { spot: s.spot, seat, phase: 'do', manual: true, until: 0 };
      }
      seatChar(c);
    } else {
      if (c.task) { freeSeat(c); c.task = null; }
      c.pose = s.pose;
      const tx = s.fx * view.WW, ty = view.floor - s.h;
      if (Math.abs(tx - c.x) > 160 || Math.abs(ty - c.y) > 160) { c.x = tx; c.y = ty; }
      const k = Math.min(1, dt * 9);
      const dx = tx - c.x;
      c.x += dx * k; c.y += (ty - c.y) * k;
      c.dir = s.dir || c.dir;
      c.climbing = s.climb; c.ground = !s.air; c.sit = s.sit;
      c.vx = s.walk ? (Math.sign(dx) || c.dir) * 72 : 0;
      if (s.walk || s.climb) c.walkT += dt * (s.climb ? 5 : 6.5); else c.walkT = 0;
    }
    if (s.anim && (c.anim !== s.anim || c.animT <= 0)) { c.anim = s.anim; c.animT = s.animT; }
  }
  function applyRemote(id, s) {
    if (!id || (NG.app && NG.app.me === id)) return;
    const isNew = !getChar(id);
    const c = ensureChar(id);
    if (isNew) { c.x = s.fx * view.WW; c.y = view.floor - s.h; if (NG.stage.onJoin) NG.stage.onJoin(id, c.name); }
    c.remote = { s, at: performance.now() };
  }

  function act(id, a) {
    const c = getChar(id);
    if (!c || c.locked) return;
    if (c.remote && performance.now() - c.remote.at < 4000 && !/^(wave|dance|cheer|sip)$/.test(a)) return; // their stream moves them
    if (a.startsWith('spot:')) { startTask(c, a.slice(5), true); return; }
    standUp(c);
    c.sit = false;
    const anim = (k, t, e) => { c.anim = k; c.animT = t; c.aiT = t + 2.5; c.vx = 0; if (e) { c.emote = e; c.emoteT = Math.min(t, 1.8); } };
    switch (a) {
      case 'left': case 'right': {
        const d = a === 'left' ? -1 : 1;
        const [lo, hi] = levelRange(levelOf(c));
        c.animT = 0; c.dir = d; c.manual = true;
        c.steps = [{ k: 'walk', x: Math.max(lo, Math.min(hi, c.x + d * 170)) }];
        break;
      }
      case 'jump':
        if (c.ground) { c.animT = 0; c.vy = -520; c.ground = false; c.vx = c.dir * 90; c.aiT = 3; }
        break;
      case 'down':
        if (c.ground && levelOf(c) === 1 && c.x > layout.loftX1 - 70) { c.dropUntil = performance.now() + 250; c.ground = false; c.vy = 0; c.vx = c.dir * 60; c.aiT = 3; }
        else { c.animT = 0; c.pose = 'zone'; c.vx = 0; c.aiT = 14; }
        break;
      case 'wave': anim('wave', 1.8, '👋'); break;
      case 'dance': anim('dance', 4, null); break;
      case 'cheer': anim('cheer', 1.8, '🎉'); break;
      case 'sip': anim('sip', 2.2, '☕'); break;
    }
  }

  // ---------- input: tap things, right-click / long-press ring ----------
  function toLogical(ev) {
    const r = canvas.getBoundingClientRect();
    return { x: (ev.clientX - r.left) / view.s + view.camX, y: (ev.clientY - r.top) / view.s };
  }
  const inHit = (p, h) => p.x >= h.x0 && p.x <= h.x1 && p.y >= h.y0 && p.y <= h.y1;
  let hover = null;
  canvas.addEventListener('pointermove', (ev) => {
    if (ev.pointerType !== 'mouse') return;
    const p = toLogical(ev);
    const mh = layout.machines.find((m) => inHit(p, m.hit));
    hover = mh ? { hit: mh.hit, e: NG.GACHA[mh.key].e, n: NG.GACHA[mh.key].n } : layout.spots.find((s) => inHit(p, s.hit)) || null;
    const b = layout.board;
    canvas.style.cursor = hover || Math.hypot(p.x - b.x, p.y - b.y) < b.r * 1.3 ? 'pointer' : 'default';
  });
  canvas.addEventListener('pointerleave', () => { hover = null; });
  canvas.addEventListener('pointerdown', (ev) => {
    if (ev.button !== 0) return;
    if (ringOpen) { if (ringOpen.sticky) closeRing(); return; }
    const p = toLogical(ev);
    if (dart.active) { throwDart(); return; }
    const b = layout.board;
    if (Math.hypot(p.x - b.x, p.y - b.y) < b.r * 1.3) { startDart(); return; }
    for (const h of layout.figureHits || []) {
      if (Math.hypot(p.x - h.x, p.y - h.y) < 10) { NG.ui.showFigure(h.f); return; }
    }
    for (const c of chars) {
      if (Math.abs(p.x - c.x) < 16 && p.y < c.y + 16 && p.y > headTop(c)) {
        c.emote = ['❤️', '✨', '❓', '💦', '👋'][Math.floor(Math.random() * 5)]; c.emoteT = 1.4;
        NG.ui.charInfo(c);
        return;
      }
    }
    const m = layout.machines.find((x) => inHit(p, x.hit));
    if (m && NG.stage.onGacha) { pendingGacha = m.key; return; }
    const s = layout.spots.find((x) => inHit(p, x.hit));
    if (s && NG.stage.onAction) { pendingTap = s.id; return; }
  });
  let pendingTap = null, pendingGacha = null; // used on release, so a long press can still open the ring
  window.addEventListener('pointerup', () => {
    if (pendingTap && !ringOpen && NG.stage.onAction) NG.stage.onAction('spot:' + pendingTap);
    if (pendingGacha && !ringOpen) NG.stage.onGacha(pendingGacha);
    pendingTap = null; pendingGacha = null;
  });

  const ring = document.getElementById('ring');
  ring.innerHTML = '<div class="ring-hub">취소</div>' + ACTIONS.map((x, i) =>
    `<button class="ring-item" data-i="${i}" style="--ang:${i * 45}deg" aria-label="${x.n}"><span>${x.e}</span><em>${x.n}</em></button>`).join('');
  const R_IN = 22;
  let ringOpen = null;
  function openRing(cx0, cy0) {
    if (dart.active) return;
    pendingTap = null;
    const pad = 92;
    const cx = Math.max(pad, Math.min(window.innerWidth - pad, cx0));
    const cy = Math.max(pad, Math.min(window.innerHeight - pad, cy0));
    ringOpen = { cx, cy, sel: -1, sticky: false };
    ring.style.left = cx + 'px'; ring.style.top = cy + 'px';
    ring.classList.add('open');
    highlight(-1);
    if (navigator.vibrate) try { navigator.vibrate(12); } catch { /* not allowed */ }
  }
  function closeRing() { ringOpen = null; ring.classList.remove('open'); }
  function highlight(i) {
    if (ringOpen) ringOpen.sel = i;
    ring.querySelectorAll('.ring-item').forEach((b, k) => b.classList.toggle('sel', k === i));
    ring.classList.toggle('has-sel', i >= 0);
  }
  function sectorAt(x, y) {
    const dx = x - ringOpen.cx, dy = y - ringOpen.cy;
    if (Math.hypot(dx, dy) < R_IN) return -1;
    return ((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) % 8) + 8) % 8;
  }
  function runRing(i) { closeRing(); if (i >= 0 && NG.stage.onAction) NG.stage.onAction(ACTIONS[i].a); }
  ring.addEventListener('click', (e) => { const b = e.target.closest('.ring-item'); if (b) runRing(+b.dataset.i); else closeRing(); });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  ring.addEventListener('contextmenu', (e) => e.preventDefault());
  let press = null;
  canvas.addEventListener('pointerdown', (ev) => {
    if (ev.button === 2) { ev.preventDefault(); openRing(ev.clientX, ev.clientY); return; }
    if (ev.pointerType !== 'mouse') {
      clearTimeout(press && press.timer);
      press = { x: ev.clientX, y: ev.clientY, timer: setTimeout(() => { press = null; openRing(ev.clientX, ev.clientY); }, 420) };
    }
  });
  window.addEventListener('pointermove', (ev) => {
    if (press && Math.hypot(ev.clientX - press.x, ev.clientY - press.y) > 12) { clearTimeout(press.timer); press = null; pendingTap = null; }
    if (ringOpen && !ringOpen.sticky) highlight(sectorAt(ev.clientX, ev.clientY));
  });
  window.addEventListener('pointerup', (ev) => {
    if (press) { clearTimeout(press.timer); press = null; }
    if (!ringOpen || ringOpen.sticky) return;
    const i = sectorAt(ev.clientX, ev.clientY);
    if (i >= 0) runRing(i); else ringOpen.sticky = true;
  });
  window.addEventListener('pointercancel', () => { if (press) { clearTimeout(press.timer); press = null; } pendingTap = null; });
  window.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && ringOpen) { closeRing(); return; }
    if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
    if (ev.code === 'Space' && dart.active) { ev.preventDefault(); throwDart(); return; }
    if (dart.active || !NG.stage.onAction) return;
    const k = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'jump', ArrowDown: 'down' }[ev.key];
    if (k) { ev.preventDefault(); NG.stage.onAction(k); }
  });

  // ---------- pixel pipeline ----------
  // Copy `layer` onto `dst` with a 1px dark outline around everything opaque in it.
  function outlined(dst, layer, tl, w, h) {
    tl.clearRect(0, 0, w, h);
    tl.globalCompositeOperation = 'source-over'; tl.drawImage(layer, 0, 0);
    tl.globalCompositeOperation = 'source-in'; tl.fillStyle = PAL.outline; tl.fillRect(0, 0, w, h);
    tl.globalCompositeOperation = 'source-over';
    dst.drawImage(tl.canvas, -1, 0); dst.drawImage(tl.canvas, 1, 0); dst.drawImage(tl.canvas, 0, -1); dst.drawImage(tl.canvas, 0, 1);
    dst.drawImage(layer, 0, 0);
  }
  // Fade toward the DS-photo palette: less saturation, a warm grey cast.
  function grade(g, w, h, night) {
    g.globalCompositeOperation = 'saturation'; g.fillStyle = 'rgba(128,128,128,0.32)'; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'multiply'; g.fillStyle = night ? 'rgba(150,155,190,.55)' : 'rgba(238,228,212,.6)'; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'source-over';
  }
  function screenDoor() {
    const cell = view.P * view.dpr;
    if (cell < 3) return null;
    const pc = document.createElement('canvas');
    pc.width = Math.round(cell); pc.height = Math.round(cell);
    const g = pc.getContext('2d');
    const lw = Math.max(1, Math.round(view.dpr * (view.P >= 4 ? 1 : 0.75)));
    g.fillStyle = 'rgba(30,22,18,.22)'; g.fillRect(pc.width - lw, 0, lw, pc.height); g.fillRect(0, pc.height - lw, pc.width, lw);
    return main.createPattern(pc, 'repeat');
  }

  // ---------- camera (only moves when the room is wider than the screen) ----------
  function updateCamera(dt) {
    const max = Math.max(0, view.WW - view.W);
    if (!max) { view.camX = 0; return; }
    if (performance.now() < view.camHold) { view.camX = Math.max(0, Math.min(max, view.camX)); return; }
    let target = view.camX;
    if (dart.active) target = (layout.line.x0 + layout.board.x) / 2 - view.W / 2;
    else if (NG.app && getChar(NG.app.me)) target = getChar(NG.app.me).x - view.W / 2;
    target = Math.max(0, Math.min(max, target));
    view.camX += (target - view.camX) * Math.min(1, dt * 3);
  }
  let pan = null;
  canvas.addEventListener('pointerdown', (ev) => { if (ev.button === 0 && !dart.active) pan = { x: ev.clientX, cam: view.camX, moved: false }; });
  window.addEventListener('pointermove', (ev) => {
    if (!pan || ringOpen) return;
    const dx = ev.clientX - pan.x;
    if (!pan.moved && Math.abs(dx) > 10) { pan.moved = true; pendingTap = null; pendingGacha = null; }
    if (pan.moved && view.WW > view.W) {
      view.camX = Math.max(0, Math.min(view.WW - view.W, pan.cam - dx / view.s));
      view.camHold = performance.now() + 4000;
    }
  });
  window.addEventListener('pointerup', () => { pan = null; });

  // ---------- loop ----------
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const t = now / 1000;
    if (!layout) { requestAnimationFrame(frame); return; }
    for (const c of chars) updateChar(c, dt);
    for (const c of chars.filter((x) => x.gone)) { removeChar(c.id); if (NG.stage.onLeave) NG.stage.onLeave(c.id, c.name); }
    updateDart(dt);
    const mood = timeMood();
    const musicOn = !!(NG.music && NG.music.playing);
    const { bw, bh, q } = view;
    updateCamera(dt);
    const cx = view.camX;

    // background
    ctx = bctx;
    bctx.setTransform(1, 0, 0, 1, 0, 0); bctx.clearRect(0, 0, bw, bh);
    bctx.setTransform(q, 0, 0, q, -cx * q, 0);
    drawRoom(t, mood);
    // objects + characters, outlined
    ctx = octx;
    octx.setTransform(1, 0, 0, 1, 0, 0); octx.clearRect(0, 0, bw, bh);
    octx.setTransform(q, 0, 0, q, -cx * q, 0);
    drawProps(t, musicOn);
    drawBoard();
    const sorted = [...chars].sort((a, b) => a.y - b.y);
    for (const c of sorted) drawChar(c, t);
    drawFlying();
    bctx.setTransform(1, 0, 0, 1, 0, 0);
    outlined(bctx, objL, tctx, bw, bh);
    // figures (tiny emoji, pixelated on purpose) and the pixel sign
    ctx = bctx; bctx.setTransform(q, 0, 0, q, -cx * q, 0);
    drawFiguresShelf(t);
    bctx.setTransform(1, 0, 0, 1, 0, 0);
    pixelText(bctx, 'JAZZ & COFFEE', ((layout.barX0 + layout.barX1) / 2 - view.camX) * q, (view.floor - 140) * q, '#9c4a3f');
    pixelText(bctx, '가챠샵', ((layout.shopX0 + layout.shopX1) / 2 - view.camX) * q, (view.floor - 124) * q, '#76362f');
    pixelText(bctx, '만화방', ((layout.byId.manga.hit.x0 + layout.byId.manga.hit.x1) / 2 - view.camX) * q, (view.floor - 104) * q, '#5e4636');
    grade(bctx, bw, bh, mood.night);
    bctx.setTransform(q, 0, 0, q, -cx * q, 0);
    drawLights(t, musicOn, mood);

    // scale up with a screen-door grid
    main.setTransform(1, 0, 0, 1, 0, 0);
    main.imageSmoothingEnabled = false;
    main.drawImage(buf, 0, 0, bw, bh, 0, 0, canvas.width, canvas.height);
    if (grid === null) grid = screenDoor() || false;
    if (grid) { main.fillStyle = grid; main.fillRect(0, 0, canvas.width, canvas.height); }
    const vg = main.createRadialGradient(canvas.width / 2, canvas.height / 2, canvas.height * 0.35, canvas.width / 2, canvas.height / 2, canvas.width * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(30,20,15,.28)');
    main.fillStyle = vg; main.fillRect(0, 0, canvas.width, canvas.height);

    // crisp overlay
    ctx = main;
    main.setTransform(view.s * view.dpr, 0, 0, view.s * view.dpr, -cx * view.s * view.dpr, 0);
    drawAim();
    for (const c of sorted) drawCharFx(c, t);
    for (const c of sorted) drawLabels(c);
    if (hover && !dart.active) tag((hover.hit.x0 + hover.hit.x1) / 2, hover.hit.y0 - 4, `${hover.e} ${hover.n}`);
    drawDartHud(t);
    drawFloatTexts(dt);
    ctx = bctx;
    requestAnimationFrame(frame);
  }
  function pixelText(g, text, cx, cy, color) {
    g.font = `11px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#f3ead8'; g.fillText(text, Math.round(cx) + 1, Math.round(cy) + 1);
    g.fillStyle = color; g.fillText(text, Math.round(cx), Math.round(cy));
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  }

  // Customizer preview: same pixel pipeline, one character on a small floor.
  const pv = { buf: document.createElement('canvas'), layer: document.createElement('canvas'), tint: document.createElement('canvas') };
  function drawPreview(cv, look, t) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = cv.clientWidth, h = cv.clientHeight;
    const P = Math.max(2, Math.round(h / 64));
    const bw = Math.ceil(w / P), bh = Math.ceil(h / P);
    for (const c of [pv.buf, pv.layer, pv.tint]) if (c.width !== bw || c.height !== bh) { c.width = bw; c.height = bh; }
    if (cv.width !== Math.round(bw * P * dpr)) { cv.width = Math.round(bw * P * dpr); cv.height = Math.round(bh * P * dpr); }
    const k = bh / 100;
    const b = pv.buf.getContext('2d'), l = pv.layer.getContext('2d'), tl = pv.tint.getContext('2d');
    b.setTransform(1, 0, 0, 1, 0, 0); b.fillStyle = PAL.wall; b.fillRect(0, 0, bw, bh);
    b.fillStyle = PAL.floor; b.fillRect(0, bh * 0.82, bw, bh); b.fillStyle = PAL.wallLine;
    for (let x = 3; x < bw; x += 7) b.fillRect(x, 0, 1, bh * 0.82);
    l.setTransform(1, 0, 0, 1, 0, 0); l.clearRect(0, 0, bw, bh);
    l.setTransform(k, 0, 0, k, 0, 0);
    const phase = t % 6;
    const fake = { d: look, i: 0, x: bw / k / 2, y: 82, dir: 1, ground: true, vx: 0, walkT: 0, climbing: false, pose: null,
      blinkT: (t % 3.2) < 0.12 ? -0.05 : 1, emoteT: 0, emote: null, status: null, throwT: 0, sit: false,
      anim: phase > 4.2 ? 'wave' : null, animT: phase > 4.2 ? 1 : 0 };
    const keep = ctx; ctx = l;
    try { drawChar(fake, t); } finally { ctx = keep; }
    l.setTransform(1, 0, 0, 1, 0, 0);
    outlined(b, pv.layer, tl, bw, bh);
    grade(b, bw, bh, false);
    const g = cv.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0); g.imageSmoothingEnabled = false;
    g.drawImage(pv.buf, 0, 0, bw, bh, 0, 0, cv.width, cv.height);
  }

  // Collectible figure card: a chibi on a round base with a prop, same pixel pipeline. Drawn once per card.
  function drawProp(prop, t) {
    switch (prop) {
      case 'guitar':
        ctx.save(); ctx.translate(4, -22); ctx.rotate(-0.5);
        box(-2, -24, 3, 26, PAL.woodDk); box(-3, -27, 5, 4, PAL.ink);
        ctx.fillStyle = PAL.red; ctx.beginPath(); ctx.ellipse(0, 6, 9, 7, 0, 0, 7); ctx.fill(); ctx.beginPath(); ctx.ellipse(0, -2, 6, 5, 0, 0, 7); ctx.fill();
        ctx.fillStyle = PAL.ink; ctx.beginPath(); ctx.arc(0, 3, 2, 0, 7); ctx.fill(); ctx.restore(); break;
      case 'bass':
        ctx.save(); ctx.translate(4, -22); ctx.rotate(-0.55);
        box(-2, -30, 3, 32, PAL.woodDk);
        ctx.fillStyle = PAL.navy; ctx.beginPath(); ctx.ellipse(0, 6, 8, 8, 0, 0, 7); ctx.fill(); ctx.restore(); break;
      case 'mic':
        box(14, -42, 2, 42, PAL.metalDk); box(9, -1, 12, 2, PAL.metalDk);
        ctx.fillStyle = PAL.ink; ctx.beginPath(); ctx.arc(15, -45, 3.5, 0, 7); ctx.fill(); break;
      case 'keys':
        box(-4, -24, 28, 7, PAL.ink); box(-2, -23, 24, 4, PAL.cream);
        for (let x = 0; x < 22; x += 4) box(x, -23, 2, 2.5, PAL.ink);
        box(0, -17, 2, 17, PAL.metalDk); box(18, -17, 2, 17, PAL.metalDk); break;
      case 'book': box(5, -38, 14, 11, PAL.red); box(6, -37, 12, 9, PAL.cream); break;
      case 'pen': box(10, -40, 2, 12, PAL.ink); box(4, -30, 14, 10, PAL.cream); break;
      case 'pad': rr(4, -32, 16, 8, 3); ctx.fillStyle = '#4a4a52'; ctx.fill(); box(7, -29, 3, 2, PAL.cream); box(15, -29, 2, 2, PAL.red); break;
      case 'chicken': ctx.fillStyle = '#b8762e'; ctx.beginPath(); ctx.ellipse(13, -34, 6, 5, 0.4, 0, 7); ctx.fill(); box(16, -31, 6, 2, PAL.cream); break;
      case 'pillow': rr(-14, -38, 14, 10, 3); ctx.fillStyle = '#e9e9f2'; ctx.fill(); break;
      case 'coffee': box(10, -46, 8, 9, PAL.cream); box(11, -45, 6, 2, '#6b4630'); break;
      case 'crown':
        ctx.fillStyle = '#e8c24a'; ctx.beginPath(); ctx.moveTo(-10, -62); ctx.lineTo(-10, -70); ctx.lineTo(-5, -65); ctx.lineTo(0, -72);
        ctx.lineTo(5, -65); ctx.lineTo(10, -70); ctx.lineTo(10, -62); ctx.fill(); break;
    }
    void t;
  }
  function drawFigure(cv, item, opt = {}) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = cv.clientWidth || cv.width, h = cv.clientHeight || cv.height;
    const P = Math.max(2, Math.round(h / 60));
    const bw = Math.ceil(w / P), bh = Math.ceil(h / P);
    const mk = () => { const c = document.createElement('canvas'); c.width = bw; c.height = bh; return c; };
    const b0 = mk(), l0 = mk(), t0 = mk();
    const b = b0.getContext('2d'), l = l0.getContext('2d');
    cv.width = Math.round(bw * P * dpr); cv.height = Math.round(bh * P * dpr);
    const k = bh / 96;
    if (opt.locked) {
      b.fillStyle = '#d9cfba'; b.fillRect(0, 0, bw, bh);
    } else {
      const g = b.createLinearGradient(0, 0, 0, bh);
      g.addColorStop(0, opt.bg || '#e6dcc6'); g.addColorStop(1, '#cfc2a8');
      b.fillStyle = g; b.fillRect(0, 0, bw, bh);
    }
    l.setTransform(k, 0, 0, k, 0, 0);
    const cx = bw / k / 2;
    const keep = ctx; ctx = l;
    try {
      ctx.fillStyle = '#6e5442'; ctx.beginPath(); ctx.ellipse(cx, 86, 22, 6, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#8a6a50'; ctx.fillRect(cx - 22, 80, 44, 6); ctx.beginPath(); ctx.ellipse(cx, 80, 22, 6, 0, 0, 7); ctx.fill();
      const fake = { d: item.look, i: 0, x: cx, y: 80, dir: 1, ground: true, vx: 0, walkT: 0, climbing: false, pose: null,
        blinkT: 1, emoteT: 0, emote: null, status: null, throwT: 0, sit: false, anim: null, animT: 0 };
      if (item.prop === 'mic' || item.prop === 'guitar' || item.prop === 'bass') fake.pose = null;
      drawChar(fake, 0);
      ctx.save(); ctx.translate(cx, 80); ctx.scale(CH, CH); drawProp(item.prop, 0); ctx.restore();
    } finally { ctx = keep; }
    if (opt.locked) { l.setTransform(1, 0, 0, 1, 0, 0); l.globalCompositeOperation = 'source-in'; l.fillStyle = '#8f8270'; l.fillRect(0, 0, bw, bh); l.globalCompositeOperation = 'source-over'; }
    l.setTransform(1, 0, 0, 1, 0, 0);
    outlined(b, l0, t0.getContext('2d'), bw, bh);
    if (!opt.locked) grade(b, bw, bh, false);
    if (opt.holo) {
      const hg = b.createLinearGradient(0, 0, bw, bh);
      ['rgba(255,120,160,.35)', 'rgba(255,220,120,.35)', 'rgba(120,230,200,.35)', 'rgba(140,160,255,.35)', 'rgba(255,120,200,.35)']
        .forEach((c, i, a) => hg.addColorStop(i / (a.length - 1), c));
      b.globalCompositeOperation = 'overlay'; b.fillStyle = hg; b.fillRect(0, 0, bw, bh); b.globalCompositeOperation = 'source-over';
      b.fillStyle = 'rgba(255,255,255,.75)'; for (let i = 0; i < 6; i++) b.fillRect((i * 37) % bw, (i * 23) % bh, 1, 1);
    }
    const g = cv.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0); g.imageSmoothingEnabled = false;
    g.drawImage(b0, 0, 0, bw, bh, 0, 0, cv.width, cv.height);
  }

  NG.stage = {
    chars, view, startDart, act, drawPreview, drawFigure, ACTIONS,
    onAction: null, onArrive: null, onGacha: null,
    get dartActive() { return dart.active; },
    get ringOpen() { return !!ringOpen; },
    get spots() { return layout ? layout.spots : []; },
    myTask() { const c = NG.app ? getChar(NG.app.me) : null; return c && c.task ? c.task.spot : null; },
    init() {
      new ResizeObserver(resize).observe(canvas.parentElement);
      resize();
      requestAnimationFrame(frame);
    },
    resize,
    say(id, text) { const c = getChar(id); if (c) { c.bubble = text; c.bubbleT = 6; } },
    emote(id, e) { const c = getChar(id); if (c) { c.emote = e; c.emoteT = 1.8; } },
    myPos() { const c = NG.app ? getChar(NG.app.me) : null; return c ? exportState(c) : null; },
    applyRemote, getChar, defaultLook,
    setMe(id) { return ensureChar(id); },
    setPlayer(id, name, status, look) {
      profiles[id] = { name, status, look };
      const c = getChar(id); if (!c) return;
      c.name = name || c.name || '손님'; c.status = status || null;
      if (look !== undefined) c.d = NG.sanitizeLook(look, defaultLook(id));
    },
  };
})();
