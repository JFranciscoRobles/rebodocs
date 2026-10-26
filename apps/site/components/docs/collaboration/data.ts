// What the page "Real-time collaboration" says that is data: the cases of two
// people changing the same thing, some of them set up in the editors of the
// page, and the options and routes of the server. Each text in each language
// of the site.

import { paragraphText } from '@rebodocs/core';
import type { Editor } from '@rebodocs/react';
import type { L } from '@/lib/i18n';

/** The sample in the room, and the words each case acts on, in each language of the site. */
export interface Words {
  /** A title, then the line on payment, the line on late payments, the line on cancelling and the signature. */
  lines: string[];
  /** In the line on payment: the passage taken out, the number in it, and what is written before the number. */
  passage: string;
  days: string;
  about: string;
  /** In the line on late payments: the word typed before, what each writes there, the words formatted, those made bold and the word typed after. */
  fee: string;
  small: string;
  fixed: string;
  late: string;
  lateAdd: string;
  payments: string;
  now: string;
  /** Written before the full stop of the line on late payments, and of the line on cancelling. */
  monthly: string;
  within: string;
  /** The full stop of a line. */
  stop: string;
}

export const WORDS: L<Words> = {
  en: {
    lines: ['Reservation receipt', 'Payment is due within 15 days of this receipt.', 'Late payments add a fee.', 'Either party may cancel in writing.', 'Signed, Ana'],
    passage: ' within 15 days',
    days: '15',
    about: 'about ',
    fee: 'fee',
    small: 'small ',
    fixed: 'fixed ',
    late: 'Late payments',
    lateAdd: 'Late payments add',
    payments: 'payments',
    now: ' now',
    monthly: ' each month',
    within: ' within 7 days',
    stop: '.',
  },
  es: {
    lines: ['Recibo de reservación', 'El pago vence a los 15 días de este recibo.', 'Los pagos tardíos suman un recargo.', 'Cualquiera de las partes puede cancelar por escrito.', 'Firmado, Ana'],
    passage: ' a los 15 días',
    days: '15',
    about: 'unos ',
    fee: 'recargo',
    small: 'pequeño ',
    fixed: 'fijo ',
    late: 'Los pagos tardíos',
    lateAdd: 'Los pagos tardíos suman',
    payments: 'tardíos',
    now: ' ya',
    monthly: ' cada mes',
    within: ' en 7 días',
    stop: '.',
  },
  zh: {
    lines: ['预订收据', '应在本收据开具后 15 天内付款。', '逾期付款将加收费用。', '任何一方均可书面取消。', '签名：Ana'],
    passage: '开具后 15 天内',
    days: '15',
    about: '大约 ',
    fee: '费用',
    small: '少量',
    fixed: '固定',
    late: '逾期付款',
    lateAdd: '逾期付款将加收',
    payments: '付款',
    now: '现在',
    monthly: '（每月）',
    within: '，7 天内有效',
    stop: '。',
  },
};

export interface Scenario {
  key: string;
  title: L;
  /** What each of them does, said for the person. */
  setup: L;
  expect: L;
  ana: (editor: Editor, words: Words) => void;
  luis: (editor: Editor, words: Words) => void;
}

/** Where a text starts in a paragraph of the editor's document; with `end`, where it ends. */
const at = (editor: Editor, para: number, text: string, end = false) => {
  const line = paragraphText(editor.doc.paragraphs[para]);
  const offset = text === '.' || text === '。' ? line.lastIndexOf(text) : line.indexOf(text);
  return { para, offset: offset + (end ? text.length : 0) };
};

