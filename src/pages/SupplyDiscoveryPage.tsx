import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ZipSelector, type SvaZip } from "@/components/supply/ZipSelector";
import { supabase } from "@/integrations/supabase/client";
import { Store, Target, MapPin, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface SovereignId {
  id: string;
  sva_id: string;
  anchor_zip: string;
  anchor_city: string;
  anchor_state: string;
  anchor_county: string;
  radius_miles: number;
  asset_type: string;
  status: string;
  zip_count_in_scope: number;
}

export default function SupplyDiscoveryPage() {
  const [svaList, setSvaList] = useState<SovereignId[]>([]);
  const [selectedSvaId, setSelectedSvaId] = useState<string | null>(null);
  const [zipList, setZipList] = useState<SvaZip[]>([]);
  const [isLoadingSvas, setIsLoadingSvas] = useState(true);
  const [isLoadingZips, setIsLoadingZips] = useState(false);

  // Fetch SVA list on mount
  useEffect(() => {
    async function fetchSvas() {
      setIsLoadingSvas(true);
      const { data, error } = await supabase
        .from("sovereign_ids")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Failed to fetch SVAs:", error);
      } else {
        setSvaList(data || []);
        // Auto-select first SVA if available
        if (data && data.length > 0 && !selectedSvaId) {
          setSelectedSvaId(data[0].sva_id);
        }
      }
      setIsLoadingSvas(false);
    }
    fetchSvas();
  }, []);

  // Fetch ZIPs when SVA selection changes
  useEffect(() => {
    async function fetchZips() {
      if (!selectedSvaId) {
        setZipList([]);
        return;
      }

      setIsLoadingZips(true);
      const { data, error } = await supabase
        .from("sovereign_id_zips")
        .select("*")
        .eq("sva_id", selectedSvaId)
        .order("distance_miles", { ascending: true });

      if (error) {
        console.error("Failed to fetch ZIPs:", error);
        setZipList([]);
      } else {
        setZipList(data || []);
      }
      setIsLoadingZips(false);
    }
    fetchZips();
  }, [selectedSvaId]);

  const selectedSva = svaList.find((s) => s.sva_id === selectedSvaId);

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Store className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Pass 1: Market Supply Discovery</h1>
          <p className="text-muted-foreground">
            ZIP-Anchored, SVA-Contextual facility discovery
          </p>
        </div>
      </div>

      {/* Doctrine Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Doctrine</AlertTitle>
        <AlertDescription>
          Facilities are owned by <strong>ZIP</strong>, not SVA. Multiple SVAs may reference the same facility via ZIP overlap.
          This pass is for <strong>manual discovery only</strong>—no scraping, no automation.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel: SVA Selector */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5" />
              Select SVA
            </CardTitle>
            <CardDescription>
              Choose a Sovereign ID to view its ZIP scope
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoadingSvas ? (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            ) : svaList.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No Sovereign IDs found. Create one first.
              </p>
            ) : (
              <Select value={selectedSvaId || ""} onValueChange={setSelectedSvaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a Sovereign ID" />
                </SelectTrigger>
                <SelectContent>
                  {svaList.map((sva) => (
                    <SelectItem key={sva.sva_id} value={sva.sva_id}>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs">{sva.anchor_zip}</span>
                        <span>•</span>
                        <span>{sva.anchor_city}, {sva.anchor_state}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Selected SVA Details */}
            {selectedSva && (
              <div className="space-y-2 pt-4 border-t">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Anchor:</span>
                  <span className="font-medium">{selectedSva.anchor_city}, {selectedSva.anchor_state}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">County:</span>
                  <span>{selectedSva.anchor_county}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Radius:</span>
                  <Badge variant="outline">{selectedSva.radius_miles} mi</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Asset Type:</span>
                  <Badge>{selectedSva.asset_type}</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">ZIPs in Scope:</span>
                  <span className="font-bold">{selectedSva.zip_count_in_scope}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Status:</span>
                  <Badge variant={selectedSva.status === "CREATED" ? "secondary" : "default"}>
                    {selectedSva.status}
                  </Badge>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Panel: ZIP List */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              ZIP Scope
            </CardTitle>
            <CardDescription>
              {selectedSva 
                ? `${zipList.length} ZIPs in scope for ${selectedSva.anchor_zip} (${selectedSva.radius_miles} mi radius)`
                : "Select an SVA to view its ZIP scope"
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ZipSelector zips={zipList} isLoading={isLoadingZips} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
