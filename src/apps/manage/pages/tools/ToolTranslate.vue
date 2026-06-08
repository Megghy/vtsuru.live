<script setup lang="ts">
import { NButton, NCard, NFlex, NSelect, NText } from 'naive-ui'
import { computed, ref } from 'vue'
import { LANG_OPTIONS, useTranslate } from '@/composables/useTranslate'
import { trackManageToolSuccess } from '@/shared/services/umami'

const message = useMessage()

const { mode, modeOptions, sourceLang, sourceLangOptions, targetLang, translating, browserApiAvailable, translate } = useTranslate()

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
  <NCard title="翻译工具">
    <template #header-extra>
      <NFlex :size="8" align="center">
        <NSelect v-model:value="mode" :options="modeOptions" size="small" style="width: 130px" />
        <NButton size="small" type="primary" :loading="translating" @click="doTranslate">
          翻译
        </NButton>
      </NFlex>
    </template>

    <NFlex vertical :size="12">
      <NText v-if="!browserApiAvailable" depth="3" style="font-size: 12px">
        当前浏览器不支持内置翻译 API (需要 Chrome 138+)，已自动切换到云端翻译
      </NText>
      <NText depth="3" style="font-size: 12px">
        浏览器翻译：使用 Chrome 内置翻译引擎，速度快且无字数限制，需要 Chrome 138+；云端翻译：使用本站提供的 DeepSeek-V4-Flash 模型，限制 5000 字
      </NText>

      <div class="lang-bar">
        <NText depth="3" style="font-size: 12px">
          源语言
        </NText>
        <NSelect v-model:value="sourceLang" :options="sourceLangOptions" size="small" style="width: 150px" />
        <NButton quaternary circle size="small" title="交换原文和译文" @click="swapTexts">
          ⇄
        </NButton>
        <NText depth="3" style="font-size: 12px">
          目标语言
        </NText>
        <NSelect v-model:value="targetLang" :options="LANG_OPTIONS" size="small" style="width: 150px" />
      </div>

      <div class="translate-layout">
        <div class="translate-column">
          <div class="panel-header">
            <NText depth="3" style="font-size: 12px">
              原文
            </NText>
            <NText depth="3" style="font-size: 11px" :type="charLimitExceeded ? 'error' : undefined">
              {{ charCount }}{{ mode === 'cloud' ? ' / 5000' : '' }}
            </NText>
          </div>
          <textarea v-model="sourceText" class="translate-textarea" placeholder="输入要翻译的文本..." />
        </div>

        <div class="translate-column">
          <div class="panel-header">
            <NText depth="3" style="font-size: 12px">
              译文
            </NText>
            <NButton v-if="resultText" text size="tiny" @click="copyResult">
              复制
            </NButton>
          </div>
          <textarea v-model="resultText" class="translate-textarea" placeholder="翻译结果..." readonly />
        </div>
      </div>
    </NFlex>
  </NCard>
</template>
<style scoped>
.lang-bar {
  display: flex;
  align-items: center;
  gap: 8px;
}

.translate-layout {
  display: flex;
  gap: 12px;
  align-items: stretch;
}
@media (max-width: 768px) {
  .translate-layout { flex-direction: column; }
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
  border: 1px solid var(--n-border-color);
  background: var(--n-color-embedded);
  font-family: inherit;
  color: inherit;
  outline: none;
  box-sizing: border-box;
}
.translate-textarea:focus {
  border-color: var(--primary-color, #18a058);
}
</style>
