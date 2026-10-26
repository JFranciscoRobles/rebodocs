import { TOOLS } from '@rebodocs/mcp';
import { SPEED } from '@/components/docs/server/data';
import { AGAINST_WORD, TESTS, linesLikeWord } from '@/components/docs/status/data';
import { formatNumber } from '@/lib/i18n';
import { getT, pageLocale } from '@/lib/locale';

/**
 * The project in four numbers, each from where it was measured: the documents
 * laid out against Word's own PDFs, the tests, the tools an assistant is given,
 * and the time a PDF takes in Node. None is written here by hand.
 */
export function Metrics() {
  const longest = SPEED[SPEED.length - 1];
  // The editor's tests in a browser are a row of their own, of the same package.
  const places = new Set(TESTS.map((row) => row.where.en.split(',')[0])).size;
  const t = getT();
  const documents = AGAINST_WORD.length;
  const metrics: { label: string; value: string; note: string }[] = [
    {
      label: t({ en: 'Lines where Word puts them', es: 'Líneas donde Word las pone', zh: '与 Word 位置一致的行' }),
      value: `${linesLikeWord()}%`,
      note: t({
        en: `Across ${documents} documents measured against Word’s own PDFs`,
        es: `En ${documents} documentos medidos contra los PDF del propio Word`,
        zh: `基于 ${documents} 份与 Word 自身导出的 PDF 对照测量的文档`,
      }),
    },
    {
      label: t({ en: 'Automated tests', es: 'Pruebas automatizadas', zh: '自动化测试' }),
      value: formatNumber(
        TESTS.reduce((sum, row) => sum + row.count, 0),
        pageLocale(),
      ),
      note: t({ en: `In ${places} packages and demos, all passing`, es: `En ${places} paquetes y demos, todas pasando`, zh: `分布在 ${places} 个软件包和演示中，全部通过` }),
    },
    {
      label: t({ en: 'Tools for an assistant', es: 'Herramientas para un asistente', zh: '助手可用的工具' }),
      value: String(TOOLS.length),
      note: t({ en: 'Read, edit, review and save .docx through MCP', es: 'Leer, editar, revisar y guardar .docx por MCP', zh: '通过 MCP 读取、编辑、审阅和保存 .docx' }),
    },
    {
      label: t({ en: `A PDF of ${longest.pages} pages`, es: `Un PDF de ${longest.pages} páginas`, zh: `${longest.pages} 页的 PDF` }),
      value: longest.pdf,
      note: t({ en: 'Made in Node, its fonts inside it', es: 'Hecho en Node, con sus fuentes dentro', zh: '在 Node 中生成，字体已嵌入' }),
    },
  ];
  return (
    <section aria-labelledby="metrics" className="mx-auto max-w-[1180px] px-6 pt-14">
      <h2 id="metrics" className="sr-only">
        {t({ en: 'By the numbers', es: 'En cifras', zh: '数据一览' })}
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
