import { withToken } from './api'
import { ErrorCodes } from './version'

export interface AccountInfo {
  roomId: number
  uid: number
  authCode: string
}

export async function fetchAccount(apiBase: string, token: string, fetchImpl: typeof fetch = fetch): Promise<AccountInfo> {
  const response = await fetchImpl(withToken(`${apiBase}api/account/self`, token))
  if (!response.ok) throw new Error(`无法获取用户信息: ${response.status}`)
  const json = (await response.json()) as {
    code: number
    message?: string
    data?: { biliAuthCode?: string | null; biliId?: number; biliRoomId?: number }
  }
  if (json.code !== 200) throw new Error(json.message || '无法获取用户信息')
  if (!json.data?.biliAuthCode) {
    const error = new Error('你尚未绑定B站账号并填写身份码, 请前往控制面板进行绑定')
    error.name = ErrorCodes.ACCOUNT_NOT_BIND
    throw error
  }
  if (!json.data.biliRoomId || !json.data.biliId) throw new Error('无法获取用户信息')
  return { roomId: json.data.biliRoomId, uid: json.data.biliId, authCode: json.data.biliAuthCode }
}
