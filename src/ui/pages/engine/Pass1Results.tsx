import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CircularProgress } from '@/components/ui/circular-progress';
import { ReadinessBadge, getReadinessStatus } from '@/components/engine/ReadinessBadge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  ArrowLeft, 
  ArrowRight, 
  Loader2, 
  MapPin, 
  TrendingUp, 
  Building2, 
  Target, 
  Crown,
  Radar,
  Users
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  compilePass1Summary, 
  calculateCompetitorDensity,
  type Pass1Data as Pass1CalcData,
  type Pass1Flags
} from '@/services/pass1Calculators';

interface Pass1Data {
  zip_metadata: any;
  radius_counties: any[];
  competitors: any[];
  housing_signals: any;
  anchors: any[];
  rv_lake_signals: any;
  industrial_signals: any;
  analysis_summary: any;
}

export default function Pass1Results() {
  const navigate = useNavigate();
  const { runId } = useParams();
  const [isLoading, setIsLoading] = useState(true);
  const [isRunningPass2, setIsRunningPass2] = useState(false);
  const [data, setData] = useState<Pass1Data | null>(null);
  const [zipRun, setZipRun] = useState<any>(null);
  const [calculatedSummary, setCalculatedSummary] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, [runId]);

  const loadData = async () => {
    try {
      const { data: run, error: runError } = await supabase
        .from('zip_runs')
        .select('*')
        .eq('id', runId)
        .single();

      if (runError) throw runError;
      setZipRun(run);

      const { data: pass1, error: pass1Error } = await supabase
        .from('pass1_results')
        .select('*')
        .eq('zip_run_id', runId)
        .single();

      if (pass1Error) throw pass1Error;
      setData(pass1 as unknown as Pass1Data);

      const flags: Pass1Flags = {
        urban_exclude: run.urban_exclude,
        multifamily_priority: run.multifamily_priority,
        recreation_load: run.recreation_load,
        industrial_momentum: run.industrial_momentum,
        analysis_mode: run.analysis_mode
      };
      const summary = compilePass1Summary(pass1 as unknown as Pass1CalcData, flags);
      setCalculatedSummary(summary);
    } catch (error: any) {
      console.error('Error loading Pass 1 data:', error);
      toast.error('Failed to load results');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunPass2 = async () => {
    setIsRunningPass2(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('startPass2', {
        body: { zip_run_id: runId }
      });

      if (error) throw error;

      toast.success('Pass 2 deep dive complete!');
      navigate(`/engine/pass2/${runId}`);
    } catch (error: any) {
      console.error('Pass 2 error:', error);
      toast.error(error.message || 'Failed to run Pass 2');
    } finally {
      setIsRunningPass2(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-background p-6">
        <p className="text-center text-muted-foreground">No data found</p>
      </div>
    );
  }

  const zipMeta = data.zip_metadata;
  const summary = calculatedSummary || data.analysis_summary;
  const competitorCalc = calculateCompetitorDensity(data as Pass1CalcData);
  
  // Derive values
  const population = zipMeta?.population || 0;
  const demandSqft = population * 6; // Standard 6 sqft per capita
  const supplySqft = competitorCalc.totalSqft || 0;
  const supplyGap = demandSqft - supplySqft;
  const hotspotCounties = data.radius_counties?.filter((c: any) => c.is_hotspot) || [];
  const gradeACount = data.competitors?.filter((c: any) => c.grade === 'A').length || 0;
  const pass2Ready = summary?.tier !== 'D' && summary?.viabilityScore >= 40;
  const validationScore = summary?.viabilityScore || 0;
  const readinessStatus = getReadinessStatus(pass2Ready, validationScore);

  // REIT presence badge logic
  const getReitBadge = () => {
    if (gradeACount >= 3) return { label: "REIT Dominated", variant: "destructive" as const };
    if (gradeACount >= 1) return { label: "Regional Mix", variant: "secondary" as const };
    return { label: "Mom & Pop Market", variant: "outline" as const };
  };
  const reitBadge = getReitBadge();

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/engine/screener')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-foreground">Pass 1 — Market Screening</h1>
              <p className="text-sm text-muted-foreground">Quick scan for ZIP {zipRun?.zip_code}</p>
            </div>
          </div>
          <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/30">
            {zipRun?.analysis_mode?.toUpperCase() || 'BUILD'} MODE
          </Badge>
        </div>

        {/* ========== SECTION 1: ZIP METADATA CARD ========== */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <MapPin className="h-5 w-5 text-amber-500" />
              <CardTitle className="text-foreground">ZIP Metadata</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              {/* Left: Metadata Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 flex-1">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">ZIP</p>
                  <p className="text-lg font-semibold text-foreground">{zipMeta?.zip || zipRun?.zip_code}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">City</p>
                  <p className="text-lg font-semibold text-foreground">{zipMeta?.city || 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">County</p>
                  <p className="text-lg font-semibold text-foreground">{zipMeta?.county || 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">State</p>
                  <p className="text-lg font-semibold text-foreground">{zipMeta?.state_id || zipMeta?.state_name || 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Lat / Lng</p>
                  <p className="text-sm font-medium text-foreground">
                    {zipMeta?.lat?.toFixed(4) || 'N/A'} / {zipMeta?.lng?.toFixed(4) || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Population</p>
                  <p className="text-lg font-semibold text-foreground">{population.toLocaleString()}</p>
                </div>
              </div>

              {/* Right: Validation Score + Badge */}
              <div className="flex items-center gap-4">
                <CircularProgress value={validationScore} size={90} label="Score" />
                <ReadinessBadge status={readinessStatus} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ========== SECTION 2: MARKET INTELLIGENCE CARDS (2-column grid) ========== */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Card A: Macro Demand */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                <CardTitle className="text-sm font-medium text-foreground">Macro Demand</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Population</span>
                <span className="font-medium text-foreground">{population.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Demand (sqft)</span>
                <span className="font-medium text-foreground">{demandSqft.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Demand/County</span>
                <span className="font-medium text-foreground">
                  {data.radius_counties?.length ? Math.round(demandSqft / data.radius_counties.length).toLocaleString() : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Hotspots</span>
                <span className="font-medium text-amber-500">{hotspotCounties.length}</span>
              </div>
            </CardContent>
          </Card>

          {/* Card B: Macro Supply */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-blue-500" />
                <CardTitle className="text-sm font-medium text-foreground">Macro Supply</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Competitors</span>
                <span className="font-medium text-foreground">{data.competitors?.length || 0}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Supply (sqft)</span>
                <span className="font-medium text-foreground">{supplySqft.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Supply Gap</span>
                <Badge variant={supplyGap > 0 ? "default" : "destructive"} className="text-xs">
                  {supplyGap > 0 ? '+' : ''}{supplyGap.toLocaleString()} sqft
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Card C: Hotspot Identification */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-amber-500" />
                <CardTitle className="text-sm font-medium text-foreground">Hotspot Identification</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {hotspotCounties.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {hotspotCounties.slice(0, 5).map((county: any, i: number) => (
                    <Badge key={i} variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30">
                      {county.county} <span className="ml-1 text-xs opacity-70">High Opportunity</span>
                    </Badge>
                  ))}
                  {hotspotCounties.length > 5 && (
                    <Badge variant="secondary" className="text-xs">
                      +{hotspotCounties.length - 5} more
                    </Badge>
                  )}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {data.radius_counties?.slice(0, 4).map((county: any, i: number) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {county.county}
                    </Badge>
                  ))}
                  <p className="text-xs text-muted-foreground mt-2 w-full">No high-opportunity hotspots identified</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card D: REIT Presence */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Crown className="h-4 w-4 text-purple-500" />
                <CardTitle className="text-sm font-medium text-foreground">REIT Presence</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Grade A Competitors</span>
                <span className="font-medium text-foreground">{gradeACount}</span>
              </div>
              <Badge variant={reitBadge.variant} className="w-full justify-center py-1">
                {reitBadge.label}
              </Badge>
            </CardContent>
          </Card>
        </div>

        {/* ========== SECTION 3: LOCAL SCAN (Micro-Market) ========== */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Radar className="h-5 w-5 text-cyan-500" />
              <CardTitle className="text-foreground">Local Scan (Micro-Market)</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-4 gap-4 mb-4">
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-xs text-muted-foreground uppercase">Radius Used</p>
                <p className="text-lg font-semibold text-foreground">15 mi</p>
              </div>
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-xs text-muted-foreground uppercase">Local Population</p>
                <p className="text-lg font-semibold text-foreground">{population.toLocaleString()}</p>
              </div>
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-xs text-muted-foreground uppercase">Local Competitors</p>
                <p className="text-lg font-semibold text-foreground">{data.competitors?.length || 0}</p>
              </div>
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-xs text-muted-foreground uppercase">Supply/Demand Gap</p>
                <p className={`text-lg font-semibold ${supplyGap > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {supplyGap > 0 ? '+' : ''}{supplyGap.toLocaleString()} sqft
                </p>
              </div>
            </div>

            {/* Competitor List with Grades */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <Users className="h-3 w-3" /> Competitor Grades
              </p>
              <div className="flex flex-wrap gap-2">
                {data.competitors?.slice(0, 8).map((comp: any, i: number) => {
                  const grade = comp.grade || 'C';
                  const gradeColors: Record<string, string> = {
                    A: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
                    B: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
                    C: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
                  };
                  return (
                    <Badge key={i} variant="outline" className={gradeColors[grade] || gradeColors.C}>
                      {comp.name?.slice(0, 20)} [{grade}]
                    </Badge>
                  );
                })}
                {(data.competitors?.length || 0) > 8 && (
                  <Badge variant="secondary" className="text-xs">
                    +{data.competitors.length - 8} more
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ========== FOOTER ACTION ========== */}
        <div className="flex justify-center pt-4">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <Button
                    size="lg"
                    onClick={handleRunPass2}
                    disabled={isRunningPass2 || !pass2Ready}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 disabled:opacity-50"
                  >
                    {isRunningPass2 ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Running Deep Dive...
                      </>
                    ) : (
                      <>
                        Proceed to Deep Dive (Pass 2)
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </>
                    )}
                  </Button>
                </div>
              </TooltipTrigger>
              {!pass2Ready && (
                <TooltipContent side="top" className="max-w-xs">
                  <p>Missing required fields — check validation panel</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
}