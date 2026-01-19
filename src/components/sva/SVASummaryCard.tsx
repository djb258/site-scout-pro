import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  CheckCircle2, 
  Lock, 
  Target, 
  MapPin, 
  Ruler, 
  Hash, 
  Calendar,
  Building2,
  Radar,
  Store,
  Building,
  Calculator,
  Map,
  Scale
} from "lucide-react";

export interface SovereignIdData {
  sva_id: string;
  asset_type: string;
  anchor_zip: string;
  anchor_city: string;
  anchor_state: string;
  anchor_county: string;
  anchor_fips: string;
  anchor_lat: number;
  anchor_lng: number;
  radius_miles: number;
  zip_count_in_scope: number;
  status: string;
  created_at: string;
}

export interface SubHubStatus {
  id: number;
  name: string;
  status: "LOCKED" | "READY" | "RUNNING" | "COMPLETE";
}

interface SVASummaryCardProps {
  sva: SovereignIdData;
  subHubStatus?: SubHubStatus[];
}

const ASSET_TYPE_LABELS: Record<string, string> = {
  "self-storage": "Self-Storage",
  "rv-storage": "RV Storage",
  "boat-storage": "Boat Storage",
  "truck-tractor": "Truck / Tractor Parking",
  "tow-impound": "Tow & Impound / Insurance Yard",
};

const SUB_HUB_ICONS = [Radar, Store, Building, Calculator, Map, Scale];

const DEFAULT_SUB_HUB_STATUS: SubHubStatus[] = [
  { id: 0, name: "Radar / Signals", status: "LOCKED" },
  { id: 1, name: "Competitive Supply", status: "LOCKED" },
  { id: 2, name: "County / FIPS Card", status: "LOCKED" },
  { id: 3, name: "Economics & Calculators", status: "LOCKED" },
  { id: 4, name: "Parcel Discovery", status: "LOCKED" },
  { id: 5, name: "Verdict / Doctrine Gate", status: "LOCKED" },
];

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStatusBadge(status: SubHubStatus["status"]) {
  switch (status) {
    case "LOCKED":
      return <Badge variant="secondary" className="text-xs"><Lock className="h-3 w-3 mr-1" />LOCKED</Badge>;
    case "READY":
      return <Badge variant="outline" className="text-xs border-blue-500 text-blue-500">READY</Badge>;
    case "RUNNING":
      return <Badge className="text-xs bg-amber-500">RUNNING</Badge>;
    case "COMPLETE":
      return <Badge className="text-xs bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />COMPLETE</Badge>;
    default:
      return <Badge variant="secondary" className="text-xs">UNKNOWN</Badge>;
  }
}

export function SVASummaryCard({ sva, subHubStatus = DEFAULT_SUB_HUB_STATUS }: SVASummaryCardProps) {
  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="text-center pb-4">
        <div className="flex items-center justify-center gap-2 mb-2">
          <CheckCircle2 className="h-6 w-6 text-green-500" />
          <CardTitle className="text-xl">Sovereign ID Created</CardTitle>
        </div>
        <CardDescription className="font-mono text-lg font-semibold text-foreground">
          {sva.sva_id}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Main Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Asset Type */}
          <div className="flex items-start gap-3">
            <Building2 className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground">Asset Type</p>
              <p className="font-medium">{ASSET_TYPE_LABELS[sva.asset_type] || sva.asset_type}</p>
            </div>
          </div>

          {/* Anchor ZIP */}
          <div className="flex items-start gap-3">
            <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground">Anchor ZIP</p>
              <p className="font-medium">
                {sva.anchor_zip}
                <span className="text-muted-foreground font-normal ml-1">
                  ({sva.anchor_city}, {sva.anchor_state})
                </span>
              </p>
            </div>
          </div>

          {/* County */}
          <div className="flex items-start gap-3">
            <Target className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground">County</p>
              <p className="font-medium">
                {sva.anchor_county}
                <Badge variant="outline" className="ml-2 text-xs font-mono">
                  FIPS: {sva.anchor_fips}
                </Badge>
              </p>
            </div>
          </div>

          {/* Radius */}
          <div className="flex items-start gap-3">
            <Ruler className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground">Radius</p>
              <p className="font-medium">{sva.radius_miles} miles</p>
            </div>
          </div>

          {/* ZIPs in Scope */}
          <div className="flex items-start gap-3">
            <Hash className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground">ZIPs in Scope</p>
              <p className="font-medium">{sva.zip_count_in_scope.toLocaleString()}</p>
            </div>
          </div>

          {/* Created At */}
          <div className="flex items-start gap-3">
            <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground">Created</p>
              <p className="font-medium text-sm">{formatDate(sva.created_at)}</p>
            </div>
          </div>
        </div>

        <Separator />

        {/* Sub-Hub Status */}
        <div>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Sub-Hub Status
          </h3>
          <div className="space-y-2">
            {subHubStatus.map((hub) => {
              const Icon = SUB_HUB_ICONS[hub.id] || Target;
              return (
                <div
                  key={hub.id}
                  className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/50"
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      Sub-Hub {hub.id} — {hub.name}
                    </span>
                  </div>
                  {getStatusBadge(hub.status)}
                </div>
              );
            })}
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex justify-center pt-2">
          <Badge variant="outline" className="text-sm px-4 py-1">
            Status: {sva.status}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
