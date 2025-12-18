// =============================================================================
// PASS 2 CONSTRAINT COMPILER — Orchestrator
// =============================================================================
// Doctrine ID: SS.02.00
// Purpose: Compile jurisdiction + geometric constraints into buildability envelope
//
// DOCTRINE (NON-NEGOTIABLE):
// - Pass 2 is NOT financial modeling
// - Pass 2 does NOT decide if a deal is good
// - Pass 2 compiles CONSTRAINTS and produces a BUILDABILITY ENVELOPE
// - Pass 2 feeds Pass 3 clean constants
//
// If you violate this, stop.
// =============================================================================

import type { Pass2Input } from '../contracts/pass2_input';
import type { Pass2Output, Pass2Status } from '../contracts/pass2_output';
import { validatePass2Input } from '../contracts/pass2_input';
import { createDefaultPass2Output } from '../contracts/pass2_output';

// Constraint Spokes
import { runJurisdictionResolver } from '../spokes/JurisdictionResolver';
import { runJurisdictionCardReader } from '../spokes/JurisdictionCardReader';
import { runZoningConstraints } from '../spokes/ZoningConstraints';
import { runSitePlanConstraints } from '../spokes/SitePlanConstraints';
import { runStormwaterConstraints } from '../spokes/StormwaterConstraints';
import { runFireAccessConstraints } from '../spokes/FireAccessConstraints';
import { runPermittingChecklist } from '../spokes/PermittingChecklist';
import { runEnvelopeReducer } from '../spokes/EnvelopeReducer';
import { runConstraintVerdict } from '../spokes/ConstraintVerdict';

// Types
import type {
  JurisdictionResolverResult,
  JurisdictionCardReaderResult,
  ZoningConstraintsResult,
  SitePlanConstraintsResult,
  StormwaterConstraintsResult,
  FireAccessConstraintsResult,
  PermittingChecklistResult,
  EnvelopeReducerResult,
  ConstraintVerdictResult,
} from '../types/constraint_types';

// =============================================================================
// PASS 2 CONSTRAINT COMPILER CLASS
// =============================================================================

export class Pass2ConstraintCompiler {
  private errors: string[] = [];

