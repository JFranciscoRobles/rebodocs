import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { SITE } from '@/lib/site';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: 'Rebodocs: the document editor you build into your app', template: '%s · Rebodocs' },
  description:
    'A word processor for the browser, compatible with Word (DOCX) files, with its own engine: real-time collaboration, templates and PDF. Open source, built to live inside your application.',
  icons: { icon: '/logo.svg' },
  openGraph: { type: 'website', siteName: 'Rebodocs', url: SITE },
};
export const viewport: Viewport = { themeColor: '#0b57d0' };

// What every page has. The header and the footer of the site are in
// `(site)/layout.tsx`: a demo takes the whole window, and has neither.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
