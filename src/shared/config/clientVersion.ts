// Tauri client 版本识别
//
// 前端 bundle 部署在服务器 (frontendDist = https://vtsuru.suki.club/client/), 会被任意版本的
// client 本体加载。新前端可能依赖新 client 才有的原生能力 (如开放 RPC 接口 / CORS 需要 0.1.9)。
// 这里在运行时拿到当前 client 版本, 与前端所需的最低版本比对, 供各处做能力门禁与升级提示。
import { ref } from 'vue'

import { isTauri } from './api'

// 前端所需的最低 client 版本。提升某项原生能力的依赖时, 把这里抬到对应发布版本。
export const REQUIRED_CLIENT_VERSION = '0.1.9'
// 开放 RPC 接口 (含 /health CORS + PNA 预检) 起始可用的 client 版本
export const RPC_MIN_CLIENT_VERSION = '0.1.9'
// 本地直播音频提取和实时语音转写起始可用版本
export const TRANSCRIPTION_MIN_CLIENT_VERSION = '0.1.11'

// 当前运行的 client 版本 (非 Tauri 环境为 undefined); 由 initClientVersion 填充
export const clientVersion = ref<string | undefined>()

/** 比较语义化版本: a<b 返回负, 相等返回 0, a>b 返回正 */
export function compareVersion(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
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

/** client 本体是否够新 (满足前端所需最低版本) */
export function isClientUpToDate(): boolean {
  return isClientAtLeast(REQUIRED_CLIENT_VERSION)
}

/** 当前 client 是否支持开放 RPC 接口 */
export function clientSupportsRpc(): boolean {
  return isClientAtLeast(RPC_MIN_CLIENT_VERSION)
}

/** 当前 client 是否支持本地直播转写 */
export function clientSupportsTranscription(): boolean {
  return isClientAtLeast(TRANSCRIPTION_MIN_CLIENT_VERSION)
}

/** 读取并缓存当前 client 版本 (仅 Tauri 环境有效) */
export async function initClientVersion(): Promise<string | undefined> {
  if (!isTauri()) return undefined
  const { getVersion } = await import('@tauri-apps/api/app')
  clientVersion.value = await getVersion()
  return clientVersion.value
}
