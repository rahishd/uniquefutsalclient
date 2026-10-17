"use client";

import ChargeScene, { type SceneMode } from "@/components/ev/ChargeScene";

// The charging scene on a plain white card: the car on the right (a little smaller), and the charging post, the stool and the boy on
// the left, all in one 900 x 320 stage. The car picture is part of the animation so it can drive away and the next one can arrive.
export default function CarHero({ mode = "idle" }: { mode?: SceneMode }) {
  return (
    <div className="overflow-hidden rounded-3xl bg-white px-2 py-3">
      <div className="relative mx-auto w-full max-w-md" style={{ aspectRatio: "900 / 320" }}>
        <ChargeScene key={mode} mode={mode} />
      </div>
    </div>
  );
}
