<script setup lang="ts">
import {
  NAlert, NButton, NInput, NModal, NRadioButton, NRadioGroup, NText, NUpload, useMessage,
} from 'naive-ui'
import type { UploadFileInfo } from 'naive-ui'
import { computed, ref } from 'vue'
import { useAccount } from '@/api/account'
import { QueryPostAPI, GetHeaders } from '@/api/query'
import { TTS_API_URL } from '@/shared/config'

const emit = defineEmits<{ (e: 'created'): void }>()
const show = defineModel<boolean>('show', { default: false })

const message = useMessage()
const account = useAccount()

const name = ref('')
const type = ref<'clone' | 'design'>('clone')
const description = ref('')
const directorNote = ref('')
const previewText = ref('你好，这是一段试听')
const audioFileList = ref<UploadFileInfo[]>([])
const saving = ref(false)
const previewing = ref(false)
const previewAudio = ref<HTMLAudioElement | null>(null)

const canPreview = computed(() => {
  if (!previewText.value.trim()) return false
  if (type.value === 'clone') return audioFileList.value.length > 0
  if (type.value === 'design') return !!description.value.trim()
  return false
})

const canSave = computed(() => {
  if (!name.value.trim()) return false
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
    const blob = await resp.blob()
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

async function save() {
  saving.value = true
  try {
    const fd = buildFormData(false)
    fd.append('name', name.value)
    const resp = await QueryPostAPI(`${TTS_API_URL}mimo/voices/custom`, fd)
    if (resp.code !== 200) {
      throw new Error(resp.message || '保存失败')
    }
    message.success('自定义音色已保存')
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
    title="新建自定义音色"
    style="max-width: 480px"
    :mask-closable="!saving"
    :closable="!saving"
  >
    <div class="form">
      <div class="field">
        <NText strong style="font-size: 12px">
          名称
        </NText>
        <NInput v-model:value="name" placeholder="给音色起个名字" size="small" />
      </div>

      <div class="field">
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
            参考音频
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
          <NText depth="3" style="font-size: 11px; line-height: 1.5">
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
            :rows="2"
            placeholder="1-2句话描述：年龄/性别、音质/音色、语速/节奏、情感基调"
            size="small"
          />
          <NText depth="3" style="font-size: 11px">
            示例：年轻女性，声音清亮温柔，语速适中，带有轻微的撒娇感
          </NText>
        </div>
      </template>

      <div class="field">
        <NText strong style="font-size: 12px">
          导演指令 (可选)
        </NText>
        <NInput
          v-model:value="directorNote"
          placeholder="如：用温柔的语气朗读"
          size="small"
        />
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
          保存
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
