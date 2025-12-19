import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useCCAProfiles, CCAProfile, DispatchResult } from "@/hooks/useCCAProfiles";
import { useToast } from "@/hooks/use-toast";
import { 
  Building2, 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  RefreshCw,
  Search,
  Zap,
  FileText,
  Globe,
  Bot,
  User,
  Calendar,
  MapPin,
  ArrowRight,
  Info,
  Loader2
} from "lucide-react";

// Method icons and colors
const METHOD_CONFIG: Record<string, { icon: typeof Globe; label: string; color: string; bg: string }> = {
  // Pass 0 methods
  scrape_energov: { icon: Globe, label: "EnerGov Scraper", color: "text-blue-400", bg: "bg-blue-500/10" },
  scrape_onestop: { icon: Globe, label: "OneStop Scraper", color: "text-cyan-400", bg: "bg-cyan-500/10" },
  scrape_accela: { icon: Globe, label: "Accela Scraper", color: "text-indigo-400", bg: "bg-indigo-500/10" },
  api_permit: { icon: Zap, label: "Permit API", color: "text-emerald-400", bg: "bg-emerald-500/10" },
  api: { icon: Zap, label: "API", color: "text-emerald-400", bg: "bg-emerald-500/10" },
  scraper: { icon: Globe, label: "Scraper", color: "text-blue-400", bg: "bg-blue-500/10" },
  portal: { icon: Globe, label: "Portal", color: "text-purple-400", bg: "bg-purple-500/10" },
  // Pass 2 methods
  api_zoning: { icon: Zap, label: "Zoning API", color: "text-green-400", bg: "bg-green-500/10" },
  scrape_gis: { icon: Globe, label: "GIS Scraper", color: "text-purple-400", bg: "bg-purple-500/10" },
  pdf_ocr: { icon: FileText, label: "PDF OCR", color: "text-amber-400", bg: "bg-amber-500/10" },
  manual: { icon: User, label: "Manual", color: "text-rose-400", bg: "bg-rose-500/10" },
  none: { icon: User, label: "Not Configured", color: "text-muted-foreground", bg: "bg-muted/50" },
};

