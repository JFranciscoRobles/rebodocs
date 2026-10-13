const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

/** Hands a file to the person as a download. */
export function saveFile(data: BlobPart, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

// There is no backend here: saving hands the DOCX back as a download.
export function download(docx: Uint8Array, name: string) {
  saveFile(docx as BlobPart, name.endsWith('.docx') ? name : `${name}.docx`, DOCX)
}
