import { TOOLS } from '@rebodocs/mcp';
import { SPEED } from '@/components/docs/server/data';
import { AGAINST_WORD, TESTS, linesLikeWord } from '@/components/docs/status/data';

/**
 * The project in four numbers, each from where it was measured: the documents
 * laid out against Word's own PDFs, the tests, the tools an assistant is given,
 * and the time a PDF takes in Node. None is written here by hand.
 */
export function Metrics() {
  const longest = SPEED[SPEED.length - 1];
  // The editor's tests in a browser are a row of their own, of the same package.
  const places = new Set(TESTS.map((row) => row.where.split(',')[0])).size;
  const metrics: { label: string; value: string; note: string }[] = [
    { label: 'Lines where Word puts them', value: `${linesLikeWord()}%`, note: `Across ${AGAINST_WORD.length} documents measured against Word’s own PDFs` },
    { label: 'Automated tests', value: TESTS.reduce((sum, row) => sum + row.count, 0).toLocaleString('en-US'), note: `In ${places} packages and demos, all passing` },
    { label: 'Tools for an assistant', value: String(TOOLS.length), note: 'Read, edit, review and save .docx through MCP' },
    { label: `A PDF of ${longest.pages} pages`, value: longest.pdf, note: 'Made in Node, its fonts inside it' },
  ];
  return (
    <section aria-labelledby="metrics" className="mx-auto max-w-[1180px] px-6 pt-14">
      <h2 id="metrics" className="sr-only">
        By the numbers
      </h2>
      <dl className="reveal grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {metrics.map(({ label, value, note }) => (
          <div key={label} className="flex flex-col rounded-2xl border border-border bg-white p-5">
            <dt className="order-2 mt-1.5 text-[15px] font-semibold text-ink">{label}</dt>
            <dd className="order-1 m-0 text-[clamp(32px,4vw,44px)] font-semibold leading-none tracking-[-0.02em] text-ink">{value}</dd>
            <dd className="order-3 m-0 mt-1 text-sm leading-[1.45] text-muted">{note}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
