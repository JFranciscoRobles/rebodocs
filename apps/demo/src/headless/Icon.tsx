import type { ReactNode } from 'react';

const PATHS = {
  undo: (
    <>
      <path d="M6 4 3 7l3 3" />
      <path d="M3 7h7a4 4 0 0 1 0 8H7" />
    </>
  ),
  redo: (
    <>
      <path d="m12 4 3 3-3 3" />
      <path d="M15 7H8a4 4 0 0 0 0 8h3" />
    </>
  ),
  left: <path d="M3 4h12M3 7.5h8M3 11h12M3 14.5h8" />,
  center: <path d="M3 4h12M5 7.5h8M3 11h12M5 14.5h8" />,
  right: <path d="M3 4h12M7 7.5h8M3 11h12M7 14.5h8" />,
  justify: <path d="M3 4h12M3 7.5h12M3 11h12M3 14.5h12" />,
  bullet: (
    <>
      <path d="M7 5h8M7 9h8M7 13h8" />
      <path d="M3.5 5h.01M3.5 9h.01M3.5 13h.01" strokeWidth="2.4" />
    </>
  ),
  number: (
    <>
      <path d="M8 5h7M8 9h7M8 13h7" />
      <path d="M3 4.5 4 4v3M3 11h1.6L3 13.5h1.8" strokeWidth="1.1" />
    </>
  ),
  table: (
    <>
      <rect x="2.5" y="3.5" width="13" height="11" rx="1" />
      <path d="M2.5 7h13M2.5 10.5h13M7 3.5v11M11 3.5v11" />
    </>
  ),
  image: (
    <>
      <rect x="2.5" y="3.5" width="13" height="11" rx="1" />
      <path d="m2.5 12.500 4-4 3 3 2-2 4 3.500" />
      <path d="M12 6.800h.01" strokeWidth="2.2" />
    </>
  ),
  link: (
    <>
      <path d="M7.600 10.400a2.700 2.700 0 0 0 3.800 0l2.300-2.300a2.700 2.700 0 0 0-3.800-3.800l-.8.8" />
      <path d="M10.400 7.600a2.700 2.700 0 0 0-3.800 0l-2.300 2.300a2.700 2.700 0 0 0 3.800 3.800l.8-.8" />
    </>
  ),
  variable: (
    <path d="M6.500 3.500c-1.400 0-1.900.700-1.900 1.900v1.800c0 .9-.5 1.800-1.800 1.800 1.300 0 1.800.9 1.800 1.800v1.800c0 1.100.5 1.900 1.900 1.900M11.500 3.500c1.400 0 1.900.700 1.900 1.900v1.800c0 .9.5 1.800 1.800 1.800-1.300 0-1.800.9-1.800 1.800v1.800c0 1.100-.5 1.900-1.900 1.900" />
  ),
  note: <path d="M3.500 4.500h11v7.500H8l-2.700 2.700V12H3.500z" />,
  signature: (
    <path d="M2.500 11.500c1.800-4.500 3.200-6.300 4.100-5.400 1.100 1.100-1.800 5.400-.5 5.400 1.100 0 1.800-2.700 2.700-2.700s.5 2.300 1.800 2.300 2.200-1.400 4.900-1.400M2.500 14.500h13" />
  ),
  pageBreak: (
    <>
      <path d="M4.500 6.500V3h9v3.500M4.500 11.500V15h9v-3.500" />
      <path d="M2.500 9h13" strokeDasharray="2 2.500" />
    </>
  ),
  outdent: (
    <>
      <path d="M3 4h12M9 7.500h6M9 11h6M3 14.500h12" />
      <path d="M6 7 3.500 9.200 6 11.500" />
    </>
  ),
  indent: (
    <>
      <path d="M3 4h12M9 7.500h6M9 11h6M3 14.500h12" />
      <path d="M3.500 7 6 9.200 3.500 11.500" />
    </>
  ),
  print: (
    <>
      <path d="M5 6.500V3h8v3.500M5 12.500H3.500v-6h11v6H13" />
      <rect x="5" y="10.500" width="8" height="4.500" />
    </>
  ),
  panel: (
    <>
      <rect x="2.500" y="3.500" width="13" height="11" rx="1" />
      <path d="M11 3.500v11" />
    </>
  ),
  search: (
    <>
      <circle cx="8" cy="8" r="4.500" />
      <path d="m11.500 11.500 4 4" />
    </>
  ),
  up: <path d="m5 11 4-4 4 4" />,
  down: <path d="m5 7 4 4 4-4" />,
  close: <path d="m5 5 8 8M13 5l-8 8" />,
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof PATHS;

export function Icon({ name }: { name: IconName }) {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {PATHS[name]}
    </svg>
  );
}
