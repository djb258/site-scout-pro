import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CircleDot } from "lucide-react";

/**
 * Pass2MissingFields — Actionable checklist of missing required fields
 * 
 * DOCTRINE: Read-only display. Shows exactly what research is needed.
 * No auto-fill. No inference. No guessing.
 * 
 * @version v1.0.0
 */

interface Pass2MissingFieldsProps {
  missingFields: string[];
}

const FIELD_LABELS: Record<string, { label: string; research: string }> = {
  front_setback_ft: {
    label: 'Front Setback (ft)',
    research: 'Check zoning ordinance or contact planning department',
  },
  side_setback_ft: {
    label: 'Side Setback (ft)',
    research: 'Check zoning ordinance or contact planning department',
  },
  rear_setback_ft: {
    label: 'Rear Setback (ft)',
    research: 'Check zoning ordinance or contact planning department',
  },
  max_lot_coverage_pct: {
    label: 'Max Lot Coverage (%)',
    research: 'Verify from zoning ordinance site development standards',
  },
  max_building_height_ft: {
    label: 'Max Building Height (ft)',
    research: 'Check zoning ordinance height restrictions',
  },
  min_parking_spaces: {
    label: 'Min Parking Spaces',
    research: 'Check parking requirements in zoning ordinance',
  },
  zoning_code: {
    label: 'Zoning Code',
    research: 'Verify parcel zoning from county GIS or assessor',
  },
  storage_permitted: {
    label: 'Storage Permitted',
    research: 'Verify self-storage is allowed use in zone',
  },
};

export function Pass2MissingFields({ missingFields }: Pass2MissingFieldsProps) {
  if (missingFields.length === 0) {
    return null;
  }

  return (
    <Card className="border-yellow-500/30 bg-yellow-500/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-yellow-500" />
          Missing Required Fields
          <Badge variant="outline" className="ml-auto">
            {missingFields.length} remaining
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {missingFields.map((field) => {
            const fieldInfo = FIELD_LABELS[field] || { 
              label: field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), 
              research: 'Manual research required' 
            };
            
            return (
              <li key={field} className="flex items-start gap-3 p-2 bg-muted/30 rounded-md">
                <CircleDot className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium">{fieldInfo.label}</p>
                  <p className="text-muted-foreground text-xs">{fieldInfo.research}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
