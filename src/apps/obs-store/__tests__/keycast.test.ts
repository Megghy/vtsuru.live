import { describe, expect, it } from 'vitest'

import { computeKeyboardGeometry, KEYBOARD_LAYOUTS } from '../components/keycast/keyboardLayouts'
import { buildKeycastCanvasPalette, resolveKeyAccentTokens } from '../components/keycast/keycastTheme'
import {
  formatKeyboardEvent,
  mapMouseButton,
  resolveAfterglowMs,
  resolvePressEffect,
} from '../components/keycast/types'

describe('keycast keyboardLayouts', () => {
  it('computes non-overlapping aligned key geometries for all presets', () => {
    for (const preset of ['wasd', 'moba', '60', 'tkl'] as const) {
      const geom = computeKeyboardGeometry(preset, 40, 4)
      expect(geom.width).toBeGreaterThan(0)
      expect(geom.height).toBeGreaterThan(0)
      expect(geom.keys.length).toBeGreaterThan(0)

      for (const box of geom.keys) {
        expect(box.x).toBeGreaterThanOrEqual(0)
        expect(box.y).toBeGreaterThanOrEqual(0)
        expect(box.x + box.width).toBeLessThanOrEqual(geom.width)
        expect(box.y + box.height).toBeLessThanOrEqual(geom.height)
      }
    }

    expect(KEYBOARD_LAYOUTS['60'].rows.flatMap((r) => r.keys).filter((k) => !k.spacer)).toHaveLength(61)
    const tklCodes = computeKeyboardGeometry('tkl').keys.map((k) => k.code)
    expect(tklCodes).toContain('F1')
    expect(tklCodes).toContain('F12')
    expect(tklCodes).toContain('ArrowUp')
    expect(tklCodes).toContain('Delete')
  })
})

describe('keycast theme & input helpers', () => {
  it('builds readable active text contrast for light and dark accent colors', () => {
    const lightAccentPalette = buildKeycastCanvasPalette('mechanical', '#facc15')
    const darkAccentPalette = buildKeycastCanvasPalette('mechanical', '#1e1b4b')

    expect(lightAccentPalette.activeText).toBe('#09090b')
    expect(darkAccentPalette.activeText).toBe('#ffffff')

    const immersivePalette = buildKeycastCanvasPalette('immersive', '#38bdf8')
    expect(immersivePalette.shellFill).toBe('transparent')
    expect(immersivePalette.shellStrokeWidth).toBe(0)
    expect(immersivePalette.keyStroke).toBe('transparent')

    const solid = resolveKeyAccentTokens(immersivePalette, 'immersive', '#38bdf8', 'solid', 0.2, 'KeyW', 0)
    const rainbowLeft = resolveKeyAccentTokens(immersivePalette, 'immersive', '#38bdf8', 'rainbow', 0.1, 'KeyA', 0)
    const rainbowRight = resolveKeyAccentTokens(immersivePalette, 'immersive', '#38bdf8', 'rainbow', 0.9, 'KeyL', 0)
    expect(solid.fill).toBe(immersivePalette.accentFill)
    expect(rainbowLeft.fill).not.toBe(rainbowRight.fill)

    const zoneMove = resolveKeyAccentTokens(immersivePalette, 'immersive', '#38bdf8', 'zone', 0.2, 'KeyW', 0)
    const zoneMod = resolveKeyAccentTokens(immersivePalette, 'immersive', '#38bdf8', 'zone', 0.2, 'ShiftLeft', 0)
    expect(zoneMove.fill).not.toBe(zoneMod.fill)

    expect(resolvePressEffect({ pressEffect: 'spark', enableRipple: false })).toBe('spark')
    expect(resolveAfterglowMs({ afterglowMs: 750, enableAfterglow: false })).toBe(750)
  })

  it('maps mouse buttons and formats keyboard events', () => {
    expect(mapMouseButton(0)).toBe('left')
    expect(mapMouseButton(1)).toBe('middle')
    expect(mapMouseButton(2)).toBe('right')
    expect(mapMouseButton(3)).toBe('back')
    expect(mapMouseButton(4)).toBe('forward')
    expect(mapMouseButton(99)).toBeNull()

    const payload = formatKeyboardEvent({
      key: 'w',
      code: 'KeyW',
      repeat: false,
      ctrlKey: false,
      shiftKey: true,
      altKey: false,
      metaKey: false,
    } as KeyboardEvent)

    expect(payload?.code).toBe('KeyW')
    expect(payload?.label).toBe('W')
    expect(payload?.modifiers).toEqual(['Shift'])
  })
})
