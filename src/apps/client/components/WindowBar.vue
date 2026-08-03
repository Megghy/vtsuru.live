<script setup lang="ts">
import type { UnlistenFn } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { onMounted, onUnmounted, ref } from 'vue'

const appWindow = getCurrentWindow()
const isMaximized = ref(false)
let unlisten: UnlistenFn | null = null

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
  <div class="titlebar">
    <div
      style="flex: 1; padding-left: 8px"
      align="center"
      @mousedown="handleTitlebarMouseDown"
    >
      <span>
        <span class="title">VTsuruEventFetcher</span>
      </span>
    </div>
    <div
      data-tauri-drag-region="true"
      justify="flex-end"
      align="center"
      @dblclick="toggleMaximizeWindow"
    >
      <!-- 注意： data-tauri-drag-region 会使整个区域可拖动 -->
      <!-- 如果按钮区域不希望触发拖动（通常是这样），需要确保按钮本身不被拖动 -->
      <!-- 按钮 通常会阻止事件冒泡，所以一般没问题 -->
      <!-- 如果使用普通 <button>，可能需要加 @mousedown.stop -->

      <UButton
        variant="ghost"
        square
        size="tiny"
        title="最小化"
        aria-label="Minimize"
        @click="minimizeWindow"
      >
        <UIcon
          name="i-lucide-minus"
          class="icon"
        />
      </UButton>
      <UButton
        variant="ghost"
        square
        size="tiny"
        :title="isMaximized ? '还原' : '最大化'"
        :aria-label="isMaximized ? 'Restore' : 'Maximize'"
        @click="toggleMaximizeWindow"
      >
        <!-- 根据 isMaximized 状态切换图标 -->
        <UIcon
          name="i-lucide-circle"
          class="icon"
          style="width: 14px; height: 14px"
        />
      </UButton>
      <UButton
        variant="ghost"
        square
        size="tiny"
        title="关闭"
        aria-label="Close"
        @click="closeWindow"
      >
        <UIcon
          name="i-lucide-x"
          class="icon"
        />
      </UButton>
    </div>
  </div>
</template>

<style scoped>
.titlebar {
  flex: 1;
  height: 30px;
  border-bottom: 1px solid var(--vtsuru-border);
  user-select: none; /* 防止拖动时选中文本 */
  padding: 0 4px; /* 给按钮一些边距 */
  box-sizing: border-box;
}

/* 如果需要让按钮区域不可拖动（虽然 按钮通常没问题），可以这样设置 */
/* .titlebar > .u-button {
  -webkit-app-region: no-drag;
  app-region: no-drag;
} */

.icon {
  width: 16px; /* 统一设置图标大小 */
  height: 16px;
}
</style>
