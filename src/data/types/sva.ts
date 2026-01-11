/**
 * SVA (Sovereign ID) — Decision Container
 *
 * The Sovereign ID (SVA) is the anchor for user intent throughout the evaluation pipeline.
 * It is minted when a user initiates a search and remains immutable throughout the process.
 *
 * Format: SVA-{TIMESTAMP}-{USER_ID}-{RANDOM}
 * Minting: User intent (search initiation)
 * Immutable: From creation
 *
 * Used by:
 * - SubHub3_Calculators: Anchors all feasibility calculations
 * - SubHub5_DealGate: Anchors final verdict
 *
 * @module SVA
 */

// ============================================================================
// SVA TYPES
// ============================================================================

/**
 * SVA status throughout the pipeline
 */
export type SVAStatus =
  | 'MINTED'        // Created, ready for processing
  | 'PROCESSING'    // Active in pipeline
  | 'CALCULATED'    // SubHub3 complete
  | 'ADJUDICATED'   // SubHub5 complete
  | 'ARCHIVED'      // No longer active
  | 'VOIDED';       // Invalidated

/**
 * SVA origin - what triggered the intent
 */
export type SVAOrigin =
  | 'USER_SEARCH'     // User-initiated ZIP search
  | 'BATCH_IMPORT'    // Bulk import of ZIPs
  | 'WATCHLIST'       // Watchlist triggered re-evaluation
  | 'MANUAL'          // Manual entry
  | 'API';            // API-initiated

/**
 * The core Sovereign ID object
 */
export interface SVA {
  /** Unique identifier: SVA-{TIMESTAMP}-{USER_ID}-{RANDOM} */
  id: string;

  /** When the SVA was minted */
  mintedAt: string;

  /** Who minted the SVA */
  userId: string;

  /** What triggered the SVA */
  origin: SVAOrigin;

  /** Current status */
  status: SVAStatus;

  /** Initial search parameters (immutable after minting) */
  intent: SVAIntent;

  /** Anchors collected during pipeline */
  anchors: SVAAnchors;

  /** Pipeline progress tracking */
  pipeline: SVAPipeline;

  /** Metadata */
  metadata: SVAMetadata;
}

/**
 * The intent captured at minting time (immutable)
 */
export interface SVAIntent {
  /** Primary ZIP anchor */
  zipCode: string;

  /** Derived County FIPS */
  countyFips?: string;

  /** Search radius for analysis */
  radiusMiles?: number;

  /** Target criteria (if specified) */
  targetCriteria?: {
    minAcreage?: number;
    maxAcreage?: number;
    targetIRR?: number;
    maxLandPrice?: number;
  };

  /** Additional context */
  notes?: string;
}

/**
 * Anchors collected through the pipeline
 */
export interface SVAAnchors {
  /** ZIP code (from SubHub0/1) */
  zip: string;

  /** County FIPS (derived from ZIP) */
  countyFips?: string;

  /** Parcel IDs promoted from SubHub4 */
  parcelIds: string[];

  /** Market anchor from SubHub1 */
  marketAnchor?: string;

  /** Jurisdiction anchor from SubHub2 */
  jurisdictionAnchor?: string;
}

/**
 * Pipeline progress tracking
 */
export interface SVAPipeline {
  /** SubHub0 completion */
  subhub0?: {
    runId: string;
    completedAt: string;
    status: 'complete' | 'partial' | 'failed';
  };

  /** SubHub1 completion */
  subhub1?: {
    runId: string;
    completedAt: string;
    status: 'complete' | 'partial' | 'failed';
  };

  /** SubHub2 completion */
  subhub2?: {
    runId: string;
    completedAt: string;
    status: 'complete' | 'partial' | 'failed';
  };

  /** SubHub3 completion */
  subhub3?: {
    runId: string;
    completedAt: string;
    status: 'complete' | 'partial' | 'failed';
  };

  /** SubHub4 completion */
  subhub4?: {
    runId: string;
    completedAt: string;
    status: 'complete' | 'partial' | 'failed';
    parcelsPromoted: number;
  };

  /** SubHub5 completion */
  subhub5?: {
    runId: string;
    completedAt: string;
    verdict: 'GOOD_DEAL' | 'BAD_DEAL';
    gatesPassed: string[];
    gatesFailed: string[];
  };
}

/**
 * SVA metadata
 */
export interface SVAMetadata {
  /** Version of doctrine at minting */
  doctrineVersion: string;

  /** Source system */
  source: string;

  /** Tags for filtering */
  tags: string[];

  /** Last updated timestamp */
  updatedAt: string;

  /** TTL for auto-archival (days) */
  ttlDays?: number;
}

// ============================================================================
// SVA MINTING
// ============================================================================

/**
 * Generate a unique SVA ID
 */
export function generateSVAId(userId: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 11);
  return `SVA-${timestamp}-${userId}-${random}`;
}

/**
 * Mint a new SVA
 */
