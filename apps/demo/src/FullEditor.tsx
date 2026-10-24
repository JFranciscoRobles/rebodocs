import { DocsEditor, type Theme } from '@rebodocs/react';
import { download } from './download';
import { spellcheck } from './spelling';
import './FullEditor.css';

interface Props {
  docx?: Uint8Array;
  name: string;
  /**
   * The editor as it comes ('included': two rows of tools, the panel on the
   * right, the zoom floating, the menu a screen), or set out another way
   * ('another': the tools in tabs, the panel as a rail, the status bar in
   * chips, the menu a card).
   */
  layout?: 'included' | 'another';
  theme?: Theme;
}

export function FullEditor({ docx, name, layout = 'included', theme }: Props) {
  return (
    <div className="fe">
      <div className="fe-frame">
        <DocsEditor
          docx={docx}
          name={name}
          author="Demo"
          locale="en"
          features={
            layout === 'another'
              ? { files: true, language: true, theme: true, forms: true, panelOpen: 'variables', toolbar: 'tabs', panel: 'rail', statusBar: 'chips', menu: 'card' }
              : { files: true, language: true, theme: true, forms: true, panelOpen: 'variables' }
          }
          spellcheck={spellcheck}
          theme={theme}
          onSave={download}
          onError={(message) => console.error(message)}
        />
      </div>
    </div>
  );
}
