<script setup lang="ts">
import { showSuccessToast, showErrorToast, showWarningToast } from '@/shared/services/toast'
import { computed, ref } from 'vue'

import { LANG_OPTIONS, useTranslate } from '@/composables/useTranslate'
import { trackManageToolSuccess } from '@/shared/services/umami'

const { mode, modeOptions, sourceLang, sourceLangOptions, targetLang, translating, browserApiAvailable, translate } =
  useTranslate()

const sourceText = ref('')
const resultText = ref('')

const charCount = computed(() => sourceText.value.length)
const charLimitExceeded = computed(() => mode.value === 'cloud' && charCount.value > 5000)

async function doTranslate() {
  if (!sourceText.value.trim()) return showWarningToast('请输入要翻译的文本')
  if (charLimitExceeded.value) return showWarningToast('云端翻译限制5000字')
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
    showErrorToast(`翻译失败: ${e?.message ?? e}`)
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
  showSuccessToast('已复制')
}
</script>

<template>
  <UCard>
    <template #header>翻译工具</template>
    <template #footer>
      <div class="toolbar">
        <USelect v-model="mode" :items="modeOptions" class="mode-select" />
        <UButton :loading="translating" @click="doTranslate">翻译</UButton>
      </div>
    </template>

    <div class="translate-page">
      <p v-if="!browserApiAvailable" class="hint">
        当前浏览器不支持内置翻译 API (需要 Chrome 138+)，已自动切换到云端翻译
      </p>
      <p class="hint">
        浏览器翻译：使用 Chrome 内置翻译引擎，速度快且无字数限制，需要 Chrome 138+；云端翻译：使用本站提供的
        DeepSeek-V4-Flash 模型，限制 5000 字
      </p>

      <div class="lang-bar">
        <span class="hint">源语言</span>
        <USelect v-model="sourceLang" :items="sourceLangOptions" class="lang-select" />
        <UButton
          color="neutral"
          variant="ghost"
          square
          size="sm"
          title="交换原文和译文"
          @click="swapTexts"
        >
          ⇄
        </UButton>
        <span class="hint">目标语言</span>
        <USelect v-model="targetLang" :items="LANG_OPTIONS" class="lang-select" />
      </div>

      <div class="translate-layout">
        <div class="translate-column">
          <div class="panel-header">
            <span class="hint">原文</span>
            <span class="counter" :class="{ error: charLimitExceeded }">
              {{ charCount }}{{ mode === 'cloud' ? ' / 5000' : '' }}
            </span>
          </div>
          <textarea
            v-model="sourceText"
            class="translate-textarea"
            placeholder="输入要翻译的文本..."
          />
        </div>

        <div class="translate-column">
          <div class="panel-header">
            <span class="hint">译文</span>
            <UButton
              v-if="resultText"
              color="neutral"
              variant="link"
              size="xs"
              @click="copyResult"
            >
              复制
            </UButton>
          </div>
          <textarea
            v-model="resultText"
            class="translate-textarea"
            placeholder="翻译结果..."
            readonly
          />
        </div>
      </div>
    </div>
  </UCard>
</template>
<style scoped>
.lang-bar {
  display: flex;
  align-items: center;
  gap: 8px;
}
.translate-page { display: flex; flex-direction: column; gap: 12px; }
.toolbar { display: flex; justify-content: flex-end; align-items: center; gap: 8px; }
.hint { margin: 0; color: var(--vtsuru-fg-muted); font-size: 12px; }
.mode-select { width: 130px; }
.lang-select { width: 150px; }
.counter { color: var(--vtsuru-fg-muted); font-size: 11px; }
.counter.error { color: var(--vtsuru-error); }

.translate-layout {
  display: flex;
  gap: 12px;
  align-items: stretch;
}
@media (max-width: 768px) {
  .translate-layout {
    flex-direction: column;
  }
}

.translate-column {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 2px;
}

.translate-textarea {
  width: 100%;
  flex: 1;
  min-height: 300px;
  resize: vertical;
  padding: 12px;
  border-radius: 6px;
  font-size: 14px;
  line-height: 1.7;
  border: 1px solid var(--vtsuru-border);
  background: var(--vtsuru-bg-inset);
  font-family: inherit;
  color: inherit;
  outline: none;
  box-sizing: border-box;
}
.translate-textarea:focus {
  border-color: var(--primary-color, #18a058);
}
</style>
