"use client";

import { useEffect, useState } from "react";

// An animated layer over the car picture. It follows what the customer really does in the app:
//   idle       the charging post waits with the gun on its holder
//   plugging   (Start charging) a boy walks to the post, takes the charging gun, walks to the car and plugs it in the rear port
//   settling   he walks to a stool next to the car and sits down to wait
//   charging   he waits and dozes off (Zzz) while power flows along the cable and the battery fills
//   unplugging (Stop charging) he wakes up with a start, stretches, pulls the gun out, hangs it back on the post and gives a thumbs up
//   leaving    he walks to the driver door, opens it, gets in, the lights blink and the car drives away
//   arriving   the next car rolls in and parks
// He smiles all the time. Pure SVG animation (SMIL), no video or image files, drawn in a 900 x 320 box that matches the card.
// With "reduce motion" on, the charging state is shown still.
export type SceneMode = "idle" | "plugging" | "settling" | "charging" | "unplugging" | "leaving" | "arriving";

export const PLUG_SECONDS = 5.0;
export const SETTLE_SECONDS = 1.2;
export const UNPLUG_SECONDS = 5.6;
export const LEAVE_SECONDS = 6.4;
export const ARRIVE_SECONDS = 2.6;

const GROUND = 300;
// the car picture (740 x 400) sits on the right of the stage at this offset and scale
const OX = 391, OY = 51, S = 0.657;
const P = (x: number, y: number) => `${(OX + x * S).toFixed(1)},${(OY + y * S).toFixed(1)}`;
const pts = (list: [number, number][]) => list.map(([x, y]) => P(x, y)).join(" ");
// the front (driver) door in picture coordinates: the window part and the painted part. Hinged at its front edge.
const DOOR_WINDOW: [number, number][] = [[190, 66], [262, 68], [298, 140], [188, 110]];
const DOOR_BODY: [number, number][] = [[188, 110], [298, 140], [301, 200], [292, 262], [190, 254]];
const DOOR_ALL: [number, number][] = [[190, 66], [262, 68], [298, 140], [301, 200], [292, 262], [190, 254]];
// open: the hinge (front) edge stays, the rear edge swings out towards the viewer, so it looks narrower and taller
const DOOR_WINDOW_OPEN: [number, number][] = [[234, 50], [262, 68], [298, 140], [232, 106]];
const DOOR_BODY_OPEN: [number, number][] = [[232, 106], [298, 140], [301, 200], [292, 262], [234, 274]];
const HANDLE_X = 445; // where the boy stands to open the driver door
const DOOR_X = 522; // the doorway he climbs into
const PORT = { x: OX + 94.4 * S, y: OY + 184 * S }; // the charging port on the car's rear side
const HOLSTER = { x: 118, y: 190 }; // where the gun hangs on the post (the cable starts here)
const GRAB_X = 48; // where the boy stands to take the gun
const CAR_X = 316; // where the boy stands to plug in
const STOOL_X = 225;
const BOY_K = 2.2; // the boy is drawn 110 units tall, so this makes him as tall as the post
const SEAT_K = 2.1;
const SEAT_Y = GROUND - 29 * SEAT_K; // the stool's seat (its legs are 29 units long before scaling)
// arm angles for this size, worked out from where his shoulder is to what he reaches
const ARM_PORT = -73; // gun tip in the port
const ARM_HOLSTER = -47; // hand on the gun on the post
const TIP_WALK = (x: number) => `${(x + 4 * BOY_K + 77).toFixed(0)},243`; // gun tip while he carries it
const KIT = "#ff7a00";
const NAVY = "#0c0b5d";
const SKIN = "#f6c9a3";
const BOLT = "M0 -11 L-6 2 L0 2 L-3 12 L7 -3 L1 -3 Z";

type KF = [number, string | number]; // [time in seconds, value]
const kt = (kf: KF[], T: number) => kf.map(([t]) => (t / T).toFixed(4)).join(";");
const vals = (kf: KF[]) => kf.map(([, v]) => v).join(";");

// the cable runs from the post to the gun tip at (ex, ey) and droops towards the ground
const cableD = (ex: number, ey: number) => {
  const dx = ex - HOLSTER.x;
  return `M${HOLSTER.x} ${HOLSTER.y} C ${(HOLSTER.x + dx * 0.3).toFixed(0)} ${GROUND - 4}, ${(HOLSTER.x + dx * 0.72).toFixed(0)} ${Math.min(GROUND - 4, ey + 80)}, ${ex} ${ey}`;
};

