import type { Transaction, FeatureVector } from "./types"
import { FEATURE_KEYS } from "./types"

// Streaming, strictly-causal feature extraction. For every transaction we only
// use events at or before its timestamp, so a time-based train/test split has
// zero look-ahead leakage — the model never sees the future.

interface DeviceEvt { ts: number; bin: string; fail: boolean }
interface CardEvt { ts: number; country: string; device: string }

const HOUR = 3_600_000

function countWithin(ts: number[], now: number, windowMs: number): number {
  let c = 0
  for (let i = ts.length - 1; i >= 0; i--) {
    if (now - ts[i] <= windowMs) c++
    else break
  }
  return c
}

export function extractFeatures(txns: Transaction[]): FeatureVector[] {
  const deviceEvts = new Map<string, DeviceEvt[]>()
  const ipTs = new Map<string, number[]>()
  const binTs = new Map<string, number[]>()
  const cardEvts = new Map<string, CardEvt[]>()

  // Welford running stats per merchant (past-only) for amount z-score.
  const mStat = new Map<string, { n: number; mean: number; m2: number }>()

  const prune = <T extends { ts: number } | number>(arr: T[], now: number) => {
    // Drop anything older than the widest window we need (1h).
    let cut = 0
    for (let i = 0; i < arr.length; i++) {
      const t = typeof arr[i] === "number" ? (arr[i] as number) : (arr[i] as { ts: number }).ts
      if (now - t <= HOUR) {
        cut = i
        break
      }
      cut = i + 1
    }
    if (cut > 0) arr.splice(0, cut)
  }

  const out: FeatureVector[] = []

  for (const t of txns) {
    const cardKey = `${t.cardBin}:${t.cardLast4}`
    const now = t.ts

    // --- read PAST state (before inserting current) ---
    const prevCard = cardEvts.get(cardKey)
    const lastCardTs = prevCard && prevCard.length ? prevCard[prevCard.length - 1].ts : null
    const ms = mStat.get(t.merchantId)
    let amountZ = 0
    if (ms && ms.n >= 8) {
      const sd = Math.sqrt(ms.m2 / (ms.n - 1))
      amountZ = sd > 1 ? Math.abs(t.amount - ms.mean) / sd : 0
    }

    // --- insert current event into all indexes ---
    const de = deviceEvts.get(t.deviceId) ?? []
    de.push({ ts: now, bin: t.cardBin, fail: t.outcome === "failed" })
    prune(de, now)
    deviceEvts.set(t.deviceId, de)

    const ie = ipTs.get(t.ip) ?? []
    ie.push(now)
    prune(ie, now)
    ipTs.set(t.ip, ie)

    const be = binTs.get(t.cardBin) ?? []
    be.push(now)
    prune(be, now)
    binTs.set(t.cardBin, be)

    const ce = prevCard ?? []
    ce.push({ ts: now, country: t.country, device: t.deviceId })
    prune(ce, now)
    cardEvts.set(cardKey, ce)

    // --- compute window features (include current) ---
    const velDevice60s = countWithin(de.map((e) => e.ts), now, 60_000)
    const velIp60s = countWithin(ie, now, 60_000)
    const velBin60s = countWithin(be, now, 60_000)
    const velCard600s = countWithin(ce.map((e) => e.ts), now, 600_000)

    const binsInWin = new Set<string>()
    let failN = 0
    let totN = 0
    for (const e of de) {
      if (now - e.ts <= 120_000) binsInWin.add(e.bin)
      if (now - e.ts <= 300_000) {
        totN++
        if (e.fail) failN++
      }
    }
    const distinctBinsPerDevice120s = binsInWin.size
    const failRateDevice300s = totN > 0 ? failN / totN : 0

    const devSet = new Set<string>()
    const ctrySet = new Set<string>()
    for (const e of ce) {
      if (now - e.ts <= 600_000) devSet.add(e.device)
      if (now - e.ts <= HOUR) ctrySet.add(e.country)
    }
    const distinctDevicesPerCard600s = devSet.size
    const distinctCountriesPerCard1h = ctrySet.size

    const gapSec = lastCardTs == null ? 3600 : Math.max(1, (now - lastCardTs) / 1000)
    const invTimeSinceCardSec = 1 / gapSec

    out.push({
      velDevice60s,
      velIp60s,
      velBin60s,
      velCard600s,
      distinctBinsPerDevice120s,
      distinctDevicesPerCard600s,
      distinctCountriesPerCard1h,
      failRateDevice300s,
      amountZScore: amountZ,
      invTimeSinceCardSec,
    })

    // --- update merchant stats AFTER scoring (past-only) ---
    const cur = ms ?? { n: 0, mean: 0, m2: 0 }
    cur.n += 1
    const delta = t.amount - cur.mean
    cur.mean += delta / cur.n
    cur.m2 += delta * (t.amount - cur.mean)
    mStat.set(t.merchantId, cur)
  }

  return out
}

export function toArray(f: FeatureVector): number[] {
  return FEATURE_KEYS.map((k) => f[k])
}
