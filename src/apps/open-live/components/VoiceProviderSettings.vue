<script setup lang="ts">
import { Info24Filled } from '@vicons/fluent'
import {
  NAlert, NButton, NCheckbox, NCollapse, NCollapseItem, NDivider, NFlex, NIcon, NInput, NInputGroup, NInputGroupLabel, NRadioButton, NRadioGroup, NSelect, NSlider, NText, NTooltip,
} from 'naive-ui'
import { computed, onMounted, ref, watch } from 'vue'
import { copyToClipboard } from '@/shared/utils'
import { useSpeechService } from '@/store/useSpeechService'
import { DEFAULT_MIMO_VOICE } from '@/apps/open-live/voice-providers'
import type { VoiceOption } from '@/apps/open-live/voice-providers'

const speechService = useSpeechService()
const { settings, speechState } = speechService

const voices = ref<VoiceOption[]>([])
const voicesLoading = ref(false)

const supportsProsodyControls = computed(() => settings.value.provider === 'local' || settings.value.provider === 'azure')

const isVtsuruVoiceAPI = computed(() => {
  const apiUrl = (settings.value.providers.api?.voiceAPI as string) ?? ''
  return settings.value.provider === 'api' && apiUrl.toLowerCase().trim().startsWith('voice.vtsuru.live')
})

const localVoices = computed((): VoiceOption[] => {
  return speechService.getAvailableVoices()
})

const mimoSettings = computed(() => {
  settings.value.providers.mimo ??= { mimoVoice: DEFAULT_MIMO_VOICE, mimoStyleTag: '' }
  if (!settings.value.providers.mimo.mimoVoice || settings.value.providers.mimo.mimoVoice === 'mimo_default') {
    settings.value.providers.mimo.mimoVoice = DEFAULT_MIMO_VOICE
  }
  settings.value.providers.mimo.mimoStyleTag ??= ''
  return settings.value.providers.mimo as { mimoVoice: string; mimoStyleTag: string }
})

async function loadVoices() {
  if (voicesLoading.value) return

  const provider = speechService.getCurrentProvider()
  if (!provider) {
    voices.value = []
    return
  }

  const result = provider.getVoices()
  if (result instanceof Promise) {
    voicesLoading.value = true
    try {
      voices.value = await result
    } finally {
      voicesLoading.value = false
    }
  } else {
    voices.value = result
  }
}

function test() {
  const url = speechService.buildApiUrl('这是一条测试弹幕')
  if (url) {
    speechState.isSpeaking = true
    speechState.isApiAudioLoading = true
    speechState.apiAudioSrc = url
  }
}

watch(() => settings.value.provider, loadVoices, { immediate: true })

onMounted(() => {
  if (settings.value.provider === 'azure') {
    loadVoices()
  }
})
</script>

