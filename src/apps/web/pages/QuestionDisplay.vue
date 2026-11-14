<script setup lang="ts">
import ArrowLeft24Regular from '@vicons/fluent/es/ArrowLeft24Regular'
import ArrowRight24Regular from '@vicons/fluent/es/ArrowRight24Regular'
import Checkmark24Regular from '@vicons/fluent/es/Checkmark24Regular'
import Copy24Regular from '@vicons/fluent/es/Copy24Regular'
import Dismiss24Regular from '@vicons/fluent/es/Dismiss24Regular'
import PanelRight24Regular from '@vicons/fluent/es/PanelRight24Regular'
import PanelRightContract24Regular from '@vicons/fluent/es/PanelRightContract24Regular'
import Save24Regular from '@vicons/fluent/es/Save24Regular'
import Heart from '@vicons/ionicons5/es/Heart'
import HeartOutline from '@vicons/ionicons5/es/HeartOutline'
import { useElementSize, useThrottleFn } from '@vueuse/core'
import { computed, onBeforeUnmount, onMounted, ref, toRaw, watch } from 'vue'
import { onBeforeRouteLeave, useRouter } from 'vue-router'

import { useAccount } from '@/api/account'
import type { ResponseQAInfoToTarget, SettingQuestionDisplay } from '@/api/generated/model'
import { postApiQaUpdateSetting } from '@/api/generated/qa/qa'
import QuestionDisplayQueue from '@/apps/web/components/question-display/QuestionDisplayQueue.vue'
import QuestionDisplayStylePanel from '@/apps/web/components/question-display/QuestionDisplayStylePanel.vue'
import QuestionDisplayCard from '@/shared/components/QuestionDisplayCard.vue'
import { CURRENT_HOST } from '@/shared/config'
import { buildObsSourceUrl } from '@/shared/obs/obsUrl'
import {
  getAdjacentQuestion,
  getNextUnreadQuestion,
  isLegacyQuestionDisplaySetting,
  normalizeQuestionDisplaySetting,
} from '@/shared/questionDisplay'
import { createDefaultQuestionDisplaySetting } from '@/shared/questionDisplayPresets'
import { useRealtimeTopic } from '@/shared/realtime'
import { usePersistedStorage } from '@/shared/storage/persist'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'
import { Spin } from '@/shared/ui/spin'
import { Switch } from '@/shared/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
import { copyToClipboard, toast } from '@/shared/utils'
import { useQuestionBox } from '@/store/useQuestionBox'

const router = useRouter()
const accountInfo = useAccount()
const questionBox = useQuestionBox()
const qaTopic = computed(() => (accountInfo.value.id > 0 ? `obs:display:qa:${accountInfo.value.id}` : ''))
const { status: realtimeStatus, publish: publishQaEvent } = useRealtimeTopic(qaTopic)

const stageViewportRef = ref<HTMLElement>()
const { width: viewportWidth, height: viewportHeight } = useElementSize(stageViewportRef)

// 默认 fallback 为棉花糖预设
const settingDraft = ref<SettingQuestionDisplay>(createDefaultQuestionDisplaySetting())
const previewSetting = computed(() => normalizeQuestionDisplaySetting(settingDraft.value))
const saving = ref(false)
const settingsReady = computed(() => Boolean(accountInfo.value?.settings))
const savedCardSize = usePersistedStorage('Settings.QuestionDisplay.CardSize', { width: 720, height: 480 })
const autoMarkRead = usePersistedStorage('Settings.QuestionDisplay.AutoMarkRead', false)
const showPreviewScrollbar = usePersistedStorage('vtsuru:settings:question-display:show-scrollbar', true)
const isSettingsCollapsed = usePersistedStorage('Settings.QuestionDisplay.SettingsCollapsed', false)

const obsUrl = computed(() =>
  buildObsSourceUrl({
    path: 'obs/question-display',
    host: CURRENT_HOST,
    credential: 'public-id',
    userId: accountInfo.value?.id,
  }),
)

// 视口自适应缩放计算（以 100% 为上限，自动完整贴合在可用视口中央）
const autoFitScale = computed(() => {
  const cardW = Math.max(100, savedCardSize.value.width)
  const cardH = Math.max(100, savedCardSize.value.height)
  const availW = Math.max(120, viewportWidth.value - 48)
  const availH = Math.max(120, viewportHeight.value - 48)
  const ratio = Math.min(availW / cardW, availH / cardH)
  return Math.max(0.15, Math.min(1, ratio))
})

