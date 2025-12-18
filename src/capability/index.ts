/**
 * County Capability Asset (CCA) Module
 *
 * DOCTRINE: This module answers HOW to get information from a county,
 * NOT what the rules are. Capability ≠ jurisdiction rules.
 *
 * - 12-month TTL with automatic expiration
 * - "unknown" is a valid first-class state
 * - "no_zoning" is a valid first-class zoning model
 * - No coupling to Pass 2 math or jurisdiction constraints
 *
 * USAGE:
 * - Pass 2 READS capability but does not mutate it
 * - JurisdictionCardHydrator MUST consult capability before scraping
 * - Retell/manual research only allowed if automation not viable
 */

// Main probe
export {
  runCapabilityProbe,
  shouldProbeCounty,
  getTimeUntilExpiration,
} from './CapabilityProbe';
export type { CapabilityProbeConfig } from './CapabilityProbe';

// Types
export type {
  // Enum types
  ZoningModel,
  PermitSystem,
  DocumentQuality,
  ConfidenceLevel,

  // Profile types
  CapabilityProbeInput,
  CountyCapabilityProfile,
  CountyCapabilityProfileUpdate,
  CapabilityProbeResult,
  CapabilityProbeRequest,
  ProbeStatus,

  // Detector types
  DetectorResult,
  DetectorSignal,
  ZoningModelDetectorResult,
  PermitSystemDetectorResult,
  DocumentQualityDetectorResult,
  InspectionLinkageDetectorResult,

  // Vendor types
  KnownPermitVendor,
} from './types';

// Constants and utilities
export {
  KNOWN_PERMIT_VENDORS,
  VENDOR_URL_PATTERNS,
  NO_ZONING_STATES,
  PROFILE_TTL_MS,
  PROFILE_TTL_DAYS,
  isAutomationViable,
  isProfileExpired,
  calculateExpiration,
} from './types';

// Detectors (for advanced usage)
export {
  detectPermitSystem,
  detectZoningModel,
  detectDocumentQuality,
  detectInspectionLinkage,
  getDetectedVendor,
  extractDocumentLinks,
  isNoZoningLikely,
} from './detectors';
