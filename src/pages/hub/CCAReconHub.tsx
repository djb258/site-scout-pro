import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { 
  Building2, 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  RefreshCw,
  Search,
  Zap,
  FileText,
  Phone,
  Globe,
  Bot,
  User,
  Calendar,
  MapPin,
  ArrowRight
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// Method icons and colors
const METHOD_CONFIG = {
  // Pass 0 methods
  scrape_energov: { icon: Globe, label: "EnerGov Scraper", color: "text-blue-400", bg: "bg-blue-500/10" },
  scrape_onestop: { icon: Globe, label: "OneStop Scraper", color: "text-cyan-400", bg: "bg-cyan-500/10" },
  scrape_accela: { icon: Globe, label: "Accela Scraper", color: "text-indigo-400", bg: "bg-indigo-500/10" },
  api_permit: { icon: Zap, label: "Permit API", color: "text-emerald-400", bg: "bg-emerald-500/10" },
  // Pass 2 methods
  api_zoning: { icon: Zap, label: "Zoning API", color: "text-green-400", bg: "bg-green-500/10" },
  scrape_gis: { icon: Globe, label: "GIS Scraper", color: "text-purple-400", bg: "bg-purple-500/10" },
  pdf_ocr: { icon: FileText, label: "PDF OCR", color: "text-amber-400", bg: "bg-amber-500/10" },
  // Common
  manual: { icon: User, label: "Manual", color: "text-rose-400", bg: "bg-rose-500/10" },
};

// Mock data - in production this would come from Neon via cca_get_profile
const MOCK_COUNTY_PROFILES = [
  {
    county_id: "frederick_md",
    county_name: "Frederick",
    state: "MD",
    pass0_method: "scrape_energov",
    pass0_source_url: "https://frederickcountymd.gov/permits",
    pass0_automation_confidence: 0.85,
    pass2_method: "scrape_gis",
    pass2_source_url: "https://gis.frederickcountymd.gov",
    pass2_automation_confidence: 0.72,
    recon_performed_by: "claude_code",
    verified_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(), // 15 days ago
    ttl_days: 90,
  },
  {
    county_id: "jefferson_wv",
    county_name: "Jefferson",
    state: "WV",
    pass0_method: "manual",
    pass0_source_url: null,
    pass0_automation_confidence: 0,
    pass2_method: "pdf_ocr",
    pass2_source_url: "https://jeffersoncountywv.org/zoning-maps",
    pass2_automation_confidence: 0.45,
    recon_performed_by: "claude_code",
    verified_at: new Date(Date.now() - 85 * 24 * 60 * 60 * 1000).toISOString(), // 85 days ago
    ttl_days: 90,
  },
  {
    county_id: "berkeley_wv",
    county_name: "Berkeley",
    state: "WV",
    pass0_method: "scrape_onestop",
    pass0_source_url: "https://berkeleycountywv.gov/onestop",
    pass0_automation_confidence: 0.78,
    pass2_method: "api_zoning",
    pass2_source_url: "https://api.berkeleycounty.gov/zoning",
    pass2_automation_confidence: 0.92,
    recon_performed_by: "claude_code",
    verified_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
    ttl_days: 90,
  },
  {
    county_id: "loudoun_va",
    county_name: "Loudoun",
    state: "VA",
    pass0_method: "api_permit",
    pass0_source_url: "https://api.loudoun.gov/permits",
    pass0_automation_confidence: 0.95,
    pass2_method: "api_zoning",
    pass2_source_url: "https://api.loudoun.gov/zoning",
    pass2_automation_confidence: 0.88,
    recon_performed_by: "claude_code",
    verified_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
    ttl_days: 90,
  },
];

function getTTLStatus(verifiedAt: string, ttlDays: number) {
  const verified = new Date(verifiedAt);
  const now = new Date();
  const daysSinceVerified = Math.floor((now.getTime() - verified.getTime()) / (1000 * 60 * 60 * 24));
  const daysRemaining = ttlDays - daysSinceVerified;
  const percentRemaining = Math.max(0, Math.min(100, (daysRemaining / ttlDays) * 100));
  
  return {
    daysSinceVerified,
    daysRemaining,
    percentRemaining,
    isStale: daysRemaining <= 0,
    isWarning: daysRemaining > 0 && daysRemaining <= 14,
    isFresh: daysRemaining > 14,
  };
}

function MethodBadge({ method }: { method: string }) {
  const config = METHOD_CONFIG[method as keyof typeof METHOD_CONFIG] || METHOD_CONFIG.manual;
  const Icon = config.icon;
  
  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md ${config.bg}`}>
      <Icon className={`w-3.5 h-3.5 ${config.color}`} />
      <span className={`text-xs font-medium ${config.color}`}>{config.label}</span>
    </div>
  );
}

function TTLIndicator({ verifiedAt, ttlDays }: { verifiedAt: string; ttlDays: number }) {
  const status = getTTLStatus(verifiedAt, ttlDays);
  
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">TTL Status</span>
        <span className={
          status.isStale ? "text-destructive" : 
          status.isWarning ? "text-amber-400" : 
          "text-emerald-400"
        }>
          {status.isStale ? "STALE" : `${status.daysRemaining}d remaining`}
        </span>
      </div>
      <Progress 
        value={status.percentRemaining} 
        className={`h-1.5 ${
          status.isStale ? "[&>div]:bg-destructive" : 
          status.isWarning ? "[&>div]:bg-amber-500" : 
          "[&>div]:bg-emerald-500"
        }`}
      />
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Calendar className="w-3 h-3" />
        <span>Verified {status.daysSinceVerified}d ago</span>
      </div>
    </div>
  );
}

function CountyProfileCard({ profile, onDispatch }: { 
  profile: typeof MOCK_COUNTY_PROFILES[0]; 
  onDispatch: (countyId: string) => void;
}) {
  const ttlStatus = getTTLStatus(profile.verified_at, profile.ttl_days);
  
  return (
    <Card className={`relative overflow-hidden ${ttlStatus.isStale ? "border-destructive/50" : ""}`}>
      {/* Status indicator */}
      <div className={`absolute top-0 left-0 w-1 h-full ${
        ttlStatus.isStale ? "bg-destructive" : 
        ttlStatus.isWarning ? "bg-amber-500" : 
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
                {profile.state} • {profile.county_id}
              </CardDescription>
            </div>
          </div>
          {ttlStatus.isStale && (
            <Badge variant="destructive" className="text-xs">Needs Refresh</Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Pass 0 Method */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Pass 0 (Permits)</span>
            <MethodBadge method={profile.pass0_method} />
          </div>
          {profile.pass0_source_url && (
            <div className="text-xs text-muted-foreground truncate" title={profile.pass0_source_url}>
              {profile.pass0_source_url}
            </div>
          )}
          {profile.pass0_automation_confidence > 0 && (
            <div className="flex items-center gap-2">
              <Progress value={profile.pass0_automation_confidence * 100} className="h-1 flex-1" />
              <span className="text-xs text-muted-foreground">
                {Math.round(profile.pass0_automation_confidence * 100)}%
              </span>
            </div>
          )}
        </div>
        
        {/* Pass 2 Method */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Pass 2 (Zoning)</span>
            <MethodBadge method={profile.pass2_method} />
          </div>
          {profile.pass2_source_url && (
            <div className="text-xs text-muted-foreground truncate" title={profile.pass2_source_url}>
              {profile.pass2_source_url}
            </div>
          )}
          {profile.pass2_automation_confidence > 0 && (
            <div className="flex items-center gap-2">
              <Progress value={profile.pass2_automation_confidence * 100} className="h-1 flex-1" />
              <span className="text-xs text-muted-foreground">
                {Math.round(profile.pass2_automation_confidence * 100)}%
              </span>
            </div>
          )}
        </div>
        
        {/* TTL Status */}
        <TTLIndicator verifiedAt={profile.verified_at} ttlDays={profile.ttl_days} />
        
        {/* Recon info */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Bot className="w-3 h-3" />
            <span>{profile.recon_performed_by}</span>
          </div>
          <Button 
            size="sm" 
            variant={ttlStatus.isStale ? "default" : "outline"}
            className="h-7 text-xs"
            onClick={() => onDispatch(profile.county_id)}
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            {ttlStatus.isStale ? "Refresh" : "Re-run"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function DispatchPanel({ onDispatch }: { onDispatch: (zip: string, radius: number) => void }) {
  const [zip, setZip] = useState("");
  const [radius, setRadius] = useState("15");
  const [isLoading, setIsLoading] = useState(false);
  
  const handleDispatch = async () => {
    if (!zip) return;
    setIsLoading(true);
    await onDispatch(zip, parseInt(radius));
    setIsLoading(false);
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
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
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

function SummaryCards({ profiles }: { profiles: typeof MOCK_COUNTY_PROFILES }) {
  const staleCount = profiles.filter(p => getTTLStatus(p.verified_at, p.ttl_days).isStale).length;
  const warningCount = profiles.filter(p => getTTLStatus(p.verified_at, p.ttl_days).isWarning).length;
  const automatedP0 = profiles.filter(p => p.pass0_method !== "manual").length;
  const automatedP2 = profiles.filter(p => p.pass2_method !== "manual").length;
  
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
                {Math.round((automatedP0 / profiles.length) * 100)}%
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
                {Math.round((automatedP2 / profiles.length) * 100)}%
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
  const [profiles] = useState(MOCK_COUNTY_PROFILES);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();
  
  const filteredProfiles = profiles.filter(p => 
    p.county_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.state.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.county_id.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const handleDispatch = async (zip: string, radius: number) => {
    toast({
      title: "Dispatching CCA Recon",
      description: `Resolving counties for ZIP ${zip} within ${radius} miles...`,
    });
    
    try {
      const { data, error } = await supabase.functions.invoke("cca_dispatch_recon", {
        body: { zip, radius_miles: radius }
      });
      
      if (error) throw error;
      
      toast({
        title: "Dispatch Complete",
        description: `Found ${data?.counties_found || 0} counties, ${data?.counties_needing_recon || 0} need recon.`,
      });
    } catch (err) {
      toast({
        title: "Dispatch Failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  };
  
  const handleSingleDispatch = async (countyId: string) => {
    toast({
      title: "Refreshing County Profile",
      description: `Triggering CCA recon for ${countyId}...`,
    });
    // In production, this would call cca_dispatch_recon with force_refresh for this county
  };
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">CCA Recon Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          County Capability Assessment — automation method registry
        </p>
      </div>
      
      {/* Prime Rule */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            <Bot className="w-6 h-6 text-primary" />
            <div className="text-sm">
              <span className="font-semibold text-primary">Prime Rule:</span>
              <span className="text-muted-foreground ml-2">
                Claude thinks. Neon remembers. Lovable orchestrates.
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Summary Cards */}
      <SummaryCards profiles={profiles} />
      
      {/* Dispatch Panel */}
      <DispatchPanel onDispatch={handleDispatch} />
      
      {/* County Profiles */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">County Profiles</h2>
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
        
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredProfiles.map((profile) => (
            <CountyProfileCard 
              key={profile.county_id} 
              profile={profile} 
              onDispatch={handleSingleDispatch}
            />
          ))}
        </div>
        
        {filteredProfiles.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            No counties found matching "{searchTerm}"
          </div>
        )}
      </div>
    </div>
  );
}
