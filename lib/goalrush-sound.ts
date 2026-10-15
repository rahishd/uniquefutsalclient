// Sound effects for Unique Goal Rush, made with the Web Audio API (no sound files to download).
// The audio context starts on the first tap (browsers only allow sound after a user gesture).

type Ctx = AudioContext;
let ctx: Ctx | null = null;

function ac(): Ctx | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    try { ctx = new C(); } catch { return null; }
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function noise(c: Ctx, seconds: number) {
  const buf = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * seconds)), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  return src;
}

function envGain(c: Ctx, at: number, peak: number, attack: number, decay: number) {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(peak, at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
  return g;
}

function tone(c: Ctx, freq: number, at: number, dur: number, type: OscillatorType, peak: number, slideTo?: number) {
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, at);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, at + dur);
  const g = envGain(c, at, peak, 0.01, dur);
  o.connect(g).connect(c.destination);
  o.start(at);
  o.stop(at + dur + 0.05);
}

function crowd(c: Ctx, at: number, dur: number, peak: number, from: number, to: number) {
  const n = noise(c, dur);
  const f = c.createBiquadFilter();
  f.type = "bandpass";
  f.Q.value = 0.8;
  f.frequency.setValueAtTime(from, at);
  f.frequency.linearRampToValueAtTime(to, at + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(peak, at + dur * 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  n.connect(f).connect(g).connect(c.destination);
  n.start(at);
  n.stop(at + dur);
}

export const sfx = {
  /** wake the audio up on the first tap */
  unlock() { ac(); },
  kick() {
    const c = ac(); if (!c) return;
    const t = c.currentTime;
    tone(c, 140, t, 0.14, "sine", 0.6, 45);
    const n = noise(c, 0.06);
    const f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 1800;
    n.connect(f).connect(envGain(c, t, 0.35, 0.003, 0.06)).connect(c.destination);
    n.start(t); n.stop(t + 0.08);
  },
  goal() {
    const c = ac(); if (!c) return;
    const t = c.currentTime;
    crowd(c, t, 1.8, 0.5, 500, 1400);
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(c, f, t + 0.05 + i * 0.09, 0.22, "triangle", 0.18));
  },
  save() {
    const c = ac(); if (!c) return;
    const t = c.currentTime;
    const n = noise(c, 0.08);
    const f = c.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 700;
    n.connect(f).connect(envGain(c, t, 0.5, 0.004, 0.08)).connect(c.destination);
    n.start(t); n.stop(t + 0.1);
    crowd(c, t + 0.05, 0.9, 0.22, 700, 350);
  },
  post() {
    const c = ac(); if (!c) return;
    const t = c.currentTime;
    tone(c, 1250, t, 0.7, "sine", 0.25);
    tone(c, 1870, t, 0.5, "sine", 0.12);
    crowd(c, t + 0.1, 0.8, 0.18, 600, 300);
  },
  miss() {
    const c = ac(); if (!c) return;
    crowd(c, c.currentTime, 0.9, 0.22, 800, 300);
  },
  whistle() {
    const c = ac(); if (!c) return;
    const t = c.currentTime;
    const o = c.createOscillator(); o.type = "sine"; o.frequency.value = 2900;
    const lfo = c.createOscillator(); lfo.frequency.value = 28;
    const lg = c.createGain(); lg.gain.value = 120;
    lfo.connect(lg).connect(o.frequency);
    const g = envGain(c, t, 0.16, 0.01, 0.35);
    o.connect(g).connect(c.destination);
    o.start(t); lfo.start(t); o.stop(t + 0.4); lfo.stop(t + 0.4);
  },
};
