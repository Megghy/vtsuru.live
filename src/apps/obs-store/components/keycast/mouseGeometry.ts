import type { MouseButtonName } from './types'

export const MOUSE_VIEWBOX_WIDTH = 140
export const MOUSE_VIEWBOX_HEIGHT = 214

export const MOUSE_BODY_PATH =
  'M 32 54 C 32 22 50 10 70 10 C 90 10 108 22 108 54 L 112 134 C 114 176 96 204 70 204 C 44 204 26 176 28 134 Z'

export const MOUSE_LEFT_BUTTON_PATH = 'M 34 54 C 34 25 50 13 68 13 L 68 88 L 32 88 Z'
export const MOUSE_RIGHT_BUTTON_PATH = 'M 72 13 C 90 13 106 25 106 54 L 108 88 L 72 88 Z'

export const MOUSE_WHEEL_UP_ARROW_PATH = 'M 70 23 L 65 29 L 75 29 Z'
export const MOUSE_WHEEL_DOWN_ARROW_PATH = 'M 70 83 L 65 77 L 75 77 Z'

export const MOUSE_RADAR_CENTER = { x: 70, y: 144, radius: 19 }

export interface MousePartRect {
  x: number
  y: number
  width: number
  height: number
  radius: number
  label?: string
  labelX?: number
  labelY?: number
}

export const MOUSE_MIDDLE_RECT: MousePartRect = {
  x: 63,
  y: 37,
  width: 14,
  height: 32,
  radius: 7,
}

export const MOUSE_WHEEL_WELL_RECT: MousePartRect = {
  x: 61,
  y: 30,
  width: 18,
  height: 46,
  radius: 9,
}

export const MOUSE_SIDE_BUTTONS: Record<'forward' | 'back', MousePartRect> = {
  forward: { x: 17, y: 94, width: 10, height: 26, radius: 4, label: 'M5', labelX: 9, labelY: 110 },
  back: { x: 17, y: 125, width: 10, height: 26, radius: 4, label: 'M4', labelX: 9, labelY: 141 },
}

export const MOUSE_BUTTON_LABELS: Record<MouseButtonName, { text: string; x: number; y: number }> = {
  left: { text: 'L', x: 49, y: 55 },
  right: { text: 'R', x: 91, y: 55 },
  middle: { text: 'M', x: 70, y: 53 },
  forward: { text: 'M5', x: 9, y: 110 },
  back: { text: 'M4', x: 9, y: 141 },
}
