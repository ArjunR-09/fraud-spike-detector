import type { ScoredTransaction, CostConfig, EvalResult, ThresholdPoint } from "./types"

export const DEFAULT_COST: CostConfig = {
  // Blocking a real customer: lost basket + support + churn/trust erosion.
  falsePositiveCost: 900,
  // Letting fraud settle: chargeback amount + scheme fine + ops handling.
  falseNegativeCost: 6500,
}

// Evaluate ONLY on held-out test transactions with known ground truth, so the
// reported metrics are not self-graded. Threshold selection minimizes expected
// rupee loss under the cost asymmetry, not F1 — the operating point a real risk
// team would actually choose.
export function evaluate(test: ScoredTransaction[], cost: CostConfig = DEFAULT_COST): EvalResult {
  const positives = test.filter((t) => t.isFraud).length
  const negatives = test.length - positives

  const grid: number[] = []
  for (let thr = 0; thr <= 1.0001; thr += 0.005) grid.push(Number(thr.toFixed(3)))

  const curve: ThresholdPoint[] = grid.map((threshold) => {
    let tp = 0
    let fp = 0
    let tn = 0
    let fn = 0
    for (const t of test) {
      const flagged = t.score >= threshold
      if (flagged && t.isFraud) tp++
      else if (flagged && !t.isFraud) fp++
      else if (!flagged && t.isFraud) fn++
      else tn++
    }
    const precision = tp + fp > 0 ? tp / (tp + fp) : 1
    const recall = tp + fn > 0 ? tp / (tp + fn) : 1
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0
    const expectedLoss = fp * cost.falsePositiveCost + fn * cost.falseNegativeCost
    return { threshold, tp, fp, tn, fn, precision, recall, f1, expectedLoss }
  })

  const optimal = curve.reduce((best, p) => (p.expectedLoss < best.expectedLoss ? p : best), curve[0])
  const bestF1 = curve.reduce((best, p) => (p.f1 > best.f1 ? p : best), curve[0])
  const baselineLoss = positives * cost.falseNegativeCost // block nothing

  return { curve, optimal, bestF1, baselineLoss, positives, negatives }
}

export function pointAt(curve: ThresholdPoint[], threshold: number): ThresholdPoint {
  let best = curve[0]
  let bestD = Infinity
  for (const p of curve) {
    const d = Math.abs(p.threshold - threshold)
    if (d < bestD) {
      bestD = d
      best = p
    }
  }
  return best
}
