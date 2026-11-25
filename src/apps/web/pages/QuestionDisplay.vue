<script setup lang="ts">
import { useElementSize, useThrottleFn, useWindowSize } from '@vueuse/core'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  Heart,
  Image as ImageIcon,
  MessageSquareReply,
  PanelLeft,
  PanelLeftClose,
  PanelRight,
  PanelRightClose,
  Save,
  Shuffle,
  Undo2,
  X,
} from 'lucide-vue-next'
import { computed, onBeforeUnmount, onMounted, ref, toRaw, watch } from 'vue'
import { useRouter } from 'vue-router'

import { useAccount } from '@/api/account'
import type { ResponseQAInfoToTarget, SettingQuestionDisplay } from '@/api/generated/model'
import { postApiQaUpdateSetting } from '@/api/generated/qa/qa'
import QuestionBoxReplyModal from '@/apps/manage/components/question-box/QuestionBoxReplyModal.vue'
import QuestionDisplayQueue from '@/apps/web/components/question-display/QuestionDisplayQueue.vue'
import QuestionDisplayStylePanel from '@/apps/web/components/question-display/QuestionDisplayStylePanel.vue'
import QuestionDisplayCard from '@/shared/components/QuestionDisplayCard.vue'
import { useUnsavedChangesGuard } from '@/shared/composables/useUnsavedChangesGuard'
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
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'
import { SettingRow } from '@/shared/ui/setting-row'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/shared/ui/sheet'
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

const { width: windowWidth } = useWindowSize()
const isCompactLayout = computed(() => windowWidth.value < 1180)
const mobileQueueOpen = ref(false)
const mobileSettingsOpen = ref(false)
const replyModalVisible = ref(false)

watch(isCompactLayout, (compact) => {
  if (!compact) {
    mobileQueueOpen.value = false
    mobileSettingsOpen.value = false
  }
})

const stageViewportRef = ref<HTMLElement>()
const { width: viewportWidth, height: viewportHeight } = useElementSize(stageViewportRef)

const settingDraft = ref<SettingQuestionDisplay>(createDefaultQuestionDisplaySetting())
const previewSetting = computed(() => normalizeQuestionDisplaySetting(settingDraft.value))
const saving = ref(false)
const settingsReady = computed(() => Boolean(accountInfo.value?.settings))
const savedCardSize = usePersistedStorage('Settings.QuestionDisplay.CardSize', { width: 720, height: 480 })
const autoMarkRead = usePersistedStorage('Settings.QuestionDisplay.AutoMarkRead', false)
const showPreviewScrollbar = usePersistedStorage('vtsuru:settings:question-display:show-scrollbar', true)
const syncImagePreview = usePersistedStorage('Settings.QuestionDisplay.SyncImagePreview', true)
const isQueueCollapsed = usePersistedStorage('Settings.QuestionDisplay.QueueCollapsed', false)
const isSettingsCollapsed = usePersistedStorage('Settings.QuestionDisplay.SettingsCollapsed', false)
const playlistIds = usePersistedStorage<number[]>('Settings.QuestionDisplay.PlaylistIds', [])

// 同步到 OBS 的当前打开大图索引
const activeImageIndex = ref<number | null>(null)

const obsUrl = computed(() =>
  buildObsSourceUrl({
    path: 'obs/question-display',
    host: CURRENT_HOST,
    credential: 'public-id',
    userId: accountInfo.value?.id,
  }),
)

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
const onlyPlaylist = ref(false)

