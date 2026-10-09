import { firstQueryValue } from '@/shared/obs/obsUrl'

export const OBS_SYNC_CHANNEL_HINT = '实例名仅支持字母、数字、下划线和短横线，最长 64 位'
const CHANNEL = /^[a-zA-Z0-9_-]{1,64}$/

export function isObsSyncChannel(value: string) {
  return CHANNEL.test(value)
}

export function resolveObsSyncChannel(value: unknown) {
  const raw = firstQueryValue(value).trim()
  return raw && isObsSyncChannel(raw) ? raw : 'default'
}

export function parseObsSyncChannel(value: string) {
  const next = value.trim() || 'default'
  return isObsSyncChannel(next) ? next : undefined
}
