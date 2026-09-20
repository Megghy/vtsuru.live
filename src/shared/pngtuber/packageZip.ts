import type JSZip from 'jszip'

export const PACKAGE_LIMITS = {
  compressed: 64 * 1024 * 1024,
  total: 128 * 1024 * 1024,
  file: 16 * 1024 * 1024,
  entries: 200,
}
export interface ZipEntry {
  name: string
  size: number
  crc: number
  directory: boolean
}
export function safePackagePath(name: string) {
  return (
    !!name &&
    !/[\\:\x00-\x1F\x7F]/.test(name) &&
    !name.startsWith('/') &&
    name
      .replace(/\/$/, '')
      .split('/')
      .every((p) => p !== '' && p !== '.' && p !== '..')
  )
}
/** Inspect raw names before JSZip sanitizes traversal paths or overwrites duplicate entries. */
export function inspectPackageZip(bytes: Uint8Array): ZipEntry[] {
  if (bytes.length > PACKAGE_LIMITS.compressed) throw new Error('模型包不能超过 64MB')
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const u16 = (i: number) => view.getUint16(i, true)
  const u32 = (i: number) => view.getUint32(i, true)
  let end = bytes.length - 22
  for (; end >= Math.max(0, bytes.length - 65557); end--) {
    if (u32(end) === 0x06054b50 && end + 22 + u16(end + 20) === bytes.length) break
  }
  if (end < 0 || end < bytes.length - 65557) throw new Error('无效或截断的 ZIP 模型包')
  const count = u16(end + 10)
  const centralSize = u32(end + 12)
  const centralOffset = u32(end + 16)
  if (u16(end + 4) || u16(end + 6) || u16(end + 8) !== count || centralOffset + centralSize !== end)
    throw new Error('不支持分卷、ZIP64 或损坏的 ZIP')
  if (!count || count > PACKAGE_LIMITS.entries) throw new Error('模型包文件数必须在 1–200 之间')
  const names = new Set<string>()
  const entries: ZipEntry[] = []
  const decoder = new TextDecoder('utf-8', { fatal: true })
  let offset = centralOffset
  let total = 0
  for (let i = 0; i < count; i++) {
    if (offset + 46 > end || u32(offset) !== 0x02014b50) throw new Error('ZIP 文件目录损坏')
    const flags = u16(offset + 8)
    const method = u16(offset + 10)
    const compressed = u32(offset + 20)
    const size = u32(offset + 24)
    const nameLength = u16(offset + 28)
    const extraLength = u16(offset + 30)
    const commentLength = u16(offset + 32)
    const local = u32(offset + 42)
    const next = offset + 46 + nameLength + extraLength + commentLength
    if (next > end || local + 30 > centralOffset) throw new Error('ZIP 条目越界')
    const nameBytes = bytes.subarray(offset + 46, offset + 46 + nameLength)
    const name = decoder.decode(nameBytes)
    if (!safePackagePath(name) || names.has(name)) throw new Error(`模型包包含危险或重复路径：${name}`)
    if (flags & 1 || ![0, 8].includes(method) || u16(offset + 34) || ((u32(offset + 38) >>> 16) & 0xf000) === 0xa000)
      throw new Error('不支持加密、符号链接或该 ZIP 压缩方式')
    // Unicode-path extras can replace the raw name inside JSZip; reject ambiguity.
    for (let p = offset + 46 + nameLength; p < offset + 46 + nameLength + extraLength;) {
      if (p + 4 > offset + 46 + nameLength + extraLength) throw new Error('ZIP 扩展字段损坏')
      const tag = u16(p)
      const length = u16(p + 2)
      if (tag === 0x7075 || tag === 0x0001) throw new Error('不支持 ZIP 路径覆盖或 ZIP64 扩展')
      p += 4 + length
      if (p > offset + 46 + nameLength + extraLength) throw new Error('ZIP 扩展字段越界')
    }
    if (
      u32(local) !== 0x04034b50 ||
      u16(local + 6) !== flags ||
      u16(local + 8) !== method ||
      u16(local + 26) !== nameLength
    )
      throw new Error('ZIP 本地目录不一致')
    const dataStart = local + 30 + u16(local + 26) + u16(local + 28)
    if (dataStart + compressed > centralOffset || !nameBytes.every((v, n) => bytes[local + 30 + n] === v))
      throw new Error('ZIP 本地路径或数据范围无效')
    if (size > PACKAGE_LIMITS.file) throw new Error(`单文件不能超过 16MB：${name}`)
    total += size
    if (total > PACKAGE_LIMITS.total) throw new Error('模型包总解压体积不能超过 128MB')
    names.add(name)
    entries.push({ name, size, crc: u32(offset + 16), directory: name.endsWith('/') })
    offset = next
  }
  if (offset !== end) throw new Error('ZIP 目录长度不一致')
  return entries
}
const crcTable = Uint32Array.from({ length: 256 }, (_, n) => {
  for (let i = 0; i < 8; i++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1
  return n >>> 0
})
export async function inflateBounded(file: JSZip.JSZipObject, entry: ZipEntry): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = []
    let length = 0
    let crc = 0xffffffff
    let stopped = false
    // JSZip 3.10 exposes this streaming API, but its bundled 3.1 typings omit it.
    const stream = (
      file as JSZip.JSZipObject & {
        internalStream: (type: 'uint8array') => JSZip.JSZipStreamHelper<Uint8Array>
      }
    ).internalStream('uint8array')
    stream
      .on('data', (chunk: Uint8Array) => {
        if (stopped) return
        length += chunk.length
        if (length > entry.size || length > PACKAGE_LIMITS.file) {
          stopped = true
          stream.pause()
          reject(new Error(`解压大小超出声明或 16MB 限制：${entry.name}`))
          return
        }
        for (const byte of chunk) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8)
        chunks.push(chunk)
      })
      .on('error', reject)
      .on('end', () => {
        if (stopped) return
        if (length !== entry.size || (crc ^ 0xffffffff) >>> 0 !== entry.crc) {
          reject(new Error(`素材损坏或校验失败：${entry.name}`))
          return
        }
        const result = new Uint8Array(length)
        let offset = 0
        for (const chunk of chunks) {
          result.set(chunk, offset)
          offset += chunk.length
        }
        resolve(result)
      })
      .resume()
  })
}
