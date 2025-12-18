import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lock, Ban } from "lucide-react";

/**
 * Pass2BlockedFields — Fields that cannot be automated
 * 
 * DOCTRINE: Explicitly labeled "Cannot be automated".
 * Directs to manual research. No shortcuts.
 * 
 * @version v1.0.0
 */

interface Pass2BlockedFieldsProps {
  blockedFields: string[];
}

const BLOCKED_FIELD_INFO: Record<string, { label: string; reason: string }> = {
  fire_lane_width_ft: {
    label: 'Fire Lane Width (ft)',
    reason: 'Requires fire marshal consultation - jurisdiction-specific',
  },
  stormwater_requirements: {
    label: 'Stormwater Requirements',
    reason: 'Site-specific engineering required',
  },
  conditional_use_process: {
    label: 'Conditional Use Process',
    reason: 'Varies by jurisdiction - requires legal review',
  },
  variance_history: {
    label: 'Variance History',
    reason: 'Historical records not digitized',
  },
};

export function Pass2BlockedFields({ blockedFields }: Pass2BlockedFieldsProps) {
  if (blockedFields.length === 0) {
    return null;
  }

  return (
    <Card className="border-orange-500/30 bg-orange-500/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Lock className="h-4 w-4 text-orange-500" />
          Cannot Be Automated
          <Badge variant="outline" className="ml-auto font-mono text-xs">
            MANUAL ONLY
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {blockedFields.map((field) => {
            const fieldInfo = BLOCKED_FIELD_INFO[field] || { 
              label: field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), 
              reason: 'Requires manual research - not available via API' 
            };
            
            return (
              <li key={field} className="flex items-start gap-3 p-2 bg-muted/30 rounded-md">
                <Ban className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium">{fieldInfo.label}</p>
                  <p className="text-muted-foreground text-xs">{fieldInfo.reason}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
