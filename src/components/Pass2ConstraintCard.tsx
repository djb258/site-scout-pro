import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertTriangle, XCircle, Lock, MapPin, Building2 } from "lucide-react";

/**
 * Pass2ConstraintCard — Main status display for Pass 2 Constraint Compiler
 * 
 * DOCTRINE: Read-only display. No computation. No inference.
 * Renders exactly what Neon returns.
 * 
 * @version v1.0.0
 * DO NOT MODIFY — downstream depends on this shape
 */

interface Pass2ConstraintCardProps {
  status: 'ELIGIBLE' | 'HOLD_INCOMPLETE' | 'NO_GO' | 'SCHEMA_INCOMPLETE' | null;
  jurisdictionCardComplete: boolean;
  countyCapability: {
    automation_viable: boolean;
    permit_system: string;
    zoning_model: string;
    county_name: string;
    state: string;
  } | null;
  zipMetadata: {
    zip: string;
    city: string | null;
    county: string | null;
    state: string | null;
    population: number | null;
  } | null;
}

export function Pass2ConstraintCard({
  status,
  jurisdictionCardComplete,
  countyCapability,
  zipMetadata,
}: Pass2ConstraintCardProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'ELIGIBLE':
        return {
          icon: CheckCircle,
          label: 'ELIGIBLE',
          description: 'Ready for Pass 3',
          color: 'text-green-500',
          bgColor: 'bg-green-500/10',
          borderColor: 'border-green-500/30',
        };
      case 'HOLD_INCOMPLETE':
        return {
          icon: AlertTriangle,
          label: 'HOLD — INCOMPLETE',
          description: 'Missing required data',
          color: 'text-yellow-500',
          bgColor: 'bg-yellow-500/10',
          borderColor: 'border-yellow-500/30',
        };
      case 'NO_GO':
        return {
          icon: XCircle,
          label: 'NO GO',
          description: 'Fatal prohibitions detected',
          color: 'text-red-500',
          bgColor: 'bg-red-500/10',
          borderColor: 'border-red-500/30',
        };
      case 'SCHEMA_INCOMPLETE':
        return {
          icon: AlertTriangle,
          label: 'SCHEMA INCOMPLETE',
          description: 'Neon tables not configured',
          color: 'text-orange-500',
          bgColor: 'bg-orange-500/10',
          borderColor: 'border-orange-500/30',
        };
      default:
        return {
          icon: Lock,
          label: 'NOT RUN',
          description: 'Enter ZIP to begin',
          color: 'text-muted-foreground',
          bgColor: 'bg-muted/50',
          borderColor: 'border-border',
        };
    }
  };

  const config = getStatusConfig();
  const StatusIcon = config.icon;

  return (
    <Card className={`${config.bgColor} ${config.borderColor} border-2`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            Constraint Status
          </CardTitle>
          <Badge variant="outline" className="font-mono text-xs">
            v2.0.0 · FROZEN
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Badge */}
        <div className={`flex items-center gap-3 p-4 rounded-lg ${config.bgColor}`}>
          <StatusIcon className={`h-8 w-8 ${config.color}`} />
          <div>
            <p className={`text-xl font-bold ${config.color}`}>{config.label}</p>
            <p className="text-sm text-muted-foreground">{config.description}</p>
          </div>
        </div>

        {/* ZIP Metadata */}
        {zipMetadata && (
          <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">
                {zipMetadata.city || 'Unknown City'}, {zipMetadata.state || 'Unknown State'} {zipMetadata.zip}
              </p>
              <p className="text-muted-foreground">
                {zipMetadata.county || 'Unknown'} County
                {zipMetadata.population && ` · Pop: ${zipMetadata.population.toLocaleString()}`}
              </p>
            </div>
          </div>
        )}

        {/* Jurisdiction Card Status */}
        <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
          <span className="text-sm font-medium">Jurisdiction Card</span>
          <Badge variant={jurisdictionCardComplete ? "default" : "secondary"}>
            {jurisdictionCardComplete ? '✓ Complete' : '○ Incomplete'}
          </Badge>
        </div>

        {/* County Capability */}
        {countyCapability && (
          <div className="space-y-2 p-3 bg-muted/30 rounded-lg">
            <p className="text-sm font-medium">County Capability</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Permit System:</span>
                <span className="font-mono">{countyCapability.permit_system}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Zoning Model:</span>
                <span className="font-mono">{countyCapability.zoning_model}</span>
              </div>
              <div className="flex justify-between col-span-2">
                <span className="text-muted-foreground">Automation Viable:</span>
                <Badge variant={countyCapability.automation_viable ? "default" : "destructive"} className="text-xs">
                  {countyCapability.automation_viable ? 'Yes' : 'No'}
                </Badge>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
