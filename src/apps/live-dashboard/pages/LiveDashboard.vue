<script setup lang="ts">
import { useEventListener, whenever } from '@vueuse/core'
import { NButton, NResult, NSpin } from 'naive-ui'
import { Pane, Splitpanes } from 'splitpanes'
import 'splitpanes/dist/splitpanes.css'
import { computed, onActivated, onDeactivated, onMounted, onUnmounted } from 'vue'

import { isLoadingAccount, isLoggedIn } from '@/api/account'
import { useLiveEmoji } from '@/store/useLiveEmoji'

import DanmakuPanel from '../components/DanmakuPanel.vue'
import DashboardToolbar from '../components/DashboardToolbar.vue'
import ItemContextMenu from '../components/ItemContextMenu.vue'
import PaidPanel from '../components/PaidPanel.vue'
import SaveImageModal from '../components/SaveImageModal.vue'
import SettingsDrawer from '../components/SettingsDrawer.vue'
import ShortcutsModal from '../components/ShortcutsModal.vue'
import UserMenu from '../components/UserMenu.vue'
import VotePanel from '../components/VotePanel.vue'
import type { PanelId } from '../core/types'
import { PANEL_IDS } from '../core/types'
import { DEFAULT_LAYOUT } from '../store/settings'
import { useDashboardUi } from '../store/ui'
import { useLiveDashboard } from '../store/useLiveDashboard'

const dashboard = useLiveDashboard()
const ui = useDashboardUi()
const liveEmoji = useLiveEmoji()
const layout = computed(() => dashboard.settings.layout)

/** 专注模式下隐藏面板原地虚化，否则直接移除 */
const panes = computed(() =>
  layout.value.order
    .filter((id) => layout.value.focusMode || !layout.value.hidden.includes(id))
    .map((id) => ({ id, blurred: layout.value.hidden.includes(id) })),
)

function onResized({ panes: sizes }: { panes: { size: number }[] }) {
  panes.value.forEach((pane, index) => {
    if (sizes[index]) layout.value.sizes[pane.id] = Math.round(sizes[index].size * 10) / 10
  })
}

function resetSizes() {
  layout.value.sizes = { ...DEFAULT_LAYOUT.sizes }
}

function togglePanel(id: PanelId) {
  const hidden = layout.value.hidden
  layout.value.hidden = hidden.includes(id) ? hidden.filter((h) => h !== id) : [...hidden, id]
}

const PANEL_KEYS = Object.fromEntries(PANEL_IDS.map((id, index) => [`Digit${index + 1}`, id])) as Record<string, PanelId>

// 客户端内页面被 KeepAlive 缓存，离开时停用快捷键
let active = true
onActivated(() => (active = true))
onDeactivated(() => (active = false))

useEventListener(window, 'keydown', (e: KeyboardEvent) => {
  if (!active) return
  if ((e.ctrlKey || e.metaKey) && e.code === 'KeyF') {
    e.preventDefault()
    ui.searchFocusTick++
    return
  }
  if (document.activeElement?.closest('input, textarea, [contenteditable="true"]')) return
  if (e.altKey && !e.ctrlKey && !e.metaKey) {
    const settings = dashboard.settings
    const actions: Record<string, () => void> = {
      KeyC: () => (settings.cardMode = !settings.cardMode),
      KeyR: () => (settings.hideRead = !settings.hideRead),
      KeyD: () => ui.toggleTheme(),
    }
    const action = PANEL_KEYS[e.code] ? () => togglePanel(PANEL_KEYS[e.code]) : actions[e.code]
    if (!action) return
    e.preventDefault()
    action()
  } else if (e.key === '?') ui.shortcutsOpen = !ui.shortcutsOpen
})

onMounted(() => {
  void liveEmoji.ensureFresh()
})

whenever(
  () => !isLoadingAccount.value && isLoggedIn.value,
  () => void dashboard.start(),
  { immediate: true, once: true },
)

onUnmounted(() => void dashboard.stop())
</script>

<template>
  <div
    class="live-dashboard"
    :style="{ fontSize: `${dashboard.settings.fontSize}px` }"
  >
    <NSpin
      v-if="isLoadingAccount"
      class="live-dashboard__center"
    />
    <NResult
      v-else-if="!isLoggedIn"
      class="live-dashboard__center"
      status="403"
      title="请先登录"
      description="中控台需要登录并绑定直播间后使用"
    >
      <template #footer>
        <NButton
          type="primary"
          tag="a"
          href="/manage"
        >
          前往登录
        </NButton>
      </template>
    </NResult>
    <template v-else>
      <DashboardToolbar />
      <Splitpanes
        class="live-dashboard__panes dash-split"
        :horizontal="layout.vertical"
        :maximize-panes="false"
        @resized="onResized"
        @splitter-dblclick="resetSizes"
      >
        <Pane
          v-for="pane in panes"
          :key="pane.id"
          :size="layout.sizes[pane.id]"
          :min-size="12"
        >
          <DanmakuPanel
            v-if="pane.id === 'danmaku'"
            :blurred="pane.blurred"
          />
          <VotePanel
            v-else-if="pane.id === 'vote'"
            :blurred="pane.blurred"
          />
          <PaidPanel
            v-else
            :panel="pane.id"
            :blurred="pane.blurred"
          />
        </Pane>
      </Splitpanes>
      <UserMenu />
      <ItemContextMenu />
      <SaveImageModal />
      <SettingsDrawer />
      <ShortcutsModal />
    </template>
  </div>
</template>

<style scoped>
.live-dashboard {
  display: flex;
  flex-direction: column;
  height: 100dvh;
  overflow: hidden;
  background: var(--vtsuru-bg);
  color: var(--vtsuru-fg);
}

.live-dashboard__center {
  margin: auto;
}

.live-dashboard__panes {
  flex: 1;
  min-height: 0;
}

.live-dashboard :deep(.toolbar) {
  font-size: 14px;
}

.live-dashboard :deep(.panel__head) {
  font-size: 12px;
}
</style>

<style>
/* splitpanes 分隔条：细线 + 悬停高亮，替代默认主题 */
.dash-split > .splitpanes__splitter {
  position: relative;
  flex-shrink: 0;
  background: var(--vtsuru-border);
  transition: background 0.15s ease;
}

.dash-split.splitpanes--vertical > .splitpanes__splitter {
  width: 1px;
  cursor: col-resize;
}

.dash-split.splitpanes--horizontal > .splitpanes__splitter {
  height: 1px;
  cursor: row-resize;
}

.dash-split > .splitpanes__splitter::after {
  content: '';
  position: absolute;
  inset: -4px;
  z-index: 1;
}

.dash-split > .splitpanes__splitter:hover {
  background: var(--vtsuru-primary);
}

.dash-split > .splitpanes__pane {
  overflow: hidden;
}
</style>