function Gun({ opacity = 1 }: { opacity?: number }) {
  return (
    <g opacity={opacity}>
      <rect x="1" y="-41" width="7" height="14" rx="3" fill={NAVY} />
      <rect x="0.5" y="-28" width="8" height="10" rx="2" fill="#1d1c8f" />
      <rect x="2" y="-20" width="5" height="5" rx="1" fill="#fbbf24" />
    </g>
  );
}

function Post({ gunOnPost }: { gunOnPost: { hide?: number; show?: number } | boolean }) {
  return (
    <g>
      <ellipse cx="86" cy={GROUND} rx="44" ry="6" fill="#0f172a" opacity="0.18" />
      <rect x="56" y={GROUND - 10} width="60" height="10" rx="4" fill="#1e1b4b" />
      <rect x="60" y={GROUND - 244} width="52" height="236" rx="16" fill={NAVY} />
      <rect x="60" y={GROUND - 244} width="14" height="236" rx="7" fill="#ffffff" opacity="0.08" />
      {/* screen with a softly glowing bolt */}
      <rect x="69" y={GROUND - 224} width="34" height="50" rx="8" fill="#1d1c8f" />
      <rect x="73" y={GROUND - 220} width="26" height="42" rx="6" fill="#0f172a" />
      <path d={BOLT} transform={`translate(86 ${GROUND - 199}) scale(1.5)`} fill="#fbbf24">
        <animate attributeName="opacity" values="1;0.45;1" dur="2s" repeatCount="indefinite" />
      </path>
      <rect x="74" y={GROUND - 160} width="24" height="4" rx="2" fill="#38bdf8" opacity="0.8" />
      <rect x="74" y={GROUND - 150} width="16" height="4" rx="2" fill="#38bdf8" opacity="0.5" />
      {/* the holder for the gun */}
      <rect x="110" y={HOLSTER.y - 14} width="18" height="44" rx="6" fill="#111827" />
      {/* the gun on its holder */}
      <g transform={`translate(${HOLSTER.x - 4.5 * BOY_K} ${HOLSTER.y + 17.5 * BOY_K}) scale(${BOY_K})`} opacity={gunOnPost === false ? 0 : 1}>
        <Gun />
        {typeof gunOnPost === "object" && gunOnPost.hide !== undefined && <set attributeName="opacity" to="0" begin={`${gunOnPost.hide}s`} fill="freeze" />}
        {typeof gunOnPost === "object" && gunOnPost.show !== undefined && <animate attributeName="opacity" values="0;1" keyTimes="0;1" begin={`${gunOnPost.show}s`} dur="0.01s" fill="freeze" />}
      </g>
    </g>
  );
}

// the charging port with its flap and LED
function PortBox({ open, led, flap, ledAt }: { open: boolean; led: "off" | "on"; flap?: KF[]; ledAt?: KF[] }) {
  return (
    <g transform={`translate(${PORT.x} ${PORT.y})`}>
      <rect x="-10" y="-8" width="20" height="16" rx="5" fill="#111827" />
      <circle cx="0" cy="0" r="3.2" fill={led === "on" ? "#22c55e" : "#ef4444"}>
        {ledAt && <animate attributeName="fill" values={vals(ledAt)} keyTimes={kt(ledAt, ledAt[ledAt.length - 1][0])} dur={`${ledAt[ledAt.length - 1][0]}s`} fill="freeze" calcMode="discrete" />}
      </circle>
      <g>
        <rect x="-10" y="-9" width="20" height="5" rx="2" fill="#e5e7eb" stroke="#64748b" strokeWidth="0.8" transform={open ? "rotate(-70 -10 -7)" : undefined} />
        {flap && <animateTransform attributeName="transform" type="rotate" values={flap.map(([, a]) => `${a} -10 -7`).join(";")} keyTimes={kt(flap, flap[flap.length - 1][0])} dur={`${flap[flap.length - 1][0]}s`} fill="freeze" />}
      </g>
    </g>
  );
}

