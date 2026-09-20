import { describe, expect, it } from 'vitest'

import {
  DEFAULT_PNGTUBER_STATE,
  sanitizePngtuberState,
} from '../components/pngtuber/types'
import { useAudioReactive } from '../components/pngtuber/useAudioReactive'
import { getObsComponentById } from '../registry'

describe('PNGtuber (反应立绘挂件)', () => {
  describe('状态与默认值契约', () => {
    it('DEFAULT_PNGTUBER_STATE 应当具备完整的默认配置', () => {
      expect(DEFAULT_PNGTUBER_STATE.idleImage).toBe('')
      expect(DEFAULT_PNGTUBER_STATE.speakingImage).toBe('')
      expect(DEFAULT_PNGTUBER_STATE.threshold).toBe(15)
      expect(DEFAULT_PNGTUBER_STATE.gain).toBe(1.0)
      expect(DEFAULT_PNGTUBER_STATE.releaseDelay).toBe(220)
      expect(DEFAULT_PNGTUBER_STATE.speakingAnimation).toBe('bounce')
      expect(DEFAULT_PNGTUBER_STATE.idleAnimation).toBe('breathe')
      expect(DEFAULT_PNGTUBER_STATE.intensity).toBe('normal')
      expect(DEFAULT_PNGTUBER_STATE.scale).toBe(1.0)
      expect(DEFAULT_PNGTUBER_STATE.flipH).toBe(false)
      expect(DEFAULT_PNGTUBER_STATE.showGlow).toBe(true)
      expect(DEFAULT_PNGTUBER_STATE.shadow).toBe(true)
      expect(DEFAULT_PNGTUBER_STATE).not.toHaveProperty('isSpeaking')
      expect(DEFAULT_PNGTUBER_STATE).not.toHaveProperty('currentVolume')
    })

    it('sanitizePngtuberState 丢弃 data/blob 立绘，保留 http 地址', () => {
      const sanitized = sanitizePngtuberState({
        ...DEFAULT_PNGTUBER_STATE,
        idleImage: 'data:image/png;base64,AAAA',
        speakingImage: 'https://example.com/idle.webp',
      })
      expect(sanitized.idleImage).toBe('')
      expect(sanitized.speakingImage).toBe('https://example.com/idle.webp')
    })
  })

  describe('组件注册表元数据 (Registry)', () => {
    it('pngtuber 必须在 OBS 独立组件库中成功注册且状态为 ready', () => {
      const comp = getObsComponentById('pngtuber')
      expect(comp).toBeDefined()
      expect(comp?.id).toBe('pngtuber')
      expect(comp?.name).toBe('PNGtuber 反应立绘')
      expect(comp?.category).toBe('interactive')
      expect(comp?.status).toBe('ready')
      expect(comp?.obsPath).toBe('/obs-store/pngtuber')
      expect(comp?.managePath).toBe('/obs-store/pngtuber-manage')
      expect(comp?.defaultResolution?.width).toBe(400)
      expect(comp?.defaultResolution?.height).toBe(500)
      expect(comp?.manageComponent).toBeTypeOf('function')
    })
  })

  describe('音频反应逻辑 (useAudioReactive)', () => {
    it('支持模拟测试说话触发', () => {
      let callbackSpeaking = false
      const {
        isSpeaking,
        rawVolume,
        simulateSpeaking,
      } = useAudioReactive({
        onSpeakingChange: (speaking) => {
          callbackSpeaking = speaking
        },
      })

      expect(isSpeaking.value).toBe(false)
      expect(rawVolume.value).toBe(0)

      simulateSpeaking(true)
      expect(isSpeaking.value).toBe(true)
      expect(rawVolume.value).toBeGreaterThan(0)
      expect(callbackSpeaking).toBe(true)

      simulateSpeaking(false)
      expect(isSpeaking.value).toBe(false)
      expect(rawVolume.value).toBe(0)
      expect(callbackSpeaking).toBe(false)
    })
  })
})
