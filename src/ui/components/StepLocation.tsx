import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { MapPin, Mountain, Droplets, Route, Square } from "lucide-react";
import { LocationData } from "@/types/wizard";

interface StepLocationProps {
  data?: LocationData;
  onNext: (data: LocationData) => void;
}

const STATES = ["PA", "WV", "VA", "MD", "OH", "DE"];
const PARCEL_SHAPES = ["rectangular", "irregular", "triangle"];
const ACCESS_QUALITY = ["good", "fair", "poor"];
const ROAD_TYPES = ["state road", "rural two-lane", "highway"];

export function StepLocation({ data, onNext }: StepLocationProps) {
  const [formData, setFormData] = useState<LocationData>(
    data || {
      state: "",
      county: "",
      zipCode: "",
      acreage: 0,
      parcelShape: "",
      slopePercent: 0,
      floodplain: false,
      accessQuality: "",
      nearbyRoadType: "",
    }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNext(formData);
  };

  const isValid = formData.state && formData.county && formData.zipCode && formData.acreage > 0;

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Location Basics
          </CardTitle>
          <CardDescription>
            Enter the fundamental details about the storage site location
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Select
                value={formData.state}
                onValueChange={(value) => setFormData({ ...formData, state: value })}
              >
                <SelectTrigger id="state">
                  <SelectValue placeholder="Select state" />
                </SelectTrigger>
                <SelectContent>
                  {STATES.map((state) => (
                    <SelectItem key={state} value={state}>
                      {state}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="county">County</Label>
              <Input
                id="county"
                value={formData.county}
                onChange={(e) => setFormData({ ...formData, county: e.target.value })}
                placeholder="Enter county"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="zipCode">ZIP Code</Label>
              <Input
                id="zipCode"
                value={formData.zipCode}
                onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                placeholder="Enter ZIP"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="acreage" className="flex items-center gap-2">
                <Square className="h-4 w-4 text-primary" />
                Acreage
              </Label>
              <Input
                id="acreage"
                type="number"
                step="0.1"
                value={formData.acreage}
                onChange={(e) => setFormData({ ...formData, acreage: parseFloat(e.target.value) })}
                placeholder="Enter acreage"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="parcelShape">Parcel Shape</Label>
              <Select
                value={formData.parcelShape}
                onValueChange={(value) => setFormData({ ...formData, parcelShape: value })}
              >
                <SelectTrigger id="parcelShape">
                  <SelectValue placeholder="Select shape" />
                </SelectTrigger>
                <SelectContent>
                  {PARCEL_SHAPES.map((shape) => (
                    <SelectItem key={shape} value={shape}>
                      {shape}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="slopePercent" className="flex items-center gap-2">
                <Mountain className="h-4 w-4 text-primary" />
                Slope % Estimate
              </Label>
              <Input
                id="slopePercent"
                type="number"
                step="0.1"
                value={formData.slopePercent}
                onChange={(e) => setFormData({ ...formData, slopePercent: parseFloat(e.target.value) })}
                placeholder="Enter slope percentage"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="floodplain" className="flex items-center gap-2">
                <Droplets className="h-4 w-4 text-primary" />
                Floodplain
              </Label>
              <Select
                value={formData.floodplain ? "yes" : "no"}
                onValueChange={(value) => setFormData({ ...formData, floodplain: value === "yes" })}
              >
                <SelectTrigger id="floodplain">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="accessQuality" className="flex items-center gap-2">
                <Route className="h-4 w-4 text-primary" />
                Access Quality
              </Label>
              <Select
                value={formData.accessQuality}
                onValueChange={(value) => setFormData({ ...formData, accessQuality: value })}
              >
                <SelectTrigger id="accessQuality">
                  <SelectValue placeholder="Select quality" />
                </SelectTrigger>
                <SelectContent>
                  {ACCESS_QUALITY.map((quality) => (
                    <SelectItem key={quality} value={quality}>
                      {quality}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nearbyRoadType">Nearby Road Type</Label>
              <Select
                value={formData.nearbyRoadType}
                onValueChange={(value) => setFormData({ ...formData, nearbyRoadType: value })}
              >
                <SelectTrigger id="nearbyRoadType">
                  <SelectValue placeholder="Select road type" />
                </SelectTrigger>
                <SelectContent>
                  {ROAD_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <Button type="submit" disabled={!isValid} size="lg">
              Next Step
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
