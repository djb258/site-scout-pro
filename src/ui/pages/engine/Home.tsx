import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Zap, Database, Search, FileCheck } from 'lucide-react';

export default function EngineHome() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-foreground">
            Storage Viability Engine
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Two-stage analysis system for evaluating storage facility development opportunities
          </p>
        </div>

        {/* Pass Overview Cards */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="border-amber-500/20 bg-card">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <Zap className="h-6 w-6 text-amber-500" />
                </div>
                <CardTitle className="text-foreground">Pass 1: Quick Scan</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <CardDescription className="text-muted-foreground">
                Fast, shallow analysis using local database
              </CardDescription>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• ZIP validation & metadata</li>
                <li>• 120-mile radius county lookup</li>
                <li>• Population & density analysis</li>
                <li>• Competitor identification</li>
                <li>• Housing & industrial signals</li>
                <li>• RV/recreation potential</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-emerald-500/20 bg-card">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <Search className="h-6 w-6 text-emerald-500" />
                </div>
                <CardTitle className="text-foreground">Pass 2: Deep Dive</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <CardDescription className="text-muted-foreground">
                AI-powered comprehensive analysis
              </CardDescription>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Zoning intelligence</li>
                <li>• Permit portal analysis</li>
                <li>• Financial feasibility model</li>
                <li>• Reverse feasibility analysis</li>
                <li>• Rent benchmarks</li>
                <li>• Build/Buy/Walk verdict</li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Vault Info */}
        <Card className="border-blue-500/20 bg-card">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Database className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <CardTitle className="text-foreground">Vault Storage</CardTitle>
                <CardDescription className="text-muted-foreground">
                  Permanent storage for approved analyses
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Pass 1 and Pass 2 data is stored temporarily for review. Only when you click 
              "Save to Vault" will the curated results be permanently stored. This ensures 
              data quality and prevents accidental storage of incomplete analyses.
            </p>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button 
            size="lg" 
            onClick={() => navigate('/engine/screener')}
            className="bg-amber-500 hover:bg-amber-600 text-black"
          >
            <Zap className="mr-2 h-5 w-5" />
            Start New Analysis
          </Button>
          <Button 
            size="lg" 
            variant="outline"
            onClick={() => navigate('/engine/vault')}
            className="border-muted-foreground/30"
          >
            <FileCheck className="mr-2 h-5 w-5" />
            View Saved Analyses
          </Button>
        </div>
      </div>
    </div>
  );
}
