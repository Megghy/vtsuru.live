import { QueryBiliAPI } from '../data/utils'
import { useBiliCookie } from '../store/useBiliCookie'
import CryptoJS from 'crypto-js'
import { fetch as tauriFetch } from '@tauri-apps/plugin-http'

/**
 * 直播姬版本信息
 */
export interface LiveVersionInfo {
  curr_version: string // 直播姬最新版本号
  build: number // 直播姬构建号
  instruction: string // 更新说明（简要）
  file_size: string // 文件大小（字节）
  file_md5: string // 安装包文件MD5
  content: string // HTML格式的更新内容
  download_url: string // 安装包下载链接
  hdiffpatch_switch: number // 增量更新开关
}

/**
 * MD5 哈希实现 - 使用 crypto-js
 */
function md5(str: string): string {
  return CryptoJS.MD5(str).toString()
}

/**
 * APP签名函数 - 用于B站API签名
 * @param params 已包含appkey的参数字典
 * @param appsec app secret密钥
 */
type AppSignParamValue = string | number
type AppSignParams = Record<string, AppSignParamValue>
type SignedParams = AppSignParams & { sign: string }

function appSign(params: AppSignParams, appsec: string): SignedParams {
  // 按 key 排序参数
  const sortedKeys = Object.keys(params).sort()
  const sortedParams: AppSignParams = {}
  sortedKeys.forEach(key => {
    sortedParams[key] = params[key]
  })
  
  // 序列化参数为 key=value&key=value 格式
  const queryString = sortedKeys.map(key => `${key}=${String(params[key])}`).join('&')
  
  // 计算 MD5 签名
  const signString = queryString + appsec
  const sign = md5(signString)
  
  console.log('签名字符串:', signString)
  console.log('签名结果:', sign)
  
  // 添加签名
  return { ...sortedParams, sign }
}

/**
 * 获取当前时间戳
 */
async function getTimestamp(): Promise<number> {
  try {
    const resp = await QueryBiliAPI(
      'https://api.bilibili.com/x/report/click/now',
      'GET',
      '',
      false,
    )
    const json = await resp.json() as { code: number, data?: { now?: number } }
    if (json.code === 0 && json.data?.now) {
      return json.data.now
    }
  }
  catch (err) {
    console.error('获取服务器时间戳失败，使用本地时间:', err)
  }
  return Math.floor(Date.now() / 1000)
}

/**
 * 获取直播姬版本号
 */
export async function getLiveVersion(): Promise<LiveVersionInfo | null> {
  try {
    console.log('正在获取直播姬版本号')
    const appkey = 'aae92bc66f3edfab'
    const appsec = 'af125a0d5279fd576c1b4418a3e8276d'
    
    const ts = await getTimestamp()
    
    // 准备参数并签名
    const params = appSign({
      appkey,
      system_version: 2,
      ts,
    }, appsec)
    
    const query = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      query.append(key, String(value))
    })
    
    const resp = await QueryBiliAPI(
      `https://api.live.bilibili.com/xlive/app-blink/v1/liveVersionInfo/getHomePageLiveVersion?${query.toString()}`,
      'GET',
      '',
      false,
    )
    const json = await resp.json() as { code: number, data?: LiveVersionInfo }
    
    if (json.code === 0 && json.data) {
      console.log('获取直播姬版本成功:', json.data.curr_version, 'build:', json.data.build)
      return json.data
    }
    
    return null
  }
  catch (err) {
    console.error('获取直播姬版本失败:', err)
    return null
  }
}

/**
 * 直播间管理API
 */

/**
 * 开始直播
 * @param roomId 直播间ID
 * @param areaV2 直播分区ID（子分区ID）
 * @param platform 直播平台 pc | pc_link | android_link
 * @param version 直播姬版本号（可选）
 * @param build 直播姬构建号（可选）
 */
