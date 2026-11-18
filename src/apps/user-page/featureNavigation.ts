import BookCoins20Filled from '@vicons/fluent/es/BookCoins20Filled'
import CalendarClock24Filled from '@vicons/fluent/es/CalendarClock24Filled'
import CheckmarkCircle24Filled from '@vicons/fluent/es/CheckmarkCircle24Filled'
import VideoAdd20Filled from '@vicons/fluent/es/VideoAdd20Filled'
import Chatbox from '@vicons/ionicons5/es/Chatbox'
import Chatbubbles from '@vicons/ionicons5/es/Chatbubbles'
import MusicalNotes from '@vicons/ionicons5/es/MusicalNotes'
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
    icon: MusicalNotes,
    functionType: FunctionTypes.SongList,
  },
  {
    key: 'questionBox',
    label: '提问箱',
    routeName: 'user-questionBox',
    icon: Chatbox,
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
  { key: 'forum', label: '讨论区', routeName: 'user-forum', icon: Chatbubbles, functionType: null },
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

export function isUserFeatureEnabled(feature: UserFeatureDefinition, enabledFunctions: ReadonlySet<FunctionTypes>) {
  return feature.functionType !== null && enabledFunctions.has(feature.functionType)
}
