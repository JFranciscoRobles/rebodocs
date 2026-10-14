import { useEffect, useReducer, useRef, useState } from 'react'
import { type AssistantChat, type Editor, createAssistantChat } from '@rebodocs/react'

/** Things to ask, to start with. */
const IDEAS = [
  'What is this document about?',
  'Translate the whole document into English, keeping its format.',
  'Put the obligations of each party side by side, in two columns with a line between them.',
  'Make the payment table repeat its heading row and center the amounts.',
]

/** What a tool did, said the way a person would. */
const TOOL_NAMES: Record<string, string> = {
  get_overview: 'Read the outline',
  read_document: 'Read the text',
  read_formatting: 'Read the formatting',
  find_text: 'Searched',
  replace_text: 'Replaced text',
  rewrite_paragraph: 'Rewrote a paragraph',
  insert_paragraphs: 'Added paragraphs',
  delete_paragraphs: 'Deleted paragraphs',
  format_text: 'Formatted text',
  format_paragraphs: 'Formatted paragraphs',
  set_style: 'Set a style',
  set_list: 'Made a list',
  edit_table: 'Changed a table',
  insert_table: 'Added a table',
  set_columns: 'Set columns',
  set_page_setup: 'Changed the page',
  fill_variables: 'Filled the variables',
  add_note: 'Added a comment',
}

/** The chat beside the document: one conversation for the editor open, a new one for another document. */
export function Chat({ editor }: { editor: Editor | undefined }) {
  const [, redraw] = useReducer((n: number) => n + 1, 0)
  const [chat, setChat] = useState<AssistantChat>()
  const [text, setText] = useState('')
  const list = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setChat(editor ? createAssistantChat(editor, { onChange: redraw }) : undefined)
  }, [editor])

  // The newest at the bottom, in view.
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight })
  })

  const ask = (question: string) => {
    if (!chat || chat.busy || !question.trim()) return
    setText('')
    void chat.send(question)
  }

  return (
    <aside className="chat">
      <header>
        <strong>Claude</strong>
        <button disabled={!chat || chat.busy || !chat.entries.length} onClick={() => chat?.clear()} title="Start a new conversation">New chat</button>
      </header>
      <div className="entries" ref={list}>
        {!chat && <p className="quiet">Open a document to talk about it.</p>}
        {chat && !chat.entries.length && (
          <div className="ideas">
            <p className="quiet">Ask for something to be done to the document. For example:</p>
            {IDEAS.map((idea) => (
              <button key={idea} onClick={() => ask(idea)}>{idea}</button>
            ))}
          </div>
        )}
        {chat?.entries.map((entry, index) =>
          entry.kind === 'tool' ? (
            <div key={index} className={`tool ${entry.ok === false ? 'bad' : entry.ok ? 'ok' : 'running'}`} title={entry.text}>
              {entry.ok === undefined ? '…' : entry.ok ? '✓' : '✗'} {TOOL_NAMES[entry.name] ?? entry.name}
            </div>
          ) : (
            <div key={index} className={`entry ${entry.kind === 'note' ? `notice${entry.bad ? ' bad' : ''}` : entry.kind}`}>{entry.text}</div>
          ),
        )}
        {chat?.busy && chat.entries.at(-1)?.kind !== 'assistant' && <div className="entry thinking quiet">Working…</div>}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          ask(text)
        }}
      >
        <textarea
          value={text}
          disabled={!chat}
          placeholder={chat ? 'Ask Claude to change the document…' : ''}
          rows={3}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              ask(text)
            }
          }}
        />
        {chat?.busy ? (
          <button type="button" onClick={() => chat.stop()}>Stop</button>
        ) : (
          <button type="submit" className="primary" disabled={!chat || !text.trim()}>Send</button>
        )}
      </form>
    </aside>
  )
}
