<script setup lang="ts">
import {
  ArrowLeft24Regular,
  ArrowRight24Regular,
  Checkmark24Regular,
  Copy24Regular,
  Dismiss24Regular,
  PanelRight24Regular,
  PanelRightContract24Regular,
  Save24Regular,
} from '@vicons/fluent'
import { Heart, HeartOutline } from '@vicons/ionicons5'
import { useDebounceFn, useElementSize } from '@vueuse/core'
import {
  NButton,
  NCheckbox,
  NIcon,
  NInput,
  NInputNumber,
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
import type { QAInfo, Setting_QuestionDisplay } from '@/api/api-models'
import { QueryPostAPI } from '@/api/query'
import QuestionDisplayQueue from '@/apps/web/components/question-display/QuestionDisplayQueue.vue'
import QuestionDisplayStylePanel from '@/apps/web/components/question-display/QuestionDisplayStylePanel.vue'
import QuestionDisplayCard from '@/shared/components/QuestionDisplayCard.vue'
import { CURRENT_HOST, QUESTION_API_URL } from '@/shared/config'
import { buildObsSourceUrl } from '@/shared/obs/obsUrl'
import {
  getAdjacentQuestion,
  getNextUnreadQuestion,
  normalizeQuestionDisplaySetting,
} from '@/shared/questionDisplay'
import { createDefaultQuestionDisplaySetting } from '@/shared/questionDisplayPresets'
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

const stageViewportRef = ref<HTMLElement>()
const { width: viewportWidth, height: viewportHeight } = useElementSize(stageViewportRef)

// 默认 fallback 为棉花糖预设
const settingDraft = ref<Setting_QuestionDisplay>(createDefaultQuestionDisplaySetting())
const previewSetting = computed(() => normalizeQuestionDisplaySetting(settingDraft.value))
const saving = ref(false)
const settingsReady = computed(() => Boolean(accountInfo.value?.settings))
const savedCardSize = usePersistedStorage('Settings.QuestionDisplay.CardSize', { width: 720, height: 480 })
const autoMarkRead = usePersistedStorage('Settings.QuestionDisplay.AutoMarkRead', false)
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
  // 留出 48px padding 安全间隙
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

const rtcStatusText = computed(() => {
  if (rtc.status === 'ready') return '通道已就绪'
  if (rtc.status === 'error') return rtc.lastError || '同步通道不可用'
  if (rtc.status === 'connecting') return '正在连接同步通道'
  return '等待同步通道'
})

let resizeStart:
  | {
      centerX: number
      centerY: number
      scale: number
    }
  | undefined

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
  if (settingDraft.value?.syncScroll) {
    rtc.send('function.question.sync-scroll', progress)
  }
}, 80)

function resizePreview(event: PointerEvent) {
  if (!resizeStart) return
  // 卡片在视口中央对称居中，把手位于右下角。从中心点到鼠标的水平/垂直距离即为半宽/半高。
  // (event.clientX - centerX) * 2 / scale 精确实现 1:1 跟手，彻底消除居中展开导致的减半迟滞。
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
    message.success('展示设置已保存并同步')
  } catch (error) {
    message.error(error instanceof Error ? error.message : '保存失败')
  } finally {
    saving.value = false
  }
}

async function showQuestion(item: QAInfo) {
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
    message.info('当前筛选范围内没有更多未读提问')
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
    message.error('请先登录后再复制 OBS 链接')
    return
  }
  await copyToClipboard(obsUrl.value)
  message.success('OBS 链接已复制')
}

// 键盘快捷键监听
function handleKeydown(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null
  const isInput =
    target &&
    (target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable ||
      target.classList.contains('n-input__input-el'))

  if (isInput) return

  // Ctrl + S / Cmd + S 保存
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
    event.preventDefault()
    if (hasUnsavedChanges.value && !saving.value) {
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
  void rtc.Init('master', { timeoutMs: 5000 }).catch((error) => {
    console.warn('[QuestionDisplay] RTC 滚动同步不可用', error)
  })
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', onBeforeUnload)
  window.removeEventListener('keydown', handleKeydown)
  stopPreviewResize()
})
</script>