<template>
  <NFlex vertical :size="16">
    <!-- 公共：音量 -->
    <div>
      <NFlex justify="space-between" align="center">
        <NText>音量</NText>
        <NText depth="3">{{ (settings.speechInfo.volume * 100).toFixed(0) }}%</NText>
      </NFlex>
      <NSlider
        v-model:value="settings.speechInfo.volume"
        :min="0"
        :max="1"
        :step="0.01"
        style="margin-top: 8px"
      />
    </div>

    <div v-if="supportsProsodyControls">
      <NFlex justify="space-between" align="center">
        <NText>音调</NText>
        <NText depth="3">{{ settings.speechInfo.pitch.toFixed(2) }}</NText>
      </NFlex>
      <NSlider
        v-model:value="settings.speechInfo.pitch"
        :min="0.5"
        :max="2"
        :step="0.01"
        style="margin-top: 8px"
      />
    </div>

    <div v-if="supportsProsodyControls">
      <NFlex justify="space-between" align="center">
        <NText>语速</NText>
        <NText depth="3">{{ settings.speechInfo.rate.toFixed(2) }}</NText>
      </NFlex>
      <NSlider
        v-model:value="settings.speechInfo.rate"
        :min="0.5"
        :max="2"
        :step="0.01"
        style="margin-top: 8px"
      />
    </div>

    <NDivider style="margin: 8px 0" />

    <!-- Provider 选择 -->
    <NRadioGroup v-model:value="settings.provider" size="large">
      <NRadioButton value="local">
        <NFlex :size="4">
          <span>本地语音</span>
          <NTooltip>
            <template #trigger>
              <NIcon :component="Info24Filled" :size="16" />
            </template>
            使用浏览器内置的语音合成功能
          </NTooltip>
        </NFlex>
      </NRadioButton>

      <NRadioButton value="azure">
        <NFlex :size="4">
          <span>Azure TTS</span>
          <NTooltip>
            <template #trigger>
              <NIcon :component="Info24Filled" :size="16" />
            </template>
            使用 Microsoft Azure 语音合成服务，混合语言输出效果好
          </NTooltip>
        </NFlex>
      </NRadioButton>

      <NRadioButton value="api">
        <NFlex :size="4">
          <span>API 语音</span>
          <NTooltip>
            <template #trigger>
              <NIcon :component="Info24Filled" :size="16" />
            </template>
            自定义语音 API，可以播放自己训练的模型或其他 TTS
          </NTooltip>
        </NFlex>
      </NRadioButton>

      <NRadioButton value="mimo">
        <NFlex :size="4">
          <span>MiMo TTS</span>
          <NTooltip>
            <template #trigger>
              <NIcon :component="Info24Filled" :size="16" />
            </template>
            使用小米 MiMo 语音合成服务，支持风格标签控制
          </NTooltip>
        </NFlex>
      </NRadioButton>
    </NRadioGroup>

    <Transition name="fade" mode="out-in">
      <!-- 本地语音 -->
      <NFlex
        v-if="settings.provider === 'local'"
        vertical
        :size="16"
      >
        <div>
          <NText strong>选择语音</NText>
          <NSelect
            v-model:value="settings.speechInfo.voice"
            :options="localVoices"
            :fallback-option="() => ({
              label: settings.speechInfo.voice ? `已选择: ${settings.speechInfo.voice}` : '未选择, 将使用默认语音',
              value: settings.speechInfo.voice || '',
            })"
            style="margin-top: 8px"
            filterable
          />
        </div>
      </NFlex>

      <!-- Azure TTS -->
      <NFlex
        v-else-if="settings.provider === 'azure'"
        vertical
        :size="16"
      >
        <NAlert type="success" :bordered="false">
          <template #icon>
            <NIcon :component="Info24Filled" />
          </template>
          使用本站提供的 Microsoft Azure 语音合成服务，效果最好
        </NAlert>

        <div>
          <NFlex justify="space-between" align="center">
            <NText strong>语音选择</NText>
            <NButton
              v-if="voices.length === 0"
              text
              type="primary"
              size="small"
              :loading="voicesLoading"
              @click="loadVoices"
            >
              加载语音列表
            </NButton>
            <NText v-else depth="3" style="font-size: 12px">共 {{ voices.length }} 个语音</NText>
          </NFlex>
          <NSelect
            v-model:value="settings.providers.azure.azureVoice"
            :options="(voices.length > 0 ? voices : [
              { label: '中文(普通话)女 - 晓晓', value: 'zh-CN-XiaoxiaoNeural' },
              { label: '中文(普通话)女 - 晓伊', value: 'zh-CN-XiaoyiNeural' },
              { label: '中文(普通话)女 - 晓梦', value: 'zh-CN-XiaomengNeural' },
              { label: '中文(普通话)女 - 晓莫', value: 'zh-CN-XiaomoNeural' },
              { label: '中文(普通话)女 - 晓秋', value: 'zh-CN-XiaoqiuNeural' },
              { label: '中文(普通话)女 - 晓双', value: 'zh-CN-XiaoshuangNeural' },
              { label: '中文(普通话)女 - 晓纯', value: 'zh-CN-XiaochenNeural' },
              { label: '中文(普通话)女 - 晓翔', value: 'zh-CN-XiaoxiangNeural' },
              { label: '中文(普通话)女 - 晓蕾', value: 'zh-CN-XiaorouNeural' },
              { label: '中文(普通话)女 - 晓瑶', value: 'zh-CN-XiaoyouNeural' },
              { label: '中文(普通话)男 - 云希', value: 'zh-CN-YunxiNeural' },
              { label: '中文(普通话)男 - 云扬', value: 'zh-CN-YunyangNeural' },
              { label: '中文(普通话)男 - 云健', value: 'zh-CN-YunjianNeural' },
              { label: '中文(普通话)儿童 - 晓晋', value: 'zh-CN-XiaozhenNeural' },
              { label: '中文(普通话)儿童 - 云夏', value: 'zh-CN-YunxiaNeural' },
            ])"
            :loading="voicesLoading"
            :fallback-option="() => ({
              label: settings.providers.azure?.azureVoice ? `已选择: ${settings.providers.azure.azureVoice}` : '未选择',
              value: settings.providers.azure?.azureVoice || '',
            })"
            style="margin-top: 8px"
            filterable
            @focus="loadVoices"
          />
        </div>
      </NFlex>

      <!-- API 语音 -->
      <NFlex
        v-else-if="settings.provider === 'api'"
        vertical
        :size="16"
      >
        <NCollapse>
          <NCollapseItem title="📖 使用说明" name="requirements">
            <NFlex vertical :size="8">
              <NText>API 要求：</NText>
              <ul style="margin: 0; padding-left: 24px">
                <li>直接返回音频数据（wav, mp3, m4a 等）</li>
                <li>建议使用 HTTPS（HTTP 将通过 Cloudflare Workers 代理，会较慢）</li>
                <li>确保 API 可以被外部访问</li>
              </ul>
              <NDivider style="margin: 8px 0" />
              <NText>推荐项目（可本地部署）：</NText>
              <NButton
                text
                type="info"
                tag="a"
                href="https://github.com/Artrajz/vits-simple-api"
                target="_blank"
              >
                vits-simple-api
              </NButton>
            </NFlex>
          </NCollapseItem>
        </NCollapse>

        <NAlert
          v-if="isVtsuruVoiceAPI"
          type="success"
          closable
        >
          <template #icon>
            <NIcon :component="Info24Filled" />
          </template>
          你正在使用本站提供的测试 API (voice.vtsuru.live)，仅用于测试，不保证可用性
        </NAlert>

        <NAlert type="info">
          地址中的
          <NButton
            size="tiny"
            type="primary"
            text
            @click="copyToClipboard('{{text}}')"
          >
            <span v-text="'{{ text }}'" />
          </NButton>
          将被替换为要念的文本
        </NAlert>

        <div>
          <NText strong>API 地址</NText>
          <NInputGroup style="margin-top: 8px">
            <NSelect
              v-model:value="settings.providers.api.voiceAPISchemeType"
              :options="[
                { label: 'https://', value: 'https' },
                { label: 'http://', value: 'http' },
              ]"
              style="width: 110px"
            />
            <NInput
              v-model:value="settings.providers.api.voiceAPI"
              placeholder="例如: xxx.com/voice/bert-vits2?text={{text}}&id=0"
              :status="/^(?:https?:\/\/)/.test(settings.providers.api?.voiceAPI?.toLowerCase() ?? '') ? 'error' : undefined"
            />
            <NButton
              type="info"
              :loading="speechState.isApiAudioLoading"
              @click="test"
            >
              测试
            </NButton>
          </NInputGroup>
        </div>

        <NAlert
          v-if="settings.providers.api?.voiceAPISchemeType === 'http'"
          type="warning"
        >
          <template #icon>
            <NIcon :component="Info24Filled" />
          </template>
          <NFlex vertical :size="8">
            <NText>不使用 HTTPS 将通过 Cloudflare Workers 代理，速度会慢很多</NText>
            <NCheckbox v-model:checked="settings.providers.api.useAPIDirectly">
              不使用代理（需要了解可能产生的影响）
            </NCheckbox>
          </NFlex>
        </NAlert>
      </NFlex>

      <!-- MiMo TTS -->
      <NFlex
        v-else-if="settings.provider === 'mimo'"
        vertical
        :size="16"
      >
        <NAlert type="success" :bordered="false">
          <template #icon>
            <NIcon :component="Info24Filled" />
          </template>
          使用小米 MiMo 语音合成服务，支持风格标签控制
        </NAlert>

        <div>
          <NFlex justify="space-between" align="center">
            <NText strong>声音选择</NText>
            <NButton
              v-if="voices.length === 0"
              text
              type="primary"
              size="small"
              :loading="voicesLoading"
              @click="loadVoices"
            >
              加载音色列表
            </NButton>
            <NText v-else depth="3" style="font-size: 12px">共 {{ voices.length }} 个音色</NText>
          </NFlex>
          <NSelect
            v-model:value="mimoSettings.mimoVoice"
            :options="voices"
            :loading="voicesLoading"
            :fallback-option="() => ({
              label: mimoSettings.mimoVoice ? `已选择: ${mimoSettings.mimoVoice}` : '未选择',
              value: mimoSettings.mimoVoice || '',
            })"
            style="margin-top: 8px"
            filterable
            @focus="loadVoices"
          />
        </div>

        <div>
          <NFlex :size="4" align="center">
            <NText strong>风格标签</NText>
            <NTooltip>
              <template #trigger>
                <NIcon :component="Info24Filled" :size="16" />
              </template>
              在文本前添加风格标签控制朗读风格，如 (台湾腔)、[开心]、[悲伤] 等
            </NTooltip>
          </NFlex>
          <NInput
            v-model:value="mimoSettings.mimoStyleTag"
            placeholder="例如: (台湾腔) 或 [开心]"
            style="margin-top: 8px"
          />
        </div>
      </NFlex>
    </Transition>
  </NFlex>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from {
  opacity: 0;
}
.fade-leave-to {
  opacity: 0;
}
</style>
