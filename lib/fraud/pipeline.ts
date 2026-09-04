import type {
  ScoredTransaction,
  RiskCase,
  CaseAction,
  FiredFeature,
  FraudType,
  FeatureKey,
} from "./types"
import { FEATURE_KEYS, FEATURE_META } from "./types"
import { generateStream, DEFAULT_GEN, type GenConfig } from "./generator"
import { extractFeatures, toArray } from "./features"
import { fitIsolationForest, DEFAULT_IF } from "./isolation-forest"

export interface Pipeline {
  all: ScoredTransaction[]
  train: ScoredTransaction[]
  test: ScoredTransaction[]
  forest: { numTrees: number; sampleSize: number }
  testFeatureMeans: Record<FeatureKey, number>
}

export function runPipeline(gen: GenConfig = DEFAULT_GEN): Pipeline {
  const txns = generateStream(gen)
  const features = extractFeatures(txns)

  const trainRows: number[][] = []
  txns.forEach((t, i) => {
    if (t.split === "train") trainRows.push(toArray(features[i]))
  })

  const forest = fitIsolationForest(trainRows, DEFAULT_IF)

  const all: ScoredTransaction[] = txns.map((t, i) => ({
    ...t,
    features: features[i],
    score: forest.score(toArray(features[i])),
  }))

  const test = all.filter((t) => t.split === "test")
  const train = all.filter((t) => t.split === "train")

  // Population means on the held-out set — used to explain which features fired.
  const means = {} as Record<FeatureKey, number>
  for (const k of FEATURE_KEYS) {
    means[k] = test.reduce((s, t) => s + t.features[k], 0) / Math.max(1, test.length)
  }

  return { all, train, test, forest: { numTrees: forest.numTrees, sampleSize: forest.sampleSize }, testFeatureMeans: means }
}

// ---- Incident grouping -------------------------------------------------
// Turn individual flagged transactions into auditable cases keyed on the
// entity that best explains them. Gated actions only — never an autonomous block.

function primaryEntity(t: ScoredTransaction): { kind: RiskCase["entityKind"]; value: string; signal: number } {
  const f = t.features
  const candidates: { kind: RiskCase["entityKind"]; value: string; signal: number }[] = [
    { kind: "device", value: t.deviceId, signal: f.velDevice60s + f.distinctBinsPerDevice120s * 2 + f.failRateDevice300s * 4 },
    { kind: "card", value: `${t.cardBin}:${t.cardLast4}`, signal: f.distinctDevicesPerCard600s * 2 + f.distinctCountriesPerCard1h * 3 + f.velCard600s },
    { kind: "ip", value: t.ip, signal: f.velIp60s },
    { kind: "card_bin", value: t.cardBin, signal: f.velBin60s },
  ]
  return candidates.reduce((a, b) => (b.signal > a.signal ? b : a))
}

function actionFor(peak: number, threshold: number): CaseAction {
  if (peak >= 0.62) return "escalate"
  if (peak >= 0.52) return "soft_hold"
  if (peak >= threshold) return "step_up"
  return "monitor"
}

const GAP_MS = 8 * 60_000

export function buildCases(
  test: ScoredTransaction[],
  threshold: number,
  means: Record<FeatureKey, number>,
): RiskCase[] {
  const flagged = test.filter((t) => t.score >= threshold).sort((a, b) => a.ts - b.ts)

  interface Open { key: string; case: RiskCase; txns: ScoredTransaction[] }
  const open = new Map<string, Open>()
  const done: Open[] = []

  for (const t of flagged) {
    const ent = primaryEntity(t)
    const key = `${ent.kind}:${ent.value}`
    const existing = open.get(key)
    if (existing && t.ts - existing.case.endTs <= GAP_MS) {
      existing.txns.push(t)
      existing.case.endTs = t.ts
    } else {
      if (existing) done.push(existing)
      const c: RiskCase = {
        id: `case_${ent.kind}_${done.length + open.size}`,
        entityKind: ent.kind,
        entityValue: ent.value,
        startTs: t.ts,
        endTs: t.ts,
        txnIds: [],
        txnCount: 0,
        totalAmount: 0,
        peakScore: 0,
        meanScore: 0,
        firedFeatures: [],
        action: "monitor",
        isFraud: false,
        fraudType: null,
        legitTrap: false,
        resolution: "pending",
      }
      open.set(key, { key, case: c, txns: [t] })
    }
  }
  for (const o of open.values()) done.push(o)

  const cases = done.map(({ case: c, txns }) => {
    c.txnIds = txns.map((t) => t.id)
    c.txnCount = txns.length
    c.totalAmount = txns.reduce((s, t) => s + t.amount, 0)
    c.peakScore = Math.max(...txns.map((t) => t.score))
    c.meanScore = txns.reduce((s, t) => s + t.score, 0) / txns.length

    // Which features fired: mean feature value in the case vs. population mean.
    const fired: FiredFeature[] = FEATURE_KEYS.map((k) => {
      const val = txns.reduce((s, t) => s + t.features[k], 0) / txns.length
      const base = means[k] + 1e-6
      return { key: k, value: val, contribution: val / base }
    })
      .filter((f) => f.contribution >= 1.4 && f.value > 0)
      .sort((a, b) => b.contribution - a.contribution)
      .slice(0, 4)
    c.firedFeatures = fired

    // Ground-truth accounting (held-out only, for honest metrics on screen).
    const fraudTxns = txns.filter((t) => t.isFraud)
    c.isFraud = fraudTxns.length >= Math.ceil(txns.length / 2)
    c.legitTrap = txns.some((t) => t.legitTrap)
    const typeCounts = new Map<FraudType, number>()
    for (const t of fraudTxns) if (t.fraudType) typeCounts.set(t.fraudType, (typeCounts.get(t.fraudType) ?? 0) + 1)
    c.fraudType = [...typeCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

    c.action = actionFor(c.peakScore, threshold)
    // Bounded outcome: a legit customer caught by a soft gate is released once
    // step-up auth passes; a confirmed pattern is escalated to a human queue.
    c.resolution = c.isFraud ? "confirmed_fraud" : "released"
    return c
  })

  return cases.sort((a, b) => b.peakScore - a.peakScore)
}

export function firedFeatureText(f: FiredFeature): string {
  const meta = FEATURE_META[f.key]
  return `${meta.label} ${f.value.toFixed(f.value < 5 ? 2 : 0)} (${f.contribution.toFixed(1)}x baseline) — ${meta.why}`
}
