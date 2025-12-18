import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { XOctagon, AlertTriangle } from "lucide-react";

/**
 * Pass2Prohibitions — Fatal prohibitions that block the deal
 * 
 * DOCTRINE: Shows exactly why NO_GO. Stops workflow visually.
 * No interpretation. No softening. Reality as-is.
 * 
 * @version v1.0.0
 */

interface Pass2ProhibitionsProps {
  prohibitions: string[];
}

export function Pass2Prohibitions({ prohibitions }: Pass2ProhibitionsProps) {
  if (prohibitions.length === 0) {
    return null;
  }

  return (
    <Card className="border-red-500/50 bg-red-500/10">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2 text-red-500">
          <XOctagon className="h-5 w-5" />
          FATAL PROHIBITIONS
          <Badge variant="destructive" className="ml-auto">
            DEAL STOPPED
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5" />
            <p className="text-sm text-red-400">
              One or more conditions make this site ineligible. Workflow cannot proceed.
            </p>
          </div>
        </div>
        
        <ul className="space-y-2">
          {prohibitions.map((prohibition, index) => (
            <li 
              key={index} 
              className="flex items-start gap-3 p-3 bg-red-500/5 border border-red-500/20 rounded-md"
            >
              <XOctagon className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm font-medium text-red-400">{prohibition}</p>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
