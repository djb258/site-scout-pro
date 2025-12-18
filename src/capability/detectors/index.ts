/**
 * Capability Detectors Index
 *
 * Exports all detector modules for the CapabilityProbe.
 */

export { detectPermitSystem, getDetectedVendor } from './detectPermitSystem';
export type { PermitSystemDetectorInput } from './detectPermitSystem';

export { detectZoningModel, isNoZoningLikely } from './detectZoningModel';
export type { ZoningModelDetectorInput } from './detectZoningModel';

export { detectDocumentQuality, extractDocumentLinks } from './detectDocumentQuality';
export type { DocumentQualityDetectorInput } from './detectDocumentQuality';

export { detectInspectionLinkage } from './detectInspectionLinkage';
export type { InspectionLinkageDetectorInput } from './detectInspectionLinkage';
