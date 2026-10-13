import type { Metadata } from 'next';
import { DemoApp } from '@/components/DemoApp';

export const metadata: Metadata = {
  title: 'Demo',
  description: 'The editor in your browser, two ways: an interface built on the headless hooks, and the one that comes with it. Open a DOCX of your own.',
  alternates: { canonical: '/demo/' },
};

export default function Demo() {
  return (
    <main>
      <DemoApp />
    </main>
  );
}
