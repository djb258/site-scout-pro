import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ArrowRight, Loader2, MapPin, Users, Building2, Home, Factory, Tent } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
  const summary = data.analysis_summary;

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
          <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/30">
            {summary?.analysis_mode?.toUpperCase()} MODE
          </Badge>
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

        {/* Competitors */}
        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-amber-500" />
              <CardTitle className="text-foreground">Competitors ({data.competitors?.length || 0})</CardTitle>
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
            </div>
          </CardContent>
        </Card>

        {/* Signals Grid */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Housing Signals */}
          <Card className="bg-card border-border">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Home className="h-5 w-5 text-amber-500" />
                <CardTitle className="text-foreground text-base">Housing Signals</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Home Value</span>
                <span className="text-foreground">${data.housing_signals?.median_home_value?.toLocaleString() || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ownership Rate</span>
                <span className="text-foreground">{(data.housing_signals?.home_ownership_rate * 100)?.toFixed(1) || 'N/A'}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Growth</span>
                <Badge variant="outline" className="capitalize">{data.housing_signals?.growth_indicator}</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Industrial Signals */}
          <Card className="bg-card border-border">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Factory className="h-5 w-5 text-amber-500" />
                <CardTitle className="text-foreground text-base">Industrial Signals</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Distribution Centers</span>
                <span className="text-foreground">{data.industrial_signals?.distribution_centers_nearby || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Manufacturing</span>
                <Badge variant="outline" className="capitalize">{data.industrial_signals?.manufacturing_presence}</Badge>
              </div>
            </CardContent>
          </Card>

          {/* RV/Recreation */}
          <Card className="bg-card border-border">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Tent className="h-5 w-5 text-amber-500" />
                <CardTitle className="text-foreground text-base">Recreation Signals</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">RV Potential</span>
                <Badge variant="outline" className="capitalize">{data.rv_lake_signals?.rv_potential}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Lake Proximity</span>
                <span className="text-foreground">{data.rv_lake_signals?.lake_proximity ? 'Yes' : 'No'}</span>
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
              <span className="text-muted-foreground">Preliminary Score</span>
              <span className="text-3xl font-bold text-amber-500">{summary?.viability_score || 0}/100</span>
            </div>
            <p className="text-sm text-muted-foreground">{summary?.recommendation}</p>
            <div className="mt-4 space-y-1">
              {summary?.key_factors?.map((factor: string, i: number) => (
                <p key={i} className="text-sm text-muted-foreground">• {factor}</p>
              ))}
            </div>
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
