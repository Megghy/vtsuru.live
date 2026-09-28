import { describe, expect, it } from 'vitest'

import { GuidUtils } from '..'

// 期望值取自后端 GuidHelper.NumToBackGuid(long) 的实际输出
describe('GuidUtils', () => {
  it('numToGuid 与后端 NumToBackGuid 一致', () => {
    expect(GuidUtils.numToGuid(1)).toBe('00000000-0000-0000-0100-000000000000')
    expect(GuidUtils.numToGuid(545068)).toBe('00000000-0000-0000-2c51-080000000000')
  })

  it('guidToLong 与 numToGuid 互逆', () => {
    const guid = GuidUtils.numToGuid(3493118494116797)
    expect(GuidUtils.isGuidFromUserId(guid)).toBe(true)
    expect(GuidUtils.guidToLong(guid)).toBe(3493118494116797)
  })

  it('toOuid 无 uid 时使用 open_id', () => {
    expect(GuidUtils.toOuid(0, 'open')).toBe('open')
    expect(GuidUtils.toOuid(1, 'open')).toBe(GuidUtils.numToGuid(1))
  })
})
