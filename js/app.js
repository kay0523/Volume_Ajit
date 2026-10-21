// App shell: identity, status, figures/gacha, mini games, sticky-note board, translucent chat, responsive windows.
(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const KEY = 'nogari.me.v1';

  // Panels size from the height you can actually see (phone browsers count their toolbars in vh).
  const fitHeight = () => document.documentElement.style.setProperty('--app-h', Math.round((window.visualViewport || window).height || innerHeight) + 'px');
  fitHeight(); addEventListener('resize', fitHeight); if (window.visualViewport) visualViewport.addEventListener('resize', fitHeight);

  // ---------- persistent personal state ----------
  const def = { listen: false, slot: null, name: '', look: null, tutorial: false, gacha: {}, holo: {}, status: null, custom: [], coins: 300, figures: {}, shelf: true,
    caffeine: 80, focus: 90, exp: 0, lv: 1, best: { dart: 0 }, chatOpacity: 0.55, lastTick: Date.now() };
  let me;
  try { me = { ...def, ...JSON.parse(localStorage.getItem(KEY)) }; } catch { me = { ...def }; }
  me.best = { ...def.best, ...me.best };
  // Everyone gets a personal id; their character is keyed by it (me.slot holds it once they've entered).
  if (!me.uid) me.uid = 'u' + Math.random().toString(36).slice(2, 12).padEnd(10, '0');
  if (typeof me.slot === 'number') me.slot = me.uid; // from the old three-seat version
  if (!me.listenV2) { me.listen = false; me.listenV2 = true; } // shared sound now starts off for everyone
  me.gacha = me.gacha || {}; me.holo = me.holo || {};
  if (!me.coins300) { me.coins = Math.max(me.coins, 300); me.coins300 = true; } // coins are now plentiful
  if (me.gacha.band) { me.coins += 15 * Object.keys(me.gacha.band).length; delete me.gacha.band; } // band machine became the game machine: refund
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(me)); } catch { /* blocked */ } };

  const shared = { players: {}, notes: [], music: null };

  NG.app = {
    get me() { return me.slot; },
    myStatus: () => me.status,
    // Gacha figures shown on the hideout shelf (tiny machine emoji; tap one to see the card).
    shelfFigures: () => Object.entries(NG.GACHA).flatMap(([k, G]) => G.items.filter((i) => (me.gacha[k] || {})[i.id]).map((i) => ({ e: G.e, n: i.n, r: i.r, key: k, it: i }))),
    onDartRound(total) {
      const coins = Math.round(total / 5);
      addCoins(coins); gainExp(10 + Math.round(total / 10));
      me.focus = Math.min(100, me.focus + 4);
      if (total > me.best.dart) { me.best.dart = total; toast(`🏆 다트 최고 기록 ${total}점! (+${coins}🪙)`); }
      else toast(`🎯 ${total}점 · +${coins}🪙`);
      if (total >= 100) NG.net.send({ type: 'sys', slot: me.slot, text: `🎯 ${me.name}님이 다트 ${total}점을 기록했어요!` });
      save(); renderGames();
    },
  };

  // ---------- UI helpers ----------
  let toastT = null;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg; el.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 2600);
  }
  function modal(html, cls = '') {
    const m = $('#modal');
    m.className = 'modal show ' + cls;
    $('.modal-card', m).innerHTML = html;
    return $('.modal-card', m);
  }
  const closeModal = () => { $('#modal').className = 'modal'; };
  // Two-tap confirmation (the claude.ai viewer ignores window.confirm).
  function armed(btn, label, fn) {
    btn.addEventListener('click', () => {
      if (btn.dataset.armed) { delete btn.dataset.armed; fn(); return; }
      const orig = btn.textContent;
      btn.dataset.armed = 1; btn.textContent = label;
      setTimeout(() => { if (btn.dataset.armed) { delete btn.dataset.armed; btn.textContent = orig; } }, 3000);
    });
  }
  const bootAt = Date.now();
  $('#modal').addEventListener('pointerdown', (e) => { if (e.target.id === 'modal' && me.slot != null) closeModal(); });

  NG.ui = {
    toast,
    setNet(on, peers) {
      const p2p = NG.net && NG.net.mode === 'p2p';
      const n = p2p ? (peers ?? NG.net.peers) : null;
      $('#net').className = 'net ' + (on && (!p2p || n > 0) ? 'on' : 'off');
      $('#net').title = p2p ? (n > 0 ? `팀원 ${n}명과 연결됨` : '혼자 있어요 · 팀원이 들어오면 자동 연결') : on ? '팀 서버 연결됨' : '연결 끊김 — 재연결 중';
      $('#net-count').textContent = p2p && n > 0 ? `+${n}` : '';
      if ($('#w-settings').classList.contains('open')) renderSettings();
    },
    showFigure(f) { showGachaItem(f.key, f.it); },
    charInfo(c) {
      const p = shared.players[c.id];
      const st = c.status ? `${c.status.e} ${esc(c.status.t)}` : '상태 없음';
      const who = p && p.name ? esc(p.name) : esc(c.d.name) + ' (빈 캐릭터)';
      toast(`${who} · ${st}`);
    },
  };
  document.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeModal(); });

  function addCoins(n) { me.coins += n; renderHud(); }
  // Coins top back up to 300 two minutes after you dip below it, so gacha never feels like a grind.
  const COIN_BASE = 300, REFILL_MS = 120000;
  const refillLeft = () => (me.coins >= COIN_BASE || !me.refillAt ? 0 : Math.max(0, me.refillAt - Date.now()));
  const refillText = () => { const ms = refillLeft(); if (!ms) return ''; const s2 = Math.ceil(ms / 1000); return `⏳ ${Math.floor(s2 / 60)}:${String(s2 % 60).padStart(2, '0')} 후 ${COIN_BASE}🪙 충전`; };
  function tickRefill() {
    if (me.coins >= COIN_BASE) { if (me.refillAt) { me.refillAt = 0; save(); } }
    else if (!me.refillAt) { me.refillAt = Date.now() + REFILL_MS; save(); }
    else if (Date.now() >= me.refillAt) { me.coins = COIN_BASE; me.refillAt = 0; save(); renderHud(); toast(`🪙 코인이 ${COIN_BASE}개로 충전됐어요!`); if ($('#w-figures').classList.contains('open')) renderFigures(); }
    document.querySelectorAll('.coin-refill').forEach((el) => { el.textContent = refillText(); });
  }
  setInterval(tickRefill, 1000);
  function gainExp(n) {
    me.exp += n;
    while (me.exp >= me.lv * 100) { me.exp -= me.lv * 100; me.lv++; toast(`✨ LEVEL UP! Lv.${me.lv}`); NG.stage.emote(me.slot, '✨'); }
    renderHud();
  }

  // ---------- windows ----------
  const isNarrow = () => window.innerWidth < 640;
  let zTop = 20;
  function focusWin(w) { w.style.zIndex = ++zTop; }
  function openWin(id) {
    const w = $('#' + id);
    $$('.win.panel.open').forEach((o) => { if (o !== w) closeWin(o); }); // opening a tab closes the others
    w.classList.add('open'); focusWin(w); clampWin(w);
    $$(`[data-win="${id}"]`).forEach((b) => b.classList.add('on'));
    if (id === 'w-figures') renderFigures();
    if (id === 'w-games') renderGames();
    if (id === 'w-board') renderBoard();
    if (id === 'w-status') renderStatus();
    if (id === 'w-settings') renderSettings();
    if (id === 'w-music') renderMusic();
    if (id === 'w-rest') renderRest();
  }
  function closeWin(w) { w.classList.remove('open'); $$(`[data-win="${w.id}"]`).forEach((b) => b.classList.remove('on')); }
  function toggleWin(id) { const w = $('#' + id); w.classList.contains('open') ? closeWin(w) : openWin(id); }
  $$('[data-win]').forEach((b) => b.addEventListener('click', () => toggleWin(b.dataset.win)));
  $$('.win').forEach((w) => {
    w.addEventListener('pointerdown', () => focusWin(w));
    const x = $('.win-x', w); if (x) x.addEventListener('click', () => closeWin(w));
    makeDraggable(w, $('.win-head', w));
  });

  function clampWin(w) {
    if (isNarrow() && w.classList.contains('panel')) return;
    const r = w.getBoundingClientRect();
    const maxL = window.innerWidth - Math.min(r.width, window.innerWidth), maxT = window.innerHeight - 40;
    const l = Math.max(0, Math.min(r.left, maxL)), t = Math.max(0, Math.min(r.top, maxT));
    if (l !== r.left || t !== r.top) { w.style.left = l + 'px'; w.style.top = t + 'px'; w.style.right = 'auto'; w.style.bottom = 'auto'; }
  }
  function makeDraggable(w, handle) {
    if (!handle) return;
    let sx, sy, ox, oy, drag = false;
    handle.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button,input,select') || (isNarrow() && w.classList.contains('panel'))) return;
      const r = w.getBoundingClientRect();
      sx = e.clientX; sy = e.clientY; ox = r.left; oy = r.top; drag = true;
      handle.setPointerCapture(e.pointerId);
    });
    handle.addEventListener('pointermove', (e) => {
      if (!drag) return;
      w.style.left = Math.max(0, Math.min(window.innerWidth - 60, ox + e.clientX - sx)) + 'px';
      w.style.top = Math.max(0, Math.min(window.innerHeight - 36, oy + e.clientY - sy)) + 'px';
      w.style.right = 'auto'; w.style.bottom = 'auto';
    });
    const end = () => { drag = false; };
    handle.addEventListener('pointerup', end); handle.addEventListener('pointercancel', end);
  }
  window.addEventListener('resize', () => $$('.win').forEach((w) => w.classList.contains('open') || w.id === 'chat' ? clampWin(w) : 0));

  // ---------- HUD ----------
  function renderHud() {
    $('#coins').textContent = me.coins;
    const st = me.status;
    $('#my-status').innerHTML = st ? `<b>${esc(st.e)}</b><span>${esc(st.t)}</span>` : '<b>💬</b><span>상태 설정</span>';
    $('#my-name').textContent = me.slot != null ? `Lv.${me.lv} ${me.name}` : '캐릭터 선택';
    const bar = (id, v) => { $(id + ' i').style.width = Math.max(0, Math.min(100, v)) + '%'; $(id + ' em').textContent = Math.round(v) + '%'; };
    bar('#g-caf', me.caffeine); bar('#g-focus', me.focus);
    $('#g-exp i').style.width = (me.exp / (me.lv * 100) * 100) + '%';
    $('#g-exp em').textContent = `EXP ${me.exp}/${me.lv * 100}`;
  }

  // gauges drain slowly: caffeine 100→0 over ~4h, focus over ~6h (also while the tab was closed)
  function tickGauges() {
    const now = Date.now();
    const mins = Math.min(600, (now - me.lastTick) / 60000);
    me.lastTick = now;
    me.caffeine = Math.max(0, me.caffeine - mins * 0.42);
    me.focus = Math.max(0, me.focus - mins * 0.28);
    if (me.caffeine < 20 && !(me.status && me.status.e === '☕') && !tickGauges.warned) {
      tickGauges.warned = true; toast('☕ 카페인 게이지가 바닥나고 있어요!');
    }
    renderHud(); save();
  }
  function drinkCoffee() {
    me.caffeine = Math.min(100, me.caffeine + 35); tickGauges.warned = false;
    if (me.slot != null) { NG.stage.act(me.slot, 'sip'); NG.net.send({ type: 'act', slot: me.slot, a: 'sip' }); }
    gainExp(2); renderHud(); save(); toast('☕ 카페인 충전! +35%');
  }
  $('#btn-coffee').addEventListener('click', drinkCoffee);
  $('#btn-stretch').addEventListener('click', () => {
    me.focus = Math.min(100, me.focus + 25);
    if (me.slot != null) { NG.stage.emote(me.slot, '🙆'); NG.net.send({ type: 'emote', slot: me.slot, e: '🙆' }); }
    gainExp(2); renderHud(); save(); toast('🙆 스트레칭! 정신력 +25%');
  });

  // ---------- status ----------
  function setStatus(st) {
    me.status = st; save(); renderHud(); renderStatus();
    publishPresence();
    if (st) NG.stage.emote(me.slot, st.e);
  }
  function publishPresence() {
    if (me.slot == null) return;
    NG.stage.setPlayer(me.slot, me.name, me.status, me.look);
    NG.stage.setMe(me.slot);
    NG.stage.setPlayer(me.slot, me.name, me.status, me.look);
    NG.net.send({ type: 'presence', slot: me.slot, name: me.name, status: me.status, look: me.look });
  }
  function renderStatus() {
    const box = $('#status-list');
    const all = [...NG.STATUS_PRESETS.map((s) => ({ ...s, preset: true })), ...me.custom];
    box.innerHTML = all.map((s, i) => {
      const on = me.status && me.status.e === s.e && me.status.t === s.t;
      return `<button class="chip ${on ? 'on' : ''}" data-i="${i}"><b>${esc(s.e)}</b>${esc(s.t)}${s.preset ? '' : `<span class="del" data-del="${i - NG.STATUS_PRESETS.length}" title="삭제">×</span>`}</button>`;
    }).join('') + `<button class="chip ghost" data-clear>🚫 상태 없음</button>`;
    box.onclick = (e) => {
      const del = e.target.closest('[data-del]');
      if (del) { e.stopPropagation(); me.custom.splice(+del.dataset.del, 1); save(); renderStatus(); return; }
      if (e.target.closest('[data-clear]')) { setStatus(null); return; }
      const b = e.target.closest('[data-i]');
      if (b) { const s = all[+b.dataset.i]; setStatus({ e: s.e, t: s.t }); }
    };
    $('#status-team').innerHTML = NG.stage.chars.map((c) =>
      `<div class="team-row"><span class="dot" style="background:${c.d.hair}"></span><b>${esc(c.name)}</b><span>${c.status ? esc(c.status.e + ' ' + c.status.t) : '—'}</span></div>`).join('');
  }
  $('#status-add').addEventListener('submit', (e) => {
    e.preventDefault();
    const em = $('#st-emoji').value.trim() || '✨';
    const tx = $('#st-text').value.trim();
    if (!tx) return;
    const s = { e: [...em].slice(0, 2).join(''), t: tx.slice(0, 24) };
    me.custom.push(s); $('#st-text').value = ''; save(); setStatus(s);
  });
  $$('#emoji-pick button').forEach((b) => b.addEventListener('click', () => { $('#st-emoji').value = b.textContent; }));

  // ---------- figures (gacha collections) ----------
  let figTab = 'game';
  function renderFigures() {
    $$('#fig-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.t === figTab));
    renderGachaInto($('#fig-gacha'), figTab);
  }
  $('#fig-tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-t]'); if (b) { figTab = b.dataset.t; renderFigures(); } });

  // ---------- gacha shop (game / 침착맨 / idol) ----------
  const gItem = (key, id) => NG.GACHA[key].items.find((x) => x.id === id);
  function renderGachaInto(box, key) {
    const G = NG.GACHA[key];
    const own = me.gacha[key] || {};
    const n = G.items.filter((i) => own[i.id]).length;
    box.innerHTML = `<div class="gshop" style="--gc:${G.color}">
      <div class="gshop-head"><span class="gm">${G.e}</span>
        <div class="gi"><b>${esc(G.n)}</b><small>${esc(G.desc)}</small><small>수집 ${n} / ${G.items.length}</small><small class="coin-refill">${refillText()}</small></div>
        <button class="btn primary" data-pull="${key}" ${me.coins < G.cost ? 'disabled' : ''}>🎰 ${G.cost}🪙</button></div>
      <div class="gcards">${G.items.map((it) => {
        const has = own[it.id];
        return `<button class="gcard ${has ? '' : 'locked'} ${me.holo[it.id] ? 'holo' : ''}" data-item="${it.id}" data-key="${key}" ${has ? '' : 'disabled'}>
          <canvas></canvas><span>${has ? esc(it.n) : '???'}</span>${has ? `<small>${esc(it.g)}</small>` : ''}</button>`;
      }).join('')}</div></div>`;
    // 200 cards per machine: draw each canvas only once it scrolls into view
    const draw = (b) => {
      if (b.dataset.drawn) return; b.dataset.drawn = 1;
      const it = gItem(key, b.dataset.item);
      NG.stage.drawFigure($('canvas', b), it, { locked: !own[it.id], holo: !!me.holo[it.id] });
    };
    const cards = $$('.gcard', box);
    if (!('IntersectionObserver' in window)) { cards.forEach(draw); return; }
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { draw(e.target); io.unobserve(e.target); } }), { rootMargin: '200px' });
    cards.forEach((b) => io.observe(b));
  }
  function showGachaItem(key, it, extra = '') {
    const r = NG.GACHA_RARITY[it.r];
    const holo = !!me.holo[it.id];
    const card = modal(`<div class="gres ${holo ? 'holo' : ''}"><canvas class="gres-cv"></canvas></div>
      <h3>${extra}${esc(it.n)} <span class="rar" style="--rc:${r.c}">${r.n}</span>${holo ? ' <span class="rar holo-tag">홀로그램</span>' : ''}</h3>
      <p class="sub">${esc(it.g)}</p><p>${esc(it.f)}</p>
      <div class="row"><button class="btn" data-shop="${key}">도감으로</button><button class="btn primary" data-pull="${key}">🎰 한 번 더 (${NG.GACHA[key].cost}🪙)</button></div>`, 'gacha');
    requestAnimationFrame(() => NG.stage.drawFigure($('.gres-cv', card), it, { holo }));
  }
  function pullGacha(key) {
    const G = NG.GACHA[key];
    if (me.slot == null) { askIdentity(); return; }
    if (me.coins < G.cost) { tickRefill(); toast(`🪙 코인이 부족해요 · ${refillText() || '곧 충전돼요'}`); return; }
    me.coins -= G.cost; tickRefill();
    const present = [1, 2, 3].filter((r) => G.items.some((i) => i.r === r));
    const total = present.reduce((a, r) => a + NG.GACHA_RARITY[r].w, 0);
    let roll = Math.random() * total, rar = present[0];
    for (const r of present.slice().reverse()) { roll -= NG.GACHA_RARITY[r].w; if (roll <= 0) { rar = r; break; } }
    const pool = G.items.filter((i) => i.r === rar);
    const it = pool[Math.floor(Math.random() * pool.length)];
    const own = me.gacha[key] = me.gacha[key] || {};
    const isNew = !own[it.id];
    const holo = key === 'idol' && Math.random() < NG.HOLO_RATE && !me.holo[it.id];
    own[it.id] = (own[it.id] || 0) + 1;
    if (holo) me.holo[it.id] = true;
    if (!isNew && !holo) me.coins += 5;
    gainExp(isNew ? 15 : 5); save(); renderHud();
    modal(`<div class="capsule-drop" style="--gc:${G.color}"><div class="cap"></div></div><p class="sub">두근두근…</p>`, 'gacha');
    setTimeout(() => {
      showGachaItem(key, it, holo ? '✨ ' : isNew ? '🆕 ' : '');
      if (!isNew && !holo) toast('중복이라 5🪙 돌려받았어요');
      if (isNew && (it.r === 3 || holo)) NG.net.send({ type: 'sys', slot: me.slot, text: `✨ ${me.name}님이 ${holo ? '홀로그램 ' : '레전드 '}[${it.n}] 피규어를 뽑았어요!` });
      if ($('#w-figures').classList.contains('open')) renderFigures();
    }, 900);
  }
  function openGachaShop(key) {
    const card = modal(`<div class="gtabs">${Object.values(NG.GACHA).map((G) =>
      `<button class="${G.key === key ? 'on' : ''}" data-gtab="${G.key}">${G.e} ${esc(G.n)}</button>`).join('')}</div>
      <div id="gshop-body"></div><div class="row"><span class="sub">보유 🪙 ${me.coins}</span><button class="btn" data-close>닫기</button></div>`, 'gacha-modal');
    renderGachaInto($('#gshop-body', card), key);
  }
  document.addEventListener('click', (e) => {
    const p = e.target.closest('[data-pull]'); if (p) { pullGacha(p.dataset.pull); return; }
    const s = e.target.closest('[data-shop]'); if (s) { openGachaShop(s.dataset.shop); return; }
    const t = e.target.closest('[data-gtab]'); if (t) { openGachaShop(t.dataset.gtab); return; }
    const c = e.target.closest('.gcard:not(.locked)'); if (c) showGachaItem(c.dataset.key, gItem(c.dataset.key, c.dataset.item));
  });
  // ---------- pets: tap one to feed or play ----------
  me.petLove = me.petLove || {};
  const petMenu = (sp) => NG.stage.PET_ACTS.filter((a) => !a.sp || a.sp === sp);
  const petLabel = (sp, k) => { const a = NG.stage.PET_ACTS.find((x) => x.k === k); return sp === 'c' && k === 'treat' ? ['🐟', '생선 간식 주기'] : [a.e, a.n]; };
  function doPetAct(i, k) { // walk over, do the gesture, and the pet comes to you on every screen
    NG.stage.petAct(me.slot, i, k);
    NG.stage.feedPet(i, k, me.slot);
    NG.net.send({ type: 'act', slot: me.slot, a: `pf:${i}:${k}` });
  }
  NG.stage.onPetAct = (id, i, k) => { if (id === me.slot) doPetAct(i, k); }; // auto-play
  const petCool = {};
  let petTimer = null;
  function openPet(i) {
    const info = NG.stage.petInfo(i);
    const love = me.petLove[info.id] || 0, lv = Math.min(5, 1 + Math.floor(love / 4));
    const card = modal(`<div class="pet-head"><span class="pet-e">${info.sp === 'd' ? '🐶' : '🐱'}</span><div><h3>${esc(info.name)} <small>${esc(info.breed)}</small></h3>
      <p class="sub">친밀도 ${'❤️'.repeat(lv)}${'🤍'.repeat(5 - lv)} · ${love}번 돌봄</p></div></div>
      <p class="pet-doing">지금: <b id="pet-doing">${esc(info.doing)}</b></p>
      <div class="pet-acts">${petMenu(info.sp).map((a) => { const [e, n] = petLabel(info.sp, a.k); return `<button class="btn" data-petfeed="${a.k}" data-pet="${i}">${e} ${n}</button>`; }).join('')}</div>
      <div class="row"><button class="btn" data-close>닫기</button></div>`, 'pet-modal');
    clearInterval(petTimer);
    petTimer = setInterval(() => { const el = $('#pet-doing', card); if (!el || !$('#modal').classList.contains('show')) { clearInterval(petTimer); return; } el.textContent = NG.stage.petInfo(i).doing; }, 800);
  }
  NG.stage.onPet = (i) => { if (me.slot == null) { askIdentity(); return; } openPet(i); };
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-petfeed]'); if (!b) return;
    const i = +b.dataset.pet, k = b.dataset.petfeed, info = NG.stage.petInfo(i);
    if (Date.now() < (petCool[i] || 0)) { toast(`${info.name}${NG.stage.batchim(info.name) ? '은' : '는'} 아직 ${info.doing.split('· ').pop()}이에요`); return; }
    petCool[i] = Date.now() + 4000;
    doPetAct(i, k);
    me.petLove[info.id] = (me.petLove[info.id] || 0) + 1;
    me.focus = Math.min(100, me.focus + 3); gainExp(2); save();
    const [e2, n] = petLabel(info.sp, k);
    toast(`${e2} ${info.name}${NG.stage.batchim(info.name) ? '이' : ''}랑 ${n}! 정신력 +3`);
    closeModal();
  });

  NG.stage.onGacha = (key) => {
    if (me.slot == null) { askIdentity(); return; }
    NG.stage.act(me.slot, 'spot:gacha'); NG.net.send({ type: 'act', slot: me.slot, a: 'spot:gacha' });
    openGachaShop(key);
  };

  // ---------- mini games ----------
  let gameTab = 'dart';
  let gameKeys = null; // keyboard handler of the running game (arrows / space), only while the games window shows it
  function renderGames() {
    $$('#game-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.g === gameTab));
    const box = $('#game-body');
    gameKeys = null;
    if (gameTab === 'dart') {
      box.innerHTML = `<div class="game-intro"><div class="big">🎯</div>
        <p>화면의 다트판을 클릭하면 시작! 흔들리는 조준점을 잘 보고 클릭(탭) 또는 <kbd>Space</kbd>로 3발 던져요.</p>
        <p class="sub">😴 졸림이면 조준이 더 흔들리고, ☕ 카페인 필요면 손이 떨려요. 🔥 집중모드는 안정적!</p>
        <p>최고 기록 <b>${me.best.dart}</b>점 · 점수 ÷ 5 = 🪙</p>
        <button class="btn primary" id="dart-go">다트 시작</button></div>`;
      $('#dart-go').onclick = () => { if (isNarrow()) closeWin($('#w-games')); NG.stage.startDart(); };
    } else if (gameTab === 'bubble') startBubble(box);
    else if (gameTab === 'fish') startFishing(box);
    else startStack(box);
  }
  $('#game-tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-g]'); if (b) { gameTab = b.dataset.g; renderGames(); } });
  window.addEventListener('keydown', (e) => {
    if (!gameKeys || !$('#w-games').classList.contains('open') || /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
    if (gameKeys(e)) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);

  // Shared pixel canvas for the small games: a low-res buffer scaled up crisply to the panel width.
  function pixelCanvas(cv, BW, BH) {
    const buf = document.createElement('canvas'); buf.width = BW; buf.height = BH;
    const b = buf.getContext('2d'), g = cv.getContext('2d');
    return {
      b,
      toBuf(e) { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * BW, y: (e.clientY - r.top) / r.height * BH }; },
      present(overlay) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = cv.clientWidth, h = Math.round(w * BH / BW);
        if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); cv.style.height = h + 'px'; }
        g.imageSmoothingEnabled = false; g.drawImage(buf, 0, 0, cv.width, cv.height);
        if (overlay) { g.save(); g.scale(cv.width / BW, cv.height / BH); overlay(g); g.restore(); }
      },
    };
  }

  // 🫧 버블 톡톡: bubbles drift up, tap to pop. 45 seconds, nothing to lose — just pop.
  function startBubble(box) {
    box.innerHTML = `<div class="cell-top"><span>톡톡 <b id="bb-score">0</b></span><span>최고 <b id="bb-best">${me.best.bubble || 0}</b></span><span class="sub">탭해서 터뜨리기</span></div>
      <canvas class="stack-cv" aria-label="버블 톡톡"></canvas>
      <p class="sub">떠오르는 비눗방울을 톡톡! 금색은 +5, 연달아 터뜨리면 콤보. 45초 동안 마음 편히.</p>`;
    const cv = $('.stack-cv', box);
    const BW = 120, BH = 150, ROUND = 45;
    const P = pixelCanvas(cv, BW, BH), b = P.b;
    const COLS = ['#a8c8e0', '#f2c4d8', '#b8e0c0', '#e0d0f0', '#f6e0a8'];
    let bubbles = [], pops = [], score = 0, left = ROUND, over = false, spawnT = 0, combo = 0, lastPop = 0, msg = null;
    const reset = () => { bubbles = []; pops = []; score = 0; left = ROUND; over = false; combo = 0; $('#bb-score').textContent = 0; };
    const spawn = () => {
      const r = 5 + Math.random() * 7, gold = Math.random() < 0.06;
      bubbles.push({ x: r + Math.random() * (BW - r * 2), y: BH + r, r, vy: 9 + Math.random() * 10 + (ROUND - left) * 0.25, ph: Math.random() * 6, c: gold ? '#f2c94c' : COLS[Math.floor(Math.random() * COLS.length)], gold });
    };
    const finish = () => {
      over = true;
      const coins = Math.min(60, Math.floor(score / 3));
      addCoins(coins); gainExp(5 + Math.floor(score / 5));
      if (score > (me.best.bubble || 0)) { me.best.bubble = score; $('#bb-best').textContent = score; }
      save();
      msg = `${score}개 톡톡! +${coins}🪙`;
      if (score >= 80) NG.net.send({ type: 'sys', slot: me.slot, text: `🫧 ${me.name}님이 비눗방울을 ${score}개 터뜨렸어요!` });
    };
    cv.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (over) { reset(); return; }
      const p = P.toBuf(e);
      for (let i = bubbles.length - 1; i >= 0; i--) {
        const q = bubbles[i];
        if (Math.hypot(p.x - q.x, p.y - q.y) <= q.r + 3) {
          bubbles.splice(i, 1);
          const now = performance.now();
          combo = now - lastPop < 650 ? combo + 1 : 1; lastPop = now;
          const gain = (q.gold ? 5 : 1) + (combo >= 5 ? 1 : 0);
          score += gain; $('#bb-score').textContent = score;
          for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; pops.push({ x: q.x, y: q.y, vx: Math.cos(a) * 30, vy: Math.sin(a) * 30, t: 0.35, c: q.c }); }
          pops.push({ x: q.x, y: q.y - 4, vx: 0, vy: -18, t: 0.7, txt: `+${gain}` });
          return;
        }
      }
    });
    let last = performance.now();
    const loop = (now) => {
      if (!document.body.contains(cv)) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (!over) {
        left -= dt; if (left <= 0) { left = 0; finish(); }
        spawnT -= dt; if (spawnT <= 0) { spawn(); spawnT = 0.35 + Math.random() * 0.5; }
      }
      b.fillStyle = '#d8d2c6'; b.fillRect(0, 0, BW, BH);
      b.fillStyle = '#c6bfb1'; for (let x = 5; x < BW; x += 10) b.fillRect(x, 0, 1, BH);
      b.fillStyle = '#8b7f77'; b.fillRect(0, BH - 8, BW, 8);
      bubbles = bubbles.filter((q) => {
        q.y -= q.vy * dt; q.ph += dt * 2;
        const x = q.x + Math.sin(q.ph) * 2;
        b.fillStyle = q.c; b.globalAlpha = 0.85; b.beginPath(); b.arc(x, q.y, q.r, 0, 7); b.fill(); b.globalAlpha = 1;
        b.strokeStyle = '#2b221e'; b.lineWidth = 1; b.beginPath(); b.arc(x, q.y, q.r, 0, 7); b.stroke();
        b.fillStyle = 'rgba(255,255,255,.85)'; b.fillRect(Math.round(x - q.r * 0.45), Math.round(q.y - q.r * 0.5), 2, 2);
        return q.y > -q.r - 2;
      });
      pops = pops.filter((p) => {
        p.t -= dt; p.x += p.vx * dt; p.y += p.vy * dt;
        if (!p.txt) { b.fillStyle = p.c; b.fillRect(Math.round(p.x), Math.round(p.y), 2, 2); }
        return p.t > 0;
      });
      b.fillStyle = '#2b221e'; b.fillRect(0, 0, BW, 4);
      b.fillStyle = left < 10 ? '#c0563f' : '#c0703a'; b.fillRect(0, 0, BW * left / ROUND, 4);
      P.present((g) => {
        g.font = '8px Galmuri11, monospace'; g.textAlign = 'center'; g.fillStyle = '#2b221e';
        for (const p of pops) if (p.txt) { g.globalAlpha = Math.min(1, p.t * 2); g.fillText(p.txt, p.x, p.y); g.globalAlpha = 1; }
        if (combo >= 3 && performance.now() - lastPop < 650 && !over) g.fillText(`콤보 ×${combo}`, BW / 2, 16);
        if (over) { g.fillStyle = 'rgba(43,34,30,.78)'; g.fillRect(0, BH / 2 - 16, BW, 30); g.fillStyle = '#f6d58e'; g.fillText(msg, BW / 2, BH / 2 - 3); g.fillText('탭해서 다시', BW / 2, BH / 2 + 9); }
      });
      requestAnimationFrame(loop);
    };
    gameKeys = null;
    requestAnimationFrame(loop);
  }

  // 🎣 멍 낚시: cast, watch the float bob, tap when it dips. Collect fish (and the odd boot).
  const FISH = [
    { id: 'crucian', e: '🐟', n: '붕어', r: 1, cm: [12, 28] }, { id: 'tropical', e: '🐠', n: '열대어', r: 1, cm: [6, 14] },
    { id: 'shrimp', e: '🦐', n: '새우', r: 1, cm: [4, 10] }, { id: 'crab', e: '🦀', n: '꽃게', r: 1, cm: [8, 18] },
    { id: 'boot', e: '👢', n: '낡은 장화', r: 0, cm: [25, 30] }, { id: 'can', e: '🥫', n: '빈 깡통', r: 0, cm: [10, 12] },
    { id: 'puffer', e: '🐡', n: '복어', r: 2, cm: [15, 35] }, { id: 'squid', e: '🦑', n: '오징어', r: 2, cm: [20, 45] },
    { id: 'octopus', e: '🐙', n: '문어', r: 2, cm: [30, 70] }, { id: 'turtle', e: '🐢', n: '바다거북', r: 3, cm: [50, 90] },
    { id: 'whale', e: '🐳', n: '아기고래(?)', r: 3, cm: [180, 300] }, { id: 'gem', e: '💎', n: '반짝이는 보석', r: 3, cm: [2, 4] },
  ];
  const FISH_W = { 0: 14, 1: 56, 2: 24, 3: 6 };
  function startFishing(box) {
    me.fish = me.fish || {};
    const caught = () => FISH.filter((f) => me.fish[f.id]).length;
    box.innerHTML = `<div class="cell-top"><span>도감 <b id="fs-col">${caught()}</b> / ${FISH.length}</span><span>오늘 <b id="fs-today">0</b>마리</span><span class="sub">탭 / Space</span></div>
      <canvas class="stack-cv" aria-label="멍 낚시"></canvas>
      <p class="sub" id="fs-msg">탭해서 찌를 던지고, 찌가 <b>쑥 들어가면</b> 바로 탭!</p>`;
    const cv = $('.stack-cv', box);
    const BW = 120, BH = 150;
    const P = pixelCanvas(cv, BW, BH), b = P.b;
    let state = 'idle', timer = 0, bobX = 80, bobY = 92, today = 0, ripple = 0, show = null, castT = 0;
    const say = (h) => { $('#fs-msg').innerHTML = h; };
    const pickFish = () => {
      const tot = FISH.reduce((a, f) => a + FISH_W[f.r] / FISH.filter((x) => x.r === f.r).length, 0);
      let roll = Math.random() * tot;
      for (const f of FISH) { roll -= FISH_W[f.r] / FISH.filter((x) => x.r === f.r).length; if (roll <= 0) return f; }
      return FISH[0];
    };
    const act = () => {
      if (state === 'idle' || state === 'result') {
        state = 'cast'; castT = 0; bobX = 55 + Math.random() * 50; show = null;
        say('찌가 날아가요… 🎣'); return;
      }
      if (state === 'wait') { state = 'idle'; say('앗, 너무 일렀어요. 다시 던져볼까요?'); return; }
      if (state === 'bite') {
        const f = pickFish();
        const cm = Math.round(f.cm[0] + Math.random() * (f.cm[1] - f.cm[0]));
        const isNew = !me.fish[f.id];
        me.fish[f.id] = (me.fish[f.id] || 0) + 1;
        const coins = [1, 2, 5, 15][f.r];
        addCoins(coins); gainExp(2 + f.r * 3); save();
        today++; $('#fs-today').textContent = today; $('#fs-col').textContent = caught();
        show = { f, t: 0 }; state = 'result';
        say(`${f.e} <b>${esc(f.n)}</b> ${cm}cm 낚았다!${isNew ? ' 🆕' : ''} +${coins}🪙 · 탭하면 다시 던져요`);
        if (f.r === 3) NG.net.send({ type: 'sys', slot: me.slot, text: `🎣 ${me.name}님이 ${f.e} ${f.n}(${cm}cm)을(를) 낚았어요!` });
      }
    };
    cv.addEventListener('pointerdown', (e) => { e.preventDefault(); act(); });
    gameKeys = (e) => { if (e.code !== 'Space') return false; if (!e.repeat) act(); return true; };
    let last = performance.now();
    const loop = (now) => {
      if (!document.body.contains(cv)) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const t = now / 1000;
      if (state === 'cast') { castT += dt * 2.2; if (castT >= 1) { state = 'wait'; timer = 2 + Math.random() * 6; ripple = 0.6; say('기다리는 중… 찌를 멍하니 바라봐요'); } }
      else if (state === 'wait') { timer -= dt; if (timer <= 0) { state = 'bite'; timer = 0.85; ripple = 0.6; } }
      else if (state === 'bite') { timer -= dt; if (timer <= 0) { state = 'idle'; say('놓쳤어요… 🫠 탭해서 다시 던져요'); } }
      if (show) show.t += dt;
      // sky, hills, water, dock
      const sky = b.createLinearGradient(0, 0, 0, 70); sky.addColorStop(0, '#b9c3c9'); sky.addColorStop(1, '#dcd6c8');
      b.fillStyle = sky; b.fillRect(0, 0, BW, 70);
      b.fillStyle = '#9fae9a'; for (let x = 0; x < BW; x += 2) b.fillRect(x, 62 - Math.sin(x * 0.07) * 6 - Math.sin(x * 0.19) * 2, 2, 12);
      b.fillStyle = '#5f7e85'; b.fillRect(0, 72, BW, BH - 72);
      b.fillStyle = '#7d9aa0'; for (let i = 0; i < 14; i++) { const x = (i * 37 + t * 6 * (i % 2 ? 1 : -1)) % (BW + 20) - 10, y = 78 + (i * 23) % 64; b.fillRect(Math.round(x), y, 6, 1); }
      b.fillStyle = '#8a6a50'; b.fillRect(0, 96, 28, 6); b.fillStyle = '#5e4636'; b.fillRect(4, 102, 3, 30); b.fillRect(20, 102, 3, 30);
      // rod & line
      b.strokeStyle = '#5e4636'; b.lineWidth = 2; b.beginPath(); b.moveTo(14, 96); b.lineTo(30, 70); b.stroke();
      let bx = bobX, by = bobY;
      if (state === 'cast') { const k = Math.min(1, castT); bx = 30 + (bobX - 30) * k; by = 70 + (bobY - 70) * k - Math.sin(k * Math.PI) * 30; }
      else if (state === 'wait') by = bobY + Math.sin(t * 2.5) * 0.8;
      else if (state === 'bite') by = bobY + 3 + Math.sin(t * 30) * 1.2;
      const showBob = state !== 'idle' && state !== 'result';
      if (showBob) {
        b.strokeStyle = 'rgba(43,34,30,.6)'; b.lineWidth = 1; b.beginPath(); b.moveTo(30, 70); b.quadraticCurveTo((30 + bx) / 2, Math.max(70, by) + 6, bx, by - 3); b.stroke();
        if (ripple > 0) { ripple -= dt; b.strokeStyle = 'rgba(236,228,210,.8)'; b.beginPath(); b.ellipse(bx, bobY + 2, (0.6 - ripple) * 20 + 3, (0.6 - ripple) * 5 + 1, 0, 0, 7); b.stroke(); }
        b.fillStyle = '#ece4d2'; b.fillRect(Math.round(bx) - 2, Math.round(by) - 3, 4, 3);
        b.fillStyle = '#c0403a'; b.fillRect(Math.round(bx) - 2, Math.round(by), 4, 3);
        b.fillStyle = '#2b221e'; b.fillRect(Math.round(bx), Math.round(by) - 6, 1, 3);
      }
      P.present((g) => {
        g.textAlign = 'center';
        if (state === 'bite') { g.font = 'bold 14px Galmuri11, monospace'; g.fillStyle = '#c0403a'; g.fillText('!', bx, by - 10); }
        if (state === 'idle') { g.font = '8px Galmuri11, monospace'; g.fillStyle = '#2b221e'; g.fillText('탭해서 던지기', BW / 2, 40); }
        if (show) {
          const k = Math.min(1, show.t * 3);
          g.font = `${Math.round(10 + k * 16)}px sans-serif`; g.fillText(show.f.e, BW / 2, 50 - k * 6);
          g.font = '8px Galmuri11, monospace'; g.fillStyle = '#2b221e'; g.fillText(show.f.n, BW / 2, 62);
        }
      });
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  // 📚 만화책 쌓기: one-tap stacker. Drop the sliding book on the pile; overhang is cut off.
  function startStack(box) {
    box.innerHTML = `<div class="cell-top"><span>높이 <b id="st-score">0</b></span><span>최고 <b id="st-best">${me.best.stack || 0}</b></span><span class="sub">탭 / Space</span></div>
      <canvas class="stack-cv" aria-label="만화책 쌓기"></canvas>
      <p class="sub">움직이는 만화책을 딱 맞게 떨어뜨려요. 완벽하게 맞추면 콤보!</p>`;
    const cv = $('.stack-cv', box), g = cv.getContext('2d');
    const BW = 120, BH = 150, H = 7; // low-res buffer
    const SP = ['#9c4a3f', '#414860', '#c09a4e', '#6f8a62', '#5f7e85', '#b07a6a', '#76362f', '#8a6a50'];
    const buf = document.createElement('canvas'); buf.width = BW; buf.height = BH;
    const b = buf.getContext('2d');
    let stack, cur, falling, score, combo, dead, camY, speed, flash;
    const reset = () => {
      stack = [{ x: 30, w: 60, c: SP[0] }]; score = 0; combo = 0; dead = false; camY = 0; speed = 38; falling = []; flash = 0;
      next();
    };
    const next = () => {
      const top = stack[stack.length - 1];
      const fromLeft = stack.length % 2 === 0;
      cur = { x: fromLeft ? 0 : BW - top.w, w: top.w, c: SP[stack.length % SP.length], dir: fromLeft ? 1 : -1 };
      speed = Math.min(95, 38 + stack.length * 2.2);
    };
    const drop = () => {
      if (dead) { reset(); return; }
      const top = stack[stack.length - 1];
      const l = Math.max(cur.x, top.x), r = Math.min(cur.x + cur.w, top.x + top.w);
      const ov = r - l;
      if (ov <= 0) { falling.push({ ...cur, y: stack.length, vy: 0 }); gameOver(); return; }
      if (Math.abs(cur.x - top.x) <= 1.2) {
        combo++; flash = 0.3;
        const grow = combo >= 3 ? Math.min(2, 60 - top.w) : 0;
        stack.push({ x: top.x - grow / 2, w: top.w + grow, c: cur.c });
      } else {
        combo = 0;
        if (cur.x < l) falling.push({ x: cur.x, w: l - cur.x, c: cur.c, y: stack.length, vy: 0 });
        if (cur.x + cur.w > r) falling.push({ x: r, w: cur.x + cur.w - r, c: cur.c, y: stack.length, vy: 0 });
        stack.push({ x: l, w: ov, c: cur.c });
      }
      score = stack.length - 1;
      $('#st-score').textContent = score;
      next();
    };
    const gameOver = () => {
      dead = true;
      const coins = Math.min(80, Math.floor(score / 2));
      addCoins(coins); gainExp(5 + score);
      if (score > (me.best.stack || 0)) { me.best.stack = score; $('#st-best').textContent = score; }
      save();
      if (score >= 30) NG.net.send({ type: 'sys', slot: me.slot, text: `📚 ${me.name}님이 만화책을 ${score}권 쌓았어요!` });
      toast(`📚 ${score}권 · +${coins}🪙  (탭하면 다시)`);
    };
    const book = (x, y, w, c) => {
      b.fillStyle = c; b.fillRect(Math.round(x), y, Math.round(w), H);
      b.fillStyle = 'rgba(255,255,255,.25)'; b.fillRect(Math.round(x), y + 1, Math.round(w), 1);
      b.fillStyle = '#efe7d4'; b.fillRect(Math.round(x + w) - 3, y + 1, 2, H - 2);
      b.fillStyle = '#2b221e'; b.strokeStyle = '#2b221e'; b.lineWidth = 1; b.strokeRect(Math.round(x) + 0.5, y + 0.5, Math.round(w) - 1, H - 1);
    };
    let last = performance.now();
    const loop = (now) => {
      if (!document.body.contains(cv)) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (!dead) {
        cur.x += cur.dir * speed * dt;
        if (cur.x + cur.w > BW + 20) cur.dir = -1; if (cur.x < -20) cur.dir = 1;
      }
      const targetCam = Math.max(0, (stack.length - 12) * H);
      camY += (targetCam - camY) * Math.min(1, dt * 6);
      b.fillStyle = '#d8d2c6'; b.fillRect(0, 0, BW, BH);
      b.fillStyle = '#c6bfb1'; for (let x = 5; x < BW; x += 10) b.fillRect(x, 0, 1, BH);
      const yOf = (i) => BH - 10 - (i + 1) * H + camY;
      b.fillStyle = '#8b7f77'; b.fillRect(0, yOf(-1) + H, BW, BH);
      stack.forEach((s, i) => { const y = yOf(i); if (y > -H && y < BH) book(s.x, Math.round(y), s.w, s.c); });
      if (!dead) book(cur.x, Math.round(yOf(stack.length)), cur.w, cur.c);
      falling = falling.filter((f) => { f.vy += 260 * dt; f.y -= f.vy * dt / H; const y = yOf(f.y); book(f.x, Math.round(y), f.w, f.c); return y < BH + 10; });
      if (flash > 0) { flash -= dt; b.fillStyle = `rgba(246,213,142,${flash * 2})`; b.fillRect(0, 0, BW, BH); }
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = cv.clientWidth, h = Math.round(w * BH / BW);
      if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); cv.style.height = h + 'px'; }
      g.imageSmoothingEnabled = false; g.drawImage(buf, 0, 0, cv.width, cv.height);
      g.font = `${Math.round(13 * dpr)}px Galmuri11, monospace`; g.textAlign = 'center'; g.fillStyle = '#2b221e';
      if (combo >= 2 && !dead) g.fillText(`퍼펙트 ×${combo}`, cv.width / 2, 22 * dpr);
      if (dead) { g.fillStyle = 'rgba(43,34,30,.75)'; g.fillRect(0, cv.height / 2 - 26 * dpr, cv.width, 44 * dpr); g.fillStyle = '#f6d58e'; g.fillText(`${score}권! 탭해서 다시`, cv.width / 2, cv.height / 2); }
      requestAnimationFrame(loop);
    };
    cv.addEventListener('pointerdown', (e) => { e.preventDefault(); drop(); });
    gameKeys = (e) => { if (e.code !== 'Space') return false; if (!e.repeat) drop(); return true; };
    reset();
    requestAnimationFrame(loop);
  }

  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  // ---------- sticky-note board ----------
  const NOTE_COLORS = ['#fff27a', '#ffb3c7', '#a8e6ff', '#b8f5a6', '#e2c4ff', '#ffd59e'];
  let noteColor = NOTE_COLORS[0];
  function renderBoard() {
    const cork = $('#cork');
    cork.innerHTML = shared.notes.length ? '' : '<div class="cork-empty">아직 포스트잇이 없어요.<br>아래에 써서 붙여보세요 📌</div>';
    for (const n of shared.notes) {
      const el = document.createElement('div');
      el.className = 'note';
      el.dataset.id = n.id;
      el.style.cssText = `left:${n.x * 100}%;top:${n.y * 100}%;--nc:${n.color};--rot:${n.rot}deg`;
      el.innerHTML = `<span class="pin"></span><p>${esc(n.text)}</p><small>${esc(n.name || '익명')}</small>`;
      cork.appendChild(el);
    }
    $('#board-count').textContent = shared.notes.length;
  }
  $('#note-colors').innerHTML = NOTE_COLORS.map((c, i) => `<button type="button" class="${i ? '' : 'on'}" style="background:${c}" data-c="${c}"></button>`).join('');
  $('#note-colors').addEventListener('click', (e) => {
    const b = e.target.closest('[data-c]'); if (!b) return;
    noteColor = b.dataset.c; $$('#note-colors button').forEach((x) => x.classList.toggle('on', x === b));
  });
  $('#note-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const text = $('#note-text').value.trim();
    if (!text) return;
    if (me.slot == null) { askIdentity(); return; }
    NG.net.send({ type: 'note', id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, slot: me.slot, name: me.name, text,
      color: noteColor, x: 0.04 + Math.random() * 0.62, y: 0.04 + Math.random() * 0.6, rot: (Math.random() - 0.5) * 10 });
    $('#note-text').value = ''; gainExp(3);
  });
  $('#note-text').addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) $('#note-form').requestSubmit(); });

  // drag to move, tap to read
  (function noteDrag() {
    const cork = $('#cork');
    let cur = null;
    cork.addEventListener('pointerdown', (e) => {
      const el = e.target.closest('.note'); if (!el) return;
      const r = cork.getBoundingClientRect(), er = el.getBoundingClientRect();
      cur = { el, sx: e.clientX, sy: e.clientY, ox: er.left - r.left, oy: er.top - r.top, moved: false, r };
      el.setPointerCapture(e.pointerId); el.classList.add('lift');
    });
    cork.addEventListener('pointermove', (e) => {
      if (!cur) return;
      const dx = e.clientX - cur.sx, dy = e.clientY - cur.sy;
      if (Math.hypot(dx, dy) > 5) cur.moved = true;
      if (!cur.moved) return;
      const w = cur.el.offsetWidth, h = cur.el.offsetHeight;
      const x = Math.max(0, Math.min(cur.r.width - w, cur.ox + dx)), y = Math.max(0, Math.min(cur.r.height - h, cur.oy + dy));
      cur.el.style.left = (x / cur.r.width * 100) + '%'; cur.el.style.top = (y / cur.r.height * 100) + '%';
    });
    const up = () => {
      if (!cur) return;
      const { el, moved } = cur; cur = null; el.classList.remove('lift');
      const n = shared.notes.find((o) => o.id === el.dataset.id); if (!n) return;
      if (moved) {
        NG.net.send({ ...n, type: 'note', x: parseFloat(el.style.left) / 100, y: parseFloat(el.style.top) / 100 });
      } else openNote(n);
    };
    cork.addEventListener('pointerup', up); cork.addEventListener('pointercancel', up);
  })();

  function openNote(n) {
    const d = new Date(n.t || Date.now());
    const when = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const card = modal(`<div class="note-full" style="--nc:${n.color}"><span class="pin"></span><p>${esc(n.text)}</p>
      <small>— ${esc(n.name || '익명')} · ${when}</small></div>
      <div class="row"><button class="btn danger" data-del-note>떼기 🗑️</button><button class="btn" data-close>닫기</button></div>`, 'note-modal');
    armed($('[data-del-note]', card), '한 번 더 누르면 떼요', () => { NG.net.send({ type: 'noteDel', id: n.id }); closeModal(); });
  }

  // ---------- chat ----------
  const chat = $('#chat');
  let unread = 0;
  function addChat(m) {
    const log = $('#chat-log');
    const el = document.createElement('div');
    const d = new Date(m.t || Date.now());
    const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    if (m.type === 'sys') {
      el.className = 'msg sys'; el.innerHTML = `<span>${esc(m.text)}</span>`;
    } else {
      const pl = shared.players[m.slot];
      const c = { hair: (pl && pl.look && pl.look.hair) || (m.slot ? NG.stage.defaultLook(m.slot).hair : '#e7dcc6') };
      el.className = 'msg' + (m.slot === me.slot ? ' mine' : '');
      el.innerHTML = `<b style="color:${c ? c.hair : '#fff'}">${esc(m.name || '???')}</b><span>${esc(m.text)}</span><time>${time}</time>`;
    }
    const atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 40;
    log.appendChild(el);
    while (log.children.length > 150) log.firstChild.remove();
    if (atBottom || m.slot === me.slot) log.scrollTop = log.scrollHeight;
    if (chat.classList.contains('min') && m.type === 'chat') { unread++; $('#chat-badge').textContent = unread; $('#chat-badge').hidden = false; }
  }
  $('#chat-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const inp = $('#chat-input');
    const text = inp.value.trim();
    if (!text) return;
    if (me.slot == null) { askIdentity(); return; }
    NG.net.send({ type: 'chat', slot: me.slot, name: me.name, text });
    inp.value = '';
  });
  $('#chat-min').addEventListener('click', () => {
    chat.classList.toggle('min');
    if (!chat.classList.contains('min')) { unread = 0; $('#chat-badge').hidden = true; $('#chat-log').scrollTop = 1e9; }
  });
  $('#chat-pill').addEventListener('click', () => { chat.classList.remove('min'); unread = 0; $('#chat-badge').hidden = true; });
  function setOpacity(v) {
    me.chatOpacity = v; chat.style.setProperty('--chat-a', v);
    $('#chat-op').value = v; save();
  }
  $('#chat-op').addEventListener('input', (e) => setOpacity(+e.target.value));
  $('#chat-ghost').addEventListener('click', () => {
    chat.classList.toggle('ghost');
    toast(chat.classList.contains('ghost') ? '👻 투명 모드: 마우스를 올리면 다시 보여요' : '투명 모드 해제');
  });
  $$('#chat-emotes button').forEach((b) => b.addEventListener('click', () => {
    if (me.slot == null) return;
    NG.stage.emote(me.slot, b.textContent);
    NG.net.send({ type: 'emote', slot: me.slot, e: b.textContent });
  }));

  // ---------- settings / identity / customizer ----------
  // Entering needs only a name; the full customizer (askIdentity(true)) is in settings.
  function askIdentity(full = me.slot != null) {
    let look = NG.sanitizeLook(me.look || null, NG.stage.defaultLook(me.uid));
    const first = me.slot == null;
    const chips = (key, list) => `<div class="cz-row"><span>${{ hairStyle: '머리 모양', hat: '모자', acc: '얼굴' }[key]}</span><div class="cz-opts">${
      list.map(([v, n]) => `<button type="button" class="cz-chip" data-k="${key}" data-v="${v}">${n}</button>`).join('')}</div></div>`;
    const sw = (key, label) => `<div class="cz-row"><span>${label}</span><div class="cz-opts">${
      NG.LOOK[key].map((c) => `<button type="button" class="cz-sw" data-k="${key}" data-v="${c}" style="background:${c}" aria-label="${label} ${c}"></button>`).join('')}</div></div>`;
    const card = !full ? modal(`<h3>👋 누구세요?</h3>
      <p class="sub">이름만 적으면 바로 입장해요. 들어온 사람마다 캐릭터가 하나씩 생기고, 모두 같은 아지트를 함께 봐요.</p>
      <input id="id-name" class="simple-name" maxlength="12" placeholder="이름 (닉네임)" value="${esc(me.name)}" aria-label="이름">
      <button class="btn primary" id="id-ok">입장하기</button>
      <p class="sub center">👕 캐릭터 꾸미기는 나중에 ⚙️ 설정 → <b>이름·꾸미기</b>에서 언제든 할 수 있어요.</p>`, 'identity simple-id') : modal(`<h3>👕 내 캐릭터</h3>
      <div class="cz">
        <div class="cz-left">
          <canvas id="cz-preview" class="cz-preview"></canvas>
          <input id="id-name" maxlength="12" placeholder="이름" value="${esc(me.name)}" aria-label="이름">
          <button type="button" class="btn" id="cz-random">🎲 랜덤</button>
        </div>
        <div class="cz-right">
          ${chips('hairStyle', NG.LOOK.hairStyle)}${sw('hair', '머리 색')}${sw('skin', '피부')}
          ${sw('top', '상의')}${sw('pants', '하의')}
          <div class="cz-row"><span>가운</span><div class="cz-opts"><button type="button" class="cz-chip" data-k="coat" data-v="1">🥼 실험 가운</button><button type="button" class="cz-chip" data-k="coat" data-v="0">벗기</button></div></div>
          ${chips('hat', NG.LOOK.hat)}${sw('hatColor', '모자 색')}${chips('acc', NG.LOOK.acc)}
        </div>
      </div>
      <p class="sub">💡 캐릭터는 알아서 돌아다녀요. <b>우클릭</b>(폰은 <b>길게 누르기</b>)하면 행동 링이 열리고, 원하는 행동 쪽으로 끌어서 놓으면 실행돼요. 방향키로도 움직일 수 있어요.</p>
      <button class="btn primary" id="id-ok">${first ? '입장하기' : '저장'}</button>`, 'identity');

    const sync = () => {
      $$('[data-k]', card).forEach((b) => {
        const k = b.dataset.k, v = b.dataset.v;
        b.classList.toggle('on', k === 'coat' ? (v === '1') === !!look.coat : look[k] === v);
      });
    };
    sync();
    card.addEventListener('click', (e) => {
      const b = e.target.closest('[data-k]');
      if (b) { look[b.dataset.k] = b.dataset.k === 'coat' ? b.dataset.v === '1' : b.dataset.v; sync(); }
    });
    if ($('#cz-random', card)) $('#cz-random', card).onclick = () => {
      const r = (a) => a[Math.floor(Math.random() * a.length)];
      look = { hairStyle: r(NG.LOOK.hairStyle)[0], hair: r(NG.LOOK.hair), skin: r(NG.LOOK.skin), top: r(NG.LOOK.top), pants: r(NG.LOOK.pants),
        coat: Math.random() < 0.3, hat: r(NG.LOOK.hat)[0], hatColor: r(NG.LOOK.hatColor), acc: r(NG.LOOK.acc)[0] };
      sync();
    };
    const cv = $('#cz-preview', card);
    const loop = (now) => {
      if (!cv || !document.body.contains(cv) || !$('#modal').classList.contains('show')) return;
      NG.stage.drawPreview(cv, look, now / 1000);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);

    const ok = () => {
      const name = $('#id-name').value.trim();
      if (!name) { toast('이름을 적어주세요'); $('#id-name').focus(); return; }
      const entering = me.slot == null;
      me.slot = me.uid; me.name = name.slice(0, 12);
      if (full || !me.look) me.look = { ...look };
      save();
      publishPresence(); renderHud(); closeModal();
      if (entering) {
        NG.net.send({ type: 'sys', slot: me.slot, text: `👋 ${me.name}님이 입장했어요` });
        setTimeout(() => toast('🖱️ 우클릭(폰은 길게 누르기) → 끌어서 행동! · 꾸미기는 ⚙️ 설정에서'), 600);
      } else toast('저장했어요');
      if ($('#w-settings').classList.contains('open')) renderSettings();
    };
    $('#id-ok').onclick = ok;
    $('#id-name').onkeydown = (e) => { if (e.key === 'Enter') ok(); };
    if (first) setTimeout(() => $('#id-name').focus(), 50);
  }
  NG.stage.onJoin = (id, name) => { if (Date.now() - bootAt > 3000) toast(`👋 ${name !== '손님' ? name + '님' : '누군가'}이 들어왔어요`); };
  NG.stage.onLeave = (id, name) => toast(`🚪 ${name}님이 나갔어요`);
  // ---------- rest spots & jukebox ----------
  const spotCool = {};
  NG.stage.onArrive = (slot, id, manual) => {
    if (slot !== me.slot || !manual) return;
    const s = NG.stage.spots.find((x) => x.id === id);
    if (!s) return;
    const fx = s.fx;
    if (fx.music) { openWin('w-music'); return; }
    if (id === 'bar') { // what you ordered decides the effect
      const d = NG.DRINKS.find((x) => x.id === me.drink) || NG.DRINKS[0];
      const parts = [];
      if (d.k === 'coffee') { const n = d.id === 'espresso' ? 45 : 35; me.caffeine = Math.min(100, me.caffeine + n); tickGauges.warned = false; parts.push(`카페인 +${n}`); }
      else if (d.k === 'soft') { me.focus = Math.min(100, me.focus + 15); parts.push('정신력 +15'); }
      else { me.focus = Math.min(100, me.focus + 8); parts.push('정신력 +8 · 알딸딸 🥴'); }
      gainExp(2); save(); renderHud();
      toast(`${d.e} ${d.n} 한 잔 · ${parts.join(' · ')}`);
      return;
    }
    const now = Date.now();
    if (now - (spotCool[id] || 0) < 45000) { toast(fx.msg); return; }
    spotCool[id] = now;
    const parts = [];
    if (fx.caffeine) { me.caffeine = Math.min(100, me.caffeine + fx.caffeine); parts.push(`카페인 +${fx.caffeine}`); tickGauges.warned = false; }
    if (fx.focus) { me.focus = Math.min(100, me.focus + fx.focus); parts.push(`정신력 +${fx.focus}`); }
    gainExp(fx.exp || 2); save(); renderHud();
    const msg = id === 'window' ? `🪟 창밖은 ${NG.stage.weather().name}… 멍` : fx.msg;
    toast(`${msg}${parts.length ? ' · ' + parts.join(' · ') : ''}`);
  };
  function renderRest() {
    const cur = NG.stage.myTask();
    $('#rest-list').innerHTML = NG.stage.spots.map((s) => {
      const who = NG.stage.chars.filter((c) => c.task && c.task.spot === s.id && c.task.phase === 'do').map((c) => esc(c.name));
      return `<button class="rest ${cur === s.id ? 'on' : ''}" data-spot="${s.id}"><span class="re">${s.e}</span>
        <span class="rn"><b>${esc(s.n)}</b><small>${esc(s.desc)}${s.id === 'window' ? ' · 창밖: ' + NG.stage.weather().name : ''}${who.length ? ' · ' + who.join(', ') + ' 이용 중' : ''}</small></span><em>${cur === s.id ? '이용 중' : '가기'}</em></button>`;
    }).join('');
    renderMusic();
  }
  $('#rest-list').addEventListener('click', (e) => {
    const b = e.target.closest('[data-spot]'); if (!b) return;
    NG.stage.onAction('spot:' + b.dataset.spot);
    if (isNarrow()) closeWin($('#w-rest')); else setTimeout(renderRest, 50);
  });
  // ---------- shared jukebox: a YouTube video everyone in the room hears at the same position ----------
  const parseVid = (u) => {
    const s = String(u || '').trim();
    const m = s.match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/|\/live\/)([\w-]{11})/);
    return m ? m[1] : /^[\w-]{11}$/.test(s) ? s : null;
  };
  let ytLoading = null, yt = null, ytTitle = '', ytFailed = false;
  function loadYT() {
    if (window.YT && window.YT.Player) return Promise.resolve();
    if (ytLoading) return ytLoading;
    ytLoading = new Promise((res, rej) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { if (prev) prev(); res(); };
      const sc = document.createElement('script');
      sc.src = 'https://www.youtube.com/iframe_api'; sc.onerror = () => rej(new Error('load'));
      document.head.appendChild(sc);
      setTimeout(() => rej(new Error('timeout')), 10000);
    });
    ytLoading.catch(() => { ytLoading = null; ytFailed = true; renderMusic(); });
    return ytLoading;
  }
  async function ensurePlayer() {
    await loadYT();
    if (yt) return yt;
    return new Promise((res) => {
      const p = new window.YT.Player('yt-box', {
        width: '100%', height: '100%', playerVars: { playsinline: 1, rel: 0, modestbranding: 1 },
        events: {
          onReady: () => { yt = p; p.setVolume(Math.round(+$('#music-vol').value * 100)); if (me.listen) p.unMute(); else p.mute(); res(p); },
          onStateChange: (e) => {
            NG.music.shared = e.data === 1;
            if (e.data === 0) fallbackJazz(); // the shared song ended
            try { ytTitle = (p.getVideoData() || {}).title || ytTitle; } catch { /* not ready */ }
            renderMusic();
          },
          onError: () => toast('이 영상은 다른 사이트에서 재생할 수 없게 막혀 있어요. 다른 영상을 골라주세요'),
        },
      });
    });
  }
  async function applyMusic() {
    const m = shared.music;
    renderMusic();
    NG.stage.projecting = !!(m && m.vid);
    if (!m || !m.vid) { if (yt) yt.stopVideo(); if (NG.music.shared || yt) fallbackJazz(); NG.music.shared = false; return; }
    try {
      const p = await ensurePlayer();
      if (shared.music !== m) return; // changed while loading
      if (NG.music.playing && me.listen) NG.music.stop();
      if (me.listen) p.unMute(); else p.mute(); // everyone sees the screen; sound only for listeners
      ytTitle = '';
      p.loadVideoById({ videoId: m.vid, startSeconds: Math.max(0, (Date.now() - m.startedAt) / 1000) });
    } catch { renderMusic(); }
  }
  // When the shared song ends or is stopped, listeners drift back into the house jazz; the screen rolls up.
  function fallbackJazz() {
    NG.music.shared = false;
    NG.stage.projecting = false;
    if (me.listen && !NG.music.playing) NG.music.start();
    renderMusic();
  }
  function renderMusic() {
    const m = shared.music, on = !!(m && m.vid);
    $('#mu-now').textContent = on ? `🎶 ${ytTitle || '유튜브 음악'}` : '지금 아무것도 안 나와요';
    $('#mu-by').textContent = on ? `${m.name || '누군가'}님이 틀었어요 · ${me.listen ? '🔊 듣는 중' : '🔇 소리 꺼짐 (화면만)'}` : '';
    $('#mu-listen').checked = !!me.listen;
    $('#music-btn').textContent = NG.music.playing ? '⏸ 기본 재즈 끄기' : '▶ 기본 재즈 (나만 듣기)';
    $('#music-nav').classList.toggle('playing', NG.music.playing || !!NG.music.shared);
    if (ytFailed) $('#mu-note').textContent = '유튜브를 불러오지 못했어요. 이 주소(예: claude.ai 링크)에서는 유튜브를 쓸 수 없을 수 있어요. GitHub Pages 주소에서 열어주세요.';
  }
  $('#mu-form').addEventListener('submit', (e) => {
    e.preventDefault();
    if (me.slot == null) { askIdentity(); return; }
    const vid = parseVid($('#mu-url').value);
    if (!vid) { toast('유튜브 주소를 붙여넣어 주세요 (youtube.com/watch?v=… 또는 youtu.be/…)'); return; }
    NG.net.send({ type: 'music', slot: me.slot, name: me.name, vid, startedAt: Date.now() });
    NG.net.send({ type: 'sys', slot: me.slot, text: `🎷 ${me.name}님이 주크박스에 음악을 틀었어요` });
    $('#mu-url').value = '';
    if (!me.listen) { me.listen = true; save(); renderMusic(); } // whoever plays it hears it
  });
  $('#mu-stop').addEventListener('click', () => {
    if (!shared.music || !shared.music.vid) return;
    NG.net.send({ type: 'music', slot: me.slot, name: me.name, vid: '', startedAt: Date.now() });
  });
  $('#mu-listen').addEventListener('change', (e) => {
    me.listen = e.target.checked; save();
    if (yt) { if (me.listen) { yt.unMute(); if (NG.music.playing) NG.music.stop(); } else yt.mute(); renderMusic(); } else applyMusic();
  });
  // Keep the video glued to the pixel screen (camera pans, window resizes, roll-down animation).
  (function placeProjection() {
    const el = $('#proj'), r = NG.stage.screenRect();
    const show = !!(shared.music && shared.music.vid && yt && NG.stage.projectorReady && r);
    el.hidden = !show;
    if (show) { el.style.left = r.left + 'px'; el.style.top = r.top + 'px'; el.style.width = r.width + 'px'; el.style.height = r.height + 'px'; }
    requestAnimationFrame(placeProjection);
  })();
  $('#music-btn').addEventListener('click', () => { NG.music.toggle(); renderMusic(); });
  $('#music-vol').addEventListener('input', (e) => { NG.music.setVolume(+e.target.value); if (yt) yt.setVolume(Math.round(+e.target.value * 100)); });
  // Browsers block sound until the first click; start the shared song then.
  window.addEventListener('pointerdown', () => {
    if (shared.music && shared.music.vid && !NG.music.shared) applyMusic();
  }, { once: true, capture: true });

  // ---------- first-run tutorial ----------
  const TUT = [
    { art: 'split', t: '작업하면서 옆에 띄워두세요', d: '브라우저 창을 <b>가로로 좁게</b> 줄여서 작업 화면 옆에 붙여두면 딱이에요. 좁은 창에서도 화면이 알아서 맞춰지고, ⤡ 버튼을 누르면 아지트와 채팅만 남는 미니 모드가 돼요.' },
    { art: '🛋️', t: '캐릭터는 알아서 놀아요', d: '들어온 사람마다 캐릭터가 생겨서 아지트를 돌아다니며 쉬어요. 모두 같은 화면을 함께 봐요. <b>가구를 누르면</b> 내 캐릭터가 거기로 가서 쉬고, <b>우클릭</b>(폰은 길게 누르기)한 뒤 끌어서 놓으면 인사·춤·점프 같은 행동을 해요.' },
    { art: '💬', t: '상태 · 수다 · 포스트잇', d: '"카페인이 필요함", "웃참중" 같은 상태를 머리 위에 띄우고, 투명 채팅창으로 수다 떨고, 📌 게시판에 포스트잇을 붙여요.' },
    { art: '🎰', t: '코인 넉넉히 가챠', d: '코인 300개로 시작하고, 쓰고 나면 2분 뒤 다시 300개로 채워져요. <b>가챠샵</b>에서 게임·침착맨·아이돌 피규어를 뽑아요. 이제 이름을 정해볼까요?' },
  ];
  function showTutorial(step = 0) {
    const s = TUT[step];
    const art = s.art === 'split'
      ? `<div class="tut-split"><div class="tw work"><i></i><i></i><i></i><i></i><span>작업 화면</span></div><div class="tw nog"><span>🎯</span><span>아지트</span></div></div>`
      : `<div class="tut-art">${s.art}</div>`;
    const card = modal(`<div class="tut">${art}<h3>${s.t}</h3><p>${s.d}</p>
      <div class="tut-dots">${TUT.map((_, i) => `<i class="${i === step ? 'on' : ''}"></i>`).join('')}</div>
      <div class="row">${step > 0 ? '<button class="btn" id="tut-prev">이전</button>' : '<button class="btn" id="tut-skip">건너뛰기</button>'}
        <button class="btn primary" id="tut-next">${step < TUT.length - 1 ? '다음' : '이름 정하기'}</button></div></div>`, 'tutorial');
    const done = () => { me.tutorial = true; save(); if (me.slot == null) askIdentity(); else closeModal(); };
    $('#tut-next', card).onclick = () => (step < TUT.length - 1 ? showTutorial(step + 1) : done());
    const prev = $('#tut-prev', card); if (prev) prev.onclick = () => showTutorial(step - 1);
    const skip = $('#tut-skip', card); if (skip) skip.onclick = done;
  }
  $('#set-tutorial').addEventListener('click', () => showTutorial(0));

  const DRINK_KINDS = [['coffee', '☕ 커피'], ['soft', '🧃 논커피'], ['alcohol', '🍸 술']];
  function openBar() {
    modal(`<h3>☕ 재즈 바 메뉴</h3><p class="sub">한 잔 고르면 바에 앉아서 마셔요.</p>
      ${DRINK_KINDS.map(([k, label]) => `<h4 class="bar-h">${label}</h4><div class="bar-menu">${NG.DRINKS.filter((d) => d.k === k).map((d) =>
        `<button class="bar-item" data-drink="${d.id}"><span>${d.e}</span><b>${esc(d.n)}</b><small>${esc(d.d)}</small></button>`).join('')}</div>`).join('')}
      <p class="sub">🔞 술은 아지트 안의 가상 한 잔이에요.</p><div class="row"><button class="btn" data-close>닫기</button></div>`, 'bar-modal');
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-drink]'); if (!b) return;
    const d = NG.DRINKS.find((x) => x.id === b.dataset.drink); if (!d) return;
    me.drink = d.id; save();
    for (const a of ['drink:' + d.id, 'spot:bar']) { NG.stage.act(me.slot, a); NG.net.send({ type: 'act', slot: me.slot, a }); }
    closeModal(); toast(`${d.e} ${d.n} 주문! 바로 가는 중…`);
  });
  NG.stage.onAction = (a) => {
    if (me.slot == null) { askIdentity(); return; }
    if (a === 'spot:bar') { openBar(); return; }
    if (a === 'dart') { NG.stage.startDart(); return; }
    if (a === 'sip') { drinkCoffee(); return; }
    NG.stage.act(me.slot, a);
    NG.net.send({ type: 'act', slot: me.slot, a });
  };
  function renderSettings() {
    $('#set-who').innerHTML = me.slot != null ? esc(me.name) : '미입장';
    $('#set-team').value = NG.net.team;
    $('#set-net').textContent = NG.net.mode === 'p2p'
      ? (NG.net.peers > 0 ? `🟢 P2P · 지금 팀원 ${NG.net.peers}명과 연결 (채팅·상태·게시판 실시간 공유)` : '🟡 P2P · 아직 혼자예요. 같은 팀 코드로 들어온 팀원과 자동 연결돼요')
      : NG.net.mode === 'claude' ? '🟢 claude.ai 공유 (링크를 연 팀원끼리 채팅·상태·게시판 공유)'
      : NG.net.online ? '🟢 팀 서버 연결 (채팅·상태·게시판 공유)' : '🟡 로컬 모드 (같은 브라우저 탭끼리만 공유)';
    $('#set-popup').hidden = NG.net.mode === 'claude';
    $('#set-reconnect').hidden = NG.net.mode !== 'p2p';
  }
  $('#set-change').addEventListener('click', () => askIdentity(true));
  const reconnect = () => { if (NG.net.mode !== 'p2p') return; NG.net.reconnect(); toast('🔄 다시 연결하는 중… 팀원이 있으면 몇 초 안에 보여요'); };
  $('#set-reconnect').addEventListener('click', reconnect);
  $('#net').addEventListener('click', reconnect);
  $('#net').style.cursor = 'pointer';
  $('#set-team-save').addEventListener('click', () => {
    const v = $('#set-team').value.trim();
    if (!v) return;
    NG.net.setTeam(v); toast('팀 코드를 바꿨어요. 다시 연결할게요…'); setTimeout(() => location.reload(), 800);
  });
  $('#set-popup').addEventListener('click', () => {
    const w = window.open(location.href.split('?')[0] + '?mini', 'nogari-mini', 'width=420,height=640,menubar=no,toolbar=no,location=no,status=no');
    if (!w) toast('팝업이 차단됐어요. 브라우저에서 팝업을 허용해주세요.');
  });
  armed($('#set-reset'), '한 번 더 누르면 초기화돼요', () => {
    const keep = { slot: me.slot, uid: me.uid, name: me.name, look: me.look };
    me = { ...def, ...keep, best: { ...def.best }, figures: {}, custom: [], lastTick: Date.now() }; save(); renderHud(); toast('초기화했어요');
  });

  // ---------- mini mode ----------
  function setMini(on) {
    document.body.classList.toggle('mini', on);
    $('#mini-toggle').textContent = on ? '⤢' : '⤡';
    $('#mini-toggle').title = on ? '전체 UI 보기' : '미니 모드 (스테이지 + 채팅만)';
    requestAnimationFrame(() => NG.stage.resize());
  }
  $('#mini-toggle').addEventListener('click', () => setMini(!document.body.classList.contains('mini')));
  $('#mini-menu').addEventListener('click', () => setMini(false));

  // ---------- network ----------
  function handle(m) {
    if (m.type === 'chat') { addChat(m); NG.stage.say(m.slot, m.text); }
    else if (m.type === 'sys') addChat(m);
    else if (m.type === 'presence') {
      shared.players[m.slot] = m;
      if (m.slot === me.slot && m.name && (m.name !== me.name || JSON.stringify(m.look || null) !== JSON.stringify(me.look || null))) {
        me.name = m.name; if (m.look) me.look = m.look; save(); renderHud();
      }
      NG.stage.setPlayer(m.slot, m.name, m.status, m.look || null);
      if ($('#w-status').classList.contains('open')) renderStatus();
    } else if (m.type === 'emote') { if (m.slot !== me.slot) NG.stage.emote(m.slot, m.e); }
    else if (m.type === 'act') {
      if (m.slot === me.slot) return;
      const pf = /^pf:(\d):(\w+)$/.exec(m.a);
      if (pf) NG.stage.feedPet(+pf[1], pf[2], m.slot);
      else if (m.a !== 'dart') NG.stage.act(m.slot, m.a);
    }
    else if (m.type === 'pos') { if (m.slot !== me.slot) NG.stage.applyRemote(m.slot, m); }
    else if (m.type === 'music') {
      const fresh = !shared.music || shared.music.vid !== m.vid || shared.music.startedAt !== m.startedAt;
      shared.music = m;
      if (fresh) { applyMusic(); if (m.vid && m.slot !== me.slot && Date.now() - bootAt > 3000) toast(`🎷 ${m.name}님이 음악을 틀었어요${me.listen ? '' : ' (공유 음악 듣기가 꺼져 있어요)'}`); }
    }
    else if (m.type === 'note') {
      const i = shared.notes.findIndex((o) => o.id === m.id);
      if (i >= 0) shared.notes[i] = m; else { shared.notes.push(m); if (m.slot !== me.slot && Date.now() - bootAt > 4000) toast(`📌 ${m.name}님이 포스트잇을 붙였어요`); }
      renderBoard(); bumpBoard();
    } else if (m.type === 'noteDel') { shared.notes = shared.notes.filter((o) => o.id !== m.id); renderBoard(); }
  }
  // Stream my character (position, rest spot, pose, animation) so everyone sees the same thing; ~5×/s on change, 1×/s idle.
  let lastPos = '', lastPosAt = 0;
  setInterval(() => {
    if (me.slot == null || !NG.net.online) return;
    const p = NG.stage.myPos(); if (!p) return;
    const key = JSON.stringify({ ...p, animT: 0 });
    const now = Date.now();
    if (key === lastPos && now - lastPosAt < 1000) return;
    lastPos = key; lastPosAt = now;
    NG.net.send({ type: 'pos', ...p });
  }, 200);

  function bumpBoard() { $('#board-count').textContent = shared.notes.length; }

  async function boot() {
    if (new URLSearchParams(location.search).has('mini')) setMini(true);
    NG.stage.init();
    chat.style.setProperty('--chat-a', me.chatOpacity); $('#chat-op').value = me.chatOpacity;
    if (window.innerWidth < 640) chat.classList.add('min');
    const st = await NG.net.start();
    NG.ui.setNet(NG.net.online);
    for (const [k, p] of Object.entries(st.players || {})) {
      shared.players[k] = p;
      if (p && p.name) NG.stage.setPlayer(k, p.name, p.status, p.look || null);
    }
    shared.notes = st.notes || [];
    // The chat starts empty on every visit: what was said while you were away stays away.
    if (st.music && st.music.vid && Date.now() - st.music.startedAt < 6 * 3600e3) shared.music = st.music;
    applyMusic(); // starts muted (allowed without a click) so the screen shows right away
    NG.net.on(handle);
    tickGauges(); setInterval(tickGauges, 30000);
    renderHud(); bumpBoard();
    if (!me.tutorial && me.slot == null) showTutorial(); else if (me.slot == null) askIdentity(); else publishPresence();
  }
  boot();
})();
