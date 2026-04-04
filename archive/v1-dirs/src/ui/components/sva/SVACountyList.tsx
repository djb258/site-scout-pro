import { useState } from "react";
import { Button } from "@/ui/components/ui/button";
import { Badge } from "@/ui/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/ui/components/ui/collapsible";
import { ChevronDown, ChevronUp, Building2, CheckCircle2, AlertTriangle, Circle } from "lucide-react";

export interface CountyInScope {
  county_name: string;
  county_fips: string;
  state_id: string;
  min_distance_miles: number;
  zip_count: number;
  total_population: number | null;
  // Optional card status fields (populated when fetched from supply_list_counties_with_card_status)
  card_status?: 'PRESENT' | 'PARTIAL' | 'MISSING';
  match_type?: 'fips' | 'name_fallback' | 'none';
  card_details?: {
    envelope_complete: boolean;
    status: string;
    collected_at: string;
  } | null;
}

interface SVACountyListProps {
  counties: CountyInScope[];
  anchorFips: string;
}

const INITIAL_DISPLAY_COUNT = 25;
const LOAD_MORE_COUNT = 25;

function getStatusBadge(status: CountyInScope['card_status']) {
  switch (status) {
    case 'PRESENT':
      return (
        <Badge className="text-xs bg-green-500/10 text-green-600 border-green-500/30 hover:bg-green-500/20">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          PRESENT
        </Badge>
      );
    case 'PARTIAL':
      return (
        <Badge className="text-xs bg-yellow-500/10 text-yellow-600 border-yellow-500/30 hover:bg-yellow-500/20">
          <AlertTriangle className="w-3 h-3 mr-1" />
          PARTIAL
        </Badge>
      );
    case 'MISSING':
      return (
        <Badge variant="outline" className="text-xs text-muted-foreground">
          <Circle className="w-3 h-3 mr-1" />
          MISSING
        </Badge>
      );
    default:
      // Fallback for when card_status is not yet fetched
      return (
        <Badge variant="outline" className="text-xs border-blue-500/50 text-blue-600">
          PENDING
        </Badge>
      );
  }
}

function getMatchTypeIndicator(matchType: CountyInScope['match_type']) {
  if (matchType === 'name_fallback') {
    return (
      <span className="text-yellow-500 ml-1" title="Matched via county name (FIPS not available)">
        ⚠️
      </span>
    );
  }
  return null;
}

export function SVACountyList({ counties, anchorFips }: SVACountyListProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [displayCount, setDisplayCount] = useState(INITIAL_DISPLAY_COUNT);

  const displayedCounties = counties.slice(0, displayCount);
  const hasMore = displayCount < counties.length;
  const remaining = counties.length - displayCount;

  // Calculate total population
  const totalPopulation = counties.reduce((sum, c) => sum + (c.total_population || 0), 0);

  // Calculate status summary if available
  const statusSummary = counties.reduce(
    (acc, c) => {
      if (c.card_status === 'PRESENT') acc.present++;
      else if (c.card_status === 'PARTIAL') acc.partial++;
      else if (c.card_status === 'MISSING') acc.missing++;
      return acc;
    },
    { present: 0, partial: 0, missing: 0 }
  );

  const handleLoadMore = () => {
    setDisplayCount((prev) => Math.min(prev + LOAD_MORE_COUNT, counties.length));
  };

  if (counties.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-4 text-center">
        No counties in scope
      </div>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className="w-full flex items-center justify-between py-2 px-3 h-auto hover:bg-muted/50"
        >
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">
              Counties in Scope
            </span>
            <Badge variant="secondary" className="text-xs">
              {counties.length}
            </Badge>
            <Badge variant="outline" className="text-xs">
              Pop: {totalPopulation.toLocaleString()}
            </Badge>
            {/* Show mini status summary if status data is available */}
            {statusSummary.present > 0 || statusSummary.partial > 0 || statusSummary.missing > 0 ? (
              <div className="flex items-center gap-1 text-xs">
                {statusSummary.present > 0 && (
                  <span className="text-green-600">{statusSummary.present}✓</span>
                )}
                {statusSummary.partial > 0 && (
                  <span className="text-yellow-600">{statusSummary.partial}◐</span>
                )}
                {statusSummary.missing > 0 && (
                  <span className="text-muted-foreground">{statusSummary.missing}○</span>
                )}
              </div>
            ) : null}
          </div>
          {isOpen ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="border rounded-md mt-2 overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-6 gap-2 px-4 py-2 bg-muted/50 border-b text-xs font-medium text-muted-foreground">
            <span className="col-span-2">County</span>
            <span className="text-right">Distance</span>
            <span className="text-right">ZIPs</span>
            <span className="text-right">Population</span>
            <span className="text-center">Card Status</span>
          </div>

          {/* County List */}
          <div className="max-h-[400px] overflow-y-auto">
            {displayedCounties.map((c) => {
              const isAnchor = c.county_fips === anchorFips;
              return (
                <div
                  key={c.county_fips}
                  className={`grid grid-cols-6 gap-2 px-4 py-2 border-b last:border-b-0 text-sm ${
                    isAnchor ? "bg-primary/5" : "hover:bg-muted/30"
                  }`}
                >
                  <span className={`col-span-2 ${isAnchor ? "font-semibold" : ""}`}>
                    {c.county_name}, {c.state_id}
                    {isAnchor && (
                      <Badge variant="outline" className="ml-2 text-xs">
                        anchor
                      </Badge>
                    )}
                  </span>
                  <span className={`text-right ${isAnchor ? "font-semibold" : "text-muted-foreground"}`}>
                    {c.min_distance_miles.toFixed(2)} mi
                  </span>
                  <span className="text-right text-muted-foreground">
                    {c.zip_count}
                  </span>
                  <span className="text-right text-muted-foreground">
                    {(c.total_population || 0).toLocaleString()}
                  </span>
                  <span className="text-center flex items-center justify-center">
                    {getStatusBadge(c.card_status)}
                    {getMatchTypeIndicator(c.match_type)}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Load More / Summary Footer */}
          <div className="px-4 py-3 bg-muted/30 border-t flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Showing {displayedCounties.length} of {counties.length}
            </span>
            {hasMore && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleLoadMore}
                className="text-xs h-7"
              >
                Load {Math.min(LOAD_MORE_COUNT, remaining)} more
              </Button>
            )}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