const previewShellStyle = computed(() => ({
  width: `${Math.round(savedCardSize.value.width * autoFitScale.value)}px`,
  height: `${Math.round(savedCardSize.value.height * autoFitScale.value)}px`,
}))

const previewStyle = computed(() => ({
  width: `${savedCardSize.value.width}px`,
  height: `${savedCardSize.value.height}px`,
  transform: `scale(${autoFitScale.value})`,
}))

const searchKeyword = ref('')
const displayTag = ref<string>()
const onlyUnread = ref(false)
const onlyFavorite = ref(false)
const onlyUnreplied = ref(false)

const filteredQuestions = computed(() => {
  const keyword = searchKeyword.value.trim().toLowerCase()
  return questionBox.recieveQuestions
    .filter(
      (item) =>
        (!item.reviewResult || item.reviewResult.isApproved === true) &&
        (!onlyFavorite.value || item.isFavorite) &&
        (!onlyUnread.value || !item.isReaded) &&
        (!onlyUnreplied.value || !item.answer) &&
        (!displayTag.value || item.tag === displayTag.value) &&
        (!keyword || item.question?.message?.toLowerCase().includes(keyword)),
    )
    .toSorted((a, b) => {
      if (a.isReaded !== b.isReaded) return a.isReaded ? 1 : -1
      return b.sendAt - a.sendAt
    })
})

const syncStatusText = computed(() => {
  if (realtimeStatus.value.connected) return '通道已就绪'
  if (realtimeStatus.value.error) return realtimeStatus.value.error
  if (realtimeStatus.value.connecting) return '正在连接同步通道'
  return '等待同步通道'
})

let resizeStart:
  | {
      centerX: number
      centerY: number
      scale: number
    }
  | undefined

const initializedFromAccount = ref(false)
const lastSyncedSettingJson = ref('')
const needsLegacySync = ref(false)
const saveError = ref(false)
let autoSaveTimer: number | undefined
let suppressNextAutoSave = false
let pendingSaveAfterCurrent = false
let pendingManualToast = false

const draftSettingJson = computed(() => JSON.stringify(previewSetting.value))

const hasUnsavedChanges = computed(() => {
  if (!initializedFromAccount.value || !settingDraft.value) return false
  return draftSettingJson.value !== lastSyncedSettingJson.value
})

const canManualSync = computed(() => hasUnsavedChanges.value || needsLegacySync.value || saveError.value)

function clearAutoSaveTimer() {
  window.clearTimeout(autoSaveTimer)
  autoSaveTimer = undefined
}

function scheduleAutoSave() {
  if (!initializedFromAccount.value || !accountInfo.value) return
  saveError.value = false
  clearAutoSaveTimer()
  autoSaveTimer = window.setTimeout(() => {
    autoSaveTimer = undefined
    void saveSettings({ silent: true })
  }, 450)
}

watch(
  () => accountInfo.value?.settings?.questionDisplay,
  (value) => {
    if (!value) return
    const normalized = normalizeQuestionDisplaySetting(value)
    const normalizedJson = JSON.stringify(normalized)
    // 旧版全零设置首次仅在前端兜底展示，不自动静默改库，也不触发离开页弹窗，但保留「立即同步」按钮可点
    const isLegacy = isLegacyQuestionDisplaySetting(value)
    if (!initializedFromAccount.value || !hasUnsavedChanges.value) {
      suppressNextAutoSave = true
      try {
        settingDraft.value = normalized
        lastSyncedSettingJson.value = normalizedJson
        needsLegacySync.value = isLegacy
        initializedFromAccount.value = true
      } finally {
        suppressNextAutoSave = false
      }
    }
  },
  { immediate: true, deep: true },
)

watch(
  draftSettingJson,
  () => {
    if (!initializedFromAccount.value || suppressNextAutoSave) return
    scheduleAutoSave()
  },
  { flush: 'sync' },
)

const syncScroll = useThrottleFn(
  (progress: number) => {
    if (settingDraft.value?.syncScroll && qaTopic.value) {
      void publishQaEvent('Scroll', progress).catch((error) => {
        console.warn('[QuestionDisplay] 滚动同步发送失败', error)
      })
    }
  },
  80,
  true,
  true,
)

