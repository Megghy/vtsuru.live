<script setup lang="ts">
import { useElementSize } from '@vueuse/core'
import { Save } from 'lucide-vue-next'
import { computed, ref, toRaw, watch } from 'vue'
import { toast } from 'vue-sonner'

import { useAccount } from '@/api/account'
import type { ResponseQAInfo, SettingQuestionDisplay } from '@/api/generated/model'
import { getApiQaGetCurrentAndSettings, postApiQaUpdateSetting } from '@/api/generated/qa/qa'
import QuestionDisplayStylePanel from '@/apps/web/components/question-display/QuestionDisplayStylePanel.vue'
import QuestionDisplayCard from '@/shared/components/QuestionDisplayCard.vue'
import { normalizeQuestionDisplaySetting } from '@/shared/questionDisplay'
import { createDefaultQuestionDisplaySetting } from '@/shared/questionDisplayPresets'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { ScrollArea } from '@/shared/ui/scroll-area'
import { Spin } from '@/shared/ui/spin'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'

import { useObsSceneEditorStore } from '../store/useObsSceneEditorStore'
import type { ObsModuleLayer } from '../types'
import { buildMaskClipPath } from '../utils/maskShapes'

const props = defineProps<{
  open: boolean
  layer: ObsModuleLayer | null
  ownerUserId?: number
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const account = useAccount()
const store = useObsSceneEditorStore()

const stageRef = ref<HTMLElement | null>(null)
const { width: stageWidth, height: stageHeight } = useElementSize(stageRef)

const loading = ref(false)
const saving = ref(false)
const settingDraft = ref<SettingQuestionDisplay>(createDefaultQuestionDisplaySetting())
const initialSnapshotJson = ref('')
const currentLiveQuestion = ref<ResponseQAInfo | undefined>(undefined)

type PreviewSampleMode = 'live' | 'short' | 'long' | 'empty'
type BackdropMode = 'checker' | 'dark' | 'light'

const sampleMode = ref<PreviewSampleMode>('short')
const backdropMode = ref<BackdropMode>('checker')

const SAMPLE_SHORT_QUESTION: ResponseQAInfo = {
  id: -1,
  canFollowUp: false,
  sender: { id: 0, name: '星月旅人' } as ResponseQAInfo['sender'],
  target: { id: 0, name: '主播' } as ResponseQAInfo['target'],
  question: {
    message: '晚上好呀！今天直播间的排版和配色好好看，请问平时播前都会准备什么饮品呢？',
  } as ResponseQAInfo['question'],
  isEdited: false,
  sendAt: Date.now(),
  isAnonymous: false,
  isSenderBiliAuthed: true,
}

const SAMPLE_LONG_QUESTION: ResponseQAInfo = {
  id: -2,
  canFollowUp: false,
  sender: { id: 0, name: '匿名棉花糖' } as ResponseQAInfo['sender'],
  target: { id: 0, name: '主播' } as ResponseQAInfo['target'],
  question: {
    message:
      '最近一直在追每场杂谈和歌回，感觉状态越来越稳啦！\n\n顺便想问问这周有没有计划开点歌专场或者观众互动小游戏？如果可以的话想提前点一首轻快一点的曲子，祝今天直播顺利开心～',
  } as ResponseQAInfo['question'],
  isEdited: false,
  sendAt: Date.now(),
  isAnonymous: true,
  anonymousName: '匿名棉花糖',
  isSenderBiliAuthed: false,
}

const previewWidth = computed(() => Math.max(240, props.layer?.width ?? 680))
const previewHeight = computed(() => Math.max(180, props.layer?.height ?? 420))

const autoFitScale = computed(() => {
  const availW = Math.max(120, stageWidth.value - 40)
  const availH = Math.max(120, stageHeight.value - 40)
  return Math.max(0.15, Math.min(1, availW / previewWidth.value, availH / previewHeight.value))
})

const hasCustomMask = computed(() => Boolean(props.layer?.maskShape && props.layer.maskShape !== 'none'))

const previewSetting = computed<SettingQuestionDisplay>(() => {
  const normalized = normalizeQuestionDisplaySetting(settingDraft.value)
  if (!hasCustomMask.value) return normalized
  return { ...normalized, borderRadius: 0 }
})

const previewShellStyle = computed(() => ({
  width: `${Math.round(previewWidth.value * autoFitScale.value)}px`,
  height: `${Math.round(previewHeight.value * autoFitScale.value)}px`,
}))

const previewFrameStyle = computed(() => {
  const clipPath = hasCustomMask.value
    ? buildMaskClipPath(
        props.layer?.maskShape,
        previewWidth.value,
        previewHeight.value,
        props.layer?.borderRadius ?? 0,
      )
    : undefined
  return {
    width: `${previewWidth.value}px`,
    height: `${previewHeight.value}px`,
    transform: `scale(${autoFitScale.value})`,
    transformOrigin: 'center center',
    clipPath,
  }
})

const previewQuestion = computed<ResponseQAInfo | undefined>(() => {
  if (sampleMode.value === 'live') return currentLiveQuestion.value
  if (sampleMode.value === 'short') return SAMPLE_SHORT_QUESTION
  if (sampleMode.value === 'long') return SAMPLE_LONG_QUESTION
  return undefined
})

const previewStatus = computed<'ready' | 'empty'>(() => (previewQuestion.value ? 'ready' : 'empty'))

const normalizedDraftJson = computed(() => JSON.stringify(normalizeQuestionDisplaySetting(settingDraft.value)))
const hasUnsavedChanges = computed(
  () => Boolean(initialSnapshotJson.value) && normalizedDraftJson.value !== initialSnapshotJson.value,
)

async function loadCurrentState() {
  loading.value = true
  try {
    const accountSetting = account.value?.settings?.questionDisplay
    if (accountSetting) {
      const normalized = normalizeQuestionDisplaySetting(accountSetting)
      settingDraft.value = structuredClone(normalized)
      initialSnapshotJson.value = JSON.stringify(normalized)
    }

    const uid = props.ownerUserId && props.ownerUserId > 0 ? props.ownerUserId : account.value?.id
    if (uid && uid > 0) {
      const res = await getApiQaGetCurrentAndSettings({ id: uid })
      if (res.code === 200 && res.data) {
        currentLiveQuestion.value = res.data.question ?? undefined
        const normalized = normalizeQuestionDisplaySetting(res.data.setting)
        settingDraft.value = structuredClone(normalized)
        initialSnapshotJson.value = JSON.stringify(normalized)
        sampleMode.value = currentLiveQuestion.value ? 'live' : 'short'
        return
      }
    }
    sampleMode.value = 'short'
  } catch (err) {
    toast.error(err instanceof Error ? err.message : '加载提问箱设置失败')
  } finally {
    loading.value = false
  }
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      void loadCurrentState()
    }
  },
)

