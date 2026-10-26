'use client';

// Paragraphs with tracked changes as the editor shows them: put in underlined,
// taken out struck through, each in the colour of who made it (shownRevision).

import { type Paragraph, revisionColor } from '@rebodocs/core';
import { useT } from '@/components/i18n';

export function Tracked({ paragraphs, className = '' }: { paragraphs: Paragraph[]; className?: string }) {
  const t = useT();
  return (
    <div className={className}>
      {paragraphs.map((p, i) => (
        <p key={i} className="m-0 min-h-[1.5em]">
          {p.runs.map((run, k) =>
            run.props.revision ? (
              <span
                key={k}
                title={
                  run.props.revision === 'insert'
                    ? t({ en: `Put in by ${run.props.revisionAuthor ?? ''}`, es: `Puesto por ${run.props.revisionAuthor ?? ''}`, zh: `由 ${run.props.revisionAuthor ?? ''} 插入` })
                    : t({ en: `Taken out by ${run.props.revisionAuthor ?? ''}`, es: `Quitado por ${run.props.revisionAuthor ?? ''}`, zh: `由 ${run.props.revisionAuthor ?? ''} 删除` })
                }
                style={{ color: `#${revisionColor(run.props.revisionAuthor ?? '')}` }}
                className={run.props.revision === 'insert' ? 'underline' : 'line-through'}
              >
                {run.text}
              </span>
            ) : (
              <span key={k}>{run.text}</span>
            ),
          )}
          {p.props.markRevision && (
            <span
              style={{ color: `#${revisionColor(p.props.markAuthor ?? '')}` }}
              className={p.props.markRevision === 'insert' ? 'underline' : 'line-through'}
              title={t({ en: 'A paragraph mark', es: 'Una marca de párrafo', zh: '段落标记' })}
            >
              ¶
            </span>
          )}
        </p>
      ))}
    </div>
  );
}

/** The plain text of paragraphs, one line each. */
export const plain = (paragraphs: Paragraph[]) => paragraphs.map((p) => p.runs.map((run) => run.text).join('')).join('\n');
