// TODO: BAR-111 — rewrite to call CF Worker endpoint (was Supabase edge function hub15_get_dashboard)
import { useState } from 'react';

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

export function usePass15Dashboard(_refreshInterval = 30000): UsePass15DashboardResult {
  const [data] = useState<Pass15DashboardData | null>(null);
  const [lastUpdated] = useState<Date | null>(null);

  // TODO: BAR-111 — migrate to CF Worker endpoint
  return {
    data,
    isLoading: false,
    error: 'BAR-111: Supabase retired, awaiting CF Worker migration',
    refetch: async () => {},
    lastUpdated,
  };
}
