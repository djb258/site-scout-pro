import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FacilityTable, type Facility } from "@/components/supply/FacilityTable";
import { AddFacilityModal } from "@/components/supply/AddFacilityModal";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, MapPin, Users, Warehouse, Plus, FileText, AlertCircle, CheckCircle2, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { classifyZipState, calculateDataAgeDays, type ZipDataState } from "@/utils/zipStateClassifier";

interface ZipDetail {
  zip_code: string;
  metadata: {
    population: number | null;
    demand_sqft: number | null;
    distance_miles: number | null;
    sva_id: string | null;
    is_authorized: boolean;
  };
  facilities: Facility[];
  facility_count: number;
  raw_intake_count: number;
}

export default function ZipSupplyDetailPage() {
  const { zipCode } = useParams<{ zipCode: string }>();
  const [zipDetail, setZipDetail] = useState<ZipDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const fetchZipDetail = useCallback(async () => {
    if (!zipCode) return;

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("supply_get_zip_detail", {
        body: { zip_code: zipCode },
      });

      if (fnError) {
        throw fnError;
      }

      if (!data.success) {
        throw new Error(data.message || "Failed to fetch ZIP detail");
      }

      setZipDetail(data);
    } catch (err) {
      console.error("Failed to fetch ZIP detail:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [zipCode]);

  useEffect(() => {
    fetchZipDetail();
  }, [fetchZipDetail]);

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const isAuthorized = zipDetail?.metadata?.is_authorized ?? false;

  // Derive ZIP state from facility data
  const facilityCount = zipDetail?.facility_count || 0;
  const oldestSeenAt = zipDetail?.facilities?.[zipDetail.facilities.length - 1]?.first_seen_at || null;
  const zipState: ZipDataState = classifyZipState(facilityCount, oldestSeenAt);
  const dataAgeDays = calculateDataAgeDays(oldestSeenAt);

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/supply">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <MapPin className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold font-mono">{zipCode}</h1>
              <p className="text-muted-foreground">ZIP Supply Detail</p>
            </div>
          </div>
        </div>

        {isAuthorized && (
          <Button onClick={() => setIsAddModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Facility
          </Button>
        )}
      </div>

      {/* Authorization Warning */}
      {!isAuthorized && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>ZIP Not Authorized</AlertTitle>
          <AlertDescription>
            This ZIP code is not in any Sovereign ID scope. You cannot add facilities until this ZIP
            is included in an SVA's radius.
          </AlertDescription>
        </Alert>
      )}

      {/* Read-First State Banner */}
      {isAuthorized && zipState === 'UNKNOWN' && (
        <Alert className="border-gray-500/50 bg-muted/30">
          <AlertCircle className="h-4 w-4 text-muted-foreground" />
          <AlertTitle>No Facility Data Recorded</AlertTitle>
          <AlertDescription>
            This ZIP has no discovered facilities yet. Use "Add Facility" to record findings.
          </AlertDescription>
        </Alert>
      )}

      {isAuthorized && zipState === 'KNOWN' && (
        <Alert className="border-green-500/50 bg-green-500/5">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <AlertTitle className="text-green-700 dark:text-green-300">Existing Data Available</AlertTitle>
          <AlertDescription className="text-green-600 dark:text-green-400">
            {facilityCount} {facilityCount === 1 ? 'facility' : 'facilities'} on record
            {dataAgeDays !== null && ` (last seen ${dataAgeDays} days ago)`}.
            Data loaded from existing knowledge base — no re-discovery needed.
          </AlertDescription>
        </Alert>
      )}

      {isAuthorized && zipState === 'STALE' && (
        <Alert className="border-yellow-500/50 bg-yellow-500/5">
          <AlertTriangle className="h-4 w-4 text-yellow-500" />
          <AlertTitle className="text-yellow-700 dark:text-yellow-300">Data May Be Outdated</AlertTitle>
          <AlertDescription className="text-yellow-600 dark:text-yellow-400">
            Facility data is over 30 days old{dataAgeDays !== null && ` (${dataAgeDays} days)`}. 
            Consider verifying or updating records.
          </AlertDescription>
        </Alert>
      )}

      {/* Metadata Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Users className="w-4 h-4" />
              Population
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {zipDetail?.metadata?.population?.toLocaleString() || "—"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Warehouse className="w-4 h-4" />
              Demand (sqft)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {zipDetail?.metadata?.demand_sqft?.toLocaleString() || "—"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Facilities</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{zipDetail?.facility_count || 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Raw Intakes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{zipDetail?.raw_intake_count || 0}</p>
            <p className="text-xs text-muted-foreground">Append-only audit trail</p>
          </CardContent>
        </Card>
      </div>

      {/* SVA Context */}
      {zipDetail?.metadata?.sva_id && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">SVA Context:</span>
          <Badge variant="outline" className="font-mono text-xs">
            {zipDetail.metadata.sva_id}
          </Badge>
          <Badge variant="outline">
            {zipDetail.metadata.distance_miles?.toFixed(1)} mi from anchor
          </Badge>
        </div>
      )}

      {/* Facilities Table */}
      <Card>
        <CardHeader>
          <CardTitle>Discovered Facilities</CardTitle>
          <CardDescription>
            Canonical facility records (facility_master) for this ZIP
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FacilityTable facilities={zipDetail?.facilities || []} />
        </CardContent>
      </Card>

      {/* Add Facility Modal */}
      {zipCode && (
        <AddFacilityModal
          open={isAddModalOpen}
          onOpenChange={setIsAddModalOpen}
          zipCode={zipCode}
          onSuccess={fetchZipDetail}
        />
      )}
    </div>
  );
}
