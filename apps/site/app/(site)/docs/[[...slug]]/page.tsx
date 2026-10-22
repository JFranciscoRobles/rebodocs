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
import { PAGES, REPO, groupOf, hrefOf, markdownOf } from '@/lib/site';

type Props = { params: Promise<{ slug?: string[] }> };
const slugOf = (slug?: string[]) => (slug?.length ? slug.join('/') : 'index');

/** The pages written in React, by slug; the rest are Markdown in `content/docs`. */
const REACT_PAGES: Record<string, typeof ComponentsPage> = { accessibility: AccessibilityPage, architecture: ArchitecturePage, assistants: AssistantsPage, collaboration: CollaborationPage, components: ComponentsPage, demos: DemosPage, 'editor-api': EditorApiPage, example: ExamplePage, fonts: FontsPage, 'getting-started': GettingStartedPage, headless: HeadlessPage, languages: LanguagesPage, letterhead: LetterheadPage, mobile: MobilePage, packages: PackagesPage, react: ReactPage, server: ServerPage, status: StatusPage, storage: StoragePage, styling: StylingPage, templates: TemplatesPage, 'tracked-changes': TrackedChangesPage, vanilla: VanillaPage, versions: VersionsPage };

export const dynamicParams = false;
export function generateStaticParams() {
  return PAGES.map((page) => ({ slug: page.slug === 'index' ? [] : [page.slug] }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const slug = slugOf((await params).slug);
  if (!PAGES.some((page) => page.slug === slug)) return {};
  const { title, description } = CUSTOM[slug] ?? (await loadDoc(slug));
  return { title, description, alternates: { canonical: hrefOf(slug), types: { 'text/markdown': markdownOf(slug) } } };
}

export default async function DocPage({ params }: Props) {
  const slug = slugOf((await params).slug);
  const at = PAGES.findIndex((page) => page.slug === slug);
  if (at < 0) notFound();
  const custom = CUSTOM[slug];
  const Custom = REACT_PAGES[slug];
  const doc = custom ? undefined : await loadDoc(slug);
  const headings = custom?.headings ?? doc!.headings;
  const edit = `${REPO}/edit/main/${custom?.source ?? `apps/site/content/docs/${slug}.md`}`;

  return (
    <div className="flex gap-12">
      {/* The index comes after the title and its lead: the first section, and all that follows it, are put after it. */}
      <main id="top" className="flex min-w-0 flex-1 flex-col pb-24 pt-9 [&>section]:order-1 [&>section~*]:order-1">
        <p className="m-0 text-[13px] text-muted">
          {groupOf(slug)?.title} <span aria-hidden="true">/</span> <span className="text-ink">{PAGES[at].title}</span>
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