export interface StartLiveParams {
  roomId: number
  areaV2: number
  platform?: 'pc' | 'pc_link' | 'android_link'
  version?: string
  build?: number
}

export interface StartLiveResponse {
  code: number
  msg: string
  message: string
  data?: {
    change: number
    status: string
    room_type: number
    rtmp: {
      addr: string // RTMP推流地址
      code: string // RTMP推流参数（密钥）
      new_link: string
      provider: string
    }
    protocols: Array<{
      protocol: string
      addr: string
      code: string
      new_link: string
      provider: string
    }>
    try_time: string
    live_key: string
    sub_session_key: string
    notice: any
    qr?: string // 人脸认证二维码
    need_face_auth: boolean
    service_source: string
    rtmp_backup: any
    up_stream_extra: {
      isp: string
    }
  }
}

// 开播错误码
export enum StartLiveErrorCode {
  SUCCESS = 0,
  NEED_FACE_AUTH = 60024, // 需要人脸认证
}

/**
 * 开始直播
 */
export async function startLive(params: StartLiveParams): Promise<StartLiveResponse> {
  const biliCookieStore = useBiliCookie()
  const cookie = await biliCookieStore.getBiliCookie()

  console.log('正在开始直播: ', params)
  
  if (!cookie) {
    throw new Error('未登录或Cookie无效')
  }

  // 从cookie中提取bili_jct作为csrf
  const csrfMatch = cookie.match(/bili_jct=([^;]+)/)
  const csrf = csrfMatch ? csrfMatch[1] : ''
  
  if (!csrf) {
    throw new Error('无法获取CSRF令牌')
  }

  // 准备参数
  const appkey = 'aae92bc66f3edfab'
  const appsec = 'af125a0d5279fd576c1b4418a3e8276d'
  
  // 获取时间戳
  const ts = await getTimestamp()
  
  const requestParams: Record<string, any> = {
    access_key: '', // 留空
    appkey,
    platform: params.platform || 'pc_link',
    room_id: params.roomId,
    area_v2: params.areaV2,
    build: params.build?.toString() || '9343',
    backup_stream: 0,
    csrf,
    csrf_token: csrf,
    ts: ts.toString(),
  }
  
  // 对参数按字典序排序并签名
  const signedParams = appSign(requestParams, appsec)
  
  console.log('已对参数进行签名')
  console.log('开播请求参数:', signedParams)

  // 将参数作为URL查询字符串，而不是POST body
  const query = new URLSearchParams()
  Object.entries(signedParams).forEach(([key, value]) => {
    query.append(key, String(value))
  })

  const resp = await QueryBiliAPI(
    `https://api.live.bilibili.com/room/v1/Room/startLive?${query.toString()}`,
    'POST',
    cookie,
    true,
  )

  const json = await resp.json()
  console.log('开播响应:', json)
  return json as StartLiveResponse
}

/**
 * 关闭直播
 */
export interface StopLiveParams {
  roomId: number
  platform?: 'pc' | 'pc_link' | 'android_link'
}

export interface StopLiveResponse {
  code: number
  msg: string
  message: string
  data?: {
    change: number
    status: string
  }
}

/**
 * 关闭直播
 */
export async function stopLive(params: StopLiveParams): Promise<StopLiveResponse> {
  const biliCookieStore = useBiliCookie()
  const cookie = await biliCookieStore.getBiliCookie()
  
  if (!cookie) {
    throw new Error('未登录或Cookie无效')
  }

  const csrfMatch = cookie.match(/bili_jct=([^;]+)/)
  const csrf = csrfMatch ? csrfMatch[1] : ''
  
  if (!csrf) {
    throw new Error('无法获取CSRF令牌')
  }

  const formData = new URLSearchParams()
  formData.append('platform', params.platform || 'pc_link')
  formData.append('room_id', params.roomId.toString())
  formData.append('csrf', csrf)

  const resp = await QueryBiliAPI(
    'https://api.live.bilibili.com/room/v1/Room/stopLive',
    'POST',
    cookie,
    true,
    formData,
  )

  const json = await resp.json()
  return json as StopLiveResponse
}