function MethodBadge({ method }: { method: string }) {
  const config = METHOD_CONFIG[method?.toLowerCase()] || METHOD_CONFIG.manual;
  const Icon = config.icon;
  
  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md ${config.bg}`}>
      <Icon className={`w-3.5 h-3.5 ${config.color}`} />
      <span className={`text-xs font-medium ${config.color}`}>{config.label}</span>
    </div>
  );
}

function TTLIndicator({ profile }: { profile: CCAProfile }) {
  const { metadata } = profile;
  
  const percentRemaining = Math.max(0, Math.min(100, (metadata.days_until_expiry / 90) * 100));
  
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">TTL Status</span>
        <span className={
          metadata.is_expired ? "text-destructive" : 
          metadata.expires_soon ? "text-amber-400" : 
          "text-emerald-400"
        }>
          {metadata.is_expired ? "STALE" : `${metadata.days_until_expiry}d remaining`}
        </span>
      </div>
      <Progress 
        value={percentRemaining} 
        className={`h-1.5 ${
          metadata.is_expired ? "[&>div]:bg-destructive" : 
          metadata.expires_soon ? "[&>div]:bg-amber-500" : 
          "[&>div]:bg-emerald-500"
        }`}
      />
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Calendar className="w-3 h-3" />
        <span>Verified {new Date(metadata.verified_at).toLocaleDateString()}</span>
      </div>
    </div>
  );
}

function CountyProfileCard({ profile, onDispatch }: { 
  profile: CCAProfile; 
  onDispatch: (countyId: number) => void;
}) {
  const { metadata } = profile;
  
  return (
    <Card className={`relative overflow-hidden ${metadata.is_expired ? "border-destructive/50" : ""}`}>
      {/* Status indicator */}
      <div className={`absolute top-0 left-0 w-1 h-full ${
        metadata.is_expired ? "bg-destructive" : 
        metadata.expires_soon ? "bg-amber-500" : 
        "bg-emerald-500"
      }`} />
      
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            <div>
              <CardTitle className="text-base">{profile.county_name} County</CardTitle>
              <CardDescription className="text-xs flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {profile.state} • {profile.county_fips || `ID: ${profile.county_id}`}
              </CardDescription>
            </div>
          </div>
          {metadata.is_expired && (
            <Badge variant="destructive" className="text-xs">Needs Refresh</Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Pass 0 Method */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Pass 0 (Permits)</span>
            <MethodBadge method={profile.pass0.method} />
          </div>
          {profile.pass0.source_url && (
            <div className="text-xs text-muted-foreground truncate" title={profile.pass0.source_url}>
              {profile.pass0.source_url}
            </div>
          )}
          <div className="flex items-center gap-2 text-xs">
            <Badge variant="outline" className="text-xs py-0">{profile.pass0.coverage}</Badge>
            {profile.pass0.has_api && <Badge variant="secondary" className="text-xs py-0">API</Badge>}
            {profile.pass0.has_portal && <Badge variant="secondary" className="text-xs py-0">Portal</Badge>}
          </div>
        </div>
        
        {/* Pass 2 Method */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Pass 2 (Zoning)</span>
            <MethodBadge method={profile.pass2.method} />
          </div>
          {profile.pass2.source_url && (
            <div className="text-xs text-muted-foreground truncate" title={profile.pass2.source_url}>
              {profile.pass2.source_url}
            </div>
          )}
          <Badge variant="outline" className="text-xs py-0">{profile.pass2.coverage}</Badge>
        </div>
        
        {/* TTL Status */}
        <TTLIndicator profile={profile} />
        
        {/* Recon info */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Badge variant="secondary" className="text-xs py-0">
              {metadata.confidence}
            </Badge>
            <span>v{metadata.version}</span>
          </div>
          <Button 
            size="sm" 
            variant={metadata.is_expired ? "default" : "outline"}
            className="h-7 text-xs"
            onClick={() => onDispatch(profile.county_id)}
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            {metadata.is_expired ? "Refresh" : "Re-run"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function DispatchPanel({ onDispatch, isLoading }: { 
  onDispatch: (zip: string, radius: number) => void;
  isLoading: boolean;
}) {
  const [zip, setZip] = useState("");
  const [radius, setRadius] = useState("15");
  
  const handleDispatch = async () => {
    if (!zip) return;
    await onDispatch(zip, parseInt(radius));
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Zap className="w-5 h-5 text-primary" />
          Dispatch CCA Recon
        </CardTitle>
        <CardDescription>
          Trigger county capability assessment for counties in radius
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Origin ZIP</label>
            <Input 
              placeholder="21701" 
              value={zip}
              onChange={(e) => setZip(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Radius (miles)</label>
            <Input 
              type="number" 
              placeholder="15" 
              value={radius}
              onChange={(e) => setRadius(e.target.value)}
            />
          </div>
        </div>
        
        <Button 
          className="w-full" 
          onClick={handleDispatch}
          disabled={!zip || isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Dispatching...
            </>
          ) : (
            <>
              <ArrowRight className="w-4 h-4 mr-2" />
              Dispatch to Claude Code
            </>
          )}
        </Button>
        
        {/* Flow diagram */}
        <div className="pt-4 border-t border-border">
          <div className="text-xs text-muted-foreground mb-2">Dispatch Flow:</div>
          <div className="flex items-center justify-between text-xs">
            <div className="flex flex-col items-center gap-1">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <MapPin className="w-4 h-4 text-primary" />
              </div>
              <span className="text-muted-foreground">ZIP</span>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
            <div className="flex flex-col items-center gap-1">
              <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Building2 className="w-4 h-4 text-blue-400" />
              </div>
              <span className="text-muted-foreground">Counties</span>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
            <div className="flex flex-col items-center gap-1">
              <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center">
                <Clock className="w-4 h-4 text-amber-400" />
              </div>
              <span className="text-muted-foreground">TTL Check</span>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
            <div className="flex flex-col items-center gap-1">
              <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <Bot className="w-4 h-4 text-emerald-400" />
              </div>
              <span className="text-muted-foreground">Claude</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryCards({ profiles, isLoading }: { profiles: CCAProfile[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1,2,3,4].map(i => (
          <Card key={i}>
            <CardContent className="pt-6">
              <Skeleton className="h-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const staleCount = profiles.filter(p => p.metadata.is_expired).length;
  const warningCount = profiles.filter(p => p.metadata.expires_soon).length;
  const automatedP0 = profiles.filter(p => p.pass0.method !== "manual" && p.pass0.method !== "none").length;
  const automatedP2 = profiles.filter(p => p.pass2.method !== "manual" && p.pass2.method !== "none").length;
  
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold">{profiles.length}</div>
              <div className="text-xs text-muted-foreground">Total Counties</div>
            </div>
            <Building2 className="w-8 h-8 text-primary/50" />
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-destructive">{staleCount}</div>
              <div className="text-xs text-muted-foreground">Stale Profiles</div>
            </div>
            <AlertTriangle className="w-8 h-8 text-destructive/50" />
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-emerald-400">
                {profiles.length > 0 ? Math.round((automatedP0 / profiles.length) * 100) : 0}%
              </div>
              <div className="text-xs text-muted-foreground">Pass 0 Automated</div>
            </div>
            <Zap className="w-8 h-8 text-emerald-500/50" />
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-blue-400">
                {profiles.length > 0 ? Math.round((automatedP2 / profiles.length) * 100) : 0}%
              </div>
              <div className="text-xs text-muted-foreground">Pass 2 Automated</div>
            </div>
            <CheckCircle2 className="w-8 h-8 text-blue-500/50" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function CCAReconHub() {
  const { profiles, isLoading, error, fetchProfile, dispatchRecon } = useCCAProfiles();
  const [searchTerm, setSearchTerm] = useState("");
  const [lastDispatch, setLastDispatch] = useState<DispatchResult | null>(null);
  const { toast } = useToast();
  
  const filteredProfiles = profiles.filter(p => 
    p.county_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.state.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const handleDispatch = async (zip: string, radius: number) => {
    toast({
      title: "Dispatching CCA Recon",
      description: `Resolving counties for ZIP ${zip} within ${radius} miles...`,
    });
    
    const result = await dispatchRecon(zip, radius);
    
    if (result) {
      setLastDispatch(result);
      toast({
        title: result.status === 'error' ? "Dispatch Failed" : "Dispatch Complete",
        description: result.status === 'all_fresh' 
          ? `All ${result.counties_fresh.length} counties are fresh`
          : `${result.counties_to_recon.length} counties queued for recon`,
        variant: result.status === 'error' ? "destructive" : "default",
      });
    }
  };
  
  const handleSingleDispatch = async (countyId: number) => {
    toast({
      title: "Refreshing County Profile",
      description: `Triggering CCA recon for county ${countyId}...`,
    });
    // Single county refresh would trigger cca_dispatch_recon with force_refresh
    // For now, just refetch the profile
    const profile = profiles.find(p => p.county_id === countyId);
    if (profile) {
      await fetchProfile(profile.county_name, profile.state);
    }
  };
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">CCA Recon Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          County Capability Assessment — automation method registry (LIVE DATA)
        </p>
      </div>
      
      {/* Doctrine Banner */}
      <Alert className="bg-primary/5 border-primary/20">
        <Info className="h-4 w-4" />
        <AlertDescription>
          <span className="font-semibold text-primary">Doctrine:</span>
          <span className="text-muted-foreground ml-2">
            Claude thinks. Neon remembers. Lovable orchestrates. No mock data.
          </span>
        </AlertDescription>
      </Alert>
      
      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {/* Summary Cards */}
      <SummaryCards profiles={profiles} isLoading={isLoading} />
      
      {/* Dispatch Panel */}
      <DispatchPanel onDispatch={handleDispatch} isLoading={isLoading} />
      
      {/* Last Dispatch Result */}
      {lastDispatch && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Last Dispatch: {lastDispatch.status}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {lastDispatch.counties_to_recon.length > 0 && (
              <div>Queued: {lastDispatch.counties_to_recon.map(c => `${c.county_name}, ${c.state}`).join('; ')}</div>
            )}
            {lastDispatch.counties_fresh.length > 0 && (
              <div>Fresh: {lastDispatch.counties_fresh.join('; ')}</div>
            )}
          </CardContent>
        </Card>
      )}
      
      {/* County Profiles */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">County Profiles ({profiles.length})</h2>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search counties..." 
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        
        {isLoading && profiles.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent className="space-y-4">
                  <Skeleton className="h-12" />
                  <Skeleton className="h-12" />
                  <Skeleton className="h-8" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : profiles.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <Building2 className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">
                No county profiles loaded. Use the dispatch panel above to fetch profiles for a ZIP radius.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredProfiles.map((profile) => (
              <CountyProfileCard 
                key={profile.county_id} 
                profile={profile} 
                onDispatch={handleSingleDispatch}
              />
            ))}
          </div>
        )}
        
        {profiles.length > 0 && filteredProfiles.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            No counties found matching "{searchTerm}"
          </div>
        )}
      </div>
    </div>
  );
}
