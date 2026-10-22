/** Where the code is. One place to change it. */
export const REPO = 'https://github.com/JFranciscoRobles/rebodocs';
export const SITE = 'https://rebodocs.com';
/** The package an application installs. */
export const NPM = 'https://www.npmjs.com/package/@rebodocs/react';
/** Every package, on npm. */
export const NPM_ORG = 'https://www.npmjs.com/org/rebodocs';

import type { Pastel } from './home';

export interface NavItem {
  title: string;
  /** The file in `content/docs`, without `.md`; `index` is `/docs/`. */
  slug: string;
}

/** The pages of the documentation, in the order they are read; each group has its colour in the sidebar. */
export const NAV: { title: string; color: Pastel; items: NavItem[] }[] = [
  {
    title: 'Start',
    color: 'blue',
    items: [
      { title: 'What is Rebodocs', slug: 'index' },
      { title: 'Getting started', slug: 'getting-started' },
      { title: 'Demos to run', slug: 'demos' },
    ],
  },
  {
    title: 'Put it in your app',
    color: 'purple',
    items: [
      { title: 'React component', slug: 'react' },
      { title: 'Headless: your own UI', slug: 'headless' },
      { title: 'A complete interface', slug: 'example' },
      { title: 'Without a framework', slug: 'vanilla' },
      { title: 'Styling and Tailwind', slug: 'styling' },
      { title: 'Phones and touch', slug: 'mobile' },
      { title: 'Accessibility', slug: 'accessibility' },
    ],
  },
  {
    title: 'Documents',
    color: 'yellow',
    items: [
      { title: 'Templates and variables', slug: 'templates' },
      { title: 'On a server: DOCX and PDF', slug: 'server' },
      { title: 'Documents in an S3 bucket', slug: 'storage' },
      { title: 'Letterheads', slug: 'letterhead' },
      { title: 'Versions', slug: 'versions' },
      { title: 'Tracked changes', slug: 'tracked-changes' },
      { title: 'Fonts', slug: 'fonts' },
      { title: 'Languages', slug: 'languages' },
    ],
  },
  {
    title: 'Together',
    color: 'pink',
    items: [
      { title: 'Real-time collaboration', slug: 'collaboration' },
      { title: 'AI assistants (MCP)', slug: 'assistants' },
    ],
  },
  {
    title: 'Reference',
    color: 'green',
    items: [
      { title: 'Packages', slug: 'packages' },
      { title: 'Components and hooks', slug: 'components' },
      { title: 'Editor API', slug: 'editor-api' },
      { title: 'How it works', slug: 'architecture' },
      { title: 'Status and roadmap', slug: 'status' },
    ],
  },
];

export const PAGES = NAV.flatMap((group) => group.items);
/** The group a page is in, for the line above its title. */
export const groupOf = (slug: string) => NAV.find((group) => group.items.some((item) => item.slug === slug));
export const hrefOf = (slug: string) => (slug === 'index' ? '/docs/' : `/docs/${slug}/`);
/** The same page as Markdown, for language models: made by scripts/llms.ts once the site is built. */
export const markdownOf = (slug: string) => `/docs/${slug}.md`;
