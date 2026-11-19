import JSZip from 'jszip'

import { uploadPngtuberAsset } from '@/api/pngtuber-assets'

import { DEFAULT_COLLAB_SETTINGS } from './collabSettings'
import { normalizePngtuberState } from './normalize'
import { inflateBounded, inspectPackageZip, PACKAGE_LIMITS } from './packageZip'
import { createExpression, DEFAULT_PNGTUBER_STATE, IMAGE_SLOTS } from './types'
import type { PngtuberState } from './types'

const FORMAT = 'vtsuru-pngtuber'
const MANIFEST = 'manifest.json'
const PREFIX = 'https://package.invalid/'
const MAX_CONCURRENT_IO = 4

export interface PackageProgress {
  stage: 'download' | 'pack' | 'validate' | 'upload'
  done: number
  total: number
}

function rewriteImages(state: PngtuberState, replace: (src: string) => string) {
  for (const e of state.expressions) {
    for (const slot of IMAGE_SLOTS) if (e[slot]) e[slot] = replace(e[slot])
    for (const a of e.accessories) if (a.image) a.image = replace(a.image)
  }
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('模型包配置必须是对象')
  return value as Record<string, unknown>
}

function checkAllowedKeys(
  value: unknown,
  template: Record<string, unknown>,
  requiredKeys: readonly string[],
): Record<string, unknown> {
  const raw = object(value)
  for (const k of Object.keys(raw)) {
    if (!(k in template)) throw new Error(`模型包包含未知字段：${k}`)
    const expected = template[k]
    if (Array.isArray(expected) ? !Array.isArray(raw[k]) : typeof raw[k] !== typeof expected)
      throw new Error(`模型包字段类型错误：${k}`)
  }
  for (const k of requiredKeys) {
    if (!(k in raw)) throw new Error(`模型包缺少必要字段：${k}`)
  }
  return raw
}

const ACCESSORY_TEMPLATE: Record<string, unknown> = {
  id: '',
  name: '',
  image: '',
  x: 0,
  y: 0,
  scale: 1,
  rotation: 0,
  visible: 'always',
  front: true,
}

function validateManifest(value: unknown) {
  const manifest = checkAllowedKeys(value, { format: '', version: 1, state: {} }, ['format', 'version', 'state'])
  if (manifest.format !== FORMAT || manifest.version !== 1)
    throw new Error('不支持的 PNGTuber 模型包格式或版本')

  const stateTemplate = DEFAULT_PNGTUBER_STATE as unknown as Record<string, unknown>
  const stateObj = checkAllowedKeys(manifest.state, stateTemplate, ['expressions'])
  if (stateObj.collab === undefined) stateObj.collab = { ...DEFAULT_COLLAB_SETTINGS }

  const exprTemplate = createExpression() as unknown as Record<string, unknown>
  const normalizedExpressions: Record<string, unknown>[] = []
  for (const expression of stateObj.expressions as unknown[]) {
    const e = checkAllowedKeys(expression, exprTemplate, ['id', 'name'])
    const ids = new Set<string>()
    const accessories = Array.isArray(e.accessories) ? e.accessories : []
    for (const accessory of accessories) {
      const a = checkAllowedKeys(accessory, ACCESSORY_TEMPLATE, ['id'])
      if (!a.id || ids.has(a.id as string)) throw new Error('配件 ID 为空或重复')
      ids.add(a.id as string)
    }
    normalizedExpressions.push({ ...createExpression(), ...e, accessories })
  }

  const mergedState: Record<string, unknown> = {
    ...structuredClone(DEFAULT_PNGTUBER_STATE),
    ...stateObj,
    expressions: normalizedExpressions,
  }
  const staged = structuredClone(mergedState) as unknown as PngtuberState
  rewriteImages(staged, (path) => {
    if (!/^assets\/[\w-]+\.(?:png|gif|webp)$/.test(path)) throw new Error(`无效的模型包素材引用：${path}`)
    return PREFIX + path
  })
  const state = normalizePngtuberState(staged)
  rewriteImages(state, (src) => src.slice(PREFIX.length))
  return state
}

