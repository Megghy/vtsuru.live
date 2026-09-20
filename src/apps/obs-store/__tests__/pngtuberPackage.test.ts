// @vitest-environment node
import { Buffer } from 'node:buffer'

import JSZip from 'jszip'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { uploadPngtuberAsset } from '@/api/pngtuber-assets'
import { exportPngtuberPackage, importPngtuberPackage } from '@/shared/pngtuber/modelPackage'
import { inspectPackageZip, PACKAGE_LIMITS } from '@/shared/pngtuber/packageZip'
import { DEFAULT_PNGTUBER_STATE } from '@/shared/pngtuber/types'

vi.mock('@/api/pngtuber-assets', () => ({ uploadPngtuberAsset: vi.fn() }))
const png = new Uint8Array(
  Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=', 'base64'),
)
const path = 'assets/a.png'
function state() {
  const s = structuredClone(DEFAULT_PNGTUBER_STATE)
  s.expressions[0].idleImage = path
  s.expressions[0].speakingImage = path
  return s
}
function manifest(s = state()) {
  return JSON.stringify({ format: 'vtsuru-pngtuber', version: 1, state: s })
}
async function archive(files: Record<string, string | Uint8Array>) {
  const zip = new JSZip()
  for (const [name, data] of Object.entries(files)) zip.file(name, data, { createFolders: false })
  return new Blob([new Uint8Array(await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' }))])
}
function centralOffsets(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer)
  const result: number[] = []
  for (let i = 0; i <= bytes.length - 46; i++) if (view.getUint32(i, true) === 0x02014b50) result.push(i)
  return result
}
afterEach(() => vi.unstubAllGlobals())
describe('模型包', () => {
  it('导出下载地址去重、内容去重；导入上传一次且返回新状态', async () => {
    const original = state()
    original.expressions[0].idleImage = 'https://example.com/a.png'
    original.expressions[0].speakingImage = 'https://example.com/a.png'
    original.expressions[0].idleBlinkImage = 'https://example.com/b.png'
    const fetcher = vi.fn(async () => new Response(png))
    vi.stubGlobal('fetch', fetcher)
    vi.mocked(uploadPngtuberAsset).mockResolvedValue({
      url: 'https://api.example/pngtuber/assets/1/new',
      userId: 1,
      assetId: 'new',
      width: 1,
      height: 1,
      frameCount: 1,
      byteSize: png.length,
    })
    const blob = await exportPngtuberPackage(original)
    expect(fetcher).toHaveBeenCalledTimes(2)
    const entries = inspectPackageZip(new Uint8Array(await blob.arrayBuffer()))
    expect(entries).toHaveLength(2)
    const imported = await importPngtuberPackage(blob)
    expect(uploadPngtuberAsset).toHaveBeenCalledTimes(1)
    expect(imported.expressions[0].idleImage).toBe('https://api.example/pngtuber/assets/1/new')
    expect(imported.expressions[0].speakingImage).toBe(imported.expressions[0].idleImage)
    expect(original.expressions[0].idleImage).toBe('https://example.com/a.png')
  })
  it('下载失败说明 HTTP 或跨域原因', async () => {
    const s = state()
    s.expressions[0].idleImage = s.expressions[0].speakingImage = 'https://example.com/a.png'
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 403 })),
    )
    await expect(exportPngtuberPackage(s)).rejects.toThrow('HTTP 403')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      }),
    )
    await expect(exportPngtuberPackage(s)).rejects.toThrow('跨域')
  })
  it.each(['../evil.png', '/absolute.png', 'assets/../evil.png', 'C:/evil.png', 'assets\\evil.png'])(
    '拒绝危险路径 %s',
    async (name) => {
      await expect(importPngtuberPackage(await archive({ 'manifest.json': manifest(), [name]: png }))).rejects.toThrow(
        '路径',
      )
      expect(uploadPngtuberAsset).not.toHaveBeenCalled()
    },
  )
  it('未验证完全部素材不上传任何文件', async () => {
    const s = state()
    s.expressions[0].speakingImage = 'assets/b.png'
    const blob = await archive({ 'manifest.json': manifest(s), [path]: png, 'assets/b.png': new Uint8Array([0, 1, 2]) })
    await expect(importPngtuberPackage(blob)).rejects.toThrow('有效')
    expect(uploadPngtuberAsset).not.toHaveBeenCalled()
  })
  it.each([
    ['缺少 manifest', { [path]: png }, '缺少 manifest'],
    ['非法 JSON', { 'manifest.json': '{' }, 'JSON'],
    ['版本', { 'manifest.json': JSON.stringify({ format: 'vtsuru-pngtuber', version: 2, state: state() }) }, '版本'],
    ['缺少素材', { 'manifest.json': manifest() }, '缺少素材'],
    ['额外文件', { 'manifest.json': manifest(), [path]: png, 'unrelated.txt': 'hello' }, '未引用'],
    ['字段缺失', { 'manifest.json': JSON.stringify({ format: 'vtsuru-pngtuber', version: 1, state: {} }) }, '字段'],
  ])('拒绝%s', async (_label, files, error) => {
    await expect(importPngtuberPackage(await archive(files as Record<string, string | Uint8Array>))).rejects.toThrow(
      error,
    )
    expect(uploadPngtuberAsset).not.toHaveBeenCalled()
  })
  it('拒绝外部素材引用及错误字段类型', async () => {
    const s = state()
    s.expressions[0].idleImage = 'https://example.com/a.png'
    await expect(importPngtuberPackage(await archive({ 'manifest.json': manifest(s), [path]: png }))).rejects.toThrow(
      '素材引用',
    )
    const raw = JSON.parse(manifest())
    raw.state.expressions[0].accessories = [
      { id: 'a', name: '', image: '', x: 0, y: 0, scale: 1, rotation: 0, visible: 'always', front: 'false' },
    ]
    await expect(
      importPngtuberPackage(await archive({ 'manifest.json': JSON.stringify(raw), [path]: png })),
    ).rejects.toThrow('字段类型')
    expect(uploadPngtuberAsset).not.toHaveBeenCalled()
  })
  it('提前检查 64MB 压缩包和 200 条目上限', async () => {
    await expect(importPngtuberPackage({ size: PACKAGE_LIMITS.compressed + 1 } as Blob)).rejects.toThrow('64MB')
    const files = Object.fromEntries(Array.from({ length: 201 }, (_, n) => [`${n}.txt`, '']))
    await expect(importPngtuberPackage(await archive(files))).rejects.toThrow('200')
  })
  it('拒绝声明单文件超过 16MB 和总解压超过 128MB', async () => {
    const bytes = new Uint8Array(await (await archive({ 'manifest.json': manifest() })).arrayBuffer())
    new DataView(bytes.buffer).setUint32(centralOffsets(bytes)[0] + 24, PACKAGE_LIMITS.file + 1, true)
    await expect(importPngtuberPackage(new Blob([bytes]))).rejects.toThrow('16MB')
    const many = new Uint8Array(
      await (await archive(Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`${i}.txt`, 'a'])))).arrayBuffer(),
    )
    const view = new DataView(many.buffer)
    for (const offset of centralOffsets(many)) view.setUint32(offset + 24, PACKAGE_LIMITS.file, true)
    await expect(importPngtuberPackage(new Blob([many]))).rejects.toThrow('128MB')
    expect(uploadPngtuberAsset).not.toHaveBeenCalled()
  })
  it('拒绝目录声明大小谎报、CRC 损坏以及重复路径', async () => {
    const bytes = new Uint8Array(await (await archive({ 'manifest.json': manifest(), [path]: png })).arrayBuffer())
    const offsets = centralOffsets(bytes)
    const view = new DataView(bytes.buffer)
    view.setUint32(offsets[0] + 24, 1, true)
    await expect(importPngtuberPackage(new Blob([bytes]))).rejects.toThrow(/大小|size/)
    const corrupt = new Uint8Array(await (await archive({ 'manifest.json': manifest() })).arrayBuffer())
    new DataView(corrupt.buffer).setUint32(centralOffsets(corrupt)[0] + 16, 0, true)
    await expect(importPngtuberPackage(new Blob([corrupt]))).rejects.toThrow('校验')
    const duplicate = new Uint8Array(await (await archive({ 'a.txt': 'one', 'b.txt': 'two' })).arrayBuffer())
    const second = centralOffsets(duplicate)[1]
    duplicate[second + 46] = 'a'.charCodeAt(0)
    await expect(importPngtuberPackage(new Blob([duplicate]))).rejects.toThrow('重复路径')
    expect(uploadPngtuberAsset).not.toHaveBeenCalled()
  })
  it('上传前拒绝超出统一 16MB 上限的素材', async () => {
    const oversized = new Uint8Array(16 * 1024 * 1024 + 1)
    oversized.set(png)
    await expect(
      importPngtuberPackage(await archive({ 'manifest.json': manifest(), [path]: oversized })),
    ).rejects.toThrow('16MB')
    expect(uploadPngtuberAsset).not.toHaveBeenCalled()
  })
  it('上传失败保留边界说明，未返回激活配置', async () => {
    vi.mocked(uploadPngtuberAsset).mockRejectedValueOnce(new Error('网络断开'))
    await expect(importPngtuberPackage(await archive({ 'manifest.json': manifest(), [path]: png }))).rejects.toThrow(
      '网络断开；未应用模型配置',
    )
  })
})
