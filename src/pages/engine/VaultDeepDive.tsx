import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ArrowLeft, Loader2, ChevronDown, ChevronRight, MapPin, TrendingUp, DollarSign, Scale } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface VaultRecord {
  id: string;
  json_payload: any;
  saturation_score: number;
  final_score: number;
  decision: string;
  created_at: string;
}

export default function VaultDeepDive() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [isLoading, setIsLoading] = useState(true);
  const [record, setRecord] = useState<VaultRecord | null>(null);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    jurisdiction: true,
    viability: true,
    feasibility: false,
    fusion: false,
    verdict: true
  });

  useEffect(() => {
    loadRecord();
  }, [id]);

  const loadRecord = async () => {
    try {
      const { data, error } = await supabase
        .from('site_results_staging')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setRecord(data as VaultRecord);
    } catch (error) {
      console.error('Error loading vault record:', error);
      toast.error('Failed to load record');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!record) {
    return (
      <div className="min-h-screen bg-background p-6 text-center">
        <p className="text-muted-foreground">Record not found</p>
        <Button onClick={() => navigate('/engine/vault')} className="mt-4">
          Back to Vault
        </Button>
      </div>
    );
  }

  const payload = record.json_payload || {};
  const jurisdiction = payload.jurisdiction || {};
  const viability = payload.viability_summary || {};
  const feasibility = payload.feasibility_bundle || {};
  const fusion = payload.fusion_model_output || {};
  const verdict = payload.verdict_packet || {};
  const industrial = payload.industrial_intel || {};

  const verdictColor = record.decision === 'PROCEED' ? 'text-emerald-500' : 
                       record.decision === 'WALK' ? 'text-red-500' : 'text-amber-500';

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/engine/vault')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground">Vault Deep Dive</h1>
            <p className="text-muted-foreground">
              {jurisdiction.city || 'Unknown'}, {jurisdiction.state || 'Unknown'} • ZIP {jurisdiction.zip || payload.zip_code}
            </p>
          </div>
          <Badge 
            variant={record.decision === 'PROCEED' ? 'default' : 
                    record.decision === 'WALK' ? 'destructive' : 'secondary'}
            className={record.decision === 'PROCEED' ? 'bg-emerald-500' : ''}
          >
            {record.decision || 'EVALUATE'}
          </Badge>
        </div>

        {/* Jurisdiction Card */}
        <Collapsible open={openSections.jurisdiction} onOpenChange={() => toggleSection('jurisdiction')}>
          <Card className="bg-card border-border">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <MapPin className="h-5 w-5 text-blue-500" />
                    <CardTitle className="text-foreground">Jurisdiction</CardTitle>
                  </div>
                  {openSections.jurisdiction ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">City</p>
                    <p className="font-medium text-foreground">{jurisdiction.city || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">State</p>
                    <p className="font-medium text-foreground">{jurisdiction.state || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">County</p>
                    <p className="font-medium text-foreground">{jurisdiction.county || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Population</p>
                    <p className="font-medium text-foreground">{jurisdiction.population?.toLocaleString() || 'N/A'}</p>
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Viability Summary */}
        <Collapsible open={openSections.viability} onOpenChange={() => toggleSection('viability')}>
          <Card className="bg-card border-border">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="h-5 w-5 text-emerald-500" />
                    <CardTitle className="text-foreground">Viability Summary</CardTitle>
                  </div>
                  {openSections.viability ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground">Pass 1 Score</p>
                    <p className="text-2xl font-bold text-amber-500">{viability.pass1_score || record.saturation_score || 0}</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground">Pass 2 Score</p>
                    <p className="text-2xl font-bold text-emerald-500">{viability.pass2_score || record.final_score || 0}</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground">Confidence</p>
                    <p className="text-2xl font-bold text-blue-500">{((viability.confidence || 0) * 100).toFixed(0)}%</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground">Final Verdict</p>
                    <p className={`text-2xl font-bold ${verdictColor}`}>{viability.final_verdict || record.decision}</p>
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Feasibility Bundle */}
        <Collapsible open={openSections.feasibility} onOpenChange={() => toggleSection('feasibility')}>
          <Card className="bg-card border-border">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <DollarSign className="h-5 w-5 text-green-500" />
                    <CardTitle className="text-foreground">Feasibility Analysis</CardTitle>
                  </div>
                  {openSections.feasibility ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <h4 className="font-medium text-foreground">Development Costs</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Land Cost</span>
                        <span className="text-foreground">${feasibility.feasibility?.land_cost_estimate?.toLocaleString() || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Construction</span>
                        <span className="text-foreground">${feasibility.feasibility?.construction_cost?.toLocaleString() || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between border-t border-border pt-2">
                        <span className="text-muted-foreground font-medium">Total</span>
                        <span className="text-foreground font-medium">${feasibility.feasibility?.total_development?.toLocaleString() || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <h4 className="font-medium text-foreground">Returns</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Projected NOI</span>
                        <span className="text-foreground">${feasibility.feasibility?.projected_noi?.toLocaleString() || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Cap Rate</span>
                        <span className="text-foreground">{feasibility.feasibility?.cap_rate || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">5-Year ROI</span>
                        <span className="text-emerald-500 font-medium">{feasibility.feasibility?.roi_5yr || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Rent Benchmarks */}
                <div className="mt-6 pt-6 border-t border-border">
                  <h4 className="font-medium text-foreground mb-3">Rent Benchmarks</h4>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="text-center p-3 rounded-lg bg-muted/50">
                      <p className="text-muted-foreground">Climate 10×10</p>
                      <p className="text-lg font-medium text-foreground">${feasibility.rent_benchmarks?.climate_control_10x10 || 'N/A'}</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-muted/50">
                      <p className="text-muted-foreground">Standard 10×10</p>
                      <p className="text-lg font-medium text-foreground">${feasibility.rent_benchmarks?.standard_10x10 || 'N/A'}</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-muted/50">
                      <p className="text-muted-foreground">Outdoor 10×20</p>
                      <p className="text-lg font-medium text-foreground">${feasibility.rent_benchmarks?.outdoor_10x20 || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Fusion Model */}
        <Collapsible open={openSections.fusion} onOpenChange={() => toggleSection('fusion')}>
          <Card className="bg-card border-border">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Scale className="h-5 w-5 text-purple-500" />
                    <CardTitle className="text-foreground">Fusion Model Output</CardTitle>
                  </div>
                  {openSections.fusion ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground">Demand Score</p>
                    <p className="text-xl font-bold text-foreground">{fusion.demand_score || 0}</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground">Supply Gap</p>
                    <p className="text-xl font-bold text-foreground">{fusion.supply_gap?.toLocaleString() || 0} sqft</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground">Market Timing</p>
                    <p className="text-xl font-bold text-foreground capitalize">{fusion.market_timing || 'N/A'}</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground">Overall</p>
                    <p className="text-xl font-bold text-purple-500">{fusion.overall_score || 0}</p>
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Verdict & Notes */}
        <Collapsible open={openSections.verdict} onOpenChange={() => toggleSection('verdict')}>
          <Card className={`border-2 ${record.decision === 'PROCEED' ? 'border-emerald-500/30' : 
                                       record.decision === 'WALK' ? 'border-red-500/30' : 'border-amber-500/30'}`}>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-foreground">Final Verdict</CardTitle>
                  {openSections.verdict ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className={`text-3xl font-bold ${verdictColor}`}>{record.decision || 'EVALUATE'}</span>
                  <span className="text-muted-foreground">
                    Saved: {new Date(record.created_at).toLocaleDateString()}
                  </span>
                </div>

                {verdict.verdict?.recommendation && (
                  <p className="text-muted-foreground">{verdict.verdict.recommendation}</p>
                )}

                {payload.notes && (
                  <div className="mt-4 p-4 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground font-medium mb-2">Notes</p>
                    <p className="text-foreground">{payload.notes}</p>
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Raw JSON (Debug) */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground text-sm">Raw Data (Debug)</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs text-muted-foreground overflow-auto max-h-48 p-3 bg-muted/50 rounded-lg">
              {JSON.stringify(payload, null, 2)}
            </pre>
          </CardContent>
        </Card>

        {/* Back Button */}
        <Button 
          onClick={() => navigate('/engine/vault')} 
          variant="outline" 
          className="w-full"
        >
          Back to Vault
        </Button>
      </div>
    </div>
  );
}
