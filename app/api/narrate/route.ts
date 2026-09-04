import { generateText } from "ai"
import type { RiskCase } from "@/lib/fraud/types"
import { firedFeatureText, } from "@/lib/fraud/pipeline"
import { entityLabel } from "@/lib/fraud/format"

export const maxDuration = 30

// The LLM is STRICTLY downstream of the detector. It receives an already-computed
// decision (score, action, fired features) and turns it into a human-readable case
// note. It has no access to raw data and cannot alter the numeric verdict.
export async function POST(req: Request) {
  const { case: c } = (await req.json()) as { case: RiskCase }

  if (!c) {
    return Response.json({ summary: "No case supplied." }, { status: 400 })
  }

  const reasons = c.firedFeatures.map(firedFeatureText)
  const decisionFacts = [
    `Entity: ${entityLabel(c.entityKind, c.entityValue)}`,
    `Peak anomaly score: ${c.peakScore.toFixed(3)} (decision already made by the isolation-forest detector)`,
    `Bounded action already selected by the gate: ${c.action}`,
    `Transactions in window: ${c.txnCount}`,
    `Exposure: INR ${Math.round(c.totalAmount)}`,
    `Fired features: ${reasons.length ? reasons.join("; ") : "mild combined elevation, no single dominant feature"}`,
  ].join("\n")

  try {
    const { text } = await generateText({
      model: "anthropic/claude-haiku-4.5",
      system:
        "You are a payments risk analyst assistant at a payment gateway. You write a 2-3 sentence case note " +
        "explaining an ALREADY-MADE fraud-detection decision to a human reviewer. You must NOT invent numbers, " +
        "change the action, or claim the transaction is fraud/legit with certainty — the detector and gate own " +
        "that. Describe what fired and why the bounded action is proportionate. Be terse and concrete. " +
        "Never recommend an autonomous hard block.",
      prompt:
        "Write the case note for the reviewer based only on these logged facts. " +
        `Do not add features that are not listed.\n\n${decisionFacts}`,
    })

    return Response.json({ summary: text.trim() })
  } catch (err) {
    console.log("[v0] narrate error:", err instanceof Error ? err.message : String(err))
    // Fail safe: the decision does not depend on the narration.
    return Response.json({
      summary:
        "Narration unavailable — the decision stands on the logged features. " +
        `Detector flagged ${entityLabel(c.entityKind, c.entityValue)} at score ${c.peakScore.toFixed(3)}; gate applied ${c.action}.`,
    })
  }
}
