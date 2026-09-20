import { OBS_STORE_API_URL } from '@/shared/config/endpoints'

import { QueryPostAPI, unwrapOk } from './query'
export interface PngtuberAsset {
  userId: number
  assetId: string
  width: number
  height: number
  frameCount: number
  byteSize: number
  url: string
}
export async function uploadPngtuberAsset(file: File): Promise<PngtuberAsset> {
  if (!['image/png', 'image/gif', 'image/webp', 'image/apng'].includes(file.type) || file.size > 16 * 1024 * 1024)
    throw new Error('请选择 16 MB 以内的 PNG、GIF 或 WebP')
  const form = new FormData()
  form.append('file', file)
  const data = unwrapOk(
    await QueryPostAPI<Omit<PngtuberAsset, 'url'>>(`${OBS_STORE_API_URL}pngtuber/assets`, form),
    '上传立绘失败',
  )
  return { ...data, url: `${OBS_STORE_API_URL}pngtuber/assets/${data.userId}/${data.assetId}` }
}
