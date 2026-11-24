// Tauri client 版本识别与统一能力/最低版本检查接口
//
// 前端 bundle 部署在服务器 (frontendDist = https://vtsuru.suki.club/client/), 会被任意版本的
// client 本体加载。新前端可能依赖新 client 才有的原生能力 (如工具管理需要 0.1.14)。
// 这里在运行时拿到当前 client 版本与 Rust 能力清单, 供各处做统一门禁与升级提示。
import { invoke } from '@tauri-apps/api/core'
import { ref } from 'vue'

import { isTauri } from './api'

// 前端所需的最低 client 版本。提升某项原生能力的依赖时, 把这里抬到对应发布版本。
export const REQUIRED_CLIENT_VERSION = '0.1.14'
// 全局快捷键 (VTS 操作台格子快捷键) 起始可用版本
export const GLOBAL_SHORTCUT_MIN_CLIENT_VERSION = '0.1.8'
// 开放 RPC 接口 (含 /health CORS + PNA 预检) 起始可用的 client 版本
export const RPC_MIN_CLIENT_VERSION = '0.1.9'
// 本地直播音频提取和实时语音转写起始可用版本
export const TRANSCRIPTION_MIN_CLIENT_VERSION = '0.1.11'
// 托管工具探测 / OBS 配置读写 / 一键启停 / 端口探测 / 能力检查接口起始可用版本
export const TOOL_MANAGER_MIN_CLIENT_VERSION = '0.1.14'

export interface ClientCapabilitiesSnapshot {
  version: string
  apiLevel: number
  os: string
  arch: string
  features: string[]
}

export interface ClientFeatureRequirement {
  minVersion: string
  label: string
  description: string
  /** 若填写, 当 Rust 宿主已上报 capabilities 时会额外核对原生特性开关 */
  nativeFeature?: string
}

export const CLIENT_FEATURES = {
  'global-shortcut': {
    minVersion: GLOBAL_SHORTCUT_MIN_CLIENT_VERSION,
    label: '全局快捷键',
    description: '在后台使用系统级快捷键控制 VTS、OBS 与直播浮窗',
    nativeFeature: 'global_shortcut',
  },
  rpc: {
    minVersion: RPC_MIN_CLIENT_VERSION,
    label: '本地 RPC 桥接',
    description: '允许网页版中控与 OBS 场景编辑器联动本地 OBS / VTS',
    nativeFeature: 'rpc',
  },
  transcription: {
    minVersion: TRANSCRIPTION_MIN_CLIENT_VERSION,
    label: '本地音频提取与转写',
    description: '由桌面壳托管 FFmpeg 提取直播音频并实时转写',
    nativeFeature: 'transcription',
  },
  'tool-manager': {
    minVersion: TOOL_MANAGER_MIN_CLIENT_VERSION,
    label: '工具自动探测与一键启停',
    description: '自动检测 OBS / VTS 安装路径、运行状态、插件环境并一键拉起',
    nativeFeature: 'tool_discovery',
  },
  'obs-config': {
    minVersion: TOOL_MANAGER_MIN_CLIENT_VERSION,
    label: 'OBS 配置自动读写',
    description: '自动读取或一键开启 OBS WebSocket 端口与密码，无需手动复制',
    nativeFeature: 'obs_config_read',
  },
  'vts-config': {
    minVersion: TOOL_MANAGER_MIN_CLIENT_VERSION,
    label: 'VTS 本地目录与环境检测',
    description: '快速打开 VTS 模型/道具/配置目录并检测插件 API 状态',
    nativeFeature: 'vts_config_read',
  },
  'port-probe': {
    minVersion: TOOL_MANAGER_MIN_CLIENT_VERSION,
    label: '本地端口连通性探测',
    description: '检测 OBS WebSocket / VTS API 等本地端口是否就绪',
    nativeFeature: 'port_probe',
  },
} as const satisfies Record<string, ClientFeatureRequirement>

export type ClientFeatureKey = keyof typeof CLIENT_FEATURES

export type ClientVersionBlockReason = 'not-tauri' | 'version-unknown' | 'outdated' | 'missing-capability'

export interface ClientVersionCheckResult {
  supported: boolean
  isTauriEnv: boolean
  currentVersion: string | undefined
  requiredVersion: string
  feature?: ClientFeatureKey
  label?: string
  reason?: ClientVersionBlockReason
  message?: string
}

// 当前运行的 client 版本 (非 Tauri 环境为 undefined); 由 initClientVersion 填充
export const clientVersion = ref<string | undefined>()
// Rust 0.1.14+ 返回的原生能力快照 (旧壳或非 Tauri 环境为 null)
export const clientCapabilities = ref<ClientCapabilitiesSnapshot | null>(null)

