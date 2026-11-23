"use client";

import { memo, useMemo } from "react";
import { COLORS, COLOR_NAMES, LANE, SAFE_ABS, STAR_ABS, START_OFFSET, TRACK, YARD, cellCenter } from "@/lib/ludo-board";

// The Ludo board (SVG, 15 x 15 units) and the tokens on it. It only draws the positions it is given and reports which
// token the player tapped; the server decides which moves are legal.

export interface BoardProps {
  tokens: number[][]; // [seat][token] positions as the server counts them
  colors: number[]; // colour index (0 red, 1 green, 2 yellow, 3 blue) of each seat
  legal?: number[]; // tokens of `mySeat` that may move now
  mySeat?: number | null;
  onPick?: (token: number) => void;
  hitKey?: string; // changes when a capture happens, to flash the square
  hitAt?: [number, number] | null;
  turnSeat?: number | null;
  label?: string;
}

const star = (cx: number, cy: number, r: number) => {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.45;
    pts.push(`${(cx + Math.cos(a) * rr).toFixed(3)},${(cy + Math.sin(a) * rr).toFixed(3)}`);
  }
  return pts.join(" ");
};

const BoardBase = memo(function BoardBase() {
  const startCells = useMemo(() => START_OFFSET.map((o, ci) => ({ ci, cell: TRACK[o] })), []);
  return (
    <g>
      <rect x="0" y="0" width="15" height="15" rx="0.7" fill="#fbfcff" />
      {/* the four yards */}
      {[0, 1, 2, 3].map((ci) => {
        const x = ci === 0 || ci === 3 ? 0 : 9, y = ci < 2 ? 0 : 9;
        const c = COLORS[COLOR_NAMES[ci]];
        return (
          <g key={ci}>
            <rect x={x} y={y} width="6" height="6" fill={`url(#lu-y${ci})`} rx={ci === 0 ? 0.7 : 0} />
            <rect x={x + 0.9} y={y + 0.9} width="4.2" height="4.2" rx="0.9" fill="#ffffff" fillOpacity="0.92" />
            {YARD[ci].map(([cx, cy], k) => (
              <g key={k}>
                <circle cx={cx} cy={cy} r="0.62" fill={c.soft} stroke={c.main} strokeWidth="0.1" />
                <circle cx={cx} cy={cy} r="0.32" fill={c.main} fillOpacity="0.18" />
              </g>
            ))}
          </g>
        );
      })}
      {/* shared track */}
      {TRACK.map(([c, r], i) => (
        <rect key={i} x={c + 0.04} y={r + 0.04} width="0.92" height="0.92" rx="0.12" fill="#ffffff" stroke="#c9d2ea" strokeWidth="0.05" />
      ))}
      {/* home lanes */}
      {LANE.map((cells, ci) => cells.map(([c, r], k) => (
        <rect key={`${ci}-${k}`} x={c + 0.04} y={r + 0.04} width="0.92" height="0.92" rx="0.12" fill={COLORS[COLOR_NAMES[ci]].main} fillOpacity={0.55 + k * 0.09} stroke="#ffffff" strokeWidth="0.05" />
      )))}
      {/* start squares carry the colour */}
      {startCells.map(({ ci, cell: [c, r] }) => (
        <g key={ci}>
          <rect x={c + 0.04} y={r + 0.04} width="0.92" height="0.92" rx="0.12" fill={COLORS[COLOR_NAMES[ci]].main} stroke="#ffffff" strokeWidth="0.05" />
          <polygon points={star(c + 0.5, r + 0.5, 0.32)} fill="#ffffff" fillOpacity="0.9" />
        </g>
      ))}
      {/* the star squares: safe */}
      {STAR_ABS.map((i) => {
        const [c, r] = TRACK[i];
        return (
          <g key={i}>
            <rect x={c + 0.04} y={r + 0.04} width="0.92" height="0.92" rx="0.12" fill="#eef2ff" stroke="#c9d2ea" strokeWidth="0.05" />
            <polygon points={star(c + 0.5, r + 0.5, 0.33)} fill="#7c8bb8" />
          </g>
        );
      })}
      {/* the middle: four triangles */}
      <g>
        <polygon points="6,6 9,6 7.5,7.5" fill={COLORS.green.main} />
        <polygon points="9,6 9,9 7.5,7.5" fill={COLORS.yellow.main} />
        <polygon points="9,9 6,9 7.5,7.5" fill={COLORS.blue.main} />
        <polygon points="6,9 6,6 7.5,7.5" fill={COLORS.red.main} />
        <circle cx="7.5" cy="7.5" r="0.32" fill="#ffffff" />
      </g>
    </g>
  );
});

