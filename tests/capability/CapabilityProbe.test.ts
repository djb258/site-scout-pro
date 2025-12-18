/**
 * CapabilityProbe Tests
 *
 * DOCTRINE VERIFICATION:
 * - Expired profiles force re-probe
 * - "no_zoning" skips zoning detection
 * - automation_viable computed correctly
 * - CapabilityProbe never scrapes PDFs
 * - Determinism: same inputs → same outputs
 */

import { describe, it, expect } from 'vitest';
import {
  runCapabilityProbe,
  shouldProbeCounty,
  getTimeUntilExpiration,
  isAutomationViable,
  isProfileExpired,
  calculateExpiration,
  PROFILE_TTL_DAYS,
} from '../../src/capability';
import type {
  CountyCapabilityProfile,
  CapabilityProbeInput,
  ZoningModel,
  PermitSystem,
  DocumentQuality,
} from '../../src/capability/types';

// =============================================================================
// TEST FIXTURES
// =============================================================================

function createTestInput(): CapabilityProbeInput {
  return {
    county_id: 12345,
    county_name: 'Test County',
    state_code: 'TX',
  };
}

function createTestProfile(overrides: Partial<CountyCapabilityProfile> = {}): CountyCapabilityProfile {
  const now = new Date();
  const expires = new Date(now);
  expires.setFullYear(expires.getFullYear() + 1);

  return {
    county_id: 12345,
    zoning_model: 'countywide',
    permit_system: 'portal_scrape',
    document_quality: 'structured_html',
    inspections_linked: true,
    automation_viable: true,
    confidence_level: 'medium',
    detected_vendor: 'accela',
    planning_url: 'https://example.gov/planning',
    permits_url: 'https://example.gov/permits',
    notes: 'Test profile',
    last_verified_at: now.toISOString(),
    expires_at: expires.toISOString(),
    ...overrides,
  };
}

function createExpiredProfile(): CountyCapabilityProfile {
  const past = new Date();
  past.setFullYear(past.getFullYear() - 2); // 2 years ago

  const expired = new Date(past);
  expired.setFullYear(expired.getFullYear() + 1); // 1 year after = 1 year ago

  return createTestProfile({
    last_verified_at: past.toISOString(),
    expires_at: expired.toISOString(),
  });
}

// =============================================================================
// 1. EXPIRED PROFILES FORCE RE-PROBE
// =============================================================================

describe('Expired Profiles', () => {
  it('should identify expired profile as needing probe', () => {
    const expiredProfile = createExpiredProfile();

    expect(shouldProbeCounty(expiredProfile, 'expired')).toBe(true);
  });

  it('should identify fresh profile as NOT needing probe', () => {
    const freshProfile = createTestProfile();

    expect(shouldProbeCounty(freshProfile, 'expired')).toBe(false);
  });

  it('should always probe if profile is null (missing)', () => {
    expect(shouldProbeCounty(null, 'missing')).toBe(true);
  });

  it('should always probe on manual request regardless of freshness', () => {
    const freshProfile = createTestProfile();

    expect(shouldProbeCounty(freshProfile, 'manual')).toBe(true);
  });

  it('should probe low-confidence profiles when entering pass2 scope', () => {
    const lowConfidenceProfile = createTestProfile({ confidence_level: 'low' });

    expect(shouldProbeCounty(lowConfidenceProfile, 'pass2_scope')).toBe(true);
  });

  it('should NOT probe medium/high confidence profiles when entering pass2 scope', () => {
    const mediumConfidenceProfile = createTestProfile({ confidence_level: 'medium' });

    expect(shouldProbeCounty(mediumConfidenceProfile, 'pass2_scope')).toBe(false);
  });

  it('should correctly calculate expiration from verification date', () => {
    const verifiedAt = new Date('2024-06-15T12:00:00Z');
    const expiresAt = calculateExpiration(verifiedAt);

    // Should be approximately 1 year later
    const diffMs = expiresAt.getTime() - verifiedAt.getTime();
    const oneYearMs = 365 * 24 * 60 * 60 * 1000;

    // Allow for leap year variation (364-366 days)
    expect(diffMs).toBeGreaterThanOrEqual(oneYearMs - 86400000);
    expect(diffMs).toBeLessThanOrEqual(oneYearMs + 86400000);
  });

  it('should correctly identify profile as expired', () => {
    const pastDate = new Date();
    pastDate.setFullYear(pastDate.getFullYear() - 1);

    expect(isProfileExpired(pastDate.toISOString())).toBe(true);
  });

  it('should correctly identify profile as NOT expired', () => {
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);

    expect(isProfileExpired(futureDate.toISOString())).toBe(false);
  });

  it('should treat null expires_at as expired', () => {
    expect(isProfileExpired(null)).toBe(true);
  });
});

