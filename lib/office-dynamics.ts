/**
 * Shared "office dynamics" rules. Imported by the browser store AND by the
 * offline worker (Supabase Edge Function), so an agent behaves the same whether
 * its owner has the app open or not. Pure functions only — no React, no window.
 */

export const SPEED = 2.6; // metres per second

/** Activity codes the offline worker may pick (mirrors the browser's auto-life). */
export const OFFICE_ACTIVITIES = [
  "WORKING",
  "WATCHING_TV",
  "DRINKING",
  "COOKING",
  "PRAYING",
  "TOILET",
  "RESTING",
  "CHATTING",
  "DRIVING",
  "RELAXING",
  "PINGPONG",
] as const;

export type OfficeActivity = (typeof OFFICE_ACTIVITIES)[number];

export function walkDuration(fromX: number, fromY: number, toX: number, toY: number) {
  const distance = Math.hypot(toX - fromX, toY - fromY);
  return Math.min(7, Math.max(0.45, distance / SPEED));
}

/** Weighted table: same shape as the browser's random roll (~sums to 1). */
export const ACTIVITY_ROLL: [OfficeActivity, number][] = [
  ["WORKING", 0.22],
  ["WATCHING_TV", 0.1],
  ["DRINKING", 0.1],
  ["COOKING", 0.08],
  ["PRAYING", 0.08],
  ["TOILET", 0.07],
  ["RESTING", 0.13],
  ["CHATTING", 0.06],
  ["DRIVING", 0.07],
  ["RELAXING", 0.04],
  ["PINGPONG", 0.05],
];

/** Picks the next activity from a uniform random number in [0, 1). */
export function pickActivity(r: number): OfficeActivity {
  let acc = 0;
  for (const [activity, weight] of ACTIVITY_ROLL) {
    acc += weight;
    if (r < acc) return activity;
  }
  return "WORKING";
}

/** Activity codes the AI is allowed to answer with. */
export const AI_ACTIVITY_PROMPT =
  "Pilih SATU aktivitas kantor yang paling masuk akal untukmu sekarang. Jawab hanya satu kata: " +
  OFFICE_ACTIVITIES.join(", ") +
  ".";