// power flowing along a connected cable, the glowing port, and floating bolts
function Flow({ still }: { still: boolean }) {
  const d = cableD(PORT.x, PORT.y);
  return (
    <g>
      <path d={d} fill="none" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" pathLength="1" strokeDasharray="0.03 0.07">
        {!still && <animate attributeName="stroke-dashoffset" from="0.1" to="0" dur="0.7s" repeatCount="indefinite" />}
      </path>
      <circle cx={PORT.x} cy={PORT.y} r="16" fill="#fbbf24" opacity="0.3">
        {!still && <animate attributeName="r" values="10;30;10" dur="1.8s" repeatCount="indefinite" />}
        {!still && <animate attributeName="opacity" values="0.5;0.06;0.5" dur="1.8s" repeatCount="indefinite" />}
      </circle>
      {!still && [0, 1, 2].map((i) => (
        <path key={i} d={BOLT} fill="#fbbf24" opacity="0">
          <animateTransform attributeName="transform" type="translate" values={`${560 + i * 100} 134; ${560 + i * 100} 66`} dur="2.6s" begin={`${i * 0.85}s`} repeatCount="indefinite" />
          <animate attributeName="opacity" values="0;0.9;0" dur="2.6s" begin={`${i * 0.85}s`} repeatCount="indefinite" />
        </path>
      ))}
    </g>
  );
}

// a battery that fills over and over: "this car is charging" (no number, because the real level is unknown)
function Battery({ still }: { still: boolean }) {
  return (
    <g transform="translate(600 30)">
      <rect x="0" y="0" width="64" height="28" rx="7" fill="#fff" stroke={NAVY} strokeWidth="3" />
      <rect x="64" y="8" width="5" height="12" rx="2" fill={NAVY} />
      <rect x="5" y="5" width={still ? 34 : 0} height="18" rx="4" fill="#22c55e">
        {!still && <animate attributeName="width" values="6;54;54;6" keyTimes="0;0.7;0.9;1" dur="4s" repeatCount="indefinite" />}
      </rect>
      <path d={BOLT} transform="translate(32 14) scale(0.9)" fill="#fbbf24" stroke="#fff" strokeWidth="1" />
    </g>
  );
}

// ---------- the boy (feet at the origin, about 110 units tall, facing right) ----------
function Boy({ walks = [], arm, farArm }: { walks?: [number, number][]; arm?: React.ReactNode; farArm?: React.ReactNode }) {
  const legs = (from: number, to: number) => walks.map(([begin, secs]) => (
    <animateTransform key={begin} attributeName="transform" type="rotate" values={`${from} 0 -34; ${to} 0 -34; ${from} 0 -34`} dur="0.5s" begin={`${begin}s`} repeatCount={Math.max(1, Math.round(secs / 0.5))} />
  ));
  return (
    <g>
      <ellipse cx="0" cy="0" rx="24" ry="5" fill="#0f172a" opacity="0.18" />
      <g><rect x="-9" y="-36" width="10" height="36" rx="4.5" fill="#1e293b" /><rect x="-12" y="-3" width="15" height="5" rx="2.5" fill="#111827" />{legs(-22, 22)}</g>
      <g><rect x="0" y="-36" width="10" height="36" rx="4.5" fill="#334155" /><rect x="-2" y="-3" width="15" height="5" rx="2.5" fill="#111827" />{legs(22, -22)}</g>
      <rect x="-15" y="-42" width="30" height="15" rx="6" fill={NAVY} />
      <rect x="-15" y="-86" width="30" height="50" rx="13" fill={KIT} />
      <g>
        <line x1="-2" y1="-76" x2="-2" y2="-46" stroke={SKIN} strokeWidth="8" strokeLinecap="round" />
        {farArm}
      </g>
      <Head eyes="open" />
      <g>
        <line x1="4" y1="-76" x2="4" y2="-42" stroke={KIT} strokeWidth="11" strokeLinecap="round" />
        <line x1="4" y1="-60" x2="4" y2="-40" stroke={SKIN} strokeWidth="8" strokeLinecap="round" />
        <circle cx="4" cy="-38" r="6" fill={SKIN} />
        {arm}
      </g>
    </g>
  );
}

function Head({ eyes }: { eyes: "open" | "closed" }) {
  return (
    <g>
      <circle cx="2" cy="-99" r="13" fill={SKIN} />
      <path d="M-11 -101 a13 13 0 0 1 26 0 q-13 -6 -26 0 z" fill="#1f2937" />
      <path d="M12 -103 l7 3 l-7 3 z" fill="#1f2937" />
      {eyes === "open" ? <circle cx="8" cy="-98" r="1.9" fill="#111827" /> : <path d="M5.5 -98 q2.5 2 5 0" stroke="#111827" strokeWidth="1.6" fill="none" strokeLinecap="round" />}
      <path d="M5 -92 q4.5 5 9 0" stroke="#9a3412" strokeWidth="1.7" fill="none" strokeLinecap="round" />
      <circle cx="12" cy="-94" r="2.4" fill="#fb7185" opacity="0.45" />
    </g>
  );
}

