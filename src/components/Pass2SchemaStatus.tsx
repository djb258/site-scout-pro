import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Database, CheckCircle, XCircle } from "lucide-react";

/**
 * Pass2SchemaStatus — Neon schema status display
 * 
 * DOCTRINE: Shows table existence status from Neon.
 * Transparent about what infrastructure exists.
 * 
 * @version v1.0.0
 */

interface Pass2SchemaStatusProps {
  schemaStatus: {
    jurisdiction_cards_exists: boolean;
    jurisdiction_constraints_exists: boolean;
    jurisdiction_prohibitions_exists: boolean;
    ref_county_capability_exists: boolean;
  } | null;
}

const TABLE_INFO = [
  { key: 'jurisdiction_cards_exists', label: 'pass2.jurisdiction_cards' },
  { key: 'jurisdiction_constraints_exists', label: 'pass2.jurisdiction_constraints' },
  { key: 'jurisdiction_prohibitions_exists', label: 'pass2.jurisdiction_prohibitions' },
  { key: 'ref_county_capability_exists', label: 'ref.ref_county_capability' },
];

export function Pass2SchemaStatus({ schemaStatus }: Pass2SchemaStatusProps) {
  if (!schemaStatus) {
    return null;
  }

  const allTablesExist = Object.values(schemaStatus).every(v => v);
  const existingCount = Object.values(schemaStatus).filter(v => v).length;

  return (
    <Card className={allTablesExist ? 'border-green-500/20' : 'border-orange-500/30 bg-orange-500/5'}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Database className="h-4 w-4 text-muted-foreground" />
          Neon Schema Status
          <Badge 
            variant={allTablesExist ? "default" : "secondary"} 
            className="ml-auto text-xs"
          >
            {existingCount}/4 tables
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2">
          {TABLE_INFO.map(({ key, label }) => {
            const exists = schemaStatus[key as keyof typeof schemaStatus];
            return (
              <div 
                key={key} 
                className="flex items-center gap-2 p-2 bg-muted/30 rounded text-xs"
              >
                {exists ? (
                  <CheckCircle className="h-3 w-3 text-green-500" />
                ) : (
                  <XCircle className="h-3 w-3 text-red-500" />
                )}
                <span className="font-mono truncate">{label}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
