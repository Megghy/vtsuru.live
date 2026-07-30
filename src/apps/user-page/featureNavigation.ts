import { BookCoins20Filled, CalendarClock24Filled, CheckmarkCircle24Filled, VideoAdd20Filled } from '@vicons/fluent'
import { ChatboxOutline, ChatbubblesOutline, MusicalNotesOutline } from '@vicons/ionicons5'
import type { Component } from 'vue'

import { FunctionTypes } from '@/api/api-models'

export const USER_FEATURE_KEYS = [
  'songList',
  'questionBox',
  'checkInRanking',
  'pointGoods',
  'videoCollect',
  'forum',
  'schedule',
] as const

export type UserFeatureKey = (typeof USER_FEATURE_KEYS)[number]

export interface UserFeatureDefinition {
  key: UserFeatureKey
  label: string
  routeName: string
  icon: Component
  functionType: FunctionTypes | null
}

export const USER_FEATURE_DEFINITIONS: readonly UserFeatureDefinition[] = [
  {
    key: 'songList',
    label: '歌单 / 点歌',
    routeName: 'user-songList',
    icon: MusicalNotesOutline,
    functionType: FunctionTypes.SongList,
  },
  {
    key: 'questionBox',
    label: '提问箱',
    routeName: 'user-questionBox',
    icon: ChatboxOutline,
    functionType: FunctionTypes.QuestionBox,
  },
  {
    key: 'checkInRanking',
    label: '签到排行',
    routeName: 'user-checkin',
    icon: CheckmarkCircle24Filled,
    functionType: FunctionTypes.CheckInRanking,
  },
  {
    key: 'pointGoods',
    label: '积分兑换',
    routeName: 'user-goods',
    icon: BookCoins20Filled,
    functionType: FunctionTypes.Point,
  },
  {
    key: 'videoCollect',
    label: '视频征集',
    routeName: 'user-video-collect',
    icon: VideoAdd20Filled,
    functionType: FunctionTypes.VideoCollect,
  },
  { key: 'forum', label: '讨论区', routeName: 'user-forum', icon: ChatbubblesOutline, functionType: null },
  {
    key: 'schedule',
    label: '直播日程',
    routeName: 'user-schedule',
    icon: CalendarClock24Filled,
    functionType: FunctionTypes.Schedule,
  },
]

export const USER_FEATURE_DEFINITION_MAP = Object.fromEntries(
  USER_FEATURE_DEFINITIONS.map((feature) => [feature.key, feature]),
) as Record<UserFeatureKey, UserFeatureDefinition>

export function getEnabledUserFunctions(userInfo: unknown) {
  if (!userInfo || typeof userInfo !== 'object' || Array.isArray(userInfo)) return new Set<FunctionTypes>()
  const user = userInfo as {
    extra?: { enableFunctions?: FunctionTypes[] }
    settings?: { enableFunctions?: FunctionTypes[] }
  }
  return new Set(user.extra?.enableFunctions ?? user.settings?.enableFunctions ?? [])
}

export function isUserFeatureEnabled(feature: UserFeatureDefinition, enabledFunctions: ReadonlySet<FunctionTypes>) {
  return feature.functionType !== null && enabledFunctions.has(feature.functionType)
}
