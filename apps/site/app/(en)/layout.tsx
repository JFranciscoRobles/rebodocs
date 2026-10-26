import type { ReactNode } from 'react';
import { RootDocument, rootMetadata } from '@/components/pages/RootDocument';

// English, at the root of the site: the addresses it always had.
export const metadata = rootMetadata('en');
export { viewport } from '@/components/pages/RootDocument';

export default function EnglishLayout({ children }: { children: ReactNode }) {
  return <RootDocument locale="en">{children}</RootDocument>;
}
