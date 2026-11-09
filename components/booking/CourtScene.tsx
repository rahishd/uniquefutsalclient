"use client";

// The animated court under "Book a court": a Unique Futsal striker seen from behind and a little from above (like a game camera), a turf in perspective
// and a goal with a keeper. Scroll the page down a little and he takes the shot: run-up, strike, the ball flies into the net, the keeper dives and misses,
// the net ripples, "GOAL!" pops and he celebrates. Scroll back to the top and he is ready for the next one. Pure SVG + CSS keyframes, no video or photo.
// It holds still when the device has "reduce motion" on.

import { useEffect, useState } from "react";

const SCROLL_TRIGGER = 40; // px the page is scrolled down (about half an inch) before he shoots
const TURF = { top: 150, bottom: 505, tl: 268, tr: 532, bl: 6, br: 794 };
const GOAL = { L: 330, R: 470, T: 72 };
const STRIPES = 9;

const stripe = (i: number) => {
  const x = (a: number, b: number, k: number) => a + ((b - a) * k) / STRIPES;
  return `${x(TURF.tl, TURF.tr, i)},${TURF.top} ${x(TURF.tl, TURF.tr, i + 1)},${TURF.top} ${x(TURF.bl, TURF.br, i + 1)},${TURF.bottom} ${x(TURF.bl, TURF.br, i)},${TURF.bottom}`;
};
const edge = (y: number) => { const t = (y - TURF.top) / (TURF.bottom - TURF.top); return { l: TURF.tl + (TURF.bl - TURF.tl) * t, r: TURF.tr + (TURF.br - TURF.tr) * t }; };
const BOX_FAR = edge(TURF.top), BOX_NEAR = edge(TURF.top + 70);

const BALL = { x: 338, y: 438 }; // where the ball rests, and where it ends up in the net
const NET = { x: 414, y: 121, drop: 138 };

const CSS = `
.cs-scene svg *{transform-box:view-box}
.cs-o{transform-origin:0 0}
.cs-breath{animation:cs-breath 2.4s ease-in-out infinite alternate;transform-origin:0 -100px}
.cs-keepidle{animation:cs-keepidle 1.4s ease-in-out infinite alternate}
@keyframes cs-breath{from{transform:scaleY(1)}to{transform:scaleY(1.014)}}
@keyframes cs-keepidle{from{transform:translateX(-3px)}to{transform:translateX(3px)}}

.cs-play .cs-body{animation:cs-body 4.4s ease-in-out .15s both}
.cs-play .cs-torso{animation:cs-torso 4.4s ease-in-out .15s both;transform-origin:0 -100px}
.cs-play .cs-kth{animation:cs-kth 1s ease-in-out .25s both}
.cs-play .cs-ksh{animation:cs-ksh 1s ease-in-out .25s both}
.cs-play .cs-arml{animation:cs-arml 4.4s ease-in-out .15s both}
.cs-play .cs-armr{animation:cs-armr 4.4s ease-in-out .15s both}
.cs-play .cs-ball{animation:cs-ball 1.5s linear .95s both}
.cs-play .cs-arc{animation:cs-arc .95s linear .95s both}
.cs-play .cs-spin{animation:cs-spin .95s linear .95s both}
.cs-play .cs-keep{animation:cs-keep .62s cubic-bezier(.3,.1,.4,1) 1.05s both}
.cs-play .cs-net{animation:cs-net .5s ease-out 1.8s both;transform-origin:${GOAL.L}px ${GOAL.T}px}
.cs-play .cs-goaltxt{animation:cs-goaltxt 2.3s ease-out 1.85s both;transform-origin:530px 292px}

@keyframes cs-body{0%{transform:translateY(0)}18%{transform:translateY(-9px)}52%{transform:translateY(-9px)}56%{transform:translateY(-30px)}63%{transform:translateY(-9px)}100%{transform:translateY(-9px)}}
@keyframes cs-torso{0%{transform:rotate(0)}12%{transform:rotate(-3deg)}22%{transform:rotate(4deg)}34%{transform:rotate(0)}100%{transform:rotate(0)}}
@keyframes cs-kth{0%{transform:rotate(0) scaleY(1)}45%{transform:rotate(-9deg) scaleY(1)}72%{transform:rotate(5deg) scaleY(.7)}100%{transform:rotate(0) scaleY(.96)}}
@keyframes cs-ksh{0%{transform:rotate(0)}45%{transform:rotate(-82deg)}62%{transform:rotate(-88deg)}73%{transform:rotate(-6deg)}100%{transform:rotate(0)}}
@keyframes cs-arml{0%{transform:rotate(0)}6%{transform:rotate(50deg)}22%{transform:rotate(60deg)}32%{transform:rotate(10deg)}42%{transform:rotate(0)}52%{transform:rotate(165deg)}100%{transform:rotate(165deg)}}
@keyframes cs-armr{0%{transform:rotate(0)}6%{transform:rotate(-14deg)}22%{transform:rotate(-30deg)}32%{transform:rotate(0)}42%{transform:rotate(0)}52%{transform:rotate(-165deg)}100%{transform:rotate(-165deg)}}
@keyframes cs-ball{0%{transform:translate(${BALL.x}px,${BALL.y}px) scale(1);animation-timing-function:cubic-bezier(.35,.05,.6,1)}63%{transform:translate(${NET.x}px,${NET.y}px) scale(.27);animation-timing-function:ease-in}100%{transform:translate(${NET.x}px,${NET.drop}px) scale(.27)}}
@keyframes cs-arc{0%{transform:translateY(0);animation-timing-function:ease-out}45%{transform:translateY(-46px);animation-timing-function:ease-in}100%{transform:translateY(0)}}
@keyframes cs-spin{from{transform:rotate(0)}to{transform:rotate(900deg)}}
@keyframes cs-keep{0%{transform:translate(0,0) rotate(0)}100%{transform:translate(-30px,8px) rotate(-58deg)}}
@keyframes cs-net{0%{transform:scale(1)}40%{transform:scale(1.03,1.09)}100%{transform:scale(1)}}
@keyframes cs-goaltxt{0%{transform:scale(.2);opacity:0}9%{transform:scale(1.18);opacity:1}15%{transform:scale(1);opacity:1}82%{transform:scale(1);opacity:1}100%{transform:scale(1.05);opacity:0}}
@media (prefers-reduced-motion: reduce){.cs-scene *{animation:none!important}}
`;

