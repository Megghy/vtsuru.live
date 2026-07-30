import { describe, expect, it } from 'vitest'

import { FunctionTypes } from '@/api/api-models'

import { getEnabledUserFunctions, isUserFeatureEnabled, USER_FEATURE_DEFINITION_MAP } from '../featureNavigation'

describe('featureNavigation', () => {
  it('公开用户读取 extra 中的启用功能', () => {
    const enabled = getEnabledUserFunctions({ extra: { enableFunctions: [FunctionTypes.SongList] } })
    expect(isUserFeatureEnabled(USER_FEATURE_DEFINITION_MAP.songList, enabled)).toBe(true)
    expect(isUserFeatureEnabled(USER_FEATURE_DEFINITION_MAP.schedule, enabled)).toBe(false)
  })

  it('编辑器预览读取 settings 中的启用功能', () => {
    const enabled = getEnabledUserFunctions({ settings: { enableFunctions: [FunctionTypes.QuestionBox] } })
    expect(isUserFeatureEnabled(USER_FEATURE_DEFINITION_MAP.questionBox, enabled)).toBe(true)
  })

  it('论坛使用独立可用性查询', () => {
    const enabled = getEnabledUserFunctions({
      extra: { enableFunctions: Object.values(FunctionTypes).filter((value) => typeof value === 'number') },
    })
    expect(isUserFeatureEnabled(USER_FEATURE_DEFINITION_MAP.forum, enabled)).toBe(false)
  })
})
