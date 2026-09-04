import { cn } from "@/lib/utils"
import type { CaseAction, CaseResolution } from "@/lib/fraud/types"
import { ACTION_LABELS } from "@/lib/fraud/format"

const ACTION_STYLE: Record<CaseAction, string> = {
  escalate: "bg-critical/15 text-critical border-critical/30",
  soft_hold: "bg-warn/15 text-warn border-warn/30",
  step_up: "bg-primary/15 text-primary border-primary/30",
  monitor: "bg-muted text-muted-foreground border-border",
}

export function ActionBadge({ action, className }: { action: CaseAction; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide",
        ACTION_STYLE[action],
        className,
      )}
    >
      {ACTION_LABELS[action]}
    </span>
  )
}

export function ResolutionBadge({ resolution }: { resolution: CaseResolution }) {
  const map: Record<CaseResolution, { label: string; cls: string }> = {
    confirmed_fraud: { label: "Confirmed fraud", cls: "bg-critical/15 text-critical border-critical/30" },
    released: { label: "Released · step-up passed", cls: "bg-success/15 text-success border-success/30" },
    pending: { label: "Pending review", cls: "bg-muted text-muted-foreground border-border" },
  }
  const s = map[resolution]
  return (
    <span className={cn("inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[11px] font-medium", s.cls)}>
      {s.label}
    </span>
  )
}

export function ScoreBar({ score, className }: { score: number; className?: string }) {
  // Color the bar by band so a scan of the queue reads instantly.
  const color =
    score >= 0.62 ? "bg-critical" : score >= 0.52 ? "bg-warn" : score >= 0.43 ? "bg-primary" : "bg-muted-foreground"
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${Math.min(100, score * 100)}%` }} />
      </div>
      <span className="tnum w-10 shrink-0 text-right font-mono text-xs text-muted-foreground">{score.toFixed(3)}</span>
    </div>
  )
}
