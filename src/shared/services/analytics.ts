import type { PostHog } from 'posthog-js'
import type { RouteLocationNormalized } from 'vue-router'

import type { ResponseAccountInfo } from '@/api/generated/model'
import { isTauri } from '@/shared/config'

const POSTHOG_KEY =
  import.meta.env.VITE_POSTHOG_KEY?.trim() || 'phc_xoWy9iMXuhtqNAiw6hguyrjvGmy9KnXXSAWZpWBdpS76'
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST?.trim() || 'https://us.i.posthog.com'

type AnalyticsPropValue = string | number | boolean | null | string[]
export type AnalyticsEventProps = Record<string, AnalyticsPropValue | undefined>

let posthogClient: PostHog | null = null
let initPromise: Promise<PostHog | null> | null = null
let lastIdentifiedKey: string | null = null
let pendingIdentifyAccount: ResponseAccountInfo | null = null
let lastPageKey = ''

const pendingEvents: Array<{ event: string; props: Record<string, AnalyticsPropValue> }> = []
const MAX_PENDING_EVENTS = 30

// 将路由名归一为稳定的功能 key，便于在 PostHog 中按 feature 统计独立用户数
const ROUTE_FEATURE_MAP: Record<string, { feature: string; label: string; section: string }> = {
  'manage-index': { feature: 'manage-dashboard', label: '管理面板', section: 'manage' },
  'manage-userPageBuilder': { feature: 'user-page-builder', label: '主页装修', section: 'manage' },
  'manage-obsSceneEditor': { feature: 'obs-scene-editor', label: 'OBS 场景编辑器', section: 'manage' },
  'manage-obsStore': { feature: 'obs-store', label: 'OBS 组件库', section: 'manage' },
  'manage-danmuji': { feature: 'danmuji', label: '弹幕机', section: 'manage' },
  'manage-questionBox': { feature: 'question-box', label: '提问箱', section: 'manage' },
  'manage-songList': { feature: 'song-list', label: '歌单', section: 'manage' },
  'manage-schedule': { feature: 'schedule', label: '日程表', section: 'manage' },
  'manage-liveRequest': { feature: 'live-request', label: '点播', section: 'manage' },
  'manage-musicRequest': { feature: 'music-request', label: '点歌机', section: 'manage' },
  'manage-liveQueue': { feature: 'live-queue', label: '排队', section: 'manage' },
  'manage-liveLottery': { feature: 'live-lottery', label: '弹幕抽奖', section: 'manage' },
  'manage-lottery': { feature: 'dynamic-lottery', label: '动态抽奖', section: 'manage' },
  'manage-speech': { feature: 'speech-tts', label: '读弹幕', section: 'manage' },
  'manage-danmakuVote': { feature: 'danmaku-vote', label: '弹幕投票', section: 'manage' },
  'manage-videoCollect': { feature: 'video-collect', label: '视频征集', section: 'manage' },
  'manage-point': { feature: 'point', label: '积分和礼物', section: 'manage' },
  'manage-event': { feature: 'guard-sc', label: '舰长和SC', section: 'manage' },
  'manage-live': { feature: 'live-record', label: '直播记录', section: 'manage' },
  'manage-analyze': { feature: 'live-analyze', label: '直播数据', section: 'manage' },
  'manage-history': { feature: 'history', label: '历史记录', section: 'manage' },
  'manage-qqBot': { feature: 'qq-bot', label: 'QQ 群机器人', section: 'manage' },
  'manage-tools-dashboard': { feature: 'tools-dashboard', label: '工具箱', section: 'manage' },
  'manage-feedback': { feature: 'feedback', label: '反馈', section: 'manage' },
  'live-dashboard': { feature: 'live-dashboard', label: '中控台', section: 'live' },
  'org-index': { feature: 'org', label: '组织', section: 'org' },
  'org-detail': { feature: 'org', label: '组织', section: 'org' },
}

function canInitPostHog(): boolean {
  if (typeof window === 'undefined' || !POSTHOG_KEY) return false
  if (import.meta.env.VITE_POSTHOG_ENABLE_DEV === 'true') return true
  if (import.meta.env.DEV || import.meta.env.MODE === 'development') return false
  const host = window.location.hostname
  if (host === 'localhost' || host === '127.0.0.1') return false
  return true
}

function sanitizeProps(props: AnalyticsEventProps): Record<string, AnalyticsPropValue> {
  const result: Record<string, AnalyticsPropValue> = {}
  for (const [key, value] of Object.entries(props)) {
    if (value !== undefined) result[key] = value
  }
  return result
}

function applyIdentify(client: PostHog, account: ResponseAccountInfo) {
  if (!account?.id) return
  const enabledFunctions = Array.isArray(account.settings?.enableFunctions)
    ? account.settings.enableFunctions.map(String)
    : []
  const sig = `${account.id}|${account.name ?? ''}|${Boolean(account.isBiliVerified)}|${enabledFunctions.join(',')}`
  if (lastIdentifiedKey === sig) return
  lastIdentifiedKey = sig

  client.identify(String(account.id), {
    name: account.name || undefined,
    is_bili_verified: Boolean(account.isBiliVerified),
    is_email_verified: account.isEmailVerified !== false,
    enabled_functions: enabledFunctions,
    enabled_functions_count: enabledFunctions.length,
  })
}