const SKIN = "#d9a47a";
const HAIR = "#2a1d17";

// the striker, seen from behind; the origin is the ground between his feet and he is about 190 units tall
function Striker() {
  const leg = (x: number, kick: boolean) => (
    <g transform={`translate(${x} -72)`}>
      <g className={`cs-o ${kick ? "cs-kth" : ""}`}>
        <rect x={-8.5} y={-2} width={17} height={36} rx={8} fill="url(#cs-skin)" />
        <g transform="translate(0 32)">
          <g className={`cs-o ${kick ? "cs-ksh" : ""}`}>
            <rect x={-6.8} y={-2} width={13.6} height={42} rx={6} fill="url(#cs-skin)" />
            <rect x={-7.6} y={12} width={15.2} height={27} rx={5} fill="url(#cs-sock)" />
            <rect x={-7.6} y={19} width={15.2} height={3} fill="#fff" opacity={0.9} />
            <ellipse cx={0.5} cy={41} rx={10.5} ry={6} fill="#14161b" />
            <ellipse cx={0} cy={38.6} rx={6} ry={2} fill="#fff" opacity={0.2} />
          </g>
        </g>
      </g>
    </g>
  );
  const arm = (x: number, cls: string) => (
    <g transform={`translate(${x} -152)`}>
      <g className={`cs-o ${cls}`}>
        <rect x={-6.4} y={-4} width={12.8} height={22} rx={6.2} fill="url(#cs-jersey)" />
        <rect x={-5} y={14} width={10} height={25} rx={5} fill="url(#cs-skin)" />
        <circle cx={0} cy={40} r={5.4} fill={SKIN} />
      </g>
    </g>
  );
  return (
    <g>
      <ellipse cx={0} cy={2} rx={36} ry={8} fill="#000" opacity={0.3} filter="url(#cs-blur)" />
      <g className="cs-o cs-body">
        <g className="cs-breath">
          {leg(-11, false)}
          {leg(11, true)}
          {/* white shorts */}
          <path d="M -28 -103 L 28 -103 L 30 -68 Q 16 -62 3.5 -68 L 0 -75 L -3.5 -68 Q -16 -62 -30 -68 Z" fill="url(#cs-shorts)" />
          <rect x={-28} y={-103} width={56} height={4.5} fill="#1d5fd6" opacity={0.9} />
          <g className="cs-o cs-torso">
            {/* blue shirt, back view, with the club name and a number */}
            <path d="M -25 -159 Q 0 -168 25 -159 L 28 -100 Q 0 -94 -28 -100 Z" fill="url(#cs-jersey)" />
            <path d="M -25 -159 Q 0 -168 25 -159 L 28 -100 Q 0 -94 -28 -100 Z" fill="url(#cs-side)" />
            <text x={0} y={-141} textAnchor="middle" fontFamily="Arial Black, Arial, sans-serif" fontWeight={900} fontSize={7.4} letterSpacing={0.6} fill="#fff">UNIQUE</text>
            <text x={0} y={-114} textAnchor="middle" fontFamily="Arial Black, Arial, sans-serif" fontWeight={900} fontSize={34} fill="#fff">10</text>
            {arm(-30, "cs-arml")}
            {arm(30, "cs-armr")}
            {/* neck and the back of the head */}
            <rect x={-6.5} y={-170} width={13} height={12} rx={4} fill={SKIN} />
            <ellipse cx={-15.5} cy={-179} rx={2.6} ry={4} fill={SKIN} />
            <ellipse cx={15.5} cy={-179} rx={2.6} ry={4} fill={SKIN} />
            <circle cx={0} cy={-181} r={16} fill={HAIR} />
            <path d="M -13 -170 Q 0 -161 13 -170 L 12 -165 Q 0 -157 -12 -165 Z" fill={SKIN} opacity={0.0} />
            <ellipse cx={-5} cy={-188} rx={7} ry={3.4} fill="#fff" opacity={0.12} />
          </g>
        </g>
      </g>
    </g>
  );
}