function imageType(bytes: Uint8Array): { mime: string; extension: string } {
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end))
  if (
    bytes.length >= 33 &&
    bytes[0] === 137 &&
    ascii(1, 4) === 'PNG' &&
    bytes[4] === 13 &&
    bytes[5] === 10 &&
    bytes[6] === 26 &&
    bytes[7] === 10 &&
    ascii(12, 16) === 'IHDR'
  )
    return { mime: 'image/png', extension: 'png' }
  if (bytes.length >= 14 && ['GIF87a', 'GIF89a'].includes(ascii(0, 6)) && bytes.at(-1) === 0x3b)
    return { mime: 'image/gif', extension: 'gif' }
  if (
    bytes.length >= 20 &&
    ascii(0, 4) === 'RIFF' &&
    ascii(8, 12) === 'WEBP' &&
    ['VP8 ', 'VP8L', 'VP8X'].includes(ascii(12, 16)) &&
    new DataView(bytes.buffer, bytes.byteOffset).getUint32(4, true) + 8 === bytes.length
  )
    return { mime: 'image/webp', extension: 'webp' }
  throw new Error('素材必须是有效的 PNG、APNG、GIF 或 WebP 图片')
}

async function validateImage(bytes: Uint8Array) {
  const type = imageType(bytes)
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: type.mime }))
      bitmap.close()
    } catch {
      throw new Error('素材图片无法解码或已损坏')
    }
  }
  return type
}

async function download(src: string) {
  let response: Response
  try {
    response = await fetch(src)
  } catch {
    throw new Error(`素材下载失败，请检查地址和跨域权限：${src}`)
  }
  if (!response.ok) throw new Error(`素材下载失败（HTTP ${response.status}）：${src}`)
  if (Number(response.headers.get('content-length')) > PACKAGE_LIMITS.file)
    throw new Error(`单文件不能超过 16MB：${src}`)
  if (!response.body) throw new Error(`素材响应为空：${src}`)
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.length
      if (size > PACKAGE_LIMITS.file) {
        await reader.cancel()
        throw new Error(`单文件不能超过 16MB：${src}`)
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.length
  }
  return bytes
}

async function runPool<T, R>(items: T[], concurrency: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length)
  let nextIndex = 0
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const idx = nextIndex++
      if (idx >= items.length) return
      results[idx] = await worker(items[idx])
    }
  })
  await Promise.all(runners)
  return results
}

export async function exportPngtuberPackage(
  input: PngtuberState,
  onProgress?: (progress: PackageProgress) => void,
): Promise<Blob> {
  const state = normalizePngtuberState(input)
  const urls = new Set<string>()
  rewriteImages(state, (src) => {
    urls.add(src)
    return src
  })
  const urlList = [...urls]
  let downloadedCount = 0
  onProgress?.({ stage: 'download', done: 0, total: urlList.length })

  const downloaded = await runPool(urlList, MAX_CONCURRENT_IO, async (src) => {
    const bytes = await download(src)
    const type = await validateImage(bytes)
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (b) =>
      b.toString(16).padStart(2, '0'),
    ).join('')
    downloadedCount++
    onProgress?.({ stage: 'download', done: downloadedCount, total: urlList.length })
    return { src, bytes, type, hash }
  })

  const zip = new JSZip()
  const paths = new Map<string, string>()
  const hashes = new Map<string, string>()
  let total = 0
  for (const item of downloaded) {
    let path = hashes.get(item.hash)
    if (!path) {
      path = `assets/${item.hash}.${item.type.extension}`
      total += item.bytes.length
      if (total > PACKAGE_LIMITS.total) throw new Error('模型包总解压体积不能超过 128MB')
      if (hashes.size + 2 > PACKAGE_LIMITS.entries) throw new Error('模型包文件数不能超过 200')
      zip.file(path, item.bytes, { createFolders: false })
      hashes.set(item.hash, path)
    }
    paths.set(item.src, path)
  }

  onProgress?.({ stage: 'pack', done: 0, total: 1 })
  rewriteImages(state, (src) => paths.get(src)!)
  const manifest = new TextEncoder().encode(JSON.stringify({ format: FORMAT, version: 1, state }))
  if (manifest.length > PACKAGE_LIMITS.file || total + manifest.length > PACKAGE_LIMITS.total)
    throw new Error('模型包配置或总解压体积超出限制')
  zip.file(MANIFEST, manifest)
  const bytes = await zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })
  if (bytes.length > PACKAGE_LIMITS.compressed) throw new Error('模型包不能超过 64MB')
  onProgress?.({ stage: 'pack', done: 1, total: 1 })
  return new Blob([new Uint8Array(bytes)], { type: 'application/zip' })
}

