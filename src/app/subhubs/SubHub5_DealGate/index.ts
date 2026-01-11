/**
 * SubHub5_DealGate — DealGate SubHub
 *
 * Anchor: SVA + Parcel ID
 * Scope: Doctrine enforcement, Go/No-Go verdict
 * Constraint: BINARY_OUTPUT (GOOD_DEAL | BAD_DEAL only)
 *
 * Memory: Signals → Market → Rules → Math → Parcels → **Verdict**
 *
 * @module SubHub5_DealGate
 */

// Types
export * from './types/pass5_types';

// Orchestrator
export { Pass5Orchestrator, runPass5 } from './orchestrator/Pass5Orchestrator';
export type { Pass5Input, Pass5Output, DealVerdictOutput } from './types/pass5_types';

// Spokes
export { runGateEvaluator } from './spokes/GateEvaluator';
export type { GateEvaluatorInput } from './spokes/GateEvaluator';

export { runDoctrineEnforcer } from './spokes/DoctrineEnforcer';
export type { DoctrineEnforcerInput } from './spokes/DoctrineEnforcer';

export { runVerdictCompiler } from './spokes/VerdictCompiler';
export type { VerdictCompilerInput } from './spokes/VerdictCompiler';

// Anchor definition
export const SUBHUB5_ANCHOR = {
  id: 'SubHub5_DealGate',
  anchors: ['SVA', 'PARCEL_ID'],
  scope: 'doctrine enforcement, Go/No-Go verdict',
  constraints: ['BINARY_OUTPUT'],
  output: 'GOOD_DEAL | BAD_DEAL',
} as const;