// the goalkeeper in the goal, far away: he dives the wrong way
function Keeper() {
  return (
    <g transform={`translate(${(GOAL.L + GOAL.R) / 2} ${TURF.top}) scale(0.36)`}>
      <g className="cs-keepidle">
        <g className="cs-o cs-keep">
          <rect x={-16} y={-72} width={13} height={72} rx={5} fill="#1f2937" />
          <rect x={3} y={-72} width={13} height={72} rx={5} fill="#1f2937" />
          <rect x={-22} y={-100} width={44} height={34} rx={4} fill="#111827" />
          <rect x={-23} y={-152} width={46} height={56} rx={9} fill="#f59e0b" />
          <rect x={-37} y={-148} width={14} height={40} rx={7} fill="#f59e0b" />
          <rect x={23} y={-148} width={14} height={40} rx={7} fill="#f59e0b" />
          <circle cx={-30} cy={-104} r={8} fill="#22c55e" />
          <circle cx={30} cy={-104} r={8} fill="#22c55e" />
          <circle cx={0} cy={-168} r={14} fill="#d9a47a" />
          <path d="M -14 -170 A 14 14 0 0 1 14 -170 Q 6 -178 0 -177 Q -6 -178 -14 -170 Z" fill="#1d1612" />
        </g>
      </g>
    </g>
  );
}

function Goal() {
  const { L, R, T } = GOAL, B = TURF.top;
  const net: React.ReactNode[] = [];
  for (let x = L + 10; x < R; x += 10) net.push(<line key={`v${x}`} x1={x} y1={T} x2={x} y2={B} />);
  for (let y = T + 10; y < B; y += 10) net.push(<line key={`h${y}`} x1={L} y1={y} x2={R} y2={y} />);
  return (
    <g>
      <rect x={L} y={T} width={R - L} height={B - T} fill="#cbd5e1" opacity={0.3} />
      <g className="cs-net"><g stroke="#64748b" strokeWidth={0.8} opacity={0.75}>{net}</g></g>
    </g>
  );
}

function Posts() {
  const { L, R, T } = GOAL, B = TURF.top;
  const pts = `${L},${B} ${L},${T} ${R},${T} ${R},${B}`;
  return (
    <g fill="none" strokeLinejoin="round" strokeLinecap="round">
      <polyline points={pts} stroke="#1e293b" strokeWidth={8} />
      <polyline points={pts} stroke="#fff" strokeWidth={4.5} />
    </g>
  );
}

