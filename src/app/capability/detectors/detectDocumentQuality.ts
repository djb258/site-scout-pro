/**
 * Document Quality Detector
 *
 * DOCTRINE: Detect HOW documents are formatted, not content.
 * This is a CHEAP probe — no PDF parsing, no OCR, no content extraction.
 *
 * Allowed signals:
 * - MIME type detection from URLs
 * - Page structure indicators
 * - Link patterns (PDF vs HTML)
 *
 * NOT allowed:
 * - Downloading and parsing PDFs
 * - Running OCR
 * - Extracting document content
 */

import type {
  DocumentQuality,
  DocumentQualityDetectorResult,
  DetectorSignal,
  ConfidenceLevel,
} from '../types';

/**
 * Input for document quality detection
 */
export interface DocumentQualityDetectorInput {
  county_name: string;
  state_code: string;
  planning_url?: string | null;
  page_content_snippet?: string | null;  // First 5000 chars of page
  document_links?: string[];             // Links found on page
}

/**
 * Detect the document quality for a county
 *
 * This is a CHEAP detection — uses only URL patterns and page structure.
 * Does NOT download or parse documents.
 */
export function detectDocumentQuality(
  input: DocumentQualityDetectorInput
): DocumentQualityDetectorResult {
  const signals: DetectorSignal[] = [];
  let confidence: ConfidenceLevel = 'low';
  let value: DocumentQuality = 'unknown';

  // Check document links for patterns
  if (input.document_links && input.document_links.length > 0) {
    const linkResult = analyzeDocumentLinks(input.document_links);
    signals.push(...linkResult.signals);

    if (linkResult.quality !== 'unknown') {
      value = linkResult.quality;
      confidence = linkResult.confidence;
    }
  }

  // Check page content for indicators
  if (input.page_content_snippet) {
    const contentResult = detectFromPageContent(input.page_content_snippet);
    signals.push(...contentResult.signals);

    // Page content can upgrade confidence or provide fallback
    if (value === 'unknown' && contentResult.quality !== 'unknown') {
      value = contentResult.quality;
      confidence = contentResult.confidence;
    } else if (
      value === contentResult.quality &&
      contentResult.confidence === 'medium'
    ) {
      confidence = 'medium';
    }
  }

  // Check planning URL structure
  if (input.planning_url) {
    const urlSignals = analyzeUrlStructure(input.planning_url);
    signals.push(...urlSignals);
  }

  // No signals found
  if (signals.length === 0) {
    signals.push({
      type: 'no_signals',
      description: 'No document quality indicators found',
      source: 'detectDocumentQuality',
    });
  }

  return {
    value,
    confidence,
    signals,
  };
}

/**
 * Analyze document links to determine quality
 */
function analyzeDocumentLinks(links: string[]): {
  quality: DocumentQuality;
  confidence: ConfidenceLevel;
  signals: DetectorSignal[];
} {
  const signals: DetectorSignal[] = [];

  let pdfCount = 0;
  let htmlCount = 0;
  let hasModernCms = false;

  for (const link of links) {
    const lowerLink = link.toLowerCase();

    // Count PDF links
    if (lowerLink.endsWith('.pdf') || lowerLink.includes('.pdf?')) {
      pdfCount++;
    }

    // Count HTML-like links (ordinances, codes)
    if (
      lowerLink.includes('/code/') ||
      lowerLink.includes('/ordinance/') ||
      lowerLink.includes('municode') ||
      lowerLink.includes('american-legal') ||
      lowerLink.includes('codepublishing')
    ) {
      htmlCount++;
      hasModernCms = true;
    }
  }

  // Report findings
  if (pdfCount > 0) {
    signals.push({
      type: 'pdf_links_found',
      description: `Found ${pdfCount} PDF document links`,
      source: 'document_links',
    });
  }

  if (htmlCount > 0) {
    signals.push({
      type: 'html_links_found',
      description: `Found ${htmlCount} HTML code/ordinance links`,
      source: 'document_links',
    });
  }

  if (hasModernCms) {
    signals.push({
      type: 'modern_cms_detected',
      description: 'Detected modern code publishing platform',
      source: 'document_links',
    });
  }

  // Determine quality
  if (hasModernCms || htmlCount > pdfCount) {
    return { quality: 'structured_html', confidence: 'medium', signals };
  } else if (pdfCount > 0) {
    // Can't tell if searchable or scanned without downloading
    return { quality: 'searchable_pdf', confidence: 'low', signals };
  }

  return { quality: 'unknown', confidence: 'low', signals };
}

