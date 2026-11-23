// Unique Ludo: where things are drawn. A 15 x 15 grid; the track, the home lanes and the yards. This only maps the
// server's token positions to screen coordinates (the server decides every position and rule).
//
// Position of a token (same numbers the server uses): -1 yard, 0..50 shared track counted from its colour's start
// square, 51..55 home lane, 56 home.

import type { ColorName } from "@/lib/ludo";

export const SIZE = 15;
export const TRACK_LEN = 52;
export const START_OFFSET = [0, 13, 26, 39];
export const SAFE_ABS = [0, 8, 13, 21, 26, 34, 39, 47];
export const STAR_ABS = [8, 21, 34, 47];
export const HOME_POS = 56;

// the 52 shared squares, clockwise from red's start square: [column, row]
export const TRACK: [number, number][] = [
  [1, 6], [2, 6], [3, 6], [4, 6], [5, 6],
  [6, 5], [6, 4], [6, 3], [6, 2], [6, 1], [6, 0],
  [7, 0], [8, 0],
  [8, 1], [8, 2], [8, 3], [8, 4], [8, 5],
  [9, 6], [10, 6], [11, 6], [12, 6], [13, 6], [14, 6],
  [14, 7], [14, 8],
  [13, 8], [12, 8], [11, 8], [10, 8], [9, 8],
  [8, 9], [8, 10], [8, 11], [8, 12], [8, 13], [8, 14],
  [7, 14], [6, 14],
  [6, 13], [6, 12], [6, 11], [6, 10], [6, 9],
  [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
  [0, 7], [0, 6],
];

// the five home-lane squares of each colour, entrance first
export const LANE: [number, number][][] = [
  [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
  [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]],
  [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]],
  [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]],
];

// the four places in each yard (centres, in grid units)
export const YARD: [number, number][][] = [
  [[2, 2], [4, 2], [2, 4], [4, 4]],
  [[11, 2], [13, 2], [11, 4], [13, 4]],
  [[11, 11], [13, 11], [11, 13], [13, 13]],
  [[2, 11], [4, 11], [2, 13], [4, 13]],
];

// where finished tokens rest in the middle, a little apart
const HOME_REST: [number, number][][] = [
  [[6.55, 7.0], [6.55, 7.5], [6.55, 8.0], [7.0, 7.5]],
  [[7.0, 6.55], [7.5, 6.55], [8.0, 6.55], [7.5, 7.0]],
  [[8.45, 7.0], [8.45, 7.5], [8.45, 8.0], [8.0, 7.5]],
  [[7.0, 8.45], [7.5, 8.45], [8.0, 8.45], [7.5, 8.0]],
];

export const COLORS: Record<ColorName, { main: string; light: string; dark: string; soft: string; name: string }> = {
  red: { main: "#e5484d", light: "#ff8a8d", dark: "#a42327", soft: "#fde4e5", name: "Red" },
  green: { main: "#2fb36d", light: "#7be3a8", dark: "#177043", soft: "#dcf5e7", name: "Green" },
  yellow: { main: "#f5b72c", light: "#ffe083", dark: "#b97f08", soft: "#fdf1cc", name: "Yellow" },
  blue: { main: "#3b7ddd", light: "#8bb8f5", dark: "#1f4c96", soft: "#dbe9fc", name: "Blue" },
};
export const COLOR_NAMES: ColorName[] = ["red", "green", "yellow", "blue"];

/** Absolute track index for a token that is on the shared track, else null. */
export function absOf(colorIdx: number, pos: number): number | null {
  return pos >= 0 && pos < 51 ? (START_OFFSET[colorIdx] + pos) % TRACK_LEN : null;
}

/** Centre of where a token stands, in grid units. */
export function cellCenter(colorIdx: number, pos: number, token: number): [number, number] {
  if (pos < 0) return YARD[colorIdx][token];
  if (pos >= HOME_POS) return HOME_REST[colorIdx][token];
  if (pos >= 51) {
    const [c, r] = LANE[colorIdx][pos - 51];
    return [c + 0.5, r + 0.5];
  }
  const [c, r] = TRACK[(START_OFFSET[colorIdx] + pos) % TRACK_LEN];
  return [c + 0.5, r + 0.5];
}
