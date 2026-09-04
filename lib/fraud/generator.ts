import type { Transaction, Outcome, FraudType } from "./types"
import { mulberry32, randInt, pick, gaussian, type Rng } from "./rng"

const MERCHANTS = [
  { id: "mrc_kirana", mean: 480, sd: 160 },
  { id: "mrc_streamly", mean: 199, sd: 40 },
  { id: "mrc_swifttix", mean: 1450, sd: 700 },
  { id: "mrc_glowmart", mean: 899, sd: 380 },
  { id: "mrc_fuelup", mean: 2200, sd: 900 },
  { id: "mrc_edukart", mean: 3499, sd: 500 },
] as const

const HOME_COUNTRIES = ["IN", "IN", "IN", "IN", "SG", "AE"] as const
const FAR_COUNTRIES = ["US", "RU", "BR", "NG", "GB", "DE"] as const
// Realistic-ish Indian issuer BIN prefixes (fictional, for demo only)
const COMMON_BINS = ["414367", "524312", "607385", "652789", "436817", "533108"]

function makeIp(rng: Rng): string {
  return `${randInt(rng, 14, 223)}.${randInt(rng, 0, 255)}.${randInt(rng, 0, 255)}.${randInt(rng, 1, 254)}`
}
function last4(rng: Rng): string {
  return String(randInt(rng, 0, 9999)).padStart(4, "0")
}
function randomBin(rng: Rng): string {
  // Occasionally reuse a common BIN, otherwise a fresh 6-digit BIN.
  if (rng() < 0.55) return pick(rng, COMMON_BINS)
  return String(randInt(rng, 400000, 659999))
}

export interface GenConfig {
  seed: number
  windowMs: number
  normalUsers: number
  trainFraction: number
}

export const DEFAULT_GEN: GenConfig = {
  seed: 0x5eed,
  windowMs: 6 * 60 * 60 * 1000, // 6h
  normalUsers: 220,
  trainFraction: 0.62,
}

interface Draft {
  ts: number
  merchantId: string
  amount: number
  cardBin: string
  cardLast4: string
  deviceId: string
  ip: string
  country: string
  outcome: Outcome
  isFraud: boolean
  fraudType: FraudType | null
  legitTrap: boolean
}

