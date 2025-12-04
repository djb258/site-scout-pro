import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ArrowLeft, Loader2, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function EngineScreener() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    zip_code: '',
    urban_exclude: false,
    multifamily_priority: false,
    recreation_load: false,
    industrial_momentum: false,
    analysis_mode: 'build'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!/^\d{5}$/.test(formData.zip_code)) {
      toast.error('Please enter a valid 5-digit ZIP code');
      return;
    }

    setIsLoading(true);
    
    try {
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