// sitting on the stool, head nodding, eyes closed, Zzz
function SeatedBoy() {
  return (
    <g>
      <ellipse cx="2" cy="25" rx="30" ry="5" fill="#0f172a" opacity="0.18" />
      {/* stool */}
      <rect x="-20" y="0" width="40" height="7" rx="3.5" fill="#92400e" />
      <rect x="-14" y="7" width="4" height="22" rx="2" fill="#78350f" /><rect x="10" y="7" width="4" height="22" rx="2" fill="#78350f" />
      {/* legs: thighs forward, shins down */}
      <rect x="-12" y="-14" width="36" height="14" rx="6" fill={NAVY} />
      <rect x="16" y="-10" width="11" height="34" rx="5" fill="#334155" /><rect x="14" y="21" width="17" height="5" rx="2.5" fill="#111827" />
      {/* body leaning a little */}
      <rect x="-15" y="-62" width="30" height="52" rx="13" fill={KIT}>
        <animateTransform attributeName="transform" type="rotate" values="0 0 -10; 3 0 -10; 0 0 -10" dur="3s" repeatCount="indefinite" />
      </rect>
      {/* arms folded */}
      <rect x="-9" y="-40" width="26" height="9" rx="4.5" fill={SKIN} />
      {/* head nodding */}
      <g>
        <g transform="translate(0 38)"><Head eyes="closed" /></g>
        <animateTransform attributeName="transform" type="rotate" values="0 0 -22; 12 0 -22; 0 0 -22" dur="3.2s" repeatCount="indefinite" />
      </g>
      {[0, 1, 2].map((i) => (
        <text key={i} x="22" y="-48" fontSize={13 + i * 3} fontWeight="800" fill="#6366f1" fontFamily="sans-serif" opacity="0">
          Z
          <animateTransform attributeName="transform" type="translate" values={`${i * 6} 0; ${i * 6 + 14} -26`} dur="2.4s" begin={`${i * 0.8}s`} repeatCount="indefinite" />
          <animate attributeName="opacity" values="0;0.9;0" dur="2.4s" begin={`${i * 0.8}s`} repeatCount="indefinite" />
        </text>
      ))}
    </g>
  );
}

function Stool() {
  return <g transform={`translate(${STOOL_X} ${SEAT_Y}) scale(${SEAT_K})`}><rect x="-20" y="0" width="40" height="7" rx="3.5" fill="#92400e" /><rect x="-14" y="7" width="4" height="22" rx="2" fill="#78350f" /><rect x="10" y="7" width="4" height="22" rx="2" fill="#78350f" /></g>;
}

function CarImage() {
  return <image href="/ev/tata-nexon.jpg" x={OX} y={OY} width={740 * S} height={400 * S} style={{ mixBlendMode: "multiply" }} />;
}

