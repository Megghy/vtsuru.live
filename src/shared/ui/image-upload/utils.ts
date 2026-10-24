import type { LocalUploadImageItem, RemoteImageSource, RemoteUploadImageItem, UploadImageItem } from './types'

const IMAGE_EXTENSION_REGEX = /\.(png|jpe?g|gif|svg|webp|bmp|ico|tiff?|avif|apng|heic|heif)$/i

const previewPool = new Map<File, { url: string; refs: number }>()
let localIdSeed = 0

export function acquireFilePreviewUrl(file: File): string {
  const existing = previewPool.get(file)
  if (existing) {
    existing.refs += 1
    return existing.url
  }
  const url = URL.createObjectURL(file)
  previewPool.set(file, { url, refs: 1 })
  return url
}

export function peekFilePreviewUrl(file: File): string | undefined {
  return previewPool.get(file)?.url
}

export function releaseFilePreviewUrl(file: File): void {
  const existing = previewPool.get(file)
  if (!existing) return
  existing.refs -= 1
  if (existing.refs <= 0) {
    previewPool.delete(file)
    URL.revokeObjectURL(existing.url)
  }
}

export function fromRemoteImage(source?: RemoteImageSource | null, fallbackName = '图片'): RemoteUploadImageItem | null {
  if (!source?.path) return null
  const rawName = source.name || fallbackName
  const name = IMAGE_EXTENSION_REGEX.test(rawName) ? rawName : `${rawName}.png`
  return {
    kind: 'remote',
    id: source.id != null && source.id !== '' ? String(source.id) : `remote_${Date.now()}`,
    name,
    url: source.path,
  }
}

export function fromRemoteImageList(
  files?: readonly (RemoteImageSource | null | undefined)[] | null,
  fallbackName = '图片',
): RemoteUploadImageItem[] {
  if (!files || !Array.isArray(files)) return []
  return files
    .map((file) => fromRemoteImage(file, fallbackName))
    .filter((item): item is RemoteUploadImageItem => item !== null)
}

export function createLocalImageItem(file: File, url = ''): LocalUploadImageItem {
  localIdSeed += 1
  return {
    kind: 'local',
    id: `local_${Date.now()}_${localIdSeed}`,
    name: file.name,
    file,
    url,
  }
}

export function getPendingUploadFiles(items?: readonly UploadImageItem[] | null): File[] {
  if (!items?.length) return []
  return items.filter((item): item is LocalUploadImageItem => item.kind === 'local').map((item) => item.file)
}
