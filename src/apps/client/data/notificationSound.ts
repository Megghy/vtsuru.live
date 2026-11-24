export type NotificationTonePreset = 'chime' | 'alert' | 'soft'

let sharedAudioCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof AudioContext === 'undefined') return null
  if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
    sharedAudioCtx = new AudioContext()
  }
  return sharedAudioCtx
}

const PRESET_NOTES: Record<NotificationTonePreset, Array<{ freq: number; delay: number; duration: number }>> = {
  chime: [
    { freq: 784, delay: 0, duration: 0.14 },
    { freq: 1046.5, delay: 0.11, duration: 0.22 },
  ],
  alert: [
    { freq: 880, delay: 0, duration: 0.12 },
    { freq: 659.25, delay: 0.14, duration: 0.18 },
  ],
  soft: [{ freq: 660, delay: 0, duration: 0.24 }],
}

/**
 * 播放轻量桌面提示音（Web Audio API，无外部文件依赖）
 */
export async function playNotificationTone(
  preset: NotificationTonePreset = 'chime',
  volume = 0.5,
): Promise<void> {
  const ctx = getAudioContext()
  if (!ctx) return

  const safeVolume = Math.min(1, Math.max(0.01, volume))
  const notes = PRESET_NOTES[preset] ?? PRESET_NOTES.chime

  await new Promise<void>((resolve) => {
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      globalThis.clearTimeout(fallbackTimer)
      resolve()
    }
    const fallbackTimer = globalThis.setTimeout(finish, 900)

    void (async () => {
      try {
        if (ctx.state === 'suspended') {
          await Promise.race([ctx.resume(), new Promise<void>((r) => globalThis.setTimeout(r, 250))])
        }
        if (ctx.state !== 'running') {
          finish()
          return
        }

        const baseTime = ctx.currentTime
        let latestEnd = baseTime
        notes.forEach((note, index) => {
          const start = baseTime + note.delay
          const end = start + note.duration
          latestEnd = Math.max(latestEnd, end)

          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.type = 'sine'
          osc.frequency.setValueAtTime(note.freq, start)

          gain.gain.setValueAtTime(0.0001, start)
          gain.gain.exponentialRampToValueAtTime(safeVolume * 0.35, start + 0.02)
          gain.gain.exponentialRampToValueAtTime(0.0001, end)

          osc.connect(gain)
          gain.connect(ctx.destination)
          if (index === notes.length - 1) {
            osc.onended = finish
          }
          osc.start(start)
          osc.stop(end + 0.01)
        })

        const totalMs = Math.ceil((latestEnd - baseTime) * 1000) + 50
        globalThis.setTimeout(finish, totalMs)
      } catch {
        finish()
      }
    })()
  })
}
