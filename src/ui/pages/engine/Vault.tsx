import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Loader2, Database, MapPin, Calendar, TrendingUp, Eye } from 'lucide-react';
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

export default function Vault() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [records, setRecords] = useState<VaultRecord[]>([]);

  useEffect(() => {
    loadVaultRecords();
  }, []);

  const loadVaultRecords = async () => {
    try {
      const { data, error } = await supabase
        .from('site_results_staging')
        .select('*')
        .eq('status', 'vault_saved')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRecords(data as VaultRecord[]);
    } catch (error) {
      console.error('Error loading vault:', error);
      toast.error('Failed to load vault records');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/engine')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <Database className="h-6 w-6 text-blue-500" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">Vault</h1>
              <p className="text-muted-foreground">Saved viability analyses</p>
            </div>
          </div>
        </div>

        {records.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="p-12 text-center">
              <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No saved analyses</h3>
              <p className="text-muted-foreground mb-4">
                Complete a Pass 1 + Pass 2 analysis and save it to see records here.
              </p>
              <Button onClick={() => navigate('/engine/screener')}>
                Start New Analysis
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {records.map((record) => {
              const payload = record.json_payload as any;
              const jurisdiction = payload?.jurisdiction || {};
              const viability = payload?.viability_summary || {};
              
              return (
                <Card key={record.id} className="bg-card border-border hover:border-blue-500/30 transition-colors">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <MapPin className="h-5 w-5 text-blue-500" />
                          <div>
                            <h3 className="font-medium text-foreground">
                              {jurisdiction.city || 'Unknown'}, {jurisdiction.state || 'Unknown'}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              ZIP: {jurisdiction.zip || payload?.zip_code || 'N/A'}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {new Date(record.created_at).toLocaleDateString()}
                          </div>
                          <div className="flex items-center gap-1">
                            <TrendingUp className="h-4 w-4" />
                            Score: {record.final_score || viability.pass2_score || 0}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <Badge 
                          variant={record.decision === 'PROCEED' ? 'default' : 
                                  record.decision === 'WALK' ? 'destructive' : 'secondary'}
                          className={record.decision === 'PROCEED' ? 'bg-emerald-500' : ''}
                        >
                          {record.decision || viability.final_verdict || 'EVALUATE'}
                        </Badge>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => navigate(`/engine/vault/${record.id}`)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {payload?.notes && (
                      <p className="mt-3 text-sm text-muted-foreground border-t border-border pt-3">
                        {payload.notes}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