export async function importPngtuberPackage(
  file: File | Blob,
  onProgress?: (progress: PackageProgress) => void,
): Promise<PngtuberState> {
  if (file.size > PACKAGE_LIMITS.compressed) throw new Error('模型包不能超过 64MB')
  onProgress?.({ stage: 'validate', done: 0, total: 1 })
  const bytes = new Uint8Array(await file.arrayBuffer())
  const entries = inspectPackageZip(bytes)
  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(bytes)
  } catch {
    throw new Error('模型包 ZIP 无法读取')
  }
  const contents = new Map<string, Uint8Array>()
  for (const entry of entries) {
    const member = zip.files[entry.name]
    if (!member) throw new Error(`ZIP 条目丢失：${entry.name}`)
    const content = await inflateBounded(member, entry)
    if (!entry.directory) contents.set(entry.name, content)
    else if (entry.size) throw new Error('ZIP 目录包含非法数据')
  }
  if (!contents.has(MANIFEST)) throw new Error('模型包缺少 manifest.json')
  let manifest: unknown
  try {
    manifest = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(contents.get(MANIFEST)))
  } catch {
    throw new Error('manifest.json 不是有效的 UTF-8 JSON')
  }
  const state = validateManifest(manifest)
  const references = new Set<string>()
  rewriteImages(state, (path) => {
    references.add(path)
    return path
  })
  const images = new Map<string, { bytes: Uint8Array; mime: string }>()
  // Finish every validation before the first upload; callers explicitly activate returned state.
  for (const [path, content] of contents) {
    if (path === MANIFEST) continue
    if (!references.has(path)) throw new Error(`模型包含未引用的文件：${path}`)
    const type = await validateImage(content)
    if (!path.endsWith(`.${type.extension}`)) throw new Error(`素材扩展名与实际格式不一致：${path}`)
    images.set(path, { bytes: content, mime: type.mime })
  }
  for (const path of references) if (!images.has(path)) throw new Error(`模型包缺少素材：${path}`)
  onProgress?.({ stage: 'validate', done: 1, total: 1 })

  // Group identical content hashes before uploading in parallel so duplicates only upload once.
  const hashToPaths = new Map<string, string[]>()
  const hashToAsset = new Map<string, { path: string; bytes: Uint8Array; mime: string }>()
  for (const [path, image] of images) {
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(image.bytes))), (b) =>
      b.toString(16).padStart(2, '0'),
    ).join('')
    const group = hashToPaths.get(hash) ?? []
    group.push(path)
    hashToPaths.set(hash, group)
    if (!hashToAsset.has(hash)) hashToAsset.set(hash, { path, ...image })
  }

  const uniqueUploads = [...hashToAsset.entries()]
  let uploadedCount = 0
  onProgress?.({ stage: 'upload', done: 0, total: uniqueUploads.length })
  const uploaded = new Map<string, string>()

  await runPool(uniqueUploads, MAX_CONCURRENT_IO, async ([hash, asset]) => {
    let url: string
    try {
      url = (
        await uploadPngtuberAsset(
          new File([new Uint8Array(asset.bytes)], asset.path.split('/').at(-1) || 'avatar.png', { type: asset.mime }),
        )
      ).url
    } catch (error) {
      throw new Error(
        `上传素材 ${asset.path} 失败：${error instanceof Error ? error.message : String(error)}；未应用模型配置`,
        { cause: error },
      )
    }
    if (!/^https?:\/\//i.test(url)) throw new Error('上传接口返回了无效的素材地址；未应用模型配置')
    for (const p of hashToPaths.get(hash) ?? []) uploaded.set(p, url)
    uploadedCount++
    onProgress?.({ stage: 'upload', done: uploadedCount, total: uniqueUploads.length })
  })

  rewriteImages(state, (path) => uploaded.get(path)!)
  return normalizePngtuberState(state)
}
