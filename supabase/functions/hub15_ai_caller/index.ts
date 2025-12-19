/**
 * Hub 1.5 AI Caller Worker
 * process_id: hub15_ai_caller
 * version: 1.0.0
 * 
 * DO NOT MODIFY — downstream depends on this shape
 * 
 * PURPOSE: Deterministic data capture via Retell.ai voice calling.
 * Calls storage facilities with fixed question script, extracts rates
 * via rule-based parsing, logs attempts via hub15_log_attempt.
 * 
 * HARD RULES:
 * - Secrets via Supabase (RETELL_API_KEY)
 * - Fixed question script (no improvisation)
 * - Enforce call timeout, retry cap, business hours
 * - Hash transcript (SHA256)
 * - Extract rates via deterministic parsing (regex/rules)
 * - Log attempt via hub15_log_attempt
 * 
 * NON-GOALS:
 * - No confidence inference beyond rule-based checks
 * - No fallback logic
 * - No Neon writes
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// ============================================================================
// CONSTANTS - DO NOT MODIFY
// ============================================================================
const PROCESS_ID = "hub15_ai_caller";
const VERSION = "1.0.0";

// Guard rails
const CALL_TIMEOUT_MS = 180_000; // 3 minutes max call duration
const MAX_RETRIES = 3;
const MAX_COST_CENTS = 75; // $0.75 max per call
const BUSINESS_HOURS_START = 9; // 9 AM
const BUSINESS_HOURS_END = 18; // 6 PM

// Retell API
const RETELL_BASE_URL = "https://api.retellai.com";

// Fixed question script - NO IMPROVISATION
const FIXED_SCRIPT = {
  greeting: "Hi, I'm calling to inquire about storage unit rates at your facility.",
  target_sizes: ["5x5", "5x10", "10x10", "10x15", "10x20", "10x30"],
  questions: [
    "What is the monthly rate for a {size} unit?",
    "Do you have any move-in specials or promotions?",
    "Is climate control available and what's the additional cost?",
    "What is the admin or setup fee?"
  ],
  closing: "Thank you so much for your help. Have a great day!"
};

// Rate extraction patterns (regex-based, deterministic)
const RATE_PATTERNS = {
  // Match "$XX", "$XX.XX", "XX dollars", etc.
  dollar_amount: /\$?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*(?:dollars?|per\s*month|monthly|\/mo)?/gi,
  // Match "first month free", "50% off", etc.
  promo: /(?:first\s*month\s*free|(\d{1,3})%\s*off|half\s*off|free\s*(?:first\s*)?month)/gi,
  // Match admin/setup fees
  admin_fee: /(?:admin|setup|administration)\s*fee[:\s]*\$?\s*(\d{1,3}(?:\.\d{2})?)/gi,
  // Climate control
  climate: /climate\s*control[:\s]*(?:\+?\s*)?\$?\s*(\d{1,3}(?:\.\d{2})?)/gi
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================================
// INPUT CONTRACT
// ============================================================================
interface CallerInput {
  gap_queue_id: string;
  run_id: string;
  competitor_name: string;
  phone_number: string;
  target_unit_sizes?: string[];
  attempt_number: number;
}

// ============================================================================
// OUTPUT CONTRACT
// ============================================================================
interface ExtractedRate {
  unit_size: string;
  monthly_rate: number | null;
  climate_control_rate: number | null;
  confidence: "low" | "medium";
}

// DELIVERABLE 2: Enhanced status with DEGRADED support
type CallerStatus = "success" | "completed" | "degraded" | "failed" | "timeout" | "outside_hours";

interface CallerOutput {
  process_id: string;
  version: string;
  gap_queue_id: string;
  status: CallerStatus;
  rates: ExtractedRate[];
  promo_info: string | null;
  admin_fee: number | null;
  transcript_hash: string;
  call_duration_seconds: number;
  confidence: "low" | "medium";
  duration_ms: number;
  cost_cents: number;
  error_code?: string;
  error_message?: string;
  // DELIVERABLE 2: Additional tracking fields
  request_id: string;
  ai_provider: string;
  degraded_reason?: string;
}

// Response shape validation schema (deterministic)
interface ValidResponseShape {
  hasTranscript: boolean;
  hasRates: boolean;
  rateCount: number;
  isValidSchema: boolean;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if current time is within business hours (EST/EDT)
 */
