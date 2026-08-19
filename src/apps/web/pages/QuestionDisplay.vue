<script setup lang="ts">
import {
  ArrowLeft24Regular,
  ArrowRight24Regular,
  Checkmark24Regular,
  Copy24Regular,
  Dismiss24Regular,
  Save24Regular,
} from '@vicons/fluent'
import { Heart, HeartOutline } from '@vicons/ionicons5'
import { useDebounceFn } from '@vueuse/core'
import {
  NButton,
  NIcon,
  NInput,
  NInputNumber,
  NSlider,
  NSpin,
  NSwitch,
  NTabPane,
  NTabs,
  NTag,
  NTooltip,
  useDialog,
  useMessage,
} from 'naive-ui'
import { computed, onBeforeUnmount, onMounted, ref, toRaw, watch } from 'vue'
import { onBeforeRouteLeave, useRouter } from 'vue-router'

import { useAccount } from '@/api/account'
import type { Setting_QuestionDisplay } from '@/api/api-models'
import { QueryPostAPI } from '@/api/query'
import QuestionDisplayQueue from '@/apps/web/components/question-display/QuestionDisplayQueue.vue'
import QuestionDisplayStylePanel from '@/apps/web/components/question-display/QuestionDisplayStylePanel.vue'
import QuestionDisplayCard from '@/shared/components/QuestionDisplayCard.vue'
import { CURRENT_HOST, QUESTION_API_URL } from '@/shared/config'
import { normalizeQuestionDisplaySetting } from '@/shared/questionDisplay'
import { usePersistedStorage } from '@/shared/storage/persist'
import { copyToClipboard } from '@/shared/utils'
import { useQuestionBox } from '@/store/useQuestionBox'
import { useWebRTC } from '@/store/useRTC'

const router = useRouter()
const message = useMessage()
const dialog = useDialog()
const accountInfo = useAccount()
const questionBox = useQuestionBox()
const rtc = useWebRTC()

const settingDraft = ref<Setting_QuestionDisplay>()
const previewSetting = computed(() => normalizeQuestionDisplaySetting(settingDraft.value))
const saving = ref(false)
const settingsReady = computed(() => Boolean(accountInfo.value?.settings))
const savedCardSize = usePersistedStorage('Settings.QuestionDisplay.CardSize', { width: 720, height: 480 })
const previewScale = usePersistedStorage('Settings.QuestionDisplay.PreviewScale', 70)
const obsUrl = computed(() => `${CURRENT_HOST}obs/question-display?token=${accountInfo.value?.token ?? ''}`)
const normalizedPreviewScale = computed(() => Math.max(40, Math.min(100, previewScale.value)))
const previewShellStyle = computed(() => ({
  width: `${Math.round((savedCardSize.value.width * normalizedPreviewScale.value) / 100)}px`,
  height: `${Math.round((savedCardSize.value.height * normalizedPreviewScale.value) / 100)}px`,
}))
const previewStyle = computed(() => ({
  width: `${savedCardSize.value.width}px`,
  height: `${savedCardSize.value.height}px`,
  transform: `scale(${normalizedPreviewScale.value / 100})`,
}))

const searchKeyword = ref('')
const displayTag = ref<string>()
const onlyUnread = ref(false)
const onlyFavorite = ref(false)

const filteredQuestions = computed(() => {
  const keyword = searchKeyword.value.trim().toLowerCase()
  return questionBox.recieveQuestions
    .filter(
      (item) =>
        (!item.reviewResult || item.reviewResult.isApproved === true) &&
        (!onlyFavorite.value || item.isFavorite) &&
        (!onlyUnread.value || !item.isReaded) &&
        (!displayTag.value || item.tag === displayTag.value) &&
        (!keyword || item.question?.message?.toLowerCase().includes(keyword)),
    )
    .toSorted((a, b) => {
      if (a.isReaded !== b.isReaded) return a.isReaded ? 1 : -1
      return b.sendAt - a.sendAt
    })
})

const currentIndex = computed(() =>
  filteredQuestions.value.findIndex((item) => item.id === questionBox.displayQuestion?.id),
)
const rtcStatusText = computed(() => {
  if (rtc.status === 'ready') return '通道已就绪'
  if (rtc.status === 'error') return rtc.lastError || '同步通道不可用'
  if (rtc.status === 'connecting') return '正在连接同步通道'
  return '等待同步通道'
})
let resizeStart: { x: number; y: number; width: number; height: number } | undefined

