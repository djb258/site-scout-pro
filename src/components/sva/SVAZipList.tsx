import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp, MapPin } from "lucide-react";

export interface ZipInScope {
  zip: string;
  distance_miles: number;
}

interface SVAZipListProps {
  zips: ZipInScope[];
  anchorZip: string;
}

const INITIAL_DISPLAY_COUNT = 50;
const LOAD_MORE_COUNT = 50;

export function SVAZipList({ zips, anchorZip }: SVAZipListProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [displayCount, setDisplayCount] = useState(INITIAL_DISPLAY_COUNT);

  const displayedZips = zips.slice(0, displayCount);
  const hasMore = displayCount < zips.length;
  const remaining = zips.length - displayCount;

  const handleLoadMore = () => {
    setDisplayCount((prev) => Math.min(prev + LOAD_MORE_COUNT, zips.length));
  };

  if (zips.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-4 text-center">
        No ZIPs in scope
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
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">
              ZIPs in Scope
            </span>
            <Badge variant="secondary" className="text-xs">
              {zips.length.toLocaleString()}
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
          <div className="grid grid-cols-2 gap-4 px-4 py-2 bg-muted/50 border-b text-xs font-medium text-muted-foreground">
            <span>ZIP Code</span>
            <span className="text-right">Distance</span>
          </div>

          {/* ZIP List */}
          <div className="max-h-[400px] overflow-y-auto">
            {displayedZips.map((z) => {
              const isAnchor = z.zip === anchorZip;
              return (
                <div
                  key={z.zip}
                  className={`grid grid-cols-2 gap-4 px-4 py-2 border-b last:border-b-0 text-sm ${
                    isAnchor ? "bg-primary/5" : "hover:bg-muted/30"
                  }`}
                >
                  <span className={`font-mono ${isAnchor ? "font-semibold" : ""}`}>
                    {z.zip}
                    {isAnchor && (
                      <Badge variant="outline" className="ml-2 text-xs">
                        anchor
                      </Badge>
                    )}
                  </span>
                  <span className={`text-right ${isAnchor ? "font-semibold" : "text-muted-foreground"}`}>
                    {z.distance_miles.toFixed(2)} mi
                  </span>
                </div>
              );
            })}
          </div>

          {/* Load More / Summary Footer */}
          <div className="px-4 py-3 bg-muted/30 border-t flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Showing {displayedZips.length.toLocaleString()} of {zips.length.toLocaleString()}
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
