// 开放 RPC 接口契约 —— 唯一真源
//
// Tauri 客户端 (server 端) 与外部网页 (client 端) 都 import 本文件, 从而获得端到端强类型。
// 新增一个开放接口 = 在 ServerFunctions 里加一个方法签名 + 在 server 实现里补上对应函数,
// Rust 中继层完全无需改动。
import type { EventModel } from '@/api/client-types'

/** 事件订阅时可选的事件名 (与 useDanmakuClient 的 MODEL_EVENT_NAMES 对齐) */
export type DanmakuEventName = 'danmaku' | 'gift' | 'sc' | 'guard' | 'enter' | 'scDel' | 'follow' | 'like'

export const DANMAKU_EVENT_NAMES: readonly DanmakuEventName[] = [
  'danmaku',
  'gift',
  'sc',
  'guard',
  'enter',
  'scDel',
  'follow',
  'like',
]

/** 发送类结果 (0 表示成功, 与 B 站 API code 语义一致) */
export interface SendResult {
  code: number
  message?: string
}

export interface RpcObsStatus {
  connected: boolean
  address: string
  scenes: string[]
  currentScene: string
  baseWidth: number
  baseHeight: number
}

export interface RpcObsSceneItemRef {
  sceneItemId: number
  sourceName: string
  inputKind: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  enabled: boolean
}

export interface RpcObsSceneItemsResult {
  sceneName: string
  baseWidth: number
  baseHeight: number
  items: RpcObsSceneItemRef[]
}

export interface RpcObsUpsertBrowserSourceParams {
  sceneName: string
  sourceName: string
  url: string
  width: number
  height: number
}

export interface RpcObsUpsertBrowserSourceResult {
  ok: boolean
  created?: boolean
  sceneItemId?: number
  message?: string
}

export interface RpcObsSourceScreenshotParams {
  sourceName: string
  width?: number
  height?: number
}

export interface RpcObsSourceScreenshotResult {
  ok: boolean
  imageData?: string
  message?: string
}

export type RpcObsSceneLayoutItem =
  | {
      kind: 'browser-slot'
      sourceName: string
      url: string
      width: number
      height: number
    }
  | {
      kind: 'obs-source'
      sourceName: string
      visible: boolean
      applyTransform: boolean
      x: number
      y: number
      width: number
      height: number
      rotation: number
      crop?: {
        top: number
        right: number
        bottom: number
        left: number
      }
    }

export interface RpcObsSyncSceneLayoutParams {
  sceneName: string
  canvasWidth: number
  canvasHeight: number
  /** bottom -> top 顺序 */
  items: RpcObsSceneLayoutItem[]
  /** 跨子场景保留但当前子场景为空的浏览器源（如需要自动补建但不销毁） */
  unusedBrowserSlots?: Array<{
    sourceName: string
    url: string
    width: number
    height: number
  }>
}

export interface RpcObsSyncSceneLayoutResult {
  ok: boolean
  message?: string
  warnings?: string[]
  syncedCount?: number
}

export interface RpcObsFilterCapabilities {
  filterKinds: string[]
  hasShaderFilter: boolean
  hasCompositeBlur: boolean
  canStageLocalAssets: boolean
}

export interface RpcObsManagedFilterItem {
  filterName: string
  filterKind: string
  enabled: boolean
  settings: Record<string, unknown>
}

export interface RpcObsSyncFiltersParams {
  /** 目标 OBS 源名（可以是场景名，也可以是单个输入源名） */
  sourceName: string
  managedPrefix?: string
  filters: RpcObsManagedFilterItem[]
}

export interface RpcObsSyncFiltersResult {
  ok: boolean
  message?: string
  appliedCount?: number
  warnings?: string[]
}

export interface RpcObsStageFilterAssetParams {
  /** 期望文件名（自动清理并限定扩展名：.cube/.png/.shader/.effect/.hlsl） */
  fileName: string
  /** 文本内容（.cube / .shader） */
  content?: string
  /** 远程 URL（二进制 .png / .cube / .shader 等，客户端下载并落盘） */
  url?: string
}

export interface RpcObsStageFilterAssetResult {
  ok: boolean
  localPath?: string
  message?: string
}

export interface RpcVtsStatus {
  connected: boolean
  modelName: string | null
  presets: Array<{ id: string; name: string }>
  expressions: Array<{ file: string; name: string; active: boolean }>
  hotkeys: Array<{ hotkeyID: string; name: string; type: string }>
  macros: Array<{ id: string; name: string }>
  obsLinkEnabled: boolean
}

export interface RpcVtsSceneActionParams {
  presetId?: string
  expressionFile?: string
  expressionActive?: boolean
  hotkeyId?: string
  macroId?: string
}

/**
 * ServerFunctions —— 由 Tauri 客户端实现, 供外部网页调用。
 * 加接口就在这里加一行, 两端自动获得类型提示。
 */
