import { useState, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  Building2, 
  ArrowUpDown,
  ExternalLink,
  Phone,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { CompetitorData, calculateCompetitorMetrics } from "./CompetitorCard";

type SortColumn = "name" | "zip" | "avg_price_sqft" | "units" | "total_sqft";
type SortDirection = "asc" | "desc";
type RentTier = "low" | "medium" | "high" | "unknown";

// Calculate rent tier based on avg price per sqft
// These thresholds can be adjusted based on market data
function getRentTier(avgPricePerSqft: number | null): RentTier {
  if (avgPricePerSqft === null) return "unknown";
  if (avgPricePerSqft < 0.75) return "low";
  if (avgPricePerSqft < 1.25) return "medium";
  return "high";
}

function getRentTierStyles(tier: RentTier) {
  switch (tier) {
    case "low":
      return { bg: "bg-emerald-500/20", text: "text-emerald-400", border: "border-emerald-500/50" };
    case "medium":
      return { bg: "bg-amber-500/20", text: "text-amber-400", border: "border-amber-500/50" };
    case "high":
      return { bg: "bg-red-500/20", text: "text-red-400", border: "border-red-500/50" };
    default:
      return { bg: "bg-muted", text: "text-muted-foreground", border: "border-muted" };
  }
}

interface CompetitorSheetProps {
  competitors: CompetitorData[];
  trigger?: React.ReactNode;
}

export function CompetitorSheet({ competitors, trigger }: CompetitorSheetProps) {
  const [sortColumn, setSortColumn] = useState<SortColumn>("avg_price_sqft");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Enrich competitors with calculated metrics
  const enrichedCompetitors = useMemo(() => {
    return competitors.map(c => ({
      ...c,
      metrics: calculateCompetitorMetrics(c),
      rentTier: getRentTier(calculateCompetitorMetrics(c).avg_price_per_sqft)
    }));
  }, [competitors]);

  // Sort competitors
  const sortedCompetitors = useMemo(() => {
    return [...enrichedCompetitors].sort((a, b) => {
      let comparison = 0;
      switch (sortColumn) {
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "zip":
          comparison = a.zip.localeCompare(b.zip);
          break;
        case "avg_price_sqft":
          const aPrice = a.metrics.avg_price_per_sqft ?? Infinity;
          const bPrice = b.metrics.avg_price_per_sqft ?? Infinity;
          comparison = aPrice - bPrice;
          break;
        case "units":
          comparison = a.units.length - b.units.length;
          break;
        case "total_sqft":
          comparison = (a.total_sqft ?? 0) - (b.total_sqft ?? 0);
          break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [enrichedCompetitors, sortColumn, sortDirection]);

  // Group by rent tier for summary
  const tierCounts = useMemo(() => {
    return enrichedCompetitors.reduce((acc, c) => {
      acc[c.rentTier] = (acc[c.rentTier] || 0) + 1;
      return acc;
    }, {} as Record<RentTier, number>);
  }, [enrichedCompetitors]);

  const toggleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const formatCurrency = (value: number | null) => {
    if (value === null) return "—";
    return `$${value.toFixed(2)}`;
  };

  const SortHeader = ({ column, label }: { column: SortColumn; label: string }) => (
    <button
      onClick={() => toggleSort(column)}
      className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
    >
      {label}
      <ArrowUpDown className="h-3 w-3" />
    </button>
  );

  return (
    <Sheet>
      <SheetTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Building2 className="h-4 w-4 mr-2" />
            View Competitors ({competitors.length})
          </Button>
        )}
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Competitors ({competitors.length})
          </SheetTitle>
        </SheetHeader>

        {/* Tier Summary */}
        <div className="flex gap-2 mt-4">
          {(["low", "medium", "high"] as RentTier[]).map(tier => {
            const styles = getRentTierStyles(tier);
            const count = tierCounts[tier] || 0;
            return (
              <Badge 
                key={tier}
                variant="outline" 
                className={`${styles.bg} ${styles.text} ${styles.border} capitalize`}
              >
                {tier}: {count}
              </Badge>
            );
          })}
          {tierCounts.unknown > 0 && (
            <Badge variant="outline" className="text-muted-foreground">
              Unknown: {tierCounts.unknown}
            </Badge>
          )}
        </div>

        <Separator className="my-4" />

        {/* Sortable Header */}
        <div className="grid grid-cols-12 gap-2 px-2 mb-2">
          <div className="col-span-4">
            <SortHeader column="name" label="Name" />
          </div>
          <div className="col-span-2">
            <SortHeader column="zip" label="ZIP" />
          </div>
          <div className="col-span-2 text-right">
            <SortHeader column="avg_price_sqft" label="$/Sqft" />
          </div>
          <div className="col-span-2 text-right">
            <SortHeader column="units" label="Units" />
          </div>
          <div className="col-span-2 text-right">
            <SortHeader column="total_sqft" label="Total Sqft" />
          </div>
        </div>

        <ScrollArea className="h-[calc(100vh-220px)]">
          <div className="space-y-1">
            {sortedCompetitors.map((competitor) => {
              const isExpanded = expandedId === competitor.id;
              const tierStyles = getRentTierStyles(competitor.rentTier);
              
              return (
                <div 
                  key={competitor.id}
                  className="border border-border rounded-md overflow-hidden"
                >
                  {/* Row */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : competitor.id)}
                    className="w-full grid grid-cols-12 gap-2 px-3 py-2 text-left hover:bg-muted/50 transition-colors"
                  >
                    <div className="col-span-4 flex items-center gap-2">
                      <Badge 
                        variant="outline" 
                        className={`${tierStyles.bg} ${tierStyles.text} ${tierStyles.border} text-[10px] px-1`}
                      >
                        {competitor.rentTier.charAt(0).toUpperCase()}
                      </Badge>
                      <span className="text-sm font-medium truncate">{competitor.name}</span>
                    </div>
                    <div className="col-span-2 text-sm text-muted-foreground">
                      {competitor.zip}
                    </div>
                    <div className="col-span-2 text-sm text-right font-medium">
                      {formatCurrency(competitor.metrics.avg_price_per_sqft)}
                    </div>
                    <div className="col-span-2 text-sm text-right text-muted-foreground">
                      {competitor.units.length}
                    </div>
                    <div className="col-span-2 text-sm text-right text-muted-foreground flex items-center justify-end gap-1">
                      {competitor.total_sqft?.toLocaleString() ?? "—"}
                      {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </div>
                  </button>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="px-3 py-3 bg-muted/30 border-t border-border space-y-3">
                      {/* Address & Contact */}
                      <div className="text-sm">
                        <p className="text-foreground">{competitor.address}</p>
                        <div className="flex items-center gap-4 mt-1">
                          {competitor.phone && (
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <Phone className="h-3 w-3" />
                              {competitor.phone}
                            </span>
                          )}
                          {competitor.url && (
                            <a 
                              href={competitor.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-primary hover:underline"
                            >
                              <ExternalLink className="h-3 w-3" />
                              Website
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Unit Prices Table */}
                      {competitor.units.length > 0 && (
                        <div className="rounded border border-border overflow-hidden">
                          <table className="w-full text-xs">
                            <thead className="bg-muted/50">
                              <tr>
                                <th className="px-2 py-1 text-left font-medium text-muted-foreground">Size</th>
                                <th className="px-2 py-1 text-right font-medium text-muted-foreground">Sqft</th>
                                <th className="px-2 py-1 text-right font-medium text-muted-foreground">Price</th>
                                <th className="px-2 py-1 text-right font-medium text-muted-foreground">$/Sqft</th>
                              </tr>
                            </thead>
                            <tbody>
                              {competitor.units.map((unit, i) => (
                                <tr key={i} className="border-t border-border">
                                  <td className="px-2 py-1">{unit.dimensions}</td>
                                  <td className="px-2 py-1 text-right">{unit.sqft}</td>
                                  <td className="px-2 py-1 text-right">${unit.price}</td>
                                  <td className="px-2 py-1 text-right text-muted-foreground">
                                    ${unit.price_per_sqft.toFixed(2)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Metadata */}
                      {(competitor.source || competitor.fetched_at) && (
                        <div className="flex gap-3 text-xs text-muted-foreground">
                          {competitor.source && <span>Source: {competitor.source}</span>}
                          {competitor.fetched_at && (
                            <span>Fetched: {new Date(competitor.fetched_at).toLocaleDateString()}</span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
