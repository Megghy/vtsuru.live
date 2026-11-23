import type { ObsWidgetTheme } from '@/apps/obs-store/components/shared/theme'

export type LiveHudLayout = 'pill' | 'card' | 'vertical'
export type LiveHudSize = 'compact' | 'standard'

export type LiveHudMetricKey =
  | 'onlineRank'
  | 'totalLikes'
  | 'watchedCount'
  | 'fansCount'
  | 'guardCount'
  | 'liveDuration'
  | 'danmakuCount'

export interface LiveHudMetrics {
  isLive: boolean
  liveStartAt: number
  onlineRank: number
  totalLikes: number
  watchedCount: number
  fansCount: number
  guardCount: number
  danmakuCount: number
  updatedAt: number
}

export interface LiveHudState {
  theme: ObsWidgetTheme
  layout: LiveHudLayout
  size: LiveHudSize
  accentColor: string
  fontFamily: string
  showLiveDot: boolean
  liveLabel: string
  useSampleData: boolean
  visibleMetrics: Record<LiveHudMetricKey, boolean>
  metrics: LiveHudMetrics
}

export type LiveHudAction = { type: 'PULSE_REFRESH' }

export interface LiveHudMetricMeta {
  key: LiveHudMetricKey
  label: string
  shortLabel: string
}

export const LIVE_HUD_METRIC_LIST: LiveHudMetricMeta[] = [
  { key: 'onlineRank', label: '高能在线', shortLabel: '在线' },
  { key: 'totalLikes', label: '本场点赞', shortLabel: '点赞' },
  { key: 'watchedCount', label: '累计看过', shortLabel: '看过' },
  { key: 'fansCount', label: '粉丝数', shortLabel: '粉丝' },
  { key: 'guardCount', label: '当前总舰长', shortLabel: '舰长' },
  { key: 'liveDuration', label: '开播时长', shortLabel: '时长' },
  { key: 'danmakuCount', label: '本场弹幕', shortLabel: '弹幕' },
]

export const SAMPLE_LIVE_HUD_METRICS: LiveHudMetrics = {
  isLive: true,
  liveStartAt: 0,
  onlineRank: 1286,
  totalLikes: 38420,
  watchedCount: 19650,
  fansCount: 54280,
  guardCount: 92,
  danmakuCount: 4318,
  updatedAt: 0,
}

export const DEFAULT_LIVE_HUD_STATE: LiveHudState = {
  theme: 'card',
  layout: 'pill',
  size: 'standard',
  accentColor: '#38bdf8',
  fontFamily: '',
  showLiveDot: true,
  liveLabel: 'LIVE',
  useSampleData: true,
  visibleMetrics: {
    onlineRank: true,
    totalLikes: true,
    watchedCount: false,
    fansCount: true,
    guardCount: true,
    liveDuration: true,
    danmakuCount: false,
  },
  metrics: {
    isLive: false,
    liveStartAt: 0,
    onlineRank: 0,
    totalLikes: 0,
    watchedCount: 0,
    fansCount: 0,
    guardCount: 0,
    danmakuCount: 0,
    updatedAt: 0,
  },
}

export function normalizeEpochMs(ts?: number | null): number {
  if (!ts || ts <= 0) return 0
  return ts > 1_000_000_000_000 ? ts : ts * 1000
}

export function formatHudCount(value: number): string {
  const safe = Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0
  if (safe >= 100_000_000) return `${(safe / 100_000_000).toFixed(1)}亿`
  if (safe >= 10_000) return `${(safe / 10_000).toFixed(1)}万`
  return safe.toLocaleString('zh-CN')
}

export function formatLiveDuration(startAtMs: number, nowMs: number): string {
  if (!startAtMs || startAtMs <= 0) return '00:00:00'
  const diffSec = Math.max(0, Math.floor((nowMs - startAtMs) / 1000))
  const hours = Math.floor(diffSec / 3600)
  const minutes = Math.floor((diffSec % 3600) / 60)
  const seconds = diffSec % 60
  return [hours, minutes, seconds].map((n) => String(n).padStart(2, '0')).join(':')
}