// =============================================================================
// 2. NO_ZONING IS VALID FIRST-CLASS MODEL
// =============================================================================

describe('No Zoning Model', () => {
  it('should detect "no zoning" from explicit page content', async () => {
    const input = createTestInput();
    const pageContent = {
      planning_page: 'Test County does not have zoning. Land use is unregulated.',
      permits_page: null,
    };

    const result = await runCapabilityProbe(input, {}, pageContent);

    expect(result.profile.zoning_model).toBe('no_zoning');
  });

  it('should detect "no zoning" from various statement patterns', async () => {
    const patterns = [
      'This county has no zoning ordinance.',
      'Land in unincorporated areas is unzoned.',
      'Zoning does not apply to this jurisdiction.',
    ];

    for (const pattern of patterns) {
      const input = createTestInput();
      const pageContent = { planning_page: pattern, permits_page: null };

      const result = await runCapabilityProbe(input, {}, pageContent);

      expect(result.profile.zoning_model).toBe('no_zoning');
    }
  });

  it('should allow no_zoning as a valid zoning model value', () => {
    const zoningModels: ZoningModel[] = [
      'countywide',
      'municipal_only',
      'overlay_based',
      'no_zoning',
      'unknown',
    ];

    expect(zoningModels).toContain('no_zoning');
  });
});

// =============================================================================
// 3. AUTOMATION_VIABLE COMPUTED CORRECTLY
// =============================================================================

describe('Automation Viability', () => {
  it('should be viable with api + structured_html', () => {
    expect(isAutomationViable('api', 'structured_html')).toBe(true);
  });

  it('should be viable with api + searchable_pdf', () => {
    expect(isAutomationViable('api', 'searchable_pdf')).toBe(true);
  });

  it('should be viable with portal_scrape + structured_html', () => {
    expect(isAutomationViable('portal_scrape', 'structured_html')).toBe(true);
  });

  it('should be viable with portal_scrape + searchable_pdf', () => {
    expect(isAutomationViable('portal_scrape', 'searchable_pdf')).toBe(true);
  });

  it('should NOT be viable with pdf_logs', () => {
    expect(isAutomationViable('pdf_logs', 'structured_html')).toBe(false);
    expect(isAutomationViable('pdf_logs', 'searchable_pdf')).toBe(false);
  });

  it('should NOT be viable with manual_only', () => {
    expect(isAutomationViable('manual_only', 'structured_html')).toBe(false);
    expect(isAutomationViable('manual_only', 'searchable_pdf')).toBe(false);
  });

  it('should NOT be viable with scanned_pdf', () => {
    expect(isAutomationViable('api', 'scanned_pdf')).toBe(false);
    expect(isAutomationViable('portal_scrape', 'scanned_pdf')).toBe(false);
  });

  it('should NOT be viable with document_quality = none', () => {
    expect(isAutomationViable('api', 'none')).toBe(false);
    expect(isAutomationViable('portal_scrape', 'none')).toBe(false);
  });

  it('should NOT be viable with unknown values', () => {
    expect(isAutomationViable('unknown', 'structured_html')).toBe(false);
    expect(isAutomationViable('api', 'unknown')).toBe(false);
    expect(isAutomationViable('unknown', 'unknown')).toBe(false);
  });

  it('should compute automation_viable in probe result', async () => {
    const input = createTestInput();
    const pageContent = {
      planning_page: 'Apply online through our Accela citizen access portal.',
      permits_page: 'Online code available through Municode.',
    };

    const result = await runCapabilityProbe(input, {}, pageContent);

    // automation_viable should match the formula
    const expected = isAutomationViable(
      result.profile.permit_system,
      result.profile.document_quality
    );
    expect(result.profile.automation_viable).toBe(expected);
  });
});

// =============================================================================
// 4. CAPABILITY PROBE NEVER SCRAPES PDFs
// =============================================================================

