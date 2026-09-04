"use client"

import { inr, pct } from "@/lib/fraud/format"
import type { Engine } from "./use-engine"

function Kpi({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string
  value: string
  sub?: string
  tone?: "default" | "signal" | "danger" | "good"
}) {
  const toneClass =
    tone === "signal"
      ? "text-primary"
      : tone === "danger"
        ? "text-critical"
        : tone === "good"
          ? "text-success"
          : "text-foreground"
  return (
    <div className="flex flex-col gap-1 border-l border-border pl-4 first:border-l-0 first:pl-0">
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
      <span className={`tnum font-mono text-2xl leading-none ${toneClass}`}>{value}</span>
      {sub ? <span className="font-mono text-[11px] text-muted-foreground">{sub}</span> : null}
    </div>
  )
}

export function KpiRow({ engine }: { engine: Engine }) {
  const { evalResult: ev, livePoint: m, threshold } = engine
  const atOptimal = Math.abs(threshold - ev.optimal.threshold) < 1e-6
  const savings = ev.baselineLoss - m.expectedLoss
  const savingsPct = ev.baselineLoss > 0 ? savings / ev.baselineLoss : 0

  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-3 lg:grid-cols-6">
      <Kpi
        label="Expected loss / day"
        value={inr(m.expectedLoss)}
        sub={`baseline ${inr(ev.baselineLoss)}`}
        tone="signal"
      />
      <Kpi label="Loss averted" value={pct(savingsPct)} sub="vs. no-model baseline" tone="good" />
      <Kpi label="Recall" value={pct(m.recall)} sub={`${m.tp}/${m.tp + m.fn} fraud caught`} />
      <Kpi label="Precision" value={pct(m.precision)} sub={`${m.fp} false holds`} />
      <Kpi
        label="Operating threshold"
        value={threshold.toFixed(3)}
        sub={atOptimal ? "cost-optimal" : "manual override"}
        tone={atOptimal ? "good" : "danger"}
      />
      <Kpi label="Flagged txns" value={String(m.tp + m.fp)} sub={`of ${ev.positives + ev.negatives} held-out`} />
    </div>
  )
}
