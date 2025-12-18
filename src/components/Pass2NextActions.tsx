import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Phone, FileSearch, Building } from "lucide-react";

/**
 * Pass2NextActions — Research guidance panel
 * 
 * DOCTRINE: Displays Neon-provided next actions as-is.
 * No interpretation. No prioritization beyond source order.
 * 
 * @version v1.0.0
 */

interface Pass2NextActionsProps {
  actions: string[];
}

function getActionIcon(action: string) {
  if (action.toLowerCase().includes('retell') || action.toLowerCase().includes('call')) {
    return Phone;
  }
  if (action.toLowerCase().includes('planning') || action.toLowerCase().includes('department')) {
    return Building;
  }
  return FileSearch;
}

export function Pass2NextActions({ actions }: Pass2NextActionsProps) {
  if (actions.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <ArrowRight className="h-4 w-4 text-primary" />
          Next Actions
          <Badge variant="secondary" className="ml-auto">
            {actions.length} pending
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {actions.map((action, index) => {
            const ActionIcon = getActionIcon(action);
            
            return (
              <li 
                key={index} 
                className="flex items-start gap-3 p-3 bg-muted/50 rounded-md hover:bg-muted/70 transition-colors"
              >
                <ActionIcon className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-sm">{action}</p>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
