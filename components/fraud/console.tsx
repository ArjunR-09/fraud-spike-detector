"use client"

import { Card } from "@/components/ui/card"
import { useEngine } from "./use-engine"
import { KpiRow } from "./kpi-row"
import { CostCurve } from "./cost-curve"
import { ThresholdControl } from "./threshold-control"
import { LiveStream } from "./live-stream"
import { CasePanel } from "./case-panel"

export function Console() {
  const engine = useEngine()

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1400px] flex-col gap-4 px-4 py-5 md:px-6">
      <header className="flex flex-col gap-3 border-b border-border pb-4 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_10px_var(--primary)]" />
            <h1 className="font-mono text-base font-semibold tracking-tight text-foreground">
              VELOCITY <span className="text-muted-foreground">/ fraud-spike detector</span>
            </h1>
          </div>
          <p className="max-w-2xl font-mono text-[11px] leading-relaxed text-muted-foreground">
            {
              "Real-time transaction-velocity + behavioral anomaly detection for account-takeover spikes on a merchant payment stream. Isolation-forest scoring, cost-weighted threshold, gated & auditable actions. Defense-only."
            }
          </p>
        </div>
        <div className="flex items-center gap-4 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          <span>merchant M-4471</span>
          <span className="text-success">held-out test set</span>
        </div>
      </header>

      <KpiRow engine={engine} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_minmax(0,420px)]">
        <Card className="flex flex-col gap-3 border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Expected-loss curve · operating-point selection
            </span>
            <div className="flex items-center gap-3 font-mono text-[10px] text-muted-foreground">
              <Legend color="var(--chart-1)" label="loss" />
              <Legend color="var(--chart-2)" label="precision" />
              <Legend color="var(--chart-3)" label="recall" />
            </div>
          </div>
          <CostCurve engine={engine} />
          <div className="border-t border-border pt-3">
            <ThresholdControl engine={engine} />
          </div>
        </Card>

        <Card className="flex flex-col gap-2 border-border bg-card p-4">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Live transaction stream
          </span>
          <LiveStream engine={engine} />
        </Card>
      </div>

      <Card className="flex flex-col gap-3 border-border bg-card p-4">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          Flagged cases · explainable · bounded · gated
        </span>
        <CasePanel engine={engine} />
      </Card>

      <footer className="pb-4 font-mono text-[10px] leading-relaxed text-muted-foreground">
        {
          "Synthetic stream with injected fraud patterns (card-testing bursts, device fan-out, impossible-travel) blended with legit-but-suspicious traffic so precision/recall are not trivially perfect. Metrics are measured on a time-split held-out set the model never trained on."
        }
      </footer>
    </main>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-1.5 w-3 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  )
}
