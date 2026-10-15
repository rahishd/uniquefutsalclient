"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { AIM_X, AIM_Y, ZONE_CENTER, type Outcome, type ShotInput, type ShotResult } from "@/lib/goalrush-sim";
import { sfx } from "@/lib/goalrush-sound";

// The penalty-shootout scene, drawn on a canvas. The player aims (mouse, finger or arrow keys) and times the power bar;
// the result of every kick comes from `onShoot` (the server for a points game, the practice engine otherwise) and is then
// played back: run-up, kick, flight, the goalkeeper's dive, the net or the save, and a banner.

const W = 360;
const H = 480;
const GOAL = { cx: 180, halfW: 110, ground: 282, height: 105 };
const gx = (x: number) => GOAL.cx + x * GOAL.halfW;
const gy = (y: number) => GOAL.ground - y * GOAL.height;
const SPOT = { x: 180, y: 402 };
const POWER_PERIOD = 1500; // ms for the power bar to go up and down

const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));
// a rounded rectangle path (older browsers have no ctx.roundRect)
function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}
const ease = (t: number) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export interface PenaltyGameHandle {
  shoot: () => void;
}

interface Props {
  enabled: boolean; // a shot may be taken now
  muted: boolean;
  onShoot: (input: ShotInput) => Promise<ShotResult>;
  onResolved: (result: ShotResult) => void; // after the result has been played back
  onError: (message: string) => void;
  caption: string; // read by screen readers, e.g. "Shot 2 of 5"
}

type Phase = "aim" | "runup" | "flight" | "after";

interface Anim {
  phase: Phase;
  t0: number;
  input: ShotInput | null;
  result: ShotResult | null;
  error: string | null;
  done: boolean;
}

const BANNER: Record<Outcome, { text: string; color: string }> = {
  goal: { text: "GOAL!", color: "#22c55e" },
  save: { text: "SAVED!", color: "#f59e0b" },
  wide: { text: "WIDE!", color: "#f8fafc" },
  over: { text: "OVER THE BAR!", color: "#f8fafc" },
  post: { text: "OFF THE POST!", color: "#f87171" },
};

// a fixed crowd, so it does not flicker between frames
function makeCrowd() {
  let s = 42;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const colors = ["#e2e8f0", "#facc15", "#ef4444", "#3b82f6", "#22c55e", "#f97316", "#a855f7", "#f472b6", "#94a3b8"];
  return Array.from({ length: 420 }, () => ({ x: rnd() * W, y: 64 + rnd() * 84, c: colors[Math.floor(rnd() * colors.length)], p: rnd() * Math.PI * 2 }));
}

/** where the ball ends its flight on the screen, for each kind of result */
function flightEnd(r: ShotResult) {
  const sx = Math.sign(r.ballX) || 1;
  if (r.outcome === "post") {
    if (r.ballY > 1) return { x: gx(clamp(r.ballX, -0.95, 0.95)), y: gy(1.03) };
    return { x: gx(sx * 1.03), y: gy(clamp(r.ballY, 0.08, 0.95)) };
  }
  if (r.outcome === "over") return { x: gx(clamp(r.ballX, -1.3, 1.3)), y: gy(clamp(r.ballY, 1.12, 1.35)) };
  if (r.outcome === "wide") return { x: gx(sx * clamp(Math.abs(r.ballX), 1.12, 1.4)), y: gy(clamp(r.ballY, 0.05, 1)) };
  return { x: gx(clamp(r.ballX, -0.95, 0.95)), y: gy(clamp(r.ballY, 0.06, 0.94)) };
}

