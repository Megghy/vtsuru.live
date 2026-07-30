<script setup lang="ts">
import type { TranscriptionProvider } from '@/shared/models/transcription'
import {
  NAlert,
  NButton,
  NDivider,
  NDynamicTags,
  NFlex,
  NForm,
  NFormItem,
  NInput,
  NPopconfirm,
  NSelect,
  NTag,
  NText,
} from 'naive-ui'
import { computed, onMounted, watch } from 'vue'
import { useTranscription } from '@/apps/client/store/useTranscription'
import { createTranscriptionProfile, useTranscriptionSettings } from '@/apps/client/store/useTranscriptionSettings'
import {
  clientSupportsTranscription,
  clientVersion,
  TRANSCRIPTION_MIN_CLIENT_VERSION,
} from '@/shared/config/clientVersion'

const settingsStore = useTranscriptionSettings()
const transcription = useTranscription()
const activeProfile = computed(() => settingsStore.activeProfile)
const isRunning = computed(() => transcription.status.running)
const isBusy = computed(() => transcription.status.phase !== 'running' && transcription.status.running)
const isSupported = computed(() => clientSupportsTranscription())

const profileOptions = computed(() => settingsStore.settings.profiles.map(profile => ({
  label: `${profile.name} · ${profile.provider === 'tencent' ? '腾讯云' : 'OpenAI'}`,
  value: profile.id,
})))

const languageOptions = [
  { label: '中文（普通话）', value: 'zh-CN' },
  { label: '中文', value: 'zh' },
  { label: '英语', value: 'en' },
  { label: '日语', value: 'ja' },
]

const tencentModelOptions = [
  { label: '中文通用 16k', value: '16k_zh' },
  { label: '中文增强 16k', value: '16k_zh_large' },
  { label: '英语 16k', value: '16k_en' },
  { label: '粤语 16k', value: '16k_yue' },
]

const statusMeta = computed(() => {
  switch (transcription.status.phase) {
    case 'resolving_stream': return { type: 'warning' as const, text: '正在获取播放流' }
    case 'connecting_provider': return { type: 'warning' as const, text: '正在连接 Provider' }
    case 'starting_ffmpeg': return { type: 'warning' as const, text: '正在启动 FFmpeg' }
    case 'running': return { type: 'success' as const, text: '转写中' }
    case 'stopping': return { type: 'warning' as const, text: '正在停止' }
    case 'error': return { type: 'error' as const, text: '运行错误' }
    default: return { type: 'default' as const, text: '未运行' }
  }
})

const saveSettings = useDebounceFn(() => settingsStore.save(), 300)
watch(() => settingsStore.settings, saveSettings, { deep: true })

onMounted(() => settingsStore.init())

function addProfile(provider: TranscriptionProvider) {
  settingsStore.addProfile(provider)
}

function changeProvider(provider: TranscriptionProvider) {
  const current = activeProfile.value
  if (!current || current.provider === provider) return
  const replacement = createTranscriptionProfile(provider)
  replacement.id = current.id
  replacement.name = current.name
  const index = settingsStore.settings.profiles.findIndex(profile => profile.id === current.id)
  settingsStore.settings.profiles[index] = replacement
}

async function start() {
  try {
    await settingsStore.save()
    await transcription.start()
    window.$message.success('实时转写已启动')
  } catch (error) {
    window.$message.error(`启动转写失败: ${error}`)
  }
}

async function stop() {
  try {
    await transcription.stop()
    window.$message.success('实时转写已停止')
  } catch (error) {
    window.$message.error(`停止转写失败: ${error}`)
  }
}
</script>

