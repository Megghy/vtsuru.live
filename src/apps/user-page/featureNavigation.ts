import {
  CalendarClock,
  CheckCircle2,
  Coins,
  Film,
  ListOrdered,
  MessageSquare,
  MessagesSquare,
  Music,
} from 'lucide-vue-next'
import type { Component } from 'vue'

import { FunctionTypes } from '@/api/generated/model'

import { getEnabledUserFunctions, USER_FEATURE_KEYS } from './featureMeta'
import type { UserFeatureKey } from './featureMeta'

export { getEnabledUserFunctions, USER_FEATURE_KEYS }
export type { UserFeatureKey }

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
    icon: Music,
    functionType: FunctionTypes.SongList,
  },
  {
    key: 'questionBox',
    label: '提问箱',
    routeName: 'user-questionBox',
    icon: MessageSquare,
    functionType: FunctionTypes.QuestionBox,
  },
  {
    key: 'checkInRanking',
    label: '签到排行',
    routeName: 'user-checkin',
    icon: CheckCircle2,
    functionType: FunctionTypes.CheckInRanking,
  },
  {
    key: 'pointGoods',
    label: '积分兑换',
    routeName: 'user-goods',
    icon: Coins,
    functionType: FunctionTypes.Point,
  },
  {
    key: 'videoCollect',
    label: '视频征集',
    routeName: 'user-video-collect',
    icon: Film,
    functionType: FunctionTypes.VideoCollect,
  },
  { key: 'forum', label: '讨论区', routeName: 'user-forum', icon: MessagesSquare, functionType: null },
  {
    key: 'schedule',
    label: '直播日程',
    routeName: 'user-schedule',
    icon: CalendarClock,
    functionType: FunctionTypes.Schedule,
  },
  {
    key: 'queue',
    label: '排队队列',
    routeName: 'user-queue',
    icon: ListOrdered,
    functionType: FunctionTypes.Queue,
  },
]

export const USER_FEATURE_DEFINITION_MAP = Object.fromEntries(
  USER_FEATURE_DEFINITIONS.map((feature) => [feature.key, feature]),
) as Record<UserFeatureKey, UserFeatureDefinition>

export function isUserFeatureEnabled(feature: UserFeatureDefinition, enabledFunctions: ReadonlySet<FunctionTypes>) {
  return feature.functionType !== null && enabledFunctions.has(feature.functionType)
}
