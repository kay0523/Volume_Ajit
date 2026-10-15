// Jukebox: a tiny synthesized lo-fi jazz loop (ii–V–I–VI), swung brushes and a bit of vinyl hiss. Local to each viewer.
(function () {
  const BPM = 76, BEAT = 60 / BPM;
  const CHORDS = [[50, 53, 57, 60, 64], [43, 53, 57, 59, 64], [48, 52, 55, 59, 62], [45, 55, 58, 61, 65]]; // Dm9 G13 Cmaj9 A7b9
  const BASS = [[38, 41, 45, 48], [43, 47, 50, 49], [36, 40, 43, 45], [45, 44, 43, 40]];
  const mtof = (m) => 440 * 2 ** ((m - 69) / 12);
  let ac = null, out = null, noise = null, hiss = null, timer = null, step = 0, nextT = 0, vol = 0.5;

  function setup() {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    out = ac.createGain(); out.gain.value = vol * 0.6;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3800; // old radio warmth
    out.connect(lp); lp.connect(ac.destination);
    noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  function epiano(t, m, dur, vel) {
    for (const [mul, g0] of [[1, 1], [2, 0.18]]) {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'sine'; o.frequency.value = mtof(m) * mul; o.detune.value = (Math.random() - 0.5) * 8;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel * g0, t + 0.012);
      g.gain.exponentialRampToValueAtTime(vel * g0 * 0.35, t + 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05);
    }
  }
  function bass(t, m) {
    const o = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter();
    o.type = 'triangle'; o.frequency.value = mtof(m); f.type = 'lowpass'; f.frequency.value = 500;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.32, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + BEAT * 0.95);
    o.connect(f); f.connect(g); g.connect(out); o.start(t); o.stop(t + BEAT);
  }
  function brush(t, v) {
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noise; f.type = 'highpass'; f.frequency.value = 5000;
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    s.connect(f); f.connect(g); g.connect(out); s.start(t, Math.random() * 0.5, 0.15);
  }
  function startHiss() {
    hiss = ac.createBufferSource(); hiss.buffer = noise; hiss.loop = true;
    const f = ac.createBiquadFilter(), g = ac.createGain();
    f.type = 'bandpass'; f.frequency.value = 2500; g.gain.value = 0.012;
    hiss.connect(f); f.connect(g); g.connect(out); hiss.start();
  }
  function schedule() {
    while (nextT < ac.currentTime + 0.25) {
      const beat = step % 4, bar = Math.floor(step / 4) % 4;
      const ch = CHORDS[bar];
      if (beat === 0) ch.forEach((m, i) => epiano(nextT + i * 0.012, m + 12, BEAT * 1.8, 0.05));
      if (beat === 2) ch.slice(1).forEach((m, i) => epiano(nextT + BEAT * 0.66 + i * 0.01, m + 12, BEAT * 1.2, 0.035));
      if (beat === 3 && bar === 3) epiano(nextT + BEAT * 0.33, 76, BEAT * 0.8, 0.03);
      bass(nextT, BASS[bar][beat]);
      brush(nextT, beat % 2 ? 0.09 : 0.05);
      brush(nextT + BEAT * 0.66, 0.035);
      nextT += BEAT; step++;
    }
  }

  NG.music = {
    playing: false,
    get volume() { return vol; },
    setVolume(v) { vol = v; if (out) out.gain.value = v * 0.6; },
    start() {
      try {
        if (!ac) setup();
        ac.resume();
        if (this.playing) return;
        this.playing = true; step = 0; nextT = ac.currentTime + 0.1;
        startHiss();
        timer = setInterval(schedule, 60); schedule();
      } catch { this.playing = false; }
    },
    stop() {
      this.playing = false;
      clearInterval(timer); timer = null;
      if (hiss) { try { hiss.stop(); } catch { /* already stopped */ } hiss = null; }
    },
    toggle() { if (this.playing) this.stop(); else this.start(); return this.playing; },
  };
})();