function isBusinessHours(): boolean {
  const now = new Date();
  // Convert to Eastern Time (approximate - proper would use timezone library)
  const utcHour = now.getUTCHours();
  const estOffset = -5; // EST (would be -4 for EDT)
  const estHour = (utcHour + 24 + estOffset) % 24;
  const day = now.getUTCDay();
  
  // Monday-Friday, 9 AM - 6 PM EST
  return day >= 1 && day <= 5 && estHour >= BUSINESS_HOURS_START && estHour < BUSINESS_HOURS_END;
}

/**
 * SHA256 hash of transcript for deduplication
 */
async function hashTranscript(transcript: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(transcript);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Extract rates from transcript using deterministic regex patterns
 */
function extractRatesFromTranscript(
  transcript: string,
  targetSizes: string[]
): { rates: ExtractedRate[]; promo: string | null; adminFee: number | null } {
  const rates: ExtractedRate[] = [];
  let promo: string | null = null;
  let adminFee: number | null = null;

  // Normalize transcript
  const text = transcript.toLowerCase();

  // Extract admin fee
  const adminPattern = new RegExp(RATE_PATTERNS.admin_fee.source, "gi");
  const adminMatch = adminPattern.exec(text);
  if (adminMatch) {
    adminFee = parseFloat(adminMatch[1]);
  }

  // Extract promotions
  const promoPattern = new RegExp(RATE_PATTERNS.promo.source, "gi");
  const promoMatches = text.match(promoPattern);
  if (promoMatches && promoMatches.length > 0) {
    promo = promoMatches.join(", ");
  }

  // Extract rates for each target size
  for (const size of targetSizes) {
    const [width, depth] = size.split("x").map(Number);
    const rate: ExtractedRate = {
      unit_size: size,
      monthly_rate: null,
      climate_control_rate: null,
      confidence: "low"
    };

    // Find mentions of this unit size in transcript
    const sizePattern = new RegExp(
      `${width}\\s*(?:x|by)\\s*${depth}[^.]*?\\$?\\s*(\\d{1,3}(?:\\.\\d{2})?)`,
      "gi"
    );
    
    let match;
    while ((match = sizePattern.exec(text)) !== null) {
      const amount = parseFloat(match[1]);
      if (amount >= 20 && amount <= 500) { // Reasonable rate range
        rate.monthly_rate = amount;
        rate.confidence = "medium";
      }
    }

    // Check for climate control mention near this size
    const climatePattern = new RegExp(
      `${width}\\s*(?:x|by)\\s*${depth}[^.]*climate[^.]*\\$?\\s*(\\d{1,3}(?:\\.\\d{2})?)`,
      "gi"
    );
    const climateMatch = climatePattern.exec(text);
    if (climateMatch) {
      rate.climate_control_rate = parseFloat(climateMatch[1]);
    }

    rates.push(rate);
  }

  return { rates, promo, adminFee };
}

/**
 * Create Retell.ai call
 */
async function createRetellCall(
  apiKey: string,
  phoneNumber: string,
  agentId: string,
  metadata: Record<string, string>
): Promise<{ call_id: string; status: string } | null> {
  try {
    const response = await fetch(`${RETELL_BASE_URL}/v2/create-phone-call`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        to_number: phoneNumber,
        from_number: null, // Use Retell's default number
        override_agent_id: agentId,
        metadata: metadata,
        retell_llm_dynamic_variables: {
          facility_name: metadata.competitor_name || "your facility",
          target_sizes: metadata.target_sizes || "10x10"
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[${PROCESS_ID}] Retell API error: ${response.status} ${errorText}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error(`[${PROCESS_ID}] Retell API call failed:`, error);
    return null;
  }
}

/**
 * Get Retell call status and transcript
 */
async function getRetellCallDetails(
  apiKey: string,
  callId: string
): Promise<{
  status: string;
  transcript: string;
  duration_seconds: number;
  cost_cents: number;
} | null> {
  try {
    const response = await fetch(`${RETELL_BASE_URL}/v2/get-call/${callId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
      console.error(`[${PROCESS_ID}] Retell get call error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    
    // Extract transcript from call data
    const transcript = data.transcript || "";
    const durationMs = data.end_timestamp 
      ? data.end_timestamp - data.start_timestamp 
      : 0;
    
    // Estimate cost (Retell charges ~$0.07-0.15/min)
    const costCents = Math.ceil((durationMs / 60000) * 10); // ~$0.10/min estimate

    return {
      status: data.call_status || "unknown",
      transcript: transcript,
      duration_seconds: Math.ceil(durationMs / 1000),
      cost_cents: costCents
    };
  } catch (error) {
    console.error(`[${PROCESS_ID}] Failed to get Retell call details:`, error);
    return null;
  }
}

/**
 * Wait for call to complete with timeout
 */
async function waitForCallCompletion(
  apiKey: string,
  callId: string,
  timeoutMs: number
): Promise<{
  status: string;
  transcript: string;
  duration_seconds: number;
  cost_cents: number;
}> {
  const startTime = Date.now();
  const pollInterval = 5000; // 5 seconds

  while (Date.now() - startTime < timeoutMs) {
    const details = await getRetellCallDetails(apiKey, callId);
    
    if (!details) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      continue;
    }

    // Check if call is complete
    if (details.status === "ended" || details.status === "error" || details.status === "voicemail") {
      return details;
    }

    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  // Timeout reached
  return {
    status: "timeout",
    transcript: "",
    duration_seconds: Math.ceil(timeoutMs / 1000),
    cost_cents: 0
  };
}

/**
 * Log attempt via hub15_log_attempt
 */
async function logAttempt(
  supabaseUrl: string,
  supabaseKey: string,
  input: {
    gap_queue_id: string;
    run_id: string;
    attempt_number: number;
    status: string;
    duration_ms: number;
    cost_cents: number;
    transcript_hash: string;
    error_code?: string;
    error_message?: string;
  }
): Promise<void> {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/hub15_log_attempt`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${supabaseKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        gap_queue_id: input.gap_queue_id,
        run_id: input.run_id,
        worker_type: "ai_caller",
        attempt_number: input.attempt_number,
        status: input.status,
        duration_ms: input.duration_ms,
        cost_cents: input.cost_cents,
        transcript_hash: input.transcript_hash,
        error_code: input.error_code,
        error_message: input.error_message
      })
    });
    
    if (!response.ok) {
      console.error(`[${PROCESS_ID}] Log attempt failed: ${response.status}`);
    }
  } catch (error) {
    console.error(`[${PROCESS_ID}] Failed to log attempt:`, error);
    // Don't throw - logging failure shouldn't kill the caller
  }
}

// ============================================================================
// MAIN HANDLER
// ============================================================================
// Generate unique request ID for tracing
function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
}

// Validate response shape (DELIVERABLE 2: response shape validation)
function validateResponseShape(transcript: string, rates: ExtractedRate[]): ValidResponseShape {
  const hasTranscript = transcript.length > 50;
  const hasRates = rates.length > 0;
  const rateCount = rates.filter(r => r.monthly_rate !== null).length;
  const isValidSchema = hasTranscript && (hasRates || rates.length === 0);
  
  return { hasTranscript, hasRates, rateCount, isValidSchema };
}

serve(async (req) => {
  const startTime = Date.now();
  const requestId = generateRequestId();
  const aiProvider = "retell.ai";

  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse input
    const input: CallerInput = await req.json();
    
    console.log(`[${PROCESS_ID}] Request ${requestId}: Processing gap_queue_id=${input.gap_queue_id}`);
    
    // Validate required fields
    if (!input.gap_queue_id || !input.run_id || !input.phone_number || !input.attempt_number) {
      return new Response(
        JSON.stringify({
          process_id: PROCESS_ID,
          version: VERSION,
          request_id: requestId,
          ai_provider: aiProvider,
          error_code: "INVALID_INPUT",
          error_message: "Missing required fields: gap_queue_id, run_id, phone_number, attempt_number"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check business hours
    if (!isBusinessHours()) {
      const output: CallerOutput = {
        request_id: requestId,
        ai_provider: aiProvider,
        process_id: PROCESS_ID,
        version: VERSION,
        gap_queue_id: input.gap_queue_id,
        status: "outside_hours",
        rates: [],
        promo_info: null,
        admin_fee: null,
        transcript_hash: "",
        call_duration_seconds: 0,
        confidence: "low",
        duration_ms: Date.now() - startTime,
        cost_cents: 0,
        error_code: "OUTSIDE_BUSINESS_HOURS",
        error_message: `Calls only allowed ${BUSINESS_HOURS_START}AM-${BUSINESS_HOURS_END}PM EST, Mon-Fri`
      };
      
      return new Response(JSON.stringify(output), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Check retry cap
    if (input.attempt_number > MAX_RETRIES) {
      const output: CallerOutput = {
        request_id: requestId,
        ai_provider: aiProvider,
        process_id: PROCESS_ID,
        version: VERSION,
        gap_queue_id: input.gap_queue_id,
        status: "failed",
        rates: [],
        promo_info: null,
        admin_fee: null,
        transcript_hash: "",
        call_duration_seconds: 0,
        confidence: "low",
        duration_ms: Date.now() - startTime,
        cost_cents: 0,
        error_code: "MAX_RETRIES_EXCEEDED",
        error_message: `Attempt ${input.attempt_number} exceeds max retries (${MAX_RETRIES})`
      };

      return new Response(JSON.stringify(output), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Get secrets
    const RETELL_API_KEY = Deno.env.get("RETELL_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    if (!RETELL_API_KEY) {
      return new Response(
        JSON.stringify({
          process_id: PROCESS_ID,
          version: VERSION,
          error_code: "MISSING_SECRET",
          error_message: "RETELL_API_KEY not configured"
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine target sizes
    const targetSizes = input.target_unit_sizes && input.target_unit_sizes.length > 0
      ? input.target_unit_sizes
      : FIXED_SCRIPT.target_sizes;

    // Get Retell Agent ID (must be configured in Retell dashboard with fixed script)
    const RETELL_AGENT_ID = Deno.env.get("RETELL_AGENT_ID") || "";
    
    if (!RETELL_AGENT_ID) {
      return new Response(
        JSON.stringify({
          process_id: PROCESS_ID,
          version: VERSION,
          error_code: "MISSING_SECRET",
          error_message: "RETELL_AGENT_ID not configured"
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[${PROCESS_ID}] Initiating call to ${input.phone_number} for ${input.competitor_name}`);

    const callResult = await createRetellCall(
      RETELL_API_KEY,
      input.phone_number,
      RETELL_AGENT_ID,
      {
        gap_queue_id: input.gap_queue_id,
        run_id: input.run_id,
        competitor_name: input.competitor_name,
        target_sizes: targetSizes.join(","),
        attempt_number: String(input.attempt_number)
      }
    );

    if (!callResult) {
      const output: CallerOutput = {
        request_id: requestId,
        ai_provider: aiProvider,
        process_id: PROCESS_ID,
        version: VERSION,
        gap_queue_id: input.gap_queue_id,
        status: "failed",
        rates: [],
        promo_info: null,
        admin_fee: null,
        transcript_hash: await hashTranscript(""),
        call_duration_seconds: 0,
        confidence: "low",
        duration_ms: Date.now() - startTime,
        cost_cents: 0,
        error_code: "CALL_INIT_FAILED",
        error_message: "Failed to initiate Retell call"
      };

      // Log attempt
      await logAttempt(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        gap_queue_id: input.gap_queue_id,
        run_id: input.run_id,
        attempt_number: input.attempt_number,
        status: "failed",
        duration_ms: output.duration_ms,
        cost_cents: 0,
        transcript_hash: output.transcript_hash,
        error_code: "CALL_INIT_FAILED",
        error_message: "Failed to initiate Retell call"
      });

      return new Response(JSON.stringify(output), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log(`[${PROCESS_ID}] Call initiated: ${callResult.call_id}`);

    // Wait for call completion with timeout
    const callDetails = await waitForCallCompletion(
      RETELL_API_KEY,
      callResult.call_id,
      CALL_TIMEOUT_MS
    );

    // Check cost guard rail
    if (callDetails.cost_cents > MAX_COST_CENTS) {
      console.warn(`[${PROCESS_ID}] Call exceeded cost limit: ${callDetails.cost_cents} cents`);
    }

    // Hash transcript
    const transcriptHash = await hashTranscript(callDetails.transcript);

    // Determine call status (initial determination before degraded check)
    let initialStatus: "completed" | "failed" | "timeout";
    if (callDetails.status === "timeout") {
      initialStatus = "timeout";
    } else if (callDetails.status === "ended" && callDetails.transcript.length > 50) {
      initialStatus = "completed";
    } else {
      initialStatus = "failed";
    }

    // Extract rates from transcript (deterministic, regex-based)
    const { rates, promo, adminFee } = initialStatus === "completed"
      ? extractRatesFromTranscript(callDetails.transcript, targetSizes)
      : { rates: [], promo: null, adminFee: null };

    // =========================================================================
    // DELIVERABLE 2: Response shape validation & DEGRADED status detection
    // =========================================================================
    const responseShape = validateResponseShape(callDetails.transcript, rates);
    const ratesWithData = rates.filter(r => r.monthly_rate !== null);
    
    // Determine if result is DEGRADED (only check if call initially completed)
    let finalStatus: CallerStatus = initialStatus;
    let degradedReason: string | undefined;
    
    if (initialStatus === "completed") {
      // Check for degraded conditions
      if (!responseShape.hasTranscript) {
        finalStatus = "degraded";
        degradedReason = "Empty or insufficient transcript";
      } else if (!responseShape.isValidSchema) {
        finalStatus = "degraded";
        degradedReason = "Invalid response schema";
      } else if (responseShape.rateCount === 0) {
        finalStatus = "degraded";
        degradedReason = "No rates extracted from transcript";
      } else if (responseShape.rateCount < 2) {
        finalStatus = "degraded";
        degradedReason = `Only ${responseShape.rateCount} rate(s) extracted (expected 2+)`;
      } else {
        finalStatus = "success";
      }
    }

    // Calculate overall confidence (rule-based, not inference)
    const confidence: "low" | "medium" = ratesWithData.length >= 2 ? "medium" : "low";

    const output: CallerOutput = {
      request_id: requestId,
      ai_provider: aiProvider,
      process_id: PROCESS_ID,
      version: VERSION,
      gap_queue_id: input.gap_queue_id,
      status: finalStatus,
      rates,
      promo_info: promo,
      admin_fee: adminFee,
      transcript_hash: transcriptHash,
      call_duration_seconds: callDetails.duration_seconds,
      confidence,
      duration_ms: Date.now() - startTime,
      cost_cents: callDetails.cost_cents,
      degraded_reason: degradedReason
    };

    if (finalStatus === "failed") {
      output.error_code = "CALL_FAILED";
      output.error_message = `Call status: ${callDetails.status}`;
    } else if (finalStatus === "timeout") {
      output.error_code = "CALL_TIMEOUT";
      output.error_message = `Call exceeded ${CALL_TIMEOUT_MS / 1000}s timeout`;
    } else if (finalStatus === "degraded") {
      output.error_code = "DEGRADED_RESULT";
      output.error_message = degradedReason;
    }

    // Log attempt with enhanced status
    const logStatus = finalStatus === "success" || finalStatus === "completed" 
      ? "completed" 
      : finalStatus === "degraded" 
        ? "degraded" 
        : "failed";
        
    await logAttempt(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      gap_queue_id: input.gap_queue_id,
      run_id: input.run_id,
      attempt_number: input.attempt_number,
      status: logStatus,
      duration_ms: output.duration_ms,
      cost_cents: output.cost_cents,
      transcript_hash: transcriptHash,
      error_code: output.error_code,
      error_message: output.error_message
    });

    // DELIVERABLE 2: Structured log entry for every AI call
    const aiCallLog = {
      pass: "1.5",
      status: finalStatus,
      ai_provider: aiProvider,
      reason: degradedReason || null,
      execution_id: requestId,
      duration_ms: output.duration_ms,
      rates_extracted: ratesWithData.length,
      transcript_length: callDetails.transcript.length
    };
    console.log(`[${PROCESS_ID}] AI_CALL_LOG:`, JSON.stringify(aiCallLog));

    return new Response(JSON.stringify(output), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error(`[${PROCESS_ID}] Unexpected error:`, error);
    
    return new Response(
      JSON.stringify({
        process_id: PROCESS_ID,
        version: VERSION,
        request_id: requestId,
        ai_provider: aiProvider,
        error_code: "INTERNAL_ERROR",
        error_message: error instanceof Error ? error.message : "Unknown error"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
