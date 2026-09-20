import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'

import { createAudioGate } from '@/shared/pngtuber/audioGate'
import { useAudioReactive } from '@/shared/pngtuber/useAudioReactive'
import type { UseAudioReactiveOptions } from '@/shared/pngtuber/useAudioReactive'

vi.mock('worker-timers', () => ({
  setInterval: (callback: () => void, delay: number) => window.setInterval(callback, delay),
  clearInterval: (id: number) => window.clearInterval(id),
}))

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

function makeStream() {
  const track = Object.assign(new EventTarget(), { readyState: 'live', stop: vi.fn() })
  const stream = { getTracks: () => [track], getAudioTracks: () => [track] } as unknown as MediaStream
  return { track, stream }
}

const contexts: MockAudioContext[] = []
let amplitude = 0
let resume: () => Promise<void> = async () => {}
let contextState = 'running'

class MockAudioContext extends EventTarget {
  state = contextState
  close = vi.fn(async () => {
    this.state = 'closed'
  })
  resume = vi.fn(async () => {
    await resume()
    if (this.state !== 'closed') this.state = 'running'
  })
  analyser = {
    fftSize: 512,
    disconnect: vi.fn(),
    getFloatTimeDomainData: (buffer: Float32Array) => {
      for (let i = 0; i < buffer.length; i++) buffer[i] = i % 2 ? -amplitude : amplitude
    },
  }
  source = { connect: vi.fn(), disconnect: vi.fn() }
  createAnalyser = () => this.analyser
  createMediaStreamSource = () => this.source
  constructor() {
    super()
    contexts.push(this)
  }
}

let devices: EventTarget & { getUserMedia: ReturnType<typeof vi.fn>; enumerateDevices: ReturnType<typeof vi.fn> }
const wrappers: ReturnType<typeof mount>[] = []
function setup(options: UseAudioReactiveOptions = {}) {
  let engine!: ReturnType<typeof useAudioReactive>
  const wrapper = mount(
    defineComponent({
      setup() {
        engine = useAudioReactive(options)
        return () => null
      },
    }),
  )
  wrappers.push(wrapper)
  return { engine, wrapper }
}

