import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface QueueSummary {
  total: number;
  by_status: {
    pending: number;
    in_progress: number;
    resolved: number;
    failed: number;
    killed: number;
  };
  by_priority: {
    critical: number;
    high: number;
    normal: number;
    low: number;
  };
  by_gap_type: {
    missing_rate: number;
    low_confidence: number;
    no_phone: number;
    no_scrape_data: number;
    other: number;
  };
  by_worker: {
    ai_caller: number;
    scraper: number;
    unassigned: number;
  };
}

export interface CostSummary {
  total_cents: number;
  today_cents: number;
  by_worker: {
    scraper_cents: number;
    ai_caller_cents: number;
  };
}

export interface Performance {
  total_attempts: number;
  terminal_attempts: number;
  completed_count: number;
  failed_count: number;
  success_rate: number;
  failure_rate: number;
  avg_duration_ms: number;
  avg_cost_cents: number;
}

export interface GuardRailStatus {
  cost_cap_remaining_cents: number;
  cost_cap_used_percent: number;
  daily_calls_remaining: number;
  daily_calls_used_percent: number;
  failure_rate: number;
  failure_rate_breach: boolean;
  kill_switch_active: boolean;
  health: 'green' | 'yellow' | 'red';
}

export interface AttemptLogEntry {
  id: string;
  gap_queue_id: string;
  competitor_name?: string;
  worker_type: string;
  attempt_number: number;
  status: string;
  duration_ms?: number;
  cost_cents?: number;
  error_code?: string;
  error_message?: string;
  created_at: string;
}

export interface Pass15DashboardData {
  process_id: string;
  version: string;
  generated_at: string;
  run_id?: string;
  queue_summary: QueueSummary;
  cost_summary: CostSummary;
  performance: Performance;
  guard_rail_status: GuardRailStatus;
  recent_attempts?: AttemptLogEntry[];
}

interface UsePass15DashboardResult {
  data: Pass15DashboardData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  lastUpdated: Date | null;
}

export function usePass15Dashboard(refreshInterval = 30000): UsePass15DashboardResult {
  const [data, setData] = useState<Pass15DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchDashboard = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data: response, error: fetchError } = await supabase.functions.invoke('hub15_get_dashboard', {
        body: { include_attempts: true, limit: 50 },
      });

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      if (response?.error) {
        throw new Error(response.error);
      }

      setData(response);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('[usePass15Dashboard] Error fetching dashboard:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch dashboard');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();

    // Auto-refresh at specified interval
    const intervalId = setInterval(fetchDashboard, refreshInterval);

    return () => clearInterval(intervalId);
  }, [fetchDashboard, refreshInterval]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchDashboard,
    lastUpdated,
  };
}
