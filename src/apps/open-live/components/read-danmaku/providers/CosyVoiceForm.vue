<script setup lang="ts">
const LockClosed16Filled = 'i-lucide-circle'
import type { VNode } from 'vue'
import { computed, h, ref, watch, resolveComponent } from 'vue'

import {
  COSYVOICE_LANGUAGE_HINTS,
  COSYVOICE_MODELS,
  COSYVOICE_SYSTEM_VOICES,
  DEFAULT_COSYVOICE_MODEL,
  DEFAULT_COSYVOICE_VOICE,
  listCosyVoiceCustomVoices,
} from '@/apps/open-live/voice-providers/cosyvoice'
import { useSpeechService } from '@/store/useSpeechService'

import SectionField from '../SectionField.vue'
import VoiceSelectWithPreview from '../VoiceSelectWithPreview.vue'

const toast = useToast()
const feedback = (color: 'success' | 'error' | 'warning' | 'info', title: string) => {
  toast.add({ title, color })
}
const speechService = useSpeechService()

// 下拉项渲染到 body，使用主题变量确保与页面保持一致。
const MODEL_STYLE = {
  option:
    'display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;padding:var(--model-pad,5px 2px)',
  copy: 'min-width:0;display:flex;flex-direction:column;gap:3px',
  head: 'display:flex;align-items:center;gap:5px;min-width:0',
  lock: 'flex-shrink:0;font-size:12px;color:var(--vtsuru-fg-muted)',
  note: 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;line-height:1.4;color:var(--vtsuru-fg-muted)',
  name: (disabled: boolean) =>
    `min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600;font-size:13px;letter-spacing:.01em;color:${disabled ? 'var(--vtsuru-fg-muted)' : 'inherit'}`,
  price: (disabled: boolean) =>
    `flex-shrink:0;padding:2px 9px;border-radius:999px;font-size:11px;font-weight:600;line-height:1.5;font-variant-numeric:tabular-nums;white-space:nowrap;background:${disabled ? 'var(--vtsuru-bg-muted)' : 'var(--vtsuru-brand-tint)'};color:${disabled ? 'var(--vtsuru-fg-muted)' : 'var(--vtsuru-brand)'}`,
} as const
const { settings } = speechService
const customVoiceLoading = ref(false)
const cosyvoice = computed(() => settings.value.providers.cosyvoice)
const hasUserKey = computed(() => Boolean(cosyvoice.value.apiKey?.trim()))
const customVoices = computed(() => cosyvoice.value.customVoices ?? [])
const selectedModel = computed(() => COSYVOICE_MODELS.find((x) => x.value === cosyvoice.value.model))
const customVoiceOnly = computed(() => Boolean(selectedModel.value?.customVoiceOnly))
const voiceOptions = computed(() => (customVoiceOnly.value ? customVoices.value : speechService.getAvailableVoices()))
const modelOptions = computed(() =>
  COSYVOICE_MODELS.map((option) => ({
    ...option,
    disabled: option.customVoiceOnly && !hasUserKey.value,
  })),
)

function modelNote(option: any) {
  return option.disabled ? '需要填写自己的 DashScope Key，并使用声音复刻/声音设计音色。' : (option.note as string)
}

function renderModelLabel(option: any) {
  const disabled = Boolean(option.disabled)
  return h('div', { class: 'model-option', style: MODEL_STYLE.option }, [
    h('div', { class: 'model-copy', style: MODEL_STYLE.copy }, [
      h('div', { style: MODEL_STYLE.head }, [
        disabled ? h(resolveComponent('UIcon'), { component: LockClosed16Filled, style: MODEL_STYLE.lock }) : null,
        h('span', { class: 'model-name', style: MODEL_STYLE.name(disabled) }, option.label as string),
      ]),
      h('span', { class: 'model-note', style: MODEL_STYLE.note }, modelNote(option)),
    ]),
    h('span', { class: 'model-price', style: MODEL_STYLE.price(disabled) }, option.price as string),
  ])
}

function renderModelOption({ node, option }: { node: VNode; option: any }) {
  return h(
    resolveComponent('UTooltip'),
    { placement: 'right', showArrow: false, delay: 300 },
    {
      trigger: () => node,
      default: () => modelNote(option),
    },
  )
}

async function refreshCustomVoices() {
  const apiKey = cosyvoice.value.apiKey?.trim()
  if (!apiKey) {
    feedback('warning', '请先填写自己的 DashScope API Key')
    return
  }

  customVoiceLoading.value = true
  try {
    const voices = await listCosyVoiceCustomVoices(apiKey)
    cosyvoice.value.customVoices = voices
    if (voices.length === 0) {
      feedback('info', '当前 Key 下没有可用的 CosyVoice 自定义音色')
    } else {
      feedback('success', `已加载 ${voices.length} 个自定义音色`)
    }
  } catch (error) {
    feedback('error', error instanceof Error ? error.message : '拉取自定义音色失败')
  } finally {
    customVoiceLoading.value = false
  }
}

