/**
 * Vitest Setup File
 *
 * Global test configuration and mocks.
 */

import { vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';

// Mock environment variables
beforeAll(() => {
  process.env.NEON_DATABASE_URL = 'postgres://test:test@localhost:5432/testdb';
  process.env.SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
  process.env.VITE_SUPABASE_URL = 'https://test.supabase.co';
  process.env.VITE_SUPABASE_ANON_KEY = 'test-anon-key';
});

// Reset mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
});

// Clean up after all tests
afterAll(() => {
  vi.restoreAllMocks();
});

// Global test utilities
export const mockProcessId = 'PASS1_20251217_120000_ABC123';

export const mockOpportunity = {
  id: 'opp-123',
  zipCode: '75001',
  status: 'pass1_complete',
  hotspotScore: 78,
  tier: 'A',
};

export const mockUnderwritingPackage = {
  id: 'uw-456',
  opportunityId: 'opp-123',
  verdict: 'GO',
  dealIndex: 8.5,
  noi: 72000,
  dscr: 1.45,
};

export const mockProForma = {
  id: 'pf-789',
  underwritingId: 'uw-456',
  totalUnits: 150,
  totalSqft: 25000,
  grossPotentialRent: 180000,
  effectiveGrossIncome: 162000,
  operatingExpenses: 48600,
  netOperatingIncome: 113400,
  capRate: 0.085,
  irr: 0.18,
};
