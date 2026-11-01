// Small hand-drawn SVG charts for the Health page: a line chart (values that can be missing on a day) and a bar chart.

const W = 300;
const H = 120;
const PAD = { l: 26, r: 8, t: 8, b: 20 };

const xAt = (i: number, n: number) => PAD.l + (n <= 1 ? (W - PAD.l - PAD.r) / 2 : (i * (W - PAD.l - PAD.r)) / (n - 1));
const yAt = (v: number, min: number, max: number) => PAD.t + (1 - (v - min) / (max - min || 1)) * (H - PAD.t - PAD.b);

function Axis({ min, max, labels, n }: { min: number; max: number; labels: string[]; n: number }) {
  const mid = (min + max) / 2;
  const ticks = [min, mid, max];
  const at = n > 2 ? [0, Math.floor((n - 1) / 2), n - 1] : n === 2 ? [0, 1] : [0];
  return (
    <>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={PAD.l} x2={W - PAD.r} y1={yAt(t, min, max)} y2={yAt(t, min, max)} stroke="#e2e8f0" strokeWidth="1" />
          <text x={PAD.l - 4} y={yAt(t, min, max) + 3} textAnchor="end" fontSize="8" fill="#475569">{Number.isInteger(t) ? t : t.toFixed(1)}</text>
        </g>
      ))}
      {at.map((i) => (
        <text key={i} x={xAt(i, n)} y={H - 6} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} fontSize="8" fill="#475569">{labels[i]}</text>
      ))}
    </>
  );
}

export interface Series { name: string; color: string; values: (number | null)[] }

/** One or more lines over the same days. A day with no value leaves a gap. `goal` draws a dashed line. */
export function LineChart({ series, labels, min, max, goal, label }: { series: Series[]; labels: string[]; min: number; max: number; goal?: number; label: string }) {
  const n = labels.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="h-auto w-full">
      <Axis min={min} max={max} labels={labels} n={n} />
      {goal != null && goal >= min && goal <= max && (
        <line x1={PAD.l} x2={W - PAD.r} y1={yAt(goal, min, max)} y2={yAt(goal, min, max)} stroke="#0c0b5d" strokeWidth="1" strokeDasharray="4 3" opacity="0.6" />
      )}
      {series.map((s) => {
        let d = "";
        let pen = false;
        s.values.forEach((v, i) => {
          if (v == null) { pen = false; return; }
          d += `${pen ? "L" : "M"}${xAt(i, n).toFixed(1)} ${yAt(Math.max(min, Math.min(max, v)), min, max).toFixed(1)} `;
          pen = true;
        });
        return (
          <g key={s.name}>
            <path d={d} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            {s.values.map((v, i) => v == null ? null : <circle key={i} cx={xAt(i, n)} cy={yAt(Math.max(min, Math.min(max, v)), min, max)} r="2.6" fill="#fff" stroke={s.color} strokeWidth="1.6" />)}
          </g>
        );
      })}
    </svg>
  );
}

/** Bars per day or week; a dashed line marks the goal. */
export function BarChart({ values, labels, max, goal, color, label }: { values: (number | null)[]; labels: string[]; max: number; goal?: number; color: string; label: string }) {
  const n = values.length;
  const slot = (W - PAD.l - PAD.r) / n;
  const bw = Math.min(18, slot * 0.62);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="h-auto w-full">
      <Axis min={0} max={max} labels={labels} n={n} />
      {values.map((v, i) => {
        if (v == null || v <= 0) return null;
        const y = yAt(Math.min(v, max), 0, max);
        const cx = PAD.l + slot * i + slot / 2;
        return <rect key={i} x={cx - bw / 2} y={y} width={bw} height={H - PAD.b - y} rx="3" fill={color} />;
      })}
      {goal != null && goal <= max && <line x1={PAD.l} x2={W - PAD.r} y1={yAt(goal, 0, max)} y2={yAt(goal, 0, max)} stroke="#0c0b5d" strokeWidth="1" strokeDasharray="4 3" opacity="0.6" />}
    </svg>
  );
}

/** A ring that fills to `value` percent, with the number in the middle. */
export function Ring({ value, color, size = 96 }: { value: number; color: string; size?: number }) {
  const r = 40;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={`${value} out of 100`}>
      <circle cx="50" cy="50" r={r} fill="none" stroke="#e2e8f0" strokeWidth="10" />
      <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(c * value) / 100} ${c}`} transform="rotate(-90 50 50)" />
      <text x="50" y="55" textAnchor="middle" fontSize="26" fontWeight="800" fill="#000">{value}</text>
    </svg>
  );
}
