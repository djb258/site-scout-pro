import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { generateFacilityId, validateFacilityId } from "@/utils/facilityIdGenerator";
import { supabase } from "@/integrations/supabase/client";
import { Wand2, AlertCircle } from "lucide-react";

interface AddFacilityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  zipCode: string;
  onSuccess: () => void;
}

export function AddFacilityModal({ open, onOpenChange, zipCode, onSuccess }: AddFacilityModalProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [facilityIdError, setFacilityIdError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    facility_name: "",
    address: "",
    phone: "",
    website_url: "",
    facility_id: "",
    source: "manual",
  });

  // Reset form when modal opens/closes
  useEffect(() => {
    if (open) {
      setFormData({
        facility_name: "",
        address: "",
        phone: "",
        website_url: "",
        facility_id: "",
        source: "manual",
      });
      setFacilityIdError(null);
    }
  }, [open]);

  // Validate facility_id on change
  useEffect(() => {
    if (formData.facility_id) {
      const validation = validateFacilityId(formData.facility_id);
      setFacilityIdError(validation.valid ? null : validation.error || null);
    } else {
      setFacilityIdError(null);
    }
  }, [formData.facility_id]);

  const handleAutoGenerate = () => {
    if (!formData.address.trim()) {
      toast({
        title: "Address Required",
        description: "Enter an address first to auto-generate a facility ID.",
        variant: "destructive",
      });
      return;
    }
    const generatedId = generateFacilityId(formData.address);
    setFormData((prev) => ({ ...prev, facility_id: generatedId }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.facility_name.trim() || !formData.address.trim() || !formData.facility_id.trim()) {
      toast({
        title: "Missing Required Fields",
        description: "Facility name, address, and facility ID are required.",
        variant: "destructive",
      });
      return;
    }

    // Validate facility_id format
    const validation = validateFacilityId(formData.facility_id);
    if (!validation.valid) {
      setFacilityIdError(validation.error || "Invalid facility ID format");
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke("supply_add_facility", {
        body: {
          zip_code: zipCode,
          facility_name: formData.facility_name.trim(),
          address: formData.address.trim(),
          phone: formData.phone.trim() || undefined,
          website_url: formData.website_url.trim() || undefined,
          facility_id: formData.facility_id.trim(),
          source: formData.source,
          discovery_context: { added_via: "manual_ui" },
        },
      });

      if (error) {
        throw error;
      }

      if (!data.success) {
        toast({
          title: data.error || "Error",
          description: data.message || "Failed to add facility",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Facility Added",
        description: data.facility_existed 
          ? `Facility ${formData.facility_id} already exists. Raw intake recorded.`
          : `Facility ${formData.facility_id} added successfully.`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Add facility error:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add facility",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Facility</DialogTitle>
          <DialogDescription>
            Add a new facility to ZIP <span className="font-mono font-bold">{zipCode}</span>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="facility_name">Facility Name *</Label>
            <Input
              id="facility_name"
              value={formData.facility_name}
              onChange={(e) => setFormData((prev) => ({ ...prev, facility_name: e.target.value }))}
              placeholder="e.g. Extra Space Storage"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address *</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
              placeholder="e.g. 123 Main St, City, ST 12345"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                placeholder="(555) 123-4567"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="website_url">Website</Label>
              <Input
                id="website_url"
                type="url"
                value={formData.website_url}
                onChange={(e) => setFormData((prev) => ({ ...prev, website_url: e.target.value }))}
                placeholder="https://..."
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="facility_id">Facility ID *</Label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Input
                  id="facility_id"
                  value={formData.facility_id}
                  onChange={(e) => setFormData((prev) => ({ ...prev, facility_id: e.target.value.toLowerCase() }))}
                  placeholder="fac_xxxxxxxx"
                  className={facilityIdError ? "border-destructive" : ""}
                  required
                />
                {facilityIdError && (
                  <div className="flex items-center gap-1 mt-1 text-xs text-destructive">
                    <AlertCircle className="w-3 h-3" />
                    {facilityIdError}
                  </div>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleAutoGenerate}
                title="Auto-generate from address"
              >
                <Wand2 className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Format: fac_XXXXXXXX (8 lowercase hex characters). Click the wand to auto-generate from address.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="source">Source</Label>
            <Select
              value={formData.source}
              onValueChange={(value) => setFormData((prev) => ({ ...prev, source: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual Entry</SelectItem>
                <SelectItem value="web">Web Research</SelectItem>
                <SelectItem value="call">Phone Call</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !!facilityIdError}>
              {isSubmitting ? "Adding..." : "Add Facility"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