  /**
   * Compile constraints for a site.
   *
   * DOCTRINE: This compiles constraints and produces a buildability envelope.
   * NO financial calculations. NO revenue projections. NO cost estimates.
   */
  async compile(input: Pass2Input): Promise<Pass2Output> {
    const startTime = Date.now();

    console.log(`[PASS2_CONSTRAINT_COMPILER] Starting compilation for ZIP: ${input.zip_code}`);

    // Validate input
    const validationErrors = validatePass2Input(input);
    if (validationErrors.length > 0) {
      const output = createDefaultPass2Output(input);
      output.status = 'HOLD_INCOMPLETE';
      output.errors = validationErrors;
      output.summary = `Input validation failed: ${validationErrors.join(', ')}`;
      return output;
    }

    // Initialize output
    const output = createDefaultPass2Output(input);

    // Initialize spoke results
    let jurisdiction: JurisdictionResolverResult | null = null;
    let card: JurisdictionCardReaderResult | null = null;
    let zoning: ZoningConstraintsResult | null = null;
    let sitePlan: SitePlanConstraintsResult | null = null;
    let stormwater: StormwaterConstraintsResult | null = null;
    let fireAccess: FireAccessConstraintsResult | null = null;
    let permitting: PermittingChecklistResult | null = null;
    let envelope: EnvelopeReducerResult | null = null;
    let verdict: ConstraintVerdictResult | null = null;

    // -------------------------------------------------------------------------
    // SPOKE 1: Jurisdiction Resolver (SS.02.01)
    // -------------------------------------------------------------------------
    try {
      console.log('[PASS2_CONSTRAINT_COMPILER] Running JurisdictionResolver...');
      jurisdiction = await runJurisdictionResolver({
        zip_code: input.zip_code,
        state: input.state,
        county: input.county,
        latitude: input.latitude,
        longitude: input.longitude,
      });
      output.provenance.counties_consulted = jurisdiction.primary_jurisdiction
        ? [jurisdiction.primary_jurisdiction.county]
        : [];
    } catch (err) {
      this.errors.push(`JurisdictionResolver failed: ${err}`);
    }

    // -------------------------------------------------------------------------
    // SPOKE 2: Jurisdiction Card Reader (SS.02.02)
    // -------------------------------------------------------------------------
    if (jurisdiction?.primary_jurisdiction) {
      try {
        console.log('[PASS2_CONSTRAINT_COMPILER] Running JurisdictionCardReader...');
        card = await runJurisdictionCardReader({
          jurisdiction_id: jurisdiction.primary_jurisdiction.jurisdiction_id,
          asset_class: input.asset_class,
        });
        if (card.card) {
          output.provenance.jurisdiction_cards_used = [card.card.card_id];
        }
      } catch (err) {
        this.errors.push(`JurisdictionCardReader failed: ${err}`);
      }
    }

    // -------------------------------------------------------------------------
    // SPOKE 3: Zoning Constraints (SS.02.03)
    // -------------------------------------------------------------------------
    if (jurisdiction?.primary_jurisdiction) {
      try {
        console.log('[PASS2_CONSTRAINT_COMPILER] Running ZoningConstraints...');
        zoning = await runZoningConstraints(
          {
            jurisdiction_id: jurisdiction.primary_jurisdiction.jurisdiction_id,
            parcel_id: input.parcel_id,
            latitude: input.latitude,
            longitude: input.longitude,
            asset_class: input.asset_class,
          },
          card?.card
        );
        // Copy zoning constraints to output
        output.constraints.zoning_code = zoning.zoning_code;
        output.constraints.storage_allowed = zoning.storage_allowed;
        output.constraints.conditional_use_required = zoning.conditional_use_required;
        output.constraints.setback_front_ft = zoning.setbacks.front_ft;
        output.constraints.setback_side_ft = zoning.setbacks.side_ft;
        output.constraints.setback_rear_ft = zoning.setbacks.rear_ft;
        output.constraints.max_lot_coverage_pct = zoning.max_lot_coverage_pct;
        output.constraints.max_building_height_ft = zoning.max_height_ft;
        output.constraints.max_stories = zoning.max_stories;
        output.constraints.floor_area_ratio = zoning.floor_area_ratio;
      } catch (err) {
        this.errors.push(`ZoningConstraints failed: ${err}`);
      }
    }

    // -------------------------------------------------------------------------
    // SPOKE 4: Site Plan Constraints (SS.02.04)
    // -------------------------------------------------------------------------
    if (jurisdiction?.primary_jurisdiction) {
      try {
        console.log('[PASS2_CONSTRAINT_COMPILER] Running SitePlanConstraints...');
        sitePlan = await runSitePlanConstraints(
          {
            jurisdiction_id: jurisdiction.primary_jurisdiction.jurisdiction_id,
            asset_class: input.asset_class,
            gross_acres: input.requested_acres,
          },
          card?.card
        );
        // Copy site plan constraints to output
        output.constraints.min_parking_spaces = sitePlan.min_parking_spaces;
        output.constraints.ada_parking_required = sitePlan.ada_spaces_required !== null;
        output.constraints.landscape_buffer_ft = sitePlan.landscape_buffer_ft;
        output.constraints.landscape_pct_required = sitePlan.landscape_pct_required;
      } catch (err) {
        this.errors.push(`SitePlanConstraints failed: ${err}`);
      }
    }

    // -------------------------------------------------------------------------
    // SPOKE 5: Stormwater Constraints (SS.02.05)
    // -------------------------------------------------------------------------
    if (jurisdiction?.primary_jurisdiction) {
      try {
        console.log('[PASS2_CONSTRAINT_COMPILER] Running StormwaterConstraints...');
        stormwater = await runStormwaterConstraints(
          {
            jurisdiction_id: jurisdiction.primary_jurisdiction.jurisdiction_id,
            gross_acres: input.requested_acres,
            latitude: input.latitude,
            longitude: input.longitude,
          },
          card?.card
        );
        // Copy stormwater constraints to output
        output.constraints.stormwater_required = stormwater.stormwater_plan_required;
        output.constraints.detention_required = stormwater.detention_required;
        output.constraints.retention_required = stormwater.retention_required;
        output.constraints.infiltration_allowed = stormwater.infiltration_allowed;
      } catch (err) {
        this.errors.push(`StormwaterConstraints failed: ${err}`);
      }
    }

    // -------------------------------------------------------------------------
    // SPOKE 6: Fire Access Constraints (SS.02.06)
    // -------------------------------------------------------------------------
    if (jurisdiction?.primary_jurisdiction) {
      try {
        console.log('[PASS2_CONSTRAINT_COMPILER] Running FireAccessConstraints...');
        fireAccess = await runFireAccessConstraints(
          {
            jurisdiction_id: jurisdiction.primary_jurisdiction.jurisdiction_id,
            asset_class: input.asset_class,
          },
          card?.card
        );
        // Copy fire constraints to output
        output.constraints.fire_lane_required = fireAccess.fire_lane_required;
        output.constraints.fire_lane_width_ft = fireAccess.fire_lane_width_ft;
        output.constraints.hydrant_spacing_ft = fireAccess.hydrant_spacing_ft;
        output.constraints.sprinkler_required = fireAccess.sprinkler_required;
      } catch (err) {
        this.errors.push(`FireAccessConstraints failed: ${err}`);
      }
    }

    // -------------------------------------------------------------------------
    // SPOKE 7: Permitting Checklist (SS.02.07)
    // -------------------------------------------------------------------------
    if (zoning && stormwater && fireAccess) {
      try {
        console.log('[PASS2_CONSTRAINT_COMPILER] Running PermittingChecklist...');
        permitting = await runPermittingChecklist({
          jurisdiction_id: jurisdiction?.primary_jurisdiction?.jurisdiction_id ?? 'UNKNOWN',
          asset_class: input.asset_class,
          zoning,
          stormwater,
          fire_access: fireAccess,
        });
        // Build approval checklist
        output.approval_checklist = permitting.permits_required.map(p => ({
          type: p.permit_type,
          description: p.description,
          required: p.required,
          difficulty: p.difficulty ?? 'unknown',
          source: p.authority,
        }));
      } catch (err) {
        this.errors.push(`PermittingChecklist failed: ${err}`);
      }
    }

    // -------------------------------------------------------------------------
    // SPOKE 8: Envelope Reducer (SS.02.08)
    // -------------------------------------------------------------------------
    if (input.requested_acres && zoning && sitePlan && stormwater && fireAccess) {
      try {
        console.log('[PASS2_CONSTRAINT_COMPILER] Running EnvelopeReducer...');
        envelope = await runEnvelopeReducer({
          gross_acres: input.requested_acres,
          asset_class: input.asset_class,
          zoning,
          site_plan: sitePlan,
          stormwater,
          fire_access: fireAccess,
        });
        // Copy envelope to output
        output.buildability.gross_acres = envelope.gross_acres;
        output.buildability.net_buildable_acres = envelope.net_buildable_acres;
        output.buildability.sqft_per_acre_ceiling = envelope.sqft_per_acre_ceiling;
        output.buildability.max_buildable_sqft = envelope.max_buildable_sqft;
        output.buildability.envelope_valid = envelope.envelope_valid;
        output.buildability.envelope_invalid_reason = envelope.invalid_reason;
      } catch (err) {
        this.errors.push(`EnvelopeReducer failed: ${err}`);
      }
    } else if (!input.requested_acres) {
      output.buildability.envelope_invalid_reason = 'No acreage provided - cannot calculate envelope';
    }

    // -------------------------------------------------------------------------
    // SPOKE 9: Constraint Verdict (SS.02.09)
    // -------------------------------------------------------------------------
    if (jurisdiction && zoning && sitePlan && stormwater && fireAccess && permitting && envelope) {
      try {
        console.log('[PASS2_CONSTRAINT_COMPILER] Running ConstraintVerdict...');
        verdict = await runConstraintVerdict({
          jurisdiction,
          card: card ?? { spoke_id: 'SS.02.02', status: 'stub', timestamp: new Date().toISOString(), notes: 'No card', card_found: false, card: null, card_age_days: null, card_stale: false },
          zoning,
          site_plan: sitePlan,
          stormwater,
          fire_access: fireAccess,
          permitting,
          envelope,
        });
        // Apply verdict to output
        output.status = verdict.status;
        output.fatal_flaws = verdict.fatal_flaws;
        output.unknowns = verdict.unknowns;
        output.manual_research_required = verdict.manual_research_required;
        output.summary = verdict.summary;

        // DOCTRINE: Populate primary signals
        output.jurisdiction_card_complete = verdict.status === 'ELIGIBLE';
        output.required_fields_missing = verdict.unknowns
          .filter(u => u.blocks_pass3)
          .map(u => u.field);
        output.fatal_prohibitions = verdict.fatal_flaws.filter(f =>
          f.includes('PROHIBITED') || f.includes('not allowed')
        );
      } catch (err) {
        this.errors.push(`ConstraintVerdict failed: ${err}`);
      }
    } else {
      output.status = 'HOLD_INCOMPLETE';
      output.summary = 'Constraint compilation incomplete - missing required spoke outputs';

      // DOCTRINE: Incomplete = card not ready
      output.jurisdiction_card_complete = false;
      output.required_fields_missing = ['Multiple spokes failed — cannot determine completeness'];
    }

    // -------------------------------------------------------------------------
    // FINALIZE OUTPUT
    // -------------------------------------------------------------------------

    output.errors = this.errors;
    output.provenance.compiled_at = new Date().toISOString();

    // DOCTRINE: Log primary signal
    console.log(`[PASS2_CONSTRAINT_COMPILER] jurisdiction_card_complete: ${output.jurisdiction_card_complete}`);

    const elapsed = Date.now() - startTime;
    console.log(`[PASS2_CONSTRAINT_COMPILER] Completed in ${elapsed}ms. Status: ${output.status}`);

    return output;
  }
}

// =============================================================================
// CONVENIENCE FUNCTION
// =============================================================================

/**
 * Run Pass 2 constraint compilation.
 */
export async function runPass2ConstraintCompiler(input: Pass2Input): Promise<Pass2Output> {
  const compiler = new Pass2ConstraintCompiler();
  return compiler.compile(input);
}