/**
 * 更新直播间信息
 */
export interface UpdateRoomParams {
  roomId: number
  title?: string
  areaId?: number
  addTag?: string
  delTag?: string
}

export interface UpdateRoomResponse {
  code: number
  msg: string
  message: string
  data?: {
    sub_session_key: string
    audit_info: {
      audit_title_reason: string
      audit_title_status: number
      audit_title?: string
      update_title: string
    }
  }
}

/**
 * 更新直播间信息
 */
export async function updateRoom(params: UpdateRoomParams): Promise<UpdateRoomResponse> {
  const biliCookieStore = useBiliCookie()
  const cookie = await biliCookieStore.getBiliCookie()
  
  if (!cookie) {
    throw new Error('未登录或Cookie无效')
  }

  const csrfMatch = cookie.match(/bili_jct=([^;]+)/)
  const csrf = csrfMatch ? csrfMatch[1] : ''
  
  if (!csrf) {
    throw new Error('无法获取CSRF令牌')
  }

  const formData = new URLSearchParams()
  formData.append('room_id', params.roomId.toString())
  formData.append('csrf', csrf)
  formData.append('csrf_token', csrf)
  
  if (params.title !== undefined) {
    formData.append('title', params.title)
  }
  if (params.areaId !== undefined) {
    formData.append('area_id', params.areaId.toString())
  }
  if (params.addTag !== undefined) {
    formData.append('add_tag', params.addTag)
  }
  if (params.delTag !== undefined) {
    formData.append('del_tag', params.delTag)
  }

  const resp = await QueryBiliAPI(
    'https://api.live.bilibili.com/room/v1/Room/update',
    'POST',
    cookie,
    true,
    formData,
  )

  const json = await resp.json()
  return json as UpdateRoomResponse
}

/**
 * 获取直播分区列表
 */
export interface LiveArea {
  id: number
  name: string
  parent_id: number
  parent_name: string
}

export async function getLiveAreas(): Promise<LiveArea[]> {
  const resp = await QueryBiliAPI('https://api.live.bilibili.com/room/v1/Area/getList', 'GET', '', false)
  const json = await resp.json()
  
  if (json.code === 0 && json.data) {
    const areas: LiveArea[] = []
    for (const parent of json.data) {
      for (const child of parent.list) {
        areas.push({
          id: child.id,
          name: child.name,
          parent_id: parent.id,
          parent_name: parent.name,
        })
      }
    }
    return areas
  }
  
  throw new Error('获取直播分区失败')
}

export interface UpdateRoomNewsParams {
  roomId: number
  content: string
}

export interface UpdateRoomNewsResponse {
  code: number
  message: string
  data: any
  ttl?: number
}

export async function updateRoomNews(params: UpdateRoomNewsParams): Promise<UpdateRoomNewsResponse> {
  const biliCookieStore = useBiliCookie()
  const cookie = await biliCookieStore.getBiliCookie()

  if (!cookie) {
    throw new Error('未登录或Cookie无效')
  }

  const csrfMatch = cookie.match(/bili_jct=([^;]+)/)
  const csrf = csrfMatch ? csrfMatch[1] : ''

  const uidMatch = cookie.match(/DedeUserID=([^;]+)/)
  const uid = uidMatch ? uidMatch[1] : ''

  if (!csrf || !uid) {
    throw new Error('无法获取CSRF令牌或用户ID')
  }

  const formData = new URLSearchParams()
  formData.append('room_id', params.roomId.toString())
  formData.append('uid', uid)
  formData.append('content', params.content ?? '')
  formData.append('csrf', csrf)
  formData.append('csrf_token', csrf)

  const resp = await QueryBiliAPI(
    'https://api.live.bilibili.com/xlive/app-blink/v1/index/updateRoomNews',
    'POST',
    cookie,
    true,
    formData,
  )

  const json = await resp.json()
  return json as UpdateRoomNewsResponse
}