// ---------- the scenes ----------
function Plugging() {
  const T = PLUG_SECONDS;
  const x: KF[] = [[0, `-30 ${GROUND}`], [1.0, `${GRAB_X} ${GROUND}`], [1.4, `${GRAB_X} ${GROUND}`], [3.0, `${CAR_X} ${GROUND}`], [T, `${CAR_X} ${GROUND}`]];
  const a: KF[] = [[0, 0], [0.8, -10], [1.0, ARM_HOLSTER], [1.4, ARM_HOLSTER], [1.5, -35], [3.0, -35], [3.5, ARM_PORT], [3.65, ARM_PORT + 8], [3.8, ARM_PORT], [4.0, ARM_PORT], [4.6, -5], [T, 0]];
  const e: KF[] = [[0, `${HOLSTER.x},${HOLSTER.y}`], [1.4, `${HOLSTER.x},${HOLSTER.y}`], [3.0, TIP_WALK(CAR_X)], [3.5, `${PORT.x},${PORT.y}`], [T, `${PORT.x},${PORT.y}`]];
  const cable = e.map(([, v]) => { const [ex, ey] = String(v).split(",").map(Number); return cableD(ex, ey); }).join(";");
  return (
    <g>
      <CarImage />
      <Post gunOnPost={{ hide: 1.4 }} />
      <Stool />
      <path d={cableD(HOLSTER.x, HOLSTER.y)} fill="none" stroke="#111827" strokeWidth="5" strokeLinecap="round">
        <animate attributeName="d" values={cable} keyTimes={kt(e, T)} dur={`${T}s`} fill="freeze" />
      </path>
      <PortBox open={false} led="off" flap={[[0, 0], [3.3, 0], [3.5, -70], [T, -70]]} ledAt={[[0, "#ef4444"], [3.85, "#22c55e"], [T, "#22c55e"]]} />
      {/* the plug sitting in the port once pushed in */}
      <g transform={`translate(${PORT.x} ${PORT.y})`} opacity="0">
        <rect x="-18" y="-4" width="14" height="8" rx="3" fill={NAVY} /><rect x="-6" y="-2" width="5" height="4" fill="#fbbf24" />
        <set attributeName="opacity" to="1" begin="3.85s" fill="freeze" />
      </g>
      <g>
        <animateTransform attributeName="transform" type="translate" values={vals(x)} keyTimes={kt(x, T)} dur={`${T}s`} fill="freeze" />
        <g transform={`scale(${BOY_K})`}>
          <Boy walks={[[0, 1.0], [1.5, 1.5]]} arm={
            <g>
              <g opacity="0"><Gun /><set attributeName="opacity" to="1" begin="1.4s" fill="freeze" /><set attributeName="opacity" to="0" begin="3.85s" fill="freeze" /></g>
              <animateTransform attributeName="transform" type="rotate" values={a.map(([, v]) => `${v} 4 -76`).join(";")} keyTimes={kt(a, T)} dur={`${T}s`} fill="freeze" />
            </g>
          } />
        </g>
      </g>
      <g transform={`translate(${PORT.x} ${PORT.y})`} opacity="0">
        {[0, 45, 90, 135, 180, 225, 270, 315].map((d) => <line key={d} x1="10" y1="0" x2="24" y2="0" stroke="#fbbf24" strokeWidth="3" strokeLinecap="round" transform={`rotate(${d})`} />)}
        <animate attributeName="opacity" values="0;1;0" keyTimes="0;0.2;1" begin="3.85s" dur="0.8s" fill="freeze" />
      </g>
    </g>
  );
}

function Charging({ arrive, still }: { arrive: boolean; still: boolean }) {
  const T = SETTLE_SECONDS;
  return (
    <g>
      <CarImage />
      <Post gunOnPost={false} />
      <path d={cableD(PORT.x, PORT.y)} fill="none" stroke="#111827" strokeWidth="5" strokeLinecap="round" />
      <PortBox open led="on" />
      <g transform={`translate(${PORT.x} ${PORT.y})`}><rect x="-18" y="-4" width="14" height="8" rx="3" fill={NAVY} /><rect x="-6" y="-2" width="5" height="4" fill="#fbbf24" /></g>
      <Flow still={still} />
      <Battery still={still} />
      {arrive ? (
        <g>
          <g>
            <animateTransform attributeName="transform" type="translate" values={`${CAR_X} ${GROUND}; ${STOOL_X + 6} ${GROUND}; ${STOOL_X + 6} ${GROUND}`} keyTimes={`0;${(1.0 / T).toFixed(3)};1`} dur={`${T}s`} fill="freeze" />
            <g transform={`scale(${BOY_K})`}><Boy walks={[[0, 1.0]]} /></g>
            <set attributeName="opacity" to="0" begin={`${1.0}s`} fill="freeze" />
          </g>
          <g transform={`translate(${STOOL_X} ${SEAT_Y}) scale(${SEAT_K})`} opacity="0"><SeatedBoy /><set attributeName="opacity" to="1" begin="1.0s" fill="freeze" /></g>
        </g>
      ) : (
        <g transform={`translate(${STOOL_X} ${SEAT_Y}) scale(${SEAT_K})`}><SeatedBoy /></g>
      )}
    </g>
  );
}

