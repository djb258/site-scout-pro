import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Loader2, Save, RefreshCw, Trash2, FileText, Building, DollarSign, TrendingUp, Scale, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Pass2Data {
  zoning: any;
  permit_intel: any;
  industrial_deep: any;
  housing_pipeline: any;
  fusion_model: any;
  feasibility: any;
  reverse_feasibility: any;
  rent_benchmarks: any;
  verdict: any;
}

export default function Pass2Results() {
  const navigate = useNavigate();
  const { runId } = useParams();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [data, setData] = useState<Pass2Data | null>(null);
  const [zipRun, setZipRun] = useState<any>(null);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    loadData();
  }, [runId]);

  const loadData = async () => {
    try {
      const { data: run } = await supabase
        .from('zip_runs')
        .select('*')
        .eq('id', runId)
        .single();
      setZipRun(run);

      const { data: pass2 } = await supabase
        .from('pass2_results')
        .select('*')
        .eq('zip_run_id', runId)
        .single();
      setData(pass2 as unknown as Pass2Data);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load results');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveToVault = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase.functions.invoke('saveToVault', {
        body: { zip_run_id: runId, notes }
      });
      if (error) throw error;
      toast.success('Saved to vault!');
      navigate('/engine/vault');
    } catch (error: any) {
      toast.error(error.message || 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscard = async () => {
    if (!confirm('Discard this analysis? This cannot be undone.')) return;
    
    try {
      await supabase.from('pass2_results').delete().eq('zip_run_id', runId);
      await supabase.from('pass1_results').delete().eq('zip_run_id', runId);
      await supabase.from('zip_runs').delete().eq('id', runId);
      toast.success('Analysis discarded');
      navigate('/engine');
    } catch (error) {
      toast.error('Failed to discard');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-background p-6 text-center">
        <p className="text-muted-foreground">No Pass 2 data found</p>
        <Button onClick={() => navigate(`/engine/pass1/${runId}`)} className="mt-4">
          Back to Pass 1
        </Button>
      </div>
    );
  }

  const verdictColor = data.verdict?.decision === 'PROCEED' ? 'text-emerald-500' : 
                       data.verdict?.decision === 'WALK' ? 'text-red-500' : 'text-amber-500';

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(`/engine/pass1/${runId}`)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Pass 2: Deep Dive</h1>
              <p className="text-muted-foreground">ZIP {zipRun?.zip_code} • {zipRun?.analysis_mode?.toUpperCase()} Mode</p>
            </div>
          </div>
        </div>

        {/* Verdict Banner */}
        <Card className={`border-2 ${data.verdict?.decision === 'PROCEED' ? 'border-emerald-500/50 bg-emerald-500/5' : 
                                     data.verdict?.decision === 'WALK' ? 'border-red-500/50 bg-red-500/5' : 
                                     'border-amber-500/50 bg-amber-500/5'}`}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {data.verdict?.decision === 'PROCEED' ? (
                  <CheckCircle2 className="h-12 w-12 text-emerald-500" />
                ) : data.verdict?.decision === 'WALK' ? (
                  <XCircle className="h-12 w-12 text-red-500" />
                ) : (
                  <Scale className="h-12 w-12 text-amber-500" />
                )}
                <div>
                  <h2 className={`text-3xl font-bold ${verdictColor}`}>{data.verdict?.decision}</h2>
                  <p className="text-muted-foreground">Confidence: {((data.verdict?.confidence || 0) * 100).toFixed(0)}%</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Fusion Score</p>
                <p className="text-4xl font-bold text-foreground">{data.fusion_model?.overall_score || 0}</p>
              </div>
            </div>
            <p className="mt-4 text-muted-foreground">{data.verdict?.recommendation}</p>
          </CardContent>
        </Card>

        {/* Analysis Grid */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Zoning */}
          <Card className="bg-card border-border">
            <CardHeader>
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-emerald-500" />
                <CardTitle className="text-foreground">Zoning Intelligence</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Primary Zone</span>
                <span className="text-foreground">{data.zoning?.primary_zone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Storage Allowed</span>
                <Badge variant={data.zoning?.storage_allowed ? 'default' : 'destructive'}>
                  {data.zoning?.storage_allowed ? 'Yes' : 'No'}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Variance Needed</span>
                <span className="text-foreground">{data.zoning?.variance_needed ? 'Yes' : 'No'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Height Limit</span>
                <span className="text-foreground">{data.zoning?.height_limit}</span>
              </div>
            </CardContent>
          </Card>

          {/* Permits */}
          <Card className="bg-card border-border">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Building className="h-5 w-5 text-emerald-500" />
                <CardTitle className="text-foreground">Permit Intel</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Timeline</span>
                <span className="text-foreground">{data.permit_intel?.estimated_timeline}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Est. Fees</span>
                <span className="text-foreground">${data.permit_intel?.total_fees?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Complexity</span>
                <Badge variant="outline" className="capitalize">{data.permit_intel?.complexity}</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Feasibility */}
          <Card className="bg-card border-border">
            <CardHeader>
              <div className="flex items-center gap-3">
                <DollarSign className="h-5 w-5 text-emerald-500" />
                <CardTitle className="text-foreground">Financial Feasibility</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Development</span>
                <span className="text-foreground">${data.feasibility?.total_development?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Projected NOI</span>
                <span className="text-foreground">${data.feasibility?.projected_noi?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cap Rate</span>
                <span className="text-foreground">{data.feasibility?.cap_rate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">5-Year ROI</span>
                <span className="text-emerald-500 font-medium">{data.feasibility?.roi_5yr}</span>
              </div>
            </CardContent>
          </Card>

          {/* Rent Benchmarks */}
          <Card className="bg-card border-border">
            <CardHeader>
              <div className="flex items-center gap-3">
                <TrendingUp className="h-5 w-5 text-emerald-500" />
                <CardTitle className="text-foreground">Rent Benchmarks</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Climate 10x10</span>
                <span className="text-foreground">${data.rent_benchmarks?.climate_control_10x10}/mo</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Standard 10x10</span>
                <span className="text-foreground">${data.rent_benchmarks?.standard_10x10}/mo</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Outdoor 10x20</span>
                <span className="text-foreground">${data.rent_benchmarks?.outdoor_10x20}/mo</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Market Position</span>
                <Badge variant="outline" className="capitalize">{data.rent_benchmarks?.market_position}</Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Key Factors */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Key Factors & Risks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-medium text-emerald-500 mb-2">Positive Factors</h4>
                <ul className="space-y-1">
                  {data.verdict?.key_factors?.map((f: string, i: number) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-medium text-red-500 mb-2">Risks</h4>
                <ul className="space-y-1">
                  {data.verdict?.risks?.map((r: string, i: number) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-red-500" />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Notes</CardTitle>
            <CardDescription>Add any notes before saving to vault</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Add your analysis notes here..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[100px] bg-background"
            />
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex flex-wrap gap-4">
          <Button variant="destructive" onClick={handleDiscard}>
            <Trash2 className="mr-2 h-4 w-4" />
            Discard
          </Button>
          <Button variant="outline" onClick={() => navigate(`/engine/pass1/${runId}`)}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Rerun Pass 2
          </Button>
          <Button 
            onClick={handleSaveToVault}
            disabled={isSaving}
            className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white"
          >
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save to Vault
          </Button>
        </div>
      </div>
    </div>
  );
}
