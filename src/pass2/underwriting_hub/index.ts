// =============================================================================
// PASS 2 UNDERWRITING HUB — Module Exports
// =============================================================================
// Doctrine ID: SS.02.00
// Purpose: Constraint Compiler for buildability envelope
//
// DOCTRINE: Pass 2 compiles constraints. It does NOT do financial modeling.
// =============================================================================

// Contracts
export * from './contracts/pass2_input';
export * from './contracts/pass2_output';

// Types
export * from './types/constraint_types';
export * from './types/jurisdiction_card';

// Orchestrator
export { Pass2ConstraintCompiler, runPass2ConstraintCompiler } from './orchestrator/Pass2ConstraintCompiler';

// Spokes (for direct access if needed)
export { runJurisdictionResolver } from './spokes/JurisdictionResolver';
export { runJurisdictionCardReader } from './spokes/JurisdictionCardReader';
export { runZoningConstraints } from './spokes/ZoningConstraints';
export { runSitePlanConstraints } from './spokes/SitePlanConstraints';
export { runStormwaterConstraints } from './spokes/StormwaterConstraints';
export { runFireAccessConstraints } from './spokes/FireAccessConstraints';
export { runPermittingChecklist } from './spokes/PermittingChecklist';
export { runEnvelopeReducer } from './spokes/EnvelopeReducer';
export { runConstraintVerdict } from './spokes/ConstraintVerdict';
