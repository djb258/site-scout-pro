import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { DollarSign } from "lucide-react";
import { RentData } from "@/types/wizard";

interface StepRentProps {
  data?: RentData;
  onNext: (data: RentData) => void;
  onBack: () => void;
}

export function StepRent({ data, onNext, onBack }: StepRentProps) {
  const [formData, setFormData] = useState<RentData>(
    data || {
      lowRent: 0,
      mediumRent: 0,
      highRent: 0,
    }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNext(formData);
  };

  const isValid = formData.lowRent > 0 && formData.mediumRent > 0 && formData.highRent > 0;

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Rent Band Verification
          </CardTitle>
          <CardDescription>
            Set monthly rent prices for different unit sizes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-secondary/30 border-2">
              <CardHeader>
                <CardTitle className="text-lg">Low Rent</CardTitle>
                <CardDescription>Small units (5x5, 5x10)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor="lowRent">Monthly Rate</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      id="lowRent"
                      type="number"
                      step="0.01"
                      value={formData.lowRent}
                      onChange={(e) => setFormData({ ...formData, lowRent: parseFloat(e.target.value) })}
                      placeholder="0.00"
                      className="pl-7"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-secondary/30 border-2">
              <CardHeader>
                <CardTitle className="text-lg">Medium Rent</CardTitle>
                <CardDescription>Medium units (10x10, 10x15)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor="mediumRent">Monthly Rate</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      id="mediumRent"
                      type="number"
                      step="0.01"
                      value={formData.mediumRent}
                      onChange={(e) => setFormData({ ...formData, mediumRent: parseFloat(e.target.value) })}
                      placeholder="0.00"
                      className="pl-7"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-secondary/30 border-2">
              <CardHeader>
                <CardTitle className="text-lg">High Rent</CardTitle>
                <CardDescription>Large units (10x20+)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor="highRent">Monthly Rate</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      id="highRent"
                      type="number"
                      step="0.01"
                      value={formData.highRent}
                      onChange={(e) => setFormData({ ...formData, highRent: parseFloat(e.target.value) })}
                      placeholder="0.00"
                      className="pl-7"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="bg-muted/50 p-4 rounded-lg">
            <h4 className="font-medium mb-2">Rent Summary</h4>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Low:</span>
                <span className="ml-2 font-medium">${formData.lowRent.toFixed(2)}/mo</span>
              </div>
              <div>
                <span className="text-muted-foreground">Medium:</span>
                <span className="ml-2 font-medium">${formData.mediumRent.toFixed(2)}/mo</span>
              </div>
              <div>
                <span className="text-muted-foreground">High:</span>
                <span className="ml-2 font-medium">${formData.highRent.toFixed(2)}/mo</span>
              </div>
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
