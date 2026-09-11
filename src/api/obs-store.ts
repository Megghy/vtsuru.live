import { OBS_STORE_API_URL } from '@/shared/config/endpoints'
import { QueryGetAPI, QueryPostAPI, unwrapOk } from './query'

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
