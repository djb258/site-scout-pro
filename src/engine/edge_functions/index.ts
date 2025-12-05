/**
 * EDGE FUNCTIONS INDEX
 *
 * Central export point for all Lovable.dev compatible edge functions
 *
 * Deployment:
 *   Each handler should be deployed as a Cloudflare Worker via Lovable.dev:
 *   - /functions/start_pass1
 *   - /functions/start_local_scan
 *   - /functions/trigger_calls
 *   - /functions/call_webhook
 *   - /functions/start_pass2
 *   - /functions/save_to_vault
 *
 * Flow:
 *   1. start_pass1 -> Pass 1 analysis -> writes to scratchpad
 *   2. start_local_scan -> Detailed competitor scan -> updates scratchpad
 *   3. trigger_calls -> AI dialer for pricing -> writes to scratchpad
 *   4. call_webhook -> Receive AI dialer results -> writes to scratchpad
 *   5. start_pass2 -> Deep underwriting -> updates scratchpad
 *   6. save_to_vault -> Archive to Neon (ONLY Neon write)
 *
 * All data persists in @lovable/cloud-db scratchpad tables
 * Only save_to_vault writes to permanent Neon storage
 */

// ============================================================================
// PASS 1 ENTRY POINT
// ============================================================================

export {
  default as startPass1Handler,
  handleStartPass1,
  type StartPass1Request,
  type StartPass1Response,
} from './start_pass1';

// ============================================================================
// LOCAL SCAN ENTRY POINT
// ============================================================================

export {
  default as startLocalScanHandler,
  handleStartLocalScan,
  type StartLocalScanRequest,
  type StartLocalScanResponse,
} from './start_local_scan';

// ============================================================================
// AI DIALER TRIGGER
// ============================================================================

export {
  default as triggerCallsHandler,
  handleTriggerCalls,
  handleCallWebhook,
  type TriggerCallsRequest,
  type TriggerCallsResponse,
  type CallWebhookPayload,
  type CallWebhookResponse,
} from './trigger_calls';

// ============================================================================
// PASS 2 ENTRY POINT
// ============================================================================

export {
  default as startPass2Handler,
  handleStartPass2,
  checkPass2Readiness,
  type StartPass2Request,
  type StartPass2Response,
} from './start_pass2';

// ============================================================================
// VAULT SAVE ENTRY POINT
// ============================================================================

export {
  default as saveToVaultHandler,
  handleSaveToVault,
  queryVault,
  getVaultEntry,
  deleteVaultEntry,
  type SaveToVaultRequest,
  type SaveToVaultResponse,
  type VaultEntry,
  type VaultQueryOptions,
} from './save_to_vault';
