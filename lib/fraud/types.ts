export type Outcome = "success" | "failed"

export type FraudType =
  | "card_testing"
  | "impossible_travel"
  | "device_fanout"

// The ordered list of features the detector consumes. Kept as a const tuple so
// the model, the UI, and the narration layer all agree on names and order.
export const FEATURE_KEYS = [
  "velDevice60s",
  "velIp60s",
  "velBin60s",
  "velCard600s",
  "distinctBinsPerDevice120s",
  "distinctDevicesPerCard600s",
  "distinctCountriesPerCard1h",
  "failRateDevice300s",
  "amountZScore",
  "invTimeSinceCardSec",
] as const

export type FeatureKey = (typeof FEATURE_KEYS)[number]

export type FeatureVector = Record<FeatureKey, number>

// Human-readable labels + the "so what" for the explanation layer.
export const FEATURE_META: Record<FeatureKey, { label: string; unit: string; why: string }> = {
  velDevice60s: { label: "Device velocity", unit: "txn / 60s", why: "attempts from one device in the last minute" },
  velIp60s: { label: "IP velocity", unit: "txn / 60s", why: "attempts from one IP in the last minute" },
  velBin60s: { label: "BIN velocity", unit: "txn / 60s", why: "attempts on one card BIN in the last minute" },
  velCard600s: { label: "Card velocity", unit: "txn / 10m", why: "attempts on one card in ten minutes" },
  distinctBinsPerDevice120s: { label: "BIN fan-in", unit: "BINs / 2m", why: "distinct card BINs tried from one device (card testing)" },
  distinctDevicesPerCard600s: { label: "Device fan-out", unit: "devices / 10m", why: "distinct devices using one card (ATO fan-out)" },
  distinctCountriesPerCard1h: { label: "Geo spread", unit: "countries / 1h", why: "distinct countries for one card (impossible travel)" },
  failRateDevice300s: { label: "Failure rate", unit: "ratio / 5m", why: "share of failed attempts from a device (probing)" },
  amountZScore: { label: "Amount anomaly", unit: "σ vs merchant", why: "how far the amount deviates from the merchant norm" },
  invTimeSinceCardSec: { label: "Burst tightness", unit: "1 / gap", why: "how tightly spaced attempts on one card are" },
}

export interface Transaction {
  id: string
  seq: number
  ts: number // epoch ms
  merchantId: string
  amount: number // INR
  cardBin: string
  cardLast4: string
  deviceId: string
  ip: string
  country: string
  outcome: Outcome
  // Ground truth (never shown to the model; only used for held-out evaluation)
  isFraud: boolean
  fraudType: FraudType | null
  // A legit-but-suspicious cluster we deliberately expect the model to trip on.
  legitTrap: boolean
  split: "train" | "test"
}

export interface ScoredTransaction extends Transaction {
  features: FeatureVector
  score: number // 0..1 anomaly score (higher = more anomalous)
}

export type CaseAction = "monitor" | "step_up" | "soft_hold" | "escalate"

export type CaseResolution = "released" | "confirmed_fraud" | "pending"

export interface FiredFeature {
  key: FeatureKey
  value: number
  contribution: number // relative weight vs. the population
}

export interface RiskCase {
  id: string
  entityKind: "device" | "ip" | "card_bin" | "card"
  entityValue: string
  startTs: number
  endTs: number
  txnIds: string[]
  txnCount: number
  totalAmount: number
  peakScore: number
  meanScore: number
  firedFeatures: FiredFeature[]
  action: CaseAction
  // Ground truth for the demo's honest accounting
  isFraud: boolean
  fraudType: FraudType | null
  legitTrap: boolean
  resolution: CaseResolution
  // Populated by the downstream LLM layer (never influences detection)
  narrative?: string
}

export interface CostConfig {
  falsePositiveCost: number // INR: blocking a real customer (lost revenue + trust)
  falseNegativeCost: number // INR: letting fraud through (chargeback + scheme fine)
}

export interface ThresholdPoint {
  threshold: number
  tp: number
  fp: number
  tn: number
  fn: number
  precision: number
  recall: number
  f1: number
  expectedLoss: number // INR
}

export interface EvalResult {
  curve: ThresholdPoint[]
  optimal: ThresholdPoint // min expected-loss operating point
  bestF1: ThresholdPoint
  baselineLoss: number // expected loss if we block nothing (all fraud slips)
  positives: number
  negatives: number
}
