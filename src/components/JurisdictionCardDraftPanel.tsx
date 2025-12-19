import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Clock, 
  ChevronDown,
  FileText,
  Shield,
  Zap
} from 'lucide-react';

interface JurisdictionDraft {
  id: string;
  execution_id: string;
  county_id: number;
  state_code: string;
  asset_class: string;
  status: 'pending' | 'validated' | 'rejected' | 'promoted';
  envelope_complete: boolean;
  card_complete: boolean;
  fatal_prohibition: 'yes' | 'no' | 'unknown';
  field_states: Record<string, 'known' | 'unknown' | 'blocked'>;
  provenance_log: Array<{
    field: string;
    state: string;
    source_type?: string;
    source_reference?: string;
    raw_text?: string;
  }>;
  red_flags: string[];
  failure_reason: string | null;
  duration_ms: number | null;
  collected_at: string;
  promoted_at: string | null;
  neon_version_hash: string | null;
}

interface JurisdictionCardDraftPanelProps {
  countyId?: number;
  stateCode?: string;
}

export function JurisdictionCardDraftPanel({ countyId, stateCode }: JurisdictionCardDraftPanelProps) {
  const [drafts, setDrafts] = useState<JurisdictionDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedDraft, setExpandedDraft] = useState<string | null>(null);

  useEffect(() => {
    fetchDrafts();
  }, [countyId, stateCode]);

  async function fetchDrafts() {
    setLoading(true);
    try {
      let query = supabase
        .from('jurisdiction_card_drafts')
        .select('*')
        .order('collected_at', { ascending: false })
        .limit(20);

      if (countyId) {
        query = query.eq('county_id', countyId);
      }
      if (stateCode) {
        query = query.eq('state_code', stateCode);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Failed to fetch drafts:', error);
        return;
      }

      // Type assertion for JSONB fields
      const typedDrafts = (data || []).map(d => ({
        ...d,
        status: d.status as JurisdictionDraft['status'],
        fatal_prohibition: d.fatal_prohibition as JurisdictionDraft['fatal_prohibition'],
        field_states: d.field_states as Record<string, 'known' | 'unknown' | 'blocked'>,
        provenance_log: d.provenance_log as JurisdictionDraft['provenance_log'],
        red_flags: d.red_flags as string[],
      }));

      setDrafts(typedDrafts);
    } finally {
      setLoading(false);
    }
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case 'validated':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'promoted':
        return <Zap className="h-4 w-4 text-blue-500" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'pending':
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  }

  function getStatusBadge(status: string) {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      validated: 'default',
      promoted: 'secondary',
      rejected: 'destructive',
      pending: 'outline',
    };
    return <Badge variant={variants[status] || 'outline'}>{status}</Badge>;
  }

  function getFieldStateIcon(state: string) {
    switch (state) {
      case 'known':
        return <CheckCircle className="h-3 w-3 text-green-500" />;
      case 'blocked':
        return <Shield className="h-3 w-3 text-orange-500" />;
      case 'unknown':
      default:
        return <AlertCircle className="h-3 w-3 text-muted-foreground" />;
    }
  }

  function countFieldStates(fieldStates: Record<string, string>) {
    let known = 0, unknown = 0, blocked = 0;
    for (const state of Object.values(fieldStates)) {
      if (state === 'known') known++;
      else if (state === 'unknown') unknown++;
      else if (state === 'blocked') blocked++;
    }
    return { known, unknown, blocked, total: known + unknown + blocked };
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Jurisdiction Card Drafts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground text-sm">Loading drafts...</div>
        </CardContent>
      </Card>
    );
  }

  if (drafts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Jurisdiction Card Drafts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground text-sm">No drafts found</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Jurisdiction Card Drafts
          <Badge variant="outline" className="ml-auto">{drafts.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[400px]">
          <div className="space-y-2 p-4">
            {drafts.map((draft) => {
              const fieldCounts = countFieldStates(draft.field_states);
              const isExpanded = expandedDraft === draft.execution_id;

              return (
                <Collapsible
                  key={draft.execution_id}
                  open={isExpanded}
                  onOpenChange={() => setExpandedDraft(isExpanded ? null : draft.execution_id)}
                >
                  <div className="border rounded-lg p-3 space-y-2">
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(draft.status)}
                          <span className="font-mono text-xs text-muted-foreground">
                            {draft.execution_id.slice(0, 8)}...
                          </span>
                          {getStatusBadge(draft.status)}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {draft.state_code} • County {draft.county_id}
                          </span>
                          <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </div>
                      </Button>
                    </CollapsibleTrigger>

                    {/* Summary row always visible */}
                    <div className="flex items-center gap-4 text-xs">
                      <div className="flex items-center gap-1">
                        <span className={draft.envelope_complete ? 'text-green-500' : 'text-muted-foreground'}>
                          Envelope: {draft.envelope_complete ? '✓' : '○'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className={draft.card_complete ? 'text-green-500' : 'text-muted-foreground'}>
                          Card: {draft.card_complete ? '✓' : '○'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <span className="text-green-500">{fieldCounts.known}K</span>
                        <span>/</span>
                        <span className="text-orange-500">{fieldCounts.blocked}B</span>
                        <span>/</span>
                        <span className="text-muted-foreground">{fieldCounts.unknown}U</span>
                      </div>
                      {draft.fatal_prohibition === 'yes' && (
                        <Badge variant="destructive" className="text-xs">FATAL</Badge>
                      )}
                    </div>

                    <CollapsibleContent>
                      <div className="pt-2 border-t mt-2 space-y-3">
                        {/* Timestamps */}
                        <div className="text-xs text-muted-foreground space-y-1">
                          <div>Collected: {new Date(draft.collected_at).toLocaleString()}</div>
                          {draft.promoted_at && (
                            <div>Promoted: {new Date(draft.promoted_at).toLocaleString()}</div>
                          )}
                          {draft.duration_ms && (
                            <div>Duration: {draft.duration_ms}ms</div>
                          )}
                        </div>

                        {/* Red flags */}
                        {draft.red_flags.length > 0 && (
                          <div className="space-y-1">
                            <div className="text-xs font-medium text-destructive">Red Flags:</div>
                            <div className="space-y-1">
                              {draft.red_flags.map((flag, i) => (
                                <div key={i} className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1">
                                  {flag}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Failure reason */}
                        {draft.failure_reason && (
                          <div className="space-y-1">
                            <div className="text-xs font-medium text-destructive">Failure Reason:</div>
                            <div className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1">
                              {draft.failure_reason}
                            </div>
                          </div>
                        )}

                        {/* Field states grid */}
                        <div className="space-y-1">
                          <div className="text-xs font-medium">Field States:</div>
                          <div className="grid grid-cols-2 gap-1 text-xs">
                            {Object.entries(draft.field_states).slice(0, 10).map(([field, state]) => (
                              <div key={field} className="flex items-center gap-1 text-muted-foreground">
                                {getFieldStateIcon(state)}
                                <span className="truncate">{field}</span>
                              </div>
                            ))}
                          </div>
                          {Object.keys(draft.field_states).length > 10 && (
                            <div className="text-xs text-muted-foreground">
                              +{Object.keys(draft.field_states).length - 10} more fields
                            </div>
                          )}
                        </div>

                        {/* Provenance snippets */}
                        {draft.provenance_log.some(p => p.raw_text) && (
                          <div className="space-y-1">
                            <div className="text-xs font-medium">Source Snippets:</div>
                            <div className="space-y-1 max-h-32 overflow-y-auto">
                              {draft.provenance_log
                                .filter(p => p.raw_text)
                                .slice(0, 3)
                                .map((p, i) => (
                                  <div key={i} className="text-xs bg-muted rounded px-2 py-1">
                                    <span className="font-medium">{p.field}:</span>{' '}
                                    <span className="text-muted-foreground italic">
                                      "{p.raw_text?.slice(0, 100)}{(p.raw_text?.length ?? 0) > 100 ? '...' : ''}"
                                    </span>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}

                        {/* Version hash if promoted */}
                        {draft.neon_version_hash && (
                          <div className="text-xs text-muted-foreground">
                            <span className="font-medium">Vault Hash:</span>{' '}
                            <span className="font-mono">{draft.neon_version_hash.slice(0, 16)}...</span>
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