const hasUnsavedChanges = computed(() => {
  const saved = accountInfo.value?.settings?.questionDisplay
  if (!saved || !settingDraft.value) return false
  return (
    JSON.stringify(normalizeQuestionDisplaySetting(saved)) !==
    JSON.stringify(normalizeQuestionDisplaySetting(settingDraft.value))
  )
})

watch(
  () => accountInfo.value?.settings?.questionDisplay,
  (value) => {
    if (!value || hasUnsavedChanges.value) return
    settingDraft.value = normalizeQuestionDisplaySetting(value)
  },
  { immediate: true, deep: true },
)

const syncScroll = useDebounceFn((progress: number) => {
  if (settingDraft.value?.syncScroll) rtc.send('function.question.sync-scroll', progress)
}, 80)

function resizePreview(event: PointerEvent) {
  if (!resizeStart) return
  const scale = normalizedPreviewScale.value / 100
  savedCardSize.value = {
    width: Math.round(Math.max(240, Math.min(3840, resizeStart.width + (event.clientX - resizeStart.x) / scale))),
    height: Math.round(Math.max(180, Math.min(2160, resizeStart.height + (event.clientY - resizeStart.y) / scale))),
  }
}

function stopPreviewResize() {
  resizeStart = undefined
  window.removeEventListener('pointermove', resizePreview)
  window.removeEventListener('pointerup', stopPreviewResize)
}

function startPreviewResize(event: PointerEvent) {
  event.preventDefault()
  resizeStart = {
    x: event.clientX,
    y: event.clientY,
    width: savedCardSize.value.width,
    height: savedCardSize.value.height,
  }
  window.addEventListener('pointermove', resizePreview)
  window.addEventListener('pointerup', stopPreviewResize, { once: true })
}

function confirmLeave(): Promise<boolean> {
  return new Promise((resolve) => {
    dialog.warning({
      title: '离开提问展示',
      content: '有未保存的展示设置，离开后会丢失。',
      positiveText: '离开',
      negativeText: '继续编辑',
      onPositiveClick: () => resolve(true),
      onNegativeClick: () => resolve(false),
      onClose: () => resolve(false),
    })
  })
}

function goBack() {
  void router.push({ name: 'manage-questionBox' })
}

function onBeforeUnload(event: BeforeUnloadEvent) {
  if (!hasUnsavedChanges.value) return
  event.preventDefault()
  event.returnValue = ''
}

async function saveSettings() {
  if (!settingDraft.value || !accountInfo.value) return
  const payload = normalizeQuestionDisplaySetting(settingDraft.value)
  saving.value = true
  try {
    const response = await QueryPostAPI(`${QUESTION_API_URL}update-setting`, payload)
    if (response.code !== 200) throw new Error(response.message)
    settingDraft.value = payload
    accountInfo.value.settings.questionDisplay = structuredClone(toRaw(payload))
    message.success('展示设置已保存')
  } catch (error) {
    message.error(error instanceof Error ? error.message : '保存失败')
  } finally {
    saving.value = false
  }
}

function adjacentQuestion(direction: -1 | 1) {
  const questions = filteredQuestions.value
  if (!questions.length) return
  const start = currentIndex.value < 0 ? (direction > 0 ? -1 : 0) : currentIndex.value
  const index = (start + direction + questions.length) % questions.length
  void questionBox.setCurrentQuestion(questions[index])
}

function nextUnread() {
  const questions = filteredQuestions.value
  const currentId = questionBox.displayQuestion?.id
  const current = currentIndex.value
  const ordered = [...questions.slice(current + 1), ...questions.slice(0, Math.max(current, 0))]
  const next = ordered.find((item) => !item.isReaded && item.id !== currentId)
  if (next) void questionBox.setCurrentQuestion(next)
  else message.info('当前筛选范围内没有未读提问')
}

function markCurrentRead() {
  if (questionBox.displayQuestion) void questionBox.read(questionBox.displayQuestion, true)
}