<template>
  <main
    class="display-workbench"
    :class="{ 'is-settings-collapsed': isSettingsCollapsed }"
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
            <strong>展示展板</strong>
            <span class="stage-meta-dims">
              {{ savedCardSize.width }} × {{ savedCardSize.height }}
              <em class="scale-hint">(自适应 {{ Math.round(autoFitScale * 100) }}%)</em>
            </span>
          </div>
        </div>

        <div class="stage-toolbar-actions">
          <NButton
            secondary
            size="small"
            aria-label="复制 OBS 浏览器源链接"
            @click="copyObsUrl"
          >
            <template #icon><NIcon :component="Copy24Regular" /></template>
            复制 OBS 链接
          </NButton>

          <NTag
            :type="questionBox.displayQuestion ? 'success' : 'default'"
            :bordered="false"
            size="small"
          >
            {{ questionBox.displayQuestion ? '正在展示' : '画面已清空' }}
          </NTag>

          <NTooltip>
            <template #trigger>
              <NButton
                circle
                quaternary
                size="small"
                :aria-label="isSettingsCollapsed ? '展开设置面板' : '折叠设置面板'"
                @click="isSettingsCollapsed = !isSettingsCollapsed"
              >
                <template #icon>
                  <NIcon :component="isSettingsCollapsed ? PanelRight24Regular : PanelRightContract24Regular" />
                </template>
              </NButton>
            </template>
            {{ isSettingsCollapsed ? '展开展示设置' : '折叠展示设置' }}
          </NTooltip>
        </div>
      </header>

      <div
        ref="stageViewportRef"
        class="stage-viewport"
      >
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
        <div class="actions-left">
          <NTooltip>
            <template #trigger>
              <NButton
                circle
                secondary
                aria-label="上一条提问 (快捷键 ← / K)"
                @click="adjacentQuestion(-1)"
              >
                <template #icon><NIcon :component="ArrowLeft24Regular" /></template>
              </NButton>
            </template>
            上一条提问 (快捷键 ← / K)
          </NTooltip>

          <NButton
            type="error"
            secondary
            :disabled="!questionBox.displayQuestion"
            @click="questionBox.clearCurrentQuestion"
          >
            <template #icon><NIcon :component="Dismiss24Regular" /></template>
            清空 (Space)
          </NButton>

          <NButton
            type="primary"
            @click="nextUnread"
          >
            下一条未读 (N)
            <template #icon><NIcon :component="ArrowRight24Regular" /></template>
          </NButton>

          <NTooltip>
            <template #trigger>
              <NButton
                circle
                secondary
                aria-label="下一条提问 (快捷键 → / J)"
                @click="adjacentQuestion(1)"
              >
                <template #icon><NIcon :component="ArrowRight24Regular" /></template>
              </NButton>
            </template>
            下一条提问 (快捷键 → / J)
          </NTooltip>

          <span class="action-separator" />

          <NButton
            secondary
            :disabled="!questionBox.displayQuestion || questionBox.displayQuestion.isReaded"
            @click="markCurrentRead"
          >
            <template #icon><NIcon :component="Checkmark24Regular" /></template>
            标已读 (R)
          </NButton>

          <NButton
            secondary
            :disabled="!questionBox.displayQuestion"
            @click="toggleCurrentFavorite"
          >
            <template #icon>
              <NIcon :component="questionBox.displayQuestion?.isFavorite ? Heart : HeartOutline" />
            </template>
            {{ questionBox.displayQuestion?.isFavorite ? '已收藏' : '收藏' }} (F)
          </NButton>
        </div>

        <div class="actions-right">
          <NCheckbox v-model:checked="autoMarkRead">
            展示时自动标已读
          </NCheckbox>
        </div>
      </footer>
    </section>

    <aside
      v-show="!isSettingsCollapsed"
      class="settings-panel"
    >
      <header class="settings-heading">
        <div>
          <strong>展示设置</strong>
          <span :class="{ 'has-unsaved': hasUnsavedChanges }">
            {{ hasUnsavedChanges ? '有未保存修改' : '已同步' }}
          </span>
        </div>
        <NButton
          type="primary"
          size="small"
          :loading="saving"
          :disabled="!hasUnsavedChanges"
          @click="saveSettings"
        >
          <template #icon><NIcon :component="Save24Regular" /></template>
          保存 (Ctrl+S)
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
                  <span>OBS 浏览器源链接</span>
                  <NInput
                    readonly
                    :value="obsUrl"
                    placeholder="登录后可复制 OBS 链接"
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
                    <span>画布宽度 (px)</span>
                    <NInputNumber
                      v-model:value="savedCardSize.width"
                      :min="240"
                      :max="3840"
                    />
                  </label>
                  <label>
                    <span>画布高度 (px)</span>
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
                    3:2 (720×480)
                  </NButton>
                  <NButton
                    size="small"
                    secondary
                    @click="savedCardSize = { width: 800, height: 450 }"
                  >
                    16:9 (800×450)
                  </NButton>
                  <NButton
                    size="small"
                    secondary
                    @click="savedCardSize = { width: 600, height: 600 }"
                  >
                    1:1 (600×600)
                  </NButton>
                </div>

                <div
                  v-if="settingDraft"
                  class="sync-setting"
                >
                  <span>
                    <strong>实时滚动同步 (WebRTC)</strong>
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
  grid-template-columns: minmax(300px, 340px) minmax(420px, 1fr) minmax(310px, 350px);
  grid-template-rows: minmax(0, 1fr);
  width: 100%;
  height: 100dvh;
  min-height: 0;
  overflow: hidden;
  color: var(--vtsuru-fg);
  background: var(--vtsuru-bg);
  transition: grid-template-columns 0.2s ease;
}