/**
 * Detect document quality from page content (cheap indicators only)
 */
function detectFromPageContent(content: string): {
  quality: DocumentQuality;
  confidence: ConfidenceLevel;
  signals: DetectorSignal[];
} {
  const signals: DetectorSignal[] = [];
  const lowerContent = content.toLowerCase();

  // =========================================================================
  // CHECK FOR STRUCTURED HTML INDICATORS
  // =========================================================================

  const structuredHtmlIndicators = [
    'municode',
    'american legal',
    'code publishing',
    'general code',
    'searchable code',
    'online code',
    'ecode360',
    'codified ordinances',
  ];

  for (const indicator of structuredHtmlIndicators) {
    if (lowerContent.includes(indicator)) {
      signals.push({
        type: 'structured_html_indicator',
        description: `Found structured HTML indicator: "${indicator}"`,
        source: 'page_content',
      });
      return { quality: 'structured_html', confidence: 'medium', signals };
    }
  }

  // =========================================================================
  // CHECK FOR PDF-BASED INDICATORS
  // =========================================================================

  const pdfIndicators = [
    'download pdf',
    'view pdf',
    'pdf version',
    'adobe reader',
    'pdf format',
  ];

  let pdfIndicatorCount = 0;
  for (const indicator of pdfIndicators) {
    if (lowerContent.includes(indicator)) {
      pdfIndicatorCount++;
      signals.push({
        type: 'pdf_indicator',
        description: `Found PDF indicator: "${indicator}"`,
        source: 'page_content',
      });
    }
  }

  if (pdfIndicatorCount >= 2) {
    // Multiple PDF mentions suggest PDF-based system
    return { quality: 'searchable_pdf', confidence: 'low', signals };
  }

  // =========================================================================
  // CHECK FOR NO-DOCUMENT INDICATORS
  // =========================================================================

  const noDocumentIndicators = [
    'call for copies',
    'visit our office',
    'documents not available online',
    'request by mail',
    'no online access',
  ];

  for (const indicator of noDocumentIndicators) {
    if (lowerContent.includes(indicator)) {
      signals.push({
        type: 'no_document_indicator',
        description: `Found no-document indicator: "${indicator}"`,
        source: 'page_content',
      });
      return { quality: 'none', confidence: 'low', signals };
    }
  }

  return { quality: 'unknown', confidence: 'low', signals };
}

/**
 * Analyze URL structure for quality hints
 */
function analyzeUrlStructure(url: string): DetectorSignal[] {
  const signals: DetectorSignal[] = [];
  const lowerUrl = url.toLowerCase();

  // Modern CMS patterns
  if (
    lowerUrl.includes('municode') ||
    lowerUrl.includes('american-legal') ||
    lowerUrl.includes('codepublishing') ||
    lowerUrl.includes('ecode360') ||
    lowerUrl.includes('generalcode')
  ) {
    signals.push({
      type: 'modern_cms_url',
      description: 'URL indicates modern code publishing platform',
      source: url,
    });
  }

  // Gov domain suggests some online presence
  if (lowerUrl.includes('.gov') || lowerUrl.includes('.us')) {
    signals.push({
      type: 'gov_domain',
      description: 'Government domain detected',
      source: url,
    });
  }

  return signals;
}

/**
 * Extract document links from page content (helper for probe)
 */
export function extractDocumentLinks(htmlContent: string): string[] {
  const links: string[] = [];

  // Simple regex to find href attributes
  // This is intentionally simple — we're not parsing HTML fully
  const hrefRegex = /href=["']([^"']+)["']/gi;
  let match;

  while ((match = hrefRegex.exec(htmlContent)) !== null) {
    const href = match[1];
    // Only include relevant document links
    if (
      href.endsWith('.pdf') ||
      href.includes('/code/') ||
      href.includes('/ordinance/') ||
      href.includes('municode') ||
      href.includes('american-legal')
    ) {
      links.push(href);
    }
  }

  return links;
}
