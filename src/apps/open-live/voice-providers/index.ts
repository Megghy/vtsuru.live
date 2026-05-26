import type { ConfigSource, VoiceProvider } from './types'
import { LocalVoiceProvider } from './local'
import { AzureVoiceProvider } from './azure'
import { CustomApiVoiceProvider } from './custom-api'
import { DEFAULT_MIMO_VOICE, MimoVoiceProvider } from './mimo'
import { OpenAICompatibleVoiceProvider } from './openai'

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
registerVoiceProvider('api', (getConfig) => new CustomApiVoiceProvider(getConfig))
registerVoiceProvider('mimo', (getConfig) => new MimoVoiceProvider(getConfig))
registerVoiceProvider('openai', (getConfig) => new OpenAICompatibleVoiceProvider(getConfig))

export * from './types'
export {
  AzureVoiceProvider,
  CustomApiVoiceProvider,
  DEFAULT_MIMO_VOICE,
  LocalVoiceProvider,
  MimoVoiceProvider,
  OpenAICompatibleVoiceProvider,
}
