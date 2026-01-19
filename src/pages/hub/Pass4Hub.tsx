import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin } from "lucide-react";

export default function Pass4Hub() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <MapPin className="h-8 w-8 text-cyan-400" />
        <div>
          <h1 className="text-2xl font-bold">Pass 4: Parcel Discovery</h1>
          <p className="text-muted-foreground">Find viable parcels inside approved ZIPs</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Purpose</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            ZIP-driven parcel search with FIPS-validated rules. Discovers candidate parcels 
            within the SVA scope and promotes viable ones to Parcel ID.
          </p>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-medium mb-1">Reads</h4>
              <ul className="text-muted-foreground space-y-1">
                <li>• ZIP scope from SVA</li>
                <li>• County Card rules</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-1">Writes</h4>
              <ul className="text-muted-foreground space-y-1">
                <li>• SVA (parcel candidates)</li>
                <li>• Parcel ID (promoted parcels only)</li>
              </ul>
            </div>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 text-sm">
            <span className="font-medium text-cyan-400">Kill Switch:</span>
            <span className="text-muted-foreground ml-2">Parcel fails hard gates</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Coming Soon</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Parcel discovery functionality is under development.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