export interface UploadCoverResult {
  location: string
  etag?: string
  image_url?: string
}

export interface UploadCoverResponse {
  code: number
  message: string
  data?: UploadCoverResult
}

export async function uploadCover(file: File): Promise<UploadCoverResponse> {
  const biliCookieStore = useBiliCookie()
  const cookie = await biliCookieStore.getBiliCookie()

  if (!cookie) {
    throw new Error('未登录或Cookie无效')
  }

  const csrfMatch = cookie.match(/bili_jct=([^;]+)/)
  const csrf = csrfMatch ? csrfMatch[1] : ''

  if (!csrf) {
    throw new Error('无法获取CSRF令牌')
  }

  const apiUrl = 'https://api.bilibili.com/x/upload/web/image'
  const boundary = '----WebKitFormBoundary' + Math.random().toString(16).slice(2)

  const encoder = new TextEncoder()

  const parts: string[] = []
  parts.push(
    `--${boundary}\r\n` +
    'Content-Disposition: form-data; name="bucket"\r\n\r\n' +
    'live\r\n',
  )
  parts.push(
    `--${boundary}\r\n` +
    'Content-Disposition: form-data; name="dir"\r\n\r\n' +
    'new_room_cover\r\n',
  )
  parts.push(
    `--${boundary}\r\n` +
    'Content-Disposition: form-data; name="csrf"\r\n\r\n' +
    `${csrf}\r\n`,
  )
  parts.push(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="${file.name || 'blob'}"\r\n` +
    `Content-Type: ${file.type || 'image/jpeg'}\r\n\r\n`,
  )

  const headBytes = encoder.encode(parts.join(''))
  const fileBytes = new Uint8Array(await file.arrayBuffer())
  const tailBytes = encoder.encode(`\r\n--${boundary}--\r\n`)

  const body = new Uint8Array(headBytes.length + fileBytes.length + tailBytes.length)
  body.set(headBytes, 0)
  body.set(fileBytes, headBytes.length)
  body.set(tailBytes, headBytes.length + fileBytes.length)

  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0',
    'Origin': 'https://www.bilibili.com',
    'Referer': 'https://live.bilibili.com/',
    'Cookie': cookie,
    'Content-Type': `multipart/form-data; boundary=${boundary}`,
  }

  const resp = await tauriFetch(apiUrl, {
    method: 'POST',
    headers,
    body,
  })

  if (!resp.ok) {
    throw new Error(`上传封面失败: HTTP ${resp.status} ${resp.statusText}`)
  }

  const json = await resp.json()
  return json as UploadCoverResponse
}

export interface UpdateCoverResponse {
  code: number
  message: string
  data?: any
}

export async function updateCover(coverUrl: string): Promise<UpdateCoverResponse> {
  const biliCookieStore = useBiliCookie()
  const cookie = await biliCookieStore.getBiliCookie()

  if (!cookie) {
    throw new Error('未登录或Cookie无效')
  }

  const csrfMatch = cookie.match(/bili_jct=([^;]+)/)
  const csrf = csrfMatch ? csrfMatch[1] : ''

  if (!csrf) {
    throw new Error('无法获取CSRF令牌')
  }

  const formData = new URLSearchParams()
  formData.append('platform', 'web')
  formData.append('mobi_app', 'web')
  formData.append('build', '1')
  formData.append('cover', coverUrl)
  formData.append('coverVertical', '')
  formData.append('liveDirectionType', '1')
  formData.append('csrf', csrf)
  formData.append('csrf_token', csrf)

  const resp = await QueryBiliAPI(
    'https://api.live.bilibili.com/xlive/app-blink/v1/preLive/UpdatePreLiveInfo',
    'POST',
    cookie,
    true,
    formData,
  )

  const json = await resp.json()
  return json as UpdateCoverResponse
}
