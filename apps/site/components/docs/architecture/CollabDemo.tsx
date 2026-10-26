'use client';

import { useState } from 'react';
import { useT } from '@/components/i18n';
import type { L } from '@/lib/i18n';
import { CAPTION } from '../ui';

type Mark = 'mine' | 'theirs';
/** A paragraph; its text can be in pieces, to mark the letters one change put in. */
type Para = { id: string; text: string | [text: string, mark?: Mark][]; mark?: Mark };
// The document and what the server logs stay as written in every language of the site: the offsets are of these letters.
type Step = { title: L; text: L; ana: Para[]; luis: Para[]; server: string[]; check?: boolean };

const K3 = 'Late payments add a fee.';
const K3_AFTER = 'Late payments add a fee each month.';
const LUIS_CHANGE = "in k3, at offset 23, insert ' each month'";
const ANA_CHANGE = "after k1, insert paragraph k4 'No. 1024'";

/** What each of them sees, and what the server knows, at each step: two changes in different paragraphs. */
const APART: Step[] = [
  {
    title: { en: 'The same document, shared', es: 'El mismo documento, compartido', zh: '同一份文档，共享中' },
    text: {
      en: 'While a document is shared, each paragraph has an id. Ana and Luis have the same three.',
      es: 'Mientras un documento está compartido, cada párrafo tiene un id. Ana y Luis tienen los mismos tres.',
      zh: '文档共享期间，每个段落都有一个 id。Ana 和 Luis 有相同的三个段落。',
    },
    ana: [
      { id: 'k1', text: 'Receipt' },
      { id: 'k2', text: 'Payment is due within 15 days.' },
      { id: 'k3', text: K3 },
    ],
    luis: [
      { id: 'k1', text: 'Receipt' },
      { id: 'k2', text: 'Payment is due within 15 days.' },
      { id: 'k3', text: K3 },
    ],
    server: [],
  },
  {
    title: { en: 'Luis types, and sees it at once', es: 'Luis escribe, y lo ve en el acto', zh: 'Luis 输入，并立即看到' },
    text: {
      en: 'His own change is applied without waiting for the server. It names the paragraph by id, not by position.',
      es: 'Su propio cambio se aplica sin esperar al servidor. Nombra el párrafo por su id, no por su posición.',
      zh: '他自己的更改无需等待服务器就会应用。它按 id 而不是按位置指明段落。',
    },
    ana: [
      { id: 'k1', text: 'Receipt' },
      { id: 'k2', text: 'Payment is due within 15 days.' },
      { id: 'k3', text: K3 },
    ],
    luis: [
      { id: 'k1', text: 'Receipt' },
      { id: 'k2', text: 'Payment is due within 15 days.' },
      { id: 'k3', text: K3_AFTER, mark: 'mine' },
    ],
    server: [`Luis: ${LUIS_CHANGE}`],
  },
  {
    title: { en: 'Ana, at the same time, adds a paragraph above', es: 'Ana, al mismo tiempo, añade un párrafo encima', zh: '与此同时，Ana 在上方添加了一个段落' },
    text: {
      en: 'Neither has seen the other’s change yet. By position, Luis’s paragraph is now the fourth on Ana’s screen.',
      es: 'Ninguno ha visto aún el cambio del otro. Por posición, el párrafo de Luis es ahora el cuarto en la pantalla de Ana.',
      zh: '双方都还没有看到对方的更改。按位置算，Luis 修改的段落在 Ana 的屏幕上已经是第四段了。',
    },
    ana: [
      { id: 'k1', text: 'Receipt' },
      { id: 'k4', text: 'No. 1024', mark: 'mine' },
      { id: 'k2', text: 'Payment is due within 15 days.' },
      { id: 'k3', text: K3 },
    ],
    luis: [
      { id: 'k1', text: 'Receipt' },
      { id: 'k2', text: 'Payment is due within 15 days.' },
      { id: 'k3', text: K3_AFTER, mark: 'mine' },
    ],
    server: [`Luis: ${LUIS_CHANGE}`, `Ana: ${ANA_CHANGE}`],
  },
  {
    title: { en: 'The server puts them in one order', es: 'El servidor los pone en un mismo orden', zh: '服务器把它们排成同一顺序' },
    text: {
      en: 'Everyone’s changes go in one order, each rebased against the ones its author had not seen yet. Each editor rebases its own when that order arrives.',
      es: 'Los cambios de todos van en un mismo orden, cada uno rebasado sobre los que su autor aún no había visto. Cada editor rebasa los suyos cuando llega ese orden.',
      zh: '所有人的更改排成同一顺序，每个更改都会针对其作者尚未看到的更改进行变基。顺序到达后，每个编辑器也会对自己的更改进行变基。',
    },
    ana: [
      { id: 'k1', text: 'Receipt' },
      { id: 'k4', text: 'No. 1024', mark: 'mine' },
      { id: 'k2', text: 'Payment is due within 15 days.' },
      { id: 'k3', text: K3 },
    ],
    luis: [
      { id: 'k1', text: 'Receipt' },
      { id: 'k2', text: 'Payment is due within 15 days.' },
      { id: 'k3', text: K3_AFTER, mark: 'mine' },
    ],
    server: [`1. Luis: ${LUIS_CHANGE}`, `2. Ana: ${ANA_CHANGE}`],
  },
  {
    title: { en: 'Both arrive, and mean the same', es: 'Los dos llegan, y significan lo mismo', zh: '两者都到达，含义不变' },
    text: {
      en: 'Luis’s change says k3, so it lands in the right paragraph although one was added above it. Both screens are now the same document.',
      es: 'El cambio de Luis dice k3, así que cae en el párrafo correcto aunque se añadió uno encima. Las dos pantallas son ahora el mismo documento.',
      zh: 'Luis 的更改指明的是 k3，所以即使上方新增了段落，它也落在正确的段落中。两边屏幕现在是同一份文档。',
    },
    ana: [
      { id: 'k1', text: 'Receipt' },
      { id: 'k4', text: 'No. 1024' },
      { id: 'k2', text: 'Payment is due within 15 days.' },
      { id: 'k3', text: K3_AFTER, mark: 'theirs' },
    ],
    luis: [
      { id: 'k1', text: 'Receipt' },
      { id: 'k4', text: 'No. 1024', mark: 'theirs' },
      { id: 'k2', text: 'Payment is due within 15 days.' },
      { id: 'k3', text: K3_AFTER },
    ],
    server: [`1. Luis: ${LUIS_CHANGE}`, `2. Ana: ${ANA_CHANGE}`],
  },
  {
    title: { en: 'A moment later, a check', es: 'Un momento después, una comprobación', zh: '片刻之后，核对一次' },
    text: {
      en: 'The rules are tested with two people editing at random from thousands of seeds, not proven. So when the changes stop, the server sends a digest of its document; an editor whose document differs loads the room again, keeping what it had not sent.',
      es: 'Las reglas se prueban con dos personas editando al azar con miles de semillas, no se demuestran. Así que cuando paran los cambios, el servidor envía un digest de su documento; un editor cuyo documento difiere vuelve a cargar la sala, conservando lo que no había enviado.',
      zh: '这些规则是用数千个随机种子模拟两人随机编辑来测试的，而不是经过证明的。因此更改停止后，服务器会发送文档的 digest；文档不一致的编辑器会重新加载房间，并保留尚未发送的内容。',
    },
    ana: [
      { id: 'k1', text: 'Receipt' },
      { id: 'k4', text: 'No. 1024' },
      { id: 'k2', text: 'Payment is due within 15 days.' },
      { id: 'k3', text: K3_AFTER },
    ],
    luis: [
      { id: 'k1', text: 'Receipt' },
      { id: 'k4', text: 'No. 1024' },
      { id: 'k2', text: 'Payment is due within 15 days.' },
      { id: 'k3', text: K3_AFTER },
    ],
    server: [`1. Luis: ${LUIS_CHANGE}`, `2. Ana: ${ANA_CHANGE}`, 'digest of the document → both match'],
    check: true,
  },
];

