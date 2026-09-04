"use client"

import { useMemo, useState } from "react"
import { runPipeline } from "@/lib/fraud/pipeline"
import { buildCases } from "@/lib/fraud/pipeline"
import { evaluate, pointAt, DEFAULT_COST } from "@/lib/fraud/evaluate"
import type { ScoredTransaction } from "@/lib/fraud/types"

export interface StreamBin {
  t: number
  total: number
  flagged: number
  fraud: number
  maxScore: number
}

export function useEngine() {
  // Runs the full detector once — deterministic, so it is reproducible across
  // reloads. Heavy-ish (120 iTrees) but only executes a single time.
  const pipeline = useMemo(() => runPipeline(), [])
  const evalResult = useMemo(() => evaluate(pipeline.test, DEFAULT_COST), [pipeline])

  // Operating point defaults to the cost-optimal (min expected-₹-loss) threshold.
  const [threshold, setThreshold] = useState(() => evalResult.optimal.threshold)

  const livePoint = useMemo(() => pointAt(evalResult.curve, threshold), [evalResult, threshold])

  const cases = useMemo(
    () => buildCases(pipeline.test, threshold, pipeline.testFeatureMeans),
    [pipeline, threshold],
  )

  const testSorted = useMemo(
    () => [...pipeline.test].sort((a, b) => a.ts - b.ts),
    [pipeline],
  )

  const window = useMemo(() => {
    const start = testSorted[0]?.ts ?? 0
    const end = testSorted[testSorted.length - 1]?.ts ?? 1
    return { start, end, span: Math.max(1, end - start) }
  }, [testSorted])

  const bins = useMemo<StreamBin[]>(() => {
    const N = 64
    const out: StreamBin[] = Array.from({ length: N }, (_, i) => ({
      t: window.start + (window.span * i) / N,
      total: 0,
      flagged: 0,
      fraud: 0,
      maxScore: 0,
    }))
    for (const t of testSorted) {
      const idx = Math.min(N - 1, Math.floor(((t.ts - window.start) / window.span) * N))
      const b = out[idx]
      b.total++
      if (t.isFraud) b.fraud++
      if (t.score >= threshold) b.flagged++
      if (t.score > b.maxScore) b.maxScore = t.score
    }
    return out
  }, [testSorted, window, threshold])

  return {
    pipeline,
    evalResult,
    threshold,
    setThreshold,
    livePoint,
    cases,
    testSorted,
    window,
    bins,
    cost: DEFAULT_COST,
  }
}

export type Engine = ReturnType<typeof useEngine>

export function visibleUpTo(txns: ScoredTransaction[], ts: number): ScoredTransaction[] {
  return txns.filter((t) => t.ts <= ts)
}
