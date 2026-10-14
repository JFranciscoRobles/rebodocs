import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { loadDoc } from '@/lib/docs';
import { PAGES, REPO, hrefOf } from '@/lib/site';

type Props = { params: Promise<{ slug?: string[] }> };
const slugOf = (slug?: string[]) => (slug?.length ? slug.join('/') : 'index');

export const dynamicParams = false;
export function generateStaticParams() {
  return PAGES.map((page) => ({ slug: page.slug === 'index' ? [] : [page.slug] }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const slug = slugOf((await params).slug);
  if (!PAGES.some((page) => page.slug === slug)) return {};
  const { title, description } = await loadDoc(slug);
  return { title, description, alternates: { canonical: hrefOf(slug) } };
}

export default async function DocPage({ params }: Props) {
  const slug = slugOf((await params).slug);
  const at = PAGES.findIndex((page) => page.slug === slug);
  if (at < 0) notFound();
  const doc = await loadDoc(slug);
  const previous = PAGES[at - 1];
  const next = PAGES[at + 1];

  return (
    <div className="min-w-0 py-8 xl:grid xl:grid-cols-[minmax(0,1fr)_190px] xl:gap-10">
      <main className="min-w-0">
        <h1 className="mb-6 text-[clamp(30px,4vw,40px)] font-extrabold leading-tight tracking-tight">{doc.title}</h1>
        <article className="doc" dangerouslySetInnerHTML={{ __html: doc.html }} />
        <nav className="mt-14 grid gap-3 border-t border-line pt-6 sm:grid-cols-2">
          {previous ? (
            <Link href={hrefOf(previous.slug)} className="rounded-xl border border-line p-4 hover:border-brand">
              <span className="block text-xs text-muted">Previous</span>
              <span className="font-semibold text-brand">{previous.title}</span>
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link href={hrefOf(next.slug)} className="rounded-xl border border-line p-4 text-right hover:border-brand">
              <span className="block text-xs text-muted">Next</span>
              <span className="font-semibold text-brand">{next.title}</span>
            </Link>
          )}
        </nav>
        <p className="mt-6 text-sm text-muted">
          Something wrong on this page?{' '}
          <a className="font-medium text-brand hover:underline" href={`${REPO}/edit/main/apps/site/content/docs/${slug}.md`}>
            Edit it on GitHub
          </a>
          .
        </p>
      </main>
      {doc.headings.length > 1 && (
        <aside className="hidden xl:block">
          <div className="sticky top-24 text-sm">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">On this page</p>
            <ul className="space-y-1.5 border-l border-line">
              {doc.headings.map((heading) => (
                <li key={heading.id}>
                  <a href={`#${heading.id}`} className="-ml-px block border-l border-transparent pl-3 text-muted hover:border-muted hover:text-ink">
                    {heading.text}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      )}
    </div>
  );
}
