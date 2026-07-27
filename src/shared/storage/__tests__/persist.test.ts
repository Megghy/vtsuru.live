import { describe, expect, it } from 'vitest'
import { canonicalizePersistKey } from '../persist'

describe('canonicalizePersistKey', () => {
  it('允许动态 key，不再要求静态注册', () => {
    expect(canonicalizePersistKey('vtsuru:user-pages:local-draft:v1:42'))
      .toBe('vtsuru:user-pages:local-draft:v1:42')
  })

  it('仍将现有调用定位到已迁移的数据 key', () => {
    expect(canonicalizePersistKey('Settings.Theme')).toBe('vtsuru:settings:theme')
  })
})
