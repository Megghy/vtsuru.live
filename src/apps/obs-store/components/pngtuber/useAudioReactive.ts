import type { Ref } from 'vue'
import {
  computed,
  onMounted,
  onScopeDispose,
  ref,
  toValue,
  watch,
} from 'vue'

export interface UseAudioReactiveOptions {
  /** 说话触发判定阈值 (1~100) */
  threshold?: Ref<number> | number
  /** 麦克风增益倍数 (0.5~3.0) */
  gain?: Ref<number> | number
  /** 说话结束后的保持释放延时 (毫秒) */
  releaseDelay?: Ref<number> | number
  /** 目标麦克风设备 ID */
  deviceId?: Ref<string | undefined> | string
  /** 是否在就绪后自动尝试启动 */
  autoStart?: boolean
  /** 说话状态变化回调 */
  onSpeakingChange?: (isSpeaking: boolean, volume: number) => void
}

export interface AudioDeviceOption {
  deviceId: string
  label: string
}

export function useAudioReactive(options: UseAudioReactiveOptions = {}) {
  const {
    threshold = 15,
    gain = 1.0,
    releaseDelay = 220,
    deviceId,
    autoStart = false,
    onSpeakingChange,
  } = options

  const isListening = ref(false)
  const isSpeaking = ref(false)
  const isSimulating = ref(false)
  const rawVolume = ref(0)
  const smoothedVolume = ref(0)
  const permissionState = ref<'prompt' | 'granted' | 'denied' | 'unsupported'>('prompt')
  const errorMessage = ref<string | null>(null)
  const deviceList = ref<AudioDeviceOption[]>([])

  let audioContext: AudioContext | null = null
  let mediaStream: MediaStream | null = null
  let sourceNode: MediaStreamAudioSourceNode | null = null
  let analyserNode: AnalyserNode | null = null
  let animationFrameId: number | null = null
  let releaseTimer: ReturnType<typeof setTimeout> | null = null
  let timeDomainBuffer: Uint8Array<ArrayBuffer> | null = null

  // 检查浏览器是否支持音频 API
  const isSupported = typeof window !== 'undefined'
    && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
    && !!(window.AudioContext || (window as any).webkitAudioContext)

  if (!isSupported) {
    permissionState.value = 'unsupported'
    errorMessage.value = '当前浏览器环境不支持 Web Audio 麦克风采集'
  }

  /**
   * 枚举音频输入设备
   */
  async function refreshDevices() {
    if (!navigator?.mediaDevices?.enumerateDevices) return
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const audioInputs = devices
        .filter((d) => d.kind === 'audioinput')
        .map((d, index) => ({
          deviceId: d.deviceId,
          label: d.label || `麦克风 ${index + 1}${d.deviceId === 'default' ? ' (默认)' : ''}`,
        }))

      // 确保至少有默认项
      if (audioInputs.length === 0) {
        audioInputs.push({ deviceId: 'default', label: '默认麦克风' })
      }
      deviceList.value = audioInputs
    } catch {
      // 忽略枚举失败
    }
  }

  /**
   * 停止当前音频采集并释放硬件资源
   */
  function stopListening() {
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId)
      animationFrameId = null
    }

    if (releaseTimer !== null) {
      clearTimeout(releaseTimer)
      releaseTimer = null
    }

    if (sourceNode) {
      try {
        sourceNode.disconnect()
      } catch {}
      sourceNode = null
    }

    if (analyserNode) {
      try {
        analyserNode.disconnect()
      } catch {}
      analyserNode = null
    }

    if (mediaStream) {
      try {
        mediaStream.getTracks().forEach((track) => track.stop())
      } catch {}
      mediaStream = null
    }

    if (audioContext && audioContext.state !== 'closed') {
      try {
        audioContext.close()
      } catch {}
      audioContext = null
    }

    isListening.value = false
    rawVolume.value = 0
    smoothedVolume.value = 0
    if (!isSimulating.value) {
      setSpeakingState(false)
    }
  }

  function setSpeakingState(speaking: boolean) {
    if (isSpeaking.value !== speaking) {
      isSpeaking.value = speaking
      onSpeakingChange?.(speaking, rawVolume.value)
    }
  }

  /**
   * 启动麦克风监听
   */
  async function startListening(targetDeviceId?: string): Promise<boolean> {
    if (!isSupported) {
      errorMessage.value = '浏览器不支持麦克风采集'
      return false
    }

    stopListening()
    errorMessage.value = null

    try {
      const selectedDevId = targetDeviceId ?? (deviceId ? toValue(deviceId) : undefined)
      const audioConstraints: MediaTrackConstraints = {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      }

      if (selectedDevId && selectedDevId !== 'default') {
        audioConstraints.deviceId = { exact: selectedDevId }
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
        video: false,
      })

      mediaStream = stream
      permissionState.value = 'granted'

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      audioContext = new AudioCtx()
      if (audioContext.state === 'suspended') {
        await audioContext.resume()
      }

      analyserNode = audioContext.createAnalyser()
      analyserNode.fftSize = 512
      analyserNode.smoothingTimeConstant = 0.2

      sourceNode = audioContext.createMediaStreamSource(stream)
      sourceNode.connect(analyserNode)

      timeDomainBuffer = new Uint8Array(analyserNode.fftSize)
      isListening.value = true

      // 刷新一次设备列表（授权后能获取到真实设备标签名）
      await refreshDevices()

      // 开始帧循环监听
      startProcessLoop()
      return true
    } catch (err: any) {
      isListening.value = false
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        permissionState.value = 'denied'
        errorMessage.value = '麦克风权限被拒绝，请在浏览器地址栏允许麦克风权限'
      } else {
        errorMessage.value = `启动麦克风失败: ${err.message || err.name}`
      }
      return false
    }
  }

  /**
   * 核心音量处理与状态判定循环
   */
  function startProcessLoop() {
    function process() {
      if (!isListening.value || !analyserNode || !timeDomainBuffer) return

      analyserNode.getByteTimeDomainData(timeDomainBuffer)

      // 计算 RMS 均方根音量
      let sum = 0
      const len = timeDomainBuffer.length
      for (let i = 0; i < len; i++) {
        const normalized = (timeDomainBuffer[i] - 128) / 128
        sum += normalized * normalized
      }
      const rms = Math.sqrt(sum / len)

      // 应用用户设置的增益
      const currentGain = toValue(gain) || 1.0
      const calculatedVolume = Math.min(100, Math.round(rms * 100 * currentGain * 2.2))

      rawVolume.value = calculatedVolume
      // 快速上升，平缓下降的平滑电平值
      if (calculatedVolume > smoothedVolume.value) {
        smoothedVolume.value = calculatedVolume
      } else {
        smoothedVolume.value = Math.max(0, Math.round(smoothedVolume.value * 0.85 + calculatedVolume * 0.15))
      }

      const currentThreshold = toValue(threshold) || 15
      const currentReleaseDelay = toValue(releaseDelay) || 220

      // 如果开启了模拟状态，则忽略真实音频状态
      if (!isSimulating.value) {
        if (calculatedVolume >= currentThreshold) {
          // 音量超过阈值，立即进入说话状态
          if (releaseTimer !== null) {
            clearTimeout(releaseTimer)
            releaseTimer = null
          }
          setSpeakingState(true)
        } else if (isSpeaking.value) {
          // 音量低于阈值，启动释放倒计时
          if (releaseTimer === null) {
            releaseTimer = setTimeout(() => {
              setSpeakingState(false)
              releaseTimer = null
            }, currentReleaseDelay)
          }
        }
      }

      animationFrameId = requestAnimationFrame(process)
    }

    animationFrameId = requestAnimationFrame(process)
  }

  /**
   * 模拟说话状态切换（供无麦克风调试或测试动画效果）
   */
  function simulateSpeaking(active: boolean) {
    isSimulating.value = active
    setSpeakingState(active)
    if (active) {
      rawVolume.value = 65
      smoothedVolume.value = 65
    } else {
      rawVolume.value = 0
      smoothedVolume.value = 0
    }
  }

  // 监听设备切换
  if (deviceId) {
    watch(
      () => toValue(deviceId),
      (newDevId) => {
        if (isListening.value && newDevId) {
          startListening(newDevId)
        }
      },
    )
  }

  if (isSupported) {
    refreshDevices()
  }

  onMounted(() => {
    if (autoStart && isSupported) {
      void startListening()
    }
  })

  onScopeDispose(() => {
    stopListening()
  })

  return {
    isSupported,
    isListening,
    isSpeaking,
    isSimulating,
    rawVolume,
    smoothedVolume,
    permissionState,
    errorMessage,
    deviceList,
    startListening,
    stopListening,
    refreshDevices,
    simulateSpeaking,
  }
}