// The paragraphs of the sample, from 0: the title, payment, late payments, cancelling, the signature.
export const SCENARIOS: Scenario[] = [
  {
    key: 'same-place',
    title: { en: 'Both type at the same place', es: 'Los dos escriben en el mismo lugar', zh: '两人在同一位置输入' },
    setup: {
      en: 'Ana writes “small ” before “fee”; Luis writes “fixed ” there too.',
      es: 'Ana escribe “pequeño ” antes de “recargo”; Luis escribe “fijo ” ahí también.',
      zh: 'Ana 在“费用”前输入“少量”；Luis 也在那里输入“固定”。',
    },
    expect: { en: 'both texts, the one the server got first before the other.', es: 'los dos textos, primero el que recibió antes el servidor.', zh: '两段文字都保留，服务器先收到的排在前面。' },
    ana: (e, w) => (e.setSelection(at(e, 2, w.fee)), e.insertText(w.small)),
    luis: (e, w) => (e.setSelection(at(e, 2, w.fee)), e.insertText(w.fixed)),
  },
  {
    key: 'delete-passage',
    title: { en: 'One deletes a passage, the other types in it', es: 'Uno borra un pasaje, el otro escribe en él', zh: '一人删除一段文字，另一人在其中输入' },
    setup: {
      en: 'Ana deletes “ within 15 days”; Luis writes “about ” before “15”.',
      es: 'Ana borra “ a los 15 días”; Luis escribe “unos ” antes de “15”.',
      zh: 'Ana 删除“开具后 15 天内”；Luis 在“15”前输入“大约 ”。',
    },
    expect: { en: 'the passage goes, and “about ” stays.', es: 'el pasaje se va, y “unos ” se queda.', zh: '这段文字被删除，“大约 ”保留。' },
    ana: (e, w) => (e.setSelection(at(e, 1, w.passage), at(e, 1, w.passage, true)), e.deleteBackward()),
    luis: (e, w) => (e.setSelection(at(e, 1, w.days)), e.insertText(w.about)),
  },
  {
    key: 'split',
    title: { en: 'One presses Enter, the other types after that place', es: 'Uno pulsa Intro, el otro escribe después de ese lugar', zh: '一人按 Enter，另一人在其后输入' },
    setup: {
      en: 'Ana presses Enter before “fee”; Luis writes “ each month” before the full stop.',
      es: 'Ana pulsa Intro antes de “recargo”; Luis escribe “ cada mes” antes del punto.',
      zh: 'Ana 在“费用”前按 Enter；Luis 在句号前输入“（每月）”。',
    },
    expect: { en: 'the text in the second half.', es: 'el texto en la segunda mitad.', zh: '文字位于后半段中。' },
    ana: (e, w) => (e.setSelection(at(e, 2, w.fee)), e.insertParagraphBreak()),
    luis: (e, w) => (e.setSelection(at(e, 2, w.stop)), e.insertText(w.monthly)),
  },
  {
    key: 'delete-paragraph',
    title: { en: 'One deletes a paragraph, the other types in it', es: 'Uno borra un párrafo, el otro escribe en él', zh: '一人删除一个段落，另一人在其中输入' },
    setup: {
      en: 'Ana deletes the paragraph “Either party may cancel in writing.”; Luis writes “ within 7 days” at its end.',
      es: 'Ana borra el párrafo “Cualquiera de las partes puede cancelar por escrito.”; Luis escribe “ en 7 días” al final.',
      zh: 'Ana 删除段落“任何一方均可书面取消。”；Luis 在它的末尾输入“，7 天内有效”。',
    },
    expect: {
      en: 'its text goes, and what Luis typed stays, in a paragraph of its own with the same formatting.',
      es: 'su texto se va, y lo que escribió Luis se queda, en un párrafo propio con el mismo formato.',
      zh: '段落文字被删除，Luis 输入的内容保留在一个格式相同的独立段落中。',
    },
    ana: (e) => (e.setSelection({ para: 3, offset: 0 }, { para: 4, offset: 0 }), e.deleteBackward()),
    luis: (e, w) => (e.setSelection(at(e, 3, w.stop)), e.insertText(w.within)),
  },
  {
    key: 'format-both',
    title: { en: 'Both format the same passage', es: 'Los dos dan formato al mismo pasaje', zh: '两人设置同一段文字的格式' },
    setup: {
      en: 'Ana makes “Late payments” red; Luis makes it blue.',
      es: 'Ana pone “Los pagos tardíos” en rojo; Luis lo pone en azul.',
      zh: 'Ana 把“逾期付款”设为红色；Luis 把它设为蓝色。',
    },
    expect: {
      en: 'each letter in the colour of the one the server got last.',
      es: 'cada letra en el color del que recibió último el servidor.',
      zh: '每个字都使用服务器最后收到的那个颜色。',
    },
    ana: (e, w) => (e.setSelection(at(e, 2, w.late), at(e, 2, w.late, true)), e.setRunProps({ color: 'C0392B' })),
    luis: (e, w) => (e.setSelection(at(e, 2, w.late), at(e, 2, w.late, true)), e.setRunProps({ color: '1A73E8' })),
  },
  {
    key: 'format-type',
    title: { en: 'One formats a passage, the other types in it', es: 'Uno da formato a un pasaje, el otro escribe en él', zh: '一人设置一段文字的格式，另一人在其中输入' },
    setup: {
      en: 'Ana makes “Late payments add” bold; Luis writes “ now” after “payments”.',
      es: 'Ana pone “Los pagos tardíos suman” en negrita; Luis escribe “ ya” después de “tardíos”.',
      zh: 'Ana 把“逾期付款将加收”设为加粗；Luis 在“付款”后输入“现在”。',
    },
    expect: {
      en: 'what Luis typed stays where it was typed, without the bold; the rest is bold.',
      es: 'lo que escribió Luis se queda donde lo escribió, sin la negrita; el resto está en negrita.',
      zh: 'Luis 输入的内容保留在原处，不加粗；其余部分加粗。',
    },
    ana: (e, w) => (e.setSelection(at(e, 2, w.lateAdd), at(e, 2, w.lateAdd, true)), e.toggleMark('bold')),
    luis: (e, w) => (e.setSelection(at(e, 2, w.payments, true)), e.insertText(w.now)),
  },
];

