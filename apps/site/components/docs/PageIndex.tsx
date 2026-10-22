/**
 * The sections of the page, at its start, under the title: what is on it and
 * a way straight to each. It shows on every screen, the narrow ones too.
 */
export function PageIndex({ headings }: { headings: { id: string; text: string }[] }) {
  if (headings.length < 2) return null;
  return (
    <nav aria-labelledby="page-index" className="order-0! mt-8 max-w-[920px] rounded-2xl border border-border bg-surface px-5 py-4">
      <p id="page-index" className="m-0 text-xs font-semibold uppercase tracking-[0.04em] text-muted">
        On this page
      </p>
      <ol className="m-0 mt-2.5 grid list-none gap-x-6 gap-y-1 p-0 sm:grid-cols-2 lg:grid-cols-3">
        {headings.map((heading, i) => (
          <li key={heading.id} className="min-w-0">
            <a href={`#${heading.id}`} className="flex gap-2 rounded-md py-1 text-[14.5px] text-ink-soft no-underline hover:text-brand">
              <span className="w-5 flex-none text-right font-code text-[12.5px] leading-[1.6] text-muted">{i + 1}</span>
              <span className="min-w-0">{heading.text}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