function resizePreview(event: PointerEvent) {
  if (!resizeStart) return
  const halfWOnScreen = Math.max(30, event.clientX - resizeStart.centerX)
  const halfHOnScreen = Math.max(30, event.clientY - resizeStart.centerY)

  const newWidth = Math.round((halfWOnScreen * 2) / resizeStart.scale)
  const newHeight = Math.round((halfHOnScreen * 2) / resizeStart.scale)

  savedCardSize.value = {
    width: Math.max(240, Math.min(3840, newWidth)),
    height: Math.max(180, Math.min(2160, newHeight)),
  }
}

function stopPreviewResize() {
  resizeStart = undefined
  window.removeEventListener('pointermove', resizePreview)
}

function startPreviewResize(event: PointerEvent) {
  event.preventDefault()
  if (!stageViewportRef.value) return
  const rect = stageViewportRef.value.getBoundingClientRect()
  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2

  resizeStart = {
    centerX,
    centerY,
    scale: autoFitScale.value,
  }
  window.addEventListener('pointermove', resizePreview)
  window.addEventListener('pointerup', stopPreviewResize, { once: true })
}

function confirmLeave(): boolean {
  return window.confirm('有未保存的展示设置，离开后会丢失，确定要离开吗？')
}

function goBack() {
  void router.push({ name: 'manage-questionBox' })
}

function onBeforeUnload(event: BeforeUnloadEvent) {
  if (!hasUnsavedChanges.value) return
  event.preventDefault()
  event.returnValue = ''
}

async function saveSettings(options: { silent?: boolean } = {}) {
  if (!settingDraft.value || !accountInfo.value) return
  if (!options.silent) {
    clearAutoSaveTimer()
  }
  if (saving.value) {
    pendingSaveAfterCurrent = true
    if (!options.silent) pendingManualToast = true
    return
  }

  const payload = normalizeQuestionDisplaySetting(settingDraft.value)
  const payloadJson = JSON.stringify(payload)
  if (payloadJson === lastSyncedSettingJson.value && !needsLegacySync.value) {
    saveError.value = false
    if (!options.silent) {
      toast.success('展示设置已保存并同步')
    }
    return
  }

  saving.value = true
  saveError.value = false
  try {
    const response = await postApiQaUpdateSetting(payload as any)
    if (response.code !== 200) throw new Error(response.message)
    lastSyncedSettingJson.value = payloadJson
    needsLegacySync.value = false
    initializedFromAccount.value = true
    accountInfo.value.settings.questionDisplay = structuredClone(toRaw(payload))
    if (!options.silent) {
      toast.success('展示设置已保存并同步')
    }
  } catch (error) {
    saveError.value = true
    toast.error(error instanceof Error ? error.message : '保存失败')
  } finally {
    saving.value = false
    if (pendingSaveAfterCurrent) {
      const shouldToast = pendingManualToast
      pendingSaveAfterCurrent = false
      pendingManualToast = false
      void saveSettings({ silent: !shouldToast })
    }
  }
}

async function showQuestion(item: ResponseQAInfoToTarget) {
  await questionBox.setCurrentQuestion(item)
  if (autoMarkRead.value && !item.isReaded) {
    void questionBox.read(item, true)
  }
}

function adjacentQuestion(direction: -1 | 1) {
  const questions = filteredQuestions.value
  const target = getAdjacentQuestion(questions, questionBox.displayQuestion?.id, direction)
  if (target) {
    void showQuestion(target)
  }
}

function nextUnread() {
  const questions = filteredQuestions.value
  const next = getNextUnreadQuestion(questions, questionBox.displayQuestion?.id)
  if (next) {
    void showQuestion(next)
  } else {
    toast.info('当前筛选范围内没有更多未读提问')
  }
}

function markCurrentRead() {
  if (questionBox.displayQuestion) {
    void questionBox.read(questionBox.displayQuestion, true)
  }
}

function toggleCurrentFavorite() {
  const current = questionBox.displayQuestion
  if (current) {
    void questionBox.favorite(current, !current.isFavorite)
  }
}

async function copyObsUrl() {
  if (!obsUrl.value) {
    toast.error('请先登录后再复制 OBS 链接')
    return
  }
  await copyToClipboard(obsUrl.value)
  toast.success('OBS 链接已复制')
}

