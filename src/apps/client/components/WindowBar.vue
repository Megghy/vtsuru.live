<script setup lang="ts">
import { Copy, Minus, Square, X } from 'lucide-vue-next'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { isLiveStreaming, roomInfo } from '@/apps/client/data/info'
import { useGiftWindow } from '@/apps/client/store/useGiftWindow'
import { useSettings } from '@/apps/client/store/useSettings'
import { isTauri } from '@/shared/config'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'

const router = useRouter()
const isMaximized = ref(false)
const giftWindow = useGiftWindow()
const settingsStore = useSettings()

const closeTooltipText = computed(() =>
  settingsStore.settings.closeWindowAction === 'exit' ? '退出客户端' : '关闭到后台',
)

const liveTitle = computed(() => roomInfo.value?.title || giftWindow.currentLive?.title || '直播中')

let unlistenResize: (() => void) | null = null

async function getTauriWindow() {
  if (!isTauri()) return null
  const { getCurrentWindow } = await import('@tauri-apps/api/window')
  return getCurrentWindow()
}

onMounted(async () => {
  const appWindow = await getTauriWindow()
  if (!appWindow) return

  isMaximized.value = await appWindow.isMaximized()
  unlistenResize = await appWindow.onResized(async () => {
    isMaximized.value = await appWindow.isMaximized()
  })
})

onUnmounted(() => {
  unlistenResize?.()
})

async function minimizeWindow() {
  const appWindow = await getTauriWindow()
  if (appWindow) await appWindow.minimize()
}

async function toggleMaximizeWindow() {
  const appWindow = await getTauriWindow()
  if (appWindow) await appWindow.toggleMaximize()
}

async function closeWindow() {
  if (settingsStore.settings.closeWindowAction === 'exit' && isTauri()) {
    try {
      const { useWebFetcher } = await import('@/store/useWebFetcher')
      await Promise.race([useWebFetcher().Stop(), new Promise((resolve) => setTimeout(resolve, 1500))])
    } catch {
      // 忽略清理异常，确保正常退出
    }
    const { exit } = await import('@tauri-apps/plugin-process')
    await exit(0)
    return
  }
  const appWindow = await getTauriWindow()
  if (appWindow) await appWindow.hide()
}

function goToLiveManage() {
  router.push({ name: 'client-live-manage' })
}
</script>

<template>
  <header
    class="flex justify-between items-center h-9 bg-background border-b border-border select-none relative z-[1000] px-2.5 pointer-events-auto"
  >
    <!-- 左侧可拖拽区域：标题与状态 -->
    <div
      class="flex items-center gap-3 flex-1 h-full cursor-default"
      data-tauri-drag-region
    >
      <span class="text-xs font-semibold text-foreground tracking-[0.5px] pointer-events-none">VTsuru.Client</span>

      <TooltipProvider v-if="isLiveStreaming">
        <Tooltip>
          <TooltipTrigger as-child>
            <Badge
              variant="destructive"
              size="sm"
              class="cursor-pointer"
              data-tauri-drag-region="false"
              @click="goToLiveManage"
            >
              <span class="inline-block size-1.5 rounded-full bg-current mr-1 animate-pulse" />
              直播中
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            正在直播：{{ liveTitle }}
            <br />
            点击进入直播管理
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Badge
        v-else
        variant="secondary"
        size="sm"
        class="pointer-events-none"
      >
        未开播
      </Badge>
    </div>

    <!-- 窗口控制按钮 -->
    <TooltipProvider>
      <div class="flex items-center gap-0.5">
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="最小化"
              @click="minimizeWindow"
            >
              <Minus class="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>最小化</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon-xs"
              :aria-label="isMaximized ? '还原' : '最大化'"
              @click="toggleMaximizeWindow"
            >
              <Copy
                v-if="isMaximized"
                class="size-3"
              />
              <Square
                v-else
                class="size-3"
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{{ isMaximized ? '还原' : '最大化' }}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon-xs"
              class="hover:bg-destructive hover:text-white"
              :aria-label="closeTooltipText"
              @click="closeWindow"
            >
              <X class="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{{ closeTooltipText }}</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  </header>
</template>
