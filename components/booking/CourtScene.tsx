"use client";

// The animated court under "Book a court": a futsal turf drawn in perspective (wide near you, narrow at the far end, where the goal is) and eight
// Unique Futsal players (blue shirt with the club name, white shorts) who play on it. Pure SVG, no photo or video.
// The play is made up as it goes: every player wanders to random spots on the turf, the one with the ball dribbles, passes to a team-mate or
// shoots, and every shot is a goal ("GOAL!" shows for a moment) before the play starts again. Players and the ball get bigger as they come nearer.
// The page is drawn once; the moving parts are updated straight on the SVG elements every frame (no React re-render).
// It holds still when the device has "reduce motion" on.

import { useEffect, useRef } from "react";

const VX = 0, VY = 88, VW = 800, VH = 362; // the part of the drawing that is shown: the whole turf, the goal and the players
const TURF = { top: 150, bottom: 430, tl: 270, tr: 530, bl: 24, br: 776 };
const GOAL = { L: 336, R: 464, T: 104 }; // the goal stands on the far line of the turf
const N = 8;

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const depth = (y: number) => clamp((y - TURF.top) / (TURF.bottom - TURF.top), 0, 1);
const scaleAt = (y: number) => 0.62 + 1.32 * depth(y); // the nearer, the bigger
const edgeAt = (y: number) => { const t = depth(y); return { l: TURF.tl + (TURF.bl - TURF.tl) * t, r: TURF.tr + (TURF.br - TURF.tr) * t }; };
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

const LOOKS = [
  { skin: "#e0ac84", hair: "#1d1612" }, { skin: "#c98f5f", hair: "#2a1d17" }, { skin: "#f0c9a0", hair: "#6b4423" }, { skin: "#8d5a3b", hair: "#0f0c0a" },
  { skin: "#e0ac84", hair: "#3a2a1e" }, { skin: "#d3996a", hair: "#1d1612" }, { skin: "#f0c9a0", hair: "#2a1d17" }, { skin: "#b57a50", hair: "#0f0c0a" },
];
const START: [number, number][] = [[150, 380], [400, 340], [650, 385], [270, 280], [530, 270], [120, 300], [690, 300], [400, 215]];

const CSS = `
.cs-pivot{transform-origin:0 0}
.cs-th{animation:cs-th .56s ease-in-out infinite}
.cs-sh{animation:cs-sh .56s ease-in-out infinite}
.cs-ar{animation:cs-ar .56s ease-in-out infinite}
.cs-bob{animation:cs-bob .28s ease-in-out infinite alternate}
.cs-idle *{animation-play-state:paused}
.cs-goal{transition:opacity .2s}
@keyframes cs-th{0%{transform:rotate(-28deg)}50%{transform:rotate(30deg)}100%{transform:rotate(-28deg)}}
@keyframes cs-sh{0%{transform:rotate(14deg)}25%{transform:rotate(78deg)}50%{transform:rotate(26deg)}62%{transform:rotate(7deg)}85%{transform:rotate(7deg)}100%{transform:rotate(14deg)}}
@keyframes cs-ar{0%{transform:rotate(26deg)}50%{transform:rotate(-26deg)}100%{transform:rotate(26deg)}}
@keyframes cs-bob{from{transform:translateY(0)}to{transform:translateY(-2.4px)}}
@media (prefers-reduced-motion: reduce){.cs-scene *{animation:none!important}}
`;

const BLUE = "#1d5fd6";

