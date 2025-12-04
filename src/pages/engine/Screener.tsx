import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ArrowLeft, Loader2, Zap, Settings, ChevronDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { DEFAULT_CALCULATOR_INPUTS, type CalculatorInputs } from '@/services/pass2Calculators';

export default function EngineScreener() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [showCalculatorSettings, setShowCalculatorSettings] = useState(false);
  
  const [formData, setFormData] = useState({
    zip_code: '',
    urban_exclude: false,
    multifamily_priority: false,
    recreation_load: false,
    industrial_momentum: false,
    analysis_mode: 'build'
  });

  const [calculatorInputs, setCalculatorInputs] = useState<CalculatorInputs>(DEFAULT_CALCULATOR_INPUTS);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!/^\d{5}$/.test(formData.zip_code)) {
      toast.error('Please enter a valid 5-digit ZIP code');
      return;
    }

    setIsLoading(true);
    
    try {
      // Store calculator inputs in sessionStorage for Pass 2
      sessionStorage.setItem('calculatorInputs', JSON.stringify(calculatorInputs));
      
      const { data, error } = await supabase.functions.invoke('startPass1', {
        body: formData
      });

      if (error) throw error;

      toast.success('Pass 1 analysis complete!');
      navigate(`/engine/pass1/${data.zip_run_id}`);
    } catch (error: any) {
      console.error('Pass 1 error:', error);
      toast.error(error.message || 'Failed to run Pass 1 analysis');
    } finally {
      setIsLoading(false);
    }
  };

  const updateCalculatorInput = (key: keyof CalculatorInputs, value: number) => {
    setCalculatorInputs(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate('/engine')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Pass 1: Screener</h1>
            <p className="text-muted-foreground">Configure your analysis parameters</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* ZIP Code Input */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground">Location</CardTitle>
              <CardDescription>Enter the target ZIP code</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="zip_code">ZIP Code</Label>
                <Input
                  id="zip_code"
                  placeholder="Enter 5-digit ZIP"
                  value={formData.zip_code}
                  onChange={(e) => setFormData(prev => ({ ...prev, zip_code: e.target.value }))}
                  maxLength={5}
                  className="bg-background border-input"
                />
              </div>
            </CardContent>
          </Card>

          {/* Analysis Mode */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground">Analysis Mode</CardTitle>
              <CardDescription>Select your primary objective</CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={formData.analysis_mode}
                onValueChange={(value) => setFormData(prev => ({ ...prev, analysis_mode: value }))}
                className="space-y-3"
              >
                <div className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                  <RadioGroupItem value="build" id="build" />
                  <Label htmlFor="build" className="flex-1 cursor-pointer">
                    <span className="font-medium text-foreground">Build</span>
                    <p className="text-sm text-muted-foreground">Evaluate for new construction</p>
                  </Label>
                </div>
                <div className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                  <RadioGroupItem value="buy" id="buy" />
                  <Label htmlFor="buy" className="flex-1 cursor-pointer">
                    <span className="font-medium text-foreground">Buy</span>
                    <p className="text-sm text-muted-foreground">Evaluate existing facilities for acquisition</p>
                  </Label>
                </div>
                <div className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                  <RadioGroupItem value="compare" id="compare" />
                  <Label htmlFor="compare" className="flex-1 cursor-pointer">
                    <span className="font-medium text-foreground">Compare</span>
                    <p className="text-sm text-muted-foreground">Side-by-side build vs buy analysis</p>
                  </Label>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>

          {/* Toggles */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground">Analysis Filters</CardTitle>
              <CardDescription>Fine-tune your analysis parameters</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-foreground">Exclude Urban Areas</Label>
                  <p className="text-sm text-muted-foreground">Filter out high-density urban locations</p>
                </div>
                <Switch
                  checked={formData.urban_exclude}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, urban_exclude: checked }))}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-foreground">Multifamily Priority</Label>
                  <p className="text-sm text-muted-foreground">Prioritize areas with multifamily housing</p>
                </div>
                <Switch
                  checked={formData.multifamily_priority}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, multifamily_priority: checked }))}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-foreground">Recreation Load</Label>
                  <p className="text-sm text-muted-foreground">Include RV/boat/recreation storage demand</p>
                </div>
                <Switch
                  checked={formData.recreation_load}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, recreation_load: checked }))}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-foreground">Industrial Momentum</Label>
                  <p className="text-sm text-muted-foreground">Weight industrial/logistics growth factors</p>
                </div>
                <Switch
                  checked={formData.industrial_momentum}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, industrial_momentum: checked }))}
                />
              </div>
            </CardContent>
          </Card>

          {/* Calculator Settings (Collapsible) */}
          <Collapsible open={showCalculatorSettings} onOpenChange={setShowCalculatorSettings}>
            <Card className="bg-card border-border">
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Settings className="h-5 w-5 text-amber-500" />
                      <div>
                        <CardTitle className="text-foreground">Calculator Inputs</CardTitle>
                        <CardDescription>Customize feasibility assumptions</CardDescription>
                      </div>
                    </div>
                    <ChevronDown className={`h-5 w-5 transition-transform ${showCalculatorSettings ? 'rotate-180' : ''}`} />
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Metal Building $/sqft</Label>
                      <Input
                        type="number"
                        step="0.5"
                        min="18"
                        max="35"
                        value={calculatorInputs.metalBuildingCostPerSqft}
                        onChange={(e) => updateCalculatorInput('metalBuildingCostPerSqft', parseFloat(e.target.value) || 0)}
                        className="bg-background"
                      />
                      <p className="text-xs text-muted-foreground">Typical: $22-24</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Concrete $/yard</Label>
                      <Input
                        type="number"
                        step="5"
                        min="100"
                        max="250"
                        value={calculatorInputs.concreteCostPerYard}
                        onChange={(e) => updateCalculatorInput('concreteCostPerYard', parseFloat(e.target.value) || 0)}
                        className="bg-background"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Finish Labor $/sqft</Label>
                      <Input
                        type="number"
                        step="0.25"
                        min="1"
                        max="5"
                        value={calculatorInputs.finishLaborCost}
                        onChange={(e) => updateCalculatorInput('finishLaborCost', parseFloat(e.target.value) || 0)}
                        className="bg-background"
                      />
                      <p className="text-xs text-muted-foreground">Default: $2.50</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Land Cost ($)</Label>
                      <Input
                        type="number"
                        step="10000"
                        min="50000"
                        value={calculatorInputs.landCost}
                        onChange={(e) => updateCalculatorInput('landCost', parseFloat(e.target.value) || 0)}
                        className="bg-background"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Cap Rate Target (%)</Label>
                      <Input
                        type="number"
                        step="0.25"
                        min="4"
                        max="12"
                        value={(calculatorInputs.capRateTarget * 100).toFixed(2)}
                        onChange={(e) => updateCalculatorInput('capRateTarget', (parseFloat(e.target.value) || 0) / 100)}
                        className="bg-background"
                      />
                      <p className="text-xs text-muted-foreground">Default: 6.5%</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Acreage Available</Label>
                      <Input
                        type="number"
                        step="0.5"
                        min="0.5"
                        max="20"
                        value={calculatorInputs.acreageAvailable}
                        onChange={(e) => updateCalculatorInput('acreageAvailable', parseFloat(e.target.value) || 0)}
                        className="bg-background"
                      />
                    </div>
                  </div>
                  
                  <div className="border-t border-border pt-4">
                    <h4 className="text-sm font-medium text-foreground mb-3">Market Rents</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>10×10 Unit $/mo</Label>
                        <Input
                          type="number"
                          step="5"
                          min="50"
                          max="400"
                          value={calculatorInputs.marketRent10x10}
                          onChange={(e) => updateCalculatorInput('marketRent10x10', parseFloat(e.target.value) || 0)}
                          className="bg-background"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>10×20 Unit $/mo</Label>
                        <Input
                          type="number"
                          step="5"
                          min="75"
                          max="500"
                          value={calculatorInputs.marketRent10x20}
                          onChange={(e) => updateCalculatorInput('marketRent10x20', parseFloat(e.target.value) || 0)}
                          className="bg-background"
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Submit */}
          <Button 
            type="submit" 
            size="lg" 
            className="w-full bg-amber-500 hover:bg-amber-600 text-black"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Running Pass 1...
              </>
            ) : (
              <>
                <Zap className="mr-2 h-5 w-5" />
                Run Pass 1 Analysis
              </>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
