<script setup lang="ts">
import { computed } from 'vue'

import { copyToClipboard } from '@/shared/utils'
import { useSpeechService } from '@/store/useSpeechService'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
import { Input } from '@/shared/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select'

import SectionField from '../SectionField.vue'

const speechService = useSpeechService()
const { settings, speechState } = speechService

const isVtsuruVoiceAPI = computed(() => {
  const apiUrl = (settings.value.providers.api?.voiceAPI as string) ?? ''
  return apiUrl.toLowerCase().trim().startsWith('voice.vtsuru.live')
})

const schemeOptions = [
  { label: 'https://', value: 'https' },
  { label: 'http://', value: 'http' },
]

function test() {
  void speechService.previewVoice('这是一条测试弹幕')
}
</script>

<template>
  <div class="form">
    <details class="group border rounded-md p-2.5 text-xs bg-muted/20">
      <summary class="font-medium cursor-pointer list-none flex items-center justify-between text-foreground">
        <span>使用说明</span>
        <span class="text-muted-foreground transition-transform group-open:rotate-180">▾</span>
      </summary>
      <div class="mt-2.5 pt-2 border-t space-y-2">
        <ul class="m-0 pl-5 text-xs leading-relaxed list-disc text-muted-foreground">
          <li>API 需直接返回音频数据 (wav/mp3/m4a)</li>
          <li>建议使用 HTTPS</li>
          <li>HTTP 将通过代理转发，速度较慢</li>
        </ul>
        <Button variant="link" class="h-auto p-0 text-sky-600 dark:text-sky-400" as-child>
          <a
            href="https://github.com/Artrajz/vits-simple-api"
            target="_blank"
          >
            推荐：vits-simple-api
          </a>
        </Button>
      </div>
    </details>

    <Alert
      v-if="isVtsuruVoiceAPI"
      class="py-2 px-3 border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400"
    >
      <AlertDescription class="text-xs text-current m-0">
        当前使用本站测试 API，不保证可用性
      </AlertDescription>
    </Alert>

    <SectionField
      label="API 地址"
      hint="用 {{text}} 占位符代表要朗读的文本"
    >
      <div class="flex items-center gap-1.5">
        <Select v-model="settings.providers.api.voiceAPISchemeType">
          <SelectTrigger class="w-[88px] shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="opt in schemeOptions"
              :key="opt.value"
              :value="opt.value"
              class="text-xs"
            >
              {{ opt.label }}
            </SelectItem>
          </SelectContent>
        </Select>

        <Input v-model="settings.providers.api.voiceAPI" placeholder="xxx.com/voice?text={{text}}&id=0" class="flex-1" :class="/^(?:https?:\/\/)/.test(settings.providers.api?.voiceAPI?.toLowerCase() ?? '') ? 'border-destructive' : ''" />

        <Button class="shrink-0" :disabled="speechState.isApiAudioLoading" @click="test">
          {{ speechState.isApiAudioLoading ? '加载中...' : '测试' }}
        </Button>
      </div>

      <Button variant="link" size="xs" class="h-auto p-0 text-[11px] text-primary" @click="copyToClipboard('{{text}}')">
        点击复制 &#123;&#123;text&#125;&#125; 占位符
      </Button>
    </SectionField>

    <label
      v-if="settings.providers.api?.voiceAPISchemeType === 'http'"
      class="flex items-center gap-2 cursor-pointer text-xs"
    >
      <Checkbox
        :checked="settings.providers.api.useAPIDirectly"
        @update:checked="settings.providers.api.useAPIDirectly = $event"
      />
      <span>不使用代理 (了解可能产生的影响)</span>
    </label>

    <label class="flex items-center gap-2 cursor-pointer text-xs">
      <Checkbox
        :checked="settings.providers.api.splitText"
        @update:checked="settings.providers.api.splitText = $event"
      />
      <span>启用句子拆分 (英文用户名加引号、大写单词拆字)</span>
    </label>
  </div>
</template>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
</style>
