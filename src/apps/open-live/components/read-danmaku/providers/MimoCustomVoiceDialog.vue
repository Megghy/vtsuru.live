<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import { useAccount } from '@/api/account'
import { postApiTtsMimoVoicesCustom } from '@/api/generated/tts/tts'
import { GetHeaders } from '@/api/query'
import { createMimoClient, synthesizeMimoTts, type MimoTtsRequest } from '@/apps/open-live/voice-providers/ai-client'
import { saveVoiceAudio } from '@/apps/open-live/voice-providers/mimo-voice-store'
import { TTS_API_URL } from '@/shared/config'
import { useSpeechService } from '@/store/useSpeechService'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { Textarea } from '@/shared/ui/textarea'

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

const account = useAccount()
const { settings } = useSpeechService()

const isEdit = computed(() => !!props.editVoice)

const name = ref('')
const type = ref<'clone' | 'design'>('clone')
const description = ref('')
const directorNote = ref('')
const previewText = ref('你好，这是一段试听')
const audioFile = ref<File | null>(null)
const fileInput = ref<HTMLInputElement>()
const saving = ref(false)
const previewing = ref(false)
const previewAudio = ref<HTMLAudioElement | null>(null)

watch(show, (v) => {
  if (v && props.editVoice) {
    name.value = props.editVoice.name
    type.value = props.editVoice.type
    description.value = props.editVoice.description ?? ''
    directorNote.value = props.editVoice.directorNote ?? ''
    audioFile.value = null
  } else if (!v) {
    reset()
  }
})

const canPreview = computed(() => {
  if (!previewText.value.trim()) return false
  if (type.value === 'clone') return !!audioFile.value
  if (type.value === 'design') return !!description.value.trim()
  return false
})

const canSave = computed(() => {
  if (!name.value.trim()) return false
  if (isEdit.value) return true
  return canPreview.value
})

function onFileChange(e: Event) {
  const target = e.target as HTMLInputElement
  audioFile.value = target.files?.[0] || null
}

function buildFormData(includeText = false) {
  const fd = new FormData()
  if (includeText) fd.append('text', previewText.value)
  fd.append('type', type.value)
  if (type.value === 'clone' && audioFile.value) {
    fd.append('audioFile', audioFile.value)
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
    toast.error(error.message ?? '试听失败')
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
    const file = audioFile.value
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
    const userContent = directorNote.value.trim() ? `${description.value}\n${directorNote.value}` : description.value
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
      if (type.value === 'clone' && audioFile.value) {
        fd.append('audioFile', audioFile.value)
      }
      const headers = Object.fromEntries(GetHeaders())
      const resp = await fetch(`${TTS_API_URL}mimo/voices/custom/${props.editVoice!.id}`, {
        method: 'PUT',
        body: fd,
        headers,
      })
      const data = await resp.json().catch(() => null)
      if (!data || data.code !== 200) throw new Error(data?.message || '更新失败')
      if (type.value === 'clone' && audioFile.value) {
        const file = audioFile.value
        await saveVoiceAudio(props.editVoice!.id, {
          blob: file,
          mimeType: file.type || (file.name.endsWith('.wav') ? 'audio/wav' : 'audio/mpeg'),
          name: name.value,
        })
      }
      toast.success('已更新')
    } else {
      const body = {
        name: name.value,
        type: type.value,
        description: type.value === 'design' ? description.value : undefined,
        directorNote: directorNote.value.trim() ? directorNote.value : undefined,
        audioFile:
          type.value === 'clone' && audioFile.value
            ? audioFile.value
            : undefined,
      }
      const resp = (await postApiTtsMimoVoicesCustom(
        body as any,
      )) as unknown as {
        code: number
        message?: string
        data?: any
      }
      if (resp.code !== 200) throw new Error(resp.message || '保存失败')
      const voiceId = (resp.data as any)?.Id ?? (resp.data as any)?.id
      if (type.value === 'clone' && audioFile.value && voiceId) {
        const file = audioFile.value
        await saveVoiceAudio(voiceId, {
          blob: file,
          mimeType: file.type || (file.name.endsWith('.wav') ? 'audio/wav' : 'audio/mpeg'),
          name: name.value,
        })
      }
      toast.success('自定义音色已保存')
    }
    show.value = false
    emit('created')
    reset()
  } catch (error: any) {
    toast.error(error.message ?? '保存失败')
  } finally {
    saving.value = false
  }
}

function reset() {
  name.value = ''
  type.value = 'clone'
  description.value = ''
  directorNote.value = ''
  audioFile.value = null
  if (fileInput.value) fileInput.value.value = ''
}
</script>

