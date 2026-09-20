export const PNGTUBER_MAX_BYTES = 2 * 1024 * 1024
export const PNGTUBER_MAX_EDGE = 1024

export async function compressAvatarImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) {
    throw new Error('请选择图片文件')
  }

  const bitmap = await createImageBitmap(file)
  try {
    const scale = Math.min(1, PNGTUBER_MAX_EDGE / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('无法压缩图片')
    }
    ctx.drawImage(bitmap, 0, 0, width, height)

    for (const quality of [0.85, 0.7, 0.55]) {
      const blob = await blobFromCanvas(canvas, quality)
      if (blob && blob.size <= PNGTUBER_MAX_BYTES) {
        return new File([blob], 'avatar.webp', { type: 'image/webp' })
      }
      if (blob && quality === 0.55) {
        throw new Error('图片过大，请换一张更简单的立绘')
      }
    }

    throw new Error('无法压缩为 WebP，请换用 Chrome 或 Edge')
  } finally {
    bitmap.close()
  }
}

function blobFromCanvas(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/webp', quality)
  })
}
