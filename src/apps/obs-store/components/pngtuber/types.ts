export type SpeakingAnimationType = 'bounce' | 'jelly' | 'shake' | 'pulse' | 'float' | 'none'
export type IdleAnimationType = 'none' | 'breathe' | 'sway' | 'float'
export type AnimationIntensity = 'subtle' | 'normal' | 'energetic'

export interface PngtuberState {
  idleImage: string
  speakingImage: string
  threshold: number
  gain: number
  releaseDelay: number
  deviceId?: string
  speakingAnimation: SpeakingAnimationType
  idleAnimation: IdleAnimationType
  intensity: AnimationIntensity
  scale: number
  flipH: boolean
  idleDim: boolean
  showGlow: boolean
  glowColor: string
  shadow: boolean
}

export const DEFAULT_PNGTUBER_STATE: PngtuberState = {
  idleImage: '',
  speakingImage: '',
  threshold: 15,
  gain: 1.0,
  releaseDelay: 220,
  deviceId: 'default',
  speakingAnimation: 'bounce',
  idleAnimation: 'breathe',
  intensity: 'normal',
  scale: 1.0,
  flipH: false,
  idleDim: false,
  showGlow: true,
  glowColor: '#38bdf8',
  shadow: true,
}

export function isInlineImageData(value: string) {
  return value.startsWith('data:') || value.startsWith('blob:')
}

export function sanitizePngtuberState(state: PngtuberState): PngtuberState {
  return {
    ...state,
    idleImage: isInlineImageData(state.idleImage) ? '' : state.idleImage,
    speakingImage: isInlineImageData(state.speakingImage) ? '' : state.speakingImage,
  }
}