beforeEach(() => {
  vi.useFakeTimers()
  contexts.length = 0
  amplitude = 0
  contextState = 'running'
  resume = async () => {}
  devices = Object.assign(new EventTarget(), {
    getUserMedia: vi.fn(),
    enumerateDevices: vi.fn().mockResolvedValue([]),
  })
  vi.stubGlobal('AudioContext', MockAudioContext)
  vi.stubGlobal('navigator', { mediaDevices: devices })
})
afterEach(() => {
  for (const wrapper of wrappers.splice(0)) wrapper.unmount()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('audio gate', () => {
  it('uses hysteresis and elapsed attack/release delays', () => {
    const gate = createAudioGate()
    const options = { threshold: 20, closeThreshold: 10, attackDelay: 60, releaseDelay: 100 }
    expect(gate.sample(20, 0, options)).toBe(false)
    expect(gate.sample(25, 59, options)).toBe(false)
    expect(gate.sample(25, 60, options)).toBe(true)
    expect(gate.sample(15, 1199, options)).toBe(true)
    expect(gate.sample(9, 1200, options)).toBe(true)
    expect(gate.sample(9, 1299, options)).toBe(true)
    expect(gate.sample(9, 1300, options)).toBe(false)
  })
})

describe('microphone lifecycle', () => {
  it('shares concurrent startup for the same device', async () => {
    const permission = deferred<MediaStream>()
    const { stream } = makeStream()
    devices.getUserMedia.mockReturnValue(permission.promise)
    const { engine } = setup()
    const first = engine.startListening()
    const second = engine.startListening()
    expect(first).toBe(second)
    expect(engine.isStarting.value).toBe(true)
    permission.resolve(stream)
    expect(await first).toBe(true)
    expect(contexts).toHaveLength(1)
  })

  it('stops a permission result that resolves after stop', async () => {
    const permission = deferred<MediaStream>()
    const { stream, track } = makeStream()
    devices.getUserMedia.mockReturnValue(permission.promise)
    const { engine } = setup()
    const result = engine.startListening()
    await engine.stopListening()
    permission.resolve(stream)
    expect(await result).toBe(false)
    expect(track.stop).toHaveBeenCalledTimes(1)
    expect(contexts).toHaveLength(0)
    expect(engine.isListening.value).toBe(false)
  })

  it('keeps the newer device when an older permission request resolves', async () => {
    const oldPermission = deferred<MediaStream>()
    const old = makeStream()
    const fresh = makeStream()
    devices.getUserMedia.mockReturnValueOnce(oldPermission.promise).mockResolvedValueOnce(fresh.stream)
    const { engine } = setup()
    const stale = engine.startListening('old')
    const current = engine.startListening('new')
    expect(await current).toBe(true)
    oldPermission.resolve(old.stream)
    expect(await stale).toBe(false)
    expect(old.track.stop).toHaveBeenCalledTimes(1)
    expect(fresh.track.stop).not.toHaveBeenCalled()
    expect(engine.isListening.value).toBe(true)
  })

  it('releases stream and suspended context when stopped during resume', async () => {
    contextState = 'suspended'
    const resumed = deferred<void>()
    resume = () => resumed.promise
    const { stream, track } = makeStream()
    devices.getUserMedia.mockResolvedValue(stream)
    const { engine } = setup()
    const result = engine.startListening()
    await Promise.resolve()
    await engine.stopListening()
    expect(track.stop).toHaveBeenCalledTimes(1)
    expect(contexts[0].close).toHaveBeenCalledTimes(1)
    resumed.resolve()
    expect(await result).toBe(false)
    expect(contexts[0].close).toHaveBeenCalledTimes(1)
  })

  it('reports permission errors and allows retry', async () => {
    devices.getUserMedia
      .mockRejectedValueOnce(new DOMException('denied', 'NotAllowedError'))
      .mockResolvedValueOnce(makeStream().stream)
    const { engine } = setup()
    expect(await engine.startListening()).toBe(false)
    expect(engine.permissionState.value).toBe('denied')
    expect(await engine.startListening()).toBe(true)
    expect(engine.permissionState.value).toBe('granted')
  })

  it('uses ended listeners and releases exactly once', async () => {
    const { stream, track } = makeStream()
    const removeTrack = vi.spyOn(track, 'removeEventListener')
    devices.getUserMedia.mockResolvedValue(stream)
    const { engine, wrapper } = setup()
    await engine.startListening()
    track.dispatchEvent(new Event('ended'))
    expect(engine.isListening.value).toBe(false)
    expect(engine.errorMessage.value).toContain('断开')
    expect(contexts[0].close).toHaveBeenCalledTimes(1)
    expect(removeTrack).toHaveBeenCalledWith('ended', expect.any(Function))
    wrapper.unmount()
    expect(contexts[0].close).toHaveBeenCalledTimes(1)
  })

  it('restarts when reactive device or suppression settings change', async () => {
    const deviceId = ref<string | undefined>('first')
    const noiseSuppression = ref(false)
    devices.getUserMedia.mockImplementation(async () => makeStream().stream)
    const { engine } = setup({ deviceId, noiseSuppression })
    await engine.startListening()
    deviceId.value = undefined
    await vi.advanceTimersByTimeAsync(0)
    expect(devices.getUserMedia.mock.calls[1][0].audio).not.toHaveProperty('deviceId')
    noiseSuppression.value = true
    await vi.advanceTimersByTimeAsync(0)
    expect(devices.getUserMedia.mock.lastCall[0].audio.noiseSuppression).toBe(true)
    expect(engine.isListening.value).toBe(true)
  })
})

describe('sampling and public API', () => {
  it('samples real RMS with worker timers and never uses RAF', async () => {
    const raf = vi.spyOn(window, 'requestAnimationFrame')
    const onVolume = vi.fn()
    const onSpeakingChange = vi.fn()
    devices.getUserMedia.mockResolvedValue(makeStream().stream)
    const { engine } = setup({ threshold: 15, attackDelay: 40, releaseDelay: 0, onVolume, onSpeakingChange })
    await engine.startListening()
    amplitude = 0.1
    await vi.advanceTimersByTimeAsync(75)
    expect(engine.rawVolume.value).toBeCloseTo(22)
    expect(engine.isSpeaking.value).toBe(true)
    expect(onVolume).toHaveBeenLastCalledWith(expect.closeTo(22), true)
    expect(onSpeakingChange).toHaveBeenLastCalledWith(true, expect.closeTo(22))
    expect(raf).not.toHaveBeenCalled()
  })

  it('calibrates three seconds of RMS samples without changing options', async () => {
    const threshold = ref(15)
    devices.getUserMedia.mockResolvedValue(makeStream().stream)
    const { engine } = setup({ threshold })
    await engine.startListening()
    amplitude = 0.02
    const calibration = engine.calibrateNoise()
    await vi.advanceTimersByTimeAsync(3000)
    expect(await calibration).toEqual({ threshold: 10, closeThreshold: 7 })
    expect(threshold.value).toBe(15)
  })

  it('keeps simulation callbacks consistent and exposes device refresh', async () => {
    const onVolume = vi.fn()
    devices.getUserMedia.mockResolvedValue(makeStream().stream)
    const { engine } = setup({ onVolume })
    await engine.startListening()
    engine.simulateSpeaking(true, 100)
    expect(engine.isSimulating.value).toBe(true)
    expect(engine.rawVolume.value).toBe(65)
    await vi.advanceTimersByTimeAsync(100)
    expect(engine.isSimulating.value).toBe(false)
    expect(onVolume).toHaveBeenLastCalledWith(0, false)
  })
})

describe('audio regression cases', () => {
  it('keeps the component entry as the identical shared implementation', async () => {
    const entry = await import('../components/pngtuber/useAudioReactive')
    expect(entry.useAudioReactive).toBe(useAudioReactive)
  })

  it('discards permission after unmount and does not recreate a context', async () => {
    const permission = deferred<MediaStream>()
    const { stream, track } = makeStream()
    devices.getUserMedia.mockReturnValue(permission.promise)
    const { engine, wrapper } = setup()
    const result = engine.startListening()
    wrapper.unmount()
    permission.resolve(stream)
    expect(await result).toBe(false)
    expect(track.stop).toHaveBeenCalledTimes(1)
    expect(contexts).toHaveLength(0)
    expect(await engine.startListening()).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('does not let a stale permission denial overwrite a newer startup', async () => {
    const old = deferred<MediaStream>(),
      fresh = deferred<MediaStream>()
    devices.getUserMedia.mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise)
    const { engine } = setup()
    const first = engine.startListening('old')
    const second = engine.startListening('new')
    old.reject(new DOMException('denied', 'NotAllowedError'))
    expect(await first).toBe(false)
    expect(engine.isStarting.value).toBe(true)
    expect(engine.errorMessage.value).toBeNull()
    fresh.resolve(makeStream().stream)
    expect(await second).toBe(true)
    expect(engine.permissionState.value).toBe('granted')
  })

  it.each(['suspended', 'closed'])('stops sampling when the context becomes %s', async (state) => {
    const { stream, track } = makeStream()
    devices.getUserMedia.mockResolvedValue(stream)
    const { engine } = setup({ attackDelay: 0 })
    await engine.startListening()
    amplitude = 0.2
    await vi.advanceTimersByTimeAsync(25)
    expect(engine.isSpeaking.value).toBe(true)
    contexts[0].state = state
    contexts[0].dispatchEvent(new Event('statechange'))
    expect(engine.isListening.value).toBe(false)
    expect(engine.isSpeaking.value).toBe(false)
    expect(engine.rawVolume.value).toBe(0)
    expect(track.stop).toHaveBeenCalledTimes(1)
    expect(contexts[0].close).toHaveBeenCalledTimes(state === 'closed' ? 0 : 1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('closes a resumed context once even when close is still pending', async () => {
    const closing = deferred<void>(),
      resuming = deferred<void>()
    contextState = 'suspended'
    resume = () => resuming.promise
    const { stream, track } = makeStream()
    devices.getUserMedia.mockResolvedValue(stream)
    const { engine } = setup()
    const start = engine.startListening()
    await Promise.resolve()
    contexts[0].close.mockImplementation(() => closing.promise)
    const stop = engine.stopListening()
    resuming.resolve()
    await Promise.resolve()
    expect(contexts[0].close).toHaveBeenCalledTimes(1)
    closing.resolve()
    await stop
    expect(await start).toBe(false)
    expect(track.stop).toHaveBeenCalledTimes(1)
    expect(contexts[0].close).toHaveBeenCalledTimes(1)
  })

  it('attempts all cleanup and rejects stop with the original failures', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { stream, track } = makeStream()
    devices.getUserMedia.mockResolvedValue(stream)
    const { engine } = setup()
    await engine.startListening()
    track.stop.mockImplementation(() => {
      throw new Error('track failure')
    })
    contexts[0].source.disconnect.mockImplementation(() => {
      throw new Error('disconnect failure')
    })
    contexts[0].close.mockRejectedValue(new Error('close failure'))
    await expect(engine.stopListening()).rejects.toBeInstanceOf(AggregateError)
    expect(contexts[0].analyser.disconnect).toHaveBeenCalledOnce()
    expect(contexts[0].close).toHaveBeenCalledOnce()
    expect(engine.errorMessage.value).toContain('track failure')
    expect(engine.errorMessage.value).toContain('disconnect failure')
    expect(engine.errorMessage.value).toContain('close failure')
    expect(logged).toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
    logged.mockRestore()
  })

  it.each(['constructor', 'resume', 'connect'])(
    'releases partially initialized resources after %s failure',
    async (failure) => {
      const { stream, track } = makeStream()
      devices.getUserMedia.mockResolvedValue(stream)
      if (failure === 'constructor')
        vi.stubGlobal(
          'AudioContext',
          class {
            constructor() {
              throw new Error('constructor failed')
            }
          },
        )
      if (failure === 'resume') {
        contextState = 'suspended'
        resume = async () => {
          throw new Error('resume failed')
        }
      }
      const { engine } = setup()
      const start = engine.startListening()
      if (failure === 'connect') {
        // Pause construction in resume so the mock connection can be made to fail.
        await Promise.resolve()
      }
      if (failure === 'connect') {
        // A running context connects within the permission continuation; use a second startup.
        await start
        await engine.stopListening()
        contextState = 'suspended'
        resume = async () => {
          contexts.at(-1)!.source.connect.mockImplementation(() => {
            throw new Error('connect failed')
          })
        }
        devices.getUserMedia.mockResolvedValue(makeStream().stream)
        expect(await engine.startListening()).toBe(false)
      } else expect(await start).toBe(false)
      expect(track.stop).toHaveBeenCalledTimes(1)
      for (const context of contexts) expect(context.close).toHaveBeenCalledOnce()
      expect(engine.isListening.value).toBe(false)
      expect(engine.errorMessage.value).toContain('failed')
      expect(vi.getTimerCount()).toBe(0)
    },
  )

  it('can retry a synchronous capture failure', async () => {
    devices.getUserMedia
      .mockImplementationOnce(() => {
        throw new Error('capture failed')
      })
      .mockResolvedValueOnce(makeStream().stream)
    const { engine } = setup()
    expect(await engine.startListening()).toBe(false)
    expect(await engine.startListening()).toBe(true)
  })

  it('refreshes device events and ignores out-of-order enumeration and unmount results', async () => {
    const first = deferred<MediaDeviceInfo[]>()
    devices.enumerateDevices.mockReturnValueOnce(first.promise)
    const { engine, wrapper } = setup()
    devices.enumerateDevices.mockResolvedValue([{ kind: 'audioinput', deviceId: 'usb', label: 'USB' }])
    devices.dispatchEvent(new Event('devicechange'))
    await Promise.resolve()
    first.resolve([])
    await Promise.resolve()
    expect(engine.deviceList.value).toEqual([{ deviceId: 'usb', label: 'USB' }])
    const late = deferred<MediaDeviceInfo[]>()
    devices.enumerateDevices.mockReturnValue(late.promise)
    const refresh = engine.refreshDevices()
    wrapper.unmount()
    late.resolve([])
    await refresh
    expect(engine.deviceList.value).toHaveLength(1)
  })

  it('resets the attack window when muted instead of retaining speech', async () => {
    devices.getUserMedia.mockResolvedValue(makeStream().stream)
    const muted = ref(false)
    const { engine } = setup({ muted, attackDelay: 50 })
    await engine.startListening()
    amplitude = 0.1
    await vi.advanceTimersByTimeAsync(75)
    expect(engine.isSpeaking.value).toBe(true)
    muted.value = true
    await vi.advanceTimersByTimeAsync(25)
    expect(engine.isSpeaking.value).toBe(false)
    muted.value = false
    await vi.advanceTimersByTimeAsync(25)
    expect(engine.isSpeaking.value).toBe(false)
    await vi.advanceTimersByTimeAsync(50)
    expect(engine.isSpeaking.value).toBe(true)
  })

  it('preserves simulated volume during samples and rejects calibration during simulation', async () => {
    devices.getUserMedia.mockResolvedValue(makeStream().stream)
    const { engine } = setup()
    await engine.startListening()
    engine.simulateSpeaking(true, 100)
    amplitude = 0.01
    await vi.advanceTimersByTimeAsync(75)
    expect(engine.rawVolume.value).toBe(65)
    expect(engine.smoothedVolume.value).toBe(65)
    await expect(engine.calibrateNoise()).rejects.toThrow('模拟')
    await vi.advanceTimersByTimeAsync(25)
    expect(engine.isSpeaking.value).toBe(false)
    expect(engine.rawVolume.value).toBe(0)
  })

  it('rejects duplicate and cancelled calibration with a stable result contract', async () => {
    devices.getUserMedia.mockResolvedValue(makeStream().stream)
    const { engine } = setup()
    await expect(engine.calibrateNoise()).rejects.toThrow()
    await engine.startListening()
    const calibration = engine.calibrateNoise()
    const cancelled = expect(calibration).rejects.toThrow('取消')
    await expect(engine.calibrateNoise()).rejects.toThrow()
    await engine.stopListening()
    await cancelled
    expect(engine.isCalibrating.value).toBe(false)
  })
})

describe('audio boundaries', () => {
  it('cancels interrupted attack/release and clamps close threshold', () => {
    const gate = createAudioGate()
    const options = { threshold: 20, closeThreshold: 10, attackDelay: 50, releaseDelay: 100 }
    expect(gate.sample(25, 0, options)).toBe(false)
    expect(gate.sample(19, 49, options)).toBe(false)
    expect(gate.sample(25, 50, options)).toBe(false)
    expect(gate.sample(25, 100, options)).toBe(true)
    expect(gate.sample(0, 200, options)).toBe(true)
    expect(gate.sample(10, 299, options)).toBe(true)
    expect(gate.sample(0, 300, options)).toBe(true)
    expect(gate.sample(0, 400, options)).toBe(false)
    gate.reset()
    expect(gate.sample(25, 500, { ...options, attackDelay: 0 })).toBe(true)
    expect(gate.sample(25, 600, { ...options, closeThreshold: 30, releaseDelay: 0 })).toBe(true)
    gate.reset()
    expect(gate.sample(15, 700, options)).toBe(false)
  })

  it('auto-starts on mount, applies gain and clamps RMS to 100', async () => {
    devices.getUserMedia.mockResolvedValue(makeStream().stream)
    const gain = ref(2)
    const { engine } = setup({ gain, autoStart: true })
    await vi.advanceTimersByTimeAsync(0)
    expect(engine.isListening.value).toBe(true)
    amplitude = 0.1
    await vi.advanceTimersByTimeAsync(25)
    expect(engine.rawVolume.value).toBeCloseTo(44)
    expect(engine.smoothedVolume.value).toBeGreaterThan(0)
    expect(engine.smoothedVolume.value).toBeLessThan(44)
    amplitude = 1
    await vi.advanceTimersByTimeAsync(25)
    expect(engine.rawVolume.value).toBe(100)
    gain.value = -1
    await vi.advanceTimersByTimeAsync(25)
    expect(engine.rawVolume.value).toBe(0)
  })

  it('ignores one transient calibration peak and bounds recommendations', async () => {
    devices.getUserMedia.mockResolvedValue(makeStream().stream)
    const { engine } = setup()
    await engine.startListening()
    amplitude = 0.02
    const result = engine.calibrateNoise()
    await vi.advanceTimersByTimeAsync(2975)
    amplitude = 1
    await vi.advanceTimersByTimeAsync(25)
    expect(await result).toEqual({ threshold: 10, closeThreshold: 7 })
    const loud = engine.calibrateNoise()
    await vi.advanceTimersByTimeAsync(3000)
    expect(await loud).toEqual({ threshold: 100, closeThreshold: 99 })
  })

  it('reports unsupported capture without creating resources', async () => {
    vi.stubGlobal('AudioContext', undefined)
    const { engine } = setup()
    expect(engine.isSupported).toBe(false)
    expect(engine.permissionState.value).toBe('unsupported')
    expect(await engine.startListening()).toBe(false)
    expect(engine.isStarting.value).toBe(false)
    expect(devices.getUserMedia).not.toHaveBeenCalled()
  })
})

it('waits for the old context to close and coalesces the new device startup', async () => {
  devices.getUserMedia.mockImplementation(async () => makeStream().stream)
  const { engine } = setup()
  await engine.startListening('first')
  const closing = deferred<void>()
  contexts[0].close.mockImplementation(() => closing.promise)
  const switched = engine.startListening('second')
  expect(engine.startListening('second')).toBe(switched)
  expect(engine.isStarting.value).toBe(true)
  expect(devices.getUserMedia).toHaveBeenCalledTimes(1)
  closing.resolve()
  expect(await switched).toBe(true)
  expect(devices.getUserMedia).toHaveBeenCalledTimes(2)
  expect(contexts[0].close).toHaveBeenCalledOnce()
  expect(vi.getTimerCount()).toBe(1)
})

it('restarts a pending permission request when suppression changes on the same device', async () => {
  const permission = deferred<MediaStream>()
  const stale = makeStream()
  devices.getUserMedia.mockReturnValueOnce(permission.promise).mockResolvedValueOnce(makeStream().stream)
  const noiseSuppression = ref(false)
  const { engine } = setup({ noiseSuppression })
  const first = engine.startListening()
  noiseSuppression.value = true
  await vi.advanceTimersByTimeAsync(0)
  expect(devices.getUserMedia).toHaveBeenCalledTimes(2)
  expect(devices.getUserMedia.mock.lastCall![0].audio.noiseSuppression).toBe(true)
  permission.resolve(stale.stream)
  expect(await first).toBe(false)
  expect(stale.track.stop).toHaveBeenCalledOnce()
  expect(engine.isListening.value).toBe(true)
})

it('keeps rapid device switches behind an outstanding close', async () => {
  devices.getUserMedia.mockImplementation(async () => makeStream().stream)
  const { engine } = setup()
  await engine.startListening('first')
  const closing = deferred<void>()
  contexts[0].close.mockImplementation(() => closing.promise)
  const second = engine.startListening('second')
  const third = engine.startListening('third')
  await vi.advanceTimersByTimeAsync(0)
  expect(devices.getUserMedia).toHaveBeenCalledTimes(1)
  closing.resolve()
  expect(await second).toBe(false)
  expect(await third).toBe(true)
  expect(devices.getUserMedia.mock.lastCall![0].audio.deviceId).toEqual({ exact: 'third' })
  expect(contexts[0].close).toHaveBeenCalledOnce()
})
