<script setup lang="ts">
import { computed, ref } from 'vue'

import { LANG_OPTIONS, useTranslate } from '@/composables/useTranslate'
import { trackManageToolSuccess } from '@/shared/services/umami'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { useMessage } from '@/shared/utils'

const message = useMessage()

const { mode, modeOptions, sourceLang, sourceLangOptions, targetLang, translating, browserApiAvailable, translate } =
  useTranslate()

const sourceText = ref('')
const resultText = ref('')

const charCount = computed(() => sourceText.value.length)
const charLimitExceeded = computed(() => mode.value === 'cloud' && charCount.value > 5000)

async function doTranslate() {
  if (!sourceText.value.trim()) return message.warning('请输入要翻译的文本')
  if (charLimitExceeded.value) return message.warning('云端翻译限制5000字')
  resultText.value = ''
  try {
    resultText.value = await translate(sourceText.value)
    trackManageToolSuccess('Translate', 'translate', {
      mode: mode.value,
      source_lang: sourceLang.value,
      target_lang: targetLang.value,
      chars: sourceText.value.length,
    })
  } catch (e: any) {
    message.error(`翻译失败: ${e?.message ?? e}`)
  }
}

function swapTexts() {
  const tmp = sourceText.value
  sourceText.value = resultText.value
  resultText.value = tmp
}

async function copyResult() {
  if (!resultText.value) return
  await navigator.clipboard.writeText(resultText.value)
  message.success('已复制')
}
</script>

<template>
  <Card>
    <CardHeader class="flex flex-row items-center justify-between pb-4">
      <CardTitle class="text-base font-semibold">翻译工具</CardTitle>
      <div class="flex items-center gap-2">
        <Select v-model="mode">
          <SelectTrigger class="w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="opt in modeOptions"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </SelectItem>
          </SelectContent>
        </Select>
        <Button
          :loading="translating"
          @click="doTranslate"
        >
          翻译
        </Button>
      </div>
    </CardHeader>

    <CardContent class="pt-0">
      <div class="flex flex-col gap-3">
        <span
          v-if="!browserApiAvailable"
          class="text-xs text-muted-foreground"
        >
          当前浏览器不支持内置翻译 API (需要 Chrome 138+)，已自动切换到云端翻译
        </span>
        <span class="text-xs text-muted-foreground">
          浏览器翻译：使用 Chrome 内置翻译引擎，速度快且无字数限制，需要 Chrome 138+；云端翻译：使用本站提供的
          DeepSeek-V4-Flash 模型，限制 5000 字
        </span>

        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-xs text-muted-foreground"> 源语言 </span>
          <Select v-model="sourceLang">
            <SelectTrigger class="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="opt in sourceLangOptions"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.label }}
              </SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="ghost"
            size="icon"
            class="w-8 rounded-full"
            title="交换原文和译文"
            @click="swapTexts"
          >
            ⇄
          </Button>

          <span class="text-xs text-muted-foreground"> 目标语言 </span>
          <Select v-model="targetLang">
            <SelectTrigger class="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="opt in LANG_OPTIONS"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div class="flex gap-3 items-stretch max-md:flex-col">
          <div class="flex-1 min-w-0 flex flex-col gap-1.5">
            <div class="flex-between px-0.5">
              <span class="text-xs text-muted-foreground"> 原文 </span>
              <span
                class="text-[11px]"
                :class="charLimitExceeded ? 'text-destructive font-medium' : 'text-muted-foreground'"
              >
                {{ charCount }}{{ mode === 'cloud' ? ' / 5000' : '' }}
              </span>
            </div>
            <textarea
              v-model="sourceText"
              class="w-full flex-1 min-h-[300px] resize-y p-3 rounded-md text-sm leading-[1.7] border border-border bg-muted font-inherit outline-none box-border focus:border-primary"
              placeholder="输入要翻译的文本..."
            />
          </div>

          <div class="flex-1 min-w-0 flex flex-col gap-1.5">
            <div class="flex-between px-0.5">
              <span class="text-xs text-muted-foreground"> 译文 </span>
              <Button
                v-if="resultText"
                variant="link"
                class="h-auto p-0 text-primary"
                @click="copyResult"
              >
                复制
              </Button>
            </div>
            <textarea
              v-model="resultText"
              class="w-full flex-1 min-h-[300px] resize-y p-3 rounded-md text-sm leading-[1.7] border border-border bg-muted font-inherit outline-none box-border focus:border-primary"
              placeholder="翻译结果..."
              readonly
            />
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
