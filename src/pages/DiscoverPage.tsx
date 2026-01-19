import { Link } from "react-router-dom";
import { Fingerprint, Lock, Warehouse, Database, PlusCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { subHubs, doctrineLocks, summaryAnchors, assetTypes, radiusOptions } from "@/config/discover-page-config";
import { refSchemaRegistry } from "@/config/ref-schema-registry";
import { RefDataStats } from "@/components/RefDataPanel";

export default function DiscoverPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      {/* Header Section - Create Sovereign ID CTA */}
      <Card className="border-primary/20 bg-card">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Fingerprint className="w-6 h-6 text-primary" />
              </div>
              <CardTitle className="text-2xl font-mono">Create Your Market Mandate</CardTitle>
            </div>
            <Button asChild size="lg" className="gap-2">
              <Link to="/sva/create">
                <PlusCircle className="w-5 h-5" />
                Create Sovereign ID
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground italic border-l-2 border-primary/30 pl-3">
            "A Sovereign ID is minted from intent before data collection. All sub-hubs hydrate against this decision container."
          </p>
          
          <div className="grid md:grid-cols-3 gap-4 pt-2">
            <div className="space-y-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Asset Types</span>
              <div className="flex flex-wrap gap-1">
                {assetTypes.map((type) => (
                  <Badge key={type.value} variant="secondary" className="text-xs">
                    {type.label}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Anchor ZIP</span>
              <p className="text-sm text-muted-foreground">5-digit US ZIP → resolves City, State, County, FIPS</p>
            </div>
            <div className="space-y-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Search Radius</span>
              <div className="flex flex-wrap gap-1">
                {radiusOptions.map((opt) => (
                  <Badge key={opt.value} variant="outline" className="text-xs font-mono">
                    {opt.label}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Altitude Overview Diagram (30,000 ft) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Altitude Overview — 30,000 ft</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Flow Diagram */}
          <div className="bg-muted/30 rounded-lg p-6 overflow-x-auto">
            <div className="flex flex-col items-center gap-2 min-w-[600px]">
              {/* Top row */}
              <div className="flex items-center gap-2">
                <div className="px-4 py-2 rounded-md bg-muted text-sm font-medium">Intent</div>
                <span className="text-muted-foreground">→</span>
                <div className="px-4 py-2 rounded-md bg-primary/20 text-primary text-sm font-semibold border border-primary/30">
                  Sovereign ID (SVA)
                </div>
                <span className="text-muted-foreground">→</span>
                <div className="px-4 py-2 rounded-md bg-muted text-sm font-medium">ZIP Scope Resolution</div>
              </div>
              
              {/* Arrow down */}
              <div className="text-muted-foreground text-lg">↓</div>
              
              {/* Sub-hub row */}
              <div className="flex items-center gap-1 flex-wrap justify-center">
                {[0, 1, 2, 3, 4, 5].map((num, idx) => (
                  <div key={num} className="flex items-center">
                    <div className={`px-3 py-1.5 rounded-md text-xs font-mono ${subHubs[num].bgColor} ${subHubs[num].color}`}>
                      Sub-Hub {num}
                    </div>
                    {idx < 5 && <span className="text-muted-foreground mx-1">→</span>}
                  </div>
                ))}
              </div>
              
              {/* Arrow down */}
              <div className="text-muted-foreground text-lg">↓</div>
              
              {/* Final output */}
              <div className="flex items-center gap-3">
                <div className="px-4 py-2 rounded-md bg-green-500/20 text-green-400 text-sm font-semibold border border-green-500/30">
                  GOOD DEAL
                </div>
                <span className="text-muted-foreground">/</span>
                <div className="px-4 py-2 rounded-md bg-red-500/20 text-red-400 text-sm font-semibold border border-red-500/30">
                  BAD DEAL
                </div>
              </div>
            </div>
          </div>

          {/* Summary Anchors */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {summaryAnchors.map((anchor) => (
              <div key={anchor.term} className="space-y-1">
                <span className="font-mono text-sm font-semibold text-primary">{anchor.term}</span>
                <p className="text-xs text-muted-foreground">= {anchor.definition}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Reference Data Schema */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <Database className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <CardTitle className="text-xl">Reference Data Schema</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Bidirectional lookups for anchor resolution. All sub-hubs read from these tables.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Stats Grid */}
          <RefDataStats />

          {/* Reference Tables Accordion */}
          <Accordion type="multiple" className="w-full">
            {refSchemaRegistry.map((table) => (
              <AccordionItem key={table.table} value={table.table}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3">
                    <code className="text-sm font-mono text-primary">{table.table}</code>
                    <span className="text-xs text-muted-foreground">
                      {table.rowCount.toLocaleString()} rows
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3 pl-2">
                    <p className="text-sm text-muted-foreground">{table.description}</p>
                    
                    <div className="flex flex-wrap gap-4">
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground uppercase tracking-wide">Anchors</span>
                        <div className="flex gap-1">
                          {table.anchors.map((anchor) => (
                            <Badge key={anchor} variant="outline" className="font-mono text-xs">
                              {anchor}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground uppercase tracking-wide">Used By</span>
                        <div className="flex gap-1">
                          {table.usedBy.map((hubId) => (
                            <Badge key={hubId} variant="secondary" className="text-xs">
                              Sub-Hub {hubId}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground uppercase tracking-wide">Lookup Directions</span>
                      <div className="flex flex-col gap-1">
                        {table.lookupDirections.map((dir, i) => (
                          <code key={i} className="text-xs bg-muted px-2 py-1 rounded w-fit">
                            {dir}
                          </code>
                        ))}
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>

      {/* Accordion - Sub-Hub Breakdown (20,000 ft) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Sub-Hub Breakdown — 20,000 ft</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {subHubs.map((hub) => {
              const Icon = hub.icon;
              return (
                <AccordionItem key={hub.id} value={`hub-${hub.id}`}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3">
                      <div className={`p-1.5 rounded ${hub.bgColor}`}>
                        <Icon className={`w-4 h-4 ${hub.color}`} />
                      </div>
                      <span className="font-mono text-sm">{hub.id}</span>
                      <span className="font-medium">{hub.title}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="pl-10 space-y-4">
                      {/* Reads / Writes */}
                      <div className="flex flex-wrap gap-4">
                        <div className="space-y-1">
                          <span className="text-xs text-muted-foreground uppercase tracking-wide">Reads</span>
                          <div className="flex flex-wrap gap-1">
                            {hub.reads.map((r) => (
                              <Badge key={r} variant="secondary" className="font-mono text-xs">
                                {r}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <span className="text-xs text-muted-foreground uppercase tracking-wide">Writes</span>
                          <div className="flex flex-wrap gap-1">
                            {hub.writes.map((w) => (
                              <Badge key={w} variant="outline" className="font-mono text-xs">
                                {w}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Purpose */}
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground uppercase tracking-wide">Purpose</span>
                        <p className="text-sm">{hub.purpose}</p>
                      </div>

                      {/* Rule */}
                      <div className={`p-3 rounded-md ${hub.bgColor} border-l-2`} style={{ borderColor: `var(--${hub.color.replace('text-', '')})` }}>
                        <span className="text-xs text-muted-foreground uppercase tracking-wide block mb-1">Rule</span>
                        <p className={`text-sm font-medium ${hub.color}`}>{hub.rule}</p>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </CardContent>
      </Card>

      {/* Footer - Doctrine Locks */}
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Lock className="w-5 h-5 text-amber-400" />
            </div>
            <CardTitle className="text-xl text-amber-400">Doctrine Locks</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {doctrineLocks.map((lock, idx) => (
              <li key={idx} className="flex items-center gap-3 text-sm">
                <Lock className="w-3.5 h-3.5 text-amber-500/60 shrink-0" />
                <span className="text-muted-foreground">{lock}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
