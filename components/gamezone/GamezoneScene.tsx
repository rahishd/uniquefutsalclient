// The animated Gamezone room that sits above the room features: two friends on the sofa play a football game on the big TV, then a goal goes in and
// they jump, high-five and clap. Pure SVG + CSS keyframes (no video or image files). One loop is 12 seconds; it holds still when the device has "reduce motion" on.
// The air conditioner (top right) blows cool air that curves down to the friends, speakers on the left and right edges send sound waves across the room,
// and the friends sit on the sofa facing the TV.
// Phases (percent of the loop): 0-48 playing, 49-66 goal and two jumps, 66-74 high-five, 74-88 hand clap, 88-100 sit back down.

const CSS = `
.gz-scene *{transform-box:fill-box}
.gz-scene g[transform]{transform-box:view-box;transform-origin:0 0}
.gz-kid{animation:gz-jump 12s ease-in-out infinite}
.gz-kid.b{animation-delay:.14s}
@keyframes gz-jump{0%,49%{transform:translateY(0)}53%{transform:translateY(-34px)}55.5%,59%{transform:translateY(0)}61.5%{transform:translateY(-34px)}64%,100%{transform:translateY(0)}}
.gz-head{transform-origin:center bottom;animation:gz-sway 12s ease-in-out infinite}
@keyframes gz-sway{0%,100%{transform:rotate(0)}10%{transform:rotate(-3deg)}20%{transform:rotate(3deg)}30%{transform:rotate(-2deg)}40%{transform:rotate(3deg)}50%{transform:rotate(0)}56%{transform:rotate(-6deg)}62%{transform:rotate(6deg)}70%{transform:rotate(0)}78%{transform:rotate(-5deg)}84%{transform:rotate(5deg)}90%{transform:rotate(0)}}
.gz-arm{transform-box:view-box;transform-origin:0 0}
.gz-arm.l{animation:gz-left 12s ease-in-out infinite}
.gz-arm.r{animation:gz-right 12s ease-in-out infinite}
.gz-arm.hl{animation:gz-hfl 12s ease-in-out infinite}
.gz-arm.hr{animation:gz-hfr 12s ease-in-out infinite}
.gz-kid.b .gz-arm{animation-delay:.14s}
@keyframes gz-left{0%{transform:rotate(14deg) scaleY(.55)}6%{transform:rotate(9deg) scaleY(.5)}12%{transform:rotate(16deg) scaleY(.58)}18%{transform:rotate(10deg) scaleY(.5)}24%{transform:rotate(15deg) scaleY(.56)}30%{transform:rotate(9deg) scaleY(.5)}36%{transform:rotate(16deg) scaleY(.58)}42%{transform:rotate(10deg) scaleY(.5)}49.5%{transform:rotate(14deg) scaleY(.55)}52%{transform:rotate(150deg) scaleY(1)}56%{transform:rotate(132deg) scaleY(1)}60%{transform:rotate(150deg) scaleY(1)}64%{transform:rotate(132deg) scaleY(1)}74%{transform:rotate(150deg) scaleY(1)}76%{transform:rotate(190deg) scaleY(1)}78%{transform:rotate(217deg) scaleY(1)}80%{transform:rotate(190deg) scaleY(1)}82%{transform:rotate(217deg) scaleY(1)}84%{transform:rotate(190deg) scaleY(1)}86%{transform:rotate(217deg) scaleY(1)}88%{transform:rotate(190deg) scaleY(1)}93%,100%{transform:rotate(14deg) scaleY(.55)}}
@keyframes gz-right{0%{transform:rotate(-14deg) scaleY(.55)}6%{transform:rotate(-9deg) scaleY(.5)}12%{transform:rotate(-16deg) scaleY(.58)}18%{transform:rotate(-10deg) scaleY(.5)}24%{transform:rotate(-15deg) scaleY(.56)}30%{transform:rotate(-9deg) scaleY(.5)}36%{transform:rotate(-16deg) scaleY(.58)}42%{transform:rotate(-10deg) scaleY(.5)}49.5%{transform:rotate(-14deg) scaleY(.55)}52%{transform:rotate(-150deg) scaleY(1)}56%{transform:rotate(-132deg) scaleY(1)}60%{transform:rotate(-150deg) scaleY(1)}64%{transform:rotate(-132deg) scaleY(1)}74%{transform:rotate(-150deg) scaleY(1)}76%{transform:rotate(-190deg) scaleY(1)}78%{transform:rotate(-217deg) scaleY(1)}80%{transform:rotate(-190deg) scaleY(1)}82%{transform:rotate(-217deg) scaleY(1)}84%{transform:rotate(-190deg) scaleY(1)}86%{transform:rotate(-217deg) scaleY(1)}88%{transform:rotate(-190deg) scaleY(1)}93%,100%{transform:rotate(-14deg) scaleY(.55)}}
@keyframes gz-hfl{0%{transform:rotate(14deg) scaleY(.55)}6%{transform:rotate(9deg) scaleY(.5)}12%{transform:rotate(16deg) scaleY(.58)}18%{transform:rotate(10deg) scaleY(.5)}24%{transform:rotate(15deg) scaleY(.56)}30%{transform:rotate(9deg) scaleY(.5)}36%{transform:rotate(16deg) scaleY(.58)}42%{transform:rotate(10deg) scaleY(.5)}49.5%{transform:rotate(14deg) scaleY(.55)}52%{transform:rotate(150deg) scaleY(1)}56%{transform:rotate(132deg) scaleY(1)}60%{transform:rotate(150deg) scaleY(1)}64%{transform:rotate(132deg) scaleY(1)}67%,73%{transform:rotate(171deg) scaleY(1)}76%{transform:rotate(190deg) scaleY(1)}78%{transform:rotate(217deg) scaleY(1)}80%{transform:rotate(190deg) scaleY(1)}82%{transform:rotate(217deg) scaleY(1)}84%{transform:rotate(190deg) scaleY(1)}86%{transform:rotate(217deg) scaleY(1)}88%{transform:rotate(190deg) scaleY(1)}93%,100%{transform:rotate(14deg) scaleY(.55)}}
@keyframes gz-hfr{0%{transform:rotate(-14deg) scaleY(.55)}6%{transform:rotate(-9deg) scaleY(.5)}12%{transform:rotate(-16deg) scaleY(.58)}18%{transform:rotate(-10deg) scaleY(.5)}24%{transform:rotate(-15deg) scaleY(.56)}30%{transform:rotate(-9deg) scaleY(.5)}36%{transform:rotate(-16deg) scaleY(.58)}42%{transform:rotate(-10deg) scaleY(.5)}49.5%{transform:rotate(-14deg) scaleY(.55)}52%{transform:rotate(-150deg) scaleY(1)}56%{transform:rotate(-132deg) scaleY(1)}60%{transform:rotate(-150deg) scaleY(1)}64%{transform:rotate(-132deg) scaleY(1)}67%,73%{transform:rotate(-171deg) scaleY(1)}76%{transform:rotate(-190deg) scaleY(1)}78%{transform:rotate(-217deg) scaleY(1)}80%{transform:rotate(-190deg) scaleY(1)}82%{transform:rotate(-217deg) scaleY(1)}84%{transform:rotate(-190deg) scaleY(1)}86%{transform:rotate(-217deg) scaleY(1)}88%{transform:rotate(-190deg) scaleY(1)}93%,100%{transform:rotate(-14deg) scaleY(.55)}}
.gz-ball{animation:gz-ball 4s linear infinite}
@keyframes gz-ball{0%{transform:translate(0,0)}20%{transform:translate(34px,-10px)}40%{transform:translate(58px,12px)}60%{transform:translate(20px,18px)}80%{transform:translate(-30px,-6px)}100%{transform:translate(0,0)}}
.gz-p{animation:gz-run 2.4s ease-in-out infinite alternate}
.gz-p.s{animation-duration:3.1s;animation-delay:-1s}
.gz-p.t{animation-duration:2.7s;animation-delay:-.4s;animation-direction:alternate-reverse}
@keyframes gz-run{from{transform:translate(-9px,2px)}to{transform:translate(11px,-3px)}}
.gz-flash{opacity:0;animation:gz-flash 12s linear infinite}
@keyframes gz-flash{0%,48.5%{opacity:0}49.5%{opacity:.75}53%{opacity:.18}60%{opacity:.1}66%,100%{opacity:0}}
.gz-goal{opacity:0;transform-origin:center;animation:gz-goal 12s ease-out infinite}
@keyframes gz-goal{0%,49%{opacity:0;transform:scale(.4)}51%{opacity:1;transform:scale(1.25)}53%{opacity:1;transform:scale(1)}65%{opacity:1;transform:scale(1)}68%,100%{opacity:0;transform:scale(1)}}
.gz-say{opacity:0;transform-origin:center bottom;animation:gz-say 12s ease-out infinite}
.gz-say.b{animation-delay:.14s}
@keyframes gz-say{0%,50%{opacity:0;transform:scale(.5)}53%{opacity:1;transform:scale(1.1)}55%,64%{opacity:1;transform:scale(1)}67%,100%{opacity:0;transform:scale(1)}}
.gz-conf{opacity:0;animation:gz-conf 12s ease-in infinite}
@keyframes gz-conf{0%,49.5%{opacity:0;transform:translateY(-14px) rotate(0)}51%{opacity:1}72%{opacity:1;transform:translateY(120px) rotate(300deg)}76%,100%{opacity:0;transform:translateY(130px) rotate(330deg)}}
.gz-wave{transform-box:fill-box;transform-origin:center;opacity:0;animation:gz-wave 3.2s ease-out infinite}
@keyframes gz-wave{0%{opacity:0;transform:translateX(0) scaleY(.55)}12%{opacity:.95}100%{opacity:0;transform:translateX(var(--wx)) scaleY(1.7)}}
.gz-pump{transform-box:fill-box;transform-origin:center;animation:gz-pump .5s ease-in-out infinite alternate}
@keyframes gz-pump{from{transform:scale(1)}to{transform:scale(1.2)}}
.gz-note{opacity:0;animation:gz-note 4.2s linear infinite}
@keyframes gz-note{0%{opacity:0;transform:translate(0,0)}15%{opacity:.95}100%{opacity:0;transform:translate(var(--nx),-58px)}}
.gz-mist{animation:gz-mist 3s ease-in-out infinite alternate}
@keyframes gz-mist{from{opacity:.5}to{opacity:1}}
.gz-flake{opacity:0;animation:gz-flake 3.4s linear infinite}
@keyframes gz-flake{0%{opacity:0;transform:translate(0,0)}15%{opacity:.95}100%{opacity:0;transform:translate(8px,96px)}}
.gz-led{animation:gz-glow 1.2s ease-in-out infinite alternate}
.gz-glow{animation:gz-glow 5s ease-in-out infinite alternate}
@keyframes gz-glow{from{opacity:.55}to{opacity:.95}}
@media (prefers-reduced-motion: reduce){.gz-smil{display:none}.gz-scene *{animation:none!important}.gz-flash,.gz-goal,.gz-say,.gz-conf{opacity:0!important}}
`;

