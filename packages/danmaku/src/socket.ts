import { KeepLiveWS } from '@laplace.live/ws/client'
import type { WSOptions } from '@laplace.live/ws/client'

export class DanmakuSocket extends KeepLiveWS {
  public override connect(reconnect = true) {
    if (this.closed) return
    super.connect(reconnect)
  }
}

export type DirectDanmakuAuth = {
  type: 'direct'
  roomId: number
  token: string
  buvid: string
  uid: number
  address?: string
}

export type OpenLiveDanmakuAuth = {
  type: 'openlive'
  roomId: number
  authBody: Record<string, unknown> | Uint8Array<ArrayBuffer>
  address: string
}

export type DanmakuAuth = DirectDanmakuAuth | OpenLiveDanmakuAuth

export function socketOptions(auth: DanmakuAuth): WSOptions {
  if (auth.type === 'direct') {
    return {
      key: auth.token,
      buvid: auth.buvid,
      uid: auth.uid,
      protover: 3,
      ...(auth.address ? { address: auth.address } : {}),
    }
  }
  return {
    authBody: auth.authBody,
    address: auth.address,
  }
}

export function createDanmakuSocket(auth: DanmakuAuth) {
  return new DanmakuSocket(auth.roomId, socketOptions(auth))
}
