import { postApiObsStorePngtuberAssets } from '@/api/generated/obs-store/obs-store'
import { OBS_STORE_API_URL } from '@/shared/config/endpoints'

import { QueryDeleteAPI, QueryGetAPI, QueryPostAPI, unwrapOk } from './query'

export interface PngtuberAsset {
  userId: number
  assetId: string
  width: number
  height: number
  frameCount: number
  byteSize: number
  url: string
}

export interface PngtuberAssetItem extends PngtuberAsset {
  createTime: string
  inUse: boolean
}

export interface PngtuberCleanupResult {
  deletedCount: number
  freedBytes: number
}

const ALLOWED_MIME = new Set(['image/png', 'image/gif', 'image/webp', 'image/apng'])
const ALLOWED_EXT = /\.(?:png|apng|gif|webp)$/i

function toAbsoluteAssetUrl(userId: number, assetId: string) {
  return `${OBS_STORE_API_URL}pngtuber/assets/${userId}/${assetId}`
}

export async function uploadPngtuberAsset(file: File): Promise<PngtuberAsset> {
  const typeValid = file.type ? ALLOWED_MIME.has(file.type.toLowerCase()) : ALLOWED_EXT.test(file.name)
  if (!typeValid || file.size <= 0 || file.size > 16 * 1024 * 1024)
    throw new Error('请选择 16 MB 以内的 PNG、APNG、GIF 或 WebP')
  const data = unwrapOk(await postApiObsStorePngtuberAssets({ file }), '上传立绘失败')
  return { ...data, url: toAbsoluteAssetUrl(data.userId, data.assetId) }
}

export async function listPngtuberAssets(): Promise<PngtuberAssetItem[]> {
  const res = await QueryGetAPI<PngtuberAssetItem[]>(`${OBS_STORE_API_URL}pngtuber/assets`)
  if (res.code !== 200 || !Array.isArray(res.data)) throw new Error(res.message || '获取素材列表失败')
  return res.data.map((item) => ({
    ...item,
    url: toAbsoluteAssetUrl(item.userId, item.assetId),
  }))
}

export async function deletePngtuberAsset(assetId: string, force = false): Promise<boolean> {
  const url = `${OBS_STORE_API_URL}pngtuber/assets/${encodeURIComponent(assetId)}${force ? '?force=true' : ''}`
  const res = await QueryDeleteAPI<boolean>(url)
  if (res.code !== 200) throw new Error(res.message || '删除素材失败')
  return Boolean(res.data)
}

export async function cleanupUnusedPngtuberAssets(): Promise<PngtuberCleanupResult> {
  const res = await QueryPostAPI<PngtuberCleanupResult>(`${OBS_STORE_API_URL}pngtuber/assets/cleanup`, {})
  if (res.code !== 200 || !res.data) throw new Error(res.message || '清理未引用素材失败')
  return res.data
}
