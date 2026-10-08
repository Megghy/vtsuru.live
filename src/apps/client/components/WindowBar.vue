<script setup lang="ts">
import type { UnlistenFn } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { Live20Filled, Maximize24Filled, SquareMultiple24Regular } from '@vicons/fluent' // Maximize 和 Restore 图标
import { Close, RemoveOutline as Minus } from '@vicons/ionicons5' // Close 和 Minimize 图标
import { NButton, NFlex, NIcon, NTag, NText, NTooltip } from 'naive-ui'
// 显式导入 Naive UI 组件（好习惯）
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { useGiftWindow } from '@/apps/client/store/useGiftWindow'

const router = useRouter()
const giftWindow = useGiftWindow()
const appWindow = getCurrentWindow()
const isMaximized = ref(false)
let unlisten: UnlistenFn | null = null

const currentLive = computed(() => giftWindow.currentLive)
const isLiving = computed(() => {
  return currentLive.value && !currentLive.value.isFinish
})

function goToLiveManage() {
  router.push({ name: 'client-live-manage' })
}

// --- Window State Handling ---

// 更新最大化状态的函数
async function updateMaximizedState() {
  isMaximized.value = await appWindow.isMaximized()
}

// --- Event Handlers ---

// 处理标题栏的鼠标按下事件 (拖动/双击最大化)
function handleTitlebarMouseDown(event: MouseEvent) {
  // 确保是鼠标左键 (mousedown 时 button === 0 表示左键)
  if (event.button === 0) {
    // event.detail 在 mousedown 事件中可以用来检测点击次数
    if (event.detail === 2) {
      // 双击：切换最大化
      toggleMaximizeWindow()
    } else {
      // 单击：开始拖动
      appWindow.startDragging()
    }
  }
}

// --- Lifecycle Hooks ---

onMounted(async () => {
  // 1. 组件挂载时，获取并设置初始的最大化状态
  await updateMaximizedState()

  // 2. 监听窗口大小变化事件，当窗口状态改变时（包括最大化/恢复）更新状态
  //    Tauri v1 使用 'tauri://resize'， Tauri v2 可能有更具体的事件，但 resize 通常会触发
  unlisten = await appWindow.onResized(() => {
    updateMaximizedState()
  })
})

onUnmounted(() => {
  // 组件卸载时，移除事件监听器，防止内存泄漏
  if (unlisten) {
    unlisten()
  }
})

// --- Window Control Functions ---
const minimizeWindow = () => appWindow.minimize()
async function toggleMaximizeWindow() {
  await appWindow.toggleMaximize()
  // 某些窗口管理器下 toggleMaximize 不会触发 onResized, 主动补一次状态查询
  await updateMaximizedState()
}
const closeWindow = () => appWindow.hide()
</script>

<template>
  <header
    class="titlebar"
    data-tauri-drag-region="true"
  >
    <div
      class="titlebar-left"
      @mousedown="handleTitlebarMouseDown"
    >
      <span class="title">VTsuru.Client</span>

      <!-- 开播状态指示 (可点击跳转直播管理) -->
      <NTooltip
        v-if="isLiving"
        placement="bottom"
      >
        <template #trigger>
          <NTag
            type="error"
            size="tiny"
            round
            :bordered="false"
            class="live-status-tag live-status-tag--active"
            @click.stop="goToLiveManage"
          >
            <template #icon>
              <span class="live-dot pulse" />
            </template>
            直播中{{ currentLive?.title ? ` · ${currentLive.title}` : '' }}
          </NTag>
        </template>
        <div>
          <div><strong>{{ currentLive?.title || '直播中' }}</strong></div>
          <div style="font-size: 12px; opacity: 0.85">
            点击前往「直播管理」页面
          </div>
        </div>
      </NTooltip>

      <NTag
        v-else
        size="tiny"
        round
        :bordered="false"
        class="live-status-tag live-status-tag--idle"
        @click.stop="goToLiveManage"
      >
        <template #icon>
          <span class="live-dot" />
        </template>
        未开播
      </NTag>
    </div>

    <div
      class="titlebar-controls"
      data-tauri-drag-region="true"
      @dblclick="toggleMaximizeWindow"
    >
      <NButton
        quaternary
        circle
        size="tiny"
        title="最小化"
        aria-label="Minimize"
        class="window-btn"
        @click="minimizeWindow"
      >
        <Minus class="icon" />
      </NButton>
      <NButton
        quaternary
        circle
        size="tiny"
        :title="isMaximized ? '还原' : '最大化'"
        :aria-label="isMaximized ? 'Restore' : 'Maximize'"
        class="window-btn"
        @click="toggleMaximizeWindow"
      >
        <component
          :is="isMaximized ? SquareMultiple24Regular : Maximize24Filled"
          class="icon"
          style="width: 14px; height: 14px"
        />
      </NButton>
      <NButton
        quaternary
        circle
        size="tiny"
        title="关闭"
        aria-label="Close"
        class="window-btn window-btn--close"
        @click="closeWindow"
      >
        <Close class="icon" />
      </NButton>
    </div>
  </header>
</template>

<style scoped>
.titlebar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 30px;
  min-height: 30px;
  max-height: 30px;
  width: 100%;
  flex: 0 0 30px;
  flex-shrink: 0;
  border-bottom: 1px solid var(--vtsuru-border);
  user-select: none;
  padding: 0 4px;
  box-sizing: border-box;
  background-color: var(--vtsuru-bg-surface);
  z-index: 1000;
}

.titlebar-left {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-left: 8px;
  flex: 1;
  height: 100%;
  min-width: 0;
}

.titlebar-controls {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  height: 100%;
}

/* 如果需要让按钮区域不可拖动（虽然 NButton 通常没问题），可以这样设置 */
/* .titlebar > .n-button {
  -webkit-app-region: no-drag;
  app-region: no-drag;
} */

.title {
  font-weight: 600;
  font-size: 12px;
  letter-spacing: 0.3px;
  opacity: 0.9;
}

.live-status-tag {
  cursor: pointer;
  max-width: 320px;
  font-size: 11px;
  transition: all 0.2s ease;
  -webkit-app-region: no-drag;
}

.live-status-tag:hover {
  opacity: 0.85;
}

.live-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--vtsuru-fg-muted, #9ca3af);
  margin-right: 2px;
}

.live-dot.pulse {
  background: #ef4444;
  box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
  animation: pulse-red 2s infinite;
}

@keyframes pulse-red {
  0% {
    transform: scale(0.95);
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
  }
  70% {
    transform: scale(1);
    box-shadow: 0 0 0 5px rgba(239, 68, 68, 0);
  }
  100% {
    transform: scale(0.95);
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0);
  }
}

.icon {
  width: 16px; /* 统一设置图标大小 */
  height: 16px;
}

.window-btn {
  transition: all 0.15s ease;
}

.window-btn--close:hover {
  background-color: #e81123 !important;
  color: #ffffff !important;
}
</style>
