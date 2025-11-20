import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Home, Truck, Car, Flag } from "lucide-react";
import { DemandData } from "@/types/wizard";

interface StepDemandProps {
  data?: DemandData;
  onNext: (data: DemandData) => void;
  onBack: () => void;
}

const UHAUL_SCORES = ["High Inbound", "Moderate Inbound", "Balanced", "Moderate Outbound", "High Outbound"];

export function StepDemand({ data, onNext, onBack }: StepDemandProps) {
  const [formData, setFormData] = useState<DemandData>(
    data || {
      population: 0,
      households: 0,
      uhaulMigrationScore: "",
      trafficCount: 0,
      competitionCount: 0,
    }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNext(formData);
  };

  const isValid = formData.population > 0 && formData.households > 0;

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Demand Indicators
          </CardTitle>
          <CardDescription>
            Assess market demand through population, migration, and competition metrics
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-secondary/50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-muted-foreground">Population</span>
                </div>
                <Badge variant="secondary" className="text-lg">
                  {formData.population.toLocaleString()}
                </Badge>
              </CardContent>
            </Card>

            <Card className="bg-secondary/50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-2">
                  <Home className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-muted-foreground">Households</span>
                </div>
                <Badge variant="secondary" className="text-lg">
                  {formData.households.toLocaleString()}
                </Badge>
              </CardContent>
            </Card>

            <Card className="bg-secondary/50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-2">
                  <Car className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-muted-foreground">Traffic</span>
                </div>
                <Badge variant="secondary" className="text-lg">
                  {formData.trafficCount.toLocaleString()}
                </Badge>
              </CardContent>
            </Card>

            <Card className="bg-secondary/50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-2">
                  <Flag className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-muted-foreground">Competitors</span>
                </div>
                <Badge variant="secondary" className="text-lg">
                  {formData.competitionCount}
                </Badge>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="population">Population</Label>
              <Input
                id="population"
                type="number"
                value={formData.population}
                onChange={(e) => setFormData({ ...formData, population: parseInt(e.target.value) })}
                placeholder="Enter population"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="households">Households</Label>
              <Input
                id="households"
                type="number"
                value={formData.households}
                onChange={(e) => setFormData({ ...formData, households: parseInt(e.target.value) })}
                placeholder="Enter households"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="uhaulMigrationScore" className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-primary" />
              U-Haul Migration Score
            </Label>
            <Select
              value={formData.uhaulMigrationScore}
              onValueChange={(value) => setFormData({ ...formData, uhaulMigrationScore: value })}
            >
              <SelectTrigger id="uhaulMigrationScore">
                <SelectValue placeholder="Select migration trend" />
              </SelectTrigger>
              <SelectContent>
                {UHAUL_SCORES.map((score) => (
                  <SelectItem key={score} value={score}>
                    {score}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="trafficCount">Traffic Count Estimate</Label>
              <Input
                id="trafficCount"
                type="number"
                value={formData.trafficCount}
                onChange={(e) => setFormData({ ...formData, trafficCount: parseInt(e.target.value) })}
                placeholder="Daily traffic count"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="competitionCount">Competition Count (3-5 miles)</Label>
              <Input
                id="competitionCount"
                type="number"
                value={formData.competitionCount}
                onChange={(e) => setFormData({ ...formData, competitionCount: parseInt(e.target.value) })}
                placeholder="Number of competitors"
              />
            </div>
          </div>

          <div className="flex justify-between pt-4">
            <Button type="button" variant="outline" onClick={onBack}>
              Back
            </Button>
            <Button type="submit" disabled={!isValid} size="lg">
              Next Step
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
