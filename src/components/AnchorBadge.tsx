import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { anchorDefinitions } from "@/config/discover-page-config";

interface AnchorBadgeProps {
  anchor: string;
  showTooltip?: boolean;
}

const anchorStyles: Record<string, string> = {
  "ZIP": "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "County FIPS": "bg-amber-500/20 text-amber-400 border-amber-500/30",
  "SVA": "bg-purple-500/20 text-purple-400 border-purple-500/30",
  "Parcel ID": "bg-cyan-500/20 text-cyan-400 border-cyan-500/30 border-dashed",
};

export function AnchorBadge({ anchor, showTooltip = true }: AnchorBadgeProps) {
  const style = anchorStyles[anchor] || "bg-muted text-muted-foreground border-muted";
  const definition = anchorDefinitions[anchor];

  const badge = (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-mono font-medium rounded border ${style}`}
    >
      {anchor}
    </span>
  );

  if (!showTooltip || !definition) {
    return badge;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p className="text-xs">{definition}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
