<script setup lang="ts">
import { computed } from 'vue'

import { copyToClipboard } from '@/shared/utils'
import { useSpeechService } from '@/store/useSpeechService'

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
  const url = speechService.buildApiUrl('这是一条测试弹幕')
  if (url) {
    speechState.isSpeaking = true
    speechState.isApiAudioLoading = true
    speechState.apiAudioSrc = url
  }
}
</script>

<template>
  <div class="form">
    <div>
      <details
        title="使用说明"
        name="requirements"
      >
        <ul style="margin: 0; padding-left: 20px; font-size: 12px; line-height: 1.6">
          <li>API 需直接返回音频数据 (wav/mp3/m4a)</li>
          <li>建议使用 HTTPS</li>
          <li>HTTP 将通过代理转发，速度较慢</li>
        </ul>
        <UButton
          variant="link"
          color="info"
          tag="a"
          size="small"
          style="margin-top: 8px"
          href="https://github.com/Artrajz/vits-simple-api"
          target="_blank"
        >
          推荐：vits-simple-api
        </UButton>
      </details>
    </div>

    <UAlert
      v-if="isVtsuruVoiceAPI"
      type="warning"
      :bordered="false"
      size="small"
    >
      <span style="font-size: 12px"> 当前使用本站测试 API，不保证可用性 </span>
    </UAlert>

    <SectionField
      label="API 地址"
      hint="用 {{text}} 占位符代表要朗读的文本"
    >
      <div>
        <USelectMenu
          v-model="settings.providers.api.voiceAPISchemeType"
          :items="schemeOptions"
          style="width: 88px"
          size="small"
          value-key="value"
        />
        <UInput
          v-model="settings.providers.api.voiceAPI"
          placeholder="xxx.com/voice?text={{text}}&id=0"
          size="small"
          :status="/^(?:https?:\/\/)/.test(settings.providers.api?.voiceAPI?.toLowerCase() ?? '') ? 'error' : undefined"
        />
        <UButton
          color="info"
          size="small"
          :loading="speechState.isApiAudioLoading"
          @click="test"
        >
          测试
        </UButton>
      </div>
      <UButton
        size="tiny"
        variant="link"
        color="primary"
        @click="copyToClipboard('{{text}}')"
      >
        点击复制 &#123;&#123;text&#125;&#125; 占位符
      </UButton>
    </SectionField>

    <UCheckbox
      v-if="settings.providers.api?.voiceAPISchemeType === 'http'"
      v-model="settings.providers.api.useAPIDirectly"
    >
      <span style="font-size: 12px"> 不使用代理 (了解可能产生的影响) </span>
    </UCheckbox>

    <UCheckbox v-model="settings.providers.api.splitText">
      <span style="font-size: 12px"> 启用句子拆分 (英文用户名加引号、大写单词拆字) </span>
    </UCheckbox>
  </div>
</template>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
</style>
