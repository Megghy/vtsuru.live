export interface AudioGateOptions {
  threshold: number
  closeThreshold: number
  attackDelay: number
  releaseDelay: number
}

/** Delays start at the first qualifying sample, using monotonic milliseconds. */
export function createAudioGate() {
  let speaking = false
  let since: number | undefined
  return {
    reset() {
      speaking = false
      since = undefined
    },
    sample(volume: number, now: number, options: AudioGateOptions) {
      const closeThreshold = Math.min(options.threshold, options.closeThreshold)
      const change = speaking ? volume < closeThreshold : volume >= options.threshold
      if (!change) since = undefined
      else {
        since ??= now
        if (now - since >= Math.max(0, speaking ? options.releaseDelay : options.attackDelay)) {
          speaking = !speaking
          since = undefined
        }
      }
      return speaking
    },
  }
}
