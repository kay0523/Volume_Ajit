// App shell: identity, status, figures/gacha, mini games, sticky-note board, translucent chat, responsive windows.
(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const KEY = 'nogari.me.v1';

  // ---------- persistent personal state ----------
  const def = { slot: null, name: '', look: null, tutorial: false, gacha: {}, holo: {}, status: null, custom: [], coins: 60, figures: {}, shelf: true,
    caffeine: 80, focus: 90, exp: 0, lv: 1, best: { dart: 0, quiz: 0, memory: 0 }, chatOpacity: 0.55, lastTick: Date.now() };
  let me;
  try { me = { ...def, ...JSON.parse(localStorage.getItem(KEY)) }; } catch { me = { ...def }; }
  me.best = { ...def.best, ...me.best };
  me.gacha = me.gacha || {}; me.holo = me.holo || {};
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(me)); } catch { /* blocked */ } };

  const shared = { players: {}, notes: [] };

  NG.app = {
    get me() { return me.slot; },
    myStatus: () => me.status,
    shelfFigures: () => NG.FIGURES.filter((f) => me.figures[f.id]),
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
    showFigure(f) {
      const r = NG.RARITY[f.r];
      modal(`<div class="fig-big">${f.e}</div><h3>${esc(f.n)} <span class="rar" style="--rc:${r.c}">${r.n}</span></h3>
        <p>${esc(f.f)}</p><button class="btn" data-close>닫기</button>`);
    },
    charInfo(c) {
      const p = shared.players[c.i];
      const st = c.status ? `${c.status.e} ${esc(c.status.t)}` : '상태 없음';
      const who = p && p.name ? esc(p.name) : esc(c.d.name) + ' (빈 캐릭터)';
      toast(`${who} · ${st}`);
    },
  };
  document.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeModal(); });

  function addCoins(n) { me.coins += n; renderHud(); }
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
    if (isNarrow()) $$('.win.panel.open').forEach((o) => o !== w && o.classList.remove('open'));
    w.classList.add('open'); focusWin(w); clampWin(w);
    $$(`[data-win="${id}"]`).forEach((b) => b.classList.add('on'));
    if (id === 'w-figures') renderFigures();
    if (id === 'w-games') renderGames();
    if (id === 'w-board') renderBoard();
    if (id === 'w-status') renderStatus();
    if (id === 'w-settings') renderSettings();
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

  // ---------- figures / gacha ----------
  let figTab = 'anatomy';
  function renderFigures() {
    $$('#fig-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.t === figTab));
    $('#fig-anatomy').hidden = figTab !== 'anatomy';
    $('#fig-gacha').hidden = figTab === 'anatomy';
    if (figTab !== 'anatomy') { renderGachaInto($('#fig-gacha'), figTab); return; }
    const owned = NG.FIGURES.filter((f) => me.figures[f.id]).length;
    $('#fig-count').textContent = `${owned} / ${NG.FIGURES.length}`;
    $('#fig-grid').innerHTML = NG.FIGURES.map((f) => {
      const n = me.figures[f.id];
      const r = NG.RARITY[f.r];
      return n
        ? `<button class="fig" data-id="${f.id}" style="--rc:${r.c}"><span class="fe">${f.e}</span><span class="fn">${esc(f.n)}</span>${n > 1 ? `<em>×${n}</em>` : ''}</button>`
        : `<div class="fig locked" style="--rc:${r.c}"><span class="fe">?</span><span class="fn">${r.n}</span></div>`;
    }).join('');
    $('#gacha-btn').disabled = me.coins < 30;
  }
  $('#fig-tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-t]'); if (b) { figTab = b.dataset.t; renderFigures(); } });
  $('#fig-grid').addEventListener('click', (e) => {
    const b = e.target.closest('[data-id]'); if (b) NG.ui.showFigure(NG.FIGURES.find((f) => f.id === b.dataset.id));
  });
  $('#gacha-btn').addEventListener('click', () => {
    if (me.coins < 30) { toast('🪙 코인이 부족해요. 미니게임으로 모아보세요!'); return; }
    me.coins -= 30;
    const roll = Math.random() * 100;
    const rar = roll < NG.RARITY[3].w ? 3 : roll < NG.RARITY[3].w + NG.RARITY[2].w ? 2 : 1;
    const pool = NG.FIGURES.filter((f) => f.r === rar);
    const f = pool[Math.floor(Math.random() * pool.length)];
    const isNew = !me.figures[f.id];
    me.figures[f.id] = (me.figures[f.id] || 0) + 1;
    if (!isNew) me.coins += 5;
    gainExp(isNew ? 15 : 5); save(); renderHud();
    const machine = $('#gacha-machine'); machine.classList.remove('spin'); void machine.offsetWidth; machine.classList.add('spin');
    setTimeout(() => {
      renderFigures();
      const r = NG.RARITY[f.r];
      modal(`<div class="capsule" style="--rc:${r.c}"><div class="fig-big pop">${f.e}</div></div>
        <h3>${isNew ? '🆕 NEW! ' : ''}${esc(f.n)} <span class="rar" style="--rc:${r.c}">${r.n}</span></h3>
        <p>${esc(f.f)}</p>${isNew ? '<p class="sub">진열대에 올려놨어요!</p>' : '<p class="sub">중복이라 5🪙 돌려받았어요.</p>'}
        <button class="btn" data-close>좋아요</button>`, 'gacha');
      if (f.r === 3 && isNew) NG.net.send({ type: 'sys', slot: me.slot, text: `✨ ${me.name}님이 에픽 피규어 [${f.n}]을(를) 뽑았어요!` });
    }, 650);
  });

  // ---------- gacha shop (band / 침착맨 / idol) ----------
  const gItem = (key, id) => NG.GACHA[key].items.find((x) => x.id === id);
  function renderGachaInto(box, key) {
    const G = NG.GACHA[key];
    const own = me.gacha[key] || {};
    const n = G.items.filter((i) => own[i.id]).length;
    box.innerHTML = `<div class="gshop" style="--gc:${G.color}">
      <div class="gshop-head"><span class="gm">${G.e}</span>
        <div class="gi"><b>${esc(G.n)}</b><small>${esc(G.desc)}</small><small>수집 ${n} / ${G.items.length}</small></div>
        <button class="btn primary" data-pull="${key}" ${me.coins < G.cost ? 'disabled' : ''}>🎰 ${G.cost}🪙</button></div>
      <div class="gcards">${G.items.map((it) => {
        const has = own[it.id];
        return `<button class="gcard ${has ? '' : 'locked'} ${me.holo[it.id] ? 'holo' : ''}" data-item="${it.id}" data-key="${key}" ${has ? '' : 'disabled'}>
          <canvas></canvas><span>${has ? esc(it.n) : '???'}</span>${has && key === 'idol' ? `<small>${esc(it.g)}</small>` : ''}</button>`;
      }).join('')}</div></div>`;
    $$('.gcard', box).forEach((b) => {
      const it = gItem(key, b.dataset.item);
      NG.stage.drawFigure($('canvas', b), it, { locked: !own[it.id], holo: !!me.holo[it.id] });
    });
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
    if (me.coins < G.cost) { toast('🪙 코인이 부족해요. 미니게임으로 모아보세요!'); return; }
    me.coins -= G.cost;
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
    } else if (gameTab === 'quiz') startQuiz(box);
    else if (gameTab === 'cell') startCell(box);
    else startStack(box);
  }
  $('#game-tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-g]'); if (b) { gameTab = b.dataset.g; renderGames(); } });
  window.addEventListener('keydown', (e) => {
    if (!gameKeys || !$('#w-games').classList.contains('open') || /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
    if (gameKeys(e)) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);

  // 🧬 세포 2048: merge cells up the chain of life. Arrow keys or swipe.
  const CELL = [null, ['💧', '물방울'], ['🦠', '세포'], ['🧫', '조직'], ['🩸', '혈액'], ['🦴', '뼈'], ['💪', '근육'], ['🫁', '허파'],
    ['🫀', '심장'], ['🧠', '뇌'], ['🧬', 'DNA'], ['🧍', '인간'], ['👑', '해부학 왕']];
  function startCell(box) {
    let g = Array.from({ length: 4 }, () => Array(4).fill(0));
    let score = 0, over = false, best = me.best.cell || 0, merged = new Set(), born = null;
    const spawn = () => {
      const empty = [];
      g.forEach((r, y) => r.forEach((v, x) => { if (!v) empty.push([x, y]); }));
      if (!empty.length) return;
      const [x, y] = empty[Math.floor(Math.random() * empty.length)];
      g[y][x] = Math.random() < 0.9 ? 1 : 2; born = `${x},${y}`;
    };
    const canMove = () => g.some((r, y) => r.some((v, x) => !v || (x < 3 && r[x + 1] === v) || (y < 3 && g[y + 1][x] === v)));
    const slide = (row) => {
      const a = row.filter(Boolean), out = [], hits = [];
      for (let i = 0; i < a.length; i++) {
        if (a[i] === a[i + 1]) { const v = a[i] + 1; out.push(v); hits.push(out.length - 1); score += 2 ** v; i++; } else out.push(a[i]);
      }
      while (out.length < 4) out.push(0);
      return { out, hits };
    };
    const move = (dir) => {
      if (over) return;
      const before = JSON.stringify(g);
      merged = new Set();
      for (let i = 0; i < 4; i++) {
        let line = dir === 'left' || dir === 'right' ? g[i].slice() : g.map((r) => r[i]);
        if (dir === 'right' || dir === 'down') line.reverse();
        let { out, hits } = slide(line);
        if (dir === 'right' || dir === 'down') { out = out.reverse(); hits = hits.map((h) => 3 - h); }
        for (let k = 0; k < 4; k++) {
          if (dir === 'left' || dir === 'right') g[i][k] = out[k]; else g[k][i] = out[k];
        }
        hits.forEach((h) => merged.add(dir === 'left' || dir === 'right' ? `${h},${i}` : `${i},${h}`));
      }
      if (JSON.stringify(g) === before) return;
      spawn();
      if (!canMove()) finish();
      draw();
    };
    const finish = () => {
      over = true;
      const coins = Math.min(80, Math.floor(score / 40));
      addCoins(coins); gainExp(10 + Math.floor(score / 200));
      const top = Math.max(...g.flat());
      if (score > best) { best = me.best.cell = score; }
      save();
      setTimeout(() => {
        const ov = document.createElement('div');
        ov.className = 'g-over';
        ov.innerHTML = `<b>${CELL[top][0]} ${CELL[top][1]}까지!</b><span>${score}점 · +${coins}🪙</span><button class="btn primary">다시 하기</button>`;
        $('.cell-board', box).appendChild(ov);
        $('button', ov).onclick = () => startCell(box);
        if (top >= 9) NG.net.send({ type: 'sys', slot: me.slot, text: `🧬 ${me.name}님이 세포 2048에서 ${CELL[top][1]}까지 키웠어요! (${score}점)` });
      }, 300);
    };
    const draw = () => {
      $('#cell-score').textContent = score; $('#cell-best').textContent = Math.max(best, score);
      $('.cell-board', box).innerHTML = g.map((r, y) => r.map((v, x) => {
        const k = `${x},${y}`;
        return `<div class="cell lv${Math.min(v, 12)} ${merged.has(k) ? 'pop' : ''} ${born === k ? 'born' : ''}">${v ? `<span>${CELL[v][0]}</span><small>${CELL[v][1]}</small>` : ''}</div>`;
      }).join('')).join('');
    };
    box.innerHTML = `<div class="cell-top"><span>점수 <b id="cell-score">0</b></span><span>최고 <b id="cell-best">0</b></span><button class="btn" id="cell-new">새 판</button></div>
      <div class="cell-board" tabindex="0" aria-label="세포 2048 보드"></div>
      <p class="sub">방향키나 스와이프로 밀어서 같은 것끼리 합쳐요. 💧→🦠→🧫→🩸→🦴→💪→🫁→🫀→🧠→🧬→🧍→👑</p>`;
    $('#cell-new').onclick = () => startCell(box);
    const board = $('.cell-board', box);
    let sw = null;
    board.addEventListener('pointerdown', (e) => { sw = { x: e.clientX, y: e.clientY }; board.setPointerCapture(e.pointerId); });
    board.addEventListener('pointerup', (e) => {
      if (!sw) return;
      const dx = e.clientX - sw.x, dy = e.clientY - sw.y; sw = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
      move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
    });
    gameKeys = (e) => {
      const d = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' }[e.key];
      if (!d) return false;
      move(d); return true;
    };
    spawn(); spawn(); draw();
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

  function startQuiz(box) {
    const qs = shuffle([...NG.QUIZ]).slice(0, 5);
    let i = 0, score = 0;
    const show = () => {
      if (i >= qs.length) {
        const coins = score * 5;
        addCoins(coins); gainExp(score * 6);
        if (score > me.best.quiz) me.best.quiz = score;
        save();
        box.innerHTML = `<div class="game-intro"><div class="big">${score >= 4 ? '🧠' : score >= 2 ? '🙂' : '🫠'}</div>
          <h3>${score} / ${qs.length} 정답!</h3><p>+${coins}🪙 · 최고 ${me.best.quiz}/5</p>
          <button class="btn primary" id="quiz-again">한 번 더</button></div>`;
        $('#quiz-again').onclick = () => startQuiz(box);
        if (score === 5) NG.net.send({ type: 'sys', slot: me.slot, text: `🧠 ${me.name}님이 해부학 퀴즈 만점!` });
        return;
      }
      const q = qs[i];
      const opts = shuffle(q.a.map((a, k) => ({ a, ok: k === q.c })));
      box.innerHTML = `<div class="quiz"><div class="qn">Q${i + 1}/${qs.length} · 정답 ${score}</div><h3>${esc(q.q)}</h3>
        <div class="opts">${opts.map((o, k) => `<button class="opt" data-k="${k}">${esc(o.a)}</button>`).join('')}</div></div>`;
      $('.opts', box).onclick = (e) => {
        const b = e.target.closest('[data-k]'); if (!b || box.dataset.lock) return;
        box.dataset.lock = 1;
        const ok = opts[+b.dataset.k].ok;
        if (ok) score++;
        $$('.opt', box).forEach((el, k) => el.classList.add(opts[k].ok ? 'right' : k === +b.dataset.k ? 'wrong' : 'dim'));
        setTimeout(() => { delete box.dataset.lock; i++; show(); }, 900);
      };
    };
    show();
  }

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
      const c = NG.CHARS[m.slot];
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
  const LOOK_KEYS = ['hairStyle', 'hair', 'skin', 'top', 'pants', 'coat', 'acc', 'hat', 'hatColor'];
  const baseLook = (slot) => { const b = NG.CHARS[slot], o = {}; LOOK_KEYS.forEach((k) => { o[k] = b[k]; }); return o; };
  function charCards(sel) {
    return NG.CHARS.map((c) => {
      const p = shared.players[c.id];
      const named = p && p.name;
      const l = NG.sanitizeLook(p && p.look, baseLook(c.id));
      return `<button type="button" class="ccard ${sel === c.id ? 'on' : ''}" data-c="${c.id}">
        <span class="cface" style="--hair:${l.hair};--skin:${l.skin};--top:${l.top}"></span><b>${named ? esc(p.name) : `멤버 ${c.id + 1}`}</b>
        <small>${isLive(c.id) ? '🟢 지금 접속 중' : named ? (c.id === me.slot ? '나' : '이 멤버로 입장') : '아직 이름 없음'}</small></button>`;
    }).join('');
  }
  // First entry is just member + name; the full customizer opens from settings (or askIdentity(true)).
  function askIdentity(full = me.slot != null) {
    const firstFree = [0, 1, 2].find((i) => !(shared.players[i] && shared.players[i].name) && !isLive(i));
    let sel = me.slot ?? firstFree ?? 0;
    const seatLook = (i) => NG.sanitizeLook(i === me.slot && me.look ? me.look : shared.players[i] && shared.players[i].look, baseLook(i));
    const seatName = (i) => (i === me.slot && me.name) || (shared.players[i] && shared.players[i].name) || '';
    let look = seatLook(sel);
    const first = me.slot == null;
    const chips = (key, list) => `<div class="cz-row"><span>${{ hairStyle: '머리 모양', hat: '모자', acc: '얼굴' }[key]}</span><div class="cz-opts">${
      list.map(([v, n]) => `<button type="button" class="cz-chip" data-k="${key}" data-v="${v}">${n}</button>`).join('')}</div></div>`;
    const sw = (key, label) => `<div class="cz-row"><span>${label}</span><div class="cz-opts">${
      NG.LOOK[key].map((c) => `<button type="button" class="cz-sw" data-k="${key}" data-v="${c}" style="background:${c}" aria-label="${label} ${c}"></button>`).join('')}</div></div>`;
    const card = !full ? modal(`<h3>👋 누구세요?</h3>
      <p class="sub">볼륨팀 멤버 자리를 고르고 이름만 적으면 바로 입장해요. 한 번 정한 이름은 모두에게 고정되고, 본인만 바꿀 수 있어요.</p>
      <div class="ccards simple">${charCards(sel)}</div>
      <input id="id-name" class="simple-name" maxlength="12" placeholder="이름 (닉네임)" value="${esc(seatName(sel))}" aria-label="이름">
      <button class="btn primary" id="id-ok">입장하기</button>
      <p class="sub center">👕 캐릭터 꾸미기는 나중에 ⚙️ 설정 → <b>이름·꾸미기</b>에서 언제든 할 수 있어요.</p>`, 'identity simple-id') : modal(`<h3>${first ? '👋 누구세요? 멤버를 골라주세요' : '👕 내 캐릭터'}</h3>
      <p class="sub">볼륨팀 멤버 3명 자리예요. 한 번 정한 이름은 모두에게 고정되고, 그 멤버 본인만 여기서 바꿀 수 있어요.</p>
      <div class="cz">
        <div class="cz-left">
          <canvas id="cz-preview" class="cz-preview"></canvas>
          <input id="id-name" maxlength="12" placeholder="닉네임" value="${esc(seatName(sel))}" aria-label="닉네임">
          <button type="button" class="btn" id="cz-random">🎲 랜덤</button>
        </div>
        <div class="cz-right">
          <div class="cz-row"><span>멤버</span><div class="ccards">${charCards(sel)}</div></div>
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
      const c = e.target.closest('[data-c]');
      if (c) {
        sel = +c.dataset.c; look = seatLook(sel);
        $('#id-name').value = seatName(sel);
        $$('.ccard', card).forEach((x) => x.classList.toggle('on', x === c)); sync(); return;
      }
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
      if (isLive(sel) && sel !== me.slot) { toast('🟢 그 멤버는 지금 다른 곳에서 접속 중이에요. 다른 자리를 골라주세요'); return; }
      const name = $('#id-name').value.trim();
      if (!name) { toast('닉네임을 적어주세요'); $('#id-name').focus(); return; }
      const prev = me.slot;
      me.slot = sel; me.name = name.slice(0, 12); me.look = { ...look }; save();
      publishPresence(); renderHud(); closeModal();
      if (prev == null) {
        NG.net.send({ type: 'sys', slot: sel, text: `👋 ${me.name}님이 입장했어요` });
        setTimeout(() => toast('🖱️ 우클릭(폰은 길게 누르기) → 끌어서 행동! · 꾸미기는 ⚙️ 설정에서'), 600);
      } else toast('저장했어요');
      if ($('#w-settings').classList.contains('open')) renderSettings();
    };
    $('#id-ok').onclick = ok;
    $('#id-name').onkeydown = (e) => { if (e.key === 'Enter') ok(); };
    if (first) setTimeout(() => $('#id-name').focus(), 50);
  }
  // ---------- rest spots & jukebox ----------
  const spotCool = {};
  NG.stage.onArrive = (slot, id, manual) => {
    if (slot !== me.slot || !manual) return;
    const s = NG.stage.spots.find((x) => x.id === id);
    if (!s) return;
    const fx = s.fx;
    if (fx.music) { const on = NG.music.toggle(); renderMusic(); toast(on ? '🎷 주크박스 ON — 재즈가 흘러요' : '🎷 주크박스 OFF'); return; }
    const now = Date.now();
    if (now - (spotCool[id] || 0) < 45000) { toast(fx.msg); return; }
    spotCool[id] = now;
    const parts = [];
    if (fx.caffeine) { me.caffeine = Math.min(100, me.caffeine + fx.caffeine); parts.push(`카페인 +${fx.caffeine}`); tickGauges.warned = false; }
    if (fx.focus) { me.focus = Math.min(100, me.focus + fx.focus); parts.push(`정신력 +${fx.focus}`); }
    gainExp(fx.exp || 2); save(); renderHud();
    toast(`${fx.msg}${parts.length ? ' · ' + parts.join(' · ') : ''}`);
  };
  function renderRest() {
    const cur = NG.stage.myTask();
    $('#rest-list').innerHTML = NG.stage.spots.map((s) => {
      const who = NG.stage.chars.filter((c) => c.task && c.task.spot === s.id && c.task.phase === 'do').map((c) => esc(c.name));
      return `<button class="rest ${cur === s.id ? 'on' : ''}" data-spot="${s.id}"><span class="re">${s.e}</span>
        <span class="rn"><b>${esc(s.n)}</b><small>${esc(s.desc)}${who.length ? ' · ' + who.join(', ') + ' 이용 중' : ''}</small></span><em>${cur === s.id ? '이용 중' : '가기'}</em></button>`;
    }).join('');
    renderMusic();
  }
  $('#rest-list').addEventListener('click', (e) => {
    const b = e.target.closest('[data-spot]'); if (!b) return;
    NG.stage.onAction('spot:' + b.dataset.spot);
    if (isNarrow()) closeWin($('#w-rest')); else setTimeout(renderRest, 50);
  });
  function renderMusic() {
    const on = NG.music.playing;
    $('#music-btn').textContent = on ? '⏸ 재즈 끄기' : '▶ 재즈 틀기';
    $('#music-nav').classList.toggle('on', on);
  }
  const toggleMusic = () => { NG.music.toggle(); renderMusic(); };
  $('#music-btn').addEventListener('click', toggleMusic);
  $('#music-nav').addEventListener('click', toggleMusic);
  $('#music-vol').addEventListener('input', (e) => NG.music.setVolume(+e.target.value));

  // ---------- first-run tutorial ----------
  const TUT = [
    { art: 'split', t: '작업하면서 옆에 띄워두세요', d: '브라우저 창을 <b>가로로 좁게</b> 줄여서 작업 화면 옆에 붙여두면 딱이에요. 좁은 창에서도 화면이 알아서 맞춰지고, ⤡ 버튼을 누르면 아지트와 채팅만 남는 미니 모드가 돼요.' },
    { art: '🛋️', t: '캐릭터는 알아서 놀아요', d: '멤버 캐릭터들이 아지트를 돌아다니며 쉬어요. <b>가구를 누르면</b> 내 캐릭터가 거기로 가서 쉬고, <b>우클릭</b>(폰은 길게 누르기)한 뒤 끌어서 놓으면 인사·춤·점프 같은 행동을 해요.' },
    { art: '💬', t: '상태 · 수다 · 포스트잇', d: '"카페인이 필요함", "웃참중" 같은 상태를 머리 위에 띄우고, 투명 채팅창으로 수다 떨고, 📌 게시판에 포스트잇을 붙여요.' },
    { art: '🎰', t: '코인 모아서 가챠', d: '다트와 미니게임으로 코인을 모아 <b>가챠샵</b>에서 밴드·침착맨·아이돌 피규어를 뽑아요. 이제 멤버를 골라볼까요?' },
  ];
  function showTutorial(step = 0) {
    const s = TUT[step];
    const art = s.art === 'split'
      ? `<div class="tut-split"><div class="tw work"><i></i><i></i><i></i><i></i><span>작업 화면</span></div><div class="tw nog"><span>🎯</span><span>아지트</span></div></div>`
      : `<div class="tut-art">${s.art}</div>`;
    const card = modal(`<div class="tut">${art}<h3>${s.t}</h3><p>${s.d}</p>
      <div class="tut-dots">${TUT.map((_, i) => `<i class="${i === step ? 'on' : ''}"></i>`).join('')}</div>
      <div class="row">${step > 0 ? '<button class="btn" id="tut-prev">이전</button>' : '<button class="btn" id="tut-skip">건너뛰기</button>'}
        <button class="btn primary" id="tut-next">${step < TUT.length - 1 ? '다음' : '멤버 고르기'}</button></div></div>`, 'tutorial');
    const done = () => { me.tutorial = true; save(); if (me.slot == null) askIdentity(); else closeModal(); };
    $('#tut-next', card).onclick = () => (step < TUT.length - 1 ? showTutorial(step + 1) : done());
    const prev = $('#tut-prev', card); if (prev) prev.onclick = () => showTutorial(step - 1);
    const skip = $('#tut-skip', card); if (skip) skip.onclick = done;
  }
  $('#set-tutorial').addEventListener('click', () => showTutorial(0));

  NG.stage.onAction = (a) => {
    if (me.slot == null) { askIdentity(); return; }
    if (a === 'dart') { NG.stage.startDart(); return; }
    if (a === 'sip') { drinkCoffee(); return; }
    NG.stage.act(me.slot, a);
    NG.net.send({ type: 'act', slot: me.slot, a });
  };
  function renderSettings() {
    $('#set-who').innerHTML = me.slot != null ? `${esc(me.name)} · ${me.slot + 1}번 자리` : '미선택';
    $('#set-team').value = NG.net.team;
    $('#set-net').textContent = NG.net.mode === 'p2p'
      ? (NG.net.peers > 0 ? `🟢 P2P · 지금 팀원 ${NG.net.peers}명과 연결 (채팅·상태·게시판 실시간 공유)` : '🟡 P2P · 아직 혼자예요. 같은 팀 코드로 들어온 팀원과 자동 연결돼요')
      : NG.net.mode === 'claude' ? '🟢 claude.ai 공유 (링크를 연 팀원끼리 채팅·상태·게시판 공유)'
      : NG.net.online ? '🟢 팀 서버 연결 (채팅·상태·게시판 공유)' : '🟡 로컬 모드 (같은 브라우저 탭끼리만 공유)';
    $('#set-popup').hidden = NG.net.mode === 'claude';
  }
  $('#set-change').addEventListener('click', () => askIdentity(true));
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
    const keep = { slot: me.slot, name: me.name, look: me.look };
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
    else if (m.type === 'act') { if (m.slot !== me.slot && m.a !== 'dart') NG.stage.act(m.slot, m.a); }
    else if (m.type === 'pos') { if (m.slot !== me.slot) { NG.stage.applyRemote(m.slot, m); liveAt[m.slot] = Date.now(); } }
    else if (m.type === 'note') {
      const i = shared.notes.findIndex((o) => o.id === m.id);
      if (i >= 0) shared.notes[i] = m; else { shared.notes.push(m); if (m.slot !== me.slot && Date.now() - bootAt > 4000) toast(`📌 ${m.name}님이 포스트잇을 붙였어요`); }
      renderBoard(); bumpBoard();
    } else if (m.type === 'noteDel') { shared.notes = shared.notes.filter((o) => o.id !== m.id); renderBoard(); }
  }
  // Stream my character (position, rest spot, pose, animation) so everyone sees the same thing; ~5×/s on change, 1×/s idle.
  const liveAt = {};
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
  const isLive = (slot) => slot !== me.slot && Date.now() - (liveAt[slot] || 0) < 5000;

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
      if (p && p.name) NG.stage.setPlayer(+k, p.name, p.status, p.look || null);
    }
    shared.notes = st.notes || [];
    (st.chat || []).slice(-60).forEach(addChat);
    NG.net.on(handle);
    tickGauges(); setInterval(tickGauges, 30000);
    renderHud(); bumpBoard();
    if (!me.tutorial && me.slot == null) showTutorial(); else if (me.slot == null) askIdentity(); else publishPresence();
  }
  boot();
})();
