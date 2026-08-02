/** Utility immagini: caricamento, downscale di qualità, comparazione. */

export function loadImage(src: Blob | string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = typeof src === 'string' ? src : URL.createObjectURL(src)
    const img = new Image()
    img.onload = () => {
      if (typeof src !== 'string') URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      if (typeof src !== 'string') URL.revokeObjectURL(url)
      reject(new Error('Immagine non leggibile'))
    }
    img.decoding = 'async'
    img.src = url
  })
}

/**
 * Riduzione progressiva a metà finché non siamo vicini alla dimensione utile.
 *
 * `drawImage` con un fattore di riduzione forte (tipo 5x) fa aliasing brutto:
 * campiona pochi pixel e i capelli diventano un pettine. Dimezzare a più riprese
 * è il modo standard per ottenere un downscale pulito.
 */
export function downscaleFor(
  src: CanvasImageSource,
  srcW: number,
  srcH: number,
  wantedScale: number,
): { source: CanvasImageSource; factor: number } {
  let factor = 1
  let current: CanvasImageSource = src
  let w = srcW
  let h = srcH

  // Ci fermiamo quando la sorgente è al massimo 2x la dimensione che serve.
  while (wantedScale * factor < 0.5 && w > 64 && h > 64) {
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.floor(w / 2))
    canvas.height = Math.max(1, Math.floor(h / 2))
    const ctx = canvas.getContext('2d')
    if (!ctx) break
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(current, 0, 0, canvas.width, canvas.height)
    current = canvas
    w = canvas.width
    h = canvas.height
    factor /= 2
  }

  return { source: current, factor }
}

export function blobToUrl(blob: Blob): string {
  return URL.createObjectURL(blob)
}

export async function canvasToBlob(canvas: HTMLCanvasElement, quality = 0.92): Promise<Blob> {
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', quality))
  if (!blob) throw new Error('Esportazione immagine fallita')
  return blob
}
