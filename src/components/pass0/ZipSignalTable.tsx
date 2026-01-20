import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, Radio, MapPin } from "lucide-react";
import { SignalDetailDrawer } from "./SignalDetailDrawer";
import { formatDistanceToNow } from "date-fns";

interface SignalRow {
  signal_id: string;
  zip_code: string;
  signal_type: string;
  source_name: string;
  source_url: string | null;
  raw_excerpt: string | null;
  signal_strength_hint: "low" | "medium" | "high" | null;
  signal_category_version: string;
  observed_at: string;
}

interface ZipSignalGroup {
  zip_code: string;
  signal_count: number;
  latest_signal_at: string | null;
  signals: SignalRow[];
}

interface ZipSignalTableProps {
  zips: ZipSignalGroup[];
  anchorZip: string;
}

const getStrengthBadge = (strength: string | null) => {
  switch (strength) {
    case "high":
      return <Badge className="bg-green-500/10 text-green-600 border-green-500/30">High</Badge>;
    case "medium":
      return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/30">Medium</Badge>;
    case "low":
      return <Badge className="bg-slate-500/10 text-slate-600 border-slate-500/30">Low</Badge>;
    default:
      return <Badge variant="outline">Unknown</Badge>;
  }
};

const getTypeBadge = (type: string) => {
  const typeColors: Record<string, string> = {
    news: "bg-blue-500/10 text-blue-600 border-blue-500/30",
    permit: "bg-purple-500/10 text-purple-600 border-purple-500/30",
    infrastructure: "bg-orange-500/10 text-orange-600 border-orange-500/30",
    growth: "bg-green-500/10 text-green-600 border-green-500/30",
    storage: "bg-pink-500/10 text-pink-600 border-pink-500/30",
  };
  return (
    <Badge className={typeColors[type] || "bg-muted text-muted-foreground"}>
      {type}
    </Badge>
  );
};

export function ZipSignalTable({ zips, anchorZip }: ZipSignalTableProps) {
  const [expandedZips, setExpandedZips] = useState<Set<string>>(new Set());
  const [selectedSignal, setSelectedSignal] = useState<SignalRow | null>(null);
  const [displayCount, setDisplayCount] = useState(20);

  const toggleZip = (zip: string) => {
    const newExpanded = new Set(expandedZips);
    if (newExpanded.has(zip)) {
      newExpanded.delete(zip);
    } else {
      newExpanded.add(zip);
    }
    setExpandedZips(newExpanded);
  };

  const displayedZips = zips.slice(0, displayCount);
  const hasMore = zips.length > displayCount;
  const zipsWithSignals = zips.filter((z) => z.signal_count > 0);

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Radio className="h-4 w-4" />
            ZIP Signal Summary
          </CardTitle>
          <CardDescription>
            {zipsWithSignals.length} ZIPs with signals out of {zips.length} in scope
          </CardDescription>
        </CardHeader>
        <CardContent>
          {zips.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No ZIPs in scope. Rebuild scope from SVA detail page.
            </p>
          ) : zipsWithSignals.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No signals detected yet. Signals are ingested externally.
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>ZIP</TableHead>
                    <TableHead className="text-center">Signals</TableHead>
                    <TableHead>Latest</TableHead>
                    <TableHead>Top Strength</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedZips.map((zipGroup) => {
                    const isExpanded = expandedZips.has(zipGroup.zip_code);
                    const isAnchor = zipGroup.zip_code === anchorZip;
                    const topStrength = zipGroup.signals[0]?.signal_strength_hint || null;

                    if (zipGroup.signal_count === 0) return null;

                    return (
                      <Collapsible key={zipGroup.zip_code} open={isExpanded} asChild>
                        <>
                          <CollapsibleTrigger asChild>
                            <TableRow
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => toggleZip(zipGroup.zip_code)}
                            >
                              <TableCell className="w-10">
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </TableCell>
                              <TableCell className="font-mono">
                                <span className="flex items-center gap-1">
                                  {isAnchor && <MapPin className="h-3 w-3 text-primary" />}
                                  {zipGroup.zip_code}
                                  {isAnchor && (
                                    <Badge variant="outline" className="text-xs ml-1">
                                      Anchor
                                    </Badge>
                                  )}
                                </span>
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant="secondary">{zipGroup.signal_count}</Badge>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {zipGroup.latest_signal_at
                                  ? formatDistanceToNow(new Date(zipGroup.latest_signal_at), {
                                      addSuffix: true,
                                    })
                                  : "—"}
                              </TableCell>
                              <TableCell>{getStrengthBadge(topStrength)}</TableCell>
                            </TableRow>
                          </CollapsibleTrigger>
                          <CollapsibleContent asChild>
                            <TableRow className="bg-muted/30">
                              <TableCell colSpan={5} className="p-0">
                                <div className="p-4 space-y-2">
                                  {zipGroup.signals.map((signal) => (
                                    <div
                                      key={signal.signal_id}
                                      className="flex items-center justify-between p-2 rounded-md bg-background border cursor-pointer hover:border-primary/50"
                                      onClick={() => setSelectedSignal(signal)}
                                    >
                                      <div className="flex items-center gap-2">
                                        {getTypeBadge(signal.signal_type)}
                                        <span className="text-sm font-medium">
                                          {signal.source_name}
                                        </span>
                                        {signal.raw_excerpt && (
                                          <span className="text-sm text-muted-foreground truncate max-w-[300px]">
                                            — {signal.raw_excerpt}
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        {getStrengthBadge(signal.signal_strength_hint)}
                                        <span className="text-xs text-muted-foreground">
                                          {formatDistanceToNow(new Date(signal.observed_at), {
                                            addSuffix: true,
                                          })}
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </TableCell>
                            </TableRow>
                          </CollapsibleContent>
                        </>
                      </Collapsible>
                    );
                  })}
                </TableBody>
              </Table>

              {hasMore && (
                <div className="flex justify-center mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDisplayCount((prev) => prev + 20)}
                  >
                    Load More ({zips.length - displayCount} remaining)
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Signal Detail Drawer */}
      <SignalDetailDrawer
        signal={selectedSignal}
        open={!!selectedSignal}
        onOpenChange={(open) => !open && setSelectedSignal(null)}
      />
    </>
  );
}
