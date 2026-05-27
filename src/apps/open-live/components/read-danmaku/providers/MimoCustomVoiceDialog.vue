<script setup lang="ts">
import {
  NAlert, NButton, NInput, NModal, NRadioButton, NRadioGroup, NText, NUpload, useMessage,
} from 'naive-ui'
import type { UploadFileInfo } from 'naive-ui'
import { computed, ref, watch } from 'vue'
import { useAccount } from '@/api/account'
import { QueryPostAPI, GetHeaders } from '@/api/query'
import { TTS_API_URL } from '@/shared/config'
import { useSpeechService } from '@/store/useSpeechService'
import { createMimoClient, synthesizeMimoTts, type MimoTtsRequest } from '@/apps/open-live/voice-providers/ai-client'
import { saveVoiceAudio } from '@/apps/open-live/voice-providers/mimo-voice-store'

interface EditVoice {
  id: number
  name: string
  type: 'clone' | 'design'
  description?: string
  directorNote?: string
}

const props = defineProps<{ editVoice?: EditVoice | null }>()
const emit = defineEmits<{ (e: 'created'): void }>()
const show = defineModel<boolean>('show', { default: false })

const message = useMessage()
const account = useAccount()
const { settings } = useSpeechService()

const isEdit = computed(() => !!props.editVoice)

const name = ref('')
const type = ref<'clone' | 'design'>('clone')
const description = ref('')
const directorNote = ref('')
const previewText = ref('你好，这是一段试听')
const audioFileList = ref<UploadFileInfo[]>([])
const saving = ref(false)
const previewing = ref(false)
const previewAudio = ref<HTMLAudioElement | null>(null)

watch(show, (v) => {
  if (v && props.editVoice) {
    name.value = props.editVoice.name
    type.value = props.editVoice.type
    description.value = props.editVoice.description ?? ''
    directorNote.value = props.editVoice.directorNote ?? ''
    audioFileList.value = []
  } else if (!v) {
    reset()
  }
})

const canPreview = computed(() => {
  if (!previewText.value.trim()) return false
  if (type.value === 'clone') return audioFileList.value.length > 0
  if (type.value === 'design') return !!description.value.trim()
  return false
})

const canSave = computed(() => {
  if (!name.value.trim()) return false
  if (isEdit.value) return true
  return canPreview.value
})

function buildFormData(includeText = false) {
  const fd = new FormData()
  if (includeText) fd.append('text', previewText.value)
  fd.append('type', type.value)
  if (type.value === 'clone' && audioFileList.value[0]?.file) {
    fd.append('audioFile', audioFileList.value[0].file)
  }
  if (type.value === 'design') {
    fd.append('description', description.value)
  }
  if (directorNote.value.trim()) {
    fd.append('directorNote', directorNote.value)
  }
  return fd
}

async function preview() {
  previewing.value = true
  try {
    const apiKey = settings.value.providers.mimo?.mimoApiKey
    let blob: Blob

    if (apiKey) {
      blob = await previewDirect(apiKey)
    } else {
      blob = await previewViaBackend()
    }

    const url = URL.createObjectURL(blob)
    if (previewAudio.value) {
      previewAudio.value.pause()
      URL.revokeObjectURL(previewAudio.value.src)
    }
    const audio = new Audio(url)
    audio.addEventListener('ended', () => URL.revokeObjectURL(url), { once: true })
    previewAudio.value = audio
    await audio.play()
  } catch (error: any) {
    message.error(error.message ?? '试听失败')
  } finally {
    previewing.value = false
  }
}

async function previewViaBackend(): Promise<Blob> {
  const fd = buildFormData(true)
  const headers = Object.fromEntries(GetHeaders())
  const resp = await fetch(`${TTS_API_URL}mimo/preview`, {
    method: 'POST',
    body: fd,
    headers,
  })
  const ct = resp.headers.get('content-type') ?? ''
  if (!resp.ok || ct.includes('application/json')) {
    const err = await resp.json().catch(() => ({ error: resp.statusText }))
    throw new Error(err.error || err.message || err.details || '试听失败')
  }
  return resp.blob()
}

