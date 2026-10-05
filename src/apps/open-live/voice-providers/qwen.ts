import { ServerVoiceProvider } from './server'
import type { ConfigSource } from './types'

export const DEFAULT_QWEN_VOICE = 'longanlingxin'

export class QwenVoiceProvider extends ServerVoiceProvider {
  constructor(getConfig: ConfigSource) {
    super('qwen-tts', '千问 TTS', getConfig)
  }
}