function toggleCurrentFavorite() {
  const current = questionBox.displayQuestion
  if (current) void questionBox.favorite(current, !current.isFavorite)
}

async function copyObsUrl() {
  await copyToClipboard(obsUrl.value)
  message.success('OBS 链接已复制')
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
  void rtc.Init('master', { timeoutMs: 5000 }).catch((error) => {
    console.warn('[QuestionDisplay] RTC 滚动同步不可用', error)
  })
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', onBeforeUnload)
  stopPreviewResize()
})
</script>

<template>
  <main class="display-workbench">
    <QuestionDisplayQueue
      v-model:search="searchKeyword"
      v-model:tag="displayTag"
      v-model:only-unread="onlyUnread"
      v-model:only-favorite="onlyFavorite"
      :questions="filteredQuestions"
      :current-id="questionBox.displayQuestion?.id"
      :tags="questionBox.tags.map((item) => item.name)"
      :loading="questionBox.isLoading"
      @refresh="questionBox.GetRecieveQAInfo"
      @show="questionBox.setCurrentQuestion"
      @clear="questionBox.clearCurrentQuestion"
      @read="questionBox.read($event, true)"
      @favorite="questionBox.favorite"
    />

    <section class="stage-panel">
      <header class="stage-toolbar">
        <div class="stage-title">
          <NButton
            quaternary
            circle
            aria-label="返回提问箱管理"
            @click="goBack"
          >
            <template #icon><NIcon :component="ArrowLeft24Regular" /></template>
          </NButton>
          <div>
            <strong>画面预览</strong>
            <span>{{ savedCardSize.width }} × {{ savedCardSize.height }}</span>
          </div>
        </div>
        <div class="stage-toolbar-actions">
          <label class="preview-scale-control">
            <span>预览 {{ normalizedPreviewScale }}%</span>
            <NSlider
              v-model:value="previewScale"
              :min="40"
              :max="100"
              :step="5"
              :tooltip="false"
              aria-label="预览缩放比例"
            />
          </label>
          <NTag
            :type="questionBox.displayQuestion ? 'success' : 'default'"
            :bordered="false"
            size="small"
          >
            {{ questionBox.displayQuestion ? '正在展示' : '画面已清空' }}
          </NTag>
        </div>
      </header>

      <div class="stage-viewport">
        <div
          class="preview-frame-shell"
          :style="previewShellStyle"
        >
          <div
            class="preview-frame"
            :style="previewStyle"
          >
            <QuestionDisplayCard
              :question="questionBox.displayQuestion"
              :setting="previewSetting"
              :status="questionBox.displayQuestion ? 'ready' : 'empty'"
              @scroll="syncScroll"
            />
          </div>
          <NTooltip>
            <template #trigger>
              <button
                type="button"
                class="preview-resize-handle"
                aria-label="拖动调整 OBS 画布大小"
                @pointerdown="startPreviewResize"
              />
            </template>
            拖动调整 OBS 画布大小
          </NTooltip>
        </div>
      </div>

      <footer class="stage-actions">
        <NTooltip>
          <template #trigger>
            <NButton
              circle
              secondary
              aria-label="上一条提问"
              @click="adjacentQuestion(-1)"
            >
              <template #icon><NIcon :component="ArrowLeft24Regular" /></template>
            </NButton>
          </template>
          上一条提问
        </NTooltip>
        <NButton
          type="error"
          secondary
          :disabled="!questionBox.displayQuestion"
          @click="questionBox.clearCurrentQuestion"
        >
          <template #icon><NIcon :component="Dismiss24Regular" /></template>
          清空画面
        </NButton>
        <NButton
          type="primary"
          @click="nextUnread"
        >
          下一条未读
          <template #icon><NIcon :component="ArrowRight24Regular" /></template>
        </NButton>
        <NTooltip>
          <template #trigger>
            <NButton
              circle
              secondary
              aria-label="下一条提问"
              @click="adjacentQuestion(1)"
            >
              <template #icon><NIcon :component="ArrowRight24Regular" /></template>
            </NButton>
          </template>
          下一条提问
        </NTooltip>
        <span class="action-separator" />
        <NButton
          secondary
          :disabled="!questionBox.displayQuestion || questionBox.displayQuestion.isReaded"
          @click="markCurrentRead"
        >
          <template #icon><NIcon :component="Checkmark24Regular" /></template>
          已读
        </NButton>
        <NButton
          secondary
          :disabled="!questionBox.displayQuestion"
          @click="toggleCurrentFavorite"
        >
          <template #icon>
            <NIcon :component="questionBox.displayQuestion?.isFavorite ? Heart : HeartOutline" />
          </template>
          {{ questionBox.displayQuestion?.isFavorite ? '已收藏' : '收藏' }}
        </NButton>
      </footer>
    </section>

    <aside class="settings-panel">
      <header class="settings-heading">
        <div>
          <strong>展示设置</strong>
          <span>{{ hasUnsavedChanges ? '有未保存修改' : '已保存' }}</span>
        </div>
        <NButton
          type="primary"
          size="small"
          :loading="saving"
          :disabled="!hasUnsavedChanges"
          @click="saveSettings"
        >
          <template #icon><NIcon :component="Save24Regular" /></template>
          保存
        </NButton>
      </header>

      <div class="settings-scroll">
        <NSpin :show="!settingsReady">
          <NTabs
            type="line"
            animated
            pane-style="padding: 14px 0 0;"
          >
            <NTabPane
              name="style"
              tab="外观"
            >
              <QuestionDisplayStylePanel
                v-if="settingDraft"
                v-model="settingDraft"
              />
            </NTabPane>
            <NTabPane
              name="obs"
              tab="OBS"
            >
              <div class="obs-settings">
                <label>
                  <span>浏览器源链接</span>
                  <NInput
                    readonly
                    type="password"
                    show-password-on="click"
                    :value="obsUrl"
                  >
                    <template #suffix>
                      <NButton
                        text
                        aria-label="复制 OBS 链接"
                        @click="copyObsUrl"
                      >
                        <template #icon><NIcon :component="Copy24Regular" /></template>
                      </NButton>
                    </template>
                  </NInput>
                </label>
                <div class="size-fields">
                  <label>
                    <span>宽度</span>
                    <NInputNumber
                      v-model:value="savedCardSize.width"
                      :min="240"
                      :max="3840"
                    />
                  </label>
                  <label>
                    <span>高度</span>
                    <NInputNumber
                      v-model:value="savedCardSize.height"
                      :min="180"
                      :max="2160"
                    />
                  </label>
                </div>
                <div class="size-presets">
                  <NButton
                    size="small"
                    secondary
                    @click="savedCardSize = { width: 720, height: 480 }"
                  >
                    3:2
                  </NButton>
                  <NButton
                    size="small"
                    secondary
                    @click="savedCardSize = { width: 800, height: 450 }"
                  >
                    16:9
                  </NButton>
                  <NButton
                    size="small"
                    secondary
                    @click="savedCardSize = { width: 600, height: 600 }"
                  >
                    1:1
                  </NButton>
                </div>
                <div
                  v-if="settingDraft"
                  class="sync-setting"
                >
                  <span>
                    <strong>实时滚动同步</strong>
                    <small>{{ rtcStatusText }}</small>
                  </span>
                  <NSwitch v-model:value="settingDraft.syncScroll" />
                </div>
              </div>
            </NTabPane>
          </NTabs>
        </NSpin>
      </div>
    </aside>
  </main>