/** What happens at once, and what everybody ends with: the rules of transform, in changes.ts. */
export const CONFLICTS: [what: L, result: L, scenario?: string][] = [
  [
    { en: 'Both type at the same place.', es: 'Los dos escriben en el mismo lugar.', zh: '两人在同一位置输入。' },
    { en: 'Both texts, the one the server got first before the other.', es: 'Los dos textos, primero el que recibió antes el servidor.', zh: '两段文字都保留，服务器先收到的排在前面。' },
    'same-place',
  ],
  [
    { en: 'One deletes a passage, the other types in the middle of it.', es: 'Uno borra un pasaje, el otro escribe en medio de él.', zh: '一人删除一段文字，另一人在其中间输入。' },
    { en: 'The passage goes, and what was typed in it stays.', es: 'El pasaje se va, y lo que se escribió en él se queda.', zh: '这段文字被删除，其中新输入的内容保留。' },
    'delete-passage',
  ],
  [
    {
      en: 'One splits a paragraph (Enter), the other types after that place.',
      es: 'Uno divide un párrafo (Intro), el otro escribe después de ese lugar.',
      zh: '一人拆分段落（Enter），另一人在拆分处之后输入。',
    },
    { en: 'The text goes into the second half.', es: 'El texto va a la segunda mitad.', zh: '文字进入后半段。' },
    'split',
  ],
  [
    { en: 'One joins two paragraphs, the other types in the second one.', es: 'Uno une dos párrafos, el otro escribe en el segundo.', zh: '一人合并两个段落，另一人在第二段中输入。' },
    { en: 'The text is in the joined paragraph, at the same place in it.', es: 'El texto está en el párrafo unido, en el mismo lugar.', zh: '文字位于合并后的段落中的相同位置。' },
  ],
  [
    { en: 'One formats a paragraph, the other splits it.', es: 'Uno da formato a un párrafo, el otro lo divide.', zh: '一人设置段落格式，另一人拆分该段落。' },
    { en: 'Both halves have the formatting.', es: 'Las dos mitades tienen el formato.', zh: '两半都带有该格式。' },
  ],
  [
    { en: 'Both join the same two paragraphs.', es: 'Los dos unen los mismos dos párrafos.', zh: '两人合并同样的两个段落。' },
    { en: 'One join.', es: 'Una sola unión.', zh: '只合并一次。' },
  ],
  [
    { en: 'One deletes a paragraph, the other types in it.', es: 'Uno borra un párrafo, el otro escribe en él.', zh: '一人删除一个段落，另一人在其中输入。' },
    {
      en: 'The paragraph’s text goes, and what was typed stays where it was, in a paragraph of its own with the same formatting. The one typing goes on typing there, without the caret jumping.',
      es: 'El texto del párrafo se va, y lo que se escribió se queda donde estaba, en un párrafo propio con el mismo formato. Quien escribe sigue escribiendo ahí, sin que el cursor salte.',
      zh: '段落文字被删除，新输入的内容保留在原处，位于格式相同的独立段落中。正在输入的人可以继续在那里输入，光标不会跳动。',
    },
    'delete-paragraph',
  ],
  [
    {
      en: 'One deletes a paragraph, the other only formats its text or presses Enter in it.',
      es: 'Uno borra un párrafo, el otro solo da formato a su texto o pulsa Intro en él.',
      zh: '一人删除一个段落，另一人只是设置其文字格式或在其中按 Enter。',
    },
    { en: 'The paragraph is gone: nothing new was written in it.', es: 'El párrafo desaparece: no se escribió nada nuevo en él.', zh: '段落被删除：其中没有写入新内容。' },
  ],
  [
    {
      en: 'One formats a passage (bold, a colour, a tracked deletion), the other types in it.',
      es: 'Uno da formato a un pasaje (negrita, un color, una eliminación controlada), el otro escribe en él.',
      zh: '一人设置一段文字的格式（加粗、颜色、修订中的删除），另一人在其中输入。',
    },
    {
      en: 'What was typed stays where it was typed, without the formatting; the rest has it.',
      es: 'Lo que se escribió se queda donde se escribió, sin el formato; el resto lo tiene.',
      zh: '新输入的内容保留在原处，不带该格式；其余部分带有该格式。',
    },
    'format-type',
  ],
  [
    { en: 'Both format the same passage.', es: 'Los dos dan formato al mismo pasaje.', zh: '两人设置同一段文字的格式。' },
    { en: 'Each letter has the formatting of the one the server got last.', es: 'Cada letra tiene el formato del que recibió último el servidor.', zh: '每个字都使用服务器最后收到的格式。' },
    'format-both',
  ],
  [
    { en: 'One formats a passage, the other deletes part of it.', es: 'Uno da formato a un pasaje, el otro borra parte de él.', zh: '一人设置一段文字的格式，另一人删除其中一部分。' },
    { en: 'What was deleted is gone; the rest has the formatting.', es: 'Lo borrado desaparece; el resto tiene el formato.', zh: '删除的部分消失；其余部分带有该格式。' },
  ],
  [
    { en: 'Both put new paragraphs after the same one.', es: 'Los dos ponen párrafos nuevos después del mismo.', zh: '两人在同一段之后插入新段落。' },
    { en: 'Both, the ones the server got first before the others.', es: 'Los dos, primero los que recibió antes el servidor.', zh: '都保留，服务器先收到的排在前面。' },
  ],
  [
    { en: 'Both insert a table at the same place.', es: 'Los dos insertan una tabla en el mismo lugar.', zh: '两人在同一位置插入表格。' },
    { en: 'Both tables, one after the other.', es: 'Las dos tablas, una después de la otra.', zh: '两个表格都保留，一个接一个。' },
  ],
  [
    {
      en: 'Both change the shape of the same table, the page setup, the styles or the same comment.',
      es: 'Los dos cambian la forma de la misma tabla, la configuración de página, los estilos o el mismo comentario.',
      zh: '两人修改同一表格的结构、页面设置、样式或同一条批注。',
    },
    {
      en: 'The one the server got last. Cells left without a paragraph, or paragraphs in a cell that went, are mended the same way by everybody.',
      es: 'El que recibió último el servidor. Las celdas que quedan sin párrafo, o los párrafos de una celda que se fue, se arreglan igual para todos.',
      zh: '以服务器最后收到的为准。没有段落的单元格，或位于已删除单元格中的段落，会被所有人以相同方式修复。',
    },
  ],
  [
    { en: 'Both add a picture or a comment.', es: 'Los dos añaden una imagen o un comentario.', zh: '两人都添加图片或批注。' },
    { en: 'Both: their names are made unique before they are sent.', es: 'Los dos: sus nombres se hacen únicos antes de enviarse.', zh: '都保留：发送前会确保它们的名称唯一。' },
  ],
];

