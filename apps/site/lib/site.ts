/** Where the code is. One place to change it. */
export const REPO = 'https://github.com/JFranciscoRobles/rebodocs';
export const SITE = 'https://rebodocs.com';
/** The package an application installs. */
export const NPM = 'https://www.npmjs.com/package/@rebodocs/react';
/** Every package, on npm. */
export const NPM_ORG = 'https://www.npmjs.com/org/rebodocs';

export interface NavItem {
  title: string;
  /** The file in `content/docs`, without `.md`; `index` is `/docs/`. */
  slug: string;
}

/** The pages of the documentation, in the order they are read. */
export const NAV: { title: string; items: NavItem[] }[] = [
  {
    title: 'Start',
    items: [
      { title: 'What is Rebodocs', slug: 'index' },
      { title: 'Getting started', slug: 'getting-started' },
      { title: 'Demos to run', slug: 'demos' },
    ],
  },
  {
    title: 'Put it in your app',
    items: [
      { title: 'React component', slug: 'react' },
      { title: 'Headless: your own UI', slug: 'headless' },
      { title: 'A complete interface', slug: 'example' },
      { title: 'Without a framework', slug: 'vanilla' },
      { title: 'Styling and Tailwind', slug: 'styling' },
      { title: 'Phones and touch', slug: 'mobile' },
    ],
  },
  {
    title: 'Documents',
    items: [
      { title: 'Templates and variables', slug: 'templates' },
      { title: 'On a server: DOCX and PDF', slug: 'server' },
      { title: 'Documents in an S3 bucket', slug: 'storage' },
      { title: 'Letterheads', slug: 'letterhead' },
      { title: 'Fonts', slug: 'fonts' },
      { title: 'Languages', slug: 'languages' },
    ],
  },
  {
    title: 'Together',
    items: [
      { title: 'Real-time collaboration', slug: 'collaboration' },
      { title: 'AI assistants (MCP)', slug: 'assistants' },
    ],
  },
  {
    title: 'Reference',
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
export const hrefOf = (slug: string) => (slug === 'index' ? '/docs/' : `/docs/${slug}/`);
