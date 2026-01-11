import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Database, ArrowRight, Table2 } from "lucide-react";
import { RefTableConfig, getRefTablesForSubHub, refDataStats } from "@/config/ref-schema-registry";

interface RefDataPanelProps {
  subHubId: number;
  compact?: boolean;
}

/**
 * RefDataPanel - Displays reference data dependencies for a sub-hub
 * Shows which ref tables the sub-hub reads from and their lookup directions
 */
export function RefDataPanel({ subHubId, compact = false }: RefDataPanelProps) {
  const refTables = getRefTablesForSubHub(subHubId);

  if (refTables.length === 0) {
    return (
      <Card className="border-border bg-card/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-mono flex items-center gap-2">
            <Database className="h-4 w-4 text-muted-foreground" />
            Reference Data Dependencies
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground italic">
            This sub-hub reads from prior outputs only — no direct reference table dependencies.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border bg-card/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-mono flex items-center gap-2">
          <Database className="h-4 w-4 text-purple-400" />
          Reference Data Dependencies
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {refTables.map((table) => (
          <RefTableItem key={table.table} table={table} compact={compact} />
        ))}

        {!compact && (
          <div className="pt-2 border-t border-border">
            <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
              <span>{refDataStats.uniqueZips.toLocaleString()} ZIPs</span>
              <span>{refDataStats.uniqueCounties.toLocaleString()} Counties</span>
              <span>{refDataStats.statesWithData} States</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface RefTableItemProps {
  table: RefTableConfig;
  compact?: boolean;
}

function RefTableItem({ table, compact }: RefTableItemProps) {
  return (
    <div className="bg-muted/30 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Table2 className="h-3.5 w-3.5 text-muted-foreground" />
          <code className="text-xs font-mono text-foreground">{table.table}</code>
        </div>
        {!compact && (
          <span className="text-[10px] text-muted-foreground">
            {table.rowCount.toLocaleString()} rows
          </span>
        )}
      </div>
      
      <p className="text-xs text-muted-foreground">{table.description}</p>
      
      <div className="flex flex-wrap gap-1">
        {table.anchors.map((anchor) => (
          <Badge 
            key={anchor} 
            variant="outline" 
            className="text-[10px] px-1.5 py-0 font-mono"
          >
            {anchor}
          </Badge>
        ))}
      </div>

      {!compact && (
        <div className="space-y-1">
          {table.lookupDirections.map((direction, i) => (
            <div 
              key={i} 
              className="flex items-center gap-1 text-[10px] text-muted-foreground"
            >
              <ArrowRight className="h-3 w-3 text-primary/50" />
              <span>{direction}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * RefDataStats - Compact stats display for Discover page
 */
export function RefDataStats() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="bg-muted/30 rounded-lg p-3 text-center">
        <div className="text-2xl font-bold text-foreground">
          {refDataStats.totalMappings.toLocaleString()}
        </div>
        <div className="text-xs text-muted-foreground">ZIP↔County Mappings</div>
      </div>
      <div className="bg-muted/30 rounded-lg p-3 text-center">
        <div className="text-2xl font-bold text-foreground">
          {refDataStats.uniqueZips.toLocaleString()}
        </div>
        <div className="text-xs text-muted-foreground">Unique ZIPs</div>
      </div>
      <div className="bg-muted/30 rounded-lg p-3 text-center">
        <div className="text-2xl font-bold text-foreground">
          {refDataStats.uniqueCounties.toLocaleString()}
        </div>
        <div className="text-xs text-muted-foreground">Unique Counties</div>
      </div>
      <div className="bg-muted/30 rounded-lg p-3 text-center">
        <div className="text-2xl font-bold text-foreground">
          {refDataStats.statesWithData}
        </div>
        <div className="text-xs text-muted-foreground">States/Territories</div>
      </div>
    </div>
  );
}
