import { toCloneable } from '@/shared/utils/broadcastChannel'

export type CustomHtmlBridgeMethod =
  | 'getContext'
  | 'getSongs'
  | 'getSongRequestState'
  | 'getSchedule'
  | 'getCheckInRanking'
  | 'getQuestions'
  | 'getPointGoods'
  | 'getVideoCollects'
  | 'requestSong'
  | 'openQuestionBox'
  | 'navigate'
  | 'copyText'
  | 'toast'
export type CustomHtmlBridgeHandlers = Partial<
  Record<CustomHtmlBridgeMethod, (params: unknown) => unknown | Promise<unknown>>
>
export interface VtsuruSandboxSdkTheme {
  isDark: boolean
  primaryColor: string
  accentColor: string
  bgColor: string
  fgColor: string
  cardBg: string
  borderColor: string
  mutedColor: string
}
export const VTSURU_SANDBOX_DTS = `interface VtsuruTheme { isDark:boolean; primaryColor:string; accentColor:string; bgColor:string; fgColor:string; cardBg:string; borderColor:string; mutedColor:string }
interface VtsuruSong {id:number;key:string;name:string;author:string[];tags:string[];language?:string[]|null;translateName?:string|null;description?:string|null;cover?:string|null;url?:string|null;createTime:number;updateTime:number;from:number;options?:{needJianzhang:boolean;needTidu:boolean;needZongdu:boolean;scMinPrice?:number|null;fanMedalMinLevel?:number|null}}
interface VtsuruScheduleDay {title?:string|null;tag?:string|null;time?:string|null;tagColor?:string|null;id?:string|null}
interface VtsuruScheduleWeek {year:number;week:number;version:string;days:VtsuruScheduleDay[][]}
interface VtsuruReserve {sid:number;title:string;planStart:number;expire:number;total:number;year:number;week:number;dayOfWeek:number;time:string}
interface VtsuruRankingItem {ouId?:string;name:string;consecutiveDays:number;points:number;lastCheckInTime:number;isAuthed:boolean;monthlyCheckInCount:number;totalCheckInCount:number}
interface VtsuruQuestion {id:number;tag?:string|null;question:{message:string;createdAt?:number};answer:{message:string;createdAt?:number}|null;sendAt:number;isAnonymous:boolean;senderName:string;questionImages:{path:string}[];answerImages:{path:string}[]}
interface VtsuruPointGood {id:number;name:string;description:string;price:number;count?:number|null;tags:string[];status:number;type:number;coverUrl:string|null;canPurchase:boolean;cannotPurchaseReason:string|null}
interface VtsuruVideoCollect {id:string;shortId:string;name:string;description:string;createAt:number;startAt:number;endAt:number;videoCount:number;maxVideoCount:number;minVideoDuration:number;maxVideoDuration:number;allowedPartitions:string[];allowUnregisteredUser:boolean;maxVideoPerUser:number;requireDescription:boolean;isFinish:boolean}
interface VtsuruBiliProfile {name?:string;face?:string;sign?:string;top_photo?:string;top_photo_v2?:string;fans?:number;follower?:number;follower_count?:number;attention?:number;friend?:number;archive_count?:number;video?:number;likes?:number;like_num?:number;level?:number;pendant?:{image?:string;image_enhance?:string;image_enhance_frame?:string};nameplate?:{image?:string;name?:string};level_info?:{current_level?:number};official?:{title?:string;desc?:string};Official?:{title?:string;desc?:string};official_verify?:{desc?:string};vip?:{label?:{text?:string}}}
interface VtsuruSandboxSdk {
/** 当前主播、公开 B 站资料、主题与页面信息。 */
getContext():Promise<{streamer:{id:number;name:string;biliId:number;roomId:number;faceUrl:string;title:string;bio:string;isStreaming:boolean;enabledFeatures:string[]};bili:VtsuruBiliProfile|null;theme:VtsuruTheme;page:{slug:string|null;mode:'block'|'custom';immersive:boolean}}>;
/** 主播歌单，默认最多 50 首，limit 最大 100。 */
getSongs(filter?:{keyword?:string;language?:string;tag?:string;scOnly?:boolean;guardOnly?:boolean;offset?:number;limit?:number}):Promise<{total:number;items:VtsuruSong[];languages:string[];tags:string[]}>;
/** 当前点歌队列及公开点歌设置。 */
getSongRequestState():Promise<{songs:{id:number;songName:string;song?:VtsuruSong;status:number;from:number;createAt:number;finishAt?:number|null;requestBy?:string|null}[];setting:{orderPrefix:string;allowFromWeb:boolean;allowAnonymousFromWeb:boolean;enableOnStreaming:boolean;queueMaxSize:number}|null}>;
/** 主播日程与 B 站直播预约。 */
getSchedule(options?:{year?:number;week?:number}):Promise<{weeks:VtsuruScheduleWeek[];reserves:VtsuruReserve[];liveRoomUrl:string}>;
/** 签到排行，count 范围 1 至 100。 */
getCheckInRanking(options?:{count?:number;monthly?:boolean}):Promise<{keyword:string;totalRanking:VtsuruRankingItem[];monthlyRanking:VtsuruRankingItem[]}>;
/** 公开问答；匿名邮箱与认证身份不会返回。 */
getQuestions(options?:{tag?:string}):Promise<{tags:string[];questions:VtsuruQuestion[]}>;
/** 公开积分商品，不包含虚拟卡密与内部服务配置。 */
getPointGoods():Promise<VtsuruPointGood[]>;
/** 获取进行中的视频征集活动。 */
getVideoCollects():Promise<VtsuruVideoCollect[]>;
/** 同步读取当前页面绑定资源的 URL，找不到时返回 null。 */
getAssetUrl(key:string):string|null;
/** 宿主确认后提交网页点歌；仅指令点歌时复制指令。 */
requestSong(keyOrName:string):Promise<{action:'copied'|'requested'|'cancelled';message:string}>;
/** 打开带验证码的原生提问箱。 */
openQuestionBox(defaultTag?:string):Promise<void>;
/** 跳转当前主播主页、子页面或指定站内功能。 */
navigate(target:string):Promise<void>;
/** 复制最多 500 字符并展示宿主提示。 */
copyText(text:string):Promise<boolean>;
/** 宿主提示，同一实例 1.5 秒内最多显示一次。 */
toast(message:string,type?:'info'|'success'|'warning'|'error'):Promise<void>;
/** 监听站点主题变化。 */
onThemeChange(callback:(theme:VtsuruTheme)=>void):()=>void;
/** 通知宿主更新当前沙盒的内容高度。 */
reportHeight(height:number):void;
} interface Window {readonly vtsuru:VtsuruSandboxSdk} declare const vtsuru:VtsuruSandboxSdk;`

