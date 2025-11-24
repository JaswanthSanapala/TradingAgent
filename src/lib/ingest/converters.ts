import { fileTypeFromBuffer } from 'file-type'

export type ConvertOptions = {
  useOcr?: boolean
}

export type ConvertResult = {
  text: string
  detected: { mime?: string | null; ext?: string | null }
  provenance: { tool: string; notes?: string }
}

function isTextLikeMime(mime?: string | null): boolean {
  if (!mime) return false
  return (
    mime.startsWith('text/') ||
    mime === 'application/json' ||
    mime === 'application/javascript' ||
    mime === 'application/xml'
  )
}

function decodeUtf8(buf: Buffer): string {
  return buf.toString('utf-8')
}

async function convertPdf(buf: Buffer): Promise<ConvertResult> {
  try {
    // Lazy import to keep optional dependency
    const mod: any = await import('pdf-parse')
    const pdfParse = mod?.default ?? mod
    const res = await pdfParse(buf)
    return { text: res.text || '', detected: { mime: 'application/pdf', ext: 'pdf' }, provenance: { tool: 'pdf-parse' } }
  } catch (e: any) {
    throw new Error(`PDF conversion failed. Please install pdf-parse. ${e?.message || ''}`)
  }
}

async function convertDocx(buf: Buffer): Promise<ConvertResult> {
  try {
    const mammoth = await import('mammoth') as any
    const res = await (mammoth as any).extractRawText({ buffer: buf })
    return { text: res.value || '', detected: { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ext: 'docx' }, provenance: { tool: 'mammoth' } }
  } catch (e: any) {
    throw new Error(`DOCX conversion failed. Please install mammoth. ${e?.message || ''}`)
  }
}

export async function convertFileToText(params: {
  buffer: Buffer
  fileName?: string
  mimeType?: string | null
  options?: ConvertOptions
}): Promise<ConvertResult> {
  const { buffer, fileName, mimeType } = params

  // Detect type
  const ft = await fileTypeFromBuffer(buffer).catch(() => null)
  const ext = (fileName || '').split('.').pop()?.toLowerCase() || ft?.ext || null
  const mime = mimeType || ft?.mime || null

  // Simple cases
  if (ext === 'md' || ext === 'txt' || isTextLikeMime(mime)) {
    return { text: decodeUtf8(buffer), detected: { mime, ext }, provenance: { tool: 'utf-8' } }
  }

  // PDFs
  if (ext === 'pdf' || mime === 'application/pdf') {
    return await convertPdf(buffer)
  }

  // DOCX
  if (ext === 'docx' || mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return await convertDocx(buffer)
  }

  // Images (Phase 1: no OCR — return error with guidance)
  if (mime && mime.startsWith('image/')) {
    if (params.options?.useOcr) {
      try {
        const tesseractMod: any = await import('tesseract.js')
        const { data } = await tesseractMod.recognize(buffer, 'eng')
        const text = (data?.text || '').trim()
        return { text, detected: { mime, ext }, provenance: { tool: 'tesseract.js', notes: 'OCR image -> text' } }
      } catch (e: any) {
        throw new Error(`OCR failed. Please ensure 'tesseract.js' is installed. ${e?.message || ''}`)
      }
    }
    throw new Error('Image provided but OCR is disabled. Enable OCR or upload PDF/DOCX/MD/TXT.')
  }

  // Fallback: try interpret as utf-8 text
  return { text: decodeUtf8(buffer), detected: { mime, ext }, provenance: { tool: 'utf-8-fallback', notes: 'Unknown type; decoded as UTF-8' } }
}
