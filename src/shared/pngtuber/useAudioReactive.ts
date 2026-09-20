import { getCurrentInstance, onMounted, onScopeDispose, ref, toValue, watch } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import { setInterval as workerInterval, clearInterval as clearWorkerInterval } from 'worker-timers'

import { createAudioGate } from './audioGate'

export interface UseAudioReactiveOptions {
  threshold?: MaybeRefOrGetter<number>
  closeThreshold?: MaybeRefOrGetter<number>
  gain?: MaybeRefOrGetter<number>
  attackDelay?: MaybeRefOrGetter<number>
  releaseDelay?: MaybeRefOrGetter<number>
  noiseSuppression?: MaybeRefOrGetter<boolean>
  deviceId?: MaybeRefOrGetter<string | undefined>
  muted?: MaybeRefOrGetter<boolean>
  autoStart?: boolean
  onSpeakingChange?: (speaking: boolean, volume: number) => void
  onVolume?: (volume: number, speaking: boolean) => void
}

export interface AudioDeviceOption {
  deviceId: string
  label: string
}
type CalibrationResult = { threshold: number; closeThreshold: number }
interface AudioSession {
  stream?: MediaStream
  context?: AudioContext
  source?: MediaStreamAudioSourceNode
  analyser?: AnalyserNode
  timer?: number
  listeners: Array<() => void>
  cleanup?: Promise<void>
}

function describeError(error: unknown): string {
  if (error instanceof AggregateError) return error.errors.map(describeError).join('；')
  return error instanceof Error ? error.message : String(error)
}

