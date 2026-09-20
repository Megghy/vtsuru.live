import { OBS_STORE_API_URL } from '@/shared/config/endpoints'

import type { PngtuberExpression, PngtuberState } from './types'

export function selectExpression(state: PngtuberState, id = '', away = false) {
  return (
    state.expressions.find((e) => e.id === (away && state.awayExpressionId ? state.awayExpressionId : id)) ??
    state.expressions.find((e) => e.id === state.defaultExpressionId) ??
    state.expressions[0]
  )
}
export function selectImage(expression: PngtuberExpression, speaking: boolean, blink: boolean) {
  const open = speaking
    ? expression.speakingImage || expression.idleImage
    : expression.idleImage || expression.speakingImage
  return (blink ? (speaking ? expression.speakingBlinkImage : expression.idleBlinkImage) : '') || open
}
export function isHostedAsset(src: string) {
  try {
    const url = new URL(src)
    const base = new URL(`${OBS_STORE_API_URL}pngtuber/assets/`)
    return (
      url.origin === base.origin &&
      url.pathname.startsWith(base.pathname) &&
      /^\d+\/[\w-]+$/.test(url.pathname.slice(base.pathname.length))
    )
  } catch {
    return false
  }
}
export function playbackSource(src: string, playback: PngtuberExpression['playback'], activation: string) {
  if (!src || playback === 'continue') return src
  if (!isHostedAsset(src)) throw new Error('外链素材仅支持原生循环；重播或播放一次需要先上传素材')
  const url = new URL(src)
  if (playback === 'once') url.searchParams.set('once', 'true')
  else url.searchParams.delete('once')
  url.searchParams.set('_play', activation)
  return url.href
}
export function motionIntensity(state: PngtuberState, speaking: boolean, volume = 0) {
  const base = { subtle: 0.6, normal: 1, energetic: 1.4 }[state.intensity]
  return (
    base *
    (speaking && state.motionMode === 'volume'
      ? Math.min(1, Math.max(0, Number.isFinite(volume) ? volume / 100 : 0))
      : 1)
  )
}
