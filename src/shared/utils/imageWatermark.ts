type LoadedImageSource = {
  source: CanvasImageSource
  width: number
  height: number
  close: () => void
}

const WATERMARK_TEXT = 'vtsuru.live'

export async function addVtsuruLiveWatermark(file: File): Promise<File> {
  const image = await loadImageSource(file)
  try {
    const canvas = document.createElement('canvas')
    canvas.width = image.width
    canvas.height = image.height

    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas is not available')

    ctx.drawImage(image.source, 0, 0, image.width, image.height)
    drawFullImageWatermark(ctx, image.width, image.height)

    const output = getOutputFormat(file.type)
    const blob = await canvasToBlob(canvas, output.type, output.quality)

    return new File(
      [blob],
      getWatermarkedFileName(file.name, output.extension),
      { type: output.type, lastModified: file.lastModified },
    )
  } finally {
    image.close()
  }
}

async function loadImageSource(file: File): Promise<LoadedImageSource> {
  if (globalThis.createImageBitmap) {
    try {
      const bitmap = await createImageBitmap(file)
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        close: () => bitmap.close(),
      }
    } catch {
      return loadHtmlImage(file)
    }
  }

  return loadHtmlImage(file)
}

async function loadHtmlImage(file: File): Promise<LoadedImageSource> {
  const url = URL.createObjectURL(file)
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to decode image'))
    img.src = url
  })

  return {
    source: image,
    width: image.naturalWidth,
    height: image.naturalHeight,
    close: () => URL.revokeObjectURL(url),
  }
}

function drawFullImageWatermark(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const minSide = Math.max(1, Math.min(width, height))
  const fontSize = clamp(Math.round(minSide * 0.08), 18, 54)
  const diagonal = Math.hypot(width, height)
  const xStep = fontSize * 7
  const yStep = fontSize * 4

  ctx.save()
  ctx.translate(width / 2, height / 2)
  ctx.rotate(-Math.PI / 6)
  ctx.font = `700 ${fontSize}px "Segoe UI", Arial, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineWidth = Math.max(1, fontSize * 0.08)
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)'
  ctx.fillStyle = 'rgba(255, 255, 255, 0.28)'

  let row = 0
  for (let y = -diagonal; y <= diagonal; y += yStep) {
    const rowOffset = row % 2 === 0 ? 0 : xStep / 2
    for (let x = -diagonal; x <= diagonal; x += xStep) {
      ctx.strokeText(WATERMARK_TEXT, x + rowOffset, y)
      ctx.fillText(WATERMARK_TEXT, x + rowOffset, y)
    }
    row++
  }

  ctx.restore()
}

function getOutputFormat(inputType: string) {
  if (inputType === 'image/jpeg') return { type: 'image/jpeg', extension: 'jpg', quality: 0.92 }
  if (inputType === 'image/webp') return { type: 'image/webp', extension: 'webp', quality: 0.92 }
  return { type: 'image/png', extension: 'png' }
}

async function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, type, quality))
  if (!blob) throw new Error('Failed to export image')
  return blob
}

function getWatermarkedFileName(name: string, extension: string) {
  const baseName = name.replace(/\.[^.]+$/, '') || 'cover'
  return `${baseName}-watermarked.${extension}`
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
