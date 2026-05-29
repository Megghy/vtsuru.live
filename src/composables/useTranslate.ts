import { computed, ref } from 'vue'
import { QueryPostAPI } from '@/api/query'
import { VTSURU_API_URL } from '@/shared/config'

export type TranslateMode = 'browser' | 'cloud'

export const LANG_OPTIONS = [
  { label: '英语', value: 'en' },
  { label: '中文(简体)', value: 'zh' },
  { label: '中文(繁体)', value: 'zh-Hant' },
  { label: '日语', value: 'ja' },
  { label: '韩语', value: 'ko' },
  { label: '法语', value: 'fr' },
  { label: '德语', value: 'de' },
  { label: '西班牙语', value: 'es' },
  { label: '俄语', value: 'ru' },
]

export function useTranslate() {
  const browserApiAvailable = ref('Translator' in globalThis)
  const mode = ref<TranslateMode>(browserApiAvailable.value ? 'browser' : 'cloud')
  const sourceLang = ref<string | null>(null)
  const targetLang = ref('en')
  const detectedLang = ref('')
  const translating = ref(false)

  const sourceLangOptions = computed(() => [
    { label: detectedLang.value ? `自动 (${detectedLang.value})` : '自动检测', value: null },
    ...LANG_OPTIONS,
  ])

  const modeOptions = computed(() => [
    { label: '浏览器翻译', value: 'browser', disabled: !browserApiAvailable.value },
    { label: '云端翻译', value: 'cloud' },
  ])

  async function translate(text: string): Promise<string> {
    if (!text.trim()) throw new Error('文本为空')
    translating.value = true
    try {
      if (mode.value === 'browser') return await translateBrowser(text)
      return await translateCloud(text)
    } finally {
      translating.value = false
    }
  }

  async function translateBrowser(text: string): Promise<string> {
    let source = sourceLang.value
    if (!source) {
      const detector = await (window as any).LanguageDetector.create()
      const [{ detectedLanguage }] = await detector.detect(text)
      source = detectedLanguage
      detectedLang.value = detectedLanguage
    }
    const translator = await (window as any).Translator.create({
      sourceLanguage: source,
      targetLanguage: targetLang.value,
    })
    return await translator.translate(text)
  }

  async function translateCloud(text: string): Promise<string> {
    const resp = await QueryPostAPI<string>(`${VTSURU_API_URL}translate`, {
      text,
      targetLang: targetLang.value,
    })
    if (resp.code !== 200) throw new Error(resp.message)
    return resp.data
  }

  return {
    browserApiAvailable,
    mode,
    modeOptions,
    sourceLang,
    sourceLangOptions,
    targetLang,
    detectedLang,
    translating,
    translate,
  }
}
