import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  findElementByAliases,
  TYPE_BUTTON_ALIASES,
} from '@/composables/useSvgGamepadRenderer'
import type { GamepadType, LogicalButton } from '@/types/gamepad'
import { LogicalButtonsList } from '@/types/gamepad'

const BODY_ROOT = join(process.cwd(), 'src/assets/controller/Body')

const REQUIRED: Record<GamepadType, LogicalButton[]> = {
  xbox: [
    'ACTION_DOWN',
    'ACTION_RIGHT',
    'ACTION_LEFT',
    'ACTION_UP',
    'DPAD_UP',
    'DPAD_DOWN',
    'DPAD_LEFT',
    'DPAD_RIGHT',
    'LEFT_SHOULDER_1',
    'RIGHT_SHOULDER_1',
    'LEFT_SHOULDER_2',
    'RIGHT_SHOULDER_2',
    'SELECT',
    'START',
    'HOME',
  ],
  ps: [
    'ACTION_DOWN',
    'ACTION_RIGHT',
    'ACTION_LEFT',
    'ACTION_UP',
    'DPAD_UP',
    'DPAD_DOWN',
    'DPAD_LEFT',
    'DPAD_RIGHT',
    'LEFT_SHOULDER_1',
    'RIGHT_SHOULDER_1',
    'LEFT_SHOULDER_2',
    'RIGHT_SHOULDER_2',
    'SELECT',
    'START',
    'HOME',
    'PS_TOUCHPAD',
  ],
  nintendo: [
    'ACTION_DOWN',
    'ACTION_RIGHT',
    'ACTION_LEFT',
    'ACTION_UP',
    'DPAD_UP',
    'DPAD_DOWN',
    'DPAD_LEFT',
    'DPAD_RIGHT',
    'LEFT_SHOULDER_1',
    'RIGHT_SHOULDER_1',
    'LEFT_SHOULDER_2',
    'RIGHT_SHOULDER_2',
    'SELECT',
    'START',
    'HOME',
    'NINTENDO_CAPTURE',
  ],
}

const XSX = ['Black', 'White', 'Blue', 'Red'] as const
const DS_COLORS = [
  'DualSense VSCView SVG.svg',
  'DualSense VSCView SVG Midnight Black.svg',
  'DualSense VSCView SVG Cosmic Red.svg',
  'DualSense VSCView SVG Galactic Purple.svg',
  'DualSense VSCView SVG Nova Pink.svg',
] as const
const DS4_V2 = [
  'DS4 V2 VSC SVG.svg',
  'DS4 V2 VSC SVG - Glacier White.svg',
  'DS4 V2 VSC SVG - Magma Red.svg',
  'DS4 V2 VSC SVG - Midnight Blue.svg',
  'DS4 V2 VSC SVG - Gold.svg',
] as const

const FIXTURES: { type: GamepadType; file: string; extra?: LogicalButton[] }[] = [
  ...XSX.map((color) => ({
    type: 'xbox' as const,
    file: `Xbox/XboxSeriesXColor/Xbox Series X Controller VSCView ${color}.svg`,
    extra: ['PS_TOUCHPAD'] as LogicalButton[],
  })),
  { type: 'xbox', file: 'Xbox/XboxOneColor/Xbox One Controller VSCView Black.svg' },
  { type: 'xbox', file: 'Xbox/XboxOneColor/Xbox One Controller VSCView White.svg' },
  { type: 'xbox', file: 'Xbox/XboxOneColor/Xbox One S Controller VSCView Blue.svg' },
  { type: 'xbox', file: 'Xbox/XboxOneColor/Xbox One S Controller VSCView Red.svg' },
  ...DS_COLORS.map((file) => ({
    type: 'ps' as const,
    file: `DS/${file}`,
    extra: ['NINTENDO_CAPTURE'] as LogicalButton[],
  })),
  { type: 'ps', file: 'DS4/DS4 VSC SVG.svg' },
  { type: 'ps', file: 'DS4/DS4 VSC Front SVG.svg' },
  ...DS4_V2.map((file) => ({ type: 'ps' as const, file: `DS4/${file}` })),
  { type: 'nintendo', file: 'SwitchPro/Switch Pro Controller VSCView.svg' },
]

function bindSvg(svgText: string, type: GamepadType) {
  const container = document.createElement('div')
  container.innerHTML = svgText
  const svgEl = container.querySelector('svg')
  expect(svgEl, 'svg root').toBeTruthy()
  const aliases = TYPE_BUTTON_ALIASES[type]
  const used = new Set<Element>()
  const hits: Partial<Record<LogicalButton, string>> = {}
  for (const btn of LogicalButtonsList) {
    const list = aliases[btn] || []
    if (list.length === 0) continue
    const el = findElementByAliases(svgEl!, list, used)
    if (el) {
      used.add(el)
      hits[btn] = el.getAttribute('inkscape:label') || el.id || el.tagName
    }
  }
  return hits
}

describe('真实底壳 SVG 按键绑定', () => {
  for (const fixture of FIXTURES) {
    it(`${fixture.type} :: ${fixture.file}`, () => {
      const svg = readFileSync(join(BODY_ROOT, fixture.file), 'utf8')
      const hits = bindSvg(svg, fixture.type)
      const required = [...REQUIRED[fixture.type], ...(fixture.extra ?? [])]
      const missing = required.filter((btn) => !hits[btn])
      expect(missing, `未绑定: ${missing.join(', ')}`).toEqual([])
    })
  }
})