function Unplugging() {
  const T = UNPLUG_SECONDS;
  const x: KF[] = [[0, `${STOOL_X + 6} ${GROUND}`], [0.25, `${STOOL_X + 6} ${GROUND}`], [1.2, `${STOOL_X + 6} ${GROUND}`], [1.9, `${CAR_X} ${GROUND}`], [2.9, `${CAR_X} ${GROUND}`], [4.3, `${GRAB_X} ${GROUND}`], [T, `${GRAB_X} ${GROUND}`]];
  const a: KF[] = [[0, 0], [0.3, 0], [0.6, -170], [0.95, -170], [1.2, 0], [1.9, 0], [2.2, ARM_PORT], [2.6, ARM_PORT], [2.8, -50], [2.9, -35], [4.3, -35], [4.6, ARM_HOLSTER], [4.9, -150], [5.1, -138], [5.3, -150], [T, 0]];
  const far: KF[] = [[0, 0], [0.3, 0], [0.6, 170], [0.95, 170], [1.2, 0], [T, 0]];
  const e: KF[] = [[0, `${PORT.x},${PORT.y}`], [2.2, `${PORT.x},${PORT.y}`], [2.9, TIP_WALK(CAR_X)], [4.3, TIP_WALK(GRAB_X)], [4.6, `${HOLSTER.x},${HOLSTER.y}`], [T, `${HOLSTER.x},${HOLSTER.y}`]];
  const cable = e.map(([, v]) => { const [ex, ey] = String(v).split(",").map(Number); return cableD(ex, ey); }).join(";");
  return (
    <g>
      <CarImage />
      <Post gunOnPost={{ show: 4.65 }} />
      <path d={cableD(PORT.x, PORT.y)} fill="none" stroke="#111827" strokeWidth="5" strokeLinecap="round">
        <animate attributeName="d" values={cable} keyTimes={kt(e, T)} dur={`${T}s`} fill="freeze" />
      </path>
      <PortBox open={false} led="on" flap={[[0, -70], [2.6, -70], [2.9, 0], [T, 0]]} ledAt={[[0, "#22c55e"], [2.6, "#ef4444"], [T, "#ef4444"]]} />
      {/* the plug in the port until he pulls it out */}
      <g transform={`translate(${PORT.x} ${PORT.y})`}><rect x="-18" y="-4" width="14" height="8" rx="3" fill={NAVY} /><rect x="-6" y="-2" width="5" height="4" fill="#fbbf24" /><set attributeName="opacity" to="0" begin="2.4s" fill="freeze" /></g>
      {/* asleep: wakes with a start at 0.25 s */}
      <g transform={`translate(${STOOL_X} ${SEAT_Y}) scale(${SEAT_K})`}>
        <SeatedBoy />
        <set attributeName="opacity" to="0" begin="0.25s" fill="freeze" />
      </g>
      <g transform={`translate(${STOOL_X + 72} 82)`} opacity="0">
        <circle r="14" fill="#ef4444" /><text x="0" y="6" textAnchor="middle" fontSize="19" fontWeight="900" fill="#fff" fontFamily="sans-serif">!</text>
        <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.6;1" dur="0.9s" begin="0s" fill="freeze" />
      </g>
      {/* the stool stays */}
      <Stool />
      <g opacity="0">
        <set attributeName="opacity" to="1" begin="0.25s" fill="freeze" />
        <g>
          <animateTransform attributeName="transform" type="translate" values={vals(x)} keyTimes={kt(x, T)} dur={`${T}s`} fill="freeze" />
          <g transform={`scale(${BOY_K})`}>
            <Boy walks={[[1.2, 0.7], [2.9, 1.4]]}
              farArm={<animateTransform attributeName="transform" type="rotate" values={far.map(([, v]) => `${v} -2 -76`).join(";")} keyTimes={kt(far, T)} dur={`${T}s`} fill="freeze" />}
              arm={
                <g>
                  <g opacity="0"><Gun /><set attributeName="opacity" to="1" begin="2.4s" fill="freeze" /><set attributeName="opacity" to="0" begin="4.65s" fill="freeze" /></g>
                  <animateTransform attributeName="transform" type="rotate" values={a.map(([, v]) => `${v} 4 -76`).join(";")} keyTimes={kt(a, T)} dur={`${T}s`} fill="freeze" />
                </g>
              } />
          </g>
        </g>
      </g>
    </g>
  );
}