const stackOffsets = (n: number): [number, number][] => {
  if (n === 1) return [[0, 0]];
  if (n === 2) return [[-0.2, 0], [0.2, 0]];
  if (n === 3) return [[-0.2, 0.14], [0.2, 0.14], [0, -0.2]];
  return [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]];
};

export default function Board({ tokens, colors, legal = [], mySeat = null, onPick, hitKey, hitAt, turnSeat, label }: BoardProps) {
  // tokens that share a square are spread a little so each stays visible and tappable
  const placed = useMemo(() => {
    const groups = new Map<string, { seat: number; t: number }[]>();
    tokens.forEach((row, seat) => row.forEach((pos, t) => {
      const [x, y] = cellCenter(colors[seat], pos, t);
      const key = pos < 0 ? `y${seat}-${t}` : `${x.toFixed(2)},${y.toFixed(2)}`;
      (groups.get(key) ?? groups.set(key, []).get(key)!).push({ seat, t });
    }));
    const out: { seat: number; t: number; x: number; y: number; s: number }[] = [];
    groups.forEach((g) => {
      const off = stackOffsets(g.length);
      g.forEach(({ seat, t }, i) => {
        const [x, y] = cellCenter(colors[seat], tokens[seat][t], t);
        const home = tokens[seat][t] >= 56;
        out.push({ seat, t, x: x + (home ? 0 : off[i][0]), y: y + (home ? 0 : off[i][1]), s: home ? 0.5 : g.length > 1 ? 0.72 : 1 });
      });
    });
    return out.sort((a, b) => a.y - b.y || a.x - b.x);
  }, [tokens, colors]);

  return (
    <svg viewBox="0 0 15 15" className="lu-board" role="img" aria-label={label ?? "Ludo board"}>
      <defs>
        {[0, 1, 2, 3].map((ci) => (
          <linearGradient key={ci} id={`lu-y${ci}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={COLORS[COLOR_NAMES[ci]].light} />
            <stop offset="1" stopColor={COLORS[COLOR_NAMES[ci]].main} />
          </linearGradient>
        ))}
        {[0, 1, 2, 3].map((ci) => (
          <radialGradient key={ci} id={`lu-t${ci}`} cx="0.35" cy="0.3" r="0.8">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="0.35" stopColor={COLORS[COLOR_NAMES[ci]].light} />
            <stop offset="1" stopColor={COLORS[COLOR_NAMES[ci]].dark} />
          </radialGradient>
        ))}
        <filter id="lu-sh" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="0.08" stdDeviation="0.07" floodColor="#0b1030" floodOpacity="0.55" /></filter>
      </defs>
      <BoardBase />
      {hitAt && <circle key={hitKey} className="lu-flash" cx={hitAt[0]} cy={hitAt[1]} r="0.55" fill="#ffffff" stroke="#fb7185" strokeWidth="0.12" />}
      {placed.map(({ seat, t, x, y, s }) => {
        const ci = colors[seat];
        const isLegal = seat === mySeat && legal.includes(t);
        const myTurn = turnSeat === seat;
        return (
          <g
            key={`${seat}-${t}`}
            className={`lu-token${isLegal ? " legal" : ""}`}
            style={{ transform: `translate(${x}px, ${y}px)` }}
            onClick={isLegal && onPick ? () => onPick(t) : undefined}
            role={isLegal ? "button" : undefined}
            tabIndex={isLegal ? 0 : undefined}
            aria-label={isLegal ? `Move ${COLORS[COLOR_NAMES[ci]].name} token ${t + 1}` : undefined}
            onKeyDown={isLegal && onPick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(t); } } : undefined}
          >
            {isLegal && <circle className="halo" r="0.62" fill="none" stroke="#facc15" strokeWidth="0.1" />}
            <g transform={`scale(${s})`}>
              <g className="body" filter="url(#lu-sh)">
                <circle r="0.42" fill={`url(#lu-t${ci})`} stroke="#ffffff" strokeWidth="0.09" />
                <circle r="0.2" fill="none" stroke="#ffffff" strokeOpacity={myTurn ? 0.95 : 0.55} strokeWidth="0.06" />
              </g>
            </g>
            {isLegal && <circle r="0.7" fill="transparent" />}
          </g>
        );
      })}
    </svg>
  );
}

export { SAFE_ABS };
