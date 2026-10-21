// Shared state, in order of preference: claude.ai Artifact db, the Node server (SSE), P2P WebRTC (no accounts),
// or same-browser tabs via BroadcastChannel.
(function () {
  const listeners = [];
  const emit = (m) => listeners.forEach((fn) => fn(m));
  const LOCAL_KEY = 'nogari.localState.v1';
  let bc = null;

  const EMPTY = () => ({ players: {}, chat: [], notes: [], del: {}, music: null });
  function localState() {
    try { return { ...EMPTY(), ...JSON.parse(localStorage.getItem(LOCAL_KEY)) }; } catch { return EMPTY(); }
  }
  // Clamp anything that arrives from another peer to the shapes the app expects.
  const str = (v, n) => String(v ?? '').slice(0, n);
  // `slot` carries the sender's person id (a short random string), not a fixed seat.
  const slotOf = (v) => (typeof v === 'string' && /^[a-z0-9]{4,24}$/i.test(v) ? v : '');
  function sanitize(m) {
    if (!m || typeof m !== 'object') return null;
    const slot = slotOf(m.slot), t = Number(m.t) || Date.now();
    switch (m.type) {
      case 'chat': case 'sys': {
        const text = str(m.text, 300).trim();
        return text ? { type: m.type, id: str(m.id, 40), t, slot, name: str(m.name, 20), text } : null;
      }
      case 'note': {
        const text = str(m.text, 500).trim();
        if (!text || !m.id) return null;
        return { type: 'note', id: str(m.id, 40), t, slot, name: str(m.name, 20), text,
          color: /^#[0-9a-f]{6}$/i.test(m.color) ? m.color : '#fff27a',
          x: Math.max(0, Math.min(1, Number(m.x) || 0)), y: Math.max(0, Math.min(1, Number(m.y) || 0)), rot: Math.max(-8, Math.min(8, Number(m.rot) || 0)) };
      }
      case 'noteDel': return m.id ? { type: 'noteDel', id: str(m.id, 40), t } : null;
      case 'presence': {
        if (!slot) return null;
        const st = m.status && typeof m.status === 'object' ? { e: str(m.status.e, 8), t: str(m.status.t, 24) } : null;
        const look = m.look && typeof m.look === 'object' ? m.look : null;
        return { type: 'presence', slot, name: str(m.name, 20), status: st, look, t };
      }
      case 'emote': return slot ? { type: 'emote', slot, e: str(m.e, 8) } : null;
      case 'act': return slot ? { type: 'act', slot, a: str(m.a, 16) } : null;
      case 'music': return { type: 'music', slot, name: str(m.name, 20), vid: /^[\w-]{11}$/.test(m.vid || '') ? m.vid : '', startedAt: Number(m.startedAt) || t, t };
      case 'pos': {
        if (!slot) return null;
        const num = (v, lo, hi) => Math.max(lo, Math.min(hi, Number(v) || 0));
        return { type: 'pos', slot, fx: num(m.fx, 0, 1), h: num(m.h, -50, 400), dir: m.dir < 0 ? -1 : 1,
          pose: m.pose ? str(m.pose, 12) : null, spot: m.spot ? str(m.spot, 16) : null, seat: Math.round(num(m.seat, 0, 5)),
          anim: m.anim ? str(m.anim, 12) : null, animT: num(m.animT, 0, 6), walk: !!m.walk, air: !!m.air, climb: !!m.climb, sit: !!m.sit };
      }
    }
    return null;
  }
  // Apply one change to the stored state. Returns false if it was already known (or older).
  function localApply(m) {
    const s = localState();
    let changed = false;
    if (m.type === 'chat' || m.type === 'sys') {
      if (!s.chat.some((c) => c.id === m.id)) {
        s.chat.push(m); s.chat.sort((a, b) => a.t - b.t); s.chat = s.chat.slice(-120); changed = true;
      }
    } else if (m.type === 'note') {
      const old = s.notes.find((o) => o.id === m.id);
      if (!s.del[m.id] && (!old || (old.t || 0) < m.t)) { s.notes = s.notes.filter((o) => o.id !== m.id).concat([m]).slice(-80); changed = true; }
    } else if (m.type === 'noteDel') {
      if (!s.del[m.id]) { s.del[m.id] = m.t || Date.now(); s.notes = s.notes.filter((o) => o.id !== m.id); changed = true; }
      const ids = Object.keys(s.del); if (ids.length > 300) ids.slice(0, ids.length - 300).forEach((k) => delete s.del[k]);
    } else if (m.type === 'music') {
      if (!s.music || (s.music.t || 0) < m.t) { s.music = m; changed = true; }
    } else if (m.type === 'presence') {
      const old = s.players[m.slot];
      if (!old || (old.t || 0) < m.t) { s.players[m.slot] = { name: m.name, status: m.status, look: m.look, t: m.t }; changed = true; }
    }
    if (changed) try { localStorage.setItem(LOCAL_KEY, JSON.stringify(s)); } catch { /* storage full or blocked */ }
    return changed;
  }

  // What this page has already shown, so changes are emitted once per page even when tabs share storage.
  let known = null;
  function remember(st) {
    known = { chat: new Set(st.chat.map((c) => c.id)), notes: {}, del: { ...st.del }, players: {}, music: (st.music && st.music.t) || 0 };
    st.notes.forEach((n) => { known.notes[n.id] = n.t || 0; });
    Object.entries(st.players).forEach(([k, p]) => { known.players[k] = (p && p.t) || 0; });
    return st;
  }
  function fresh(m) {
    if (m.type === 'emote' || m.type === 'act' || m.type === 'pos') return true;
    if (!known) return true;
    if (m.type === 'chat' || m.type === 'sys') { if (known.chat.has(m.id)) return false; known.chat.add(m.id); return true; }
    if (m.type === 'note') { if (known.del[m.id] || (known.notes[m.id] || 0) >= m.t) return false; known.notes[m.id] = m.t; return true; }
    if (m.type === 'noteDel') { if (known.del[m.id]) return false; known.del[m.id] = m.t; return true; }
    if (m.type === 'presence') { if ((known.players[m.slot] || 0) >= m.t) return false; known.players[m.slot] = m.t; return true; }
    if (m.type === 'music') { if (known.music >= m.t) return false; known.music = m.t; return true; }
    return false;
  }
  const accept = (m) => { if (m.type !== 'emote' && m.type !== 'act' && m.type !== 'pos') localApply(m); if (fresh(m)) emit(m); };

  // ---------- P2P (no accounts): WebRTC between open pages, signalled over public Nostr relays (Trystero) ----------
  let p2p = null;
  const seenIds = new Set();
  const relaySeen = (id) => { if (seenIds.has(id)) return true; seenIds.add(id); if (seenIds.size > 4000) seenIds.delete(seenIds.values().next().value); return false; };
  const TEAM_KEY = 'nogari.team.v1';
  const teamCode = () => { try { return localStorage.getItem(TEAM_KEY) || 'volume'; } catch { return 'volume'; } };
  function startP2P() {
    if (!window.Trystero || !window.RTCPeerConnection) return false;
    const team = teamCode();
    // Signalling goes through 10 public relays (not the default 5) so one or two being down doesn't strand anyone.
    const room = window.Trystero.joinRoom({ appId: 'volume-ajit-v1', password: 'ajit:' + team, relayConfig: { redundancy: 10 } }, 'ajit-' + team);
    const msg = room.makeAction('msg'), sync = room.makeAction('sync');
    const take = (raw) => {
      const m = sanitize(raw); if (!m) return;
      accept(m);
    };
    // Gossip: every message carries an id and is passed on once by whoever gets it, so two people whose
    // networks can't connect directly (no TURN server) still see each other through anyone in between.
    msg.onMessage = (data, meta) => {
      const from = meta && meta.peerId;
      if (!data || typeof data !== 'object') return;
      if (!data.mid || !data.m) { take(data); return; } // an older version sending bare messages
      if (relaySeen(data.mid)) return;
      take(data.m);
      if (data.ttl > 0) {
        const others = Object.keys(room.getPeers()).filter((id) => id !== from);
        if (others.length) msg.send({ ...data, ttl: data.ttl - 1 }, { target: others }).catch(() => {});
      }
    };
    sync.onMessage = (st) => {
      if (!st || typeof st !== 'object') return;
      if (st.music) take({ ...st.music, type: 'music' });
      (Array.isArray(st.notes) ? st.notes : []).slice(-80).forEach((n) => take({ ...n, type: 'note' }));
      Object.entries(st.del || {}).slice(-300).forEach(([id, t]) => take({ type: 'noteDel', id, t }));
      Object.entries(st.players || {}).forEach(([slot, p]) => take({ ...p, type: 'presence', slot }));
    };
    const peers = () => Object.keys(room.getPeers()).length;
    const changed = () => { NG.ui && NG.ui.setNet(true, peers()); };
    room.onPeerJoin = (id) => { sync.send({ ...localState(), chat: [] }, { target: id }).catch(() => {}); changed(); };
    room.onPeerLeave = () => changed();
    p2p = { room, msg, peers, joinedAt: Date.now() };
    setTimeout(changed, 0);
    return true;
  }
  function rejoinP2P() {
    if (!p2p) return;
    try { p2p.room.leave(); } catch { /* already gone */ }
    p2p = null;
    startP2P();
  }
  // Watchdog: while nobody is connected, rejoin every 30 s (every 2 min after the first 5 minutes alone),
  // which re-announces us on the relays and clears half-open connections left over from a reload.
  let aloneSince = Date.now();
  setInterval(() => {
    if (!p2p) return;
    if (p2p.peers() > 0) { aloneSince = Date.now(); return; }
    const alone = Date.now() - aloneSince, sinceJoin = Date.now() - p2p.joinedAt;
    if (sinceJoin > (alone < 300000 ? 30000 : 120000)) rejoinP2P();
  }, 5000);
  // Leave cleanly so the others drop our old connection at once and re-pair quickly when we come back.
  window.addEventListener('pagehide', () => { try { if (p2p) p2p.room.leave(); } catch { /* closing */ } });

  // claude.ai Artifact backend: shared db collections (chat / notes / players) + room for emotes.
  let db = null, room = null, ready = false;
  const queue = [];
  const out = (m) => { if (ready) emit(m); else queue.push(m); };
  const clean = (o) => JSON.parse(JSON.stringify(o));

  async function startClaude() {
    db = await window.claude.use('db');
    if (!db) return false;
    window.claude.use('room').then((r) => {
      room = r;
      if (!room) return;
      room.on('emote', (d) => { const m = sanitize({ ...(d || {}), type: 'emote' }); if (m) out(m); });
      room.on('act', (d) => { const m = sanitize({ ...(d || {}), type: 'act' }); if (m) out(m); });
      room.on('pos', (d) => { const m = sanitize({ ...(d || {}), type: 'pos' }); if (m) out(m); });
    }).catch(() => {});
    const err = () => NG.ui && NG.ui.setNet(false);
    const seen = new Set();
    let firstChat = true;
    db.collection('chat').orderBy('t', 'desc').limit(60).onSnapshot((snap) => {
      if (firstChat) { firstChat = false; snap.docs.forEach((d) => { const m = d.data(); if (m) seen.add(m.id); }); NG.ui && NG.ui.setNet(true); return; }
      const added = snap.docChanges().filter((c) => c.type === 'added').map((c) => c.doc.data())
        .filter((m) => m && !seen.has(m.id)).sort((a, b) => a.t - b.t);
      added.forEach((m) => { seen.add(m.id); out(m); });
      NG.ui && NG.ui.setNet(true);
    }, err);
    db.collection('notes').onSnapshot((snap) => {
      for (const c of snap.docChanges()) {
        const n = c.doc.data();
        if (c.type === 'removed') out({ type: 'noteDel', id: c.doc.id });
        else if (n) out({ ...n, type: 'note', id: c.doc.id });
      }
    }, err);
    db.collection('music').onSnapshot((snap) => {
      for (const c of snap.docChanges()) { const d = c.doc.data(); if (c.type !== 'removed' && d) out({ ...d, type: 'music' }); }
    }, err);
    db.collection('players').onSnapshot((snap) => {
      for (const c of snap.docChanges()) {
        const p = c.doc.data();
        if (c.type !== 'removed' && p && typeof p.slot === 'string') out({ ...p, type: 'presence' });
      }
    }, err);
    return true;
  }

  // Keep the shared chat bounded: drop messages older than 14 days.
  async function pruneChat() {
    try {
      const old = await db.collection('chat').where('t', '<', Date.now() - 14 * 864e5).limit(50).get();
      for (const d of old.docs) await db.collection('chat').doc(d.id).delete();
    } catch { /* not allowed or offline */ }
  }

  NG.net = {
    online: false,
    mode: 'local',
    on(fn) { listeners.push(fn); if (!ready) { ready = true; queue.splice(0).forEach(emit); } },

    async start() {
      if (window.claude && typeof window.claude.use === 'function') {
        try {
          if (await startClaude()) {
            this.online = true; this.mode = 'claude';
            setTimeout(pruneChat, 8000);
            return { players: {}, chat: [], notes: [] };
          }
        } catch { /* fall through */ }
      }
      ready = true;
      if (location.protocol.startsWith('http') && !/github\.io$|pages\.dev$|netlify\.app$/.test(location.hostname)) {
        try {
          const r = await fetch('api/state', { cache: 'no-store' });
          if (r.ok) {
            const st = await r.json();
            this.online = true; this.mode = 'server';
            const es = new EventSource('api/events');
            es.onmessage = (ev) => { try { emit(JSON.parse(ev.data)); } catch { /* ignore */ } };
            es.onerror = () => NG.ui && NG.ui.setNet(false);
            es.onopen = () => NG.ui && NG.ui.setNet(true);
            return st;
          }
        } catch { /* fall through to local */ }
      }
      try { if (startP2P()) { this.online = true; this.mode = 'p2p'; return remember(localState()); } } catch { /* WebRTC unavailable */ }
      if ('BroadcastChannel' in window) {
        bc = new BroadcastChannel('nogari');
        bc.onmessage = (ev) => { const m = sanitize(ev.data); if (m) accept(m); };
      }
      return remember(localState());
    },
    get peers() { return p2p ? p2p.peers() : 0; },
    reconnect() { if (this.mode === 'p2p') rejoinP2P(); },
    get team() { return teamCode(); },
    setTeam(code) { try { localStorage.setItem(TEAM_KEY, String(code).trim().slice(0, 32) || 'volume'); } catch { /* blocked */ } },

    send(m) {
      if (m.type === 'chat' || m.type === 'sys') { m.id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; m.t = Date.now(); }
      if (m.type === 'note' || m.type === 'presence' || m.type === 'noteDel' || m.type === 'music') m.t = Date.now();
      if (this.mode === 'p2p') {
        const c = sanitize(m); if (!c) return;
        accept(c);
        const mid = Math.random().toString(36).slice(2, 12);
        relaySeen(mid);
        p2p.msg.send({ mid, ttl: 3, m: c }).catch(() => {});
        return;
      }
      if (this.mode === 'claude') {
        const fail = (e) => NG.ui && NG.ui.toast(e && e.code === 'quota_exceeded'
          ? '저장 공간이 가득 찼어요. 오래된 포스트잇을 떼주세요.'
          : '저장하지 못했어요. 이 링크에 쓰기 권한이 있는지 확인해주세요.');
        if (m.type === 'chat' || m.type === 'sys') db.collection('chat').doc(m.id).set(clean(m)).catch(fail);
        else if (m.type === 'note') { const { type, ...n } = m; db.collection('notes').doc(m.id).set(clean({ ...n, t: n.t || Date.now() })).catch(fail); void type; }
        else if (m.type === 'noteDel') db.collection('notes').doc(m.id).delete().catch(fail);
        else if (m.type === 'music') { const c = sanitize(m); if (c) db.collection('music').doc('now').set(clean(c)).catch(fail); }
        else if (m.type === 'presence') db.collection('players').doc('p' + m.slot).set(clean({ slot: m.slot, name: m.name || '', status: m.status || null, look: m.look || null, t: Date.now() })).catch(fail);
        else if (m.type === 'emote' || m.type === 'act' || m.type === 'pos') {
          if (m.type !== 'pos') emit(m);
          const { type, ...payload } = m; void type;
          if (room) { try { Promise.resolve(room.emit(m.type, payload)).catch(() => {}); } catch { /* not allowed */ } }
        }
        return;
      }
      if (this.online) {
        fetch('api/send', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(m) })
          .catch(() => {});
        return;
      }
      const c = sanitize(m); if (!c) return;
      accept(c);
      if (bc) bc.postMessage(c);
    },
  };
})();