</template>

<style scoped>
.display-workbench {
  display: grid;
  grid-template-columns: minmax(300px, 340px) minmax(420px, 1fr) minmax(300px, 340px);
  grid-template-rows: minmax(0, 1fr);
  width: 100%;
  height: 100dvh;
  min-height: 0;
  overflow: hidden;
  color: var(--vtsuru-fg);
  background: var(--vtsuru-bg);
}

.stage-panel {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  min-width: 0;
  min-height: 0;
}

.stage-toolbar,
.settings-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-width: 0;
  min-height: 61px;
  padding: 10px 16px;
  background: var(--vtsuru-bg-elevated);
  border-bottom: 1px solid var(--vtsuru-border);
}

.stage-title,
.stage-title > div,
.settings-heading > div {
  display: flex;
  min-width: 0;
}

.stage-toolbar-actions {
  display: flex;
  align-items: center;
  gap: 14px;
}

.preview-scale-control {
  display: grid;
  grid-template-columns: auto 104px;
  align-items: center;
  gap: 8px;
  color: var(--vtsuru-fg-muted);
  font-size: 11px;
  white-space: nowrap;
}

.stage-title {
  align-items: center;
  gap: 8px;
}

.stage-title > div,
.settings-heading > div {
  flex-direction: column;
}