export function useAudioReactive(options: UseAudioReactiveOptions = {}) {
  const mediaDevices = typeof navigator === 'undefined' ? undefined : navigator.mediaDevices
  const isSupported = !!mediaDevices?.getUserMedia && typeof AudioContext !== 'undefined'
  const isListening = ref(false),
    isStarting = ref(false),
    isSpeaking = ref(false),
    isSimulating = ref(false)
  const rawVolume = ref(0),
    smoothedVolume = ref(0),
    isCalibrating = ref(false)
  const permissionState = ref<'prompt' | 'granted' | 'denied' | 'unsupported'>(isSupported ? 'prompt' : 'unsupported')
  const errorMessage = ref<string | null>(null),
    deviceList = ref<AudioDeviceOption[]>([])
  let generation = 0,
    enumeration = 0,
    disposed = false
  let session: AudioSession | undefined
  let cleanupInFlight: Promise<void> | undefined
  let startup: { key: string; promise: Promise<boolean> } | undefined
  let simulationTimer: ReturnType<typeof setTimeout> | undefined
  let calibration:
    | {
        samples: number[]
        started: number
        resolve: (value: CalibrationResult) => void
        reject: (error: Error) => void
      }
    | undefined
  const gate = createAudioGate()

  function setSpeaking(value: boolean) {
    if (isSpeaking.value === value) return
    isSpeaking.value = value
    options.onSpeakingChange?.(value, rawVolume.value)
  }
  function cancelCalibration() {
    calibration?.reject(new Error('校准已取消'))
    calibration = undefined
    isCalibrating.value = false
  }
  function resetOutput() {
    clearTimeout(simulationTimer)
    simulationTimer = undefined
    isSimulating.value = false
    rawVolume.value = smoothedVolume.value = 0
    gate.reset()
    cancelCalibration()
    setSpeaking(false)
    options.onVolume?.(0, false)
  }

  // Cache cleanup before touching resources: stop, ended and failed startup may converge here.
  function release(current: AudioSession): Promise<void> {
    if (current.cleanup) return current.cleanup
    let resolve!: () => void, reject!: (error: unknown) => void
    current.cleanup = new Promise<void>((yes, no) => {
      resolve = yes
      reject = no
    })
    const errors: unknown[] = []
    const attempt = (action: () => void) => {
      try {
        action()
      } catch (error) {
        errors.push(error)
      }
    }
    if (current.timer !== undefined) attempt(() => clearWorkerInterval(current.timer!))
    for (const remove of current.listeners) attempt(remove)
    for (const track of current.stream?.getTracks() ?? []) attempt(() => track.stop())
    attempt(() => current.source?.disconnect())
    attempt(() => current.analyser?.disconnect())
    const close = async () => {
      try {
        if (current.context && current.context.state !== 'closed') await current.context.close()
      } catch (error) {
        errors.push(error)
      }
      if (errors.length) reject(new AggregateError(errors, '释放音频资源失败'))
      else resolve()
    }
    void close()
    return current.cleanup
  }
  function reportCleanup(error: unknown) {
    const message = `释放麦克风失败：${describeError(error)}`
    if (!disposed) errorMessage.value = errorMessage.value ? `${errorMessage.value}；${message}` : message
    console.error(message, error)
  }
  function stopListening(): Promise<void> {
    generation++
    const current = session
    session = undefined
    startup = undefined
    isStarting.value = isListening.value = false
    resetOutput()
    if (!current) return cleanupInFlight ?? Promise.resolve()
    const releases = [release(current)]
    if (cleanupInFlight) releases.push(cleanupInFlight)
    const cleanup = Promise.allSettled(releases).then((results) => {
      const errors = results.filter((result) => result.status === 'rejected').map((result) => result.reason)
      if (errors.length) {
        const error = new AggregateError(errors, '释放音频资源失败')
        reportCleanup(error)
        throw error
      }
    })
    cleanupInFlight = cleanup
    const settled = () => {
      if (cleanupInFlight === cleanup) cleanupInFlight = undefined
    }
    void cleanup.then(settled, settled)
    return cleanup
  }
  function stopWithMessage(message: string) {
    errorMessage.value = message
    void stopListening().catch(() => {
      /* stopListening already reports cleanup failures. */
    })
  }
  async function refreshDevices() {
    if (!isSupported || disposed) return
    const request = ++enumeration
    try {
      const devices = await mediaDevices!.enumerateDevices()
      if (!disposed && request === enumeration)
        deviceList.value = devices
          .filter((d) => d.kind === 'audioinput')
          .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `麦克风 ${i + 1}` }))
    } catch (error) {
      if (!disposed && request === enumeration) errorMessage.value = `无法枚举麦克风：${describeError(error)}`
    }
  }
  function measure(current: AudioSession, buffer: Float32Array<ArrayBuffer>) {
    if (session !== current || current.cleanup || isSimulating.value) return
    if (current.context?.state !== 'running') {
      stopWithMessage('音频上下文已暂停或关闭，请重新启动麦克风')
      return
    }
    try {
      current.analyser!.getFloatTimeDomainData(buffer)
    } catch (error) {
      stopWithMessage(`麦克风采样失败：${describeError(error)}`)
      return
    }
    const rms = Math.sqrt(buffer.reduce((sum, sample) => sum + sample * sample, 0) / buffer.length)
    const gain = toValue(options.gain) ?? 1
    const volume = Math.max(0, Math.min(100, rms * 220 * (Number.isFinite(gain) ? gain : 1)))
    rawVolume.value = volume
    smoothedVolume.value += (volume - smoothedVolume.value) * 0.35
    if (calibration) {
      calibration.samples.push(volume)
      if (performance.now() - calibration.started >= 3000) {
        const sorted = calibration.samples.toSorted((a, b) => a - b)
        const floor = sorted[Math.ceil(sorted.length * 0.95) - 1] ?? 0
        calibration.resolve({
          threshold: Math.min(100, Math.max(3, Math.ceil(floor * 1.6 + 2))),
          closeThreshold: Math.min(99, Math.max(1, Math.ceil(floor * 1.2 + 1))),
        })
        calibration = undefined
        isCalibrating.value = false
      }
    }
    if (toValue(options.muted)) gate.reset()
    const active =
      !toValue(options.muted) &&
      gate.sample(volume, performance.now(), {
        threshold: toValue(options.threshold) ?? 15,
        closeThreshold: toValue(options.closeThreshold) ?? (toValue(options.threshold) ?? 15) * 0.7,
        attackDelay: toValue(options.attackDelay) ?? 40,
        releaseDelay: toValue(options.releaseDelay) ?? 220,
      })
    setSpeaking(active)
    options.onVolume?.(volume, active)
  }
  function startListening(targetDeviceId?: string): Promise<boolean> {
    if (disposed) return Promise.resolve(false)
    const device = targetDeviceId ?? toValue(options.deviceId)
    const noiseSuppression = toValue(options.noiseSuppression) ?? false
    const key = JSON.stringify([device || 'default', noiseSuppression])
    if (startup && startup.key === key) return startup.promise
    const previous = session || cleanupInFlight
    const stopping = stopListening()
    const epoch = generation
    const current: AudioSession = { listeners: [] }
    session = current
    isStarting.value = true
    errorMessage.value = null
    const valid = () => !disposed && epoch === generation && session === current
    const run = (async (): Promise<boolean> => {
      try {
        // No capture resource exists on first start: request permission synchronously.
        if (previous) await stopping
        if (!valid()) return false
        if (!isSupported) {
          errorMessage.value = '当前环境不支持麦克风采集'
          return false
        }
        const stream = await mediaDevices!.getUserMedia({
          audio: {
            ...(device && device !== 'default' ? { deviceId: { exact: device } } : {}),
            noiseSuppression,
            echoCancellation: false,
            autoGainControl: false,
          },
        })
        if (!valid()) {
          // Permission may resolve after the empty pending session was already released.
          try {
            await release({ stream, listeners: [] })
          } catch (error) {
            reportCleanup(error)
          }
          return false
        }
        current.stream = stream
        permissionState.value = 'granted'
        current.context = new AudioContext()
        const context = current.context
        if (context.state === 'suspended') await context.resume()
        if (!valid()) return false
        if (context.state !== 'running') throw new Error('音频上下文无法运行，请重新启动麦克风')
        current.analyser = context.createAnalyser()
        current.analyser.fftSize = 1024
        current.source = context.createMediaStreamSource(stream)
        current.source.connect(current.analyser)
        const tracks = stream.getAudioTracks()
        if (!tracks.length || tracks.some((track) => track.readyState === 'ended')) throw new Error('麦克风已断开')
        for (const track of tracks) {
          const ended = () => {
            if (valid()) stopWithMessage('麦克风已断开，请重新选择设备并启动')
          }
          track.addEventListener('ended', ended)
          current.listeners.push(() => track.removeEventListener('ended', ended))
        }
        const stateChanged = () => {
          if (valid() && context.state !== 'running') stopWithMessage('音频上下文已暂停或关闭，请重新启动麦克风')
        }
        context.addEventListener('statechange', stateChanged)
        current.listeners.push(() => context.removeEventListener('statechange', stateChanged))
        const buffer = new Float32Array(current.analyser.fftSize)
        current.timer = workerInterval(() => measure(current, buffer), 25)
        isListening.value = true
        void refreshDevices()
        return true
      } catch (error) {
        if (valid()) {
          if (error && typeof error === 'object' && 'name' in error && error.name === 'NotAllowedError')
            permissionState.value = 'denied'
          errorMessage.value = `无法启动麦克风：${describeError(error)}`
        }
        return false
      } finally {
        if (valid()) {
          isStarting.value = false
          if (!isListening.value) session = undefined
        }
        if (session !== current || !isListening.value) {
          try {
            await release(current)
          } catch (error) {
            reportCleanup(error)
          }
        }
      }
    })()
    startup = { key, promise: run }
    void run.then(() => {
      if (startup?.promise === run) startup = undefined
    })
    return run
  }
  function simulateSpeaking(active: boolean, duration = 1500) {
    if (disposed) return
    clearTimeout(simulationTimer)
    cancelCalibration()
    gate.reset()
    isSimulating.value = active
    rawVolume.value = smoothedVolume.value = active ? 65 : 0
    setSpeaking(active)
    options.onVolume?.(rawVolume.value, active)
    if (active) simulationTimer = setTimeout(() => simulateSpeaking(false), duration)
  }
  function calibrateNoise(): Promise<CalibrationResult> {
    if (!isListening.value || calibration || isSimulating.value)
      return Promise.reject(new Error('请先启动麦克风，并等待当前校准或模拟完成'))
    isCalibrating.value = true
    return new Promise((resolve, reject) => {
      calibration = { resolve, reject, samples: [], started: performance.now() }
    })
  }
  watch(
    () => [toValue(options.deviceId), toValue(options.noiseSuppression)],
    () => {
      if (isListening.value || isStarting.value) void startListening()
    },
  )
  const deviceChanged = () => void refreshDevices()
  const initialize = () => {
    void refreshDevices()
    mediaDevices?.addEventListener('devicechange', deviceChanged)
    if (options.autoStart) void startListening()
  }
  if (getCurrentInstance()) onMounted(initialize)
  else initialize()
  onScopeDispose(() => {
    disposed = true
    mediaDevices?.removeEventListener('devicechange', deviceChanged)
    void stopListening().catch(() => {
      /* stopListening already reports cleanup failures. */
    })
  })
  return {
    isSupported,
    isListening,
    isStarting,
    isSpeaking,
    isSimulating,
    rawVolume,
    smoothedVolume,
    permissionState,
    errorMessage,
    deviceList,
    isCalibrating,
    startListening,
    stopListening,
    refreshDevices,
    simulateSpeaking,
    calibrateNoise,
  }
}
