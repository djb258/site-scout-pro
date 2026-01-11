import { ArrowRight, OctagonX, Zap } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { AnchorBadge } from "@/components/AnchorBadge";
import { SubHubConfig } from "@/config/discover-page-config";

interface SubHubCardProps {
  config: SubHubConfig;
  showMiniDiagram?: boolean;
}

export function SubHubCard({ config, showMiniDiagram = true }: SubHubCardProps) {
  const Icon = config.icon;

  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${config.bgColor}`}>
              <Icon className={`h-5 w-5 ${config.color}`} />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">
                Sub-Hub {config.id} — {config.title}
              </h3>
            </div>
          </div>
        </div>
        
        {/* Anchor Badges */}
        <div className="flex items-center gap-2 mt-3">
          <span className="text-xs text-muted-foreground uppercase tracking-wide">Anchors:</span>
          <div className="flex flex-wrap gap-1.5">
            {config.anchors.map((anchor) => (
              <AnchorBadge key={anchor} anchor={anchor} />
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Mini Diagram */}
        {showMiniDiagram && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 text-sm overflow-x-auto">
            <div className="flex flex-wrap gap-1">
              {config.reads.slice(0, 3).map((r, i) => (
                <span key={i} className="px-2 py-0.5 bg-muted rounded text-xs font-mono text-muted-foreground">
                  {r}
                </span>
              ))}
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <div className={`px-3 py-1 rounded-md border ${config.bgColor} border-current/20 flex-shrink-0`}>
              <span className={`text-xs font-semibold ${config.color}`}>Hub {config.id}</span>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <div className="flex flex-wrap gap-1">
              {config.writes.slice(0, 2).map((w, i) => (
                <span key={i} className="px-2 py-0.5 bg-muted rounded text-xs font-mono text-muted-foreground">
                  {w.length > 20 ? w.slice(0, 20) + "..." : w}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Contract Block */}
        <div className="space-y-3 p-3 rounded-lg bg-muted/20 border border-border/30">
          <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Contract</h4>
          
          <div className="grid gap-2 text-sm">
            {/* Reads */}
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Reads</span>
              <div className="flex flex-wrap gap-1">
                {config.reads.map((r, i) => (
                  <span key={i} className="px-2 py-0.5 bg-green-500/10 text-green-400 rounded text-xs font-medium">
                    {r}
                  </span>
                ))}
              </div>
            </div>

            {/* Writes */}
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Writes</span>
              <div className="flex flex-wrap gap-1">
                {config.writes.map((w, i) => (
                  <span key={i} className="px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded text-xs font-medium">
                    {w}
                  </span>
                ))}
              </div>
            </div>

            {/* Never Does */}
            <div className="flex items-start gap-2 pt-2 border-t border-border/30">
              <OctagonX className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <span className="text-xs text-muted-foreground uppercase tracking-wide">Never Does</span>
                <p className="text-red-400 text-sm font-medium">{config.neverDoes}</p>
              </div>
            </div>

            {/* Kill Switch */}
            <div className="flex items-start gap-2">
              <Zap className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <span className="text-xs text-muted-foreground uppercase tracking-wide">Kill Switch</span>
                <p className="text-amber-400 text-sm font-medium">{config.killSwitch}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Purpose */}
        <div className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Purpose:</span> {config.purpose}
        </div>
      </CardContent>
    </Card>
  );
}
