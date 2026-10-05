import { AzureVoiceProvider } from './azure'
import { CosyVoiceProvider, DEFAULT_COSYVOICE_MODEL, DEFAULT_COSYVOICE_VOICE } from './cosyvoice'
import { CustomApiVoiceProvider } from './custom-api'
import { DEFAULT_GROK_VOICE, GrokVoiceProvider } from './grok'
import { LocalVoiceProvider } from './local'
import { DEFAULT_MIMO_VOICE, MimoVoiceProvider } from './mimo'
import { OpenAICompatibleVoiceProvider } from './openai'
import { DEFAULT_QWEN_VOICE, QwenVoiceProvider } from './qwen'
import type { ConfigSource, VoiceProvider } from './types'

type ProviderFactory = (getConfig: ConfigSource) => VoiceProvider

const providerFactories = new Map<string, ProviderFactory>()

export function registerVoiceProvider(id: string, factory: ProviderFactory) {
  providerFactories.set(id, factory)
}

export function createVoiceProvider(id: string, getConfig: ConfigSource): VoiceProvider | undefined {
  const factory = providerFactories.get(id)
  return factory ? factory(getConfig) : undefined
}

export function listVoiceProviders(): Array<{ id: string; name: string; description: string }> {
  return Array.from(providerFactories.entries()).map(([id, factory]) => {
    const instance = factory(() => ({}))
    return { id, name: instance.name, description: instance.description }
  })
}

export function hasVoiceProvider(id: string): boolean {
  return providerFactories.has(id)
}

registerVoiceProvider('local', (getConfig) => new LocalVoiceProvider(getConfig))
registerVoiceProvider('azure', (getConfig) => new AzureVoiceProvider(getConfig))
registerVoiceProvider('cosyvoice', (getConfig) => new CosyVoiceProvider(getConfig))
registerVoiceProvider('api', (getConfig) => new CustomApiVoiceProvider(getConfig))
registerVoiceProvider('mimo', (getConfig) => new MimoVoiceProvider(getConfig))
registerVoiceProvider('grok-tts', (getConfig) => new GrokVoiceProvider(getConfig))
registerVoiceProvider('qwen-tts', (getConfig) => new QwenVoiceProvider(getConfig))
registerVoiceProvider('openai', (getConfig) => new OpenAICompatibleVoiceProvider(getConfig))

export * from './types'
export {
  AzureVoiceProvider,
  CosyVoiceProvider,
  CustomApiVoiceProvider,
  DEFAULT_COSYVOICE_MODEL,
  DEFAULT_COSYVOICE_VOICE,
  DEFAULT_GROK_VOICE,
  DEFAULT_MIMO_VOICE,
  DEFAULT_QWEN_VOICE,
  GrokVoiceProvider,
  LocalVoiceProvider,
  MimoVoiceProvider,
  OpenAICompatibleVoiceProvider,
  QwenVoiceProvider,
}