const CONFETTI: [number, number, string, number][] = [
  [178, 150, "#ff5a5f", 0], [205, 120, "#ffd23f", 0.1], [232, 160, "#3ddc97", 0.2], [258, 118, "#4dabf7", 0.05], [286, 152, "#ff9f1c", 0.3],
  [312, 124, "#ff5a5f", 0.15], [338, 158, "#ffd23f", 0.25], [196, 176, "#4dabf7", 0.35], [270, 176, "#3ddc97", 0.12], [324, 182, "#ff9f1c", 0.4],
];

// One friend seen from behind: head, shoulders and two arms (the arm origin is the shoulder, so the arms swing from it)
function Kid({ cx, headY, shirt, hair, big, b, arms, lean, tilt }: { cx: number; headY: number; shirt: string; hair: string; big?: boolean; b?: boolean; arms: [string, string]; lean: number; tilt: number }) {
  const r = big ? 28 : 26;
  const w = big ? 90 : 84;
  const top = headY + r - 3; // the shoulder line: the back of the head overlaps it, so the head always sits on the body
  const sh = top + 20;
  const reach = big ? 40 : 38;
  const arm = (x: number, cls: string) => (
    <g transform={`translate(${x} ${sh})`}>
      <g className={`gz-arm ${cls}`}>
        <rect x={-8} y={-4} width={16} height={56} rx={8} fill={shirt} />
        <circle cx={0} cy={54} r={8.5} fill="#e0a878" />
      </g>
    </g>
  );
  return (
    <g transform={`rotate(${lean} ${cx} 372)`}>
    <g className={`gz-kid${b ? " b" : ""}`}>
      {/* shoulders and back */}
      <path d={`M ${cx - w / 2} ${top + 120} L ${cx - w / 2} ${top + 22} Q ${cx - w / 2} ${top + 4} ${cx - 30} ${top + 1} Q ${cx} ${top - 7} ${cx + 30} ${top + 1} Q ${cx + w / 2} ${top + 4} ${cx + w / 2} ${top + 22} L ${cx + w / 2} ${top + 120} Z`} fill={shirt} />
      <path d={`M ${cx - 22} ${top + 2} Q ${cx} ${top + 14} ${cx + 22} ${top + 2}`} fill="none" stroke="#000" strokeOpacity={0.2} strokeWidth={3} strokeLinecap="round" />
      {/* neck */}
      <path d={`M ${cx - 11} ${headY + r - 10} L ${cx - 14} ${top + 5} L ${cx + 14} ${top + 5} L ${cx + 11} ${headY + r - 10} Z`} fill="#c98f5f" />
      {arm(cx - reach, arms[0])}
      {arm(cx + reach, arms[1])}
      <g transform={`rotate(${tilt} ${cx} ${headY + r})`}>
      <g className="gz-head">
        <ellipse cx={cx - r + 2} cy={headY + 6} rx={4.2} ry={6} fill="#d3996a" />
        <ellipse cx={cx + r - 2} cy={headY + 6} rx={4.2} ry={6} fill="#d3996a" />
        <ellipse cx={cx} cy={headY} rx={r - 1.5} ry={r + 1} fill={hair} />
        <path d={`M ${cx - r + 5} ${headY + 10} Q ${cx} ${headY + r + 6} ${cx + r - 5} ${headY + 10} L ${cx + r - 8} ${headY + r - 2} Q ${cx} ${headY + r + 4} ${cx - r + 8} ${headY + r - 2} Z`} fill="#000" opacity={0.22} />
        <path d={`M ${cx - 12} ${headY - r + 6} Q ${cx} ${headY - r + 1} ${cx + 12} ${headY - r + 6}`} fill="none" stroke="#fff" strokeOpacity={0.14} strokeWidth={3} strokeLinecap="round" />
      </g>
      </g>
    </g>
    </g>
  );
}

