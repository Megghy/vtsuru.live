<script setup lang="ts">
import { Maximize24Filled, SquareMultiple24Regular } from '@vicons/fluent'
import { Close, RemoveOutline as Minus } from '@vicons/ionicons5'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { useGiftWindow } from '@/apps/client/store/useGiftWindow'
import { Badge } from '@/shared/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'

const router = useRouter()
const isMaximized = ref(false)
const giftWindow = useGiftWindow()

// 直播控制，用于显示当前开播状态
const currentLive = computed(() => giftWindow.currentLive)
const isLiving = computed(() => Boolean(currentLive.value && !currentLive.value.isFinish))

let unlistenResize: (() => void) | null = null

async function getTauriWindow() {
  if (typeof window === 'undefined' || !(window as any).__TAURI_INTERNALS__) {
    return null
  }
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    return getCurrentWindow()
  } catch {
    return null
  }
}

onMounted(async () => {
  const appWindow = await getTauriWindow()
  if (!appWindow) return

  try {
    isMaximized.value = await appWindow.isMaximized()
    unlistenResize = await appWindow.onResized(async () => {
      isMaximized.value = await appWindow.isMaximized()
    })
  } catch {
    // 忽略非桌面端或未初始化异常
  }
})

onUnmounted(() => {
  if (unlistenResize) {
    unlistenResize()
  }
})

async function minimizeWindow() {
  const appWindow = await getTauriWindow()
  if (!appWindow) return
  try {
    await appWindow.minimize()
  } catch {
    // 忽略
  }
}

async function toggleMaximizeWindow() {
  const appWindow = await getTauriWindow()
  if (!appWindow) return
  try {
    await appWindow.toggleMaximize()
  } catch {
    // 忽略
  }
}

async function closeWindow() {
  const appWindow = await getTauriWindow()
  if (!appWindow) return
  try {
    await appWindow.hide()
  } catch {
    // 忽略
  }
}

// 拖拽窗口 (双击最大化)
let lastClickTime = 0
async function handleTitlebarMouseDown(e: MouseEvent) {
  // 只响应左键
  if (e.button !== 0) return

  const now = Date.now()
  if (now - lastClickTime < 300) {
    // 双击切换最大化
    toggleMaximizeWindow()
    lastClickTime = 0
    return
  }
  lastClickTime = now

  // 单击拖拽窗口
  const appWindow = await getTauriWindow()
  if (!appWindow) return
  try {
    await appWindow.startDragging()
  } catch {
    // 忽略
  }
}

function goToLiveManage() {
  router.push({ name: 'client-live-manage' })
}
</script>

<template>
  <header
    class="flex justify-between items-center h-9 bg-background border-b border-border select-none relative z-[1000] px-2.5"
  >
    <!-- 左侧可拖拽区域：标题与状态 -->
    <div
      class="flex items-center gap-3 flex-1 h-full cursor-default"
      data-tauri-drag-region
      @mousedown="handleTitlebarMouseDown"
    >
      <span class="text-xs font-semibold text-foreground tracking-[0.5px]">VTsuru.Client</span>

      <!-- 开播状态指示 (可点击跳转直播管理) -->
      <TooltipProvider v-if="isLiving">
        <Tooltip>
          <TooltipTrigger as-child>
            <Badge
              variant="destructive"
              class="h-5 px-2 text-[11px] font-normal cursor-pointer rounded-full"
              @click="goToLiveManage"
            >
              <span class="inline-block size-1.5 rounded-full bg-current mr-1 animate-pulse" />
              直播中
            </Badge>
          </TooltipTrigger>
          <TooltipContent class="text-xs">
            正在直播：{{ currentLive?.title }}
            <br />
            点击进入直播管理
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Badge
        v-else
        variant="secondary"
        class="h-5 px-2 text-[11px] font-normal rounded-full"
      >
        未开播
      </Badge>
    </div>

    <!-- 窗口控制按钮 -->
    <div class="flex items-center gap-1">
      <button
        class="flex items-center justify-center w-7 h-6 border-0 bg-transparent text-muted-foreground rounded cursor-pointer transition-colors duration-150 hover:bg-muted hover:text-foreground"
        title="最小化"
        @click="minimizeWindow"
      >
        <Minus class="size-3.5" />
      </button>

      <button
        class="flex items-center justify-center w-7 h-6 border-0 bg-transparent text-muted-foreground rounded cursor-pointer transition-colors duration-150 hover:bg-muted hover:text-foreground"
        :title="isMaximized ? '还原' : '最大化'"
        @click="toggleMaximizeWindow"
      >
        <component
          :is="isMaximized ? SquareMultiple24Regular : Maximize24Filled"
          class="size-3.5"
        />
      </button>

      <button
        class="flex items-center justify-center w-7 h-6 border-0 bg-transparent text-muted-foreground rounded cursor-pointer transition-colors duration-150 hover:bg-destructive hover:text-white"
        title="关闭到后台"
        @click="closeWindow"
      >
        <Close class="size-3.5" />
      </button>
    </div>
  </header>
</template>