function Player({ i, g }: { i: number; g: (el: SVGGElement | null) => void }) {
  const S = LOOKS[i];
  // one stride is 0.56 s: the other leg and arm are half a stride behind, and every player starts at his own point of the stride
  const d0 = (i * 0.19) % 0.56;
  const dA = `${-d0.toFixed(3)}s`;
  const dB = `${-((d0 + 0.28) % 0.56).toFixed(3)}s`;
  const delay = dA;
  const leg = (x: number, dly: string) => (
    <g transform={`translate(${x} -34)`}>
      <g className="cs-pivot">
        <g className="cs-pivot cs-th" style={{ animationDelay: dly }}>
          <rect x={-4.2} y={-1} width={8.4} height={18} rx={4.1} fill={S.skin} />
          <g transform="translate(0 16)">
            <g className="cs-pivot cs-sh" style={{ animationDelay: dly }}>
              <rect x={-3.4} y={-1} width={6.8} height={18} rx={3.3} fill={S.skin} />
              <rect x={-3.7} y={5} width={7.4} height={12.5} rx={2.6} fill={BLUE} />
              <rect x={-3.7} y={9.5} width={7.4} height={2.2} fill="#fff" opacity={0.9} />
              <ellipse cx={1.2} cy={18.2} rx={6.4} ry={3.2} fill="#14161b" />
              <ellipse cx={0.4} cy={17.2} rx={3.4} ry={1.2} fill="#fff" opacity={0.18} />
            </g>
          </g>
        </g>
      </g>
    </g>
  );
  const arm = (x: number, dly: string, bend: number) => (
    <g transform={`translate(${x} -63)`}>
      <g className="cs-pivot cs-ar" style={{ animationDelay: dly }}>
        <rect x={-3.2} y={-1.5} width={6.4} height={13.5} rx={3.2} fill={S.skin} />
        <rect x={-4.6} y={-2.6} width={9.2} height={8.5} rx={3.4} fill={BLUE} />
        <g transform={`translate(0 11) rotate(${bend})`}>
          <rect x={-2.9} y={-1} width={5.8} height={12} rx={2.9} fill={S.skin} />
          <circle cx={0} cy={12} r={2.9} fill={S.skin} />
        </g>
      </g>
    </g>
  );
  const [x, y] = START[i];
  return (
    <g ref={g} transform={`translate(${x} ${y}) scale(${scaleAt(y).toFixed(3)})`}>
      <ellipse cx={1} cy={1.5} rx={15} ry={3.8} fill="#000" opacity={0.34} filter="url(#cs-blur)" />
      <g className="cs-pivot cs-bob" style={{ animationDelay: delay }}>
        {leg(-5.2, dA)}
        {leg(5.2, dB)}
        {/* white shorts */}
        <path d="M -12.6 -43.5 L 12.6 -43.5 L 13.4 -30.5 Q 7 -28.6 1.3 -30.8 L 0 -33.5 L -1.3 -30.8 Q -7 -28.6 -13.4 -30.5 Z" fill="url(#cs-shorts)" />
        <rect x={-12.6} y={-43.5} width={25.2} height={2.8} fill={BLUE} opacity={0.9} />
        {/* blue shirt with the club name */}
        <path d="M -13.4 -44 L -13.4 -60 Q -13.4 -68.5 -5 -68.5 L 5 -68.5 Q 13.4 -68.5 13.4 -60 L 13.4 -44 Z" fill="url(#cs-jersey)" />
        <path d="M -4.6 -68.5 L 0 -62.8 L 4.6 -68.5" fill="none" stroke="#fff" strokeWidth={1.4} strokeLinejoin="round" />
        <text x={0} y={-57} textAnchor="middle" fontFamily="Arial Black, Arial, sans-serif" fontWeight={900} fontSize={5.2} letterSpacing={0.25} fill="#fff">UNIQUE</text>
        <text x={0} y={-50.4} textAnchor="middle" fontFamily="Arial Black, Arial, sans-serif" fontWeight={900} fontSize={5.2} letterSpacing={0.25} fill="#fff">FUTSAL</text>
        {arm(-15, dA, -52)}
        {arm(15, dB, 52)}
        {/* neck and head */}
        <rect x={-3} y={-72} width={6} height={5.5} fill={S.skin} />
        <ellipse cx={-7} cy={-75.5} rx={1.6} ry={2.4} fill={S.skin} />
        <ellipse cx={7} cy={-75.5} rx={1.6} ry={2.4} fill={S.skin} />
        <circle cx={0} cy={-76} r={7} fill={S.skin} />
        <path d="M -7.2 -76.2 A 7.2 7.2 0 0 1 7.2 -76.2 Q 4 -80.8 0 -80.4 Q -4 -80.8 -7.2 -76.2 Z" fill={S.hair} />
        <circle cx={-2.4} cy={-75.4} r={0.85} fill="#222" />
        <circle cx={2.4} cy={-75.4} r={0.85} fill="#222" />
        <path d="M -2.2 -72.6 Q 0 -71 2.2 -72.6" fill="none" stroke="#7a3d2a" strokeWidth={0.8} strokeLinecap="round" />
      </g>
    </g>
  );
}

// the turf's mowing stripes, in perspective
const STRIPES = 9;
const stripe = (i: number) => {
  const x = (a: number, b: number, k: number) => a + ((b - a) * k) / STRIPES;
  return `${x(TURF.tl, TURF.tr, i)},${TURF.top} ${x(TURF.tl, TURF.tr, i + 1)},${TURF.top} ${x(TURF.bl, TURF.br, i + 1)},${TURF.bottom} ${x(TURF.bl, TURF.br, i)},${TURF.bottom}`;
};
const MID = edgeAt(292);
const BOX = { a: edgeAt(TURF.top), b: edgeAt(TURF.top + 62) };

