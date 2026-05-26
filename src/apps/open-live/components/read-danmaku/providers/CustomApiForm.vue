<script setup lang="ts">
import { computed } from 'vue'
import {
  NAlert, NButton, NCheckbox, NCollapse, NCollapseItem, NInput,
  NInputGroup, NSelect, NText,
} from 'naive-ui'
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
    <NCollapse>
      <NCollapseItem title="使用说明" name="requirements">
        <ul style="margin: 0; padding-left: 20px; font-size: 12px; line-height: 1.6;">
          <li>API 需直接返回音频数据 (wav/mp3/m4a)</li>
          <li>建议使用 HTTPS</li>
          <li>HTTP 将通过代理转发，速度较慢</li>
        </ul>
        <NButton
          text type="info" tag="a" size="small" style="margin-top: 8px"
          href="https://github.com/Artrajz/vits-simple-api" target="_blank"
        >
          推荐：vits-simple-api
        </NButton>
      </NCollapseItem>
    </NCollapse>

    <NAlert v-if="isVtsuruVoiceAPI" type="warning" :bordered="false" size="small">
      <NText style="font-size: 12px">
        当前使用本站测试 API，不保证可用性
      </NText>
    </NAlert>

    <SectionField label="API 地址" hint="用 {{text}} 占位符代表要朗读的文本">
      <NInputGroup>
        <NSelect
          v-model:value="settings.providers.api.voiceAPISchemeType"
          :options="schemeOptions"
          style="width: 88px"
          size="small"
        />
        <NInput
          v-model:value="settings.providers.api.voiceAPI"
          placeholder="xxx.com/voice?text={{text}}&id=0"
          size="small"
          :status="/^(?:https?:\/\/)/.test(settings.providers.api?.voiceAPI?.toLowerCase() ?? '') ? 'error' : undefined"
        />
        <NButton
          type="info" size="small"
          :loading="speechState.isApiAudioLoading"
          @click="test"
        >
          测试
        </NButton>
      </NInputGroup>
      <NButton
        size="tiny" text type="primary"
        @click="copyToClipboard('{{text}}')"
      >
        点击复制 &#123;&#123;text&#125;&#125; 占位符
      </NButton>
    </SectionField>

    <NCheckbox
      v-if="settings.providers.api?.voiceAPISchemeType === 'http'"
      v-model:checked="settings.providers.api.useAPIDirectly"
    >
      <NText style="font-size: 12px">
        不使用代理 (了解可能产生的影响)
      </NText>
    </NCheckbox>

    <NCheckbox v-model:checked="settings.providers.api.splitText">
      <NText style="font-size: 12px">
        启用句子拆分 (英文用户名加引号、大写单词拆字)
      </NText>
    </NCheckbox>
  </div>
</template>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
</style>
