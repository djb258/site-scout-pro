import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Users, DollarSign, CheckCircle2 } from "lucide-react";
import { WizardData } from "@/types/wizard";

interface StepReviewProps {
  data: WizardData;
  onBack: () => void;
  onSubmit: () => void;
  isLoading?: boolean;
}

export function StepReview({ data, onBack, onSubmit, isLoading }: StepReviewProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            Pipeline Summary
          </CardTitle>
          <CardDescription>
            Review all collected data before running the Go/No-Go analysis
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {data.location && (
            <div>
              <h3 className="flex items-center gap-2 font-semibold mb-3 text-foreground">
                <MapPin className="h-4 w-4 text-primary" />
                Location Details
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">State:</span>
                  <span className="ml-2 font-medium">{data.location.state}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">County:</span>
                  <span className="ml-2 font-medium">{data.location.county}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">ZIP:</span>
                  <span className="ml-2 font-medium">{data.location.zipCode}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Acreage:</span>
                  <span className="ml-2 font-medium">{data.location.acreage} acres</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Shape:</span>
                  <span className="ml-2 font-medium">{data.location.parcelShape}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Slope:</span>
                  <span className="ml-2 font-medium">{data.location.slopePercent}%</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Floodplain:</span>
                  <span className="ml-2 font-medium">{data.location.floodplain ? "Yes" : "No"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Access:</span>
                  <span className="ml-2 font-medium">{data.location.accessQuality}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Road Type:</span>
                  <span className="ml-2 font-medium">{data.location.nearbyRoadType}</span>
                </div>
              </div>
            </div>
          )}

          {data.demand && (
            <div>
              <h3 className="flex items-center gap-2 font-semibold mb-3 text-foreground">
                <Users className="h-4 w-4 text-primary" />
                Demand Indicators
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Population:</span>
                  <span className="ml-2 font-medium">{data.demand.population.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Households:</span>
                  <span className="ml-2 font-medium">{data.demand.households.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">U-Haul:</span>
                  <span className="ml-2 font-medium">{data.demand.uhaulMigrationScore}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Traffic:</span>
                  <span className="ml-2 font-medium">{data.demand.trafficCount.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Competition:</span>
                  <span className="ml-2 font-medium">{data.demand.competitionCount}</span>
                </div>
              </div>
            </div>
          )}

          {data.rent && (
            <div>
              <h3 className="flex items-center gap-2 font-semibold mb-3 text-foreground">
                <DollarSign className="h-4 w-4 text-primary" />
                Rent Bands
              </h3>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="p-3 bg-secondary/30 rounded-lg">
                  <div className="text-muted-foreground mb-1">Low Rent</div>
                  <div className="font-semibold text-lg">${data.rent.lowRent.toFixed(2)}/mo</div>
                </div>
                <div className="p-3 bg-secondary/30 rounded-lg">
                  <div className="text-muted-foreground mb-1">Medium Rent</div>
                  <div className="font-semibold text-lg">${data.rent.mediumRent.toFixed(2)}/mo</div>
                </div>
                <div className="p-3 bg-secondary/30 rounded-lg">
                  <div className="text-muted-foreground mb-1">High Rent</div>
                  <div className="font-semibold text-lg">${data.rent.highRent.toFixed(2)}/mo</div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button
          onClick={onSubmit}
          disabled={isLoading}
          size="lg"
          className="bg-primary hover:bg-primary/90"
        >
          {isLoading ? "Running Analysis..." : "Run Go/No-Go Check"}
        </Button>
      </div>
    </div>
  );
}
