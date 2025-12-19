/**
 * Pass 2 — Jurisdiction Card System
 * ============================================================================
 *
 * DOCTRINE:
 * Pass 2 defines WHAT is true about a jurisdiction.
 *
 * - Data may be known or unknown
 * - Absence of data is meaningful
 * - Pass 3 consumes this data without reinterpretation
 * - This is county-scoped, not parcel-scoped
 *
 * If a planner would write it on paper, it belongs here.
 * If it is a calculation or derived value, it belongs in Pass 3.
 *
 * ============================================================================
 */

// Types
export * from './types';

// Factories
export {
  createEmptyJurisdictionCard,
  createUnknownNumeric,
  createUnknownTernary,
  createUnknownText,
  createKnownNumeric,
  createKnownTernary,
  createKnownText,
  CreateJurisdictionCardInput,
  UpdateNumericFieldInput,
  UpdateTernaryFieldInput,
  UpdateTextFieldInput,
} from './factories/jurisdiction_card_factory';