function Say({ x, y, text, b }: { x: number; y: number; text: string; b?: boolean }) {
  const w = text.length * 8.6 + 20;
  return (
    <g className={`gz-say${b ? " b" : ""}`}>
      <rect x={x - w / 2} y={y - 22} width={w} height={26} rx={13} fill="#ffffff" />
      <path d={`M ${x - 6} ${y + 3} L ${x} ${y + 11} L ${x + 6} ${y + 3} Z`} fill="#ffffff" />
      <text x={x} y={y - 4} textAnchor="middle" fontFamily="Poppins, Arial, sans-serif" fontWeight={800} fontSize={14} fill="#0c0b5d">{text}</text>
    </g>
  );
}

export default function GamezoneScene() {
  return (
    <div className="gz-scene mt-3 overflow-hidden rounded-2xl bg-black desk:mx-auto desk:max-w-3xl">
      <style>{CSS}</style>
      <svg viewBox="0 0 640 360" role="img" aria-label="Animation: two friends on the sofa play a football game on the big TV, score a goal, jump, high-five and clap" className="block h-auto w-full">
        <defs>
          <linearGradient id="gz-wall" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#6e625a" /><stop offset="1" stopColor="#38312c" /></linearGradient>
          <radialGradient id="gz-vig" cx=".55" cy=".6" r=".8"><stop offset=".45" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".8" /></radialGradient>
          <radialGradient id="gz-tvglow" cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#6fb5ff" stopOpacity=".45" /><stop offset="1" stopColor="#6fb5ff" stopOpacity="0" /></radialGradient>
          <linearGradient id="gz-pitch" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2f9e44" /><stop offset="1" stopColor="#1f7a33" /></linearGradient>
          <linearGradient id="gz-streak" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#cfeaff" stopOpacity="0" /><stop offset="1" stopColor="#f4fbff" stopOpacity=".95" /></linearGradient>
          <linearGradient id="gz-cone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#d6eeff" stopOpacity=".34" /><stop offset="1" stopColor="#d6eeff" stopOpacity="0" /></linearGradient>
          <linearGradient id="gz-sofa" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#dcb85f" /><stop offset="1" stopColor="#b48c36" /></linearGradient>
          <filter id="gz-soft" x="-60%" y="-20%" width="220%" height="140%"><feGaussianBlur stdDeviation="1.6" /></filter>
          <filter id="gz-soft2" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="7" /></filter>
        </defs>

        {/* wall, carpet, glow of the TV on the wall */}
        <rect width="640" height="360" fill="url(#gz-wall)" />
        <rect y="318" width="640" height="42" fill="#1b2a52" />
        <ellipse cx="326" cy="160" rx="210" ry="130" fill="url(#gz-tvglow)" className="gz-glow" />

        {/* curtain */}
        <rect x="0" y="0" width="74" height="330" fill="#d9cf8f" />
        {[60, 100, 140, 190, 235, 270].map((y, i) => <rect key={y} x="0" y={y} width="74" height={i % 2 ? 8 : 14} fill={i % 2 ? "#c3874f" : "#a34b3b"} opacity=".85" />)}
        <rect x="0" y="0" width="74" height="26" fill="#9a7b5c" />
        <rect x="68" y="0" width="6" height="330" fill="#000" opacity=".18" />

        {/* air conditioner on the wall, top right (its wind is drawn later, in front of the TV) */}
        <g>
          <rect x="462" y="32" width="132" height="36" rx="9" fill="#f2f4f7" />
          <rect x="462" y="32" width="132" height="9" rx="4.5" fill="#ffffff" opacity=".8" />
          <rect x="472" y="59" width="112" height="5" rx="2.5" fill="#bcc4cf" />
          <circle cx="576" cy="46" r="2.6" fill="#35d07f" className="gz-led" />
          <text x="480" y="50" fontFamily="Arial, sans-serif" fontWeight={700} fontSize="9" fill="#5a86c9">AC · 18°</text>
        </g>

        {/* camera and wall plate */}
        <rect x="150" y="30" width="22" height="22" rx="3" fill="#cfcfcf" />
        <circle cx="161" cy="41" r="6" fill="#222" />

        {/* music: a speaker on each edge of the room; sound waves travel from the left one to the right and from the right one to the left, and notes float up */}
        {[[8, 36, 1, 190], [606, 604, 0, -190]].map(([x, ox, dir, wx]) => (
          <g key={x}>
            {[0, 1, 2, 3].map((i) => (
              <path key={i} className="gz-wave" d={`M ${ox} 138 A 18 18 0 0 ${dir} ${ox} 178`} fill="none" stroke="#7cc4ff" strokeWidth="3" strokeLinecap="round" style={{ ["--wx" as string]: `${wx}px`, animationDelay: `${i * 0.8}s` }} />
            ))}
            <rect x={x} y="116" width="26" height="84" rx="5" fill="#1b1d22" />
            <rect x={x} y="116" width="26" height="84" rx="5" fill="none" stroke="#3a3e46" strokeWidth="1.2" />
            <circle cx={x + 13} cy="134" r="5" fill="#2b2e35" />
            <circle cx={x + 13} cy="134" r="2.2" fill="#5b6270" />
            <circle cx={x + 13} cy="170" r="10.5" fill="#2b2e35" />
            <circle cx={x + 13} cy="170" r="6.5" fill="#434852" className="gz-pump" />
            {[["♪", 0], ["♫", 2.2]].map(([n, d], i) => (
              <text key={i} x={x + 5} y="108" fontSize="17" fill="#cfe8ff" className="gz-note" style={{ ["--nx" as string]: dir ? "10px" : "-10px", animationDelay: `${d}s` }}>{n}</text>
            ))}
          </g>
        ))}

        {/* the shelf and the TV, scaled a little */}
        <g transform="translate(326 222) scale(1.08) translate(-410 -222)">
        {/* wooden TV shelf, game discs, console and headset */}
        <rect x="300" y="222" width="228" height="12" rx="2" fill="#7a4326" />
        <rect x="302" y="234" width="8" height="90" fill="#6a3a22" />
        <rect x="518" y="234" width="8" height="90" fill="#6a3a22" />
        <rect x="320" y="212" width="26" height="10" rx="1.5" fill="#2f6fd6" />
        <rect x="372" y="214" width="26" height="8" rx="1.5" fill="#2f6fd6" />
        <rect x="448" y="200" width="56" height="22" rx="4" fill="#f4f4f4" />
        <rect x="452" y="214" width="48" height="5" rx="2" fill="#c9c9c9" />
        <path d="M 310 150 q -4 -22 12 -26" fill="none" stroke="#111" strokeWidth="3" />
        <rect x="306" y="144" width="9" height="20" rx="4.5" fill="#111" />

        {/* the TV, playing football */}
        <rect x="324" y="96" width="184" height="112" rx="3" fill="#0b0b0f" />
        <g>
          <rect x="329" y="101" width="174" height="102" fill="url(#gz-pitch)" />
          {[0, 1, 2, 3, 4, 5].map((i) => i % 2 === 0 && <rect key={i} x={329 + i * 29} y="101" width="29" height="102" fill="#000" opacity=".08" />)}
          <rect x="333" y="106" width="166" height="92" fill="none" stroke="#fff" strokeOpacity=".75" strokeWidth="1.2" />
          <line x1="416" y1="106" x2="416" y2="198" stroke="#fff" strokeOpacity=".75" strokeWidth="1.2" />
          <circle cx="416" cy="152" r="14" fill="none" stroke="#fff" strokeOpacity=".75" strokeWidth="1.2" />
          <rect x="333" y="134" width="14" height="36" fill="none" stroke="#fff" strokeOpacity=".75" strokeWidth="1.2" />
          <rect x="485" y="134" width="14" height="36" fill="none" stroke="#fff" strokeOpacity=".75" strokeWidth="1.2" />
          {/* the players: three in blue, three in red */}
          {[[372, 128, "#2f6fd6", ""], [396, 168, "#2f6fd6", "s"], [440, 140, "#2f6fd6", "t"], [392, 140, "#e03131", "s"], [436, 174, "#e03131", ""], [462, 150, "#e03131", "t"]].map(([x, y, c, k], i) => (
            <g key={i} className={`gz-p ${k}`}>
              <circle cx={x as number} cy={(y as number) - 5} r="2.6" fill="#f1c9a0" />
              <rect x={(x as number) - 2.6} y={(y as number) - 2} width="5.2" height="7" rx="1.5" fill={c as string} />
            </g>
          ))}
          <g className="gz-ball"><circle cx="410" cy="152" r="3.4" fill="#fff" stroke="#111" strokeWidth=".8" /></g>
          <rect x="400" y="102" width="32" height="9" rx="2" fill="#000" opacity=".55" />
          <text x="416" y="109" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight={700} fontSize="7.5" fill="#fff">1 : 0</text>
          <rect x="329" y="101" width="174" height="102" fill="#fff" className="gz-flash" />
          <g className="gz-goal">
            <text x="416" y="160" textAnchor="middle" fontFamily="Impact, Arial Black, sans-serif" fontSize="30" fill="#ffd23f" stroke="#0c0b5d" strokeWidth="3" paintOrder="stroke">GOAL!</text>
          </g>
        </g>
        </g>

        {/* the AC's cool air: soft streaks of wind curve down the right side of the TV and flow towards the friends */}
        <g className="gz-smil">
          {["M 520 70 C 566 130 476 222 312 238","M 540 70 C 590 150 456 238 218 248","M 500 70 C 530 138 436 212 300 226","M 530 70 C 578 136 492 244 340 252"].map((d, p) => (
            <path key={"m" + p} d={d} fill="none" stroke="#d6eeff" strokeOpacity=".16" strokeWidth="22" strokeLinecap="round" filter="url(#gz-soft2)" className="gz-mist" />
          ))}
          {Array.from({ length: 12 }, (_, i) => (
            <g key={i} opacity="0">
              <path d="M -26 0 C -12 -3 12 -3 26 0 C 12 3 -12 3 -26 0 Z" fill="url(#gz-streak)" filter="url(#gz-soft)" transform={`scale(${0.9 + (i % 3) * 0.25} ${0.9 + (i % 4) * 0.3})`} />
              <animateMotion dur="3.2s" begin={`${-i * 0.27}s`} repeatCount="indefinite" rotate="auto" path={["M 520 70 C 566 130 476 222 312 238","M 540 70 C 590 150 456 238 218 248","M 500 70 C 530 138 436 212 300 226","M 530 70 C 578 136 492 244 340 252"][i % 4]} />
              <animate attributeName="opacity" dur="3.2s" begin={`${-i * 0.27}s`} repeatCount="indefinite" values="0;0.95;0.95;0" keyTimes="0;0.15;0.8;1" />
            </g>
          ))}
          {Array.from({ length: 5 }, (_, i) => (
            <circle key={"f" + i} r="1.8" fill="#eaf7ff" opacity="0">
              <animateMotion dur="3.6s" begin={`${-i * 0.7}s`} repeatCount="indefinite" path={["M 520 70 C 566 130 476 222 312 238","M 540 70 C 590 150 456 238 218 248","M 500 70 C 530 138 436 212 300 226","M 530 70 C 578 136 492 244 340 252"][(i + 1) % 4]} />
              <animate attributeName="opacity" dur="3.6s" begin={`${-i * 0.7}s`} repeatCount="indefinite" values="0;0.9;0.9;0" keyTimes="0;0.15;0.8;1" />
            </circle>
          ))}
        </g>

        {/* the sofa faces the TV: its seat and arms stretch away from us on both sides of the friends, the backrest is in front of them */}
        <rect x="84" y="262" width="372" height="50" rx="14" fill="#b8933f" />
        <rect x="84" y="262" width="372" height="8" rx="4" fill="#d6b45c" opacity=".7" />
        <rect x="32" y="232" width="56" height="130" rx="22" fill="#9a7829" />
        <rect x="40" y="238" width="40" height="110" rx="16" fill="#b9953f" />
        <rect x="452" y="232" width="56" height="130" rx="22" fill="#9a7829" />
        <rect x="460" y="238" width="40" height="110" rx="16" fill="#b9953f" />

        {/* the two friends, chilled, facing the TV */}
        <Kid cx={205} headY={228} shirt="#6e7f78" hair="#2a1d17" arms={["l", "hr"]} lean={3} tilt={-6} />
        <Kid cx={308} headY={234} shirt="#4d6280" hair="#1d1612" big b arms={["hl", "r"]} lean={-3} tilt={5} />

        {/* the backrest, in front of them */}
        <rect x="38" y="300" width="464" height="74" rx="30" fill="url(#gz-sofa)" />
        <rect x="38" y="300" width="464" height="10" rx="5" fill="#e4c677" opacity=".8" />
        {[100, 170, 240, 310, 380, 450].map((x) => <circle key={x} cx={x} cy={334} r="5" fill="#9a7829" opacity=".7" />)}

        {/* cheers and confetti */}
        <Say x={205} y={166} text="Goal!" />
        <Say x={308} y={172} text="Yesss!" b />
        {CONFETTI.map(([x, y, c, d], i) => <rect key={i} x={x} y={y} width="7" height="11" rx="1.5" fill={c} className="gz-conf" style={{ animationDelay: `${d}s` }} />)}

        {/* a cinematic vignette: the corners fall away, the TV and the players stay bright */}
        <rect width="640" height="360" fill="url(#gz-vig)" pointerEvents="none" />
      </svg>
    </div>
  );
}
