'use client';

// The document of a comparison as the editor shows it: what was taken out
// struck through in red, what was put in underlined in green (compareDocs).

import { ADDED_COLOR, type Paragraph, REMOVED_COLOR } from '@rebodocs/core';
import { useT } from '@/components/i18n';

export function Compared({ paragraphs, className = '' }: { paragraphs: Paragraph[]; className?: string }) {
  const t = useT();
  return (
    <div className={className}>
      {paragraphs.map((p, i) => (
        <p key={i} className={`m-0 min-h-[1.5em] ${p.props.styleId === 'Title' ? 'text-[1.25em] font-bold' : ''}`}>
          {p.runs.map((run, k) => {
            const { color, strike, underline, bold } = run.props;
            const kind = strike && color === REMOVED_COLOR ? 'removed' : underline && color === ADDED_COLOR ? 'added' : undefined;
            return (
              <span
                key={k}
                title={kind === 'removed' ? t({ en: 'Taken out', es: 'Quitado', zh: '已删除' }) : kind === 'added' ? t({ en: 'Put in', es: 'Puesto', zh: '已插入' }) : undefined}
                style={kind ? { color: `#${color}` } : undefined}
                className={`${kind === 'removed' ? 'line-through' : kind === 'added' ? 'underline' : ''} ${bold ? 'font-bold' : ''}`}
              >
                {run.text}
              </span>
            );
          })}
        </p>
      ))}
    </div>
  );
}

/** The plain text of paragraphs, one line each. */
export const plain = (paragraphs: Paragraph[]) => paragraphs.map((p) => p.runs.map((run) => run.text).join('')).join('\n');