/** The options of the command, from packages/collab/src/main.ts. */
export const OPTIONS: [option: string, env: string, text: L][] = [
  ['--backend URL', 'REBODOCS_COLLAB_BACKEND', { en: 'Where documents are read from and saved to.', es: 'De dónde se leen y dónde se guardan los documentos.', zh: '读取和保存文档的地址。' }],
  [
    '--backend-key KEY',
    'REBODOCS_COLLAB_BACKEND_KEY',
    {
      en: 'Sent to your backend as Authorization: Bearer …, and what your backend shows to have someone’s access asked about at once. Put it in the environment, not on the command line.',
      es: 'Se envía a tu backend como Authorization: Bearer …, y es lo que tu backend muestra para que se pregunte en el acto por el acceso de alguien. Ponla en el entorno, no en la línea de comandos.',
      zh: '以 Authorization: Bearer … 发送给你的后端；你的后端出示它，即可要求立即重新核查某人的权限。请放在环境变量中，而不是命令行中。',
    },
  ],
  [
    '--backend-log',
    'REBODOCS_COLLAB_BACKEND_LOG=1',
    {
      en: 'Give your backend every change as it comes, on three more routes, so a server that stops all at once loses none.',
      es: 'Darle a tu backend cada cambio en cuanto llega, por tres rutas más, para que un servidor que se detiene de golpe no pierda ninguno.',
      zh: '通过另外三个路由，把每次更改实时交给你的后端，这样服务器即使突然停止也不会丢失任何更改。',
    },
  ],
  ['--port N', 'REBODOCS_COLLAB_PORT', { en: '7420 by default.', es: '7420 por defecto.', zh: '默认为 7420。' }],
  [
    '--host ADDR',
    '',
    {
      en: 'The address to listen on: this machine alone when left out; 0.0.0.0 lets others in.',
      es: 'La dirección en que escuchar: solo esta máquina si se omite; 0.0.0.0 deja entrar a otras.',
      zh: '监听的地址：省略时只限本机；0.0.0.0 允许其他机器访问。',
    },
  ],
  [
    '--save-after N',
    '',
    {
      en: 'Seconds after the last change that the document is saved. 5 by default.',
      es: 'Segundos tras el último cambio en que se guarda el documento. 5 por defecto.',
      zh: '最后一次更改后多少秒保存文档。默认为 5。',
    },
  ],
  [
    '--save-every N',
    '',
    {
      en: 'The most seconds a room with changes goes without being saved while people keep typing. 30 by default.',
      es: 'El máximo de segundos que una sala con cambios pasa sin guardarse mientras la gente sigue escribiendo. 30 por defecto.',
      zh: '有人持续输入时，有更改的房间最多多少秒不保存。默认为 30。',
    },
  ],
  [
    '--recheck-every N',
    'REBODOCS_COLLAB_RECHECK_EVERY',
    {
      en: 'Seconds between asking /access again whether each person may still be in; whoever it turns away is sent out. Never by default: your backend can ask for it when it changes someone’s access.',
      es: 'Segundos entre volver a preguntar a /access si cada persona puede seguir dentro; a quien rechaza se le expulsa. Nunca por defecto: tu backend puede pedirlo cuando cambia el acceso de alguien.',
      zh: '每隔多少秒再次询问 /access 每个人是否仍可留在房间；被拒绝的人会被移出。默认从不：你的后端可以在修改某人权限时主动要求核查。',
    },
  ],
  [
    '--instance NAME',
    'REBODOCS_COLLAB_INSTANCE',
    {
      en: 'What this process is called among several behind one address: said in X-Rebodocs-Instance on everything it answers, and by /collab/ping.',
      es: 'Cómo se llama este proceso entre varios detrás de una dirección: se dice en X-Rebodocs-Instance en todo lo que responde, y en /collab/ping.',
      zh: '同一地址后面有多个进程时，本进程的名称：会在它的每个响应的 X-Rebodocs-Instance 中以及 /collab/ping 中给出。',
    },
  ],
  [
    '--data DIR',
    '',
    {
      en: 'Without a backend: the folder rooms are kept in, ./rooms when left out.',
      es: 'Sin backend: la carpeta donde se guardan las salas, ./rooms si se omite.',
      zh: '没有后端时：保存房间的文件夹，省略时为 ./rooms。',
    },
  ],
  [
    '--memory',
    '',
    {
      en: 'Without a backend: keep nothing, rooms last as long as the process.',
      es: 'Sin backend: no guardar nada, las salas duran lo que el proceso.',
      zh: '没有后端时：不保存任何内容，房间随进程存在。',
    },
  ],
  [
    '--token WORD',
    'REBODOCS_COLLAB_TOKEN',
    {
      en: 'Without a backend: the word a page must give to start a room.',
      es: 'Sin backend: la palabra que una página debe dar para empezar una sala.',
      zh: '没有后端时：页面创建房间时必须提供的口令。',
    },
  ],
  [
    '--static DIR',
    '',
    {
      en: 'Also serve a built editor from that folder: one address for the page and its rooms.',
      es: 'Servir también un editor compilado desde esa carpeta: una dirección para la página y sus salas.',
      zh: '同时从该文件夹提供构建好的编辑器：页面和房间使用同一个地址。',
    },
  ],
];

