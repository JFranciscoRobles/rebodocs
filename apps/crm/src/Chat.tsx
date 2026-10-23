import { type AssistantChat, type Editor, createAssistantChat } from '@rebodocs/react';
import { useEffect, useReducer, useRef, useState } from 'react';
import type { Property } from './data';

/** Things to ask, to start with: what a team does to a contract. */
const IDEAS = [
  'Cambia la vigencia de las propuestas a 72 horas.',
  'Revisa el contrato y deja notas donde falte información o algo no cuadre.',
  'Agrega una cláusula de confidencialidad después de la sexta, con el mismo formato.',
  'Resume en cinco puntos lo que se obliga a hacer el propietario.',
];

/** What a tool did, said the way a person would. */
const TOOLS: Record<string, string> = {
  get_overview: 'Leyó el esquema',
  read_document: 'Leyó el contrato',
  read_formatting: 'Revisó el formato',
  find_text: 'Buscó en el contrato',
  replace_text: 'Cambió un texto',
  rewrite_paragraph: 'Reescribió un párrafo',
  insert_paragraphs: 'Agregó párrafos',
  delete_paragraphs: 'Quitó párrafos',
  format_text: 'Dio formato al texto',
  format_paragraphs: 'Dio formato a párrafos',
  set_style: 'Cambió un estilo',
  set_list: 'Hizo una lista',
  edit_table: 'Cambió una tabla',
  insert_table: 'Agregó una tabla',
  fill_variables: 'Llenó variables',
  add_note: 'Dejó una nota',
  track_changes: 'Control de cambios',
  list_changes: 'Revisó los cambios',
};

/** What the server says when something is missing, in the language of the page. */
const said = (text: string) => (text.includes('ANTHROPIC_API_KEY') ? 'El asistente no tiene clave de la API: ponla en apps/crm/.env (ANTHROPIC_API_KEY) y vuelve a arrancar el demo.' : text);

/** The assistant beside the document: one conversation for the document open. */
export function Chat({ editor, property, close }: { editor: Editor | undefined; property: Property; close: () => void }) {
  const [, redraw] = useReducer((n: number) => n + 1, 0);
  const [chat, setChat] = useState<AssistantChat>();
  const [text, setText] = useState('');
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setChat(editor ? createAssistantChat(editor, { onChange: redraw }) : undefined);
  }, [editor]);

  // The newest at the bottom, in view.
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  });

  const ask = (question: string) => {
    if (!chat || chat.busy || !question.trim()) return;
    setText('');
    void chat.send(question);
  };

  return (
    <aside className="crm-chat" aria-label="Asistente">
      <header>
        <span className="crm-spark" aria-hidden="true">
          ✦
        </span>
        <strong>Asistente</strong>
        <button className="crm-ghost" disabled={!chat || chat.busy || !chat.entries.length} onClick={() => chat?.clear()}>
          Nueva
        </button>
        <button className="crm-ghost" aria-label="Cerrar el asistente" onClick={close}>
          ✕
        </button>
      </header>
      <div className="crm-chat-entries" ref={list} aria-live="polite">
        {chat && !chat.entries.length && (
          <div className="crm-ideas">
            <p className="crm-quiet">Pídele algo sobre el contrato de {property.title.toLowerCase()}. Por ejemplo:</p>
            {IDEAS.map((idea) => (
              <button key={idea} onClick={() => ask(idea)}>
                {idea}
              </button>
            ))}
            <p className="crm-quiet crm-small">Lo que cambia se ve en el documento, se puede deshacer y, con el control de cambios, queda marcado para aprobarse.</p>
          </div>
        )}
        {chat?.entries.map((entry, index) =>
          entry.kind === 'tool' ? (
            <div key={index} className={`crm-tool ${entry.ok === false ? 'bad' : entry.ok ? 'ok' : ''}`} title={entry.text}>
              {entry.ok === undefined ? '…' : entry.ok ? '✓' : '✗'} {TOOLS[entry.name] ?? entry.name}
            </div>
          ) : (
            <div key={index} className={`crm-entry ${entry.kind === 'note' ? `notice${entry.bad ? ' bad' : ''}` : entry.kind}`}>
              {entry.kind === 'note' ? said(entry.text) : entry.text}
            </div>
          ),
        )}
        {chat?.busy && chat.entries.at(-1)?.kind !== 'assistant' && <div className="crm-entry notice">Trabajando…</div>}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(text);
        }}
      >
        <textarea
          value={text}
          disabled={!chat}
          placeholder="Pide un cambio al documento…"
          aria-label="Mensaje para el asistente"
          rows={2}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              ask(text);
            }
          }}
        />
        {chat?.busy ? (
          <button type="button" className="crm-ghost" onClick={() => chat.stop()}>
            Detener
          </button>
        ) : (
          <button type="submit" className="crm-primary" disabled={!chat || !text.trim()}>
            Enviar
          </button>
        )}
      </form>
    </aside>
  );
}