<template>
  <NFlex vertical :size="16">
    <NAlert type="warning" :bordered="false">
      直播语音转写功能仍在开发中，当前版本尚未完成，请勿依赖它进行正式直播归档。
    </NAlert>
    <NAlert type="info" :bordered="false">
      API 凭据只保存在本机 Tauri Store 中并由客户端直接用于转写，不会上传到本站。本站仅接收最终字幕用于直播归档。
    </NAlert>
    <NAlert type="warning" :bordered="false">
      音频来自当前绑定的 Bilibili 直播间播放流。第三方播放地址和语音服务可能中断，客户端会报告实际状态，但无法承诺持续稳定运行。
    </NAlert>
    <NAlert v-if="!isSupported" type="error" :bordered="false">
      当前 Client 版本 {{ clientVersion || '未知' }} 不包含本地直播转写能力，请升级到 {{ TRANSCRIPTION_MIN_CLIENT_VERSION }} 或更高版本。
    </NAlert>

    <section class="setting-section">
      <NFlex justify="space-between" align="center">
        <div>
          <NText strong>
            运行状态
          </NText>
          <div class="section-description">
            仅最终确认的字幕会上传归档，实时临时结果只在本机显示。
          </div>
        </div>
        <NTag :type="statusMeta.type" :bordered="false">
          {{ statusMeta.text }}
        </NTag>
      </NFlex>

      <NFlex class="runtime-actions" align="center">
        <NButton
          v-if="!isRunning"
          type="primary"
          size="small"
          :loading="isBusy"
          :disabled="!isSupported"
          @click="start"
        >
          开始转写
        </NButton>
        <NButton
          v-else
          type="error"
          size="small"
          :loading="isBusy"
          @click="stop"
        >
          停止转写
        </NButton>
        <NText depth="3">
          已归档 {{ transcription.archivedCount }} 条
          <template v-if="transcription.pendingCount">
            ，待上传 {{ transcription.pendingCount }} 条
          </template>
        </NText>
      </NFlex>

      <NAlert v-if="transcription.status.message" :type="transcription.status.phase === 'error' ? 'error' : 'info'" size="small">
        {{ transcription.status.message }}
      </NAlert>
      <NAlert v-if="transcription.uploadError" type="warning" size="small">
        {{ transcription.uploadError }}
      </NAlert>
      <NAlert v-if="transcription.runtimeError" type="warning" size="small">
        {{ transcription.runtimeError }}
      </NAlert>
      <div v-if="transcription.partialText || transcription.lastFinalText" class="transcript-preview">
        <NText depth="3">
          {{ transcription.partialText || transcription.lastFinalText }}
        </NText>
      </div>
    </section>

    <NDivider />

    <section class="setting-section">
      <NFlex justify="space-between" align="center">
        <div>
          <NText strong>
            Provider 配置
          </NText>
          <div class="section-description">
            可保存多个本地配置，启动时使用当前选中的配置。
          </div>
        </div>
        <NFlex>
          <NButton size="tiny" :disabled="isRunning" @click="addProfile('tencent')">
            新增腾讯云
          </NButton>
          <NButton size="tiny" :disabled="isRunning" @click="addProfile('openai')">
            新增 OpenAI
          </NButton>
        </NFlex>
      </NFlex>

      <NFlex align="center" class="profile-picker">
        <NSelect
          v-model:value="settingsStore.settings.activeProfileId"
          :options="profileOptions"
          :disabled="isRunning"
          style="min-width: 260px; flex: 1"
        />
        <NPopconfirm
          :disabled="settingsStore.settings.profiles.length === 1 || isRunning"
          @positive-click="settingsStore.removeActiveProfile()"
        >
          <template #trigger>
            <NButton
              size="small"
              type="error"
              secondary
              :disabled="settingsStore.settings.profiles.length === 1 || isRunning"
            >
              删除
            </NButton>
          </template>
          删除后本地保存的该组凭据也会一并移除。
        </NPopconfirm>
      </NFlex>

      <NForm
        v-if="activeProfile"
        label-placement="left"
        label-width="120"
        size="small"
        :disabled="isRunning"
      >
        <NFormItem label="配置名称">
          <NInput v-model:value="activeProfile.name" placeholder="用于区分本地配置" />
        </NFormItem>
        <NFormItem label="Provider">
          <NSelect
            :value="activeProfile.provider"
            :options="[
              { label: '腾讯云', value: 'tencent' },
              { label: 'OpenAI', value: 'openai' },
            ]"
            @update:value="changeProvider"
          />
        </NFormItem>
        <NFormItem label="识别语言">
          <NSelect
            v-model:value="activeProfile.language"
            filterable
            tag
            :options="languageOptions"
          />
        </NFormItem>

        <template v-if="activeProfile.provider === 'tencent'">
          <NFormItem label="引擎模型">
            <NSelect
              v-model:value="activeProfile.engineModelType"
              filterable
              tag
              :options="tencentModelOptions"
            />
          </NFormItem>
          <NFormItem label="App ID">
            <NInput v-model:value="activeProfile.appId" />
          </NFormItem>
          <NFormItem label="Secret ID">
            <NInput v-model:value="activeProfile.secretId" type="password" show-password-on="click" />
          </NFormItem>
          <NFormItem label="Secret Key">
            <NInput v-model:value="activeProfile.secretKey" type="password" show-password-on="click" />
          </NFormItem>
        </template>

        <template v-else>
          <NFormItem label="模型">
            <NInput v-model:value="activeProfile.model" placeholder="gpt-live-transcribe" />
          </NFormItem>
          <NFormItem label="API 地址">
            <NInput v-model:value="activeProfile.baseUrl" placeholder="wss://api.openai.com/v1/realtime" />
          </NFormItem>
          <NFormItem label="API Key">
            <NInput v-model:value="activeProfile.apiKey" type="password" show-password-on="click" />
          </NFormItem>
        </template>

        <NFormItem label="热词">
          <NDynamicTags v-model:value="activeProfile.hotwords" />
        </NFormItem>
      </NForm>
    </section>
  </NFlex>
</template>

<style scoped>
.setting-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-description {
  margin-top: 2px;
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
}

.runtime-actions,
.profile-picker {
  min-height: 32px;
}

.transcript-preview {
  padding: 10px 12px;
  border: 1px solid var(--vtsuru-border);
  border-radius: 6px;
  background: var(--vtsuru-bg-muted);
}
</style>