// The same paragraph: Ana writes "small " at offset 20 of k3, Luis " each month" at 23.
const K2 = { id: 'k2', text: 'Payment is due within 15 days.' };
const K1 = { id: 'k1', text: 'Receipt' };
const ANA_SAME = "in k3, at offset 20, insert 'small '";
const LUIS_SAME = "in k3, at offset 23, insert ' each month'";
const BOTH: [string, Mark?][] = [['Late payments add a '], ['small '], ['fee'], [' each month'], ['.']];
const marked = (ana?: Mark, luis?: Mark): [string, Mark?][] => [BOTH[0], [BOTH[1][0], ana], BOTH[2], [BOTH[3][0], luis], BOTH[4]];

/** Two changes in one paragraph: the second to arrive is moved over the letters of the first. */
const TOGETHER: Step[] = [
  {
    title: { en: 'The same paragraph, on both screens', es: 'El mismo párrafo, en las dos pantallas', zh: '两边屏幕上的同一段落' },
    text: {
      en: 'This time both will write in k3. An id is no longer enough: what has to agree is where in the paragraph.',
      es: 'Esta vez los dos escribirán en k3. Un id ya no basta: lo que tiene que coincidir es dónde dentro del párrafo.',
      zh: '这次两人都要在 k3 中输入。仅靠 id 已经不够了：需要一致的是在段落中的位置。',
    },
    ana: [K1, K2, { id: 'k3', text: K3 }],
    luis: [K1, K2, { id: 'k3', text: K3 }],
    server: [],
  },
  {
    title: { en: 'Both type at once', es: 'Los dos escriben a la vez', zh: '两人同时输入' },
    text: {
      en: 'Ana puts “small ” before “fee”, at offset 20. Luis, who has not seen it, puts “ each month” before the full stop, at offset 23. Each sees their own at once.',
      es: 'Ana pone “small ” antes de “fee”, en el offset 20. Luis, que no lo ha visto, pone “ each month” antes del punto, en el offset 23. Cada uno ve el suyo en el acto.',
      zh: 'Ana 在“fee”前的偏移 20 处插入“small ”。Luis 还没看到，在句号前的偏移 23 处插入“ each month”。双方都立即看到了自己的更改。',
    },
    ana: [K1, K2, { id: 'k3', text: [['Late payments add a '], ['small ', 'mine'], ['fee.']] }],
    luis: [K1, K2, { id: 'k3', text: [['Late payments add a fee'], [' each month', 'mine'], ['.']] }],
    server: [`Ana: ${ANA_SAME}`, `Luis: ${LUIS_SAME}`],
  },
  {
    title: { en: 'The server rebases the second', es: 'El servidor rebasa el segundo', zh: '服务器对第二个更改变基' },
    text: {
      en: 'Ana’s arrived first and goes in as it is. Luis’s was written against the paragraph before hers: six letters went in before his offset, so 23 becomes 29. Without this, “ each month” would land inside “fee”.',
      es: 'El de Ana llegó primero y entra tal cual. El de Luis se escribió sobre el párrafo de antes del de ella: entraron seis letras antes de su offset, así que 23 pasa a 29. Sin esto, “ each month” caería dentro de “fee”.',
      zh: 'Ana 的更改先到，原样采用。Luis 的更改基于 Ana 修改之前的段落：在他的偏移之前插入了六个字母，所以 23 变成 29。否则“ each month”会落在“fee”中间。',
    },
    ana: [K1, K2, { id: 'k3', text: [['Late payments add a '], ['small ', 'mine'], ['fee.']] }],
    luis: [K1, K2, { id: 'k3', text: [['Late payments add a fee'], [' each month', 'mine'], ['.']] }],
    server: [`1. Ana: ${ANA_SAME}`, `2. Luis: ${LUIS_SAME}`, "   rebased over 1 → in k3, at offset 29, insert ' each month'"],
  },
  {
    title: { en: 'Both arrive, and mean the same', es: 'Los dos llegan, y significan lo mismo', zh: '两者都到达，含义不变' },
    text: {
      en: 'Ana receives Luis’s change at offset 29. Luis receives Ana’s at offset 20, before his own letters, so it needs no moving on his side, and his own is moved over it, as the server did.',
      es: 'Ana recibe el cambio de Luis en el offset 29. Luis recibe el de Ana en el offset 20, antes de sus propias letras, así que en su lado no hay que moverlo, y el suyo se mueve sobre él, como hizo el servidor.',
      zh: 'Ana 收到 Luis 在偏移 29 处的更改。Luis 收到 Ana 在偏移 20 处的更改，位于他自己的字母之前，因此在他那边无需移动，而他自己的更改像服务器那样针对它进行变基。',
    },
    ana: [K1, K2, { id: 'k3', text: marked('mine', 'theirs') }],
    luis: [K1, K2, { id: 'k3', text: marked('theirs', 'mine') }],
    server: [`1. Ana: ${ANA_SAME}`, "2. Luis: in k3, at offset 29, insert ' each month'"],
  },
  {
    title: { en: 'A moment later, a check', es: 'Un momento después, una comprobación', zh: '片刻之后，核对一次' },
    text: {
      en: 'The digest of the server’s document matches both: “Late payments add a small fee each month.” Where both type at the very same place, the change the server put second goes after the first, on every screen.',
      es: 'El digest del documento del servidor coincide con los dos: “Late payments add a small fee each month.” Donde los dos escriben exactamente en el mismo lugar, el cambio que el servidor puso segundo va después del primero, en todas las pantallas.',
      zh: '服务器文档的 digest 与双方一致：“Late payments add a small fee each month.”。如果两人在完全相同的位置输入，服务器排在第二的更改会在每个屏幕上都位于第一个之后。',
    },
    ana: [K1, K2, { id: 'k3', text: marked() }],
    luis: [K1, K2, { id: 'k3', text: marked() }],
    server: [`1. Ana: ${ANA_SAME}`, "2. Luis: in k3, at offset 29, insert ' each month'", 'digest of the document → both match'],
    check: true,
  },
];

