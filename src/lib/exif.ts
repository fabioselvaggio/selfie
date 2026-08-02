/**
 * Lettura della data di scatto dai metadati.
 *
 * Parser EXIF minimale scritto a mano invece di tirarci dentro una libreria:
 * ci serve esattamente un campo (DateTimeOriginal) e nient'altro.
 * I formati che non sappiamo leggere (HEIC, PNG, screenshot) ricadono sulla
 * data di modifica del file, che per una foto scaricata dal telefono è quasi
 * sempre quella giusta.
 */

const TAG_DATETIME = 0x0132
const TAG_EXIF_IFD = 0x8769
const TAG_DATETIME_ORIGINAL = 0x9003
const TAG_DATETIME_DIGITIZED = 0x9004

/** "2026:07:13 08:41:02" → Date locale. */
function parseExifDate(raw: string): Date | null {
  const m = raw.trim().match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/)
  if (!m) return null
  const [, y, mo, d, h, mi, s] = m
  const date = new Date(+y, +mo - 1, +d, +h, +mi, +s)
  return Number.isNaN(date.getTime()) ? null : date
}

function readAscii(view: DataView, offset: number, length: number): string {
  let out = ''
  for (let i = 0; i < length; i++) {
    const c = view.getUint8(offset + i)
    if (c === 0) break
    out += String.fromCharCode(c)
  }
  return out
}

interface IfdWalk {
  dates: Partial<Record<number, string>>
  exifIfdOffset: number | null
}

function walkIfd(view: DataView, tiffStart: number, ifdOffset: number, le: boolean): IfdWalk {
  const out: IfdWalk = { dates: {}, exifIfdOffset: null }
  const base = tiffStart + ifdOffset
  if (base + 2 > view.byteLength) return out

  const count = view.getUint16(base, le)
  for (let i = 0; i < count; i++) {
    const entry = base + 2 + i * 12
    if (entry + 12 > view.byteLength) break

    const tag = view.getUint16(entry, le)
    const type = view.getUint16(entry + 2, le)
    const numValues = view.getUint32(entry + 4, le)

    if (tag === TAG_EXIF_IFD) {
      out.exifIfdOffset = view.getUint32(entry + 8, le)
      continue
    }
    if (tag !== TAG_DATETIME && tag !== TAG_DATETIME_ORIGINAL && tag !== TAG_DATETIME_DIGITIZED) {
      continue
    }
    if (type !== 2) continue // ASCII

    // I valori ASCII di 20 byte non stanno mai inline: c'è sempre un puntatore.
    const valueOffset = numValues > 4 ? tiffStart + view.getUint32(entry + 8, le) : entry + 8
    if (valueOffset + Math.min(numValues, 24) > view.byteLength) continue
    out.dates[tag] = readAscii(view, valueOffset, Math.min(numValues, 24))
  }
  return out
}

function parseJpegExif(buffer: ArrayBuffer): Date | null {
  const view = new DataView(buffer)
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null

  let offset = 2
  while (offset + 4 < view.byteLength) {
    if (view.getUint8(offset) !== 0xff) {
      offset++
      continue
    }
    const marker = view.getUint8(offset + 1)
    // SOS: da qui in poi sono dati compressi, l'EXIF non c'è più.
    if (marker === 0xda) return null
    const size = view.getUint16(offset + 2)
    if (size < 2) return null

    if (marker === 0xe1 && offset + 10 < view.byteLength) {
      if (readAscii(view, offset + 4, 4) === 'Exif') {
        const tiffStart = offset + 10
        if (tiffStart + 8 > view.byteLength) return null
        const endian = view.getUint16(tiffStart)
        if (endian !== 0x4949 && endian !== 0x4d4d) return null
        const le = endian === 0x4949
        const ifd0 = view.getUint32(tiffStart + 4, le)

        const root = walkIfd(view, tiffStart, ifd0, le)
        const merged = { ...root.dates }
        if (root.exifIfdOffset != null) {
          Object.assign(merged, walkIfd(view, tiffStart, root.exifIfdOffset, le).dates)
        }

        const raw =
          merged[TAG_DATETIME_ORIGINAL] ?? merged[TAG_DATETIME_DIGITIZED] ?? merged[TAG_DATETIME]
        return raw ? parseExifDate(raw) : null
      }
    }
    offset += 2 + size
  }
  return null
}

export interface CaptureDate {
  date: Date
  /** Da dove viene: cambia quanto ci fidiamo, e lo mostriamo nell'import. */
  source: 'exif' | 'file'
}

/** Data di scatto di una foto: EXIF se c'è, altrimenti data del file. */
export async function readCaptureDate(file: File): Promise<CaptureDate> {
  try {
    // L'EXIF sta all'inizio del file: bastano i primi 256 KB.
    const head = await file.slice(0, 256 * 1024).arrayBuffer()
    const exif = parseJpegExif(head)
    if (exif) return { date: exif, source: 'exif' }
  } catch {
    /* file illeggibile o troncato: si ripiega sotto */
  }
  return { date: new Date(file.lastModified || Date.now()), source: 'file' }
}
