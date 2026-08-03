<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { useAccount } from '@/api/account'
import { QueryGetAPI, GetHeaders } from '@/api/query'
import type { VoiceOption } from '@/apps/open-live/voice-providers'
import { MimoVoiceProvider, type MimoCustomVoiceInfo } from '@/apps/open-live/voice-providers/mimo'
import { deleteVoiceAudio } from '@/apps/open-live/voice-providers/mimo-voice-store'
import { TTS_API_URL } from '@/shared/config'
import { useSpeechService } from '@/store/useSpeechService'

import SectionField from '../SectionField.vue'
import VoiceSelectWithPreview from '../VoiceSelectWithPreview.vue'
import MimoCustomVoiceDialog from './MimoCustomVoiceDialog.vue'

interface CustomVoice {
  id: number
  name: string
  type: 'clone' | 'design'
  description?: string
  directorNote?: string
  audioUrl?: string
  createdAt: string
}

const toast = useToast()
const feedback = (color: 'success' | 'error' | 'warning' | 'info', title: string) => {
  toast.add({ title, color })
}
const account = useAccount()
const speechService = useSpeechService()
const { settings } = speechService

const voices = ref<VoiceOption[]>([])
const voicesLoading = ref(false)
const customVoices = ref<CustomVoice[]>([])
const showCreateDialog = ref(false)
const editingVoice = ref<CustomVoice | null>(null)