/** The three routes of your backend, and when the server calls each. */
export const ROUTES: [route: string, when: L, what: L][] = [
  [
    'GET /docs/<id>',
    { en: 'Someone opens a room nobody is in.', es: 'Alguien abre una sala en la que no hay nadie.', zh: '有人打开一个没有人的房间。' },
    { en: 'Return the DOCX.', es: 'Devuelve el DOCX.', zh: '返回 DOCX。' },
  ],
  [
    'PUT /docs/<id>',
    {
      en: '--save-after seconds after the changes stop (at least every --save-every while they go on), when the last person leaves, on shutdown.',
      es: '--save-after segundos después de que paran los cambios (al menos cada --save-every mientras siguen), cuando sale la última persona, al apagarse.',
      zh: '更改停止 --save-after 秒后（持续更改时至少每 --save-every 秒一次）、最后一人离开时、服务器关闭时。',
    },
    {
      en: 'Store the DOCX in the body. The one when the last person leaves ends a session of work, and says so.',
      es: 'Guarda el DOCX del cuerpo. El de cuando sale la última persona termina una sesión de trabajo, y lo dice.',
      zh: '保存请求体中的 DOCX。最后一人离开时的那次表示一次工作会话结束，并会注明。',
    },
  ],
  [
    'POST /docs/<id>/access',
    {
      en: 'Someone joins, with { "ticket": "…" }; and every --recheck-every seconds while they stay.',
      es: 'Alguien entra, con { "ticket": "…" }; y cada --recheck-every segundos mientras sigue.',
      zh: '有人加入时，附带 { "ticket": "…" }；以及在其停留期间每 --recheck-every 秒一次。',
    },
    {
      en: 'Answer { "name": "Ana" } to let them in under that name, with "readOnly": true to let them only watch, or 403.',
      es: 'Responde { "name": "Ana" } para dejarle entrar con ese nombre, con "readOnly": true para dejarle solo mirar, o 403.',
      zh: '返回 { "name": "Ana" } 以该名字允许进入，加上 "readOnly": true 表示只能查看，或者返回 403。',
    },
  ],
];

