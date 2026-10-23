import type { ResponseObsSyncState } from '@/api/generated/model'
import { getApiObsStoreSyncGetState, postApiObsStoreSyncUpdateState } from '@/api/generated/obs-store/obs-store'

import { unwrapOk } from './query'

export class ObsSyncConflict extends Error {
  constructor(public snapshot: ResponseObsSyncState) {
    super('配置已在其他窗口更新')
  }
}

export async function getObsSyncState(
  component: string,
  channel = 'default',
  hash?: string,
  userId?: number,
): Promise<ResponseObsSyncState> {
  const resp = await getApiObsStoreSyncGetState({
    component,
    channel,
    ...(userId ? { id: userId } : {}),
    ...(hash ? { hash } : {}),
  })
  return unwrapOk(resp, '获取 OBS 组件状态失败')
}

export async function updateObsSyncState(
  component: string,
  channel: string,
  data: string,
  expectedHash = '',
): Promise<ResponseObsSyncState> {
  const resp = await postApiObsStoreSyncUpdateState({
    component,
    channel,
    data,
    expectedHash,
  })
  if (resp.code === 409) throw new ObsSyncConflict(resp.data)
  return unwrapOk(resp, '更新 OBS 组件状态失败')
}
