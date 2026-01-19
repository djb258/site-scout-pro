import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp, Building2 } from "lucide-react";

export interface CountyInScope {
  county_name: string;
  county_fips: string;
  state_id: string;
  min_distance_miles: number;
  zip_count: number;
  total_population: number | null;
}

interface SVACountyListProps {
  counties: CountyInScope[];
  anchorFips: string;
}

const INITIAL_DISPLAY_COUNT = 25;
const LOAD_MORE_COUNT = 25;

export function SVACountyList({ counties, anchorFips }: SVACountyListProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [displayCount, setDisplayCount] = useState(INITIAL_DISPLAY_COUNT);

  const displayedCounties = counties.slice(0, displayCount);
  const hasMore = displayCount < counties.length;
  const remaining = counties.length - displayCount;

  // Calculate total population
  const totalPopulation = counties.reduce((sum, c) => sum + (c.total_population || 0), 0);

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
          <div className="grid grid-cols-4 gap-2 px-4 py-2 bg-muted/50 border-b text-xs font-medium text-muted-foreground">
            <span>County</span>
            <span className="text-right">Distance</span>
            <span className="text-right">ZIPs</span>
            <span className="text-right">Population</span>
          </div>

          {/* County List */}
          <div className="max-h-[400px] overflow-y-auto">
            {displayedCounties.map((c) => {
              const isAnchor = c.county_fips === anchorFips;
              return (
                <div
                  key={c.county_fips}
                  className={`grid grid-cols-4 gap-2 px-4 py-2 border-b last:border-b-0 text-sm ${
                    isAnchor ? "bg-primary/5" : "hover:bg-muted/30"
                  }`}
                >
                  <span className={isAnchor ? "font-semibold" : ""}>
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