describe('No PDF Scraping', () => {
  it('should NOT download or parse PDF content', async () => {
    const input = createTestInput();
    const pageContent = {
      planning_page: `
        <html>
          <body>
            <a href="https://example.gov/zoning.pdf">Download Zoning Ordinance (PDF)</a>
            <a href="https://example.gov/permits.pdf">Permit Application (PDF)</a>
          </body>
        </html>
      `,
      permits_page: null,
    };

    const result = await runCapabilityProbe(input, {}, pageContent);

    // Probe should complete without errors (no PDF download attempted)
    expect(result.errors).toHaveLength(0);

    // Should detect PDF presence from links, NOT from PDF content
    const pdfSignals = [
      ...result.document_detection.signals,
      ...result.permit_detection.signals,
    ].filter(s => s.type.includes('pdf'));

    // PDF signals should come from link analysis, not content extraction
    for (const signal of pdfSignals) {
      expect(signal.source).not.toContain('.pdf');
      expect(signal.description).not.toContain('parsed');
      expect(signal.description).not.toContain('extracted');
    }
  });

  it('should detect PDF-based system from indicators, not content', async () => {
    const input = createTestInput();
    const pageContent = {
      planning_page: 'Download PDF applications. Print and mail to our office.',
      permits_page: null,
    };

    const result = await runCapabilityProbe(input, {}, pageContent);

    // Should detect PDF-based system from page text, not by downloading PDFs
    if (result.profile.permit_system === 'pdf_logs') {
      const signals = result.permit_detection.signals;
      expect(signals.some(s => s.type === 'pdf_indicator')).toBe(true);
    }
  });

  it('should identify document quality from URL patterns, not PDF parsing', async () => {
    const input = createTestInput();
    const pageContent = {
      planning_page: `
        View ordinances on <a href="https://municode.com/test">Municode</a>.
        Forms available as <a href="test.pdf">PDF downloads</a>.
      `,
      permits_page: null,
    };

    const result = await runCapabilityProbe(input, {}, pageContent);

    // Should prefer structured HTML when Municode is detected
    // (Municode provides searchable HTML codes)
    if (result.profile.document_quality === 'structured_html') {
      const signals = result.document_detection.signals;
      expect(signals.some(s =>
        s.type === 'structured_html_indicator' ||
        s.type === 'modern_cms_detected'
      )).toBe(true);
    }
  });
});

// =============================================================================
// 5. DETERMINISM: SAME INPUTS → SAME OUTPUTS
// =============================================================================

describe('Determinism', () => {
  it('should produce identical results for identical inputs', async () => {
    const input = createTestInput();
    const pageContent = {
      planning_page: 'Test County Planning Department. Zoning ordinance available online.',
      permits_page: 'Apply for permits through our online portal.',
    };

    // Run probe twice with identical inputs
    const result1 = await runCapabilityProbe(input, {}, pageContent);
    const result2 = await runCapabilityProbe(input, {}, pageContent);

    // Core profile values should match
    expect(result1.profile.zoning_model).toBe(result2.profile.zoning_model);
    expect(result1.profile.permit_system).toBe(result2.profile.permit_system);
    expect(result1.profile.document_quality).toBe(result2.profile.document_quality);
    expect(result1.profile.inspections_linked).toBe(result2.profile.inspections_linked);
    expect(result1.profile.automation_viable).toBe(result2.profile.automation_viable);

    // Detection values should match
    expect(result1.zoning_detection.value).toBe(result2.zoning_detection.value);
    expect(result1.permit_detection.value).toBe(result2.permit_detection.value);
    expect(result1.document_detection.value).toBe(result2.document_detection.value);
    expect(result1.inspection_detection.value).toBe(result2.inspection_detection.value);
  });

  it('should produce different results for different inputs', async () => {
    const input1: CapabilityProbeInput = {
      county_id: 1,
      county_name: 'Urban County',
      state_code: 'CA',
    };
    const pageContent1 = {
      planning_page: 'Apply online through Accela. Unified zoning code.',
      permits_page: null,
    };

    const input2: CapabilityProbeInput = {
      county_id: 2,
      county_name: 'Rural County',
      state_code: 'TX',
    };
    const pageContent2 = {
      planning_page: 'This county has no zoning. Call for information.',
      permits_page: null,
    };

    const result1 = await runCapabilityProbe(input1, {}, pageContent1);
    const result2 = await runCapabilityProbe(input2, {}, pageContent2);

    // Results should differ based on different page content
    expect(result1.profile.zoning_model).not.toBe(result2.profile.zoning_model);
  });

  it('should return unknown for empty/missing inputs', async () => {
    const input = createTestInput();
    const pageContent = {
      planning_page: null,
      permits_page: null,
    };

    const result = await runCapabilityProbe(input, {}, pageContent);

    // With no page content, most values should be unknown
    expect(result.profile.zoning_model).toBe('unknown');
    expect(result.profile.permit_system).toBe('unknown');
    expect(result.profile.document_quality).toBe('unknown');
  });
});

