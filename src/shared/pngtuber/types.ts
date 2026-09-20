export type SpeakingAnimationType = 'bounce' | 'jelly' | 'shake' | 'pulse' | 'float' | 'none'
export type IdleAnimationType = 'none' | 'breathe' | 'sway' | 'float'
export type AnimationIntensity = 'subtle' | 'normal' | 'energetic'
export type ImageSlot = 'idleImage' | 'speakingImage' | 'idleBlinkImage' | 'speakingBlinkImage'
export interface PngtuberAccessory {
  id: string
  name: string
  image: string
  x: number
  y: number
  scale: number
  rotation: number
  visible: 'always' | 'speaking' | 'idle'
  front: boolean
}
export interface PngtuberExpression {
  id: string
  name: string
  idleImage: string
  speakingImage: string
  idleBlinkImage: string
  speakingBlinkImage: string
  hotkey: string
  hotkeyMode: 'toggle' | 'hold' | 'timed'
  durationMs: number
  playback: 'continue' | 'restart' | 'once'
  accessories: PngtuberAccessory[]
}
export interface PngtuberState {
  expressions: PngtuberExpression[]
  defaultExpressionId: string
  awayExpressionId: string
  threshold: number
  closeThreshold: number
  attackDelay: number
  gain: number
  releaseDelay: number
  noiseSuppression: boolean
  inputMode: 'microphone' | 'controller' | 'client' | 'obs'
  speakingAnimation: SpeakingAnimationType
  idleAnimation: IdleAnimationType
  intensity: AnimationIntensity
  motionMode: 'loop' | 'onset' | 'volume'
  scale: number
  flipH: boolean
  idleDim: boolean
  showGlow: boolean
  glowColor: string
  shadow: boolean
  blinkEnabled: boolean
  blinkMin: number
  blinkMax: number
  blinkDuration: number
  canvasWidth: number
  canvasHeight: number
  padding: number
  transitionMs: number
  pixelated: boolean
}
export function createExpression(name = '默认', id: string = crypto.randomUUID()): PngtuberExpression {
  return {
    id,
    name,
    idleImage: '',
    speakingImage: '',
    idleBlinkImage: '',
    speakingBlinkImage: '',
    hotkey: '',
    hotkeyMode: 'toggle',
    durationMs: 5000,
    playback: 'continue',
    accessories: [],
  }
}
export const DEFAULT_PNGTUBER_STATE: PngtuberState = {
  expressions: [createExpression('默认', 'default')],
  defaultExpressionId: 'default',
  awayExpressionId: '',
  threshold: 15,
  closeThreshold: 10,
  attackDelay: 40,
  gain: 1,
  releaseDelay: 220,
  noiseSuppression: false,
  inputMode: 'microphone',
  speakingAnimation: 'bounce',
  idleAnimation: 'breathe',
  intensity: 'normal',
  motionMode: 'loop',
  scale: 1,
  flipH: false,
  idleDim: false,
  showGlow: true,
  glowColor: '#38bdf8',
  shadow: true,
  blinkEnabled: true,
  blinkMin: 3000,
  blinkMax: 6000,
  blinkDuration: 130,
  canvasWidth: 400,
  canvasHeight: 500,
  padding: 40,
  transitionMs: 0,
  pixelated: false,
}
export interface PngtuberRuntime {
  expressionId: string
  isSpeaking: boolean
  volume: number
  muted: boolean
  away: boolean
  updatedAt: number
  source: string
}
export const DEFAULT_PNGTUBER_RUNTIME: PngtuberRuntime = {
  expressionId: '',
  isSpeaking: false,
  volume: 0,
  muted: false,
  away: false,
  updatedAt: 0,
  source: '',
}
export const IMAGE_SLOTS: ImageSlot[] = ['idleImage', 'speakingImage', 'idleBlinkImage', 'speakingBlinkImage']
export function isInlineImageData(value: string) {
  return /^(data|blob):/i.test(value)
}