const PenaltyGame = forwardRef<PenaltyGameHandle, Props>(function PenaltyGame(props, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const propsRef = useRef(props);
  const aim = useRef({ x: 0.55, y: 0.6 });
  const powerT0 = useRef(0);
  const anim = useRef<Anim>({ phase: "aim", t0: 0, input: null, result: null, error: null, done: false });
  const crowd = useRef(makeCrowd());
  const reduced = useRef(false);

  useEffect(() => {
    propsRef.current = props;
  });

  // ---------- shooting ----------
  function shoot() {
    const a = anim.current;
    const p = propsRef.current;
    if (a.phase !== "aim" || !p.enabled) return;
    sfx.unlock();
    const now = performance.now();
    const power = powerAt(now);
    const input: ShotInput = { aimX: aim.current.x, aimY: aim.current.y, power: Math.round(power * 1000) / 1000 };
    anim.current = { phase: "runup", t0: now, input, result: null, error: null, done: false };
    p.onShoot(input).then(
      (r) => { if (anim.current.input === input) anim.current.result = r; },
      (e: unknown) => { if (anim.current.input === input) anim.current.error = e instanceof Error ? e.message : "The shot could not be sent. Try again."; },
    );
  }
  useImperativeHandle(ref, () => ({ shoot }));

  function powerAt(now: number) {
    const t = ((now - powerT0.current) % POWER_PERIOD) / POWER_PERIOD;
    return t < 0.5 ? t * 2 : 2 - t * 2; // up, then down
  }

  // ---------- pointer and keyboard ----------
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const toAim = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      const lx = ((e.clientX - r.left) / r.width) * W;
      const ly = ((e.clientY - r.top) / r.height) * H;
      aim.current = { x: clamp((lx - GOAL.cx) / GOAL.halfW, -AIM_X, AIM_X), y: clamp((GOAL.ground - ly) / GOAL.height, 0, AIM_Y) };
    };
    const move = (e: PointerEvent) => {
      if (anim.current.phase !== "aim") return;
      if (e.pointerType === "mouse" || e.buttons > 0) toAim(e);
    };
    const down = (e: PointerEvent) => {
      if (anim.current.phase !== "aim") return;
      toAim(e);
      // a mouse click aims and shoots; a finger only aims (the big SHOOT button shoots)
      if (e.pointerType === "mouse") shoot();
    };
    const key = (e: KeyboardEvent) => {
      if (anim.current.phase !== "aim") return;
      const step = 0.08;
      if (e.key === "ArrowLeft") aim.current.x = clamp(aim.current.x - step, -AIM_X, AIM_X);
      else if (e.key === "ArrowRight") aim.current.x = clamp(aim.current.x + step, -AIM_X, AIM_X);
      else if (e.key === "ArrowUp") aim.current.y = clamp(aim.current.y + step, 0, AIM_Y);
      else if (e.key === "ArrowDown") aim.current.y = clamp(aim.current.y - step, 0, AIM_Y);
      else if (e.key === " " || e.key === "Enter") shoot();
      else return;
      e.preventDefault();
    };
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerdown", down);
    wrap.addEventListener("keydown", key);
    return () => {
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerdown", down);
      wrap.removeEventListener("keydown", key);
    };
    // shoot reads everything from refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- drawing ----------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    reduced.current = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    powerT0.current = performance.now();

    let scale = 1;
    const fit = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth || W;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round((w * H / W) * dpr);
      scale = (w * dpr) / W;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(canvas);

    let raf = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      draw(ctx, now);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
    // the loop reads everything from refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function draw(ctx: CanvasRenderingContext2D, now: number) {
    const k = reduced.current ? 0.6 : 1;
    const RUN = 380 * k;
    const FLIGHT = 620 * k;
    const AFTER = 1500 * k;
    const a = anim.current;
    const p = propsRef.current;

    // move the shot along
    let t = now - a.t0;
    if (a.phase === "runup" && a.error) {
      p.onError(a.error);
      anim.current = { phase: "aim", t0: now, input: null, result: null, error: null, done: false };
      powerT0.current = now;
    } else if (a.phase === "runup" && t >= RUN && a.result) {
      a.phase = "flight";
      a.t0 = now;
      t = 0;
      if (!p.muted) sfx.kick();
    } else if (a.phase === "flight" && t >= FLIGHT) {
      a.phase = "after";
      a.t0 = now;
      t = 0;
      if (!p.muted && a.result) ({ goal: sfx.goal, save: sfx.save, post: sfx.post, wide: sfx.miss, over: sfx.miss })[a.result.outcome]();
    } else if (a.phase === "after" && t >= AFTER && !a.done) {
      a.done = true;
      const r = a.result!;
      anim.current = { phase: "aim", t0: now, input: null, result: null, error: null, done: false };
      powerT0.current = now;
      p.onResolved(r);
    }
    const cur = anim.current;
    const tt = now - cur.t0;

    drawStadium(ctx, now, cur.phase === "after" && cur.result?.outcome === "goal" ? tt : -1);
    // net ripple after a goal
    const ripple = cur.phase === "after" && cur.result?.outcome === "goal" && !reduced.current ? { x: flightEnd(cur.result).x, y: flightEnd(cur.result).y, t: tt } : null;
    drawGoal(ctx, ripple);

    // goalkeeper
    let kx = GOAL.cx + Math.sin(now / 520) * 7;
    let ky = 248;
    let angle = 0;
    let reach = 0; // 0 = arms ready, 1 = fully stretched
    if ((cur.phase === "flight" || cur.phase === "after") && cur.result) {
      const r = cur.result;
      const zc = ZONE_CENTER[r.keeper];
      let tx = gx(zc.x);
      let ty = gy(zc.y) + 8;
      if (r.outcome === "save") {
        const e = flightEnd(r);
        tx = e.x;
        ty = e.y + 6;
      } else if (r.outcome === "goal" && Math.abs(gx(zc.x) - flightEnd(r).x) < 50) {
        tx = lerp(GOAL.cx, tx, 0.65); // got close, not close enough
      }
      const start = cur.phase === "flight" ? 90 * k : 0;
      const dt = cur.phase === "flight" ? clamp((tt - start) / (430 * k), 0, 1) : 1;
      const d = ease(dt);
      kx = lerp(GOAL.cx, tx, d);
      ky = lerp(248, ty, d);
      angle = clamp((tx - GOAL.cx) / GOAL.halfW, -1, 1) * 1.15 * d;
      reach = d;
      if (cur.phase === "after") {
        // lands on the ground after a dive to the side
        const fall = ease(clamp(tt / (500 * k), 0, 1));
        if (Math.abs(angle) > 0.4) ky = lerp(ty, GOAL.ground - 12, fall);
        else ky = lerp(ty, 248, fall);
      }
    }
    drawKeeper(ctx, kx, ky, angle, reach);

    // ball
    let bx = SPOT.x;
    let by = SPOT.y;
    let br = 10.5;
    let rot = 0;
    let shadow = { x: SPOT.x, y: SPOT.y + 8, w: 11 };
    if (cur.phase === "flight" && cur.result) {
      const e = flightEnd(cur.result);
      const u = ease(clamp(tt / FLIGHT, 0, 1));
      const cx = (SPOT.x + e.x) / 2;
      const cy = Math.min(SPOT.y, e.y) - 30 - cur.result.ballY * 18;
      bx = (1 - u) * (1 - u) * SPOT.x + 2 * (1 - u) * u * cx + u * u * e.x;
      by = (1 - u) * (1 - u) * SPOT.y + 2 * (1 - u) * u * cy + u * u * e.y;
      br = lerp(10.5, 5.8, u);
      rot = u * 14;
      shadow = { x: lerp(SPOT.x, e.x, u), y: lerp(SPOT.y + 8, GOAL.ground + 2, u), w: lerp(11, 6, u) };
    } else if (cur.phase === "after" && cur.result) {
      const e = flightEnd(cur.result);
      const u = ease(clamp(tt / (700 * k), 0, 1));
      const sx = Math.sign(cur.result.ballX) || 1;
      const out = cur.result.outcome;
      let ex = e.x;
      let ey = e.y;
      if (out === "goal") { ex = e.x * 0.9 + GOAL.cx * 0.1; ey = GOAL.ground - 6; }
      else if (out === "save") { ex = e.x + sx * 70; ey = e.y + 70; }
      else if (out === "post") { ex = e.x - sx * 40; ey = e.y + 95; }
      else if (out === "wide") { ex = e.x + sx * 50; ey = e.y - 10; }
      else { ex = e.x + (e.x - SPOT.x) * 0.2; ey = e.y - 45; }
      bx = lerp(e.x, ex, u);
      by = out === "goal" ? lerp(e.y, ey, u * u) : lerp(e.y, ey, u);
      br = out === "save" || out === "post" ? lerp(5.8, 8, u) : lerp(5.8, 5, u);
      rot = 14 + u * 6;
      shadow = { x: bx, y: out === "save" || out === "post" ? lerp(GOAL.ground + 2, ey + 8, u) : GOAL.ground + 2, w: br };
    }
    const kicking = cur.phase === "runup" || (cur.phase === "flight" && tt < 120);
    // the shooter stands behind the ball
    const run = cur.phase === "runup" ? ease(clamp(tt / RUN, 0, 1)) : cur.phase === "aim" ? 0 : 1;
    drawShadow(ctx, shadow.x, shadow.y, shadow.w);
    drawShooter(ctx, lerp(150, 168, run), lerp(462, 432, run), kicking ? clamp((tt - (cur.phase === "runup" ? RUN * 0.6 : 0)) / 160, 0, 1) : 0);
    drawBall(ctx, bx, by, br, rot);

    // aim and power
    if (cur.phase === "aim" && p.enabled) {
      drawAim(ctx, now);
      drawPower(ctx, powerAt(now));
    } else if (cur.phase === "runup" && cur.input) {
      drawPower(ctx, cur.input.power);
    }

    if (cur.phase === "after" && cur.result) drawBanner(ctx, BANNER[cur.result.outcome], tt);
    if (cur.phase === "runup" && tt > RUN + 600) drawWaiting(ctx, now);
  }

  // ---------- pieces of the scene ----------
  function drawStadium(ctx: CanvasRenderingContext2D, now: number, celebrate: number) {
    const sky = ctx.createLinearGradient(0, 0, 0, 160);
    sky.addColorStop(0, "#030a1f");
    sky.addColorStop(1, "#0b2347");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, 165);
    // floodlights
    for (const lx of [36, 324]) {
      const g = ctx.createRadialGradient(lx, 18, 2, lx, 18, 120);
      g.addColorStop(0, "rgba(255,255,230,0.9)");
      g.addColorStop(0.15, "rgba(255,255,210,0.35)");
      g.addColorStop(1, "rgba(255,255,200,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, 170);
      ctx.fillStyle = "#e2e8f0";
      ctx.fillRect(lx - 14, 12, 28, 10);
    }
    // the crowd (jumps when a goal goes in)
    const jump = celebrate >= 0 && !reduced.current ? Math.max(0, 1 - celebrate / 1500) : 0;
    for (const c of crowd.current) {
      const dy = jump > 0 ? Math.abs(Math.sin(now / 90 + c.p)) * 4 * jump : 0;
      ctx.fillStyle = c.c;
      ctx.globalAlpha = 0.75;
      ctx.fillRect(c.x, c.y - dy, 3, 3);
    }
    ctx.globalAlpha = 1;
    // advertising boards
    ctx.fillStyle = "#0c0b5d";
    ctx.fillRect(0, 150, W, 16);
    ctx.fillStyle = "#facc15";
    ctx.font = "bold 9px system-ui, sans-serif";
    ctx.textBaseline = "middle";
    for (let x = -40 + ((now / 40) % 120); x < W; x += 120) ctx.fillText("UNIQUE FUTSAL", x, 158);
    // the pitch with mown stripes (wider towards the viewer)
    let y = 166;
    let i = 0;
    while (y < H) {
      const hgt = 10 + (y - 166) * 0.09;
      ctx.fillStyle = i % 2 ? "#15803d" : "#16a34a";
      ctx.fillRect(0, y, W, hgt + 1);
      y += hgt;
      i++;
    }
    // lines: goal line, six-yard box, penalty area, spot
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, GOAL.ground + 1);
    ctx.lineTo(W, GOAL.ground + 1);
    ctx.moveTo(gx(-1.45), GOAL.ground + 1);
    ctx.lineTo(gx(-1.6), GOAL.ground + 34);
    ctx.lineTo(gx(1.6), GOAL.ground + 34);
    ctx.lineTo(gx(1.45), GOAL.ground + 1);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(gx(-2.3), GOAL.ground + 1);
    ctx.lineTo(gx(-2.9), H);
    ctx.moveTo(gx(2.3), GOAL.ground + 1);
    ctx.lineTo(gx(2.9), H);
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.ellipse(SPOT.x, SPOT.y + 9, 5, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawGoal(ctx: CanvasRenderingContext2D, ripple: { x: number; y: number; t: number } | null) {
    const L = gx(-1);
    const R = gx(1);
    const T = gy(1);
    const B = GOAL.ground;
    const back = { L: L + 16, R: R - 16, T: T - 14, B: B - 6 };
    // the net: back and sides, with a mesh that bulges after a goal
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fillRect(back.L, back.T, back.R - back.L, back.B - back.T);
    ctx.strokeStyle = "rgba(255,255,255,0.32)";
    ctx.lineWidth = 0.8;
    const bulge = (x: number, y: number) => {
      if (!ripple) return { x, y };
      const d = Math.hypot(x - ripple.x, y - ripple.y);
      const amp = Math.max(0, 1 - ripple.t / 900) * 9 * Math.exp(-d / 40);
      return { x: x + ((x - ripple.x) / (d || 1)) * amp * 0.3, y: y - amp };
    };
    for (let x = back.L; x <= back.R + 0.1; x += 9) {
      ctx.beginPath();
      for (let y = back.T; y <= back.B; y += 6) {
        const q = bulge(x, y);
        if (y === back.T) ctx.moveTo(q.x, q.y);
        else ctx.lineTo(q.x, q.y);
      }
      ctx.stroke();
    }
    for (let y = back.T; y <= back.B + 0.1; y += 9) {
      ctx.beginPath();
      for (let x = back.L; x <= back.R; x += 6) {
        const q = bulge(x, y);
        if (x === back.L) ctx.moveTo(q.x, q.y);
        else ctx.lineTo(q.x, q.y);
      }
      ctx.stroke();
    }
    // side nets
    for (const [px, bx] of [[L, back.L], [R, back.R]] as const) {
      for (let i = 0; i <= 8; i++) {
        const u = i / 8;
        ctx.beginPath();
        ctx.moveTo(px, lerp(T, B, u));
        ctx.lineTo(bx, lerp(back.T, back.B, u));
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(px, T);
      ctx.lineTo(bx, back.T);
      ctx.stroke();
    }
    // posts and crossbar
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(L, B);
    ctx.lineTo(L, T);
    ctx.lineTo(R, T);
    ctx.lineTo(R, B);
    ctx.stroke();
    ctx.lineCap = "butt";
  }

  function drawKeeper(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, reach: number) {
    // shadow on the ground
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.ellipse(x, GOAL.ground + 3, 18, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    // legs
    ctx.fillStyle = "#111827";
    ctx.fillRect(-11, 10, 8, 22);
    ctx.fillRect(3, 10, 8, 22);
    ctx.fillStyle = "#facc15";
    ctx.fillRect(-11, 24, 8, 6);
    ctx.fillRect(3, 24, 8, 6);
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(-12, 30, 10, 4);
    ctx.fillRect(2, 30, 10, 4);
    // shorts
    ctx.fillStyle = "#111827";
    ctx.fillRect(-13, 2, 26, 11);
    // jersey
    const shirt = ctx.createLinearGradient(-14, -22, 14, 4);
    shirt.addColorStop(0, "#fb923c");
    shirt.addColorStop(1, "#ea580c");
    ctx.fillStyle = shirt;
    rrect(ctx, -14, -22, 28, 26, 6);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("1", 0, -9);
    // arms: ready at the sides, stretched up when diving
    const armUp = reach;
    ctx.strokeStyle = "#ea580c";
    ctx.lineWidth = 7;
    ctx.lineCap = "round";
    for (const s of [-1, 1]) {
      const sx = s * 13;
      const ex = s * lerp(26, 10, armUp);
      const ey = lerp(-4, -46, armUp);
      ctx.beginPath();
      ctx.moveTo(sx, -18);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.fillStyle = "#22c55e";
      ctx.beginPath();
      ctx.arc(ex, ey, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ea580c";
    }
    ctx.lineCap = "butt";
    // head
    ctx.fillStyle = "#c68642";
    ctx.beginPath();
    ctx.arc(0, -31, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1f2937";
    ctx.beginPath();
    ctx.arc(0, -34, 9, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.textAlign = "start";
  }

  function drawShooter(ctx: CanvasRenderingContext2D, x: number, y: number, kick: number) {
    // seen from behind: the player in the Unique Futsal navy kit
    ctx.save();
    ctx.translate(x, y);
    // standing leg
    ctx.fillStyle = "#c68642";
    ctx.fillRect(-12, -6, 9, 22);
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(-12, 6, 9, 10);
    ctx.fillStyle = "#111827";
    ctx.fillRect(-13, 16, 11, 5);
    // kicking leg swings forward
    ctx.save();
    ctx.translate(6, -6);
    ctx.rotate(-0.9 * kick + 0.15 * (1 - kick));
    ctx.fillStyle = "#c68642";
    ctx.fillRect(-4, 0, 9, 22);
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(-4, 12, 9, 10);
    ctx.fillStyle = "#111827";
    ctx.fillRect(-5, 22, 11, 5);
    ctx.restore();
    // shorts
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(-15, -16, 30, 13);
    // shirt
    ctx.fillStyle = "#0c0b5d";
    rrect(ctx, -17, -50, 34, 36, 7);
    ctx.fill();
    ctx.fillStyle = "#facc15";
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("10", 0, -29);
    ctx.font = "bold 6px system-ui, sans-serif";
    ctx.fillText("UNIQUE", 0, -42);
    // arms
    ctx.strokeStyle = "#0c0b5d";
    ctx.lineWidth = 7;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-15, -45);
    ctx.lineTo(-24 - kick * 6, -24);
    ctx.moveTo(15, -45);
    ctx.lineTo(23 + kick * 4, -26);
    ctx.stroke();
    ctx.lineCap = "butt";
    // head from behind: neck, then hair
    ctx.fillStyle = "#c68642";
    ctx.fillRect(-4, -52, 8, 5);
    ctx.fillStyle = "#111827";
    ctx.beginPath();
    ctx.arc(0, -60, 9.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.textAlign = "start";
  }

  function drawShadow(ctx: CanvasRenderingContext2D, x: number, y: number, w: number) {
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.beginPath();
    ctx.ellipse(x, y, w, w * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawBall(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    const g = ctx.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.2, 0, 0, r);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(1, "#cbd5e1");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#111827";
    const pent = (cx: number, cy: number, s: number) => {
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
        const px = cx + Math.cos(a) * s;
        const py = cy + Math.sin(a) * s;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    };
    pent(0, 0, r * 0.32);
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
      pent(Math.cos(a) * r * 0.78, Math.sin(a) * r * 0.78, r * 0.2);
    }
    ctx.strokeStyle = "rgba(15,23,42,0.5)";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawAim(ctx: CanvasRenderingContext2D, now: number) {
    const ax = gx(aim.current.x);
    const ay = gy(aim.current.y);
    // dotted path from the ball
    ctx.fillStyle = "rgba(250,204,21,0.75)";
    const cx = (SPOT.x + ax) / 2;
    const cy = Math.min(SPOT.y, ay) - 30 - aim.current.y * 18;
    for (let i = 1; i < 12; i++) {
      const u = i / 12;
      const px = (1 - u) * (1 - u) * SPOT.x + 2 * (1 - u) * u * cx + u * u * ax;
      const py = (1 - u) * (1 - u) * SPOT.y + 2 * (1 - u) * u * cy + u * u * ay;
      ctx.beginPath();
      ctx.arc(px, py, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    // the target
    const pulse = reduced.current ? 0 : Math.sin(now / 160) * 1.5;
    ctx.strokeStyle = "#facc15";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(ax, ay, 12 + pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ax - 18, ay);
    ctx.lineTo(ax - 6, ay);
    ctx.moveTo(ax + 6, ay);
    ctx.lineTo(ax + 18, ay);
    ctx.moveTo(ax, ay - 18);
    ctx.lineTo(ax, ay - 6);
    ctx.moveTo(ax, ay + 6);
    ctx.lineTo(ax, ay + 18);
    ctx.stroke();
  }

  function drawPower(ctx: CanvasRenderingContext2D, v: number) {
    const x = 326;
    const top = 312;
    const h = 130;
    ctx.fillStyle = "rgba(2,6,23,0.55)";
    rrect(ctx, x - 4, top - 18, 26, h + 26, 8);
    ctx.fill();
    const g = ctx.createLinearGradient(0, top + h, 0, top);
    g.addColorStop(0, "#22c55e");
    g.addColorStop(0.6, "#facc15");
    g.addColorStop(1, "#ef4444");
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.fillRect(x, top, 18, h);
    ctx.fillStyle = g;
    ctx.fillRect(x, top + h * (1 - v), 18, h * v);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, top, 18, h);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 7px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("POWER", x + 9, top - 8);
    ctx.textAlign = "start";
  }

  function drawBanner(ctx: CanvasRenderingContext2D, b: { text: string; color: string }, t: number) {
    const s = reduced.current ? 1 : 0.6 + 0.4 * ease(clamp(t / 260, 0, 1));
    const alpha = clamp(1 - (t - 1100) / 400, 0, 1);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(W / 2, 214);
    ctx.scale(s, s);
    ctx.font = "italic 900 40px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 7;
    ctx.strokeStyle = "rgba(2,6,23,0.85)";
    ctx.strokeText(b.text, 0, 0);
    ctx.fillStyle = b.color;
    ctx.fillText(b.text, 0, 0);
    ctx.restore();
  }

  function drawWaiting(ctx: CanvasRenderingContext2D, now: number) {
    ctx.fillStyle = "rgba(2,6,23,0.6)";
    rrect(ctx, W / 2 - 70, 300, 140, 28, 14);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`Waiting for the referee${".".repeat(1 + (Math.floor(now / 300) % 3))}`, W / 2, 314);
    ctx.textAlign = "start";
  }

  return (
    <div ref={wrapRef} tabIndex={0} aria-label={`Penalty game. ${props.caption}. Move the mouse or drag over the goal to aim, use the arrow keys, and press Space to shoot.`} className="uf-keep relative overflow-hidden rounded-3xl outline-none ring-brand focus-visible:ring-4">
      <canvas ref={canvasRef} role="img" aria-label={`Football pitch with a goal and a goalkeeper. ${props.caption}`} className="block w-full touch-none select-none" style={{ aspectRatio: `${W} / ${H}`, cursor: props.enabled ? "crosshair" : "default" }} />
    </div>
  );
});

export default PenaltyGame;
