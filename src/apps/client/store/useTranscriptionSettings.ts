import { nanoid } from 'nanoid'
import type {
  OpenAITranscriptionProfile,
  TencentTranscriptionProfile,
  TranscriptionProfile,
  TranscriptionProvider,
  TranscriptionSettings,
} from '@/shared/models/transcription'
import { useTauriStore } from './useTauriStore'

const STORE_KEY = 'transcription.settings'

function createTencentProfile(): TencentTranscriptionProfile {
  return {
    id: nanoid(),
    name: '腾讯云实时转写',
    provider: 'tencent',
    language: 'zh-CN',
    hotwords: [],
    engineModelType: '16k_zh',
    appId: '',
    secretId: '',
    secretKey: '',
  }
}

function createOpenAIProfile(): OpenAITranscriptionProfile {
  return {
    id: nanoid(),
    name: 'OpenAI 实时转写',
    provider: 'openai',
    language: 'zh',
    hotwords: [],
    model: 'gpt-live-transcribe',
    apiKey: '',
    baseUrl: 'wss://api.openai.com/v1/realtime',
  }
}

export function createTranscriptionProfile(provider: TranscriptionProvider): TranscriptionProfile {
  return provider === 'tencent' ? createTencentProfile() : createOpenAIProfile()
}

export const useTranscriptionSettings = defineStore('transcription-settings', () => {
  const target = useTauriStore().getTarget<TranscriptionSettings>(STORE_KEY)
  const firstProfile = createTencentProfile()
  const settings = ref<TranscriptionSettings>({
    activeProfileId: firstProfile.id,
    profiles: [firstProfile],
  })
  const initialized = ref(false)

  const activeProfile = computed(() =>
    settings.value.profiles.find(profile => profile.id === settings.value.activeProfileId),
  )

  async function init() {
    if (initialized.value) return
    const saved = await target.get()
    if (saved?.profiles.length) {
      settings.value = saved
      if (!saved.profiles.some(profile => profile.id === saved.activeProfileId)) {
        settings.value.activeProfileId = saved.profiles[0].id
      }
    }
    initialized.value = true
  }

  async function save() {
    await target.set(settings.value)
  }

  function addProfile(provider: TranscriptionProvider) {
    const profile = createTranscriptionProfile(provider)
    settings.value.profiles.push(profile)
    settings.value.activeProfileId = profile.id
    return profile
  }

  function removeActiveProfile() {
    if (settings.value.profiles.length === 1) return
    const index = settings.value.profiles.findIndex(profile => profile.id === settings.value.activeProfileId)
    settings.value.profiles.splice(index, 1)
    settings.value.activeProfileId = settings.value.profiles[Math.max(0, index - 1)].id
  }

  return {
    settings,
    initialized,
    activeProfile,
    init,
    save,
    addProfile,
    removeActiveProfile,
  }
})

if (import.meta.hot) import.meta.hot.accept(acceptHMRUpdate(useTranscriptionSettings, import.meta.hot))
