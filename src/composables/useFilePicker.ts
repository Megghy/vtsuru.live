import { useDropZone, useFileDialog } from '@vueuse/core'
import type { MaybeRefOrGetter } from 'vue'
import { ref } from 'vue'
import { toast } from 'vue-sonner'

const IMAGE_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.webp',
  '.ico',
  '.bmp',
  '.tiff',
  '.tif',
  '.avif',
  '.apng',
  '.heic',
  '.heif',
])

const MIME_EXTENSION_ALIASES: Record<string, readonly string[]> = {
  'application/json': ['.json'],
  'text/csv': ['.csv'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/gif': ['.gif'],
  'image/svg+xml': ['.svg'],
  'image/x-icon': ['.ico'],
  'image/apng': ['.apng'],
  'audio/mpeg': ['.mp3'],
  'audio/wav': ['.wav'],
}

export function fileFingerprint(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`
}

export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    const mb = bytes / (1024 * 1024)
    return `${Number.isInteger(mb) ? mb : mb.toFixed(1)}MB`
  }
  return `${Math.max(1, Math.round(bytes / 1024))}KB`
}

export function normalizeAccept(accept?: string | readonly string[]): string | undefined {
  if (!accept) return undefined
  const rawTokens = typeof accept === 'string' ? accept.split(',') : accept
  const tokens = rawTokens
    .flatMap((entry) => String(entry).split(','))
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => {
      if (token === '*' || token === '*/*' || token.includes('/') || token.startsWith('.')) {
        return token
      }
      return `.${token}`
    })
  return tokens.length > 0 ? tokens.join(',') : undefined
}

export function matchesFileAccept(file: File, normalizedAccept?: string): boolean {
  if (!normalizedAccept || normalizedAccept === '*' || normalizedAccept === '*/*') return true

  const extIndex = file.name.lastIndexOf('.')
  const ext = extIndex >= 0 ? file.name.slice(extIndex).toLowerCase() : ''
  const mime = (file.type || '').toLowerCase()
  const tokens = normalizedAccept
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)

  return tokens.some((token) => {
    if (token === '*' || token === '*/*') return true
    if (token.startsWith('.')) return ext === token
    if (token.endsWith('/*')) {
      const prefix = token.slice(0, -1)
      if (mime.startsWith(prefix)) return true
      if (token === 'image/*') return IMAGE_EXTENSIONS.has(ext)
      return false
    }
    if (mime === token) return true
    const aliasExts = MIME_EXTENSION_ALIASES[token]
    return aliasExts ? aliasExts.includes(ext) : false
  })
}

export interface ValidatePickedFilesOptions {
  accept?: string | readonly string[]
  maxSize?: number
  maxFiles?: number
  dedupe?: boolean
  existingFingerprints?: ReadonlySet<string>
  onError?: (message: string) => void
}

function buildFormatErrorMessage(normalizedAccept?: string): string {
  if (!normalizedAccept) return '不支持的文件格式'
  if (normalizedAccept === 'image/*') return '仅支持图片文件'
  const readable = normalizedAccept
    .split(',')
    .filter((token) => !token.includes('/') || !normalizedAccept.includes('.'))
    .map((token) => token.replace(/^\./, '').toUpperCase())
  return readable.length > 0 ? `仅支持 ${[...new Set(readable)].join(' / ')} 格式文件` : '不支持的文件格式'
}

export function validatePickedFiles(rawFiles: readonly File[], options: ValidatePickedFilesOptions = {}): File[] {
  const notify = options.onError ?? ((msg: string) => toast.error(msg))
  if (rawFiles.length === 0) return []

  if (options.maxFiles !== undefined && options.maxFiles <= 0) {
    notify('已达到最大文件数量限制')
    return []
  }

  const normalizedAccept = normalizeAccept(options.accept)
  const seen = new Set<string>(options.existingFingerprints)
  const shouldDedupe = options.dedupe ?? false
  const accepted: File[] = []
  let rejectedFormat = false
  let rejectedSize = false

  for (const file of rawFiles) {
    if (!matchesFileAccept(file, normalizedAccept)) {
      rejectedFormat = true
      continue
    }
    if (options.maxSize !== undefined && file.size > options.maxSize) {
      rejectedSize = true
      continue
    }
    if (shouldDedupe) {
      const fp = fileFingerprint(file)
      if (seen.has(fp)) continue
      seen.add(fp)
    }
    accepted.push(file)
  }

  if (rejectedFormat && rejectedSize && options.maxSize !== undefined) {
    notify(`${buildFormatErrorMessage(normalizedAccept)}，且大小不能超过 ${formatFileSize(options.maxSize)}`)
  } else if (rejectedFormat) {
    notify(buildFormatErrorMessage(normalizedAccept))
  } else if (rejectedSize && options.maxSize !== undefined) {
    notify(`文件大小不能超过 ${formatFileSize(options.maxSize)}`)
  }

  if (options.maxFiles !== undefined && accepted.length > options.maxFiles) {
    if (options.maxFiles > 1) {
      notify(`最多可添加 ${options.maxFiles} 个文件`)
    }
    return accepted.slice(0, options.maxFiles)
  }

  return accepted
}

export interface FilePickerCallOptions {
  accept?: string | readonly string[]
  multiple?: boolean
  maxSize?: number
  maxFiles?: number
  dedupe?: boolean
  existingFingerprints?: ReadonlySet<string>
  onSelect?: (files: File[]) => void | Promise<void>
  onError?: (message: string) => void
}

export interface UseFilePickerOptions extends FilePickerCallOptions {
  dropZoneRef?: MaybeRefOrGetter<HTMLElement | null | undefined>
  resolveOptions?: () => FilePickerCallOptions | false
}

export function useFilePicker(options: UseFilePickerOptions = {}) {
  let pendingCallOptions: FilePickerCallOptions | undefined

  const {
    open: openDialog,
    reset,
    onChange,
  } = useFileDialog({
    accept: normalizeAccept(options.accept),
    multiple: options.multiple ?? false,
  })

  function handleFiles(rawFiles: readonly File[], callOpts?: FilePickerCallOptions) {
    const dynamicOpts = options.resolveOptions?.()
    if (dynamicOpts === false) return
    const merged: FilePickerCallOptions = {
      ...options,
      ...dynamicOpts,
      ...callOpts,
    }
    const multiple = merged.multiple ?? false
    const maxFiles = merged.maxFiles ?? (multiple ? undefined : 1)
    const valid = validatePickedFiles(rawFiles, {
      accept: merged.accept,
      maxSize: merged.maxSize,
      maxFiles,
      dedupe: merged.dedupe,
      existingFingerprints: merged.existingFingerprints,
      onError: merged.onError,
    })
    if (valid.length > 0) {
      void merged.onSelect?.(valid)
    }
  }

  onChange((fileList) => {
    if (!fileList) return
    const picked = Array.from(fileList)
    const callOpts = pendingCallOptions
    pendingCallOptions = undefined
    reset()
    handleFiles(picked, callOpts)
  })

  const isOverDropZone = options.dropZoneRef
    ? useDropZone(options.dropZoneRef, {
        onDrop(files) {
          if (files?.length) handleFiles(files)
        },
      }).isOverDropZone
    : ref(false)

  function open(callOptions?: FilePickerCallOptions) {
    const dynamicOpts = options.resolveOptions?.()
    if (dynamicOpts === false) return
    const effective = { ...options, ...dynamicOpts, ...callOptions }
    pendingCallOptions = effective
    openDialog({
      accept: normalizeAccept(effective.accept),
      multiple: effective.multiple ?? false,
    })
  }

  return {
    open,
    isOverDropZone,
  }
}