const filteredQuestions = computed(() => {
  const keyword = searchKeyword.value.trim().toLowerCase()
  const base = questionBox.recieveQuestions.filter(
    (item) =>
      (!item.reviewResult || item.reviewResult.isApproved === true) &&
      (!onlyFavorite.value || item.isFavorite) &&
      (!onlyUnread.value || !item.isReaded) &&
      (!onlyUnreplied.value || !item.answer) &&
      (!displayTag.value || item.tag === displayTag.value) &&
      (!keyword || item.question?.message?.toLowerCase().includes(keyword)),
  )

  if (onlyPlaylist.value) {
    const orderMap = new Map(playlistIds.value.map((id, idx) => [id, idx]))
    return base
      .filter((item) => orderMap.has(item.id))
      .toSorted((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0))
  }

  return base.toSorted((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
    if (a.isReaded !== b.isReaded) return a.isReaded ? 1 : -1
    return b.sendAt - a.sendAt
  })
})

const currentImages = computed(() =>
  (questionBox.displayQuestion?.questionImages ?? []).filter((img) => Boolean(img?.path)),
)

const syncStatusText = computed(() => {
  if (realtimeStatus.value.connected) return '通道已就绪'
  if (realtimeStatus.value.error) return realtimeStatus.value.error
  if (realtimeStatus.value.connecting) return '正在连接同步通道'
  return '等待同步通道'
})

function togglePlaylist(id: number) {
  const idx = playlistIds.value.indexOf(id)
  if (idx >= 0) {
    playlistIds.value = playlistIds.value.filter((item) => item !== id)
  } else {
    playlistIds.value = [...playlistIds.value, id]
  }
}

function clearPlaylist() {
  playlistIds.value = []
  onlyPlaylist.value = false
}

function broadcastImagePreview(index: number | null) {
  if (!syncImagePreview.value || !qaTopic.value) return
  void publishQaEvent('ImagePreview', {
    questionId: questionBox.displayQuestion?.id ?? null,
    index,
  }).catch((error) => {
    console.warn('[QuestionDisplay] 图片预览同步发送失败', error)
  })
}

function setActiveImagePreview(index: number | null) {
  activeImageIndex.value = index
  broadcastImagePreview(index)
}

watch(
  () => questionBox.displayQuestion?.id,
  () => {
    if (activeImageIndex.value !== null) {
      activeImageIndex.value = null
      broadcastImagePreview(null)
    }
  },
)

watch(syncImagePreview, (enabled) => {
  if (!enabled) {
    if (qaTopic.value) {
      void publishQaEvent('ImagePreview', { questionId: questionBox.displayQuestion?.id ?? null, index: null }).catch(() => {})
    }
  } else if (activeImageIndex.value !== null) {
    broadcastImagePreview(activeImageIndex.value)
  }
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

function goBack() {
  void router.push({ name: 'manage-questionBox' })
}

useUnsavedChangesGuard(hasUnsavedChanges, '有未保存的展示设置，离开后会丢失，确定要离开吗？')

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
  if (isCompactLayout.value) {
    mobileQueueOpen.value = false
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

function randomQuestion() {
  const pool = filteredQuestions.value.filter((q) => q.id !== questionBox.displayQuestion?.id)
  const candidates = pool.length ? pool : filteredQuestions.value
  if (!candidates.length) {
    toast.info('当前筛选范围内没有可抽取的提问')
    return
  }
  const picked = candidates[Math.floor(Math.random() * candidates.length)]
  void showQuestion(picked)
}

function toggleCurrentRead() {
  const current = questionBox.displayQuestion
  if (current) {
    void questionBox.read(current, !current.isReaded)
  }
}

function toggleCurrentFavorite() {
  const current = questionBox.displayQuestion
  if (current) {
    void questionBox.favorite(current, !current.isFavorite)
  }
}

function openQuickReply() {
  const current = questionBox.displayQuestion
  if (!current) return
  questionBox.currentQuestion = current
  replyModalVisible.value = true
}

async function copyObsUrl() {
  if (!obsUrl.value) {
    toast.error('请先登录后再复制 OBS 链接')
    return
  }
  await copyToClipboard(obsUrl.value)
  toast.success('OBS 链接已复制')
}

function handleKeydown(event: KeyboardEvent) {
  if (replyModalVisible.value) return
  const target = event.target as HTMLElement | null
  const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)

  if (isInput) return

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
    event.preventDefault()
    if (canManualSync.value && !saving.value) {
      void saveSettings()
    }
    return
  }

  // 当正在放大展示附图时，优先用 Escape 关闭大图、左右键切换图片
  if (activeImageIndex.value !== null) {
    if (event.key === 'Escape') {
      event.preventDefault()
      setActiveImagePreview(null)
      return
    }
    if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && currentImages.value.length > 1) {
      event.preventDefault()
      const delta = event.key === 'ArrowRight' ? 1 : -1
      const next = (activeImageIndex.value + delta + currentImages.value.length) % currentImages.value.length
      setActiveImagePreview(next)
      return
    }
  }

  if (event.key === 'ArrowLeft' || event.key === 'k') {
    event.preventDefault()
    adjacentQuestion(-1)
  } else if (event.key === 'ArrowRight' || event.key === 'j') {
    event.preventDefault()
    adjacentQuestion(1)
  } else if (event.key.toLowerCase() === 'n') {
    event.preventDefault()
    nextUnread()
  } else if (event.key.toLowerCase() === 'x') {
    event.preventDefault()
    randomQuestion()
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
    toggleCurrentRead()
  } else if (event.key.toLowerCase() === 'f') {
    event.preventDefault()
    toggleCurrentFavorite()
  }
}

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
  window.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  clearAutoSaveTimer()
  window.removeEventListener('keydown', handleKeydown)
  stopPreviewResize()
})
</script>