watch(
  () => cosyvoice.value.model,
  (model) => {
    if (!model) cosyvoice.value.model = DEFAULT_COSYVOICE_MODEL
    if (model?.startsWith('cosyvoice-v3.5')) {
      const current = cosyvoice.value.voice
      const customVoice = customVoices.value.find((x) => x.value === current)
      cosyvoice.value.voice = customVoice ? String(customVoice.value) : String(customVoices.value[0]?.value ?? '')
      return
    }
    const current = cosyvoice.value.voice
    const isCustomVoice = customVoices.value.some((x) => x.value === current)
    const isSystemVoice = COSYVOICE_SYSTEM_VOICES.some((x) => x.value === current)
    if (!isCustomVoice && !isSystemVoice) cosyvoice.value.voice = DEFAULT_COSYVOICE_VOICE
  },
  { immediate: true },
)

watch(hasUserKey, (value) => {
  if (value) return
  cosyvoice.value.customVoices = []
  if (cosyvoice.value.model?.startsWith('cosyvoice-v3.5')) {
    cosyvoice.value.model = DEFAULT_COSYVOICE_MODEL
  }
})
</script>

<template>
  <div class="form">
    <SectionField
      label="DashScope API Key"
      hint="需要前往阿里云百炼创建语音服务实例并获取 API Key, 否则使用本站默认的共享 Key, 可能会遇到排队或调用失败的情况"
    >
      <UInput
        v-model="settings.providers.cosyvoice.apiKey"
        type="password"
        show-password-on="click"
        placeholder="sk-xxxx"
        size="small"
        :input-props="{ autocomplete: 'new-password' }"
      />
      <span
        depth="3"
        style="font-size: 11px"
      >
        <a
          href="https://bailian.console.aliyun.com/"
          target="_blank"
          rel="noopener"
          style="color: var(--vtsuru-fg-muted)"
        >
          前往阿里云百炼获取 API Key →
        </a>
      </span>
    </SectionField>

    <SectionField label="模型">
      <USelectMenu
        v-model="settings.providers.cosyvoice.model"
        :items="modelOptions"
        :render-label="renderModelLabel"
        :render-option="renderModelOption"
        size="small"
        value-key="value"
      />
    </SectionField>

    <SectionField label="音色">
      <div
        vertical
        :size="6"
      >
        <div
          :size="6"
          align="center"
          :wrap="false"
        >
          <VoiceSelectWithPreview
            v-model="settings.providers.cosyvoice.voice"
            :options="voiceOptions"
            :loading="customVoiceLoading"
            placeholder="longanyang"
            style="flex: 1; min-width: 0"
          />
          <UTooltip>
            <UButton
              variant="soft"
              :loading="customVoiceLoading"
              :disabled="!hasUserKey"
              @click="refreshCustomVoices"
            >
              <template #leading>
                <UIcon name="i-lucide-circle" />
              </template>
            </UButton>
            <template #content> 从当前用户 DashScope Key 拉取声音复刻/设计音色 </template>
          </UTooltip>
        </div>
        <UAlert
          v-if="customVoiceOnly && customVoices.length === 0"
          type="warning"
          :bordered="false"
        >
          CosyVoice3.5 不支持系统音色。请刷新并选择声音复刻/声音设计音色。
        </UAlert>
        <span
          depth="3"
          style="font-size: 11px"
        >
          <a
            href="https://help.aliyun.com/zh/model-studio/voice-cloning-user-guide"
            target="_blank"
            rel="noopener"
            style="color: var(--vtsuru-fg-muted)"
          >
            如何创建声音复刻 / 声音设计音色？查看百炼教程 →
          </a>
        </span>
      </div>
    </SectionField>

    <SectionField
      label="语言提示"
      hint="用于改善数字、缩写、符号或小语种读法。阿里云当前版本主要处理第一个语言提示。"
    >
      <USelectMenu
        v-model="settings.providers.cosyvoice.languageHint"
        :items="COSYVOICE_LANGUAGE_HINTS"
        size="small"
        value-key="value"
      />
    </SectionField>
  </div>
</template>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* 选中后回填到输入框：隐藏说明，收成单行 */
.form :deep(.u-base-selection-label .model-option) {
  --model-pad: 0;
}

.form :deep(.u-base-selection-label .model-note) {
  display: none;
}
</style>
