export function inr(n: number): string {
  if (Math.abs(n) >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`
  if (Math.abs(n) >= 1e5) return `₹${(n / 1e5).toFixed(2)}L`
  if (Math.abs(n) >= 1e3) return `₹${(n / 1e3).toFixed(1)}k`
  return `₹${Math.round(n)}`
}

export function inrFull(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`
}

export function clockTime(ts: number): string {
  const d = new Date(ts)
  const p = (x: number) => String(x).padStart(2, "0")
  return `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`
}

export function pct(n: number, digits = 0): string {
  return `${(n * 100).toFixed(digits)}%`
}

export const FRAUD_LABELS: Record<string, string> = {
  card_testing: "Card testing",
  impossible_travel: "Impossible travel",
  device_fanout: "Device fan-out",
}

export const ACTION_LABELS: Record<string, string> = {
  monitor: "Monitor",
  step_up: "Step-up auth",
  soft_hold: "Soft hold",
  escalate: "Escalate",
}

export const ENTITY_LABELS: Record<string, string> = {
  device: "Device",
  ip: "IP",
  card_bin: "Card BIN",
  card: "Card",
}

export function entityLabel(kind: string, value: string): string {
  return `${ENTITY_LABELS[kind] ?? kind} ${value}`
}