export function initAnalytics(): Promise<PostHog | null> {
  if (posthogClient) return Promise.resolve(posthogClient)
  if (initPromise) return initPromise
  if (!canInitPostHog()) return Promise.resolve(null)

  initPromise = import('posthog-js')
    .then((mod) => {
      const client = (mod.default ?? mod) as PostHog
      client.init(POSTHOG_KEY, {
        api_host: POSTHOG_HOST,
        person_profiles: 'identified_only',
        capture_pageview: false,
        capture_pageleave: true,
        autocapture: false,
        disable_session_recording: true,
        persistence: 'localStorage+cookie',
      })
      posthogClient = client

      if (pendingIdentifyAccount?.id) {
        applyIdentify(client, pendingIdentifyAccount)
        pendingIdentifyAccount = null
      }

      if (pendingEvents.length > 0) {
        for (const item of pendingEvents.splice(0, pendingEvents.length)) {
          client.capture(item.event, item.props)
        }
      }

      return client
    })
    .catch((err) => {
      console.warn('[analytics] PostHog 初始化失败', err)
      initPromise = null
      return null
    })

  return initPromise
}

export function identifyAnalyticsUser(account: ResponseAccountInfo | null | undefined) {
  if (!account?.id) return
  if (posthogClient) {
    applyIdentify(posthogClient, account)
    return
  }
  pendingIdentifyAccount = account
}

export function resetAnalyticsUser() {
  lastIdentifiedKey = null
  pendingIdentifyAccount = null
  posthogClient?.reset()
}

export function captureAnalyticsEvent(event: string, props: AnalyticsEventProps = {}) {
  if (!canInitPostHog()) return
  const cleanProps = sanitizeProps(props)
  if (posthogClient) {
    posthogClient.capture(event, cleanProps)
    return
  }
  if (pendingEvents.length < MAX_PENDING_EVENTS) {
    pendingEvents.push({ event, props: cleanProps })
  }
}

function resolveRouteFeature(to: RouteLocationNormalized): {
  feature?: string
  label?: string
  section: string
} {
  const routeName = to.name?.toString() ?? ''
  const parentName = typeof to.meta.parent === 'string' ? to.meta.parent : ''
  const matched = ROUTE_FEATURE_MAP[routeName] ?? ROUTE_FEATURE_MAP[parentName]
  if (matched) return matched

  if (to.path.startsWith('/manage/tools/')) {
    const slug = to.path.slice('/manage/tools/'.length).split('/')[0] || 'unknown'
    return {
      feature: `tool:${slug}`,
      label: typeof to.meta.title === 'string' ? to.meta.title : slug,
      section: 'tools',
    }
  }
  if (to.path.startsWith('/client')) {
    const slug = routeName || to.path.replace(/^\/client\/?/, '') || 'home'
    return {
      feature: `client:${slug}`,
      label: typeof to.meta.title === 'string' ? to.meta.title : slug,
      section: 'client',
    }
  }
  if (to.path.startsWith('/obs-store/')) {
    const slug = to.path.slice('/obs-store/'.length).split('/')[0] || 'widget'
    return {
      feature: `obs-widget:${slug}`,
      label: typeof to.meta.title === 'string' ? to.meta.title : slug,
      section: 'obs',
    }
  }
  if (to.path.startsWith('/obs/')) {
    const slug = to.path.slice('/obs/'.length).split('/')[0] || 'overlay'
    return {
      feature: `obs:${slug}`,
      label: typeof to.meta.title === 'string' ? to.meta.title : slug,
      section: 'obs',
    }
  }
  if (to.path.startsWith('/@') || to.path.startsWith('/user/')) {
    return { section: 'public-page' }
  }
  if (to.path.startsWith('/manage')) {
    return { section: 'manage' }
  }
  return { section: 'web' }
}

export function trackPageView(to: RouteLocationNormalized) {
  if (typeof window === 'undefined' || !canInitPostHog()) return

  const pageKey = `${to.path}|${to.name?.toString() ?? ''}`
  if (pageKey === lastPageKey) return
  lastPageKey = pageKey

  const resolved = resolveRouteFeature(to)
  const routeName = to.name?.toString() || undefined
  const title = typeof to.meta.title === 'string' ? to.meta.title : undefined
  const tauri = isTauri()

  captureAnalyticsEvent('$pageview', {
    $current_url: window.location.href,
    route_name: routeName,
    page_title: title,
    section: resolved.section,
    feature: resolved.feature,
    is_tauri: tauri,
  })

  if (resolved.feature) {
    captureAnalyticsEvent('feature_used', {
      feature: resolved.feature,
      feature_label: resolved.label,
      section: resolved.section,
      route_name: routeName,
      is_tauri: tauri,
    })
  }
}

export function trackManageToolSuccess(tool: string, action: string, data: AnalyticsEventProps = {}) {
  captureAnalyticsEvent('manage_tool_success', {
    feature: `tool:${tool}`,
    tool,
    action,
    ...data,
  })
}
