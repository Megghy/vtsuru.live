export async function svgUrlToPngBase64(svgUrl: string, size = 128): Promise<string> {
  const svgText = await fetch(svgUrl).then(async (r) => {
    if (!r.ok) {
      throw new Error(`加载 SVG 失败: ${r.status} ${r.statusText}`)
    }
    return r.text()
  })

  const svgBlob = new Blob([svgText], { type: 'image/svg+xml' })
  const svgObjectUrl = URL.createObjectURL(svgBlob)
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('SVG 转 Image 失败'))
    image.src = svgObjectUrl
  }).finally(() => {
    URL.revokeObjectURL(svgObjectUrl)
  })

  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Canvas 不支持 2D context')
  }
  ctx.clearRect(0, 0, size, size)
  ctx.drawImage(img, 0, 0, size, size)

  const dataUrl = canvas.toDataURL('image/png')
  const prefix = 'data:image/png;base64,'
  if (!dataUrl.startsWith(prefix)) {
    throw new Error('导出 PNG base64 失败')
  }
  return dataUrl.slice(prefix.length)
}
