import { createHash } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import { fetchAccount } from './account'
import { createApiSelector, FAILOVER_API_BASE } from './api'
import { requestBilibili } from './bilibili'
import { loadFetcherSettings, parseCookieCloud } from './config'
import { cookieHeader, fetchCookieCloud } from './cookieCloud'
import { resolveDirectAuth } from './direct'
import { startHealthServer } from './health'
import { resolveOpenLiveAuth, openLiveHeartbeat } from './openLive'
import { decodeClientUpload, encodeClientUpload, takeBatch } from './upload'
import { createUploader, shouldUpload } from './uploader'
import { ErrorCodes, isNewerVersion } from './version'
import { mixinKey, signWbi, wbiKeyFromUrl } from './wbi'

const imgKey = 'abcdefghijklmnopqrstuvwxyz012345'
const subKey = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ678901'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('event fetcher contract', () => {
  it('round-trips the upload payload through brotli and messagepack', () => {
    const payload = {
      Events: ['{"cmd":"DANMU_MSG"}'],
      Error: { [ErrorCodes.NEW_VERSION]: '发现新版本: 9.9.9' },
      CurrentVersion: '1.0.8.0',
      OSInfo: 'win32 10.0.0',
      UseCookie: true,
    }
    expect(decodeClientUpload(encodeClientUpload(payload))).toEqual(payload)
  })

  it('compares versions the same way as System.Version', () => {
    expect(isNewerVersion('1.0.8.0', '1.0.3')).toBe(true)
    expect(isNewerVersion('1.0.3', '1.0.3.0')).toBe(false)
    expect(isNewerVersion('1.0.2', '1.0.8.0')).toBe(false)
  })

  it('signs wbi queries with the mixin key and an md5 rid', () => {
    const key = mixinKey(imgKey + subKey)
    expect(key).toHaveLength(32)
    const signed = signWbi({ id: '7', type: '0' }, imgKey, subKey, 1_700_000_000)
    const query = signed.slice(0, signed.lastIndexOf('&w_rid='))
    const rid = signed.slice(signed.lastIndexOf('=') + 1)
    expect(query).toBe('id=7&type=0&wts=1700000000')
    expect(rid).toBe(createHash('md5').update(query + key).digest('hex'))
    expect(wbiKeyFromUrl(`https://i0.hdslb.com/bfs/wbi/${imgKey}.png`)).toBe(imgKey)
  })

  it('reads tokens from the environment before the config file', () => {
    expect(loadFetcherSettings({ VTSURU_TOKEN: ' a , b ' }, { Token: 'file' }).tokens).toEqual(['a', 'b'])
    expect(loadFetcherSettings({}, { Token: 'file' }).tokens).toEqual(['file'])
    expect(() => loadFetcherSettings({})).toThrow('未设置 VTSURU_TOKEN')
  })

  it('parses cookie cloud as KEY@PASSWORD and rejects any other shape', () => {
    expect(parseCookieCloud('key@secret')).toMatchObject({ key: 'key', password: 'secret' })
    expect(() => parseCookieCloud('key@secret@extra')).toThrow('COOKIE_CLOUD')
    expect(() => parseCookieCloud('key')).toThrow('COOKIE_CLOUD')
    const settings = loadFetcherSettings(
      { VTSURU_TOKEN: 'token', COOKIE_CLOUD_HOST: 'https://cookie.example/' },
      { CookieCloudKey: 'file-key', CookieCloudPassword: 'file-secret' },
    )
    expect(settings.cookieCloud).toEqual({
      key: 'file-key',
      password: 'file-secret',
      host: 'https://cookie.example/',
    })
  })

  it('turns cookie cloud entries into one cookie header', async () => {
    expect(cookieHeader([{ name: 'SESSDATA', value: 'abc' }, { name: 'DedeUserID', value: '1' }])).toBe(
      'SESSDATA=abc; DedeUserID=1',
    )
    const header = await fetchCookieCloud({
      host: 'https://cookie.example/',
      key: 'key',
      password: 'secret',
      fetch: async (_url, init) => {
        expect(String(init?.body)).toBe('password=secret')
        return jsonResponse({ cookie_data: { 'bilibili.com': [{ name: 'SESSDATA', value: 'abc' }] } })
      },
    })
    expect(header).toBe('SESSDATA=abc')
    await expect(
      fetchCookieCloud({
        host: 'https://cookie.example/',
        key: 'key',
        password: 'secret',
        fetch: async () => jsonResponse({ cookie_data: {} }),
      }),
    ).rejects.toThrow('BiliBili')
  })

  it('keeps bilibili requests on bilibili and attaches the cookie only when enabled', async () => {
    expect(await requestBilibili({ url: 'https://evil.example/', useCookie: false, cookieEnabled: false })).toMatchObject({
      Success: false,
      Message: '请求失败: 非bilibili域名',
    })
    expect(
      await requestBilibili({ url: 'https://api.bilibili.com/x', useCookie: true, cookieEnabled: false }),
    ).toMatchObject({ Success: false, Message: '未启用cookie' })

    const result = await requestBilibili({
      url: 'https://api.bilibili.com/x/fans',
      useCookie: true,
      cookieEnabled: true,
      cookie: 'SESSDATA=abc',
      fetch: async (_url, init) => {
        expect(new Headers(init?.headers).get('cookie')).toBe('SESSDATA=abc')
        return new Response('{"code":0}', { status: 200 })
      },
    })
    expect(result).toEqual({ Success: true, Message: '', Data: '{"code":0}' })
  })

  it('uses the failover host for three reads after a failure', () => {
    const api = createApiSelector('https://primary/', FAILOVER_API_BASE)
    api.fail()
    expect([api.current(), api.current(), api.current(), api.current()]).toEqual([
      FAILOVER_API_BASE,
      FAILOVER_API_BASE,
      FAILOVER_API_BASE,
      'https://primary/',
    ])
  })

  it('builds direct auth from nav, buvid and the signed danmu info', async () => {
    const urls: string[] = []
    const auth = await resolveDirectAuth({
      roomId: 7,
      uid: 42,
      cookie: 'SESSDATA=abc',
      nowSeconds: 1_700_000_000,
      random: () => 0,
      fetch: async (url) => {
        const href = String(url)
        urls.push(href)
        if (href.includes('/nav')) {
          return jsonResponse({
            code: 0,
            data: {
              mid: 42,
              wbi_img: {
                img_url: `https://i0.hdslb.com/bfs/wbi/${imgKey}.png`,
                sub_url: `https://i0.hdslb.com/bfs/wbi/${subKey}.png`,
              },
            },
          })
        }
        if (href.includes('getbuvid')) return jsonResponse({ code: 0, data: { buvid: 'buvid' } })
        return jsonResponse({
          code: 0,
          data: { token: 'room-token', host_list: [{ host: 'tx-sh-live-comet.chat.bilibili.com', wss_port: 2245 }] },
        })
      },
    })
    expect(auth).toEqual({
      type: 'direct',
      roomId: 7,
      token: 'room-token',
      buvid: 'buvid',
      uid: 42,
      address: 'wss://tx-sh-live-comet.chat.bilibili.com:2245/sub',
    })
    expect(urls[2]).toContain('w_rid=')
    expect(urls[2]).toContain('wts=1700000000')
  })

  it('reads the open-live socket auth and treats a non-200 heartbeat as expired', async () => {
    const auth = await resolveOpenLiveAuth('https://api.example/', 'token', async () =>
      jsonResponse({
        code: 200,
        data: {
          websocket_info: { auth_body: '{"protover":3}', wss_link: ['wss://open.example/sub'] },
          anchor_info: { room_id: 9 },
        },
      }),
    )
    expect(auth).toEqual({
      type: 'openlive',
      roomId: 9,
      authBody: { protover: 3 },
      address: 'wss://open.example/sub',
    })
    const fetchImpl = async () => jsonResponse({ code: 400 })
    expect(await openLiveHeartbeat('https://api.example/', 'token', fetchImpl)).toBe(false)
  })

  it('rejects an account that has not bound bilibili', async () => {
    await expect(
      fetchAccount('https://api.example/', 'token', async () => jsonResponse({ code: 200, data: { biliAuthCode: null } })),
    ).rejects.toThrow('尚未绑定')
  })

  it('uploads at most 150 events and continues after the gap when more remain', async () => {
    const queue = Array.from({ length: 151 }, (_, index) => String(index))
    const sizes: number[] = []
    const sleeps: number[] = []
    const uploader = createUploader({
      queue,
      errors: new Map(),
      osInfo: 'test',
      useCookie: () => false,
      sleep: async (ms) => {
        sleeps.push(ms)
      },
      onRoomChange: () => undefined,
      invoke: async (bytes) => {
        sizes.push(decodeClientUpload(bytes).Events.length)
        return { Success: true, Message: 'room', Version: '1.0.0.0' }
      },
    })
    await uploader.flush()
    expect(sizes).toEqual([150, 1])
    expect(sleeps).toEqual([450])
    expect(queue).toEqual([])
    expect(takeBatch([1, 2], 1)).toEqual([1])
  })

  it('restarts when the room code changes and records a newer server version', async () => {
    const queue = ['event']
    const rooms: string[] = []
    const errors = new Map<string, string>()
    let call = 0
    const uploader = createUploader({
      queue,
      errors,
      osInfo: 'test',
      version: '1.0.8.0',
      useCookie: () => true,
      sleep: async () => undefined,
      onRoomChange: (code) => rooms.push(code),
      invoke: async () => {
        call += 1
        return call === 1
          ? { Success: true, Message: 'room-a', Version: '1.0.8.0' }
          : { Success: true, Message: 'room-b', Version: '2.0.0' }
      },
    })
    await uploader.flush()
    queue.push('next')
    await uploader.flush()
    expect(rooms).toEqual(['room-b'])
    expect(errors.has(ErrorCodes.NEW_VERSION)).toBe(false)

    const versionErrors = new Map<string, string>()
    const versionUploader = createUploader({
      queue: ['event'],
      errors: versionErrors,
      osInfo: 'test',
      version: '1.0.8.0',
      useCookie: () => false,
      onRoomChange: () => undefined,
      invoke: async () => ({ Success: true, Message: 'room-a', Version: '9.0.0' }),
    })
    await versionUploader.flush()
    expect(versionErrors.get(ErrorCodes.NEW_VERSION)).toBe('发现新版本: 9.0.0')
  })

  it('marks upload broken only after more than five thrown attempts', async () => {
    const errors = new Map<string, string>()
    const uploader = createUploader({
      queue: [],
      errors,
      osInfo: 'test',
      useCookie: () => false,
      onRoomChange: () => undefined,
      invoke: async () => {
        throw new Error('offline')
      },
    })
    for (let count = 0; count < 5; count++) await uploader.flush()
    expect(errors.has(ErrorCodes.UNABLE_UPLOAD_EVENT)).toBe(false)
    await uploader.flush()
    expect(errors.get(ErrorCodes.UNABLE_UPLOAD_EVENT)).toContain('无法发送事件')
  })

  it('uploads when events are waiting, otherwise once a minute', () => {
    expect(shouldUpload(1, 0)).toBe(true)
    expect(shouldUpload(0, 59_999)).toBe(false)
    expect(shouldUpload(0, 60_000)).toBe(true)
  })

  it('answers the health port with the existing probe text', async () => {
    const server = await startHealthServer(0)
    try {
      expect(await (await fetch(`http://127.0.0.1:${server.port}`)).text()).toBe('VTsuruEventFetcher')
    } finally {
      await server.close()
    }
  })
})
