<script setup lang="ts">
import { Add20Filled, Delete20Filled, Edit20Filled, Mic20Filled, TextDescription20Filled } from '@vicons/fluent'
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import { useAccount } from '@/api/account'
import { getApiTtsMimoVoicesCustom } from '@/api/generated/tts/tts'
import { GetHeaders } from '@/api/query'
import type { VoiceOption } from '@/apps/open-live/voice-providers'
import { MimoVoiceProvider, type MimoCustomVoiceInfo } from '@/apps/open-live/voice-providers/mimo'
import { deleteVoiceAudio } from '@/apps/open-live/voice-providers/mimo-voice-store'
import { TTS_API_URL } from '@/shared/config'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Empty } from '@/shared/ui/empty'
import { Input } from '@/shared/ui/input'
import { Popconfirm } from '@/shared/ui/popconfirm'
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
    const resp = (await getApiTtsMimoVoicesCustom()) as unknown as {
      code: number
      message?: string
      data?: CustomVoice[]
    }
    if (resp.code !== 200) throw new Error(resp.message || '加载自定义音色失败')
    if (!Array.isArray(resp.data)) throw new Error('自定义音色数据格式错误')

    customVoices.value = resp.data
    const provider = speechService.getCurrentProvider()
    if (provider instanceof MimoVoiceProvider) {
      provider.setCustomVoices(resp.data as MimoCustomVoiceInfo[])
    }
  } catch (error) {
    toast.error(error instanceof Error ? error.message : '加载自定义音色失败')
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
      toast.success('已删除')
    }
  } catch {
    toast.error('删除失败')
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
  <div class="flex flex-col gap-3">
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
        <div class="text-xs leading-relaxed">
          <p class="mb-1.5">在文本开头用 <code>()</code> 或 <code>[]</code> 包裹风格词，可组合多个。</p>
          <table class="w-full text-[11px] border-collapse">
            <tr>
              <td class="py-0.5 px-1.5 whitespace-nowrap text-foreground font-medium">基础情绪</td>
              <td class="py-0.5 px-1.5 text-muted-foreground">开心 / 悲伤 / 愤怒 / 恐惧 / 惊讶 / 兴奋 / 委屈 / 冷漠</td>
            </tr>
            <tr>
              <td class="py-0.5 px-1.5 whitespace-nowrap text-foreground font-medium">复合情绪</td>
              <td class="py-0.5 px-1.5 text-muted-foreground">怅然 / 欣慰 / 无奈 / 愧疚 / 释然 / 忐忑 / 动情</td>
            </tr>
            <tr>
              <td class="py-0.5 px-1.5 whitespace-nowrap text-foreground font-medium">语调风格</td>
              <td class="py-0.5 px-1.5 text-muted-foreground">温柔 / 高冷 / 活泼 / 慵懒 / 俏皮 / 深沉 / 凌厉</td>
            </tr>
            <tr>
              <td class="py-0.5 px-1.5 whitespace-nowrap text-foreground font-medium">音色定位</td>
              <td class="py-0.5 px-1.5 text-muted-foreground">磁性 / 醇厚 / 清亮 / 空灵 / 甜美 / 沙哑</td>
            </tr>
            <tr>
              <td class="py-0.5 px-1.5 whitespace-nowrap text-foreground font-medium">腔调方言</td>
              <td class="py-0.5 px-1.5 text-muted-foreground">夹子音 / 御姐音 / 正太音 / 台湾腔 / 东北话 / 粤语</td>
            </tr>
            <tr>
              <td class="py-0.5 px-1.5 whitespace-nowrap text-foreground font-medium">特殊</td>
              <td class="py-0.5 px-1.5 text-muted-foreground">(唱歌) — 需放在最开头</td>
            </tr>
          </table>
          <p class="mt-1.5 text-muted-foreground">
            文中还可插入 [叹气] [笑] [哽咽] [颤抖] [气声] 等音频标签做细粒度控制
          </p>
        </div>
      </template>
      <Input
        v-model="settings.providers.mimo.mimoStyleTag"
        placeholder="(慵懒 磁性) 或 [开心]，可留空"
        autocomplete="off"
      />
    </SectionField>

    <SectionField
      label="自定义 API Key (可选)"
      hint="填写后将直接从浏览器调用 MiMo API, 不经过本站服务器, 速度更快"
    >
      <Input
        v-model="settings.providers.mimo.mimoApiKey"
        type="password"
        placeholder="sk-xxxx"
        autocomplete="new-password"
      />
      <span class="text-[11px] text-muted-foreground">
        <a
          href="https://platform.xiaomimimo.com"
          target="_blank"
          rel="noopener"
          class="hover:underline"
        >
          前往 MiMo 开放平台获取 API Key →
        </a>
      </span>
    </SectionField>

    <!-- 自定义音色 -->
    <SectionField label="自定义音色">
      <div class="flex items-center justify-between mb-1.5">
        <span class="text-[11px] text-muted-foreground">
          {{ account.id ? `${customVoices.length} 个自定义音色` : '登录后可用' }}
        </span>
        <Button
          size="xs"
          variant="secondary"
          class="h-6 text-[11px] gap-1"
          :disabled="!account.id"
          @click="showCreateDialog = true"
        >
          <Add20Filled class="size-3.5" />
          新建
        </Button>
      </div>

      <Empty
        v-if="customVoices.length === 0 && account.id"
        description="暂无自定义音色"
        class="py-4 text-xs"
      />

      <div
        v-else
        class="flex flex-col gap-1"
      >
        <div
          v-for="v in customVoices"
          :key="v.id"
          class="flex items-center gap-2 py-1.5 px-2 border border-border rounded-md text-xs transition-colors"
          :class="{ 'border-primary bg-primary/5': isCustomSelected(v) }"
        >
          <Mic20Filled
            v-if="v.type === 'clone'"
            class="size-3.5 shrink-0 text-muted-foreground"
          />
          <TextDescription20Filled
            v-else
            class="size-3.5 shrink-0 text-muted-foreground"
          />

          <span class="flex-1 font-medium overflow-hidden text-ellipsis whitespace-nowrap">{{ v.name }}</span>

          <Badge
            variant="outline"
            class="text-[10px] h-4.5 px-1"
            :class="
              v.type === 'clone'
                ? 'border-sky-500/40 text-sky-600 bg-sky-500/10'
                : 'border-emerald-500/40 text-emerald-600 bg-emerald-500/10'
            "
          >
            {{ v.type === 'clone' ? '克隆' : '描述' }}
          </Badge>

          <div class="flex items-center gap-0.5 shrink-0">
            <Button
              size="xs"
              :variant="isCustomSelected(v) ? 'default' : 'ghost'"
              class="h-6 px-2 text-[11px]"
              @click="useCustomVoice(v)"
            >
              {{ isCustomSelected(v) ? '使用中' : '使用' }}
            </Button>
            <Button
              size="xs"
              variant="ghost"
              class="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
              @click="editCustomVoice(v)"
            >
              <Edit20Filled class="size-3.5" />
            </Button>
            <Popconfirm
              title="确认删除"
              @positive-click="deleteCustomVoice(v.id)"
            >
              <template #trigger>
                <Button
                  size="xs"
                  variant="ghost"
                  class="h-6 w-6 p-0 text-destructive hover:text-destructive"
                >
                  <Delete20Filled class="size-3.5" />
                </Button>
              </template>
              确定删除「{{ v.name }}」？
            </Popconfirm>
          </div>
        </div>
      </div>
    </SectionField>

    <MimoCustomVoiceDialog
      v-model:show="showCreateDialog"
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
