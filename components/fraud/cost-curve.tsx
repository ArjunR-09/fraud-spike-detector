"use client"

import { Line, ComposedChart, XAxis, YAxis, CartesianGrid, ReferenceLine, Area } from "recharts"
import { ChartContainer, ChartTooltip } from "@/components/ui/chart"
import { inr, pct } from "@/lib/fraud/format"
import type { Engine } from "./use-engine"

export function CostCurve({ engine }: { engine: Engine }) {
  const { evalResult: ev, threshold } = engine
  const atOptimal = Math.abs(threshold - ev.optimal.threshold) < 1e-6
  // Only render the meaningful part of the sweep where flags actually happen.
  const data = ev.curve
    .filter((p) => p.threshold >= 0.3 && p.threshold <= 0.75)
    .map((p) => ({
      threshold: p.threshold,
      loss: p.expectedLoss,
      precision: p.precision,
      recall: p.recall,
    }))

  return (
    <ChartContainer
      config={{
        loss: { label: "Expected loss", color: "var(--chart-1)" },
        precision: { label: "Precision", color: "var(--chart-2)" },
        recall: { label: "Recall", color: "var(--chart-3)" },
      }}
      className="h-[280px] min-h-[280px] w-full"
    >
      <ComposedChart data={data} margin={{ top: 12, right: 8, bottom: 4, left: 8 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="2 4" />
        <XAxis
          dataKey="threshold"
          type="number"
          domain={[0.3, 0.75]}
          tickFormatter={(v) => v.toFixed(2)}
          tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
          tickLine={false}
          axisLine={{ stroke: "var(--border)" }}
        />
        <YAxis
          yAxisId="loss"
          tickFormatter={(v) => `${Math.round(v / 1000)}k`}
          tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
          tickLine={false}
          axisLine={false}
          width={38}
        />
        <YAxis
          yAxisId="rate"
          orientation="right"
          domain={[0, 1]}
          tickFormatter={(v) => `${Math.round(v * 100)}`}
          tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
          tickLine={false}
          axisLine={false}
          width={28}
        />
        <ChartTooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null
            const d = payload[0].payload as (typeof data)[number]
            return (
              <div className="rounded-md border border-border bg-popover px-3 py-2 font-mono text-[11px] shadow-lg">
                <div className="mb-1 text-muted-foreground">thr {d.threshold.toFixed(3)}</div>
                <div style={{ color: "var(--chart-1)" }}>loss {inr(d.loss)}</div>
                <div style={{ color: "var(--chart-2)" }}>precision {pct(d.precision)}</div>
                <div style={{ color: "var(--chart-3)" }}>recall {pct(d.recall)}</div>
              </div>
            )
          }}
        />
        <defs>
          <linearGradient id="lossFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.28} />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          yAxisId="loss"
          dataKey="loss"
          stroke="var(--chart-1)"
          strokeWidth={2}
          fill="url(#lossFill)"
          dot={false}
          isAnimationActive={false}
        />
        <Line
          yAxisId="rate"
          dataKey="precision"
          stroke="var(--chart-2)"
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
        <Line
          yAxisId="rate"
          dataKey="recall"
          stroke="var(--chart-3)"
          strokeWidth={1.5}
          strokeDasharray="4 3"
          dot={false}
          isAnimationActive={false}
        />
        <ReferenceLine
          yAxisId="loss"
          x={ev.optimal.threshold}
          stroke="var(--success)"
          strokeWidth={1.5}
          label={{ value: "cost-opt", position: "top", fontSize: 9, fill: "var(--success)" }}
        />
        <ReferenceLine
          yAxisId="loss"
          x={ev.bestF1.threshold}
          stroke="var(--muted-foreground)"
          strokeDasharray="3 3"
          label={{ value: "F1-opt", position: "top", fontSize: 9, fill: "var(--muted-foreground)" }}
        />
        {!atOptimal ? <ReferenceLine yAxisId="loss" x={threshold} stroke="var(--critical)" strokeWidth={1.5} /> : null}
      </ComposedChart>
    </ChartContainer>
  )
}
