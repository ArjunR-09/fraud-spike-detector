"use client"

import { Button } from "@/components/ui/button"
import { inr } from "@/lib/fraud/format"
import type { Engine } from "./use-engine"

export function ThresholdControl({ engine }: { engine: Engine }) {
  const { evalResult: ev, threshold, livePoint: m } = engine
  const atOptimal = Math.abs(threshold - ev.optimal.threshold) < 1e-6
  const delta = m.expectedLoss - ev.optimal.expectedLoss

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Operating point
          </span>
          <span className="font-mono text-sm text-foreground">
            {"\u03C4"} = {threshold.toFixed(3)}
            {atOptimal ? (
              <span className="ml-2 text-success">cost-optimal</span>
            ) : (
              <span className="ml-2 text-critical">+{inr(delta)}/day vs optimal</span>
            )}
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => engine.setThreshold(ev.optimal.threshold)}
          disabled={atOptimal}
          className="h-7 font-mono text-[11px]"
        >
          snap to optimal
        </Button>
      </div>
      <input
        type="range"
        min={0.3}
        max={0.75}
        step={0.005}
        value={threshold}
        onChange={(e) => engine.setThreshold(Number(e.target.value))}
        aria-label="Detection threshold"
        className="h-1 w-full cursor-pointer appearance-none rounded-full bg-border accent-primary"
      />
      <p className="font-mono text-[11px] leading-relaxed text-muted-foreground">
        {"Lowering \u03C4 catches more fraud (recall up) but holds more legitimate payments (precision down). The default sits at the point that minimizes expected rupee loss, not F1 \u2014 because a missed fraud costs ~7\u00D7 a wrongly-held customer."}
      </p>
    </div>
  )
}
