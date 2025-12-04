import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ArrowRight, Loader2, MapPin, Users, Building2, Home, Factory, Tent, Landmark } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  compilePass1Summary, 
  calculateCompetitorDensity,
  calculateMultifamilyInfluence,
  calculateIndustrialQuickScore,
  calculateRecreationProximity,
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

      // Run client-side calculators
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
  const multifamilyCalc = calculateMultifamilyInfluence(data as Pass1CalcData);
  const industrialCalc = calculateIndustrialQuickScore(data as Pass1CalcData);
  const recreationCalc = calculateRecreationProximity(data as Pass1CalcData);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/engine/screener')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Pass 1 Results</h1>
              <p className="text-muted-foreground">Quick scan analysis for ZIP {zipRun?.zip_code}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/30">
              {zipRun?.analysis_mode?.toUpperCase()} MODE
            </Badge>
            {summary?.tier && (
              <Badge variant={summary.tier === 'A' ? 'default' : summary.tier === 'B' ? 'secondary' : 'outline'}>
                Tier {summary.tier}
              </Badge>
            )}
          </div>
        </div>

        {/* ZIP Summary */}
        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex items-center gap-3">
              <MapPin className="h-5 w-5 text-amber-500" />
              <CardTitle className="text-foreground">Location Summary</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">City</p>
                <p className="font-medium text-foreground">{zipMeta?.city || 'Unknown'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">State</p>
                <p className="font-medium text-foreground">{zipMeta?.state_name || 'Unknown'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Population</p>
                <p className="font-medium text-foreground">{zipMeta?.population?.toLocaleString() || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Density</p>
                <p className="font-medium text-foreground">{zipMeta?.density?.toFixed(1) || 'N/A'}/sq mi</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Competitors with Calculator Score */}
        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Building2 className="h-5 w-5 text-amber-500" />
                <CardTitle className="text-foreground">Competitors ({data.competitors?.length || 0})</CardTitle>
              </div>
              <Badge variant={competitorCalc.densityScore > 70 ? 'default' : competitorCalc.densityScore > 40 ? 'secondary' : 'destructive'}>
                Density Score: {competitorCalc.densityScore}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.competitors?.map((comp: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <p className="font-medium text-foreground">{comp.name}</p>
                    <p className="text-sm text-muted-foreground">{comp.distance_miles} miles away</p>
                  </div>
                  <Badge variant="outline">{comp.estimated_sqft?.toLocaleString()} sqft</Badge>
                </div>
              ))}
              <div className="pt-3 border-t border-border text-sm text-muted-foreground">
                Total competitor sqft: {competitorCalc.totalSqft.toLocaleString()} • Avg distance: {competitorCalc.avgDistance} mi
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Demand Anchors */}
        {data.anchors && data.anchors.length > 0 && (
          <Card className="bg-card border-border">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Landmark className="h-5 w-5 text-amber-500" />
                <CardTitle className="text-foreground">Demand Anchors ({data.anchors.length})</CardTitle>
              </div>
              <CardDescription>Major employers and destinations driving storage demand</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.anchors.map((anchor: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div>
                      <p className="font-medium text-foreground">{anchor.name}</p>
                      <p className="text-sm text-muted-foreground capitalize">{anchor.type}</p>
                    </div>
                    <Badge variant="outline">{anchor.distance_miles} mi</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Signals Grid with Calculator Scores */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Housing Signals */}
          <Card className="bg-card border-border">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Home className="h-5 w-5 text-amber-500" />
                  <CardTitle className="text-foreground text-base">Housing Signals</CardTitle>
                </div>
                <Badge variant={multifamilyCalc.influence === 'high' ? 'default' : 'secondary'} className="capitalize">
                  {multifamilyCalc.influence}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Home Value</span>
                <span className="text-foreground">${data.housing_signals?.median_home_value?.toLocaleString() || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ownership Rate</span>
                <span className="text-foreground">{((data.housing_signals?.home_ownership_rate || 0) * 100)?.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Multifamily Score</span>
                <span className="text-amber-500 font-medium">{multifamilyCalc.score}/100</span>
              </div>
            </CardContent>
          </Card>

          {/* Industrial Signals */}
          <Card className="bg-card border-border">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Factory className="h-5 w-5 text-amber-500" />
                  <CardTitle className="text-foreground text-base">Industrial Signals</CardTitle>
                </div>
                <Badge variant={industrialCalc.momentum === 'strong' ? 'default' : 'secondary'} className="capitalize">
                  {industrialCalc.momentum}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Distribution Centers</span>
                <span className="text-foreground">{industrialCalc.distributionCenters}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Manufacturing</span>
                <span className="text-foreground capitalize">{industrialCalc.manufacturingPresence}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Industrial Score</span>
                <span className="text-amber-500 font-medium">{industrialCalc.score}/100</span>
              </div>
            </CardContent>
          </Card>

          {/* RV/Recreation */}
          <Card className="bg-card border-border">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Tent className="h-5 w-5 text-amber-500" />
                  <CardTitle className="text-foreground text-base">Recreation Signals</CardTitle>
                </div>
                <Badge variant={recreationCalc.score > 50 ? 'default' : 'secondary'}>
                  Score: {recreationCalc.score}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">RV Potential</span>
                <Badge variant="outline" className="capitalize">{recreationCalc.rvPotential}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Lake Proximity</span>
                <span className="text-foreground">{recreationCalc.lakeProximity ? 'Yes' : 'No'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Campground Nearby</span>
                <span className="text-foreground">{recreationCalc.campgroundNearby ? 'Yes' : 'No'}</span>
              </div>
            </CardContent>
          </Card>

          {/* Radius Counties */}
          <Card className="bg-card border-border">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-amber-500" />
                <CardTitle className="text-foreground text-base">Nearby Counties ({data.radius_counties?.length || 0})</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {data.radius_counties?.slice(0, 8).map((county: any, i: number) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {county.county}
                  </Badge>
                ))}
                {(data.radius_counties?.length || 0) > 8 && (
                  <Badge variant="outline" className="text-xs">
                    +{data.radius_counties.length - 8} more
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Viability Score */}
        <Card className="bg-card border-amber-500/30">
          <CardHeader>
            <CardTitle className="text-foreground">Quick Viability Assessment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-4">
              <span className="text-muted-foreground">Calculated Viability Score</span>
              <span className="text-3xl font-bold text-amber-500">{summary?.viabilityScore || 0}/100</span>
            </div>
            <p className="text-sm text-muted-foreground mb-4">{summary?.recommendation}</p>
            
            {summary?.keyFactors?.length > 0 && (
              <div className="mb-3">
                <p className="text-sm font-medium text-emerald-500 mb-1">Key Factors</p>
                {summary.keyFactors.map((factor: string, i: number) => (
                  <p key={i} className="text-sm text-muted-foreground">• {factor}</p>
                ))}
              </div>
            )}
            
            {summary?.riskFactors?.length > 0 && (
              <div>
                <p className="text-sm font-medium text-red-500 mb-1">Risk Factors</p>
                {summary.riskFactors.map((risk: string, i: number) => (
                  <p key={i} className="text-sm text-muted-foreground">• {risk}</p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-4">
          <Button 
            variant="outline" 
            onClick={() => navigate('/engine/screener')}
            className="flex-1"
          >
            Start Over
          </Button>
          <Button 
            onClick={handleRunPass2}
            disabled={isRunningPass2}
            className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white"
          >
            {isRunningPass2 ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Running Deep Dive...
              </>
            ) : (
              <>
                Run Deep Dive
                <ArrowRight className="ml-2 h-5 w-5" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