export function mintSVA(params: {
  userId: string;
  zipCode: string;
  origin: SVAOrigin;
  countyFips?: string;
  radiusMiles?: number;
  targetCriteria?: SVAIntent['targetCriteria'];
  notes?: string;
  tags?: string[];
}): SVA {
  const id = generateSVAId(params.userId);
  const now = new Date().toISOString();

  return {
    id,
    mintedAt: now,
    userId: params.userId,
    origin: params.origin,
    status: 'MINTED',
    intent: {
      zipCode: params.zipCode,
      countyFips: params.countyFips,
      radiusMiles: params.radiusMiles ?? 120,
      targetCriteria: params.targetCriteria,
      notes: params.notes,
    },
    anchors: {
      zip: params.zipCode,
      countyFips: params.countyFips,
      parcelIds: [],
    },
    pipeline: {},
    metadata: {
      doctrineVersion: '1.2.0',
      source: 'storage-gonogo-hub',
      tags: params.tags ?? [],
      updatedAt: now,
      ttlDays: 90,
    },
  };
}

// ============================================================================
// SVA UPDATES (Immutable pattern)
// ============================================================================

/**
 * Update SVA status
 */
export function updateSVAStatus(sva: SVA, status: SVAStatus): SVA {
  return {
    ...sva,
    status,
    metadata: {
      ...sva.metadata,
      updatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Record SubHub completion in SVA
 */
export function recordSubHubCompletion(
  sva: SVA,
  subhub: 'subhub0' | 'subhub1' | 'subhub2' | 'subhub3' | 'subhub4' | 'subhub5',
  result: {
    runId: string;
    status: 'complete' | 'partial' | 'failed';
    parcelsPromoted?: number;
    verdict?: 'GOOD_DEAL' | 'BAD_DEAL';
    gatesPassed?: string[];
    gatesFailed?: string[];
  }
): SVA {
  const now = new Date().toISOString();

  const pipelineUpdate: Partial<SVAPipeline> = {};

  if (subhub === 'subhub4') {
    pipelineUpdate.subhub4 = {
      runId: result.runId,
      completedAt: now,
      status: result.status,
      parcelsPromoted: result.parcelsPromoted ?? 0,
    };
  } else if (subhub === 'subhub5') {
    pipelineUpdate.subhub5 = {
      runId: result.runId,
      completedAt: now,
      verdict: result.verdict ?? 'BAD_DEAL',
      gatesPassed: result.gatesPassed ?? [],
      gatesFailed: result.gatesFailed ?? [],
    };
  } else {
    pipelineUpdate[subhub] = {
      runId: result.runId,
      completedAt: now,
      status: result.status,
    };
  }

  return {
    ...sva,
    status: subhub === 'subhub5' ? 'ADJUDICATED' : 'PROCESSING',
    pipeline: {
      ...sva.pipeline,
      ...pipelineUpdate,
    },
    metadata: {
      ...sva.metadata,
      updatedAt: now,
    },
  };
}

/**
 * Add promoted parcel to SVA
 */
export function addPromotedParcel(sva: SVA, parcelId: string): SVA {
  if (sva.anchors.parcelIds.includes(parcelId)) {
    return sva; // Already present
  }

  return {
    ...sva,
    anchors: {
      ...sva.anchors,
      parcelIds: [...sva.anchors.parcelIds, parcelId],
    },
    metadata: {
      ...sva.metadata,
      updatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Set County FIPS anchor (once derived from ZIP)
 */
export function setCountyFips(sva: SVA, countyFips: string): SVA {
  return {
    ...sva,
    intent: {
      ...sva.intent,
      countyFips,
    },
    anchors: {
      ...sva.anchors,
      countyFips,
    },
    metadata: {
      ...sva.metadata,
      updatedAt: new Date().toISOString(),
    },
  };
}

// ============================================================================
// SVA VALIDATION
// ============================================================================

/**
 * Validate SVA is ready for SubHub3
 */
export function canEnterSubHub3(sva: SVA): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!sva.anchors.zip) {
    errors.push('Missing ZIP anchor');
  }

  if (!sva.pipeline.subhub0 || sva.pipeline.subhub0.status === 'failed') {
    errors.push('SubHub0 not completed or failed');
  }

  if (!sva.pipeline.subhub1 || sva.pipeline.subhub1.status === 'failed') {
    errors.push('SubHub1 not completed or failed');
  }

  if (!sva.pipeline.subhub2 || sva.pipeline.subhub2.status === 'failed') {
    errors.push('SubHub2 not completed or failed');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate SVA is ready for SubHub5
 */
export function canEnterSubHub5(sva: SVA): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  const subhub3Check = canEnterSubHub3(sva);
  if (!subhub3Check.valid) {
    errors.push(...subhub3Check.errors);
  }

  if (!sva.pipeline.subhub3 || sva.pipeline.subhub3.status === 'failed') {
    errors.push('SubHub3 not completed or failed');
  }

  if (!sva.pipeline.subhub4 || sva.pipeline.subhub4.status === 'failed') {
    errors.push('SubHub4 not completed or failed');
  }

  if (sva.anchors.parcelIds.length === 0) {
    errors.push('No parcels promoted from SubHub4');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  generateSVAId,
  mintSVA,
  updateSVAStatus,
  recordSubHubCompletion,
  addPromotedParcel,
  setCountyFips,
  canEnterSubHub3,
  canEnterSubHub5,
};
