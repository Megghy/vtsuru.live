import { converter, formatHex, parse } from 'culori'

const toHsl = converter('hsl')
const toRgb = converter('rgb')

export interface ExtractedThemePalette {
  primaryColor: string
  backgroundColorLight: string
  backgroundColorDark: string
  textColorLight: string
  textColorDark: string
  suggestedMode: 'light' | 'dark'
  swatches: string[]
}

interface ColorBucket {
  rSum: number
  gSum: number
  bSum: number
  weight: number
  count: number
}

/**
 * 纯前端从图像中提取主题色板（基于 Canvas 离线像素采样与色相聚类）
 */
export async function extractThemeFromImage(imageUrl: string): Promise<ExtractedThemePalette> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('色彩提取仅支持在浏览器环境中运行')
  }

  const image = await loadImage(imageUrl)
  const canvas = document.createElement('canvas')
  const size = 64
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d', { willReadFrequently: true })

  if (!ctx) {
    throw new Error('无法创建 Canvas 上下文进行色彩分析')
  }

  ctx.drawImage(image, 0, 0, size, size)
  let imageData: ImageData
  try {
    imageData = ctx.getImageData(0, 0, size, size)
  } catch {
    throw new Error('图片受跨域安全限制，无法读取像素。请尝试直接上传图片文件')
  }

  const data = imageData.data
  const bucketCount = 24
  const buckets: ColorBucket[] = Array.from({ length: bucketCount }, () => ({
    rSum: 0,
    gSum: 0,
    bSum: 0,
    weight: 0,
    count: 0,
  }))

  let totalR = 0
  let totalG = 0
  let totalB = 0
  let totalValidPixels = 0
  let totalLuminance = 0

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3]
    if (a < 128) continue

    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]

    const hsl = toHsl({ mode: 'rgb', r: r / 255, g: g / 255, b: b / 255 })
    if (!hsl) continue

    const s = hsl.s ?? 0
    const l = hsl.l ?? 0

    totalR += r
    totalG += g
    totalB += b
    totalValidPixels++
    totalLuminance += l

    // 过滤极黑、极白和纯杂灰，保留具有代表性的色彩
    if (l < 0.1 || l > 0.92 || s < 0.16) continue

    const h = (hsl.h ?? 0) % 360
    const bucketIndex = Math.min(Math.floor((h / 360) * bucketCount), bucketCount - 1)
    const weight = s * s * (1 - Math.abs(l - 0.5) * 1.2)

    const bucket = buckets[bucketIndex]
    bucket.rSum += r * weight
    bucket.gSum += g * weight
    bucket.bSum += b * weight
    bucket.weight += weight
    bucket.count++
  }

  // 排序挑选权重最高的色相桶
  const validBuckets = buckets.filter((b) => b.weight > 0).toSorted((a, b) => b.weight - a.weight)

  let primaryColorHex: string
  const swatches: string[] = []

  if (validBuckets.length > 0) {
    const best = validBuckets[0]
    const bestR = Math.round(best.rSum / best.weight)
    const bestG = Math.round(best.gSum / best.weight)
    const bestB = Math.round(best.bSum / best.weight)
    primaryColorHex = formatHex({ mode: 'rgb', r: bestR / 255, g: bestG / 255, b: bestB / 255 })

    for (const b of validBuckets.slice(0, 5)) {
      const hex = formatHex({
        mode: 'rgb',
        r: Math.round(b.rSum / b.weight) / 255,
        g: Math.round(b.gSum / b.weight) / 255,
        b: Math.round(b.bSum / b.weight) / 255,
      })
      if (!swatches.includes(hex)) swatches.push(hex)
    }
  } else {
    // 降级兜底：整图为低饱和度或单色
    const avgR = totalValidPixels ? Math.round(totalR / totalValidPixels) : 128
    const avgG = totalValidPixels ? Math.round(totalG / totalValidPixels) : 128
    const avgB = totalValidPixels ? Math.round(totalB / totalValidPixels) : 128
    primaryColorHex = formatHex({ mode: 'rgb', r: avgR / 255, g: avgG / 255, b: avgB / 255 })
    swatches.push(primaryColorHex)
  }

  // 从主色提取色相，生成低饱和、舒适的浅色底色与深色底色
  const primaryHsl = toHsl(parse(primaryColorHex) ?? { mode: 'rgb', r: 0.2, g: 0.5, b: 0.8 })
  const baseH = primaryHsl?.h ?? 210

  const backgroundColorLight = formatHex(toRgb({ mode: 'hsl', h: baseH, s: 0.12, l: 0.98 }))
  const backgroundColorDark = formatHex(toRgb({ mode: 'hsl', h: baseH, s: 0.18, l: 0.08 }))

  const avgLum = totalValidPixels ? totalLuminance / totalValidPixels : 0.5
  const suggestedMode = avgLum < 0.45 ? 'dark' : 'light'

  return {
    primaryColor: primaryColorHex,
    backgroundColorLight,
    backgroundColorDark,
    textColorLight: '#09090b',
    textColorDark: '#f4f4f5',
    suggestedMode,
    swatches,
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.decoding = 'async'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('图片加载失败，请检查网络或图片有效性'))
    img.src = url
  })
}
