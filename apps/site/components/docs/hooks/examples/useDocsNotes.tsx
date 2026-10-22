'use client';

import { NOTE_COLORS, useDocsNotes } from '@rebodocs/react';

function Notes() {
  const notes = useDocsNotes();
  return (
    <div className="grid gap-2">
      <button className="rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-sm" onClick={() => notes.add('Check this')}>
        Note on the selection
      </button>
      {notes.notes.map((note) => (
        <article key={note.id} className="grid gap-1.5 rounded-md border border-neutral-200 p-2" style={{ borderLeft: `4px solid #${note.color}` }}>
          <button className="truncate text-left text-xs text-neutral-600" onClick={() => notes.select(note.id)}>“{note.excerpt}”</button>
          <textarea aria-label="Note" className="rounded border border-neutral-300 p-1 text-sm" value={note.text} onChange={(e) => notes.setText(note.id, e.target.value)} />
          <div className="flex gap-1">
            {NOTE_COLORS.map((color) => (
              <button key={color} aria-label={`#${color}`} className="size-5 rounded-full" style={{ background: `#${color}` }} onClick={() => notes.setColor(note.id, color)} />
            ))}
            <button className="ml-auto text-xs text-red-700" onClick={() => notes.remove(note.id)}>Delete</button>
          </div>
        </article>
      ))}
    </div>
  );
}

// ---- On this page ----

export default function Example() {
  return <Notes />;
}
