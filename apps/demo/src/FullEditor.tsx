import { DocsEditor } from '@rebodocs/react'
import { download } from './download'

interface Props {
  docx?: Uint8Array
  name: string
}

export function FullEditor({ docx, name }: Props) {
  return (
    <DocsEditor
      className="fill"
      docx={docx}
      name={name}
      author="Demo"
      locale="es"
      features={{ files: true, language: true }}
      onSave={download}
      onError={(message) => console.error(message)}
    />
  )
}
