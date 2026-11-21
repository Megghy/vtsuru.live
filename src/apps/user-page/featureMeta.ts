import { FunctionTypes } from '@/api/generated/model'

export const USER_FEATURE_KEYS = [
  'songList',
  'questionBox',
  'checkInRanking',
  'pointGoods',
  'videoCollect',
  'forum',
  'schedule',
  'queue',
] as const

export type UserFeatureKey = (typeof USER_FEATURE_KEYS)[number]

export function getEnabledUserFunctions(userInfo: unknown) {
  if (!userInfo || typeof userInfo !== 'object' || Array.isArray(userInfo)) return new Set<FunctionTypes>()
  const user = userInfo as {
    extra?: { enableFunctions?: FunctionTypes[] }
    settings?: { enableFunctions?: FunctionTypes[] }
  }
  return new Set(user.extra?.enableFunctions ?? user.settings?.enableFunctions ?? [])
}