type BridgeRequest = {
  __vtsuruBridge: true
  channelId: string
  direction: string
  requestId: number
  method: CustomHtmlBridgeMethod
  params?: unknown
  height?: number
  error?: string
}

export function createSandboxSdkSource(channelId: string, assets: Record<string, string> = {}) {
  return `(()=>{const channel=${JSON.stringify(channelId)},assets=Object.freeze(${JSON.stringify(assets).replaceAll('<', '\\u003c')}),pending=new Map(),listeners=new Set();let id=0;
addEventListener('message',e=>{if(e.source!==parent)return;const m=e.data;if(!m||m.__vtsuruBridge!==true||m.channelId!==channel)return;
if(m.direction==='event'&&m.event==='theme-change'){const theme=m.payload,style=document.documentElement.style;style.setProperty('--foreground',theme.fgColor);style.setProperty('--muted-foreground',theme.mutedColor);style.setProperty('--background',theme.bgColor);style.setProperty('--popover',theme.cardBg);style.setProperty('--border',theme.borderColor);style.setProperty('--primary',theme.primaryColor);style.setProperty('--primary-readable',theme.accentColor);style.colorScheme=theme.isDark?'dark':'light';for(const fn of listeners)try{fn(theme)}catch(error){console.error(error)}return}
if(m.direction!=='to-sandbox')return;const p=pending.get(m.requestId);if(!p)return;pending.delete(m.requestId);clearTimeout(p.timer);m.ok?p.resolve(m.data):p.reject(Error(m.error||'Bridge request failed'))});
const call=(method,params)=>new Promise((resolve,reject)=>{const requestId=++id,timer=setTimeout(()=>{pending.delete(requestId);reject(Error('Bridge request timed out'))},15000);pending.set(requestId,{resolve,reject,timer});parent.postMessage({__vtsuruBridge:true,channelId:channel,direction:'to-host',requestId,method,params},'*')});
const sdk={};for(const method of ['getContext','getSongs','getSongRequestState','getSchedule','getCheckInRanking','getQuestions','getPointGoods','getVideoCollects'])sdk[method]=params=>call(method,params);
sdk.getAssetUrl=key=>Object.hasOwn(assets,key)?assets[key]:null;sdk.requestSong=value=>call('requestSong',value);sdk.openQuestionBox=value=>call('openQuestionBox',value);sdk.navigate=value=>call('navigate',value);sdk.copyText=value=>call('copyText',value);sdk.toast=(message,type='info')=>call('toast',{message,type});
sdk.onThemeChange=fn=>{listeners.add(fn);return()=>listeners.delete(fn)};sdk.reportHeight=height=>parent.postMessage({__vtsuruBridge:true,channelId:channel,direction:'height',height},'*');Object.defineProperty(window,'vtsuru',{value:Object.freeze(sdk),writable:false,configurable:false})})()`
}

