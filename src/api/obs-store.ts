import { OBS_STORE_API_URL } from '@/shared/config/endpoints'
import { QueryDeleteAPI, QueryGetAPI, QueryPostAPI, unwrapOk } from './query'

export interface ObsSyncStateResponse {
  hash: string
  changed: boolean
  data: string | null
  updatedAt: number
}

export async function getObsSyncState(
  component: string,
  channel = 'default',
  hash?: string,
): Promise<ObsSyncStateResponse> {
  const params: Record<string, string> = { component, channel }
  if (hash) params.hash = hash
  const resp = await QueryGetAPI<ObsSyncStateResponse>(`${OBS_STORE_API_URL}sync/get-state`, params)
  return unwrapOk(resp, '获取 OBS 组件状态失败')
}

export async function updateObsSyncState(
  component: string,
  channel: string,
  data: string,
): Promise<ObsSyncStateResponse> {
  const resp = await QueryPostAPI<ObsSyncStateResponse>(`${OBS_STORE_API_URL}sync/update-state`, {
    component,
    channel,
    data,
  })
  return unwrapOk(resp, '更新 OBS 组件状态失败')
}

export type PngtuberImageSlot = 'idle' | 'speaking'

export interface PngtuberImageInfo {
  userId: number
  slot: PngtuberImageSlot
  version: number
}

export function pngtuberImageUrl(userId: number, slot: PngtuberImageSlot, version?: number) {
  const suffix = version ? `?v=${version}` : ''
  return `${OBS_STORE_API_URL}pngtuber/image/${userId}/${slot}${suffix}`
}

function toPngtuberImage(info: PngtuberImageInfo) {
  return {
    ...info,
    url: pngtuberImageUrl(info.userId, info.slot, info.version),
  }
}

export async function uploadPngtuberImage(slot: PngtuberImageSlot, file: File) {
  const form = new FormData()
  form.append('slot', slot)
  form.append('file', file)
  const resp = await QueryPostAPI<PngtuberImageInfo>(`${OBS_STORE_API_URL}pngtuber/upload`, form)
  return toPngtuberImage(unwrapOk(resp, '上传立绘失败'))
}

export async function copyPngtuberIdleToSpeaking() {
  const resp = await QueryPostAPI<PngtuberImageInfo>(`${OBS_STORE_API_URL}pngtuber/copy-idle-to-speaking`)
  return toPngtuberImage(unwrapOk(resp, '复制立绘失败'))
}

export async function deletePngtuberImage(slot: PngtuberImageSlot) {
  const resp = await QueryDeleteAPI(`${OBS_STORE_API_URL}pngtuber/image/${slot}`)
  unwrapOk(resp, '删除立绘失败')
}
