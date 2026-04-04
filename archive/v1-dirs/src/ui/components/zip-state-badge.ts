/**
 * ZIP State Badge Styling
 *
 * UI-only concern: maps ZipDataState to badge visual props.
 * Extracted from zipStateClassifier per CTB v2.0.0 (no UI logic in app/).
 */

import type { ZipDataState } from "@/app/services/zip-state-classifier";

export function getStateBadgeProps(state: ZipDataState): {
  variant: 'default' | 'secondary' | 'outline';
  className: string;
  label: string;
} {
  switch (state) {
    case 'KNOWN':
      return {
        variant: 'default',
        className: 'bg-green-500/90 hover:bg-green-500 text-white',
        label: 'KNOWN'
      };
    case 'STALE':
      return {
        variant: 'default',
        className: 'bg-yellow-500/90 hover:bg-yellow-500 text-white',
        label: 'STALE'
      };
    case 'UNKNOWN':
      return {
        variant: 'secondary',
        className: '',
        label: 'UNKNOWN'
      };
  }
}
