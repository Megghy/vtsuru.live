<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Maximize24Filled, SquareMultiple24Regular } from '@vicons/fluent'; // Maximize 和 Restore 图标
import { Close, RemoveOutline as Minus } from '@vicons/ionicons5'; // Close 和 Minimize 图标
import { NFlex, NButton } from 'naive-ui'; // 显式导入 Naive UI 组件（好习惯）
import { UnlistenFn } from '@tauri-apps/api/event';

const appWindow = getCurrentWindow();
const isMaximized = ref(false);
let unlisten: UnlistenFn | null = null;

// --- Window State Handling ---

// 更新最大化状态的函数
const updateMaximizedState = async () => {
  isMaximized.value = await appWindow.isMaximized();
};

// --- Event Handlers ---

// 处理标题栏的鼠标按下事件 (拖动/双击最大化)
const handleTitlebarMouseDown = (event: MouseEvent) => {
  // 确保是鼠标左键按下
  if (event.buttons === 1) {
    // event.detail 在 mousedown 事件中可以用来检测点击次数
    if (event.detail === 2) {
      // 双击：切换最大化
      appWindow.toggleMaximize();
    } else {
      // 单击：开始拖动
      appWindow.startDragging();
    }
  }
};

// --- Lifecycle Hooks ---

onMounted(async () => {
  // 1. 组件挂载时，获取并设置初始的最大化状态
  await updateMaximizedState();

  // 2. 监听窗口大小变化事件，当窗口状态改变时（包括最大化/恢复）更新状态
  //    Tauri v1 使用 'tauri://resize'， Tauri v2 可能有更具体的事件，但 resize 通常会触发
  unlisten = await appWindow.onResized(() => {
    updateMaximizedState();
  });

  // 注意：某些情况下 (如 Linux 上的某些窗口管理器)，
  // toggleMaximize 可能不会立即触发 onResized。
  // 如果遇到图标不更新的问题，可以考虑在 toggleMaximize 调用后加一个小的延时再手动调用 updateMaximizedState。
  // 例如：
  // const handleToggleMaximize = () => {
  //   appWindow.toggleMaximize();
  //   setTimeout(updateMaximizedState, 100); // 略微延迟更新
  // }
  // 然后在 maximize 按钮上使用 @click="handleToggleMaximize"
});

onUnmounted(() => {
  // 组件卸载时，移除事件监听器，防止内存泄漏
  if (unlisten) {
    unlisten();
  }
});

// --- Window Control Functions ---
const minimizeWindow = () => appWindow.minimize();
const toggleMaximizeWindow = () => appWindow.toggleMaximize();
const closeWindow = () => appWindow.hide();

</script>

<template>
  <NFlex
    class="titlebar"
  >
    <NFlex
      style="flex: 1; padding-left: 8px;"
      align="center"
      @mousedown="handleTitlebarMouseDown"
    >
      <NText>
        <span class="title">VTsuruEventFetcher</span>
      </NText>
    </NFlex>
    <NFlex
      data-tauri-drag-region="true"
      justify="flex-end"
      align="center"
      @dblclick="toggleMaximizeWindow"
    >
      <!-- 注意： data-tauri-drag-region 会使整个区域可拖动 -->
      <!-- 如果按钮区域不希望触发拖动（通常是这样），需要确保按钮本身不被拖动 -->
      <!-- Naive UI 的 NButton 通常会阻止事件冒泡，所以一般没问题 -->
      <!-- 如果使用普通 <button>，可能需要加 @mousedown.stop -->

      <NButton
        quaternary
        circle
        size="tiny"
        aria-label="Minimize"
        @click="minimizeWindow"
      >
        <Minus class="icon" />
      </NButton>
      <NButton
        quaternary
        circle
        size="tiny"
        :aria-label="isMaximized ? 'Restore' : 'Maximize'"
        @click="toggleMaximizeWindow"
      >
        <!-- 根据 isMaximized 状态切换图标 -->
        <component
          :is="isMaximized ? SquareMultiple24Regular : Maximize24Filled"
          class="icon"
          style="width: 14px; height: 14px;"
        />
      </NButton>
      <NButton
        quaternary
        circle
        size="tiny"
        aria-label="Close"
        @click="closeWindow"
      >
        <Close class="icon" />
      </NButton>
    </NFlex>
  </NFlex>
</template>

<style scoped>
.titlebar {
  flex: 1;
  height: 30px;
  border-bottom: 1px solid var(--border-color); /* 使用 Naive UI 边框颜色变量或默认值 */
  user-select: none; /* 防止拖动时选中文本 */
  padding: 0 4px; /* 给按钮一些边距 */
  box-sizing: border-box;
}

/* 如果需要让按钮区域不可拖动（虽然 NButton 通常没问题），可以这样设置 */
/* .titlebar > .n-button {
  -webkit-app-region: no-drag;
  app-region: no-drag;
} */

.icon {
  width: 16px; /* 统一设置图标大小 */
  height: 16px;
}
</style>