export function generateStream(cfg: GenConfig = DEFAULT_GEN): Transaction[] {
  const rng = mulberry32(cfg.seed)
  const t0 = Date.UTC(2026, 8, 2, 18, 0, 0) // fixed base so replay is stable
  const drafts: Draft[] = []

  const amountFor = (m: (typeof MERCHANTS)[number]) =>
    Math.max(29, Math.round(gaussian(rng, m.mean, m.sd)))

  // ---- 1. Normal background traffic -------------------------------------
  for (let u = 0; u < cfg.normalUsers; u++) {
    const device = `dev_${(1000 + u).toString(36)}`
    const ip = makeIp(rng)
    const country = pick(rng, HOME_COUNTRIES)
    const bin = randomBin(rng)
    const card = last4(rng)
    const n = randInt(rng, 2, 9)
    for (let i = 0; i < n; i++) {
      const m = pick(rng, MERCHANTS)
      // Small, realistic organic failure rate.
      const outcome: Outcome = rng() < 0.06 ? "failed" : "success"
      drafts.push({
        ts: t0 + Math.floor(rng() * cfg.windowMs),
        merchantId: m.id,
        amount: amountFor(m),
        cardBin: bin,
        cardLast4: card,
        deviceId: device,
        ip,
        country,
        outcome,
        isFraud: false,
        fraudType: null,
        legitTrap: false,
      })
    }
  }

  // ---- 2. Legit-but-suspicious clusters (the FP traps) -------------------
  // These deliberately mimic fraud signatures so the model cannot get a free
  // precision of 1.0. Ground truth = NOT fraud.
  const legitTraps = 7
  for (let c = 0; c < legitTraps; c++) {
    const start = t0 + Math.floor(rng() * (cfg.windowMs - 600_000))
    const kind = rng()
    if (kind < 0.55) {
      // Frustrated retry storm: one real customer retrying a flaky checkout.
      const device = `dev_retry_${c}`
      const ip = makeIp(rng)
      const bin = pick(rng, COMMON_BINS)
      const card = last4(rng)
      const m = pick(rng, MERCHANTS)
      const attempts = randInt(rng, 6, 11)
      for (let i = 0; i < attempts; i++) {
        drafts.push({
          ts: start + i * randInt(rng, 3000, 14000),
          merchantId: m.id,
          amount: amountFor(m),
          cardBin: bin,
          cardLast4: card,
          deviceId: device,
          ip,
          country: "IN",
          // Fails from a bank outage, then finally succeeds.
          outcome: i < attempts - 2 ? "failed" : "success",
          isFraud: false,
          fraudType: null,
          legitTrap: true,
        })
      }
    } else {
      // Genuine roaming / VPN: same card, two countries within the hour.
      const device = `dev_travel_${c}`
      const bin = pick(rng, COMMON_BINS)
      const card = last4(rng)
      const legs = 2
      for (let l = 0; l < legs; l++) {
        const m = pick(rng, MERCHANTS)
        drafts.push({
          ts: start + l * randInt(rng, 1_200_000, 2_400_000),
          merchantId: m.id,
          amount: amountFor(m),
          cardBin: bin,
          cardLast4: card,
          deviceId: device,
          ip: makeIp(rng),
          country: l === 0 ? "IN" : pick(rng, ["SG", "AE", "GB"]),
          outcome: "success",
          isFraud: false,
          fraudType: null,
          legitTrap: true,
        })
      }
    }
  }

  // ---- 3. Injected fraud clusters ---------------------------------------
  // Mix of LOUD clusters (easy) and QUIET clusters (blended, hard) so recall
  // is realistic and there are genuine false negatives.
  const injectFraud = (start: number, type: FraudType, loud: boolean) => {
    if (type === "card_testing") {
      const device = `dev_bot_${drafts.length}`
      const ip = makeIp(rng)
      const attempts = loud ? randInt(rng, 12, 22) : randInt(rng, 5, 8)
      const span = loud ? randInt(rng, 45_000, 90_000) : randInt(rng, 180_000, 320_000)
      for (let i = 0; i < attempts; i++) {
        drafts.push({
          ts: start + Math.floor((i / attempts) * span) + randInt(rng, 0, 2500),
          merchantId: pick(rng, MERCHANTS).id,
          amount: randInt(rng, 29, 120), // tiny "is this card live?" probes
          cardBin: randomBin(rng),
          cardLast4: last4(rng),
          deviceId: device,
          ip,
          country: "IN",
          outcome: i < attempts - randInt(rng, 1, 2) ? "failed" : "success",
          isFraud: true,
          fraudType: type,
          legitTrap: false,
        })
      }
    } else if (type === "impossible_travel") {
      const bin = pick(rng, COMMON_BINS)
      const card = last4(rng)
      const hops = loud ? randInt(rng, 3, 4) : 2
      const span = loud ? randInt(rng, 120_000, 300_000) : randInt(rng, 500_000, 800_000)
      for (let i = 0; i < hops; i++) {
        const m = pick(rng, MERCHANTS)
        drafts.push({
          ts: start + Math.floor((i / hops) * span),
          merchantId: m.id,
          amount: amountFor(m) + (loud ? randInt(rng, 500, 3000) : 0),
          cardBin: bin,
          cardLast4: card,
          deviceId: `dev_ato_${drafts.length}`,
          ip: makeIp(rng),
          country: i === 0 ? "IN" : pick(rng, FAR_COUNTRIES),
          outcome: "success",
          isFraud: true,
          fraudType: type,
          legitTrap: false,
        })
      }
    } else {
      // device_fanout: one stolen card sprayed across many devices/IPs.
      const bin = pick(rng, COMMON_BINS)
      const card = last4(rng)
      const fan = loud ? randInt(rng, 9, 15) : randInt(rng, 4, 6)
      const span = loud ? randInt(rng, 120_000, 360_000) : randInt(rng, 600_000, 1_000_000)
      for (let i = 0; i < fan; i++) {
        const m = pick(rng, MERCHANTS)
        drafts.push({
          ts: start + Math.floor((i / fan) * span) + randInt(rng, 0, 5000),
          merchantId: m.id,
          amount: amountFor(m),
          cardBin: bin,
          cardLast4: card,
          deviceId: `dev_fan_${drafts.length}_${i}`,
          ip: makeIp(rng),
          country: pick(rng, ["IN", "IN", "SG"]),
          outcome: rng() < 0.25 ? "failed" : "success",
          isFraud: true,
          fraudType: type,
          legitTrap: false,
        })
      }
    }
  }

  const fraudTypes: FraudType[] = ["card_testing", "impossible_travel", "device_fanout"]
  const clusters = 16
  for (let c = 0; c < clusters; c++) {
    const start = t0 + Math.floor(rng() * (cfg.windowMs - 1_000_000))
    const type = pick(rng, fraudTypes)
    injectFraud(start, type, rng() < 0.6) // ~40% quiet/blended
  }

  // ---- Finalize: sort by time, assign seq + split ------------------------
  drafts.sort((a, b) => a.ts - b.ts)
  const splitTs = t0 + cfg.windowMs * cfg.trainFraction
  return drafts.map((d, i) => ({
    ...d,
    id: `txn_${i.toString().padStart(5, "0")}`,
    seq: i,
    split: d.ts <= splitTs ? "train" : "test",
  }))
}
