import { OBS_STORE_API_URL } from '@/shared/config/endpoints'
import { QueryGetAPI, QueryPostAPI, unwrapOk } from './query'

export class ObsSyncConflict extends Error {
  constructor(public snapshot: ObsSyncStateResponse) { super('配置已在其他窗口更新') }
}

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
  userId?: number,
): Promise<ObsSyncStateResponse> {
  const params: Record<string, string> = { component, channel }
  if (userId) params.id = String(userId)
  if (hash) params.hash = hash
  const resp = await QueryGetAPI<ObsSyncStateResponse>(`${OBS_STORE_API_URL}sync/get-state`, params)
  return unwrapOk(resp, '获取 OBS 组件状态失败')
}

export async function updateObsSyncState(
  component: string,
  channel: string,
  data: string,
  expectedHash = '',
): Promise<ObsSyncStateResponse> {
  const resp = await QueryPostAPI<ObsSyncStateResponse>(`${OBS_STORE_API_URL}sync/update-state`, {
    component,
    channel,
    data,
    expectedHash,
  })
  if (resp.code === 409) throw new ObsSyncConflict(resp.data)
  return unwrapOk(resp, '更新 OBS 组件状态失败')
}