// 键盘快捷键监听
function handleKeydown(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null
  const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)

  if (isInput) return

  // Ctrl + S / Cmd + S 保存
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
    event.preventDefault()
    if (canManualSync.value && !saving.value) {
      void saveSettings()
    }
    return
  }

  // 方向键或快捷键
  if (event.key === 'ArrowLeft' || event.key === 'k') {
    event.preventDefault()
    adjacentQuestion(-1)
  } else if (event.key === 'ArrowRight' || event.key === 'j') {
    event.preventDefault()
    adjacentQuestion(1)
  } else if (event.key.toLowerCase() === 'n') {
    event.preventDefault()
    nextUnread()
  } else if (event.key === 'Escape') {
    event.preventDefault()
    void questionBox.clearCurrentQuestion()
  } else if (event.key === ' ' || event.code === 'Space') {
    event.preventDefault()
    if (questionBox.displayQuestion) {
      void questionBox.clearCurrentQuestion()
    } else if (filteredQuestions.value.length) {
      void showQuestion(filteredQuestions.value[0])
    }
  } else if (event.key.toLowerCase() === 'r' || event.key.toLowerCase() === 'm') {
    event.preventDefault()
    markCurrentRead()
  } else if (event.key.toLowerCase() === 'f') {
    event.preventDefault()
    toggleCurrentFavorite()
  }
}

onBeforeRouteLeave(async () => {
  if (!hasUnsavedChanges.value) return true
  return confirmLeave()
})

watch(
  () => accountInfo.value?.id,
  (id) => {
    if (!id) return
    void questionBox.GetTags()
    void questionBox.GetRecieveQAInfo()
  },
  { immediate: true },
)

onMounted(() => {
  window.addEventListener('beforeunload', onBeforeUnload)
  window.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  clearAutoSaveTimer()
  window.removeEventListener('beforeunload', onBeforeUnload)
  window.removeEventListener('keydown', handleKeydown)
  stopPreviewResize()
})
</script>

