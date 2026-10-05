import { ServerVoiceProvider } from './server'
import type { ConfigSource } from './types'

export const DEFAULT_GROK_VOICE = 'eve'

export class GrokVoiceProvider extends ServerVoiceProvider {
  constructor(getConfig: ConfigSource) {
    super('grok-tts', 'Grok TTS', getConfig)
  }
}
