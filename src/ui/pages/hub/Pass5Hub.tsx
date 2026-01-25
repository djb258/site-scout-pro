import { Card, CardContent, CardHeader, CardTitle } from "@/ui/components/ui/card";
import { Scale } from "lucide-react";

export default function Pass5Hub() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Scale className="h-8 w-8 text-red-400" />
        <div>
          <h1 className="text-2xl font-bold">Pass 5: Deal Gate</h1>
          <p className="text-muted-foreground">GOOD DEAL / BAD DEAL</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Purpose</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Binary doctrine gate. Reads all prior sub-hub outputs and renders a final 
            GOOD or BAD decision. No overrides without doctrine exception.
          </p>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-medium mb-1">Reads</h4>
              <ul className="text-muted-foreground space-y-1">
                <li>• All prior sub-hub outputs</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-1">Writes</h4>
              <ul className="text-muted-foreground space-y-1">
                <li>• Final decision log (GOOD / BAD)</li>
              </ul>
            </div>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 text-sm">
            <span className="font-medium text-red-400">Kill Switch:</span>
            <span className="text-muted-foreground ml-2">Any hard doctrine violation</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Coming Soon</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Deal gate functionality is under development.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