.display-workbench.is-settings-collapsed {
  grid-template-columns: minmax(300px, 340px) minmax(420px, 1fr) 0px;
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
  min-height: 56px;
  padding: 8px 16px;
  background: var(--vtsuru-bg-elevated);
  border-bottom: 1px solid var(--vtsuru-border);
}

.stage-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.stage-title div {
  display: flex;
  flex-direction: column;
}

.stage-title strong {
  font-size: 14px;
}

.stage-meta-dims {
  color: var(--vtsuru-fg-muted);
  font-size: 11px;
}

.scale-hint {
  margin-left: 4px;
  font-style: normal;
  opacity: 0.8;
}

.stage-toolbar-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.stage-viewport {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  overflow: hidden;
  background-image: radial-gradient(color-mix(in srgb, var(--vtsuru-fg) 8%, transparent) 1px, transparent 1px);
  background-size: 16px 16px;
}

.preview-frame-shell {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
}

.preview-frame {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: top left;
  box-shadow: 0 12px 36px rgb(0 0 0 / 25%);
}

.preview-resize-handle {
  position: absolute;
  right: -6px;
  bottom: -6px;
  width: 14px;
  height: 14px;
  padding: 0;
  background: var(--vtsuru-brand);
  border: 2px solid var(--vtsuru-bg);
  border-radius: 50%;
  cursor: se-resize;
  transition: transform 0.15s ease;
}

.preview-resize-handle:hover {
  transform: scale(1.3);
}

.stage-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: var(--vtsuru-bg-elevated);
  border-top: 1px solid var(--vtsuru-border);
}

.actions-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.actions-right {
  display: flex;
  align-items: center;
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
}

.action-separator {
  width: 1px;
  height: 20px;
  margin: 0 4px;
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

.settings-heading div {
  display: flex;
  flex-direction: column;
}

.settings-heading strong {
  font-size: 14px;
}

.settings-heading span {
  color: var(--vtsuru-fg-muted);
  font-size: 11px;
}

.settings-heading span.has-unsaved {
  color: #eab308;
}

.settings-scroll {
  padding: 14px 16px;
  overflow-y: auto;
}

.obs-settings {
  display: grid;
  gap: 16px;
}

.obs-settings label {
  display: grid;
  gap: 6px;
  color: var(--vtsuru-fg);
  font-size: 12px;
}

.size-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.size-presets {
  display: flex;
  gap: 6px;
}

.sync-setting {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  background: var(--vtsuru-bg-muted);
  border-radius: 8px;
}

.sync-setting span {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sync-setting strong {
  font-size: 13px;
}

.sync-setting small {
  color: var(--vtsuru-fg-muted);
  font-size: 11px;
}
</style>