function Leaving() {
  const T = LEAVE_SECONDS;
  // the boy: post -> driver door (0.3-2.0 s), steps in (2.5-3.0 s) and is gone
  const x: KF[] = [[0, `${GRAB_X} ${GROUND}`], [0.3, `${GRAB_X} ${GROUND}`], [2.0, `${HANDLE_X} ${GROUND}`], [2.5, `${HANDLE_X} ${GROUND}`], [3.0, `${DOOR_X} ${GROUND - 40}`], [T, `${DOOR_X} ${GROUND - 40}`]];
  // the door: closed, swings open (2.0-2.5 s), shut again (3.0-3.5 s)
  const door: KF[] = [[0, 0], [2.0, 0], [2.5, 1], [3.0, 1], [3.5, 0], [T, 0]];
  const doorPts = (shut: [number, number][], open: [number, number][]) => door.map(([, o]) => pts(Number(o) ? open : shut)).join(";");
  // the car: still, a small rock as it starts (4.0-4.3 s), then away to the right, faster and faster (4.3-6.0 s)
  const car: KF[] = [[0, "0 0"], [4.0, "0 0"], [4.12, "5 -1.5"], [4.3, "0 0"], [6.0, "640 0"], [T, "640 0"]];
  return (
    <g>
      <Post gunOnPost />
      <path d={cableD(HOLSTER.x, HOLSTER.y)} fill="none" stroke="#111827" strokeWidth="5" strokeLinecap="round" />
      <Stool />
      <g>
        <animateTransform attributeName="transform" type="translate" values={vals(car)} keyTimes={kt(car, T)} dur={`${T}s`} fill="freeze" calcMode="spline"
          keySplines="0 0 1 1;0.3 0 0.7 1;0.3 0 0.7 1;0.62 0 0.92 0.55;0 0 1 1" />
        {/* speed lines and dust behind the car while it pulls away */}
        <g opacity="0">
          {[[0, 196], [-14, 226], [6, 256]].map(([dx, y], i) => (
            <line key={i} x1={OX - 70 + dx} y1={y} x2={OX - 10 + dx} y2={y} stroke="#94a3b8" strokeWidth="3" strokeLinecap="round" pathLength="1" strokeDasharray="0.6 0.4">
              <animate attributeName="stroke-dashoffset" from="0" to="1" dur="0.35s" begin="4.3s" repeatCount="5" />
            </line>
          ))}
          <animate attributeName="opacity" values="0;0.9;0.9;0" keyTimes="0;0.15;0.75;1" begin="4.3s" dur="1.7s" fill="freeze" />
        </g>
        {[0, 1, 2].map((i) => (
          <circle key={i} cx={OX + 70 * S - i * 12} cy={GROUND - 4} r="4" fill="#cbd5e1" opacity="0">
            <animate attributeName="r" values="4;16" begin={`${4.25 + i * 0.12}s`} dur="0.9s" fill="freeze" />
            <animate attributeName="opacity" values="0.8;0" begin={`${4.25 + i * 0.12}s`} dur="0.9s" fill="freeze" />
          </circle>
        ))}
        <CarImage />
        <PortBox open={false} led="off" />
        {/* the open doorway: dark cabin with the seat and steering wheel */}
        <g opacity="0">
          <polygon points={pts(DOOR_ALL)} fill="#0f172a" />
          <polygon points={pts([[200, 128], [238, 120], [250, 206], [206, 222]])} fill="#334155" />
          <path d={`M${P(262, 132)} q 8 -10 16 0`} stroke="#64748b" strokeWidth="3" fill="none" />
          <animate attributeName="opacity" values="0;1;1;0" keyTimes={`0;${(2.05 / T).toFixed(4)};${(3.45 / T).toFixed(4)};${(3.5 / T).toFixed(4)}`} dur={`${T}s`} fill="freeze" calcMode="discrete" />
        </g>
        {/* the boy gets in */}
        <g>
          <animateTransform attributeName="transform" type="translate" values={vals(x)} keyTimes={kt(x, T)} dur={`${T}s`} fill="freeze" />
          <animate attributeName="opacity" values="1;1;0;0" keyTimes={`0;${(2.6 / T).toFixed(4)};${(3.0 / T).toFixed(4)};1`} dur={`${T}s`} fill="freeze" />
          <g>
            <animateTransform attributeName="transform" type="scale" values={`${BOY_K};${BOY_K};${(BOY_K * 0.55).toFixed(2)};${(BOY_K * 0.55).toFixed(2)}`} keyTimes={`0;${(2.5 / T).toFixed(4)};${(3.0 / T).toFixed(4)};1`} dur={`${T}s`} fill="freeze" />
            <Boy walks={[[0.3, 1.7], [2.5, 0.5]]} arm={
              <animateTransform attributeName="transform" type="rotate" values="0 4 -76; 0 4 -76; -78 4 -76; -78 4 -76; -20 4 -76; -20 4 -76" keyTimes={`0;${(1.8 / T).toFixed(4)};${(2.1 / T).toFixed(4)};${(2.5 / T).toFixed(4)};${(2.8 / T).toFixed(4)};1`} dur={`${T}s`} fill="freeze" />
            } />
          </g>
        </g>
        {/* the door panel: drawn over the picture while it moves, morphing from closed to open on its front hinge and back */}
        <g opacity="0">
          <animate attributeName="opacity" values="0;1;0" keyTimes={`0;${(2.0 / T).toFixed(4)};${(3.5 / T).toFixed(4)}`} dur={`${T}s`} fill="freeze" calcMode="discrete" />
          <polygon points={pts(DOOR_BODY)} fill="#f8fafc" stroke="#334155" strokeWidth="1.4" strokeLinejoin="round">
            <animate attributeName="points" values={doorPts(DOOR_BODY, DOOR_BODY_OPEN)} keyTimes={kt(door, T)} dur={`${T}s`} fill="freeze" />
          </polygon>
          <polygon points={pts(DOOR_WINDOW)} fill="#1f2937" stroke="#334155" strokeWidth="1.4" strokeLinejoin="round">
            <animate attributeName="points" values={doorPts(DOOR_WINDOW, DOOR_WINDOW_OPEN)} keyTimes={kt(door, T)} dur={`${T}s`} fill="freeze" />
          </polygon>
        </g>
        {/* lights blink twice as it unlocks and starts */}
        <g opacity="0">
          <circle cx={OX + 62 * S} cy={OY + 160 * S} r="7" fill="#ef4444" />
          <circle cx={OX + 520 * S} cy={OY + 196 * S} r="8" fill="#fde68a" />
          <animate attributeName="opacity" values="0;1;0;1;0" begin="3.6s" dur="0.6s" fill="freeze" />
        </g>
      </g>
    </g>
  );
}