/** 比较语义化版本: a<b 返回负, 相等返回 0, a>b 返回正 */
export function compareVersion(a: string, b: string): number {
  const pa = a.split('.').map((part) => Number.parseInt(part, 10) || 0)
  const pb = b.split('.').map((part) => Number.parseInt(part, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

/** 当前 client 版本是否 >= 指定版本 (非 Tauri 或版本未知时返回 false) */
export function isClientAtLeast(version: string): boolean {
  return !!clientVersion.value && compareVersion(clientVersion.value, version) >= 0
}

/** 统一最低版本检查接口 */
export function checkClientMinVersion(
  requiredVersion: string,
  options?: { feature?: ClientFeatureKey; label?: string; nativeFeature?: string },
): ClientVersionCheckResult {
  const isTauriEnv = isTauri()
  const currentVersion = clientVersion.value
  const label = options?.label

  if (!isTauriEnv) {
    return {
      supported: false,
      isTauriEnv: false,
      currentVersion: undefined,
      requiredVersion,
      feature: options?.feature,
      label,
      reason: 'not-tauri',
      message: `${label ?? '此功能'}需要桌面客户端（≥ v${requiredVersion}）`,
    }
  }

  if (!currentVersion) {
    return {
      supported: false,
      isTauriEnv: true,
      currentVersion: undefined,
      requiredVersion,
      feature: options?.feature,
      label,
      reason: 'version-unknown',
      message: `无法识别当前客户端版本，${label ?? '此功能'}需要客户端 ≥ v${requiredVersion}`,
    }
  }

  if (compareVersion(currentVersion, requiredVersion) < 0) {
    return {
      supported: false,
      isTauriEnv: true,
      currentVersion,
      requiredVersion,
      feature: options?.feature,
      label,
      reason: 'outdated',
      message: `${label ?? '此功能'}需要客户端 ≥ v${requiredVersion}（当前 v${currentVersion}），请更新客户端`,
    }
  }

  if (
    options?.nativeFeature &&
    clientCapabilities.value &&
    !clientCapabilities.value.features.includes(options.nativeFeature)
  ) {
    return {
      supported: false,
      isTauriEnv: true,
      currentVersion,
      requiredVersion,
      feature: options?.feature,
      label,
      reason: 'missing-capability',
      message: `当前客户端构建未包含「${label ?? options.nativeFeature}」原生能力，请更新至 ≥ v${requiredVersion}`,
    }
  }

  return {
    supported: true,
    isTauriEnv: true,
    currentVersion,
    requiredVersion,
    feature: options?.feature,
    label,
  }
}

/** 统一特性能力检查接口 */
export function checkClientFeature(feature: ClientFeatureKey): ClientVersionCheckResult {
  const req = CLIENT_FEATURES[feature]
  return checkClientMinVersion(req.minVersion, {
    feature,
    label: req.label,
    nativeFeature: req.nativeFeature,
  })
}

/** client 本体是否够新 (满足前端所需最低版本) */
export function isClientUpToDate(): boolean {
  return isClientAtLeast(REQUIRED_CLIENT_VERSION)
}

/** 当前 client 是否支持开放 RPC 接口 */
export function clientSupportsRpc(): boolean {
  return checkClientFeature('rpc').supported
}

/** 当前 client 是否支持本地直播转写 */
export function clientSupportsTranscription(): boolean {
  return checkClientFeature('transcription').supported
}

/** 当前 client 是否支持本地工具探测与启停管理 (0.1.14+) */
export function clientSupportsToolManager(): boolean {
  return checkClientFeature('tool-manager').supported
}

/** 拉取 Rust 0.1.14+ 原生能力清单 (旧壳无此命令时静默返回 null) */
export async function initClientCapabilities(): Promise<ClientCapabilitiesSnapshot | null> {
  if (!isTauri()) return null
  if (!isClientAtLeast(TOOL_MANAGER_MIN_CLIENT_VERSION)) {
    clientCapabilities.value = null
    return null
  }
  try {
    const caps = await invoke<ClientCapabilitiesSnapshot>('get_client_capabilities')
    clientCapabilities.value = caps
    return caps
  } catch {
    clientCapabilities.value = null
    return null
  }
}

/** 读取并缓存当前 client 版本及原生能力 (仅 Tauri 环境有效) */
export async function initClientVersion(): Promise<string | undefined> {
  if (!isTauri()) return undefined
  const { getVersion } = await import('@tauri-apps/api/app')
  clientVersion.value = await getVersion()
  await initClientCapabilities()
  return clientVersion.value
}
