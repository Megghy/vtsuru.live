export type SubtitleAlign = 'left' | 'center' | 'right'

export interface SubtitleLineItem {
  text: string
  ts: number
}

export interface SubtitleState {
  lines: SubtitleLineItem[]
  partialText: string
  updatedAt: number
  maxLines: number
  fadeSeconds: number
  fontSize: number
  textColor: string
  strokeColor: string
  bgColor: string
  align: SubtitleAlign
  showPartial: boolean
  fontWeight: number
}

export type SubtitleAction =
  | { type: 'push'; text: string }
  | { type: 'clear' }

export const DEFAULT_SUBTITLE_STATE: SubtitleState = {
  lines: [],
  partialText: '',
  updatedAt: 0,
  maxLines: 2,
  fadeSeconds: 8,
  fontSize: 32,
  textColor: '#ffffff',
  strokeColor: '#000000',
  bgColor: 'rgba(15, 23, 42, 0.55)',
  align: 'center',
  showPartial: true,
  fontWeight: 700,
}
