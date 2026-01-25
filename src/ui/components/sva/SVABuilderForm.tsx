import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/components/ui/card";
import { Button } from "@/ui/components/ui/button";
import { Input } from "@/ui/components/ui/input";
import { Label } from "@/ui/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/components/ui/select";
import { Alert, AlertDescription } from "@/ui/components/ui/alert";
import { Badge } from "@/ui/components/ui/badge";
import { Loader2, Target, MapPin, Ruler, AlertTriangle, CheckCircle2, Calculator } from "lucide-react";
import { useZipResolution } from "@/ui/hooks/useZipResolution";
import { supabase } from "@/data/integrations/supabase/client";
import { toast } from "sonner";

const ASSET_TYPES = [
  { value: "self-storage", label: "Self-Storage" },
  { value: "rv-storage", label: "RV Storage" },
  { value: "boat-storage", label: "Boat Storage" },
  { value: "truck-tractor", label: "Truck / Tractor Parking" },
  { value: "tow-impound", label: "Tow & Impound / Insurance Yard" },
];

const RADIUS_OPTIONS = [
  { value: 25, label: "25 miles" },
  { value: 50, label: "50 miles" },
  { value: 75, label: "75 miles" },
  { value: 100, label: "100 miles" },
  { value: 120, label: "120 miles" },
];

export function SVABuilderForm() {
  const navigate = useNavigate();
  const [assetType, setAssetType] = useState<string>("");
  const [anchorZip, setAnchorZip] = useState<string>("");
  const [radiusMiles, setRadiusMiles] = useState<number | null>(null);
  const [sqftPerPerson, setSqftPerPerson] = useState<number>(6);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { resolution, isLoading: isResolvingZip, isValid: isZipValid, error: zipError } = useZipResolution(anchorZip);

  const isFormValid = assetType && isZipValid && radiusMiles !== null;

  const handleZipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 5);
    setAnchorZip(value);
    setSubmitError(null);
  };

  const handleSubmit = async () => {
    if (!isFormValid) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const { data, error } = await supabase.functions.invoke("sva_create", {
        body: {
          asset_type: assetType,
          anchor_zip: anchorZip,
          radius_miles: radiusMiles,
          sqft_per_person: sqftPerPerson,
        },
      });

      if (error) {
        throw new Error(error.message || "Failed to create Sovereign ID");
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      if (data?.already_existed) {
        if (data?.rehydrated) {
          toast.success("Sovereign ID scope rebuilt!", {
            description: `${data.sva_id} now has ${data.zip_count_in_scope} ZIPs in scope`,
          });
        } else {
          toast.info("Sovereign ID already exists", {
            description: "Navigating to existing SVA...",
          });
        }
      } else {
        toast.success("Sovereign ID created!", {
          description: `${data.sva_id} with ${data.zip_count_in_scope} ZIPs in scope`,
        });
      }

      navigate(`/sva/${data.sva_id}`);
    } catch (err) {
      console.error("SVA creation error:", err);
      setSubmitError(err instanceof Error ? err.message : "Failed to create Sovereign ID");
      toast.error("Creation failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="flex items-center justify-center gap-2 text-2xl">
          <Target className="h-6 w-6 text-primary" />
          Create Sovereign ID
        </CardTitle>
        <CardDescription className="text-muted-foreground italic">
          "A Sovereign ID is not land. It is a market mandate."
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Asset Type */}
        <div className="space-y-2">
          <Label htmlFor="asset-type" className="flex items-center gap-1">
            Asset Type <span className="text-destructive">*</span>
          </Label>
          <Select value={assetType} onValueChange={setAssetType}>
            <SelectTrigger id="asset-type">
              <SelectValue placeholder="Select asset type..." />
            </SelectTrigger>
            <SelectContent>
              {ASSET_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Asset type determines which sub-hubs activate and what data is collected.
          </p>
        </div>

        {/* Anchor ZIP */}
        <div className="space-y-2">
          <Label htmlFor="anchor-zip" className="flex items-center gap-1">
            <MapPin className="h-4 w-4" />
            Anchor ZIP Code <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <Input
              id="anchor-zip"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={5}
              value={anchorZip}
              onChange={handleZipChange}
              placeholder="Enter 5-digit ZIP..."
              className={`pr-10 ${
                anchorZip.length === 5 && !isResolvingZip
                  ? isZipValid
                    ? "border-green-500 focus-visible:ring-green-500"
                    : "border-destructive focus-visible:ring-destructive"
                  : ""
              }`}
            />
            {isResolvingZip && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
            {!isResolvingZip && anchorZip.length === 5 && isZipValid && (
              <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
            )}
          </div>

          {zipError && anchorZip.length === 5 && (
            <Alert variant="destructive" className="py-2">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{zipError}</AlertDescription>
            </Alert>
          )}

          {/* Resolved Location */}
          {resolution && isZipValid && (
            <Card className="bg-muted/50 border-dashed">
              <CardContent className="py-3 px-4">
                <p className="text-xs text-muted-foreground mb-2 font-medium">Resolved Location (read-only)</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">City:</span>{" "}
                    <span className="font-medium">{resolution.city || "—"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">State:</span>{" "}
                    <span className="font-medium">{resolution.stateName || resolution.state || "—"}</span>
                    {resolution.state && (
                      <Badge variant="outline" className="ml-1 text-xs">
                        {resolution.state}
                      </Badge>
                    )}
                  </div>
                  <div>
                    <span className="text-muted-foreground">County:</span>{" "}
                    <span className="font-medium">{resolution.county || "—"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">FIPS:</span>{" "}
                    <span className="font-mono text-xs">{resolution.countyFips || "—"}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Search Radius */}
        <div className="space-y-2">
          <Label htmlFor="radius" className="flex items-center gap-1">
            <Ruler className="h-4 w-4" />
            Search Radius <span className="text-destructive">*</span>
          </Label>
          <Select 
            value={radiusMiles?.toString() || ""} 
            onValueChange={(v) => setRadiusMiles(parseInt(v))}
          >
            <SelectTrigger id="radius">
              <SelectValue placeholder="Select radius..." />
            </SelectTrigger>
            <SelectContent>
              {RADIUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value.toString()}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Radius defines the data universe (ZIPs in scope).
          </p>
        </div>

        {/* SQFT Per Person */}
        <div className="space-y-2">
          <Label htmlFor="sqft-per-person" className="flex items-center gap-1">
            <Calculator className="h-4 w-4" />
            Demand Multiplier (sqft/person)
          </Label>
          <Input
            id="sqft-per-person"
            type="number"
            min={1}
            max={20}
            step={0.5}
            value={sqftPerPerson}
            onChange={(e) => setSqftPerPerson(parseFloat(e.target.value) || 6)}
            placeholder="6"
          />
          <p className="text-xs text-muted-foreground">
            Storage demand per capita (default: 6 sqft). Used to calculate demand_sqft per ZIP.
          </p>
        </div>

        {/* Submit Error */}
        {submitError && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        )}

        {/* Submit Button */}
        <Button
          onClick={handleSubmit}
          disabled={!isFormValid || isSubmitting}
          className="w-full"
          size="lg"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating Sovereign ID...
            </>
          ) : (
            <>
              <Target className="mr-2 h-4 w-4" />
              Create Sovereign ID
            </>
          )}
        </Button>

        {/* Immutability Warning */}
        <Alert className="bg-amber-500/10 border-amber-500/50">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <AlertDescription className="text-amber-700 dark:text-amber-300 text-sm">
            <strong>Immutable:</strong> This action cannot be undone. Same inputs will return the same Sovereign ID.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
