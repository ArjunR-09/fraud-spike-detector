"use client"

import { useState } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { ScoreBar, ActionBadge, ResolutionBadge } from "./badges"
import { inr, clockTime, entityLabel, FRAUD_LABELS } from "@/lib/fraud/format"
import { firedFeatureText } from "@/lib/fraud/pipeline"
import type { Engine } from "./use-engine"
import type { RiskCase } from "@/lib/fraud/types"

export function CasePanel({ engine }: { engine: Engine }) {
  const { cases } = engine
  const [selectedId, setSelectedId] = useState<string | null>(cases[0]?.id ?? null)
  const selected = cases.find((c) => c.id === selectedId) ?? cases[0] ?? null

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,340px)_1fr]">
      <div className="flex flex-col gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          Case queue · {cases.length}
        </span>
        <ScrollArea className="h-[440px] rounded-md border border-border">
          <div className="divide-y divide-border/60">
            {cases.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={`flex w-full flex-col gap-1.5 px-3 py-2.5 text-left transition-colors hover:bg-card ${
                  selected?.id === c.id ? "bg-card" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-mono text-[11px] text-foreground">
                    {entityLabel(c.entityKind, c.entityValue)}
                  </span>
                  <ActionBadge action={c.action} />
                </div>
                <ScoreBar score={c.peakScore} />
                <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
                  <span>{c.txnCount} txns</span>
                  <ResolutionBadge resolution={c.resolution} />
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>
      {selected ? <CaseDetail key={selected.id} c={selected} /> : null}
    </div>
  )
}

function CaseDetail({ c }: { c: RiskCase }) {
  const [narrative, setNarrative] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function narrate() {
    setLoading(true)
    setNarrative(null)
    try {
      const res = await fetch("/api/narrate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ case: c }),
      })
      const data = await res.json()
      setNarrative(data.summary ?? "No summary produced.")
    } catch {
      setNarrative("Narration service unavailable — decision stands on the logged features above.")
    } finally {
      setLoading(false)
    }
  }

  // The deliberately-shown graceful failure: a legit customer the model flagged,
  // gated (not blocked), and auto-released once step-up auth passed.
  const isGracefulFailure = !c.isFraud && c.action !== "monitor"

  return (
    <div className="flex flex-col gap-4 rounded-md border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-sm text-foreground">{entityLabel(c.entityKind, c.entityValue)}</span>
          <span className="font-mono text-[11px] text-muted-foreground">
            {c.txnCount} txns · window {clockTime(c.startTs)}–{clockTime(c.endTs)} · peak {c.peakScore.toFixed(3)}
            {c.fraudType ? ` · ${FRAUD_LABELS[c.fraudType]}` : ""}
          </span>
        </div>
        <ActionBadge action={c.action} />
      </div>

      {isGracefulFailure ? (
        <div className="rounded-md border border-warn/40 bg-warn/10 p-3">
          <p className="font-mono text-[11px] leading-relaxed text-foreground">
            <span className="text-warn">FALSE POSITIVE · handled gracefully. </span>
            {
              "This is a legitimate customer (a checkout retry-storm on a flaky bank). The model flagged it, so the gate applied a step-up auth challenge rather than a hard block. The customer passed OTP and the hold auto-released — no revenue lost, full trail below."
            }
          </p>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          Fired features (why)
        </span>
        {c.firedFeatures.length > 0 ? (
          <ul className="flex flex-col gap-1.5">
            {c.firedFeatures.map((f) => (
              <li key={f.key} className="flex items-start gap-2 font-mono text-[11px] leading-relaxed text-foreground/90">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" aria-hidden />
                {firedFeatureText(f)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="font-mono text-[11px] text-muted-foreground">
            Score driven by combined mild elevation across features; no single feature dominates.
          </p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3 border-y border-border py-3">
        <Stat label="Exposure" value={inr(c.totalAmount)} />
        <Stat label="Bounded action" value={c.action.replace("_", " ")} />
        <Stat label="Resolution" value={c.resolution.replace("_", " ")} />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Analyst case summary
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={narrate}
            disabled={loading}
            className="h-7 font-mono text-[11px]"
          >
            {loading ? "generating…" : narrative ? "regenerate" : "generate summary"}
          </Button>
        </div>
        <div className="min-h-[64px] rounded-md border border-border bg-background p-3">
          {narrative ? (
            <p className="font-mono text-[11px] leading-relaxed text-foreground/90">{narrative}</p>
          ) : (
            <p className="font-mono text-[11px] leading-relaxed text-muted-foreground">
              {
                "LLM narrates the already-computed decision into a case note. It reads the logged features — it never alters the numeric score or the action."
              }
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
      <span className="font-mono text-[12px] capitalize text-foreground">{value}</span>
    </div>
  )
}
