/**
 * Facility ID Generator
 * 
 * Creates deterministic facility IDs from normalized addresses.
 * Format: fac_XXXXXXXX (fac_ prefix + 8 lowercase hex characters)
 */

/**
 * Normalize an address for hashing
 * - Lowercase
 * - Remove special characters
 * - Collapse whitespace to underscores
 */
export function normalizeAddress(address: string): string {
  return address
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .trim();
}

/**
 * Generate a simple hash from a string
 * Uses a basic hash algorithm suitable for client-side use
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  // Convert to hex and take absolute value
  const hexHash = Math.abs(hash).toString(16).padStart(8, '0');
  return hexHash.slice(0, 8);
}

/**
 * Generate a facility ID from an address
 * @param address - The facility address
 * @returns Facility ID in format: fac_XXXXXXXX
 */
export function generateFacilityId(address: string): string {
  const normalized = normalizeAddress(address);
  const hash = simpleHash(normalized);
  return `fac_${hash}`;
}

/**
 * Validate a facility ID format
 * @param facilityId - The facility ID to validate
 * @returns Object with valid boolean and optional error message
 */
export function validateFacilityId(facilityId: string): { valid: boolean; error?: string } {
  const formatRegex = /^fac_[a-f0-9]{8}$/;
  if (!formatRegex.test(facilityId)) {
    return { 
      valid: false, 
      error: "Facility ID must match format: fac_XXXXXXXX (fac_ prefix + 8 lowercase hex characters)" 
    };
  }
  return { valid: true };
}

/**
 * Check if a string is a valid hex character
 */
export function isValidHexChar(char: string): boolean {
  return /^[a-f0-9]$/.test(char);
}