.stage-title strong,
.settings-heading strong {
  font-size: 14px;
}

.stage-title span,
.settings-heading span {
  color: var(--vtsuru-fg-muted);
  font-size: 11px;
}

.stage-viewport {
  display: grid;
  min-width: 0;
  min-height: 0;
  padding: clamp(16px, 3vw, 36px);
  overflow: auto;
  background: #202326;
  place-items: center;
}

.preview-frame-shell {
  position: relative;
  max-width: 100%;
  max-height: 100%;
}

.preview-frame {
  position: absolute;
  inset: 0 auto auto 0;
  overflow: hidden;
  background: transparent;
  border: 1px solid rgb(255 255 255 / 14%);
  box-shadow: 0 18px 50px rgb(0 0 0 / 28%);
  transform-origin: top left;
}

.preview-resize-handle {
  position: absolute;
  z-index: 2;
  right: -9px;
  bottom: -9px;
  width: 22px;
  height: 22px;
  padding: 0;
  cursor: nwse-resize;
  background:
    linear-gradient(135deg, transparent 48%, rgb(255 255 255 / 78%) 50% 57%, transparent 59%),
    linear-gradient(135deg, transparent 63%, rgb(255 255 255 / 48%) 65% 72%, transparent 74%);
  border: 0;
  filter: drop-shadow(0 1px 2px rgb(0 0 0 / 55%));
  touch-action: none;
}

.stage-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 64px;
  padding: 10px 16px;
  background: var(--vtsuru-bg-elevated);
  border-top: 1px solid var(--vtsuru-border);
}

.action-separator {
  width: 1px;
  height: 24px;
  margin: 0 2px;
  background: var(--vtsuru-border);
}

.settings-panel {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  min-width: 0;
  min-height: 0;
  background: var(--vtsuru-bg-elevated);
  border-left: 1px solid var(--vtsuru-border);
}

.settings-scroll {
  min-height: 0;
  padding: 0 16px 24px;
  overflow: auto;
}

.obs-settings {
  display: grid;
  gap: 16px;
}

.obs-settings label,
.size-fields label {
  display: grid;
  gap: 6px;
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
}

.size-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.size-presets {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}

.sync-setting {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px;
  background: var(--vtsuru-bg-muted);
  border: 1px solid var(--vtsuru-border);
  border-radius: 6px;
}

.sync-setting > span {
  display: grid;
}

.sync-setting strong {
  font-size: 13px;
}

.sync-setting small {
  color: var(--vtsuru-fg-muted);
  font-size: 11px;
}

@media (max-width: 1120px) {
  .display-workbench {
    grid-template-columns: minmax(260px, 320px) minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr) minmax(360px, 42dvh);
  }

  .settings-panel {
    grid-column: 1 / -1;
    min-height: 0;
    border-top: 1px solid var(--vtsuru-border);
    border-left: 0;
  }
}

@media (max-width: 760px) {
  .display-workbench {
    display: flex;
    flex-direction: column;
    height: auto;
    min-height: 100dvh;
    overflow: visible;
  }

  :deep(.queue-panel) {
    flex: none;
    height: min(520px, 56dvh);
    min-height: 360px;
    border-right: 0;
  }

  .stage-panel {
    min-height: 520px;
  }

  .settings-panel {
    min-height: 0;
    max-height: none;
  }

  .settings-scroll {
    overflow: visible;
  }

  .stage-viewport {
    min-height: 320px;
    padding: 16px;
  }

  .stage-toolbar {
    flex-wrap: wrap;
    gap: 8px;
  }

  .stage-toolbar-actions {
    width: 100%;
    justify-content: space-between;
  }

  .preview-scale-control {
    grid-template-columns: auto minmax(100px, 1fr);
    width: min(240px, 70%);
  }

  .action-separator {
    display: none;
  }
}
</style>