const SCENARIOS: [L, Step[]][] = [
  [{ en: 'Different paragraphs', es: 'Párrafos distintos', zh: '不同段落' }, APART],
  [{ en: 'The same paragraph', es: 'El mismo párrafo', zh: '同一段落' }, TOGETHER],
];

const MARK = { mine: 'border-[#e8c66a] bg-pastel-yellow', theirs: 'border-[#bfd3f7] bg-pastel-blue' };

function Screen({ who, doc, check }: { who: string; doc: Para[]; check?: boolean }) {
  const t = useT();
  return (
    <div className="min-w-0 flex-[1_1_220px] rounded-xl border border-border bg-white p-3.5">
      <p className="m-0 flex items-center justify-between text-[13px] font-semibold text-ink">
        {t({ en: `${who}’s screen`, es: `Pantalla de ${who}`, zh: `${who} 的屏幕` })}
        {check && <span className="rounded-full bg-pastel-green px-2 py-0.5 text-[11px] font-semibold text-pastel-green-fg">digest ✓</span>}
      </p>
      <ol className="m-0 mt-2.5 flex list-none flex-col gap-1.5 p-0">
        {doc.map((para) => (
          <li key={para.id} className={`flex animate-enter items-center gap-2 rounded-lg border px-2.5 py-1.75 transition-colors duration-300 ${para.mark ? MARK[para.mark] : 'border-border'}`}>
            <code className="flex-none rounded bg-hover px-1.5 font-code text-[11px] text-muted">{para.id}</code>
            <span className="min-w-0 flex-1 text-sm text-[#37352f]">
              {typeof para.text === 'string'
                ? para.text
                : para.text.map(([piece, mark], i) =>
                    mark ? (
                      <mark key={i} className={`rounded-[3px] border px-0.5 text-inherit ${MARK[mark]}`}>
                        {piece}
                      </mark>
                    ) : (
                      <span key={i}>{piece}</span>
                    ),
                  )}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Two people on one document, change by change. */
export function CollabDemo() {
  const t = useT();
  const [scenario, setScenario] = useState(0);
  const [at, setAt] = useState(0);
  const STEPS = SCENARIOS[scenario][1];
  const step = STEPS[at];

  return (
    <div className="mt-7 overflow-hidden rounded-[18px] border border-border">
      <div className="bg-surface px-7 py-6">
        <div className="mb-4 inline-flex rounded-lg border border-border bg-white p-0.5">
          {SCENARIOS.map(([name], i) => (
            <button
              key={name.en}
              type="button"
              aria-pressed={scenario === i}
              onClick={() => {
                setScenario(i);
                setAt(0);
              }}
              className={`cursor-pointer rounded-md border-0 px-3 py-1.5 text-[13px] font-medium transition-colors ${scenario === i ? 'bg-ink text-white' : 'bg-transparent text-ink-soft hover:bg-hover'}`}
            >
              {t(name)}
            </button>
          ))}
        </div>
        <p className={`${CAPTION} flex items-center gap-2`}>
          <span className="size-2 animate-pulse-dot rounded-full bg-brand" aria-hidden="true" />
          {t({ en: `Step ${at + 1} of ${STEPS.length}`, es: `Paso ${at + 1} de ${STEPS.length}`, zh: `第 ${at + 1} 步，共 ${STEPS.length} 步` })}
        </p>
        <div key={`${scenario}-${at}`} className="animate-enter">
          <p className="m-0 mt-2 font-display text-xl font-bold tracking-[-0.01em]">{t(step.title)}</p>
          <p className="m-0 mt-1.5 max-w-[760px] text-base leading-[1.6] text-ink-soft">{t(step.text)}</p>
        </div>
        <div className="mt-4 flex flex-wrap gap-4">
          <Screen who="Ana" doc={step.ana} check={step.check} />
          <Screen who="Luis" doc={step.luis} check={step.check} />
        </div>
        <div className="mt-4 rounded-xl bg-[#2f2e2b] px-4 py-3.5 font-code text-[13px] leading-[1.75] text-[#edece8]" aria-live="polite">
          <div className="text-[#a8a49a]">{t({ en: '// the server', es: '// el servidor', zh: '// 服务器' })}</div>
          {step.server.length ? (
            step.server.map((line) => (
              <div key={line} className={`whitespace-pre-wrap ${line.startsWith('digest') ? 'text-[#9ee0b0]' : line.includes('rebased') ? 'text-[#9cc0fa]' : 'text-[#f5c443]'}`}>
                {line}
              </div>
            ))
          ) : (
            <div className="text-[#a8a49a]">{t({ en: 'nothing yet', es: 'nada todavía', zh: '暂无' })}</div>
          )}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={at === 0}
            onClick={() => setAt(at - 1)}
            className="h-9 cursor-pointer rounded-lg border border-border-strong bg-white px-3 text-sm text-ink hover:bg-hover disabled:cursor-default disabled:opacity-40"
          >
            {t({ en: '← Back', es: '← Atrás', zh: '← 上一步' })}
          </button>
          <button
            type="button"
            disabled={at === STEPS.length - 1}
            onClick={() => setAt(at + 1)}
            className="h-9 cursor-pointer rounded-lg border-0 bg-brand px-3.5 text-sm font-semibold text-white hover:bg-brand-hover disabled:cursor-default disabled:opacity-40"
          >
            {t({ en: 'Next →', es: 'Siguiente →', zh: '下一步 →' })}
          </button>
          <span className="ml-auto flex flex-wrap gap-3 text-[13px] text-muted">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-3.5 rounded-[3px] border border-[#e8c66a] bg-pastel-yellow" />
              {t({ en: 'their own change', es: 'su propio cambio', zh: '自己的更改' })}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-3.5 rounded-[3px] border border-[#bfd3f7] bg-pastel-blue" />
              {t({ en: 'arrived from the other', es: 'llegado del otro', zh: '来自对方' })}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