<template>
  <TooltipProvider>
    <main
      class="grid grid-cols-[minmax(300px,340px)_minmax(420px,1fr)_minmax(310px,350px)] w-full h-dvh min-h-0 overflow-hidden text-foreground bg-background transition-all duration-200"
      :class="{ 'grid-cols-[minmax(300px,340px)_minmax(420px,1fr)_0px]!': isSettingsCollapsed }"
    >
      <QuestionDisplayQueue
        v-model:search="searchKeyword"
        v-model:tag="displayTag"
        v-model:only-unread="onlyUnread"
        v-model:only-favorite="onlyFavorite"
        v-model:only-unreplied="onlyUnreplied"
        :questions="filteredQuestions"
        :current-id="questionBox.displayQuestion?.id"
        :tags="questionBox.tags.map((item) => item.name)"
        :loading="questionBox.isLoading"
        @refresh="questionBox.GetRecieveQAInfo"
        @show="showQuestion"
        @clear="questionBox.clearCurrentQuestion"
        @read="questionBox.read($event, true)"
        @favorite="questionBox.favorite"
      />

      <section class="stage-panel grid grid-rows-[auto_minmax(0,1fr)_auto] min-w-0 min-h-0">
        <header class="stage-toolbar flex-between min-h-14 px-4 bg-card border-b border-border">
          <div class="stage-title flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              class="size-8"
              aria-label="返回提问箱管理"
              @click="goBack"
            >
              <component
                :is="ArrowLeft24Regular"
                class="size-4"
              />
            </Button>
            <div class="flex flex-col">
              <strong class="text-sm font-semibold">展示展板</strong>
              <span class="stage-meta-dims text-xs text-muted-foreground font-mono">
                {{ savedCardSize.width }} × {{ savedCardSize.height }}
                <em class="scale-hint not-italic opacity-80">(自适应 {{ Math.round(autoFitScale * 100) }}%)</em>
              </span>
            </div>
          </div>

          <div class="stage-toolbar-actions flex items-center gap-2">
            <Button
              variant="outline"
              class="flex items-center gap-1.5"
              aria-label="复制 OBS 浏览器源链接"
              @click="copyObsUrl"
            >
              <component
                :is="Copy24Regular"
                class="size-3.5"
              />
              复制 OBS 链接
            </Button>

            <Badge
              :variant="questionBox.displayQuestion ? 'default' : 'secondary'"
              class="h-6 px-2"
            >
              {{ questionBox.displayQuestion ? '正在展示' : '画面已清空' }}
            </Badge>

            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  variant="ghost"
                  size="icon"
                  class="size-8"
                  :aria-label="isSettingsCollapsed ? '展开设置面板' : '折叠设置面板'"
                  @click="isSettingsCollapsed = !isSettingsCollapsed"
                >
                  <component
                    :is="isSettingsCollapsed ? PanelRight24Regular : PanelRightContract24Regular"
                    class="size-4"
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{{ isSettingsCollapsed ? '展开展示设置' : '折叠展示设置' }}</TooltipContent>
            </Tooltip>
          </div>
        </header>

        <div
          ref="stageViewportRef"
          class="stage-viewport relative flex-1 min-h-0 p-6 flex-center overflow-hidden bg-muted/20"
        >
          <div
            class="preview-frame-shell relative flex-center transition-all duration-75"
            :style="previewShellStyle"
          >
            <div
              class="preview-frame origin-center transition-transform duration-75"
              :style="previewStyle"
            >
              <QuestionDisplayCard
                :question="questionBox.displayQuestion"
                :setting="previewSetting"
                :status="questionBox.displayQuestion ? 'ready' : 'empty'"
                :show-scrollbar="showPreviewScrollbar"
                @scroll="syncScroll"
              />
            </div>
            <Tooltip>
              <TooltipTrigger as-child>
                <button
                  type="button"
                  class="preview-resize-handle absolute -right-2 -bottom-2 size-4 rounded-full bg-primary border-2 border-background shadow-xs cursor-nwse-resize z-30 transition hover:scale-125"
                  aria-label="拖动调整 OBS 画布大小"
                  @pointerdown="startPreviewResize"
                />
              </TooltipTrigger>
              <TooltipContent>拖动调整 OBS 画布大小</TooltipContent>
            </Tooltip>
          </div>
        </div>

        <footer class="stage-actions flex-between p-3 bg-card border-t border-border text-xs">
          <div class="actions-left flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  variant="outline"
                  size="icon"
                  class="size-8"
                  aria-label="上一条提问 (快捷键 ← / K)"
                  @click="adjacentQuestion(-1)"
                >
                  <component
                    :is="ArrowLeft24Regular"
                    class="size-4"
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent>上一条提问 (快捷键 ← / K)</TooltipContent>
            </Tooltip>

            <Button
              variant="outline"
              class="text-destructive hover:bg-destructive/10 flex items-center gap-1"
              :disabled="!questionBox.displayQuestion"
              @click="questionBox.clearCurrentQuestion"
            >
              <component
                :is="Dismiss24Regular"
                class="size-3.5"
              />
              清空 (Space)
            </Button>

            <Button
              class="flex items-center gap-1"
              @click="nextUnread"
            >
              下一条未读 (N)
              <component
                :is="ArrowRight24Regular"
                class="size-3.5"
              />
            </Button>

            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  variant="outline"
                  size="icon"
                  class="size-8"
                  aria-label="下一条提问 (快捷键 → / J)"
                  @click="adjacentQuestion(1)"
                >
                  <component
                    :is="ArrowRight24Regular"
                    class="size-4"
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent>下一条提问 (快捷键 → / J)</TooltipContent>
            </Tooltip>

            <span class="w-px h-4 bg-border mx-1" />

            <Button
              variant="outline"
              class="flex items-center gap-1"
              :disabled="!questionBox.displayQuestion || questionBox.displayQuestion.isReaded"
              @click="markCurrentRead"
            >
              <component
                :is="Checkmark24Regular"
                class="size-3.5"
              />
              标已读 (R)
            </Button>

            <Button
              variant="outline"
              class="flex items-center gap-1"
              :class="{ 'text-destructive': questionBox.displayQuestion?.isFavorite }"
              :disabled="!questionBox.displayQuestion"
              @click="toggleCurrentFavorite"
            >
              <component
                :is="questionBox.displayQuestion?.isFavorite ? Heart : HeartOutline"
                class="size-3.5"
              />
              {{ questionBox.displayQuestion?.isFavorite ? '已收藏' : '收藏' }} (F)
            </Button>
          </div>

          <div class="actions-right flex items-center gap-4">
            <label class="flex items-center gap-1.5 cursor-pointer text-xs">
              <Checkbox v-model:checked="showPreviewScrollbar" />
              <span>长内容显示滚动条</span>
            </label>
            <label class="flex items-center gap-1.5 cursor-pointer text-xs">
              <Checkbox v-model:checked="autoMarkRead" />
              <span>展示时自动标已读</span>
            </label>
          </div>
        </footer>
      </section>

      <aside
        v-show="!isSettingsCollapsed"
        class="settings-panel flex flex-col h-full min-h-0 bg-card border-l border-border"
      >
        <header class="settings-heading flex-between min-h-14 px-4 border-b border-border">
          <div class="flex items-center gap-2">
            <strong class="text-sm font-semibold">展示设置</strong>
            <span
              class="text-[11px] font-mono px-1.5 py-0.5 rounded"
              :class="
                saveError
                  ? 'text-destructive bg-destructive/10'
                  : saving || hasUnsavedChanges || needsLegacySync
                    ? 'text-amber-500 bg-amber-500/10'
                    : 'text-muted-foreground'
              "
            >
              {{ saving ? '同步中...' : saveError ? '同步失败' : hasUnsavedChanges || needsLegacySync ? '待同步' : '已同步' }}
            </span>
          </div>
          <Button
            class="flex items-center gap-1"
            :disabled="!canManualSync || saving"
            @click="saveSettings()"
          >
            <component
              :is="Save24Regular"
              class="size-3.5"
            />
            {{ saving ? '同步中...' : saveError ? '重试同步' : '立即同步' }}
          </Button>
        </header>

        <div class="settings-scroll flex-1 min-h-0 overflow-y-auto p-4">
          <div
            v-if="!settingsReady"
            class="py-16 flex justify-center"
          >
            <Spin />
          </div>
          <Tabs
            v-else
            default-value="style"
            class="w-full"
          >
            <TabsList class="w-full grid grid-cols-2">
              <TabsTrigger value="style">外观</TabsTrigger>
              <TabsTrigger value="obs">OBS</TabsTrigger>
            </TabsList>
            <TabsContent
              value="style"
              class="pt-3"
            >
              <QuestionDisplayStylePanel
                v-if="settingDraft"
                v-model="settingDraft"
              />
            </TabsContent>
            <TabsContent
              value="obs"
              class="pt-3 space-y-4 text-xs"
            >
              <div class="space-y-1.5">
                <label class="font-medium text-foreground">OBS 浏览器源链接</label>
                <div class="flex gap-1.5">
                  <Input
                    readonly
                    :model-value="obsUrl"
                    placeholder="登录后可复制 OBS 链接"
                    class="font-mono"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    class="size-8 shrink-0"
                    aria-label="复制 OBS 链接"
                    @click="copyObsUrl"
                  >
                    <component
                      :is="Copy24Regular"
                      class="size-3.5"
                    />
                  </Button>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div class="space-y-1">
                  <label class="font-medium text-foreground">画布宽度 (px)</label>
                  <NumberField
                    v-model="savedCardSize.width"
                    :min="240"
                    :max="3840"
                  />
                </div>
                <div class="space-y-1">
                  <label class="font-medium text-foreground">画布高度 (px)</label>
                  <NumberField
                    v-model="savedCardSize.height"
                    :min="180"
                    :max="2160"
                  />
                </div>
              </div>

              <div class="flex items-center gap-1.5 flex-wrap">
                <Button
                  size="xs"
                  variant="outline"
                  class="text-[11px]"
                  @click="savedCardSize = { width: 720, height: 480 }"
                >
                  3:2 (720×480)
                </Button>
                <Button
                  size="xs"
                  variant="outline"
                  class="text-[11px]"
                  @click="savedCardSize = { width: 800, height: 450 }"
                >
                  16:9 (800×450)
                </Button>
                <Button
                  size="xs"
                  variant="outline"
                  class="text-[11px]"
                  @click="savedCardSize = { width: 600, height: 600 }"
                >
                  1:1 (600×600)
                </Button>
              </div>

              <div
                v-if="settingDraft"
                class="flex-between p-3 rounded-lg border border-border/80 bg-muted/30"
              >
                <div class="flex flex-col">
                  <strong class="text-xs">实时滚动同步</strong>
                  <small class="text-[11px] text-muted-foreground">{{ syncStatusText }}</small>
                </div>
                <Switch v-model:checked="settingDraft.syncScroll" />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </aside>
    </main>
  </TooltipProvider>
</template>
