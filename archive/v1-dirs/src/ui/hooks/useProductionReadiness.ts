// TODO: BAR-111 — rewrite to call CF Worker endpoint (was Supabase direct query + edge functions)
import { useState } from 'react';

export interface ChecklistItem {
  id: string;
  name: string;
  pass: number;
  category: 'blocking' | 'high_priority' | 'warning';
  status: 'pass' | 'fail' | 'warning' | 'unknown';
  message?: string;
  lastChecked?: string;
}

export interface ProductionReadinessState {
  isReady: boolean;
  blockingCount: number;
  highPriorityCount: number;
  warningCount: number;
  items: ChecklistItem[];
  loading: boolean;
  lastUpdated: string | null;
}

export function useProductionReadiness() {
  const [state] = useState<ProductionReadinessState & { refresh: () => void }>({
    isReady: false,
    blockingCount: 0,
    highPriorityCount: 0,
    warningCount: 0,
    items: [],
    loading: false,
    lastUpdated: null,
    refresh: () => {
      // TODO: BAR-111 — migrate all checks to CF Worker D1/Hyperdrive queries
    },
  });

  return state;
}
