"use client"

import { useEffect, useRef, useState } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { inr, clockTime } from "@/lib/fraud/format"
import type { Engine } from "./use-engine"
import type { ScoredTransaction } from "@/lib/fraud/types"

export function LiveStream({ engine }: { engine: Engine }) {
  const { testSorted, threshold } = engine
  const [cursor, setCursor] = useState(60)
  const [playing, setPlaying] = useState(true)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!playing) return
    timer.current = setInterval(() => {
      setCursor((c) => (c >= testSorted.length ? 60 : c + 1))
    }, 420)
    return () => {
      if (timer.current) clearInterval(timer.current)
    }
  }, [playing, testSorted.length])

  const visible = testSorted.slice(Math.max(0, cursor - 22), cursor).reverse()

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${playing ? "animate-pulse bg-success" : "bg-muted"}`} />
          <span className="font-mono text-[11px] text-muted-foreground">
            {cursor} / {testSorted.length} txns
          </span>
        </div>
        <button onClick={() => setPlaying((p) => !p)} className="font-mono text-[11px] text-primary hover:underline">
          {playing ? "pause" : "resume"}
        </button>
      </div>
      <ScrollArea className="h-[300px] rounded-md border border-border bg-card">
        <div className="divide-y divide-border/60">
          {visible.map((t) => (
            <StreamRow key={t.id} txn={t} threshold={threshold} />
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}

function StreamRow({ txn, threshold }: { txn: ScoredTransaction; threshold: number }) {
  const flagged = txn.score >= threshold
  return (
    <div
      className={`tnum flex items-center gap-3 px-3 py-1.5 font-mono text-[11px] ${flagged ? "bg-critical/10" : ""}`}
    >
      <span className="w-14 shrink-0 text-muted-foreground">{clockTime(txn.ts)}</span>
      <span className="w-20 shrink-0 truncate text-foreground/80">{txn.deviceId}</span>
      <span className="w-14 shrink-0 text-muted-foreground">BIN {txn.cardBin}</span>
      <span className="w-16 shrink-0 text-right text-foreground">{inr(txn.amount)}</span>
      <span className={`w-12 shrink-0 text-right ${txn.outcome === "failed" ? "text-warn" : "text-muted-foreground"}`}>
        {txn.outcome === "failed" ? "fail" : "ok"}
      </span>
      <span className="ml-auto flex items-center gap-2">
        <span className={flagged ? "text-critical" : "text-muted-foreground"}>{txn.score.toFixed(3)}</span>
        <span className={`h-1.5 w-1.5 rounded-full ${flagged ? "bg-critical" : "bg-border"}`} aria-hidden />
      </span>
    </div>
  )
}