async function loadVoices() {
  if (voicesLoading.value) return
  const provider = speechService.getCurrentProvider()
  if (!provider) return
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

async function loadCustomVoices() {
  if (!account.value.id) {
    customVoices.value = []
    return
  }
  try {
    const resp = await QueryGetAPI<CustomVoice[]>(`${TTS_API_URL}mimo/voices/custom`)
    if (resp.code !== 200) throw new Error(resp.message || '加载自定义音色失败')
    if (!Array.isArray(resp.data)) throw new Error('自定义音色数据格式错误')

    customVoices.value = resp.data
    const provider = speechService.getCurrentProvider()
    if (provider instanceof MimoVoiceProvider) {
      provider.setCustomVoices(resp.data as MimoCustomVoiceInfo[])
    }
  } catch (error) {
    feedback('error', error instanceof Error ? error.message : '加载自定义音色失败')
  }
}

function editCustomVoice(voice: CustomVoice) {
  editingVoice.value = voice
  showCreateDialog.value = true
}

async function deleteCustomVoice(id: number) {
  try {
    const headers = Object.fromEntries(GetHeaders())
    const resp = await fetch(`${TTS_API_URL}mimo/voices/custom/${id}`, {
      method: 'DELETE',
      headers,
    })
    const data = await resp.json().catch(() => null)
    if (data?.code === 200) {
      customVoices.value = customVoices.value.filter((v) => v.id !== id)
      if (settings.value.providers.mimo.mimoVoice === `custom:${id}`) {
        settings.value.providers.mimo.mimoVoice = '冰糖'
      }
      await deleteVoiceAudio(id)
      feedback('success', '已删除')
    }
  } catch {
    feedback('error', '删除失败')
  }
}

function useCustomVoice(voice: CustomVoice) {
  settings.value.providers.mimo.mimoVoice = `custom:${voice.id}`
}

const isCustomSelected = (v: CustomVoice) => settings.value.providers.mimo.mimoVoice === `custom:${v.id}`

const allVoiceOptions = computed<any[]>(() => {
  const customOptions = customVoices.value.map((v) => ({
    label: `${v.name}（${v.type === 'clone' ? '克隆' : '描述'}）`,
    value: `custom:${v.id}`,
  }))
  if (customOptions.length === 0) return voices.value
  return [
    { type: 'group', label: '自定义音色', key: 'custom', children: customOptions },
    { type: 'group', label: '预置音色', key: 'preset', children: voices.value },
  ]
})

watch(
  [() => settings.value.provider, () => account.value.id],
  ([provider, accountId]) => {
    if (provider !== 'mimo') return
    loadVoices()
    if (accountId) loadCustomVoices()
  },
  { immediate: true },
)
</script>

<template>
  <div class="form">
    <SectionField label="音色选择">
      <VoiceSelectWithPreview
        v-model="settings.providers.mimo.mimoVoice"
        :options="allVoiceOptions"
        :loading="voicesLoading"
        @focus="loadVoices"
      />
    </SectionField>

    <SectionField label="风格标签">
      <template #hint>
        <div style="font-size: 12px; line-height: 1.7">
          <p style="margin: 0 0 6px">在文本开头用 <code>()</code> 或 <code>[]</code> 包裹风格词，可组合多个。</p>
          <table style="border-collapse: collapse; width: 100%; font-size: 11px">
            <tr>
              <td style="padding: 2px 6px; white-space: nowrap; color: var(--vtsuru-fg)">基础情绪</td>
              <td style="padding: 2px 6px">开心 / 悲伤 / 愤怒 / 恐惧 / 惊讶 / 兴奋 / 委屈 / 冷漠</td>
            </tr>
            <tr>
              <td style="padding: 2px 6px; white-space: nowrap; color: var(--vtsuru-fg)">复合情绪</td>
              <td style="padding: 2px 6px">怅然 / 欣慰 / 无奈 / 愧疚 / 释然 / 忐忑 / 动情</td>
            </tr>
            <tr>
              <td style="padding: 2px 6px; white-space: nowrap; color: var(--vtsuru-fg)">语调风格</td>
              <td style="padding: 2px 6px">温柔 / 高冷 / 活泼 / 慵懒 / 俏皮 / 深沉 / 凌厉</td>
            </tr>
            <tr>
              <td style="padding: 2px 6px; white-space: nowrap; color: var(--vtsuru-fg)">音色定位</td>
              <td style="padding: 2px 6px">磁性 / 醇厚 / 清亮 / 空灵 / 甜美 / 沙哑</td>
            </tr>
            <tr>
              <td style="padding: 2px 6px; white-space: nowrap; color: var(--vtsuru-fg)">腔调方言</td>
              <td style="padding: 2px 6px">夹子音 / 御姐音 / 正太音 / 台湾腔 / 东北话 / 粤语</td>
            </tr>
            <tr>
              <td style="padding: 2px 6px; white-space: nowrap; color: var(--vtsuru-fg)">特殊</td>
              <td style="padding: 2px 6px">(唱歌) — 需放在最开头</td>
            </tr>
          </table>
          <p style="margin: 6px 0 0; color: var(--vtsuru-fg-muted)">
            文中还可插入 [叹气] [笑] [哽咽] [颤抖] [气声] 等音频标签做细粒度控制
          </p>
        </div>
      </template>
      <UInput
        v-model="settings.providers.mimo.mimoStyleTag"
        placeholder="(慵懒 磁性) 或 [开心]，可留空"
        size="small"
        :input-props="{ autocomplete: 'off' }"
      />
    </SectionField>

    <SectionField
      label="自定义 API Key (可选)"
      hint="填写后将直接从浏览器调用 MiMo API, 不经过本站服务器, 速度更快"
    >
      <UInput
        v-model="settings.providers.mimo.mimoApiKey"
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
          href="https://platform.xiaomimimo.com"
          target="_blank"
          rel="noopener"
          style="color: var(--vtsuru-fg-muted)"
        >
          前往 MiMo 开放平台获取 API Key →
        </a>
      </span>
    </SectionField>

    <!-- 自定义音色 -->
    <SectionField label="自定义音色">
      <div
        justify="space-between"
        align="center"
        style="margin-bottom: 6px"
      >
        <span
          depth="3"
          style="font-size: 11px"
        >
          {{ account.id ? `${customVoices.length} 个自定义音色` : '登录后可用' }}
        </span>
        <UButton
          size="tiny"
          color="primary"
          variant="soft"
          :disabled="!account.id"
          @click="showCreateDialog = true"
        >
          <template #leading>
            <UIcon name="i-lucide-circle" />
          </template>
          新建
        </UButton>
      </div>

      <UEmpty
        v-if="customVoices.length === 0 && account.id"
        description="暂无自定义音色"
        size="small"
      />

      <div
        v-else
        class="voice-list"
      >
        <div
          v-for="v in customVoices"
          :key="v.id"
          class="voice-item"
          :class="{ active: isCustomSelected(v) }"
        >
          <UIcon
            name="i-lucide-circle"
            :size="14"
            style="flex-shrink: 0"
          />
          <span class="voice-name">{{ v.name }}</span>
          <UBadge
            size="tiny"
            :bordered="false"
            :type="v.type === 'clone' ? 'info' : 'success'"
          >
            {{ v.type === 'clone' ? '克隆' : '描述' }}
          </UBadge>
          <div class="voice-actions">
            <UButton
              size="tiny"
              :color="isCustomSelected(v) ? 'primary' : 'neutral'"
              variant="soft"
              @click="useCustomVoice(v)"
            >
              {{ isCustomSelected(v) ? '使用中' : '使用' }}
            </UButton>
            <UButton
              size="tiny"
              variant="soft"
              @click="editCustomVoice(v)"
            >
              <template #leading>
                <UIcon name="i-lucide-circle" />
              </template>
            </UButton>
            <UPopover>
              <UButton
                size="xs"
                variant="ghost"
                color="error"
              >
                <template #leading>
                  <UIcon name="i-lucide-circle" />
                </template>
              </UButton>
              <template #content="{ close }">
                <div class="space-y-3 p-3">
                  <div>确定删除「{{ v.name }}」？</div>
                  <div class="flex justify-end gap-2">
                    <UButton
                      size="xs"
                      color="neutral"
                      variant="ghost"
                      @click="close"
                      >取消</UButton
                    >
                    <UButton
                      size="xs"
                      color="error"
                      @click="(close(), deleteCustomVoice(v.id))"
                      >确认</UButton
                    >
                  </div>
                </div>
              </template>
            </UPopover>
          </div>
        </div>
      </div>
    </SectionField>

    <MimoCustomVoiceDialog
      v-model:open="showCreateDialog"
      :edit-voice="editingVoice"
      @created="loadCustomVoices"
      @update:show="
        (v: boolean) => {
          if (!v) editingVoice = null
        }
      "
    />
  </div>
</template>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.voice-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.voice-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border: 1px solid var(--vtsuru-border, #e5e5e5);
  border-radius: 6px;
  font-size: 12px;
  transition: border-color 120ms ease;
}
.voice-item.active {
  border-color: var(--vtsuru-primary, #18a058);
  background: rgba(24, 160, 88, 0.05);
}
.voice-name {
  flex: 1;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.voice-actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}
</style>
