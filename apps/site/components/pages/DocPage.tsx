import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AccessibilityPage } from '@/components/docs/accessibility/AccessibilityPage';
import { ArchitecturePage } from '@/components/docs/architecture/ArchitecturePage';
import { AssistantsPage } from '@/components/docs/assistants/AssistantsPage';
import { CollaborationPage } from '@/components/docs/collaboration/CollaborationPage';
import { FontsPage } from '@/components/docs/fonts/FontsPage';
import { LanguagesPage } from '@/components/docs/languages/LanguagesPage';
import { LetterheadPage } from '@/components/docs/letterhead/LetterheadPage';
import { MobilePage } from '@/components/docs/mobile/MobilePage';
import { StylingPage } from '@/components/docs/styling/StylingPage';
import { HeadlessPage } from '@/components/docs/headless/HeadlessPage';
import { ExamplePage } from '@/components/docs/example/ExamplePage';
import { VanillaPage } from '@/components/docs/vanilla/VanillaPage';
import { ViewerPage } from '@/components/docs/viewer/ViewerPage';
import { ReactPage } from '@/components/docs/react/ReactPage';
import { DemosPage } from '@/components/docs/demos/DemosPage';
import { StatusPage } from '@/components/docs/status/StatusPage';
import { GettingStartedPage } from '@/components/docs/getting-started/GettingStartedPage';
import { TrackedChangesPage } from '@/components/docs/tracked-changes/TrackedChangesPage';
import { VersionsPage } from '@/components/docs/versions/VersionsPage';
import { ComponentsPage } from '@/components/docs/ComponentsPage';
import { EditorApiPage } from '@/components/docs/editor-api/EditorApiPage';
import { OnThisPage } from '@/components/docs/OnThisPage';
import { PageIndex } from '@/components/docs/PageIndex';
import { PageFooter } from '@/components/docs/PageFooter';
import { PackagesPage } from '@/components/docs/packages/PackagesPage';
import { ServerPage } from '@/components/docs/server/ServerPage';
import { StoragePage } from '@/components/docs/storage/StoragePage';
import { TemplatesPage } from '@/components/docs/templates/TemplatesPage';
import { CUSTOM } from '@/components/docs/pages';
import { loadDoc } from '@/lib/docs';
import { type Locale, translator } from '@/lib/i18n';
import { setPageLocale } from '@/lib/locale';
import { pageMetadata } from '@/lib/seo';
import { PAGES, REPO, groupOf, hrefOf, markdownOf } from '@/lib/site';

/** The slug of a page from the segments of its address: none is the first page. */
export const slugOf = (slug?: string[]) => (slug?.length ? slug.join('/') : 'index');

/** The pages written in React, by slug; the rest are Markdown in `content/docs`. */
const REACT_PAGES: Record<string, typeof ComponentsPage> = {
  accessibility: AccessibilityPage,
  architecture: ArchitecturePage,
  assistants: AssistantsPage,
  collaboration: CollaborationPage,
  components: ComponentsPage,
  demos: DemosPage,
  'editor-api': EditorApiPage,
  example: ExamplePage,
  fonts: FontsPage,
  'getting-started': GettingStartedPage,
  headless: HeadlessPage,
  languages: LanguagesPage,
  letterhead: LetterheadPage,
  mobile: MobilePage,
  packages: PackagesPage,
  react: ReactPage,
  server: ServerPage,
  status: StatusPage,
  storage: StoragePage,
  styling: StylingPage,
  templates: TemplatesPage,
  'tracked-changes': TrackedChangesPage,
  vanilla: VanillaPage,
  viewer: ViewerPage,
  versions: VersionsPage,
};

/** Every page of the documentation, for each language to make. */
export function docParams() {
  return PAGES.map((page) => ({ slug: page.slug === 'index' ? [] : [page.slug] }));
}

export async function docMetadata(slug: string, locale: Locale): Promise<Metadata> {
  if (!PAGES.some((page) => page.slug === slug)) return {};
  const t = translator(locale);
  const custom = CUSTOM[slug];
  const { title, description } = custom ? { title: t(custom.title), description: t(custom.description) } : await loadDoc(slug, locale);
  return pageMetadata({ locale, path: hrefOf(slug), title, description, extra: { types: { 'text/markdown': markdownOf(slug) } } });
}

/** A page of the documentation, in a language: its title, its sections, and the pages before and after it. */
export async function DocPage({ slug, locale }: { slug: string; locale: Locale }) {
  setPageLocale(locale);
  const t = translator(locale);
  const at = PAGES.findIndex((page) => page.slug === slug);
  if (at < 0) notFound();
  const custom = CUSTOM[slug];
  const Custom = REACT_PAGES[slug];
  const doc = custom ? undefined : await loadDoc(slug, locale);
  const headings = custom?.headings.map((heading) => ({ id: heading.id, text: t(heading.text) })) ?? doc!.headings;
  const edit = `${REPO}/edit/main/${custom?.source ?? `apps/site/content/docs/${locale === 'en' ? '' : `${locale}/`}${slug}.md`}`;
  const group = groupOf(slug);

  return (
    <div className="flex gap-12">
      {/* The index comes after the title and its lead: the first section, and all that follows it, are put after it. */}
      <main id="top" className="flex min-w-0 flex-1 flex-col pb-24 pt-9 [&>section]:order-1 [&>section~*]:order-1">
        <p className="m-0 text-[13px] text-muted">
          {group && t(group.title)} <span aria-hidden="true">/</span> <span className="text-ink">{t(PAGES[at].title)}</span>
        </p>
        {Custom ? (
          <Custom />
        ) : (
          <>
            <h1 className="mb-7 mt-3 font-display text-[clamp(36px,4vw,48px)] font-extrabold leading-[1.08] tracking-[-0.03em]">{doc!.title}</h1>
            <article className="doc order-1" dangerouslySetInnerHTML={{ __html: doc!.html }} />
          </>
        )}
        <PageIndex headings={headings} />
        <div className="order-2!">
          <PageFooter previous={PAGES[at - 1]} next={PAGES[at + 1]} edit={edit} />
        </div>
      </main>
      {!custom?.wide && <OnThisPage headings={headings} />}
    </div>
  );
}