export function attachCustomHtmlBridge(options: {
  frame: HTMLIFrameElement
  channelId: string
  handlers: CustomHtmlBridgeHandlers
  maxTokens?: number
  refillPerSecond?: number
  onHeight?: (height: number) => void
  onError?: (error: string) => void
}) {
  const capacity = options.maxTokens ?? 20,
    refill = options.refillPerSecond ?? 10
  let tokens = capacity,
    updatedAt = performance.now(),
    active = true
  const send = (message: Record<string, unknown>) =>
    options.frame.contentWindow?.postMessage(
      toCloneable({ __vtsuruBridge: true, channelId: options.channelId, ...message }),
      '*',
    )
  const listener = (event: MessageEvent) => {
    if (event.source !== options.frame.contentWindow) return
    const request = event.data as BridgeRequest
    if (!request || request.__vtsuruBridge !== true || request.channelId !== options.channelId) return
    if (request.direction === 'height') {
      if (Number.isFinite(request.height) && request.height! > 0) options.onHeight?.(Math.ceil(request.height!))
      return
    }
    if (request.direction === 'error') {
      if (typeof request.error === 'string') options.onError?.(request.error.slice(0, 500))
      return
    }
    if (
      request.direction !== 'to-host' ||
      !Number.isSafeInteger(request.requestId) ||
      request.requestId <= 0 ||
      typeof request.method !== 'string'
    )
      return
    const respond = (ok: boolean, data?: unknown, error?: string) => {
      if (active) send({ direction: 'to-sandbox', requestId: request.requestId, ok, data, error })
    }
    const now = performance.now()
    tokens = Math.min(capacity, tokens + (Math.max(0, now - updatedAt) / 1000) * refill)
    updatedAt = now
    if (tokens < 1) {
      respond(false, undefined, 'Rate limit exceeded')
      return
    }
    tokens -= 1
    const handler = Object.hasOwn(options.handlers, request.method) ? options.handlers[request.method] : undefined
    if (!handler) {
      respond(false, undefined, 'Unsupported bridge method')
      return
    }
    Promise.resolve()
      .then(() => handler(request.params))
      .then((data) => respond(true, data))
      .catch((error: unknown) => respond(false, undefined, error instanceof Error ? error.message : String(error)))
  }
  window.addEventListener('message', listener)
  return Object.assign(
    () => {
      active = false
      window.removeEventListener('message', listener)
    },
    {
      emitThemeChange(theme: VtsuruSandboxSdkTheme) {
        if (active) send({ direction: 'event', event: 'theme-change', payload: theme })
      },
      emitContextChange(context: unknown) {
        if (active) send({ direction: 'event', event: 'context-change', payload: context })
      },
    },
  )
}