export default function CourtScene() {
  const [play, setPlay] = useState(false);

  useEffect(() => {
    // the page (or the app's scroll area) moved down a little: shoot; back at the top: line up the next shot
    const onScroll = (e: Event) => {
      const t = e.target;
      const y = Math.max(window.scrollY, t instanceof Element ? t.scrollTop : 0);
      setPlay((p) => (y > SCROLL_TRIGGER ? true : y < 8 ? false : p));
    };
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => document.removeEventListener("scroll", onScroll, { capture: true });
  }, []);

  return (
    <div className={`cs-scene mt-3 desk:mx-auto desk:max-w-3xl ${play ? "cs-play" : ""}`}>
      <style>{CSS}</style>
      <svg viewBox="0 52 800 470" role="img" aria-label="Animation: a Unique Futsal player shoots and scores past the goalkeeper when you scroll down" className="block h-auto w-full">
        <defs>
          <linearGradient id="cs-jersey" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2f74ee" /><stop offset="1" stopColor="#1648ad" /></linearGradient>
          <linearGradient id="cs-side" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#0a2a78" stopOpacity=".5" /><stop offset=".25" stopColor="#0a2a78" stopOpacity="0" /><stop offset=".75" stopColor="#0a2a78" stopOpacity="0" /><stop offset="1" stopColor="#0a2a78" stopOpacity=".5" /></linearGradient>
          <linearGradient id="cs-shorts" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#cfd6e6" /></linearGradient>
          <linearGradient id="cs-skin" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#c28a60" /><stop offset=".45" stopColor="#e3b18a" /><stop offset="1" stopColor="#b9825a" /></linearGradient>
          <linearGradient id="cs-sock" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#164aa8" /><stop offset=".5" stopColor="#2c70ea" /><stop offset="1" stopColor="#164aa8" /></linearGradient>
          <linearGradient id="cs-depth" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#04361a" stopOpacity=".5" /><stop offset=".55" stopColor="#04361a" stopOpacity="0" /></linearGradient>
          <filter id="cs-blur" x="-30%" y="-80%" width="160%" height="260%"><feGaussianBlur stdDeviation="2" /></filter>
        </defs>

        {/* the advertising board behind the goal */}
        <rect x={TURF.tl - 8} y={TURF.top - 11} width={TURF.tr - TURF.tl + 16} height={11} fill="#0c0b5d" />
        <text x={400} y={TURF.top - 2.5} textAnchor="middle" fontFamily="Arial Black, Arial, sans-serif" fontWeight={900} fontSize={7.5} letterSpacing={3} fill="#fff">UNIQUE FUTSAL</text>
        <Goal />
        {Array.from({ length: STRIPES }, (_, i) => <polygon key={i} points={stripe(i)} fill={i % 2 ? "#2d9141" : "#38a84d"} />)}
        <polygon points={`${TURF.tl},${TURF.top} ${TURF.tr},${TURF.top} ${TURF.br},${TURF.bottom} ${TURF.bl},${TURF.bottom}`} fill="url(#cs-depth)" />
        <g fill="none" stroke="#fff" strokeOpacity={0.9} strokeWidth={3} strokeLinejoin="round">
          <polygon points={`${TURF.bl},${TURF.bottom} ${TURF.tl},${TURF.top} ${TURF.tr},${TURF.top} ${TURF.br},${TURF.bottom}`} />
          <polyline points={`${BOX_FAR.l + 34},${TURF.top} ${BOX_NEAR.l + 52},${TURF.top + 70} ${BOX_NEAR.r - 52},${TURF.top + 70} ${BOX_FAR.r - 34},${TURF.top}`} />
          <ellipse cx={400} cy={TURF.top + 70} rx={46} ry={11} strokeWidth={2} />
        </g>
        <circle cx={400} cy={TURF.top + 52} r={2.2} fill="#fff" />

        <Keeper />
        <Posts />

        {/* the ground shadow and the striker */}
        <g transform="translate(290 495) scale(1.7)"><Striker /></g>

        {/* the ball: it rests at his feet, then flies into the net */}
        <g transform={`translate(${BALL.x} ${BALL.y + 4})`}><ellipse rx={11} ry={3.4} fill="#000" opacity={0.28} /></g>
        <g className="cs-o cs-ball" style={{ transform: `translate(${BALL.x}px, ${BALL.y}px)` }}>
          <g className="cs-o cs-arc">
            <g className="cs-o cs-spin">
              <circle r={11} fill="#fff" stroke="#1a1a1a" strokeWidth={1.2} />
              <polygon points="0,-6 5.7,-1.8 3.5,5 -3.5,5 -5.7,-1.8" fill="#222" />
              <circle r={11} fill="url(#cs-ballshade)" />
            </g>
          </g>
        </g>

        <text className="cs-goaltxt" x={530} y={292} textAnchor="middle" fontFamily="Arial Black, Arial, sans-serif" fontWeight={900} fontSize={64} fill="#f97316" stroke="#fff" strokeWidth={6} paintOrder="stroke" style={{ opacity: 0 }}>GOAL!</text>
        <defs><radialGradient id="cs-ballshade" cx=".35" cy=".3" r=".8"><stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".28" /></radialGradient></defs>
      </svg>
    </div>
  );
}