/** The routes of your backend for the log, with --backend-log, and when the server calls each. */
export const LOG_ROUTES: [route: string, when: L, what: L][] = [
  [
    'PUT /docs/<id>/changes',
    {
      en: 'A room has its first change, or its changes were folded into a new file while people stay.',
      es: 'Una sala tiene su primer cambio, o sus cambios se plegaron en un archivo nuevo mientras la gente sigue.',
      zh: '房间出现第一次更改，或者在有人时把更改合并进了新文件。',
    },
    {
      en: 'Store the body in place of any log there was: its first line, the file the changes are made to.',
      es: 'Guarda el cuerpo en lugar del registro que hubiera: su primera línea, el archivo al que se aplican los cambios.',
      zh: '用请求体替换原有的日志：第一行是这些更改所基于的文件。',
    },
  ],
  [
    'POST /docs/<id>/changes',
    {
      en: 'Each change, as it comes; what comes while one is on its way goes with the next.',
      es: 'Cada cambio, en cuanto llega; lo que llega mientras uno va en camino va con el siguiente.',
      zh: '每次更改到达时；在一次请求发送途中到达的更改会随下一次发送。',
    },
    {
      en: 'Add the lines of the body after those there are. X-Rebodocs-From says how many came before them: answer 409 when that is not how many you have.',
      es: 'Añade las líneas del cuerpo después de las que hay. X-Rebodocs-From dice cuántas vinieron antes: responde 409 cuando no son las que tienes.',
      zh: '把请求体中的行追加到已有行之后。X-Rebodocs-From 说明之前已有多少行：与你保存的行数不一致时返回 409。',
    },
  ],
  [
    'GET /docs/<id>/changes',
    {
      en: 'Someone opens a room nobody is in, before GET /docs/<id>.',
      es: 'Alguien abre una sala en la que no hay nadie, antes de GET /docs/<id>.',
      zh: '有人打开一个没有人的房间时，在 GET /docs/<id> 之前。',
    },
    { en: 'Return every line as it came, or 404 when there is no log.', es: 'Devuelve cada línea tal como llegó, o 404 cuando no hay registro.', zh: '按原样返回每一行；没有日志时返回 404。' },
  ],
];
