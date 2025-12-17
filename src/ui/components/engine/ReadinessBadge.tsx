import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type ReadinessStatus = "ready" | "attention" | "blocked";

interface ReadinessBadgeProps {
  status: ReadinessStatus;
  className?: string;
}

export function ReadinessBadge({ status, className }: ReadinessBadgeProps) {
  const config = {
    ready: {
      label: "Pass-2 Ready",
      icon: CheckCircle2,
      variant: "default" as const,
      className: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30",
    },
    attention: {
      label: "Needs Attention",
      icon: AlertCircle,
      variant: "secondary" as const,
      className: "bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/30",
    },
    blocked: {
      label: "Blocked",
      icon: XCircle,
      variant: "destructive" as const,
      className: "bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30",
    },
  };

  const { label, icon: Icon, className: badgeClassName } = config[status];

  return (
    <Badge 
      variant="outline" 
      className={cn("gap-1.5 py-1 px-2.5", badgeClassName, className)}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </Badge>
  );
}

export function getReadinessStatus(
  pass2Ready: boolean,
  validationScore?: number,
  blockers?: string[]
): ReadinessStatus {
  if (blockers && blockers.length > 0) return "blocked";
  if (!pass2Ready) return "attention";
  if (validationScore !== undefined && validationScore < 50) return "attention";
  return "ready";
}