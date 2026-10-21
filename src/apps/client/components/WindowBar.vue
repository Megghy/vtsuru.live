<script setup lang="ts">
import type { UnlistenFn } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { Maximize24Filled, SquareMultiple24Regular } from '@vicons/fluent'
import { Close, RemoveOutline as Minus } from '@vicons/ionicons5'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { useGiftWindow } from '@/apps/client/store/useGiftWindow'
import { Badge } from '@/shared/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'

const router = useRouter()
const giftWindow = useGiftWindow()
const appWindow = getCurrentWindow()
const isMaximized = ref(false)
let unlisten: UnlistenFn | null = null

const currentLive = computed(() => giftWindow.currentLive)
const isLiving = computed(() => {
  return Boolean(currentLive.value && !currentLive.value.isFinish)
})

function goToLiveManage() {
  router.push({ name: 'client-live-manage' })
}

async function updateMaximizedState() {
  isMaximized.value = await appWindow.isMaximized()
}

function handleTitlebarMouseDown(event: MouseEvent) {
  if (event.button === 0) {
    if (event.detail === 2) {
      toggleMaximizeWindow()
    } else {
      appWindow.startDragging()
    }
  }
}

onMounted(async () => {
  await updateMaximizedState()
  unlisten = await appWindow.onResized(() => {
    updateMaximizedState()
  })
})

onUnmounted(() => {
  if (unlisten) {
    unlisten()
  }
})

const minimizeWindow = () => appWindow.minimize()
async function toggleMaximizeWindow() {
  await appWindow.toggleMaximize()
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
      <TooltipProvider v-if="isLiving">
        <Tooltip>
          <TooltipTrigger as-child>
            <Badge
              variant="destructive"
              class="live-status-tag live-status-tag--active h-5 px-2 text-[11px] font-normal cursor-pointer rounded-full"
              @click.stop="goToLiveManage"
            >
              <span class="live-dot pulse" />
              直播中{{ currentLive?.title ? ` · ${currentLive.title}` : '' }}
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <div>
              <div class="font-bold">{{ currentLive?.title || '直播中' }}</div>
              <div class="text-xs opacity-85">
                点击前往「直播管理」页面
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Badge
        v-else
        variant="secondary"
        class="live-status-tag live-status-tag--idle h-5 px-2 text-[11px] font-normal cursor-pointer rounded-full"
        @click.stop="goToLiveManage"
      >
        <span class="live-dot" />
        未开播
      </Badge>
    </div>

    <div
      class="titlebar-controls"
      data-tauri-drag-region="true"
      @dblclick="toggleMaximizeWindow"
    >
      <button
        type="button"
        title="最小化"
        aria-label="Minimize"
        class="window-btn flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
        @click="minimizeWindow"
      >
        <Minus class="icon" />
      </button>
      <button
        type="button"
        :title="isMaximized ? '还原' : '最大化'"
        :aria-label="isMaximized ? 'Restore' : 'Maximize'"
        class="window-btn flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
        @click="toggleMaximizeWindow"
      >
        <component
          :is="isMaximized ? SquareMultiple24Regular : Maximize24Filled"
          class="icon"
          style="width: 14px; height: 14px"
        />
      </button>
      <button
        type="button"
        title="关闭"
        aria-label="Close"
        class="window-btn window-btn--close flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive hover:text-destructive-foreground"
        @click="closeWindow"
      >
        <Close class="icon" />
      </button>
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
  border-bottom: 1px solid var(--border);
  user-select: none;
  padding: 0 4px;
  box-sizing: border-box;
  background-color: var(--card);
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

.title {
  font-weight: 600;
  font-size: 12px;
  letter-spacing: 0.3px;
  opacity: 0.9;
}

.live-status-tag {
  cursor: pointer;
  max-width: 320px;
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
  background: var(--muted-foreground, #9ca3af);
  margin-right: 4px;
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
  width: 16px;
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
