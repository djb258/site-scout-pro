/**
 * Pass 1.5 Remediation Checklist Card
 * VERSION: v1.0.0
 * 
 * // DOCTRINE LOCKED — PASS 1.5 COMPLETE
 * DO NOT MODIFY — UI depends on this shape
 * 
 * PURPOSE: Read-only status checklist showing Pass 1.5 pipeline state.
 * One glance tells you where the system is and why it stopped.
 * 
 * NO BUTTONS, NO TRIGGERS, NO ACTIONS
 * NO SCORING, NO RANKING, NO RECOMMENDATIONS
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Ban } from "lucide-react";

// ================================================================
// STATUS INDICATORS
// ================================================================
const STATUS_ICONS = {
  completed: "🟢",
  in_progress: "🟡",
  failed: "🔴",
  not_started: "⚫",
} as const;

type StatusType = keyof typeof STATUS_ICONS;

// ================================================================
// PROPS INTERFACE
// ================================================================
interface ChecklistCardProps {
  queueSummary: {
    total: number;
    pending: number;
    in_progress: number;
    resolved: number;
    failed: number;
    killed: number;
  } | null;
  performance: {
    total_attempts: number;
    success_rate: number;
  } | null;
  guardRailStatus: {
    cost_cap_remaining_cents: number;
    daily_calls_remaining: number;
    failure_rate: number;
    kill_switch_active: boolean;
  } | null;
  costSummary: {
    total_cents: number;
  } | null;
}

// ================================================================
// STATUS DERIVATION LOGIC
// ================================================================
function deriveStepStatus(
  step: number,
  queue: ChecklistCardProps["queueSummary"],
  performance: ChecklistCardProps["performance"],
  guardRail: ChecklistCardProps["guardRailStatus"],
  cost: ChecklistCardProps["costSummary"]
): StatusType {
  if (!queue) return "not_started";

  const hasGaps = queue.total > 0;
  const hasAttempts = (performance?.total_attempts ?? 0) > 0;
  const hasResolved = queue.resolved > 0;
  const hasFailed = queue.failed > 0;
  const hasInProgress = queue.in_progress > 0;
  const hasPending = queue.pending > 0;
  const killSwitchActive = guardRail?.kill_switch_active ?? false;

  switch (step) {
    case 1: // Gap Flags Received
      return hasGaps ? "completed" : "not_started";

    case 2: // Gaps Enqueued
      return hasGaps ? "completed" : "not_started";

    case 3: // Worker Assigned
      if (!hasGaps) return "not_started";
      if (hasInProgress || hasAttempts) return "completed";
      if (hasPending) return "in_progress";
      return "not_started";

    case 4: // Attempt Executed
      if (!hasGaps) return "not_started";
      if (hasAttempts && !hasInProgress) return "completed";
      if (hasInProgress) return "in_progress";
      return "not_started";

    case 5: // Attempt Logged
      if (!hasAttempts) return "not_started";
      return "completed";

    case 6: // Gap Resolved or Failed
      if (!hasGaps) return "not_started";
      if (hasResolved || hasFailed) {
        if (hasPending || hasInProgress) return "in_progress";
        return "completed";
      }
      if (hasAttempts) return "in_progress";
      return "not_started";

    case 7: // Addendum Prepared
      if (!hasResolved) return "not_started";
      return "completed";

    case 8: // Dashboard Updated
      return hasGaps ? "completed" : "not_started";

    case 9: // Guard Rails Checked
      if (killSwitchActive) return "failed";
      if (!hasGaps) return "not_started";
      return "completed";

    case 10: // Pass 1.5 Exit
      if (!hasGaps) return "not_started";
      if (killSwitchActive) return "failed";
      if (hasPending || hasInProgress) return "in_progress";
      if (hasResolved || hasFailed) return "completed";
      return "not_started";

    default:
      return "not_started";
  }
}

// ================================================================
// CHECKLIST STEPS
// ================================================================
const CHECKLIST_STEPS = [
  { step: 1, label: "Gap Flags Received (Pass 1)", sublabel: "inputs validated" },
  { step: 2, label: "Gaps Enqueued", sublabel: "deduped, run_id assigned" },
  { step: 3, label: "Worker Assigned", sublabel: "AI Caller / Scraper" },
  { step: 4, label: "Attempt Executed", sublabel: "within time, cost, retry caps" },
  { step: 5, label: "Attempt Logged", sublabel: "transcript hash + cost recorded" },
  { step: 6, label: "Gap Resolved or Failed", sublabel: "max attempts enforced" },
  { step: 7, label: "Addendum Prepared", sublabel: "vault-ready, not written" },
  { step: 8, label: "Dashboard Updated", sublabel: "observable state" },
  { step: 9, label: "Guard Rails Checked", sublabel: "cost / failure / daily limits" },
  { step: 10, label: "Pass 1.5 Exit", sublabel: "explicit outcomes only" },
];

const HARD_RULES = [
  "No scoring",
  "No ranking",
  "No recommendations",
  "No direct Neon writes",
  "No human judgment",
  "If it's not logged, it didn't happen",
];

// ================================================================
// COMPONENT
// ================================================================
export function Pass15ChecklistCard({
  queueSummary,
  performance,
  guardRailStatus,
  costSummary,
}: ChecklistCardProps) {
  return (
    <Card className="border-purple-500/30 bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-lg">
          <span>PASS 1.5 — REMEDIATION CHECKLIST</span>
          <span className="text-xs font-normal text-muted-foreground">
            {STATUS_ICONS.completed} Completed &nbsp;
            {STATUS_ICONS.in_progress} In Progress &nbsp;
            {STATUS_ICONS.failed} Failed &nbsp;
            {STATUS_ICONS.not_started} Not Started
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Flow Checklist - 2 columns for density */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-1">
          {CHECKLIST_STEPS.map(({ step, label, sublabel }) => {
            const status = deriveStepStatus(
              step,
              queueSummary,
              performance,
              guardRailStatus,
              costSummary
            );
            return (
              <div key={step} className="flex items-start gap-2 py-1">
                <span className="text-base leading-none mt-0.5">{STATUS_ICONS[status]}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {step}. {label}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {sublabel}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Hard Rules - Always visible, cannot be dismissed */}
        <div className="border-t border-border pt-3 mt-3">
          <div className="flex items-center gap-2 mb-2">
            <Ban className="h-4 w-4 text-destructive" />
            <span className="text-sm font-semibold text-destructive">HARD RULES (non-negotiable)</span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {HARD_RULES.map((rule, idx) => (
              <span key={idx} className="text-xs text-muted-foreground">
                • {rule}
              </span>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default Pass15ChecklistCard;