function Arriving() {
  const T = ARRIVE_SECONDS;
  return (
    <g>
      <Post gunOnPost />
      <path d={cableD(HOLSTER.x, HOLSTER.y)} fill="none" stroke="#111827" strokeWidth="5" strokeLinecap="round" />
      <Stool />
      <g>
        {/* rolls the last stretch into the bay (fading in, so it never drives through the post), a small settle as it stops */}
        <animateTransform attributeName="transform" type="translate" values="-150 0; 6 0; 0 0" keyTimes="0;0.85;1" dur={`${T}s`} fill="freeze" calcMode="spline" keySplines="0.15 0.55 0.3 1;0.4 0 0.6 1" />
        <animate attributeName="opacity" values="0;1;1" keyTimes="0;0.4;1" dur={`${T}s`} fill="freeze" />
        <CarImage />
        <PortBox open={false} led="off" />
      </g>
    </g>
  );
}

function Idle() {
  return (
    <g>
      <CarImage />
      <Post gunOnPost />
      <path d={cableD(HOLSTER.x, HOLSTER.y)} fill="none" stroke="#111827" strokeWidth="5" strokeLinecap="round" />
      <PortBox open={false} led="off" />
      <Stool />
    </g>
  );
}

export default function ChargeScene({ mode }: { mode: SceneMode }) {
  // "reduce motion": show the connected state without movement
  const [still, setStill] = useState(false);
  useEffect(() => {
    const q = window.matchMedia("(prefers-reduced-motion: reduce)");
    const set = () => setStill(q.matches);
    set();
    q.addEventListener("change", set);
    return () => q.removeEventListener("change", set);
  }, []);

  const m: SceneMode = still ? (mode === "plugging" || mode === "settling" ? "charging" : mode === "unplugging" || mode === "leaving" || mode === "arriving" ? "idle" : mode) : mode;
  return (
    <svg aria-hidden viewBox="0 0 900 320" className="pointer-events-none absolute inset-0 h-full w-full">
      {m === "idle" && <Idle />}
      {m === "plugging" && <Plugging />}
      {(m === "settling" || m === "charging") && <Charging arrive={m === "settling"} still={still} />}
      {m === "unplugging" && <Unplugging />}
      {m === "leaving" && <Leaving />}
      {m === "arriving" && <Arriving />}
    </svg>
  );
}