async function previewDirect(apiKey: string): Promise<Blob> {
  const client = createMimoClient(apiKey)
  let req: MimoTtsRequest

  if (type.value === 'clone') {
    const file = audioFileList.value[0]?.file
    if (!file) throw new Error('请先选择参考音频')
    const arrayBuf = await file.arrayBuffer()
    const bytes = new Uint8Array(arrayBuf)
    let binary = ''
    for (let i = 0; i < bytes.length; i += 8192) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 8192))
    }
    const mime = file.type || (file.name.endsWith('.wav') ? 'audio/wav' : 'audio/mpeg')
    const audioDataUrl = `data:${mime};base64,${btoa(binary)}`
    const messages: Array<{ role: string; content: string }> = []
    if (directorNote.value.trim()) messages.push({ role: 'user', content: directorNote.value })
    messages.push({ role: 'assistant', content: previewText.value })
    req = { model: 'mimo-v2.5-tts-voiceclone', messages, audio: { format: 'wav', voice: audioDataUrl } }
  } else {
    const userContent = directorNote.value.trim()
      ? `${description.value}\n${directorNote.value}`
      : description.value
    req = {
      model: 'mimo-v2.5-tts-voicedesign',
      messages: [
        { role: 'user', content: userContent },
        { role: 'assistant', content: previewText.value },
      ],
      audio: { format: 'wav' },
    }
  }

  return synthesizeMimoTts(client, req)
}

async function save() {
  saving.value = true
  try {
    if (isEdit.value) {
      const fd = new FormData()
      if (description.value.trim()) fd.append('description', description.value)
      fd.append('directorNote', directorNote.value)
      if (type.value === 'clone' && audioFileList.value[0]?.file) {
        fd.append('audioFile', audioFileList.value[0].file)
      }
      const headers = Object.fromEntries(GetHeaders())
      const resp = await fetch(`${TTS_API_URL}mimo/voices/custom/${props.editVoice!.id}`, {
        method: 'PUT', body: fd, headers,
      })
      const data = await resp.json().catch(() => null)
      if (!data || data.code !== 200) throw new Error(data?.message || '更新失败')
      if (type.value === 'clone' && audioFileList.value[0]?.file) {
        const file = audioFileList.value[0].file
        await saveVoiceAudio(props.editVoice!.id, {
          blob: file,
          mimeType: file.type || (file.name.endsWith('.wav') ? 'audio/wav' : 'audio/mpeg'),
          name: name.value,
        })
      }
      message.success('已更新')
    } else {
      const fd = buildFormData(false)
      fd.append('name', name.value)
      const resp = await QueryPostAPI(`${TTS_API_URL}mimo/voices/custom`, fd)
      if (resp.code !== 200) throw new Error(resp.message || '保存失败')
      const voiceId = (resp.data as any)?.Id ?? (resp.data as any)?.id
      if (type.value === 'clone' && audioFileList.value[0]?.file && voiceId) {
        const file = audioFileList.value[0].file
        await saveVoiceAudio(voiceId, {
          blob: file,
          mimeType: file.type || (file.name.endsWith('.wav') ? 'audio/wav' : 'audio/mpeg'),
          name: name.value,
        })
      }
      message.success('自定义音色已保存')
    }
    show.value = false
    emit('created')
    reset()
  } catch (error: any) {
    message.error(error.message ?? '保存失败')
  } finally {
    saving.value = false
  }
}

function reset() {
  name.value = ''
  type.value = 'clone'
  description.value = ''
  directorNote.value = ''
  audioFileList.value = []
}
</script>