<template>
  <Dialog
    :open="show"
    @update:open="show = $event"
  >
    <DialogContent class="max-w-[480px]">
      <DialogHeader>
        <DialogTitle class="text-sm font-semibold">
          {{ isEdit ? '编辑自定义音色' : '新建自定义音色' }}
        </DialogTitle>
      </DialogHeader>

      <div class="space-y-3.5 my-2">
        <div class="space-y-1">
          <label class="text-xs font-semibold text-foreground">名称</label>
          <Input v-model="name" placeholder="给音色起个名字" :disabled="isEdit" />
        </div>

        <div
          v-if="!isEdit"
          class="space-y-1"
        >
          <label class="text-xs font-semibold text-foreground">类型</label>
          <div class="inline-flex rounded-md border border-input p-0.5 bg-background text-muted-foreground w-fit">
            <button
              type="button"
              class="px-2.5 py-1 text-xs font-medium rounded-sm transition-all"
              :class="type === 'clone' ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:text-foreground'"
              @click="type = 'clone'"
            >
              音频克隆
            </button>
            <button
              type="button"
              class="px-2.5 py-1 text-xs font-medium rounded-sm transition-all"
              :class="type === 'design' ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:text-foreground'"
              @click="type = 'design'"
            >
              文字描述
            </button>
          </div>
        </div>

        <template v-if="type === 'clone'">
          <div class="space-y-1.5">
            <label class="text-xs font-semibold text-foreground">
              参考音频{{ isEdit ? '（留空保持不变）' : '' }}
            </label>
            <div class="flex items-center gap-2">
              <Button variant="outline" @click="fileInput?.click()">
                {{ audioFile ? audioFile.name : '选择文件 (mp3/wav, 最大 10MB)' }}
              </Button>
              <input
                ref="fileInput"
                hidden
                type="file"
                accept=".mp3,.wav"
                @change="onFileChange"
              />
            </div>
            <div
              v-if="!isEdit"
              class="text-[11px] text-muted-foreground leading-relaxed"
            >
              要求：清晰的单人语音，时长 5~30 秒为佳，避免背景音乐/噪声/混响。
              <br />
              建议用手机录音 App 在安静环境下录一段正常语速的朗读。
            </div>
          </div>
        </template>

        <template v-if="type === 'design'">
          <div class="space-y-1.5">
            <label class="text-xs font-semibold text-foreground">音色描述</label>
            <Textarea
              v-model="description"
              :rows="3"
              placeholder="用自然语言描述想要的音色特征，1-4 句即可"
              class="text-xs"
            />
            <div class="text-[11px] text-muted-foreground leading-relaxed">
              关键维度：性别/年龄、音色质感（磁性/醇厚/清亮/沙哑）、情绪语气、语速节奏。
              <br />
              可选加入：角色人设、说话风格、场景描写。描述越具体越好，但避免矛盾特征。
              <br />
              示例：一位年迈的老先生，带北方口音，语速缓慢沉稳，嗓音略带沙哑和沧桑感，仿佛饱经风霜的老爷爷在讲故事
            </div>
          </div>
        </template>

        <div class="space-y-1.5">
          <label class="text-xs font-semibold text-foreground">导演指令 (可选)</label>
          <Textarea
            v-model="directorNote"
            :rows="2"
            placeholder="像给演员写指导：语速、气息、停顿、重音、情绪起伏"
            class="text-xs"
          />
          <div class="text-[11px] text-muted-foreground leading-relaxed">
            用自然语言描述朗读方式，支持多风格切换、复合情绪、字粒度控制。
            <br />
            简单示例：用轻快上扬的语调，语速稍快，带着压抑不住的激动与小骄傲
            <br />
            导演模式：可从【角色】【场景】【指导】三个维度详细刻画，适合角色配音等高要求场景
          </div>
        </div>

        <div class="space-y-1">
          <label class="text-xs font-semibold text-foreground">试听文本</label>
          <div class="flex items-center gap-2">
            <Input v-model="previewText" class="flex-1" />
            <Button variant="outline" class="shrink-0" :disabled="!canPreview || previewing" @click="preview">
              {{ previewing ? '试听中...' : '试听' }}
            </Button>
          </div>
        </div>

        <Alert
          v-if="!account"
          class="border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400 py-1.5 px-2"
        >
          <AlertDescription class="text-xs m-0">
            需要登录才能保存自定义音色
          </AlertDescription>
        </Alert>
      </div>

      <DialogFooter class="gap-2">
        <Button variant="outline" @click="show = false">
          取消
        </Button>
        <Button :disabled="!canSave || !account || saving" @click="save">
          {{ isEdit ? '更新' : '保存' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
