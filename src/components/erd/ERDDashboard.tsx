import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Database, FileCheck, AlertTriangle, Layers } from "lucide-react";
import { ERD_REGISTRY } from "@/config/erd-registry";

interface ERDStats {
  totalSubHubs: number;
  totalTables: number;
  writeTables: number;
  readTables: number;
  deprecatedTables: number;
}

// Static stats based on ERD registry - in production would be computed from content
const STATS: ERDStats = {
  totalSubHubs: 6,
  totalTables: 42,
  writeTables: 28,
  readTables: 14,
  deprecatedTables: 0,
};

export function ERDDashboard() {
  const completionRate = Math.round((ERD_REGISTRY.length / 7) * 100); // 7 = all sub-hubs + shared

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Sub-Hub Coverage */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Sub-Hub Coverage</CardTitle>
          <Layers className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{ERD_REGISTRY.length}</div>
          <p className="text-xs text-muted-foreground">ERD artifacts documented</p>
          <Progress value={completionRate} className="mt-2 h-2" />
        </CardContent>
      </Card>

      {/* Total Tables */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Tables</CardTitle>
          <Database className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{STATS.totalTables}</div>
          <div className="flex gap-2 mt-2">
            <Badge variant="default" className="text-xs">
              {STATS.writeTables} WRITE
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {STATS.readTables} READ
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Documentation Status */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Documentation</CardTitle>
          <FileCheck className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-primary">Compliant</div>
          <p className="text-xs text-muted-foreground">
            ERD discipline enforced
          </p>
        </CardContent>
      </Card>

      {/* Warnings */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Warnings</CardTitle>
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {STATS.deprecatedTables === 0 ? (
              <span className="text-primary">0</span>
            ) : (
              <span className="text-destructive">{STATS.deprecatedTables}</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Deprecated tables
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export function ERDSubHubSummary() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sub-Hub Ownership Map</CardTitle>
        <CardDescription>
          Table ownership by sub-hub following ERD discipline doctrine
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {ERD_REGISTRY.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <div>
                  <p className="font-medium text-sm">{entry.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Anchor: {entry.anchor}
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="text-xs">
                {entry.id === "shared-ref" ? "REF" : "HUB"}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