<template>
  <TooltipProvider>
    <main class="flex w-full h-dvh min-h-0 overflow-hidden text-foreground bg-background">
      <!-- 桌面端左侧队列 -->
      <div
        v-if="!isCompactLayout && !isQueueCollapsed"
        class="w-[320px] shrink-0 h-full min-h-0"
      >
        <QuestionDisplayQueue
          v-model:search="searchKeyword"
          v-model:tag="displayTag"
          v-model:only-unread="onlyUnread"
          v-model:only-favorite="onlyFavorite"
          v-model:only-unreplied="onlyUnreplied"
          v-model:only-playlist="onlyPlaylist"
          :questions="filteredQuestions"
          :current-id="questionBox.displayQuestion?.id"
          :tags="questionBox.tags.map((item) => item.name)"
          :loading="questionBox.isLoading"
          :playlist-ids="playlistIds"
          @refresh="questionBox.GetRecieveQAInfo"
          @show="showQuestion"
          @clear="questionBox.clearCurrentQuestion"
          @read="questionBox.read"
          @favorite="questionBox.favorite"
          @toggle-playlist="togglePlaylist"
          @clear-playlist="clearPlaylist"
        />
      </div>

      <!-- 中央预览与播控舞台 -->
      <section class="stage-panel flex-1 grid grid-rows-[auto_minmax(0,1fr)_auto] min-w-0 min-h-0">
        <header class="stage-toolbar flex-between min-h-14 px-3.5 gap-2 bg-card border-b border-border flex-wrap">
          <div class="stage-title flex items-center gap-2 min-w-0">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="返回提问箱管理"
              @click="goBack"
            >
              <ArrowLeft class="size-4" />
            </Button>

            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="切换提问队列"
                  @click="isCompactLayout ? (mobileQueueOpen = true) : (isQueueCollapsed = !isQueueCollapsed)"
                >
                  <PanelLeft
                    v-if="isCompactLayout || isQueueCollapsed"
                    class="size-4"
                  />
                  <PanelLeftClose
                    v-else
                    class="size-4"
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{{ isCompactLayout || isQueueCollapsed ? '展开提问队列' : '折叠提问队列' }}</TooltipContent>
            </Tooltip>

            <div class="flex flex-col min-w-0">
              <strong class="text-sm font-semibold truncate">展示展板</strong>
              <span class="stage-meta-dims text-[11px] text-muted-foreground font-mono tabular-nums">
                {{ savedCardSize.width }} × {{ savedCardSize.height }}
                <em class="not-italic opacity-80">(自适应 {{ Math.round(autoFitScale * 100) }}%)</em>
              </span>
            </div>
          </div>

          <div class="stage-toolbar-actions flex items-center gap-1.5 flex-wrap">
            <!-- 图片同步放大提示与快捷切换 -->
            <div
              v-if="currentImages.length > 0"
              class="flex items-center gap-1"
            >
              <Button
                v-if="activeImageIndex !== null"
                size="xs"
                variant="default"
                class="gap-1"
                @click="setActiveImagePreview(null)"
              >
                <ImageIcon class="size-3.5" />
                附图放大中 {{ activeImageIndex + 1 }}/{{ currentImages.length }}
                <X class="size-3 ml-0.5" />
              </Button>
              <Button
                v-else
                size="xs"
                variant="outline"
                class="gap-1"
                @click="setActiveImagePreview(0)"
              >
                <ImageIcon class="size-3.5" />
                放大附图 ({{ currentImages.length }})
              </Button>
            </div>

            <Button
              variant="outline"
              class="gap-1.5"
              aria-label="复制 OBS 浏览器源链接"
              @click="copyObsUrl"
            >
              <Copy class="size-3.5" />
              复制 OBS 链接
            </Button>

            <Badge
              :variant="questionBox.displayQuestion ? 'default' : 'secondary'"
              size="xs"
            >
              {{ questionBox.displayQuestion ? '正在展示' : '画面已清空' }}
            </Badge>

            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  :aria-label="isCompactLayout || isSettingsCollapsed ? '展开设置面板' : '折叠设置面板'"
                  @click="isCompactLayout ? (mobileSettingsOpen = true) : (isSettingsCollapsed = !isSettingsCollapsed)"
                >
                  <PanelRight
                    v-if="isCompactLayout || isSettingsCollapsed"
                    class="size-4"
                  />
                  <PanelRightClose
                    v-else
                    class="size-4"
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{{ isCompactLayout || isSettingsCollapsed ? '展开展示设置' : '折叠展示设置' }}</TooltipContent>
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
                :interactive-images="true"
                :active-image-index="activeImageIndex"
                @scroll="syncScroll"
                @image-preview-change="setActiveImagePreview"
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

        <footer class="stage-actions flex-between gap-2 flex-wrap p-3 bg-card border-t border-border text-xs">
          <div class="actions-left flex items-center gap-1.5 flex-wrap">
            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="上一条提问 (快捷键 ← / K)"
                  @click="adjacentQuestion(-1)"
                >
                  <ArrowLeft class="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>上一条提问 (← / K)</TooltipContent>
            </Tooltip>

            <Button
              variant="outline"
              class="text-destructive hover:bg-destructive/10 gap-1"
              :disabled="!questionBox.displayQuestion"
              @click="questionBox.clearCurrentQuestion"
            >
              <X class="size-3.5" />
              清空 (Space)
            </Button>

            <Button
              class="gap-1"
              @click="nextUnread"
            >
              下一条未读 (N)
              <ArrowRight class="size-3.5" />
            </Button>

            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="下一条提问 (快捷键 → / J)"
                  @click="adjacentQuestion(1)"
                >
                  <ArrowRight class="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>下一条提问 (→ / J)</TooltipContent>
            </Tooltip>

            <Button
              variant="outline"
              class="gap-1"
              :disabled="filteredQuestions.length === 0"
              @click="randomQuestion"
            >
              <Shuffle class="size-3.5" />
              随机抽题 (X)
            </Button>

            <span class="w-px h-4 bg-border mx-0.5 hidden sm:inline-block" />

            <Button
              variant="outline"
              class="gap-1"
              :disabled="!questionBox.displayQuestion"
              @click="toggleCurrentRead"
            >
              <Undo2
                v-if="questionBox.displayQuestion?.isReaded"
                class="size-3.5 text-amber-500"
              />
              <Check
                v-else
                class="size-3.5"
              />
              {{ questionBox.displayQuestion?.isReaded ? '退回未读 (R)' : '标已读 (R)' }}
            </Button>

            <Button
              variant="outline"
              class="gap-1"
              :class="{ 'text-rose-500': questionBox.displayQuestion?.isFavorite }"
              :disabled="!questionBox.displayQuestion"
              @click="toggleCurrentFavorite"
            >
              <Heart
                class="size-3.5"
                :class="{ 'fill-current': questionBox.displayQuestion?.isFavorite }"
              />
              {{ questionBox.displayQuestion?.isFavorite ? '已收藏' : '收藏' }} (F)
            </Button>

            <Button
              variant="outline"
              class="gap-1"
              :disabled="!questionBox.displayQuestion"
              @click="openQuickReply"
            >
              <MessageSquareReply class="size-3.5" />
              {{ questionBox.displayQuestion?.answer ? '修改回复' : '快捷回复' }}
            </Button>
          </div>

          <div class="actions-right flex items-center gap-3 flex-wrap">
            <label class="flex items-center gap-1.5 cursor-pointer text-xs select-none">
              <Checkbox v-model:checked="showPreviewScrollbar" />
              <span>显示滚动条</span>
            </label>
            <label class="flex items-center gap-1.5 cursor-pointer text-xs select-none">
              <Checkbox v-model:checked="autoMarkRead" />
              <span>展示自动已读</span>
            </label>
          </div>
        </footer>
      </section>

      <!-- 桌面端右侧设置面板 -->
      <aside
        v-if="!isCompactLayout && !isSettingsCollapsed"
        class="settings-panel w-[330px] shrink-0 flex flex-col h-full min-h-0 bg-card border-l border-border"
      >
        <header class="settings-heading flex-between min-h-14 px-4 border-b border-border">
          <div class="flex items-center gap-2">
            <strong class="text-sm font-semibold">展示设置</strong>
            <Badge
              :variant="saveError ? 'destructive' : saving || hasUnsavedChanges || needsLegacySync ? 'warning' : 'secondary'"
              size="xs"
            >
              {{
                saving
                  ? '同步中'
                  : saveError
                    ? '同步失败'
                    : hasUnsavedChanges || needsLegacySync
                      ? '待同步'
                      : '已同步'
              }}
            </Badge>
          </div>
          <Button
            class="gap-1"
            :disabled="!canManualSync || saving"
            @click="saveSettings()"
          >
            <Save class="size-3.5" />
            {{ saving ? '同步中' : saveError ? '重试同步' : '立即同步' }}
          </Button>
        </header>

        <div class="settings-scroll flex-1 min-h-0 overflow-y-auto scrollbar-thin p-4">
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
              <FormField label="OBS 浏览器源链接">
                <div class="flex gap-1.5">
                  <Input
                    readonly
                    :model-value="obsUrl"
                    placeholder="登录后可复制 OBS 链接"
                    class="font-mono"
                  />
                  <Button
                    variant="outline"
                    size="icon-sm"
                    class="shrink-0"
                    aria-label="复制 OBS 链接"
                    @click="copyObsUrl"
                  >
                    <Copy class="size-3.5" />
                  </Button>
                </div>
              </FormField>

              <div class="grid grid-cols-2 gap-3">
                <FormField
                  label="画布宽度 (px)"
                  class="min-w-0"
                >
                  <NumberField
                    v-model="savedCardSize.width"
                    :min="240"
                    :max="3840"
                  />
                </FormField>
                <FormField
                  label="画布高度 (px)"
                  class="min-w-0"
                >
                  <NumberField
                    v-model="savedCardSize.height"
                    :min="180"
                    :max="2160"
                  />
                </FormField>
              </div>

              <div class="flex items-center gap-1.5 flex-wrap">
                <Button
                  size="xs"
                  variant="outline"
                  @click="savedCardSize = { width: 720, height: 480 }"
                >
                  3:2 (720×480)
                </Button>
                <Button
                  size="xs"
                  variant="outline"
                  @click="savedCardSize = { width: 800, height: 450 }"
                >
                  16:9 (800×450)
                </Button>
                <Button
                  size="xs"
                  variant="outline"
                  @click="savedCardSize = { width: 600, height: 600 }"
                >
                  1:1 (600×600)
                </Button>
              </div>

              <SettingRow
                v-if="settingDraft"
                title="实时滚动同步"
                :description="syncStatusText"
                variant="card"
              >
                <Switch v-model:checked="settingDraft.syncScroll" />
              </SettingRow>

              <SettingRow
                title="同步图片放大展示"
                description="在展板点开或切换附图时，OBS 同步放大展示该图片"
                variant="card"
              >
                <Switch v-model:checked="syncImagePreview" />
              </SettingRow>
            </TabsContent>
          </Tabs>
        </div>
      </aside>
    </main>

    <!-- 窄屏模式抽屉：队列 -->
    <Sheet v-model:open="mobileQueueOpen">
      <SheetContent
        side="left"
        class="p-0 w-[320px] max-w-[88vw]"
      >
        <QuestionDisplayQueue
          v-model:search="searchKeyword"
          v-model:tag="displayTag"
          v-model:only-unread="onlyUnread"
          v-model:only-favorite="onlyFavorite"
          v-model:only-unreplied="onlyUnreplied"
          v-model:only-playlist="onlyPlaylist"
          :questions="filteredQuestions"
          :current-id="questionBox.displayQuestion?.id"
          :tags="questionBox.tags.map((item) => item.name)"
          :loading="questionBox.isLoading"
          :playlist-ids="playlistIds"
          @refresh="questionBox.GetRecieveQAInfo"
          @show="showQuestion"
          @clear="questionBox.clearCurrentQuestion"
          @read="questionBox.read"
          @favorite="questionBox.favorite"
          @toggle-playlist="togglePlaylist"
          @clear-playlist="clearPlaylist"
        />
      </SheetContent>
    </Sheet>

    <!-- 窄屏模式抽屉：设置 -->
    <Sheet v-model:open="mobileSettingsOpen">
      <SheetContent
        side="right"
        class="w-[340px] max-w-[90vw] flex flex-col p-0"
      >
        <SheetHeader class="p-4 border-b border-border flex-row items-center justify-between space-y-0">
          <SheetTitle class="text-sm">展示设置</SheetTitle>
          <Button
            size="xs"
            class="gap-1"
            :disabled="!canManualSync || saving"
            @click="saveSettings()"
          >
            <Save class="size-3.5" />
            立即同步
          </Button>
        </SheetHeader>
        <div class="flex-1 min-h-0 overflow-y-auto scrollbar-thin p-4">
          <Tabs
            v-if="settingsReady"
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
              <FormField label="OBS 浏览器源链接">
                <div class="flex gap-1.5">
                  <Input
                    readonly
                    :model-value="obsUrl"
                    class="font-mono"
                  />
                  <Button
                    variant="outline"
                    size="icon-sm"
                    class="shrink-0"
                    @click="copyObsUrl"
                  >
                    <Copy class="size-3.5" />
                  </Button>
                </div>
              </FormField>
              <SettingRow
                v-if="settingDraft"
                title="实时滚动同步"
                :description="syncStatusText"
                variant="card"
              >
                <Switch v-model:checked="settingDraft.syncScroll" />
              </SettingRow>
              <SettingRow
                title="同步图片放大展示"
                description="点开或切换附图时同步到 OBS"
                variant="card"
              >
                <Switch v-model:checked="syncImagePreview" />
              </SettingRow>
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>

    <QuestionBoxReplyModal v-model:show="replyModalVisible" />
  </TooltipProvider>
</template>
