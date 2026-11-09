// Звук: синтезовані ефекти (WebAudio) + фонова музика (src/audio/music.mp3).
window.SFX = (function () {
  let ctx = null, muted = false;
  const music = new Audio('audio/music.mp3');
  music.loop = true; music.volume = 0.22;

  function ac() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function tone(freq, dur, type = 'sine', vol = 0.15, when = 0, slideTo = null) {
    if (muted) return;
    const c = ac(), t = c.currentTime + when;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol = 0.08, when = 0, hp = 1000) {
    if (muted) return;
    const c = ac(), t = c.currentTime + when;
    const b = c.createBuffer(1, c.sampleRate * dur, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    f.type = 'highpass'; f.frequency.value = hp; g.gain.value = vol;
    s.buffer = b; s.connect(f).connect(g).connect(c.destination); s.start(t);
  }

  const fx = {
    step: () => noise(0.035, 0.025, 0, 1800),
    click: () => tone(900, 0.05, 'square', 0.05),
    tool: () => { tone(500, 0.08, 'sawtooth', 0.06, 0, 1200); noise(0.12, 0.03, 0, 3000); },
    ping: () => { tone(1320, 0.12, 'sine', 0.18); tone(1760, 0.2, 'sine', 0.14, 0.07); },
    buzz: () => { tone(140, 0.28, 'sawtooth', 0.16); tone(110, 0.28, 'square', 0.08); },
    msg: () => { tone(880, 0.06, 'sine', 0.12); tone(1175, 0.08, 'sine', 0.1, 0.06); },
    type: () => noise(0.03, 0.04, 0, 4000),
    send: () => tone(600, 0.12, 'triangle', 0.12, 0, 1400),
    hit: () => { noise(0.18, 0.15, 0, 400); tone(220, 0.2, 'square', 0.1, 0, 80); },
    win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, 'triangle', 0.16, i * 0.09)),
    key: () => { [392, 523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.5, 'sine', 0.13, i * 0.08)); noise(0.5, 0.04, 0.4, 6000); },
    alarm: () => { for (let i = 0; i < 3; i++) tone(880, 0.15, 'square', 0.08, i * 0.25, 660); },
    tick: () => tone(1500, 0.03, 'square', 0.05),
    whoosh: () => noise(0.35, 0.08, 0, 800),
    fail: () => [392, 330, 262, 196].forEach((f, i) => tone(f, 0.3, 'sawtooth', 0.1, i * 0.15)),
  };

  return {
    play(name) { try { fx[name] && fx[name](); } catch (e) {} },
    startMusic() { if (!muted) music.play().catch(() => {}); },
    toggle() { muted = !muted; muted ? music.pause() : music.play().catch(() => {}); return muted; },
    get muted() { return muted; },
  };
})();