// the goal at the far end of the turf: two posts, the crossbar and a net
function Goal() {
  const { L, R, T } = GOAL, B = TURF.top;
  const net: React.ReactNode[] = [];
  for (let x = L + 11; x < R; x += 11) net.push(<line key={`v${x}`} x1={x} y1={T} x2={x} y2={B} />);
  for (let y = T + 11; y < B; y += 11) net.push(<line key={`h${y}`} x1={L} y1={y} x2={R} y2={y} />);
  return (
    <g>
      <rect x={L} y={T} width={R - L} height={B - T} fill="#cbd5e1" opacity={0.35} />
      <g stroke="#64748b" strokeWidth={0.8} opacity={0.7}>{net}</g>
      <polyline points={`${L},${B} ${L},${T} ${R},${T} ${R},${B}`} fill="none" stroke="#1e293b" strokeWidth={8} strokeLinejoin="round" strokeLinecap="round" />
      <polyline points={`${L},${B} ${L},${T} ${R},${T} ${R},${B}`} fill="none" stroke="#fff" strokeWidth={4.5} strokeLinejoin="round" strokeLinecap="round" />
    </g>
  );
}

type P = { x: number; y: number; tx: number; ty: number; wait: number };

export default function CourtScene() {
  const players = useRef<(SVGGElement | null)[]>([]);
  const ball = useRef<SVGGElement>(null);
  const shadow = useRef<SVGEllipseElement>(null);
  const goalText = useRef<SVGTextElement>(null);
  const layer = useRef<SVGGElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const P: P[] = START.map(([x, y]) => ({ x, y, tx: x, ty: y, wait: rnd(0, 1) }));
    const wander = (p: P) => {
      const y = rnd(TURF.top + 24, TURF.bottom - 8);
      const e = edgeAt(y);
      p.tx = rnd(e.l + 14, e.r - 14);
      p.ty = y;
    };
    P.forEach(wander);

    let mode: "carry" | "pass" | "shot" | "net" = "carry";
    let holder = 1;
    let holdT = 1.4, t = 0, T = 0.5, netT = 0;
    let from = { x: 0, y: 0, z: 0 }, to = { x: 0, y: 0, z: 0 }, receiver = 0;
    let bx = 0, by = 0, bz = 0, clock = 0, sort = 0;

    const foot = (p: P) => ({ x: p.x + 11 * scaleAt(p.y), y: p.y });
    const goalward = (p: P) => { // where the player with the ball runs: towards the goal
      p.tx = clamp(p.x + rnd(-60, 60), GOAL.L - 60, GOAL.R + 60);
      p.ty = Math.max(TURF.top + 70, p.y - rnd(40, 90));
      const e = edgeAt(p.ty);
      p.tx = clamp(p.tx, e.l + 14, e.r - 14);
    };
    const give = (i: number) => { holder = i; mode = "carry"; holdT = rnd(1, 2.1); goalward(P[i]); };

    const move = (p: P, speed: number, dt: number) => {
      const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy);
      if (d < 2) return false;
      const step = Math.min(d, speed * dt * (0.55 + 0.45 * scaleAt(p.y)));
      p.x += (dx / d) * step;
      p.y += (dy / d) * step * 0.8;
      return true;
    };

    let last = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      clock += dt;

      const moving: boolean[] = P.map((p, i) => {
        if (i === holder && mode === "carry") {
          const go = move(p, 80, dt);
          if (!go) goalward(p);
          return true;
        }
        if (move(p, 55, dt)) return true;
        p.wait -= dt;
        if (p.wait <= 0) { wander(p); p.wait = rnd(0.2, 1.1); }
        return false;
      });

      if (mode === "carry") {
        const f = foot(P[holder]);
        bx = f.x; by = f.y; bz = 2 + 5 * Math.abs(Math.sin(clock * 11));
        holdT -= dt;
        if (holdT <= 0) {
          from = { x: bx, y: by, z: bz };
          t = 0;
          if (P[holder].y < TURF.top + 140 || Math.random() < 0.18) {
            const gx = rnd(GOAL.L + 16, GOAL.R - 16);
            to = { x: gx, y: TURF.top, z: rnd(6, 26) }; T = 0.5 + P[holder].y / 900; mode = "shot";
          } else {
            receiver = (holder + 1 + Math.floor(Math.random() * (N - 1))) % N;
            T = 0.5; mode = "pass";
          }
        }
      } else if (mode === "pass") {
        t += dt;
        const k = Math.min(1, t / T), f = foot(P[receiver]);
        bx = from.x + (f.x - from.x) * k; by = from.y + (f.y - from.y) * k; bz = from.z + 16 * 4 * k * (1 - k);
        if (k >= 1) give(receiver);
      } else if (mode === "shot") {
        t += dt;
        const k = Math.min(1, t / T);
        bx = from.x + (to.x - from.x) * k; by = from.y + (to.y - from.y) * k; bz = from.z + (to.z - from.z) * k + 10 * 4 * k * (1 - k);
        if (k >= 1) { mode = "net"; netT = 1.7; }
      } else {
        netT -= dt;
        bz = Math.max(3, bz - 30 * dt);
        if (netT <= 0) { // the play starts again with the player nearest the middle
          let best = 0, bd = 1e9;
          P.forEach((p, i) => { const d = Math.hypot(p.x - 400, (p.y - 290) * 1.6); if (d < bd) { bd = d; best = i; } });
          give(best);
        }
      }

      // draw
      P.forEach((p, i) => {
        const el = players.current[i];
        if (!el) return;
        el.setAttribute("transform", `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) scale(${scaleAt(p.y).toFixed(3)})`);
        el.classList.toggle("cs-idle", !moving[i]);
      });
      const kb = scaleAt(by);
      ball.current?.setAttribute("transform", `translate(${bx.toFixed(1)} ${(by - (3.5 + bz) * kb).toFixed(1)}) scale(${kb.toFixed(3)})`);
      shadow.current?.setAttribute("transform", `translate(${bx.toFixed(1)} ${by.toFixed(1)}) scale(${kb.toFixed(3)})`);
      if (goalText.current) goalText.current.style.opacity = mode === "net" ? "1" : "0";

      // the nearer players are drawn in front
      if (++sort % 6 === 0 && layer.current) {
        [...P.keys()].sort((a, b) => P[a].y - P[b].y).forEach((i) => { const el = players.current[i]; if (el) layer.current!.appendChild(el); });
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="cs-scene mt-3 desk:mx-auto desk:max-w-3xl">
      <style>{CSS}</style>
      <svg viewBox={`${VX} ${VY} ${VW} ${VH}`} role="img" aria-label="Animation: eight Unique Futsal players in blue shirts and white shorts run around a futsal turf, pass, dribble and score goals" className="block h-auto w-full">
        <defs>
          <linearGradient id="cs-jersey" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2c70ea" /><stop offset="1" stopColor="#1648ad" /></linearGradient>
          <linearGradient id="cs-shorts" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#d5dbe8" /></linearGradient>
          <linearGradient id="cs-depth" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#04361a" stopOpacity=".5" /><stop offset=".6" stopColor="#04361a" stopOpacity="0" /></linearGradient>
          <filter id="cs-blur" x="-30%" y="-80%" width="160%" height="260%"><feGaussianBlur stdDeviation="1.6" /></filter>
        </defs>
        <Goal />
        {Array.from({ length: STRIPES }, (_, i) => <polygon key={i} points={stripe(i)} fill={i % 2 ? "#2d9141" : "#38a84d"} />)}
        <polygon points={`${TURF.tl},${TURF.top} ${TURF.tr},${TURF.top} ${TURF.br},${TURF.bottom} ${TURF.bl},${TURF.bottom}`} fill="url(#cs-depth)" />
        <g fill="none" stroke="#fff" strokeOpacity={0.9} strokeWidth={3} strokeLinejoin="round">
          <polygon points={`${TURF.bl},${TURF.bottom} ${TURF.tl},${TURF.top} ${TURF.tr},${TURF.top} ${TURF.br},${TURF.bottom}`} />
          <line x1={MID.l} y1={292} x2={MID.r} y2={292} />
          <ellipse cx={400} cy={292} rx={122} ry={34} />
          <polyline points={`${BOX.a.l + 40},${TURF.top} ${BOX.b.l + 50},${TURF.top + 62} ${BOX.b.r - 50},${TURF.top + 62} ${BOX.a.r - 40},${TURF.top}`} />
        </g>
        <g ref={layer}>
          {START.map((_, i) => <Player key={i} i={i} g={(el) => { players.current[i] = el; }} />)}
        </g>
        <ellipse ref={shadow} rx={5} ry={1.7} fill="#000" opacity={0.3} transform={`translate(${START[1][0] + 11} ${START[1][1]})`} />
        <g ref={ball} transform={`translate(${START[1][0] + 11} ${START[1][1] - 6})`}>
          <circle r={4.8} fill="#fff" stroke="#1a1a1a" strokeWidth={0.55} />
          <polygon points="0,-2.6 2.5,-0.8 1.5,2.2 -1.5,2.2 -2.5,-0.8" fill="#222" />
        </g>
        <text ref={goalText} className="cs-goal" x={400} y={238} textAnchor="middle" fontFamily="Arial Black, Arial, sans-serif" fontWeight={900} fontSize={46} fill="#f97316" stroke="#fff" strokeWidth={4} paintOrder="stroke" style={{ opacity: 0 }}>GOAL!</text>
      </svg>
    </div>
  );
}