<template>
  <NModal
    v-model:show="show"
    preset="card"
    :title="isEdit ? '编辑自定义音色' : '新建自定义音色'"
    style="max-width: 480px"
    :mask-closable="!saving"
    :closable="!saving"
  >
    <div class="form">
      <div class="field">
        <NText strong style="font-size: 12px">
          名称
        </NText>
        <NInput v-model:value="name" placeholder="给音色起个名字" size="small" :disabled="isEdit" />
      </div>

      <div v-if="!isEdit" class="field">
        <NText strong style="font-size: 12px">
          类型
        </NText>
        <NRadioGroup v-model:value="type" size="small">
          <NRadioButton value="clone">
            音频克隆
          </NRadioButton>
          <NRadioButton value="design">
            文字描述
          </NRadioButton>
        </NRadioGroup>
      </div>

      <template v-if="type === 'clone'">
        <div class="field">
          <NText strong style="font-size: 12px">
            参考音频{{ isEdit ? '（留空保持不变）' : '' }}
          </NText>
          <NUpload
            v-model:file-list="audioFileList"
            accept=".mp3,.wav"
            :max="1"
            :default-upload="false"
          >
            <NButton size="small" tertiary>
              选择文件 (mp3/wav, 最大 10MB)
            </NButton>
          </NUpload>
          <NText v-if="!isEdit" depth="3" style="font-size: 11px; line-height: 1.5">
            要求：清晰的单人语音，时长 5~30 秒为佳，避免背景音乐/噪声/混响。
            <br>
            建议用手机录音 App 在安静环境下录一段正常语速的朗读。
          </NText>
        </div>
      </template>

      <template v-if="type === 'design'">
        <div class="field">
          <NText strong style="font-size: 12px">
            音色描述
          </NText>
          <NInput
            v-model:value="description"
            type="textarea"
            :rows="3"
            placeholder="用自然语言描述想要的音色特征，1-4 句即可"
            size="small"
          />
          <NText depth="3" style="font-size: 11px; line-height: 1.6">
            关键维度：性别/年龄、音色质感（磁性/醇厚/清亮/沙哑）、情绪语气、语速节奏。
            <br>
            可选加入：角色人设、说话风格、场景描写。描述越具体越好，但避免矛盾特征。
            <br>
            示例：一位年迈的老先生，带北方口音，语速缓慢沉稳，嗓音略带沙哑和沧桑感，仿佛饱经风霜的老爷爷在讲故事
          </NText>
        </div>
      </template>

      <div class="field">
        <NText strong style="font-size: 12px">
          导演指令 (可选)
        </NText>
        <NInput
          v-model:value="directorNote"
          type="textarea"
          :rows="2"
          placeholder="像给演员写指导：语速、气息、停顿、重音、情绪起伏"
          size="small"
        />
        <NText depth="3" style="font-size: 11px; line-height: 1.6">
          用自然语言描述朗读方式，支持多风格切换、复合情绪、字粒度控制。
          <br>
          简单示例：用轻快上扬的语调，语速稍快，带着压抑不住的激动与小骄傲
          <br>
          导演模式：可从【角色】【场景】【指导】三个维度详细刻画，适合角色配音等高要求场景
        </NText>
      </div>

      <div class="field">
        <NText strong style="font-size: 12px">
          试听文本
        </NText>
        <div style="display: flex; gap: 6px">
          <NInput v-model:value="previewText" size="small" style="flex: 1" />
          <NButton
            :disabled="!canPreview"
            :loading="previewing"
            type="primary" tertiary size="small"
            @click="preview"
          >
            试听
          </NButton>
        </div>
      </div>

      <NAlert v-if="!account" type="warning" :bordered="false" size="small">
        需要登录才能保存自定义音色
      </NAlert>
    </div>

    <template #action>
      <div style="display: flex; justify-content: flex-end; gap: 8px">
        <NButton size="small" @click="show = false">
          取消
        </NButton>
        <NButton
          type="primary" size="small"
          :disabled="!canSave || !account"
          :loading="saving"
          @click="save"
        >
          {{ isEdit ? '更新' : '保存' }}
        </NButton>
      </div>
    </template>
  </NModal>
</template>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
</style>
