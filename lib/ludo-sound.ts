// Sound for Unique Ludo, made with the Web Audio API (no sound files). Nothing plays by itself: the audio context starts
// on the player's first tap, effects can be muted, and the music is OFF until the player switches it on.

type Ctx = AudioContext;
let ctx: Ctx | null = null;
let sfxOn = true;
let music: { stop: () => void } | null = null;

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

function env(c: Ctx, at: number, peak: number, attack: number, decay: number) {
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
  o.connect(env(c, at, peak, 0.008, dur)).connect(c.destination);
  o.start(at);
  o.stop(at + dur + 0.05);
}
function click(c: Ctx, at: number, peak: number, freq: number) {
  const len = Math.floor(c.sampleRate * 0.03);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = c.createBufferSource();
  s.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = freq;
  s.connect(f).connect(env(c, at, peak, 0.002, 0.04)).connect(c.destination);
  s.start(at);
}

export const ludoSound = {
  unlock() { ac(); },
  setSfx(on: boolean) { sfxOn = on; },
  button() {
    if (!sfxOn) return;
    const c = ac(); if (!c) return;
    tone(c, 620, c.currentTime, 0.06, "triangle", 0.1, 480);
  },
  dice() {
    if (!sfxOn) return;
    const c = ac(); if (!c) return;
    const t = c.currentTime;
    for (let i = 0; i < 9; i++) click(c, t + i * 0.055 + (i % 2) * 0.01, 0.3 - i * 0.02, 1400 + (i % 3) * 500);
    tone(c, 180, t + 0.5, 0.08, "sine", 0.18, 90);
  },
  step() {
    if (!sfxOn) return;
    const c = ac(); if (!c) return;
    tone(c, 330, c.currentTime, 0.07, "triangle", 0.12, 260);
  },
  release() {
    if (!sfxOn) return;
    const c = ac(); if (!c) return;
    const t = c.currentTime;
    tone(c, 440, t, 0.1, "triangle", 0.16);
    tone(c, 660, t + 0.08, 0.14, "triangle", 0.16);
  },
  capture() {
    if (!sfxOn) return;
    const c = ac(); if (!c) return;
    const t = c.currentTime;
    tone(c, 520, t, 0.28, "sawtooth", 0.14, 120);
    click(c, t, 0.4, 900);
  },
  home() {
    if (!sfxOn) return;
    const c = ac(); if (!c) return;
    const t = c.currentTime;
    [523.25, 659.25, 783.99].forEach((f, i) => tone(c, f, t + i * 0.08, 0.2, "triangle", 0.16));
  },
  turn() {
    if (!sfxOn) return;
    const c = ac(); if (!c) return;
    const t = c.currentTime;
    tone(c, 740, t, 0.09, "sine", 0.1);
    tone(c, 988, t + 0.09, 0.12, "sine", 0.1);
  },
  win() {
    if (!sfxOn) return;
    const c = ac(); if (!c) return;
    const t = c.currentTime;
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone(c, f, t + i * 0.12, 0.34, "triangle", 0.18));
    tone(c, 392, t, 0.9, "sine", 0.1);
  },
  lose() {
    if (!sfxOn) return;
    const c = ac(); if (!c) return;
    const t = c.currentTime;
    [392, 349.23, 311.13].forEach((f, i) => tone(c, f, t + i * 0.16, 0.3, "triangle", 0.12));
  },
  /** a soft looping chord pattern; only ever started by the player pressing the music switch */
  startMusic() {
    if (music) return;
    const c = ac(); if (!c) return;
    const notes = [261.63, 329.63, 392, 329.63, 293.66, 349.23, 440, 349.23];
    let i = 0;
    const master = c.createGain();
    master.gain.value = 0.35;
    master.connect(c.destination);
    const play = () => {
      const t = c.currentTime;
      const o = c.createOscillator();
      o.type = "sine";
      o.frequency.value = notes[i % notes.length] / 2;
      const g = env(c, t, 0.06, 0.15, 0.9);
      o.connect(g).connect(master);
      o.start(t);
      o.stop(t + 1.2);
      i++;
    };
    play();
    const timer = setInterval(play, 700);
    music = { stop: () => { clearInterval(timer); master.disconnect(); } };
  },
  stopMusic() {
    music?.stop();
    music = null;
  },
};
