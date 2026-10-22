<script setup lang="ts">
import { ArrowSync20Regular, LockClosed16Filled } from '@vicons/fluent'
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import {
  COSYVOICE_LANGUAGE_HINTS,
  COSYVOICE_MODELS,
  COSYVOICE_SYSTEM_VOICES,
  DEFAULT_COSYVOICE_MODEL,
  DEFAULT_COSYVOICE_VOICE,
  listCosyVoiceCustomVoices,
} from '@/apps/open-live/voice-providers/cosyvoice'
import { useSpeechService } from '@/store/useSpeechService'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'

import SectionField from '../SectionField.vue'
import VoiceSelectWithPreview from '../VoiceSelectWithPreview.vue'

const speechService = useSpeechService()
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

function modelNote(option: { disabled?: boolean; note?: string }) {
  return option.disabled ? '需要填写自己的 DashScope Key，并使用声音复刻/声音设计音色。' : (option.note || '')
}

async function refreshCustomVoices() {
  const apiKey = cosyvoice.value.apiKey?.trim()
  if (!apiKey) {
    toast.warning('请先填写自己的 DashScope API Key')
    return
  }

  customVoiceLoading.value = true
  try {
    const voices = await listCosyVoiceCustomVoices(apiKey)
    cosyvoice.value.customVoices = voices
    if (voices.length === 0) {
      toast.info('当前 Key 下没有可用的 CosyVoice 自定义音色')
    } else {
      toast.success(`已加载 ${voices.length} 个自定义音色`)
    }
  } catch (error) {
    toast.error(error instanceof Error ? error.message : '拉取自定义音色失败')
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
      <Input v-model="settings.providers.cosyvoice.apiKey" type="password" placeholder="sk-xxxx" autocomplete="new-password" />
      <span class="text-[11px] text-muted-foreground">
        <a
          href="https://bailian.console.aliyun.com/"
          target="_blank"
          rel="noopener"
          class="hover:underline"
        >
          前往阿里云百炼获取 API Key →
        </a>
      </span>
    </SectionField>

    <SectionField label="模型">
      <Select v-model="settings.providers.cosyvoice.model">
        <SelectTrigger class="w-full">
          <SelectValue placeholder="选择模型" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            v-for="opt in modelOptions"
            :key="opt.value"
            :value="opt.value"
            :disabled="opt.disabled"
            class="text-xs py-2"
          >
            <div class="flex items-center justify-between gap-3 w-full">
              <div class="min-w-0 flex flex-col gap-0.5">
                <div class="flex items-center gap-1.5 font-semibold">
                  <LockClosed16Filled v-if="opt.disabled" class="size-3 text-muted-foreground shrink-0" />
                  <span :class="opt.disabled ? 'text-muted-foreground' : 'text-foreground'">{{ opt.label }}</span>
                </div>
                <span class="text-[11px] text-muted-foreground line-clamp-1 font-normal">{{ modelNote(opt) }}</span>
              </div>
              <span
                class="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                :class="opt.disabled ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'"
              >
                {{ opt.price }}
              </span>
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
    </SectionField>

    <SectionField label="音色">
      <div class="flex flex-col gap-1.5">
        <div class="flex items-center gap-1.5">
          <div class="flex-1 min-w-0">
            <VoiceSelectWithPreview
              v-model="settings.providers.cosyvoice.voice"
              :options="voiceOptions"
              :loading="customVoiceLoading"
              placeholder="longanyang"
            />
          </div>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger as-child>
                <Button variant="outline" class="w-8 p-0 shrink-0" :disabled="!hasUserKey || customVoiceLoading" @click="refreshCustomVoices">
                  <ArrowSync20Regular class="size-4" :class="{ 'animate-spin': customVoiceLoading }" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                从当前用户 DashScope Key 拉取声音复刻/设计音色
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <Alert
          v-if="customVoiceOnly && customVoices.length === 0"
          class="border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400 py-2 px-2.5"
        >
          <AlertDescription class="text-xs m-0">
            CosyVoice3.5 不支持系统音色。请刷新并选择声音复刻/声音设计音色。
          </AlertDescription>
        </Alert>

        <span class="text-[11px] text-muted-foreground">
          <a
            href="https://help.aliyun.com/zh/model-studio/voice-cloning-user-guide"
            target="_blank"
            rel="noopener"
            class="hover:underline"
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
      <Select v-model="settings.providers.cosyvoice.languageHint">
        <SelectTrigger class="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            v-for="opt in COSYVOICE_LANGUAGE_HINTS"
            :key="opt.value"
            :value="opt.value"
            class="text-xs"
          >
            {{ opt.label }}
          </SelectItem>
        </SelectContent>
      </Select>
    </SectionField>
  </div>
</template>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
</style>
