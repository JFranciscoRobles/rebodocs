'use client';

import { DocsRuler } from '@rebodocs/react';
import type { CSSProperties } from 'react';

/** The ruler as it comes, in other colours: its six variables, set on it. */
export function Ruler() {
  return (
    <DocsRuler
      style={
        {
          '--dx-ruler': '#ecfdf5',
          '--dx-ruler-line': '#a7f3d0',
          '--dx-ruler-margin': '#d1fae5',
          '--dx-ruler-text': '#ffffff',
          '--dx-ruler-ink': '#047857',
          '--dx-ruler-on': '#059669',
        } as CSSProperties
      }
    />
  );
}
