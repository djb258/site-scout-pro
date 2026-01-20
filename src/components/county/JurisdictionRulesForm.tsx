import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Save, CheckCircle, AlertTriangle, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface MasterCardData {
  county_fips: string;
  county_name: string | null;
  state_code: string | null;
  zoning_authority: string | null;
  permitting_authority: string | null;
  min_setback_front_ft: number | null;
  min_setback_side_ft: number | null;
  min_setback_rear_ft: number | null;
  max_height_ft: number | null;
  max_lot_coverage_pct: number | null;
  special_use_required: boolean | null;
  variance_process: string | null;
  status: string | null;
  confidence_score: number | null;
  last_validated_at: string | null;
}

interface JurisdictionRulesFormProps {
  countyFips: string;
  countyName: string;
  stateCode: string;
  masterCard: MasterCardData | null;
  linkedSourceIds: string[];
  onSaved: () => void;
}

export function JurisdictionRulesForm({
  countyFips,
  countyName,
  stateCode,
  masterCard,
  linkedSourceIds,
  onSaved,
}: JurisdictionRulesFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  
  const [formData, setFormData] = useState({
    zoning_authority: "",
    permitting_authority: "",
    min_setback_front_ft: "",
    min_setback_side_ft: "",
    min_setback_rear_ft: "",
    max_height_ft: "",
    max_lot_coverage_pct: "",
    special_use_required: "unknown",
    variance_process: "",
    confidence_score: 50,
  });

  // Load master card data into form
  useEffect(() => {
    if (masterCard) {
      setFormData({
        zoning_authority: masterCard.zoning_authority || "",
        permitting_authority: masterCard.permitting_authority || "",
        min_setback_front_ft: masterCard.min_setback_front_ft?.toString() || "",
        min_setback_side_ft: masterCard.min_setback_side_ft?.toString() || "",
        min_setback_rear_ft: masterCard.min_setback_rear_ft?.toString() || "",
        max_height_ft: masterCard.max_height_ft?.toString() || "",
        max_lot_coverage_pct: masterCard.max_lot_coverage_pct?.toString() || "",
        special_use_required: masterCard.special_use_required === null 
          ? "unknown" 
          : masterCard.special_use_required ? "yes" : "no",
        variance_process: masterCard.variance_process || "",
        confidence_score: masterCard.confidence_score || 50,
      });
    }
  }, [masterCard]);

  const handleSaveDraft = async () => {
    setIsSaving(true);
    try {
      const updates: Record<string, unknown> = {};
      
      // Build updates from form data
      if (formData.zoning_authority) updates.zoning_authority = formData.zoning_authority;
      if (formData.permitting_authority) updates.permitting_authority = formData.permitting_authority;
      if (formData.min_setback_front_ft) updates.min_setback_front_ft = parseInt(formData.min_setback_front_ft);
      if (formData.min_setback_side_ft) updates.min_setback_side_ft = parseInt(formData.min_setback_side_ft);
      if (formData.min_setback_rear_ft) updates.min_setback_rear_ft = parseInt(formData.min_setback_rear_ft);
      if (formData.max_height_ft) updates.max_height_ft = parseInt(formData.max_height_ft);
      if (formData.max_lot_coverage_pct) updates.max_lot_coverage_pct = parseInt(formData.max_lot_coverage_pct);
      if (formData.special_use_required !== "unknown") {
        updates.special_use_required = formData.special_use_required === "yes";
      }
      if (formData.variance_process) updates.variance_process = formData.variance_process;

      const { data, error } = await supabase.functions.invoke("county_card_upsert_master", {
        body: {
          county_fips: countyFips,
          county_name: countyName,
          state_code: stateCode,
          raw_ids: linkedSourceIds,
          updates,
          confidence_score: formData.confidence_score,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to save");

      toast.success("Saved as draft");
      onSaved();
    } catch (err) {
      console.error("Error saving draft:", err);
      toast.error(err instanceof Error ? err.message : "Failed to save draft");
    } finally {
      setIsSaving(false);
    }
  };

  const handleValidate = async () => {
    if (linkedSourceIds.length === 0) {
      toast.error("Cannot validate: Add and link at least one source first");
      return;
    }

    setIsValidating(true);
    try {
      // First save the current form data
      await handleSaveDraft();

      // Then validate
      const { data, error } = await supabase.functions.invoke("county_card_validate", {
        body: { county_fips: countyFips },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to validate");

      toast.success("County Card validated! It is now authoritative.");
      onSaved();
    } catch (err) {
      console.error("Error validating:", err);
      toast.error(err instanceof Error ? err.message : "Failed to validate");
    } finally {
      setIsValidating(false);
    }
  };

  const isValidated = masterCard?.status === "validated";
  const canValidate = linkedSourceIds.length > 0 && !isValidated;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-medium">Jurisdiction Rules</CardTitle>
        <div className="flex items-center gap-2">
          {isValidated ? (
            <Badge variant="default" className="bg-primary">
              <CheckCircle className="h-3 w-3 mr-1" />
              Validated
            </Badge>
          ) : (
            <Badge variant="secondary">Draft</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Read-Only Banner for Validated Cards */}
        {isValidated && (
          <Alert className="border-warning/50 bg-warning/10">
            <Lock className="h-4 w-4 text-warning" />
            <AlertTitle>Read Only</AlertTitle>
            <AlertDescription>
              This card is validated and locked. To make changes, the status must be reset to 'draft' in the database.
            </AlertDescription>
          </Alert>
        )}

        {/* Authority Section */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
            Zoning Authority
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Zoning Authority</Label>
              <Input
                placeholder="e.g., Bedford County Zoning Board"
                value={formData.zoning_authority}
                onChange={(e) => setFormData((f) => ({ ...f, zoning_authority: e.target.value }))}
                disabled={isValidated}
              />
            </div>
            <div className="space-y-2">
              <Label>Permitting Authority</Label>
              <Input
                placeholder="e.g., County Planning Department"
                value={formData.permitting_authority}
                onChange={(e) => setFormData((f) => ({ ...f, permitting_authority: e.target.value }))}
                disabled={isValidated}
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Setbacks Section */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
            Setbacks
          </h4>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Front Setback (ft)</Label>
              <Input
                type="number"
                placeholder="e.g., 25"
                value={formData.min_setback_front_ft}
                onChange={(e) => setFormData((f) => ({ ...f, min_setback_front_ft: e.target.value }))}
                disabled={isValidated}
              />
            </div>
            <div className="space-y-2">
              <Label>Side Setback (ft)</Label>
              <Input
                type="number"
                placeholder="e.g., 10"
                value={formData.min_setback_side_ft}
                onChange={(e) => setFormData((f) => ({ ...f, min_setback_side_ft: e.target.value }))}
                disabled={isValidated}
              />
            </div>
            <div className="space-y-2">
              <Label>Rear Setback (ft)</Label>
              <Input
                type="number"
                placeholder="e.g., 15"
                value={formData.min_setback_rear_ft}
                onChange={(e) => setFormData((f) => ({ ...f, min_setback_rear_ft: e.target.value }))}
                disabled={isValidated}
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Building Limits Section */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
            Building Limits
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Max Height (ft)</Label>
              <Input
                type="number"
                placeholder="e.g., 35"
                value={formData.max_height_ft}
                onChange={(e) => setFormData((f) => ({ ...f, max_height_ft: e.target.value }))}
                disabled={isValidated}
              />
            </div>
            <div className="space-y-2">
              <Label>Max Lot Coverage (%)</Label>
              <Input
                type="number"
                placeholder="e.g., 60"
                value={formData.max_lot_coverage_pct}
                onChange={(e) => setFormData((f) => ({ ...f, max_lot_coverage_pct: e.target.value }))}
                disabled={isValidated}
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Use Requirements Section */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
            Use Requirements
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Special Use Permit Required?</Label>
              <Select
                value={formData.special_use_required}
                onValueChange={(value) => setFormData((f) => ({ ...f, special_use_required: value }))}
                disabled={isValidated}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unknown">Unknown</SelectItem>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Variance Process Notes</Label>
            <Textarea
              placeholder="Describe the variance/conditional use process..."
              rows={3}
              value={formData.variance_process}
              onChange={(e) => setFormData((f) => ({ ...f, variance_process: e.target.value }))}
              disabled={isValidated}
            />
          </div>
        </div>

        <Separator />

        {/* Confidence Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
              Card Confidence
            </h4>
            <span className="text-lg font-bold">{formData.confidence_score}%</span>
          </div>
          <Slider
            value={[formData.confidence_score]}
            onValueChange={(value) => setFormData((f) => ({ ...f, confidence_score: value[0] }))}
            max={100}
            min={0}
            step={5}
            disabled={isValidated}
          />
          <p className="text-xs text-muted-foreground">
            Confidence represents certainty about the jurisdiction rules as a whole, not individual sources.
          </p>
        </div>

        <Separator />

        {/* Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {linkedSourceIds.length === 0 ? (
              <>
                <AlertTriangle className="h-4 w-4 text-warning" />
                <span>Add sources to enable validation</span>
              </>
            ) : (
              <span>{linkedSourceIds.length} source(s) linked</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleSaveDraft} disabled={isSaving || isValidated}>
              <Save className="h-4 w-4 mr-1" />
              {isSaving ? "Saving..." : "Save as Draft"}
            </Button>
            <Button 
              onClick={handleValidate} 
              disabled={!canValidate || isValidating}
              variant={isValidated ? "secondary" : "default"}
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              {isValidating ? "Validating..." : isValidated ? "Already Validated" : "Mark as Validated"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