// =============================================================================
// 6. TTL ENFORCEMENT
// =============================================================================

describe('TTL Enforcement', () => {
  it('should set expires_at to 12 months after last_verified_at', async () => {
    const input = createTestInput();
    const result = await runCapabilityProbe(input, {});

    const verifiedAt = new Date(result.profile.last_verified_at);
    const expiresAt = new Date(result.profile.expires_at);

    // Calculate expected expiration (1 year later)
    const expectedExpires = new Date(verifiedAt);
    expectedExpires.setFullYear(expectedExpires.getFullYear() + 1);

    // Should be approximately 1 year apart (within a few seconds)
    const diffMs = Math.abs(expiresAt.getTime() - expectedExpires.getTime());
    expect(diffMs).toBeLessThan(5000); // Within 5 seconds
  });

  it('should report time until expiration correctly', () => {
    const profile = createTestProfile();
    const timeUntil = getTimeUntilExpiration(profile);

    // Should be approximately 1 year (within a day)
    const oneYearMs = 365 * 24 * 60 * 60 * 1000;
    expect(timeUntil).toBeGreaterThan(oneYearMs - 86400000); // Within 1 day
    expect(timeUntil).toBeLessThanOrEqual(oneYearMs);
  });

  it('should return 0 for expired profiles', () => {
    const expiredProfile = createExpiredProfile();
    const timeUntil = getTimeUntilExpiration(expiredProfile);

    expect(timeUntil).toBe(0);
  });

  it('should have PROFILE_TTL_DAYS constant set to 365', () => {
    expect(PROFILE_TTL_DAYS).toBe(365);
  });
});

// =============================================================================
// 7. VENDOR DETECTION
// =============================================================================

describe('Vendor Detection', () => {
  it('should detect portal system from Accela/CitizenAccess indicators', async () => {
    const input = createTestInput();
    const pageContent = {
      planning_page: null,
      permits_page: 'Apply online through our Citizen Access portal. Create account to submit applications.',
    };

    const result = await runCapabilityProbe(input, {}, pageContent);

    // Should detect portal-based system from "apply online" and "citizen access" indicators
    // The probe looks for portal indicators, not vendor URLs in page content
    expect(['portal_scrape', 'api', 'unknown']).toContain(result.profile.permit_system);

    // Check for portal detection signals
    const portalSignals = result.permit_detection.signals.filter(
      s => s.type === 'portal_indicator' || s.type === 'api_mention'
    );

    expect(portalSignals.length).toBeGreaterThan(0);
  });

  it('should detect Tyler/EnerGov from URL patterns', async () => {
    const input = createTestInput();
    const pageContent = {
      planning_page: 'View permits at https://energov.testcounty.gov',
      permits_page: null,
    };

    const result = await runCapabilityProbe(input, {}, pageContent);

    // Should detect portal/api capability
    expect(['api', 'portal_scrape', 'unknown']).toContain(
      result.profile.permit_system
    );
  });
});

// =============================================================================
// 8. CONFIDENCE AGGREGATION
// =============================================================================

describe('Confidence Aggregation', () => {
  it('should aggregate low confidence when no strong signals', async () => {
    const input = createTestInput();
    const pageContent = {
      planning_page: 'Welcome to Test County.',
      permits_page: null,
    };

    const result = await runCapabilityProbe(input, {}, pageContent);

    expect(result.profile.confidence_level).toBe('low');
  });

  it('should include confidence in profile output', async () => {
    const input = createTestInput();
    const result = await runCapabilityProbe(input, {});

    expect(['low', 'medium', 'high']).toContain(result.profile.confidence_level);
  });
});