async function handleSave() {
  saving.value = true
  try {
    const payload = normalizeQuestionDisplaySetting(settingDraft.value)
    const response = await postApiQaUpdateSetting(payload as any)
    if (response.code !== 200) {
      throw new Error(response.message || '保存提问箱设置失败')
    }
    initialSnapshotJson.value = JSON.stringify(payload)
    if (account.value?.settings) {
      account.value.settings.questionDisplay = structuredClone(toRaw(payload))
    }
    // 同步当前矩形图层的圆角值，确保场景画布与刚保存的提问箱样式一致
    if (props.layer && !hasCustomMask.value && props.layer.borderRadius !== payload.borderRadius) {
      store.updateLayer(props.layer.id, { borderRadius: payload.borderRadius ?? 0 })
    }
    toast.success('提问箱样式已保存并同步到场景与 OBS')
    emit('update:open', false)
  } catch (err) {
    toast.error(err instanceof Error ? err.message : '保存失败')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Dialog
    :open="open"
    @update:open="emit('update:open', $event)"
  >
    <DialogContent class="w-[calc(100%-2rem)] max-w-5xl h-[84dvh] max-h-[780px] p-0 flex flex-col overflow-hidden gap-0">
      <DialogHeader class="px-5 py-3 border-b border-border shrink-0 pr-12">
        <DialogTitle class="flex items-center gap-2 text-sm">
          <span>提问箱展示样式设置</span>
          <Badge variant="outline" class="tabular-nums font-normal">
            {{ previewWidth }} × {{ previewHeight }}
          </Badge>
        </DialogTitle>
        <DialogDescription class="text-xs">
          右侧调整样式可在左侧实时查看画面效果，点击「保存并同步」后将立即同步到场景画布与 OBS 浏览器源。
        </DialogDescription>
      </DialogHeader>

      <div class="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
        <!-- 左侧：实时画面预览区 -->
        <div class="flex-1 min-w-0 min-h-[240px] flex flex-col border-b md:border-b-0 md:border-r border-border overflow-hidden">
          <div class="flex-between gap-2 px-3 py-2 border-b border-border/70 bg-card/70 shrink-0 flex-wrap">
            <ToggleGroup
              :model-value="sampleMode"
              type="single"
              size="xs"
              @update:model-value="(v) => { if (v) sampleMode = v as PreviewSampleMode }"
            >
              <ToggleGroupItem
                v-if="currentLiveQuestion"
                value="live"
              >
                当前上屏
              </ToggleGroupItem>
              <ToggleGroupItem value="short">示例提问</ToggleGroupItem>
              <ToggleGroupItem value="long">长文示例</ToggleGroupItem>
              <ToggleGroupItem value="empty">空状态</ToggleGroupItem>
            </ToggleGroup>

            <div class="flex items-center gap-2">
              <ToggleGroup
                :model-value="backdropMode"
                type="single"
                size="xs"
                @update:model-value="(v) => { if (v) backdropMode = v as BackdropMode }"
              >
                <ToggleGroupItem value="checker">透明底</ToggleGroupItem>
                <ToggleGroupItem value="dark">深色</ToggleGroupItem>
                <ToggleGroupItem value="light">浅色</ToggleGroupItem>
              </ToggleGroup>
              <span class="text-[11px] text-muted-foreground tabular-nums">
                {{ Math.round(autoFitScale * 100) }}%
              </span>
            </div>
          </div>

          <div
            ref="stageRef"
            class="flex-1 min-h-0 p-5 flex-center overflow-hidden"
            :class="{
              'qa-preview-checker': backdropMode === 'checker',
              'bg-slate-950': backdropMode === 'dark',
              'bg-slate-100': backdropMode === 'light',
            }"
          >
            <div
              class="relative flex-center shrink-0"
              :style="previewShellStyle"
            >
              <div
                class="shrink-0"
                :class="{ 'qa-preview-no-shadow': layer?.disableShadow }"
                :style="previewFrameStyle"
              >
                <QuestionDisplayCard
                  :question="previewQuestion"
                  :setting="previewSetting"
                  :status="previewStatus"
                  :show-scrollbar="true"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- 右侧：样式设置面板 -->
        <div class="w-full md:w-[360px] shrink-0 h-[45%] md:h-full min-h-0 flex flex-col bg-card overflow-hidden">
          <div
            v-if="loading"
            class="flex-1 flex-center"
          >
            <Spin />
          </div>
          <ScrollArea
            v-else
            class="flex-1 min-w-0 [&_[data-reka-scroll-area-viewport]>div]:!block"
          >
            <div class="p-4">
              <QuestionDisplayStylePanel v-model="settingDraft" />
            </div>
          </ScrollArea>
        </div>
      </div>

      <footer class="flex-between gap-2 px-5 py-3 border-t border-border bg-card shrink-0">
        <span class="text-xs text-muted-foreground">
          {{ hasUnsavedChanges ? '存在未保存的样式修改' : '当前预览与已保存样式一致' }}
        </span>
        <div class="flex items-center gap-2">
          <Button
            variant="ghost"
            :disabled="saving"
            @click="emit('update:open', false)"
          >
            取消
          </Button>
          <Button
            :disabled="loading || saving"
            @click="handleSave"
          >
            <Save class="size-3.5" />
            <span>{{ saving ? '保存中...' : '保存并同步' }}</span>
          </Button>
        </div>
      </footer>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
.qa-preview-checker {
  background-color: #0f172a;
  background-image:
    linear-gradient(45deg, rgba(255, 255, 255, 0.05) 25%, transparent 25%),
    linear-gradient(-45deg, rgba(255, 255, 255, 0.05) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, rgba(255, 255, 255, 0.05) 75%),
    linear-gradient(-45deg, transparent 75%, rgba(255, 255, 255, 0.05) 75%);
  background-size: 20px 20px;
  background-position:
    0 0,
    0 10px,
    10px -10px,
    -10px 0;
}

.qa-preview-no-shadow :deep(*) {
  box-shadow: none !important;
  text-shadow: none !important;
}
</style>
