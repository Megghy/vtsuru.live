import type { UploadFileInfo } from 'naive-ui'

export interface UploadSourceFile {
  id?: number | string | null
  name?: string | null
  path?: string | null
}

const IMAGE_EXTENSION_REGEX = /\.(png|jpe?g|gif|svg|webp|bmp|ico)$/i

export function toImageUploadFileInfo(source?: UploadSourceFile | null, fallbackName = '图片'): UploadFileInfo | null {
  if (!source?.path) return null
  const rawName = source.name || fallbackName
  const hasExt = IMAGE_EXTENSION_REGEX.test(rawName)
  const name = hasExt ? rawName : `${rawName}.png`
  return {
    id: source.id ? String(source.id) : String(Date.now()),
    name,
    status: 'finished',
    url: source.path,
    thumbnailUrl: source.path,
    type: 'image/png',
  }
}

export function toImageUploadFileList(
  files?: (UploadSourceFile | null | undefined)[] | null,
  fallbackName = '图片',
): UploadFileInfo[] {
  if (!files || !Array.isArray(files)) return []
  return files
    .map((file) => toImageUploadFileInfo(file, fallbackName))
    .filter((item): item is UploadFileInfo => item !== null)
}