export interface ServerFunctions {
  /** 探测/握手: 返回客户端信息与当前登录账号, 供外部页面确认可用性 */
  hello: () => Promise<{ version: string; accountId?: number; uid?: number }>

  /** 订阅弹幕事件流。订阅后服务端通过 ClientFunctions.onDanmakuEvent 持续推送 */
  danmakuSubscribe: (events: DanmakuEventName[]) => Promise<{ ok: true }>
  /** 取消订阅 */
  danmakuUnsubscribe: () => Promise<{ ok: true }>

  /** 发送直播弹幕 (写操作, 需授权) */
  danmakuSend: (roomId: number, message: string) => Promise<SendResult>
  /** 发送私信 (写操作, 需授权) */
  messageSend: (userId: number, message: string) => Promise<SendResult>

  /** OBS 场景联动接口 */
  obsGetStatus: () => Promise<RpcObsStatus>
  obsSwitchScene: (sceneName: string) => Promise<{ ok: boolean; message?: string }>
  obsGetSceneItems: (sceneName?: string) => Promise<RpcObsSceneItemsResult>
  obsUpsertBrowserSource: (params: RpcObsUpsertBrowserSourceParams) => Promise<RpcObsUpsertBrowserSourceResult>
  obsGetSourceScreenshot: (params: RpcObsSourceScreenshotParams) => Promise<RpcObsSourceScreenshotResult>
  obsSyncSceneLayout: (params: RpcObsSyncSceneLayoutParams) => Promise<RpcObsSyncSceneLayoutResult>
  obsGetFilterCapabilities: () => Promise<RpcObsFilterCapabilities>
  obsSyncSourceFilters: (params: RpcObsSyncFiltersParams) => Promise<RpcObsSyncFiltersResult>
  obsStageFilterAsset: (params: RpcObsStageFilterAssetParams) => Promise<RpcObsStageFilterAssetResult>
  obsSaveReplayBuffer: () => Promise<{ ok: boolean; savedPath?: string; message: string }>
  obsSubscribeEvents: () => Promise<{ ok: true }>
  obsUnsubscribeEvents: () => Promise<{ ok: true }>

  /** VTube Studio 状态与动作代理接口 */
  vtsGetStatus: () => Promise<RpcVtsStatus>
  vtsRunSceneAction: (params: RpcVtsSceneActionParams) => Promise<{ ok: boolean; message?: string }>
  vtsLoadModel: (modelId: string) => Promise<{ ok: boolean; message?: string }>
  vtsTintModel: (params: {
    colorHex?: string
    rainbow?: boolean
    reset?: boolean
    nameContains?: string[]
  }) => Promise<{ ok: boolean; message?: string }>
  vtsDropItem: (params: {
    fileName: string
    x?: number
    size?: number
    randomX?: boolean
  }) => Promise<{ ok: boolean; message?: string }>
  vtsInjectParameters: (params: {
    values: Array<{ id: string; value: number; weight?: number }>
    mode?: 'add' | 'set'
  }) => Promise<{ ok: boolean; message?: string }>
  vtsSubscribeEvents: () => Promise<{ ok: true }>
  vtsUnsubscribeEvents: () => Promise<{ ok: true }>

  /** TTS 播报代理接口 */
  ttsSpeak: (text: string) => Promise<{ ok: boolean; message?: string }>
}

/**
 * ClientFunctions —— 由外部网页实现, 供 Tauri 客户端 (server) 反向调用 / 推送。
 * 这些是 fire-and-forget 事件 (见 EVENT_NAMES), 不等待返回。
 */
export interface ClientFunctions {
  /** 服务端推送的弹幕事件 */
  onDanmakuEvent: (eventName: DanmakuEventName, data: EventModel) => void
  /** OBS 当前场景变化推送 */
  onObsSceneChanged?: (sceneName: string) => void
  /** OBS 连接/场景列表状态变化推送 */
  onObsStatusChanged?: (status: RpcObsStatus) => void
  /** VTS 连接/模型/预设列表变化推送 */
  onVtsStatusChanged?: (status: RpcVtsStatus) => void
}

/** birpc eventNames: 声明为单向事件的方法 (调用即发, 不等 round-trip) */
export const CLIENT_EVENT_NAMES = [
  'onDanmakuEvent',
  'onObsSceneChanged',
  'onObsStatusChanged',
  'onVtsStatusChanged',
] as const

/** 本地 RPC 服务监听端口 (须与 Rust rpc_server.rs 的 RPC_PORT 保持一致) */
export const RPC_PORT = 29304
export const RPC_HEALTH_URL = `http://127.0.0.1:${RPC_PORT}/health`
export const RPC_WS_URL = `ws://127.0.0.1:${RPC_PORT}/rpc`
