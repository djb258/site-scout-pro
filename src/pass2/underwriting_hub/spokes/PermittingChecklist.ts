// =============================================================================
// PERMITTING CHECKLIST — Spoke SS.02.07
// =============================================================================
// Doctrine ID: SS.02.07
// Purpose: Compile list of required permits and approvals
//
// This is the execution checklist, not financial modeling.
// NO cost estimates. Only what permits are needed.
// =============================================================================

import type {
  PermittingChecklistInput,
  PermittingChecklistResult,
  PermitRequirement,
  ZoningConstraintsResult,
  StormwaterConstraintsResult,
  FireAccessConstraintsResult,
} from '../types/constraint_types';

/**
 * Compile permitting checklist based on constraints.
 */
export async function runPermittingChecklist(
  input: PermittingChecklistInput
): Promise<PermittingChecklistResult> {
  const timestamp = new Date().toISOString();

  console.log(`[SS.02.07] Compiling permitting checklist for jurisdiction: ${input.jurisdiction_id}`);

  const permits: PermitRequirement[] = [];
  const potentialDelays: string[] = [];

  // 1. Site Plan Approval
  permits.push({
    permit_type: 'site_plan',
    description: 'Site plan review and approval',
    required: true,
    authority: input.jurisdiction_id,
    notes: 'Required for all commercial development',
  });

  // 2. Conditional Use Permit (if required)
  if (input.zoning.conditional_use_required) {
    permits.push({
      permit_type: 'conditional_use',
      description: 'Conditional use permit for storage facility',
      required: true,
      difficulty: 'difficult',
      authority: input.jurisdiction_id,
      notes: 'May require public hearing',
    });
    potentialDelays.push('Conditional use permit may require public hearing');
  }

  // 3. Variance (if required)
  if (input.zoning.variance_required) {
    permits.push({
      permit_type: 'variance',
      description: 'Zoning variance',
      required: true,
      difficulty: 'difficult',
      authority: input.jurisdiction_id,
      notes: 'Requires demonstration of hardship',
    });
    potentialDelays.push('Variance approval is uncertain');
  }

  // 4. Grading Permit
  permits.push({
    permit_type: 'grading',
    description: 'Grading and earthwork permit',
    required: true,
    authority: input.jurisdiction_id,
    notes: 'Required for site preparation',
  });

  // 5. Stormwater Permit
  if (input.stormwater.stormwater_plan_required) {
    permits.push({
      permit_type: 'stormwater',
      description: 'Stormwater management permit',
      required: true,
      authority: input.stormwater.stormwater_authority ?? input.jurisdiction_id,
      notes: 'Detention/retention plan required',
    });
  }

  // 6. Building Permit
  permits.push({
    permit_type: 'building',
    description: 'Building permit for storage structures',
    required: true,
    authority: input.jurisdiction_id,
    notes: 'Plan review and inspections',
  });

  // 7. Fire Permit
  if (input.fire_access.sprinkler_required) {
    permits.push({
      permit_type: 'fire_sprinkler',
      description: 'Fire sprinkler system permit',
      required: true,
      authority: 'Fire Marshal',
      notes: 'Plan review and testing required',
    });
  }

  permits.push({
    permit_type: 'fire_alarm',
    description: 'Fire alarm system permit',
    required: input.fire_access.fire_alarm_required ?? true,
    authority: 'Fire Marshal',
    notes: 'Plan review and testing required',
  });

  // 8. Utility Connections
  permits.push({
    permit_type: 'water_sewer',
    description: 'Water and sewer connection permit',
    required: true,
    authority: 'Utility Authority',
    notes: 'Tap fees apply',
  });

  permits.push({
    permit_type: 'electric',
    description: 'Electrical service permit',
    required: true,
    authority: 'Electric Utility',
    notes: 'Service sizing required',
  });

  // 9. Certificate of Occupancy
  permits.push({
    permit_type: 'certificate_of_occupancy',
    description: 'Certificate of Occupancy',
    required: true,
    authority: input.jurisdiction_id,
    notes: 'Final inspections must pass',
  });

  // Determine complexity
  const hasConditionalUse = input.zoning.conditional_use_required ?? false;
  const hasVariance = input.zoning.variance_required ?? false;
  let complexity: 'low' | 'medium' | 'high' | 'unknown' = 'medium';

  if (hasVariance) {
    complexity = 'high';
  } else if (hasConditionalUse) {
    complexity = 'high';
  } else if (input.zoning.allowed_by_right) {
    complexity = 'low';
  }

  return {
    spoke_id: 'SS.02.07',
    status: 'ok',
    timestamp,
    notes: `Compiled ${permits.length} permit requirements`,

    permits_required: permits,
    total_permits_required: permits.length,
    estimated_complexity: complexity,

    public_hearing_required: hasConditionalUse || hasVariance,
    neighbor_notification_required: hasConditionalUse,
    environmental_review_required: null, // Unknown without more info

    potential_delays: potentialDelays,
  };
}
