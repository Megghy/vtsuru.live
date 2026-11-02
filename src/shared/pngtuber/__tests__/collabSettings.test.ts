import { describe, expect, it } from 'vitest'

import { DEFAULT_COLLAB_SETTINGS, normalizeCollabSettings } from '../collabSettings'

describe('collabSettings', () => {
  it('normalizes missing or invalid input to default values', () => {
    const res = normalizeCollabSettings(null)
    expect(res).toEqual(DEFAULT_COLLAB_SETTINGS)

    const invalid = normalizeCollabSettings({
      gap: -50,
      scale: 10,
      layout: 'unknown',
      alignment: 'center-bottom',
      spotlight: 'invalid',
    })
    expect(invalid.gap).toBe(0)
    expect(invalid.scale).toBe(2.0)
    expect(invalid.layout).toBe('row')
    expect(invalid.alignment).toBe('bottom')
    expect(invalid.spotlight).toBe(true)
  })
})
