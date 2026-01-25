import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/components/ui/card";
import { Badge } from "@/ui/components/ui/badge";
import { Button } from "@/ui/components/ui/button";
import { Separator } from "@/ui/components/ui/separator";
import { ArrowLeft, MapPin, Building, CheckCircle, Clock, RefreshCw } from "lucide-react";
import { supabase } from "@/data/integrations/supabase/client";
import { RawEvidencePanel } from "@/ui/components/county/RawEvidencePanel";
import { JurisdictionRulesForm } from "@/ui/components/county/JurisdictionRulesForm";
import { toast } from "sonner";

interface RawSource {
  raw_id: string;
  source_type: string;
  source_url: string | null;
  raw_payload: Record<string, unknown>;
  collected_at: string;
  collected_by: string;
  is_linked: boolean;
}

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
  created_at: string | null;
  updated_at: string | null;
}

interface CountyInfo {
  county_name: string;
  state_id: string;
  county_fips: string;
}

export default function CountyCardBuilderPage() {
  const { countyFips } = useParams<{ countyFips: string }>();
  const [isLoading, setIsLoading] = useState(true);
  const [countyInfo, setCountyInfo] = useState<CountyInfo | null>(null);
  const [masterCard, setMasterCard] = useState<MasterCardData | null>(null);
  const [sources, setSources] = useState<RawSource[]>([]);

  const fetchData = useCallback(async () => {
    if (!countyFips) return;

    setIsLoading(true);
    try {
      // Fetch county info from sovereign_id_counties
      const { data: countyData } = await supabase
        .from("sovereign_id_counties")
        .select("county_name, state_id, county_fips")
        .eq("county_fips", countyFips)
        .limit(1)
        .single();

      if (countyData) {
        setCountyInfo(countyData);
      }

      // Fetch card data via edge function
      const { data, error } = await supabase.functions.invoke("county_card_get", {
        body: { county_fips: countyFips },
      });

      if (error) throw error;

      if (data?.success) {
        setMasterCard(data.master || null);
        setSources(data.sources || []);
      }
    } catch (err) {
      console.error("Error fetching county card:", err);
      toast.error("Failed to load county card data");
    } finally {
      setIsLoading(false);
    }
  }, [countyFips]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const linkedSourceIds = sources.filter((s) => s.is_linked).map((s) => s.raw_id);
  const allSourceIds = sources.map((s) => s.raw_id);

  if (!countyFips) {
    return (
      <div className="container mx-auto py-8">
        <p className="text-muted-foreground">No county FIPS provided.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/supply/jurisdictions">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Link>
        </Button>
      </div>

      {/* Doctrine Banner */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            <Building className="h-5 w-5 text-primary" />
            <div>
              <h2 className="font-semibold text-primary">County Card Construction</h2>
              <p className="text-sm text-muted-foreground">
                This page collects authoritative jurisdiction rules. Facts must be sourced. Validation is explicit.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* County Overview */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MapPin className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle className="text-xl">
                  {countyInfo?.county_name || masterCard?.county_name || "Loading..."}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {countyInfo?.state_id || masterCard?.state_code || ""} • FIPS: {countyFips}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {masterCard?.status === "validated" ? (
                <Badge variant="default" className="bg-green-600">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Validated
                </Badge>
              ) : masterCard ? (
                <Badge variant="secondary">
                  <Clock className="h-3 w-3 mr-1" />
                  Draft
                </Badge>
              ) : (
                <Badge variant="outline">New Card</Badge>
              )}
              <Button variant="ghost" size="sm" onClick={fetchData} disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Sources Collected</span>
              <p className="font-medium">{sources.length}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Sources Linked</span>
              <p className="font-medium">{linkedSourceIds.length}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Confidence</span>
              <p className="font-medium">{masterCard?.confidence_score ?? "—"}%</p>
            </div>
            <div>
              <span className="text-muted-foreground">Last Validated</span>
              <p className="font-medium">
                {masterCard?.last_validated_at
                  ? new Date(masterCard.last_validated_at).toLocaleDateString()
                  : "—"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Raw Evidence Panel */}
        <RawEvidencePanel
          countyFips={countyFips}
          sources={sources}
          onSourceAdded={fetchData}
        />

        {/* Jurisdiction Rules Form */}
        <JurisdictionRulesForm
          countyFips={countyFips}
          countyName={countyInfo?.county_name || masterCard?.county_name || ""}
          stateCode={countyInfo?.state_id || masterCard?.state_code || ""}
          masterCard={masterCard}
          linkedSourceIds={allSourceIds} // Link all sources for now
          onSaved={fetchData}
        />
      </div>
    </div>
  );
}
