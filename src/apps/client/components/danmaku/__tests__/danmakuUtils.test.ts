import { describe, expect, it } from 'vitest'

import { getDanmakuDisplayName } from '../danmakuUtils'

describe('getDanmakuDisplayName', () => {
  it('uses the real name when present', () => {
    expect(getDanmakuDisplayName({ uname: '鸽子', uid: 1 })).toBe('鸽子')
  })

  it('treats empty-name events without identity as system messages', () => {
    expect(getDanmakuDisplayName({ uname: '', uid: 0 })).toBe('系统')
    expect(getDanmakuDisplayName({ uname: '  ', uid: null })).toBe('系统')
    expect(getDanmakuDisplayName({ msg: '弹幕窗口已打开' } as { uname?: string })).toBe('系统')
  })

  it('keeps mystery users as anonymous when they still have an identity', () => {
    expect(getDanmakuDisplayName({ uname: '', uid: 123 })).toBe('匿名用户')
    expect(getDanmakuDisplayName({ uname: '', open_id: 'open-1' })).toBe('匿名用户')
  })
})
